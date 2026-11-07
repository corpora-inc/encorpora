# AMP for Schools

Schools, districts and single teachers use AMP through a roster layer on top of the learner the practice loop already knows. This document is the design every school change follows: what each person gets, the data model, the seams into existing code, and sign-in.

Build order:

1. Foundation: roster, access, license and settings tables; `can`, `defineSchoolRoute`, `resolveSettings`, event log; the seams; `scripts/school-admin.ts`.
2. Evidence: rollup trigger, level days, heartbeat, read queries.
3. First run: UI kit and `SchoolFrame`; guided setup, invites, calendar, import wizard, seats; card, code and pictures; Start class; printable cards.
4. Teacher: Today, class map, student record, gradebook, evidence sheet, time report, report-card PDF, exports.
5. Classroom: levels and standings with settings at every scope; workbook stack and roster marking.
6. School and district: overview, rollups, year rollover, integrations with Google and Microsoft sign-in, privacy center, activity log.
7. Launch: `/schools`, scope and sequence, trust page, parent link; synthetic seed for 30, 1,000 and 10,000 students; capture rig; full sweep and polish; load test; links from the site.

## What each person gets

| Person | Experience |
|---|---|
| **Head or admin** | Guided setup in minutes: school, calendar, data agreement, roster, teachers. Then an overview: seats, usage by class, who needs attention. |
| **District** | The same screens rolled up across schools, drilling into any school, with the power to set and lock policy. |
| **Teacher** | **Today**: a to-do list of who needs them and which students share a gap, each with one action (teach this lesson, print a group sheet). Then class map, gradebook, time, workbook stack, and a projectable **Start class** board. |
| **Student** | Hold a card to the camera, or code → tap your name → pick 3 pictures; or Google/Microsoft. Then the same practice loop. No email needed. |
| **Parent** | A read-only progress link the school can share. |

What schools ask, and the product's answer:

| Asked | Answer |
|---|---|
| Scope and sequence | Public PDF and CSV generated from the live catalog |
| Who does setup | The school admin or a single teacher, in the guided flow |
| Who grades and sees work | Teachers (their classes), admins (all), parents (shared link). Every grade opens to its evidence |
| What reports | Suggested and final grades, active time by student, day and skill, progress, report-card PDF, CSV and OneRoster exports |

### Routes (each a real URL)

- **Public:** `/schools`, `/schools/scope-and-sequence`, `/schools/trust`
- **Student:** `/join`, `/join/$code`, `/join/$code/$person`, `/c#<token>`, then the existing `/practice`, plus `/standings` when a class turns it on
- **Staff:** `/school`, `/school/new`, `/school/invite` (the token is in the fragment, so it never reaches a server log or report), `/school/$org` (overview), `.../classes/$class` with tabs `today`, `map`, `gradebook`, `time`, `workbooks`, `roster`, `roster/cards`, `experience`, `start`; `.../students/$student`; `.../classes`, `.../staff`, `.../sign-in-help`, `.../calendar`, `.../experience`, `.../import`, `.../integrations`, `.../license`, `.../privacy`, `.../activity`; `.../schools` for districts

It scales by collapsing. A lone teacher never sees school admin screens. A district adds one level above. Phones get cards instead of grids at 320 and 390 px.

## Student experience is the school's choice

Schools have real philosophies here, and this control is a selling point. Settings cascade **district → school → class → student**. A higher level can lock one, and the screen shows who set it.

| Setting | Values | Starts at |
|---|---|---|
| Show levels to students | Hidden, student's choice, shown | Hidden |
| Standings | Off, class, school, district | Off |
| Standings measure | Growth this term, practice, level | Growth |
| Device mode | Shared, personal | Shared |

- Setup offers three starting points, "Quiet focus", "Levels visible" and "Friendly competition". A teacher running an AP class as a competition changes it for that class unless the school locked it.
- **Standings:** independent work only. A board shows the top 10 and your own line, never a ranked list down to last place. Class boards use names; wider boards use generated handles and group by grade level. A teacher can leave any student off.
- **Never affects scheduling:** time, grades, levels and standings don't feed what's scheduled next.
- **Real data later:** every setting change goes in the event log, so outcomes under each setting can be compared once we have scale.
- The family product stays as it is.

## The grade model

Percent correct is the wrong grade, because AMP serves harder work as students succeed. AMP suggests a **grade range** for a class and term from four components, with fixed defaults. **The teacher decides the grade.**

| Component | Question | Evidence | Weight |
|---|---|---|---|
| Course progress | How far through this course's ground? | Strand working levels against the course band and where the calendar says the class should be | 40% |
| Growth | How much ground this term? | Objectives newly demonstrated, plus levels gained, against a pace of one grade per year | 30% |
| Practice | Did the work get done? | Active minutes and problems against the teacher's weekly target; if none is set, against the class median | 20% |
| Retention | Does it stick? | Independent success on spaced review problems, the one place accuracy isn't skewed by adaptivity | 10% |

- **The gradebook:** suggested range as letter and percent (for example "B to A−, 84–91"), and a final grade the teacher types in whatever form the school uses: B+, 87, 3, Pass. No scale or weight settings; the one number a teacher can set is the weekly target. Too little work shows "Not enough work yet", never a low grade.
- **Every grade opens to evidence:** the objectives, the dates and the actual problems, so "why a B?" takes one click. Overrides are logged. Export as a column to blend with the rest of the course grade.
- **Mixed-grade classes:** a class with no course grades each student against their own grade level.
- **Implementation:** versioned policy in `src/schools/grade-policy.ts`, tuned by agents, following `practice-policy.ts`. Closed terms are frozen with their inputs.
- **Tests with personas:** fast accelerator, steady at-level, two grades behind but growing fast, high accuracy with little work, inactive, joined mid-term.

## Data model

### Principles

1. **Learning stays one identity.** `amp_learners` and everything hanging off it stay as they are. Schools add a roster layer that points at a learner; evidence never moves.
2. **Shaped like OneRoster.** Clever, ClassLink and most SIS exports speak it, so CSV, OneRoster and future sources all become the same rows.
3. **One concept, one table.** One table for people, one for class membership, one for the calendar, one settings mechanism, one event log.
4. **One rule in one place.** One function decides who can do what, one resolves settings, one defines a route.
5. **Evidence is immutable, projections are rebuildable, closed grades are frozen.**
6. **History is kept.** Enrollments and roles have dates, and changes are events.

### Tables

| Table | One row is | Key columns |
|---|---|---|
| `amp_orgs` | A district, network or school, as a tree | `kind`, `parent_id`, `path uuid[]` (root first), `name`, `timezone` |
| `amp_people` | One person in one tenant (root org) | `tenant_id`, `given_name`, `family_name?`, `display_name?` (school-edited, imports never touch it), `handle`, `email?`, `identifier?` (SIS-facing ID), `grade_level?`, `account_id?` (staff), `learner_id?` (student, unique), `timezone` (copied from school for the trigger), `deleted_at?` |
| `amp_org_roles` | A person's role at an org, over dates | `person_id`, `org_id`, `role` (`admin`, `teacher`, `aide`, `viewer`, `student`), `begin_on`, `end_on?` |
| `amp_academic_sessions` | A year, semester, trimester, quarter or custom period | `org_id`, `parent_id`, `kind`, `name`, `starts_on`, `ends_on` |
| `amp_classes` | A class section | `org_id`, `session_id`, `name`, `course_bands text[]` (empty means each student's own grade), `grading_kind`, `join_code`, `join_failed_count`, `join_locked_until?`, `rolled_from?`, `archived_at?` |
| `amp_enrollments` | A person in a class, over dates | `class_id`, `person_id`, `role` (`student`, `teacher`, `aide`), `begin_on`, `end_on?` |
| `amp_external_refs` | One outside system's ID for one of our rows | `UNIQUE(tenant_id, source, kind, sourced_id)`, `local_id`. `source` is per connection |
| `amp_person_credentials` | One way to reach a person | `person_id`, `kind` (`card`, `picture`, `sso`, `invite`, `share`), `lookup_hash`, `secret_hash?`, `failed_count`, `locked_until?`, `expires_at?`, `revoked_at?` |
| `amp_student_sessions` | A signed-in student device | `token_hash`, `person_id`, `mode` (`shared`, `personal`), `expires_at`, `last_seen_at`, `revoked_at?` |
| `amp_data_agreements` | An org's acceptance of the data agreement; the nearest one up the path applies | `org_id`, `version`, `signer_person_id?`, `signer_name`, `signer_title`, `accepted_at`, `ended_at?` |
| `amp_school_licenses` | A pool of seats for dates (never a price) | `org_id`, `seats`, `starts_at`, `ends_at`, `status`, `reference` (PO, invoice) |
| `amp_seats` | One student holding one seat, at most one open per person | `license_id`, `person_id`, `grant_id?` → `amp_grants`, `assigned_at`, `released_at?` |
| `amp_scope_settings` | Settings set at one scope | `scope_kind` (`org`, `class`, `person`), `scope_id`, `values jsonb`, `locked text[]` |
| `amp_school_events` | Anything that changed, append-only | `org_id`, `actor_person_id?`, `action`, `target_kind`, `target_id`, `detail jsonb` (before and after), `at` |
| `amp_term_grades` | One student's grade for one class and period | `class_id`, `session_id`, `person_id`, `suggested jsonb` (inputs and policy version), `final_value?`, `final_by?`, `frozen_at?` |
| `amp_skill_days` | Rollup per learner, day, skill | counts: attempts, correct, independent, assisted, review, review independent |
| `amp_active_days` | Active time per learner, day, surface, skill | `active_ms` |
| `amp_level_days` | A learner's stored level estimate for a day | `frontier jsonb`, `policy_version` |

**Keys and integrity:**

- A school student's learner has `account_id='school:<person id>'`, one synthetic account per student. Never a shared class account: `/me` takes an exclusive lock and lists every learner.
- **A learner has exactly one owner**, enforced by `UNIQUE(learner_id)`, because `transaction()` requires a matching `account_id`. A move is one transaction: revoke the seat grant, move the account, clear the old link, set the new one. The old school keeps frozen grades.
- **Deleting doesn't erase a registrar's record by accident.** Evidence rollups cascade from `amp_learners`, so existing deletion and retention reach them. `amp_people` tombstones through `deleted_at`; `learner_id` and `grant_id` are `ON DELETE SET NULL`. Triggers on those links set `deleted_at` and the seat's `released_at`, so no deletion path needs to know about schools. The tombstone keeps no personal fields: `given_name` becomes `Removed`, and `family_name`, `display_name` and `email` become null. `identifier` stays, so final grades still map to the school's SIS record, and so does the generated `handle`. A move clears the old link, so the old school's row is scrubbed the same way. Agreements copy the signer's name, so deleting a teacher can't block or rewrite history.
- **Dates.** A role or enrollment is active from `begin_on` up to, but not including, `end_on`, in the org's timezone. Ending one today stops access on the next request.
- Evidence rollups key on `learner_id`, so they survive transfers and class changes.
- `UNIQUE(tenant_id, account_id)` where present. Email is indexed but not unique, because siblings often share a parent's address. One active enrollment per class, person and role.
- No hot rows: nothing per-org is written during practice, and `hasAccess` still reads only `amp_grants`.
- Grant rows use channel `pilot` with id `school-seat:<seat>`, satisfying every license gate and avoiding three CHECK widenings.

### The real cases

| Case | How it works | New branch? |
|---|---|---|
| One teacher, 30 students | One school org, one admin-teacher, one class. UI collapses | No |
| 100-student private school | One school, staff roles, several classes, one license | No |
| 10,000-student district | Root org with school children. Roles at root flow down `path` | No |
| Teacher at two schools in a district | One person, two `amp_org_roles` | No |
| Teacher at two separate schools | Two people, same `account_id`. The org switcher lists both | No |
| Teacher who is also a parent | Same account has learners and a staff role | No |
| Substitute, aide, coordinator | Role with an `end_on`, or `viewer` for read-only | No |
| Co-teachers | Two teacher enrollments in a class | No |
| Teacher takes over mid-term | Old enrollment ends and access stops on the next request; their overrides stay attributed | No |
| Student transfers campus | End one role, begin another. Same person and learner | No |
| Student added or dropped mid-term | Enrollment dates. A grade counts only enrolled days | No |
| Student in math and intervention | Two enrollments, same evidence, each through its own course. Levels use the most restrictive setting; standings stay per class | No |
| Twins, same name, or one name only | School-edited `display_name` on the join screen; `family_name` is optional | No |
| Siblings share a parent's email | Email isn't unique; they sign in by card | No |
| Student at two separate schools | Two learners. Probably rare | No |
| New district wants their history | The one-transaction move above | Later |
| Student leaves for home, or a family learner joins a school | The same move, as trial adoption does today (`repository.ts:500`), refused while family billing is open | Later |
| Quarters, semesters, trimesters, custom | One session tree. District calendar inherited unless a school defines its own. `grading_kind` lets K–5 use trimesters while 6–12 use semesters | No |
| School hasn't entered a calendar | Setup creates a default school year | No |
| Year rollover | New year sessions, classes copied with `rolled_from`, grade levels advanced, history kept | No |
| Re-import, or CSV today and Clever later | Upsert through `amp_external_refs`. The dry run stops if an ID now points at a different name, so a reused SIS ID can't give one child another's record | No |
| School deletes a student | Learning data goes; final grades stay unless the school asks for full erasure | No |
| Seats run out | Student is rostered and shows "needs a seat"; the head sees "Add seats" | No |
| Seat reassigned or license renewed | Release revokes the grant; a new seat writes a new grant | No |
| District-wide pool | License sits on the district org; students in any school draw from it | No |
| AP class competes, next door stays quiet | `amp_scope_settings` at class scope | No |
| District forbids visible levels | `locked` at the root; lower values are ignored and rejected | No |
| Contract ends | Practice stops, with "ask your teacher" rather than Buy. Data follows the existing retention rule: 24 months after the later of last activity and license end | No |

Merging duplicate students and a standalone school joining a district are agent-run procedures for later, with no new tables.

### Keeping branching small

**This is the complete list of places existing code learns about schools:**

1. `learningAccount` recognises `Bearer st_…`, returning `school:<person id>`.
2. A wrapper on `authenticateIdentity` (`main.ts:91`) gives `st_` a 401 on parent-only routes, even with a cookie on a shared device.
3. `learningConsentActive` gets one `school:` branch: student active, with an accepted agreement at the nearest org up the path.
4. `parent()` gains a sibling, `familyManaged()`, on the routes students can't use: create learner, birth year, starting point, reset, self-marking paper. One word changes per route.
5. `/me` delegates to a separate `studentMe()`, parent-shaped with `account.kind:'student'`. `LegacyApp`, practice, lessons and progress then run unchanged. Its `consent.status` stays `active` so the app never routes a student to parent setup; `canPractice` carries the truth, and false means "ask your teacher".
6. `web/auth.ts` (`accessSession`, `signOut`) and `trialSessionOptions` handle student tokens, and a bad student token goes to `/join`. Parent-only routes also answer a student 401, so only `/me` decides that a sign-in has ended.
7. One synchronous `isStudentDevice()` turns off analytics and engagement before they start. It is true with a stored student token and on the sign-in screens themselves (`/join`, `/c`), which run before any token exists.
8. One hook in `/batches` stores the day's level.
9. `insights.ts` excludes `school:%` so school use doesn't skew family reports.
10. Parent chrome is hidden on `account.kind` in the drawer and `LegacyApp`, and `CurriculumDetails` reads the resolved level setting. A student's direct link to a family, purchase, trial, setup or workbook screen goes back to practice.

**Inside `src/schools/`:**

- **`defineSchoolRoute({ action, ... })`** is the only way to add a route, so a route can't skip authorization, and a test walks the whole table against a cross-tenant matrix.
- **`can(actor, action, target)`** is the only authorization rule: admin covers descendants, teacher covers their classes, viewer reads. Unauthorized returns 404. A student token never passes it.
- **`resolveSettings(chain)`** is one pure function, one zod schema, one screen component. It resolves per enrollment, org chain then class then person.
- **Sources** are plain functions from a file or API to normalized rows, and one reconciler writes them. A row with an ID whose name no longer matches, or a new row that matches someone typed in by hand, is held for an admin. Importing adds and updates; it never removes anyone.

Staff stay ordinary accounts, so there is no `kind:'staff'`: a person can be a teacher and a parent at once.

## Sign-in

### Students

- **Card:** a printable card with a QR holding a revocable per-student link, `/c#<token>`. The token is in the fragment, so it never reaches a server or proxy log, and it leaves the address bar and history before anything else reads the URL. Phones open it from the OS camera; `/join` scans it in the browser (`BarcodeDetector`, with lazy `jsqr` as fallback). Requires `Permissions-Policy: camera=(self)`. Only a hash is stored, so printing again makes new cards and the old ones stop working.
- **Class code:** code → tap your name → 3 of 16 pictures, which a student chooses and confirms the first time. Failure counters are per student and class, so a school behind one address isn't locked out: five wrong tries pause that student for 60 seconds, and many across a class pause the class for five minutes. A new code reopens a paused class; resetting a student's pictures clears that student.
- **Google and Microsoft:** an OIDC flow matching the roster email to an `sso` credential, reusing existing client IDs, so students never enter the parent user table.
- **Why cards are the default:** Google blocks under-18 Education users from third-party apps until an admin allows the app. Cards and codes work with no IT involvement. Turning on Google leads to a one-page IT handoff with our client ID.
- **Start class board:** big code and QR on the projector, with names lighting up as students arrive. This is the demo moment.
- **Device modes:** the `deviceMode` setting. Shared (session storage, signed out after 30 idle minutes, clears `amp.learner` and `amp.trial`) or personal (local storage, 90 days, revocable by the teacher). A student in two classes signs in as shared if either class says so.

### Staff: does Better Auth cover everything?

**Not everything.** It covers most small schools. These are the additions:

| Case | With today's sign-in | What we add |
|---|---|---|
| Any email address | Works (password, passkey) | The mailed invite link proves the address, so no second confirmation email; the email text stops saying "parent account". A copied link binds an account but proves nothing about a mailbox, because an admin can copy it: that person confirms their address the usual way |
| Google Workspace or Microsoft 365 | Works unless IT restricts third-party apps | IT handoff page with the admin-consent link; email fallback |
| Microsoft doesn't vouch for the email | `providerSignupRefused` correctly refuses to create the account | Clear message and email fallback. Needs a test on a real education tenant |
| Invite address differs from sign-in address | Would create a mismatch | Invite binds to whichever account accepts it |
| School mail filter eats the invite | Stuck | "Copy invite link" is always visible |
| Teacher leaves | Account stays, but access must end | Role end date, checked on every request |
| Clever, ClassLink, Okta, SAML | **Not covered** | Later: the same person resolver students use |

A new staff account isn't treated as a new parent: the guard sends them to `/school` rather than `/try`, and no follow-up enrollment runs.

## Other architecture

**Evidence (no frontier replay in request paths):**

- An `AFTER INSERT` trigger on `amp_attempts` (same pattern as `0008-skill-evidence.sql`) upserts `amp_skill_days`, using `weight>=1` from `0079` for independence.
- `/batches` stores `amp_level_days`; paper results also write one. Term start and end levels are read, not replayed.
- Active time is a heartbeat on student sessions only, reusing `EngagementClock`'s 60-second idle rule, written in one statement outside the learner lock with deltas clamped to elapsed time.
- Today's rules run over the rollup and `amp_skill_evidence` for the roster: stuck, shared gap, no practice against target, ready for more.
- Pending migrations share one transaction, so the trigger ships in a later PR than the base tables.

**Workbook stack:** client-driven, concurrency 2. The teacher's browser requests each student's PDF through a staff route reusing extracted helpers from `src/workbook/routes.ts`, with a fixed workbook number so retries don't create new ones. It retries 503s and merges with lazy `pdf-lib` in a Web Worker. No job table, no stored PDFs. The QR on the page opens a teacher marking route, a roster grid using the existing paper weights.

**Trust, built in:** students get no analytics or attribution, and staff get no ad collection or marketing mail. Setup includes accepting a finished data agreement (published at `/schools/trust`), covering FERPA school-official use and school-authorized COPPA consent. The privacy center shows the agreement, whole-school export, deletion and the activity log. Prices never appear in this public repo.

**Frontend:** `src/web/features/school/`, shaped like `features/workbooks/`. A new `SchoolFrame` (sidebar on wide screens, top bar and drawer on phones) resets the legacy global element rules. New kit in `src/web/ui/`: `DataGrid` (sticky header and first column, card fallback, virtualized for big rosters), link `Tabs`, `StatTile`, `Sheet`, `EmptyState`, `Avatar`, `Badge`, `SearchField`, `Stepper`, plus dense-table and heading tokens. Charts build on `LevelChart` and the frontier map, using the `dataviz` and `frontend-design` skills.

**Integrations tonight:** CSV and spreadsheet paste with column auto-mapping and a dry-run diff; OneRoster 1.2 CSV import; configurable gradebook CSV plus OneRoster results; Google and Microsoft sign-in. Clever, ClassLink and Google Classroom show a real "set this up with us" request, never a button that fails.

**Licensing:** operated by privileged agents, with no internal admin UI. `scripts/school-admin.ts` creates orgs, issues licenses and adjusts seats with JSON output, reading names from a private input file, and direct database access covers the rest. Adding seats or issuing a license seats the students waiting under that org, longest-waiting first; renewals replace seats on a license that has ended. A school's own license screen shows seats and dates, with "Request more seats" notifying the company mailbox. Self-serve setup starts with 30 seats for 30 days, a default that's one script call to change (`set-seats`, `extend-license`). One account can set up at most five schools on its own.
