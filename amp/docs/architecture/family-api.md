# Family and teaching projections

Family reads identify a household independently of its teaching class. A child's
`amp_learners.account_id` determines their family membership. A second parent
reads the children owned by the holder of that particular relationship. Class
enrollment never adds a child to a Family projection.

The response schemas and client types are in
[`projection-contracts.ts`](../../src/family/projection-contracts.ts). Existing
learning, consent, billing and school mutation endpoints retain their authority.
All endpoints below require an adult account and return `Cache-Control: no-store`.
Student bearer tokens take precedence over any parent cookie and are rejected.

## Family places

`GET /api/v1/families?after=<family UUID>` has no body. Omit `after` for the first
page. It returns at most 50 places, ordered by UUID, and a nullable cursor:

```ts
{
  families: Array<{
    familyId: string; // UUID
    displayName: string | null;
    classId: string | null; // family’s own class, not a hosted child’s class
    orgId: string | null; // actual org for that class
    role: "holder" | "second-parent" | "co-teacher";
    teachingPlace: TeachingPlace | null;
    capabilities: { readFamily: boolean; readTeaching: boolean };
  }>;
  next: string | null; // pass as after; null ends pagination
}
type TeachingPlace = {
  classId: string;
  displayName: string;
  scope: "whole-class";
  path: string; // API path to the teaching projection
};
```

A holder or second parent belongs in the Family group of a place switcher.
A co-teacher belongs in Teaching. `teachingPlace` additionally identifies the
holder's or second parent's mixed tutoring class. Its presence, rather than
`readTeaching` alone, determines whether to show that separate place.

A family ID is an opaque, stable URL key. It need not equal the class's org ID.
Ownership transfer, family creation and second-parent acceptance persist that key.
When an eligible holder lacks an identity, discovery derives it without writing:
an existing family uses its org ID; otherwise `amp_family_identity(account)` supplies
a deterministic UUIDv8 from a namespaced SHA-256 digest. The owner can open that
URL immediately. Existing persisted IDs always win. Database insert hooks make
legacy identity and class writers preserve the same key, even during a rolling
upgrade. Authorization uses the actual org associated with the holder account.
Teaching elsewhere alone does not give an adult a new owned Family place.

Every `/api/v1/families` GET, including Teaching and individual progress/PDF, is
read-only. Discovery starts with indexed ownership, second-parent and staff
membership branches, unions the associated account keys, paginates their stable
family IDs, and then loads the page's details. It performs at most four database
queries and takes no account or row lock. Purchase previews use read-only consent
and verified-address checks; mutations retain their locks and recheck eligibility.

### Legacy Family and account GETs

`GET /api/v1/family` uses a read-only snapshot without an account lock. It creates
no identity, class, roster or grant. Adult eligibility and derived grant dates are
calculated from current child/school access; learning mutations persist the adult
grant. Refunded or revoked qualifying access cannot be extended by a stale grant.
`GET /api/v1/me/practice` and its `/report.pdf` variant use the same live eligibility
sources without refreshing grants. Family second-parent, approval-list and
approval-detail GETs are also read-only, including their consent checks.

Child creation, starter setup and the explicit
`POST /api/v1/family/learners/:learnerId/practice-here` action create or repair a
needed family class. An unrostered legacy child remains visible before that action.
`GET /api/v1/me` reports the persisted class, if any, without creating one.

Family maintenance runs on explicit writes:

| Maintenance | Write path |
| --- | --- |
| Expired family academic year | `ensureFamilyClass` advances the class to `yearSession` during child creation, starter setup, practice-here, rename and birth-year edits. POST class-code lookup and picture sign-in call the same helper under the account and family locks before validating the session. School years and archived classes are not reopened by sign-in. |
| Family class, parent staff roles, child roster/enrollment and conversion notice | The same helper creates missing rows during those writes; `family:convert` provides an explicit migration/repair command. Existing children keep their learner IDs, evidence and consent. |
| Roster names and birth-year-derived grades | The helper synchronizes owned children in their home family during those writes and class-code sign-in. Name changes also use migration 0098's trigger; birth-year changes call `syncFamilyGrade`, including hosted children in other family tenants. School grades are left to the school. Merely visiting a report does not advance a stored grade. |
| Adult grant creation, extension and expiry | Online `hasAccess` and the offline transaction both call `PgTransaction.refreshDerivedAccess`, which uses `refreshAdultAccess` → `accessGrantsFor` → `adultPracticeEnd`. Offline refresh precedes issue, quota checks, request reuse, preflight and reconciliation. An interval change invalidates an existing pack's binding; the client requests a new pack. Adult setup, access assignment and legacy trial adoption also refresh through the same derivation. |
| Stable family identity | Family creation, parent approval and second-parent acceptance ensure the identity. The migration runner backfills existing eligible accounts; database hooks cover legacy writers. Discovery derives a stable fallback without writing. |
| Creation audit events and default student-device settings | Family/class/roster creation writes its events and default personal-device setting in the creating transaction. Reads emit no creation events. |

The class validator used by OIDC GET routes stays read-only. The POST class-code
entry path performs family maintenance; no scheduled family-year job is required.
Consent/address/advertising reads use their nonlocking variants; their mutations
retain the existing authorization locks.

These legacy GET side effects are retained for compatibility:

- `GET /api/v1/me` adopts practiced, unexpired owned legacy trials through
  `absorbLiveTrial`. The retired trial screens cannot expose those records; removing
  adoption here without a coordinated sign-in/client change would hide saved work.
  Adoption uses the existing account transaction and can create the child's family
  class or refresh an adult grant. Accounts without live unadopted trials skip it.
- The same `/me` endpoint calls `followDemo`: it records a demo visitor's presence
  or moves them to the replacement nightly demo. Existing clients depend on this
  refresh to avoid opening a retired demo. Non-visitors skip it.
- `GET /api/v1/family/export` writes `export.started` and `export.completed` privacy
  audit events around its read-only export snapshot. These record the explicit
  download; removing them would remove the established export audit trail.

`GET /api/v1/account/deletion` performs no data writes, but retains the account
advisory lock while computing its deletion preview. It must not be described as
lock-free. The deletion mutation recomputes that plan under its own lock.

`displayName` uses an explicitly saved family name, then the holder's adult profile
family name followed by ` family`, otherwise null. A provider's full display name
does not establish a family name. The interface may render null as “Your family”.
The required org storage labels `Our family` and generated `…’s family` are not
public family names. Other legacy org names are treated as explicit names; a name
saved through the org settings writer is stored in `amp_family_spaces.display_name`
and wins even if it resembles a storage default. That nullable field is included in
the account export and erased with the family identity.

## Family projection

`GET /api/v1/families/:family` has no body and accepts a family UUID. Co-teachers
receive `403 family_parent_only`; unrelated accounts receive `404 family_not_found`.

```ts
{
  familyId: string;
  displayName: string | null;
  holderName: string | null;          // canonical adult display name, including explicit clearing
  role: "holder" | "second-parent";
  teachingPlace: TeachingPlace | null;
  capabilities: {
    readFamily: boolean;
    addChildren: boolean;
    manageConsent: boolean;
    manageBilling: boolean;
    inviteSecondParent: boolean;
    manageSecondParent: boolean;
    readTeaching: boolean;
  };
  children: Array<{
    id: string;                      // learner ID, never a roster person ID
    name: string;
    birthYear: number | null;
    gradeLevel: number | null;        // K = 0; birth year, roster grade or course
    access: {
      grants: Array<{
        channel: string; status: string; startsAt: string; endsAt: string;
      }>;
      hasAccess: boolean;
      canPractice: boolean;
      learningAllowed: boolean;
      freeAllowance: {
        problems: { total: 100; used: number; remaining: number };
        workbooks: {
          total: number; earned: number; made: number;
          available: number; nextAt: number | null;
        };
      };
    };
    week: { minutes: number; problems: number; lastPracticed: string | null };
    nextUp: {
      kind: "adaptive-practice" | "access" | "consent";
      learnerId: string;
      task: TodayTodo | null;
    };
    capabilities: {
      readProgress: boolean; readWorkbooks: boolean;
      createWorkbook: boolean; recordWorkbook: boolean;
      practiceHere: boolean; continuePurchase: boolean; purchase: boolean;
      rename: boolean; changeBirthYear: boolean; changePracticeSettings: boolean;
      manageConsent: boolean; delete: boolean;
      readGrades: boolean; editGrades: boolean; manageDevices: boolean;
    };
    classes: Array<{
      id: string; name: string; orgId: string; personId: string;
      hostedByFamily: boolean; canOpen: boolean;
    }>;
    paths: {
      progress: string;
      workbooks: string | null;
      practiceHere: string | null;
      continue: string | null;
    };
  }>;
  today: { date: string; tasks: TodayTodo[]; week: WeekFacts };
}
type WeekFacts = {
  from: string; minutes: number; problems: number; skills: number;
  objectives: number; working: number; students: number;
};
```

Dates in week facts are `YYYY-MM-DD`; grant dates are ISO timestamps. Each child's `grants` is a preview of at most
20 records, newest start date first; `hasAccess` independently checks all live
grants. Account export supplies complete grant history. The week
starts Monday. `lastPracticed` is the latest activity date, including activity
before the current week. `students` is the shared read model's count field; it
counts only the projection's children. Family tasks use **learner IDs** in
`students[].id`, `action.personId` and `misses[].personId`. Teaching tasks use
roster person IDs. The shared renderer must interpret IDs in its supplied scope.

`TodayTodo` is exactly `todayTodoResource` from
[`teacher-contracts.ts`](../../src/schools/teacher-contracts.ts):

```ts
type TodayTodo = {
  id: string;
  kind: "shared-gap" | "stuck" | "no-practice" | "ready" | "good-day" | "start";
  title: string;
  detail: string;
  students: Array<{ id: string; name: string }>;
  action:
    | { kind: "lesson"; templateId: string; skillId: string; label: string }
    | { kind: "skill"; skillId: string; label: string }
    | { kind: "student"; personId: string; label: string }
    | {
        kind: "tab";
        tab: "map" | "time" | "start" | "settings";
        label: string;
      };
  groupSheet?: { skillId: string; label: string };
  rule?: string;
  misses?: Array<{ personId: string; attempt: string; skillId: string }>;
};
```

Week facts and tasks are computed from the ownership-selected child set through
the same evidence and Today functions used by classes. They are not filtered
class totals. `nextUp.task` is the first relevant task; adaptive practice chooses
the actual next problem when practice starts, without issuing a problem on read.

`paths.progress` and `paths.workbooks` are GET API paths. `paths.practiceHere` is
a POST API path accepting `{}`. `paths.continue` is a browser destination.
A parent may practice with and continue access for their own child hosted
elsewhere; the host never receives that child's own-parent purchase action.
`canOpen: false` forbids presenting a link to the host class. Individual evidence
and workbook paths do not grant host-class access.

Capabilities describe the viewer's permitted action on this resource. Mutations
recheck permission and their submitted parameters. `purchase` additionally
requires configured Stripe billing, confirmed email, consent for the configured
billing policy, no active learner license, and no paid unassigned plan. Billing
and this projection share the consent and license predicates; `continuePurchase` permits the
holder to enter the existing setup/consent/purchase journey. Parent-entry naming
permits the holder to correct a child's name after consent withdrawal, without
resuming learning. A second parent cannot buy, rename, delete, change the birth
year or manage consent. The existing individual workbook API also excludes
second parents; this projection does not broaden it. Their class teaching tools
remain available under the Teaching scope. `readGrades`, `editGrades` and
`manageDevices` apply only through a child enrolled in this family's own class.
A second-parent invitation requires a local class, an empty second-parent slot
and no currently hosted children.

## Invitations and printed reports

Second-parent invitation lookup retains `role: "teacher"` and
`secondParent.className` for older clients. Its family presentation fields are
`secondParent.familyDisplayName: string | null` and
`secondParent.inviterName: string | null`, resolved from the holder's adult profile.

Family-kind term cards and individual reports use the family display name and
“decided by <parent name>”, falling back to “decided by the parent”. School reports
retain teacher wording. A term counts practice only within its term and enrollment
dates; Today counts the selected recent days. Design personas align their synthetic
enrollment dates to the first seeded practice day so historical practice is included.

## Individual progress

`GET /api/v1/families/:family/children/:learner/progress` has no body. It requires
the holder or this family's active second parent and verifies learner ownership.
It returns `{ id: string, name: string, ...ProgressRecord }`, where
`ProgressRecord` is exactly `progressRecordResource` in
[`teacher-contracts.ts`](../../src/schools/teacher-contracts.ts): levels and strand
estimates, a nullable reference, twelve weeks, gained objectives and recent work.
It contains no host-class grades, credentials, roster or account data.

```ts
type ProgressRecord = {
  level: { overall: Estimate; strands: Record<string, Estimate> } | null;
  reference: { from: number; to: number } | null;
  strands: Array<{ id: string; label: string }>;
  weeks: Array<{ week: string; minutes: number }>;
  objectives: Array<{
    skillId: string;
    title: string;
    strand: string;
    day: string;
  }>;
  work: Array<{
    id: string;
    day: string;
    at: string;
    prompt: string;
    answer: string | null;
    response: string | null;
    result: "independent" | "hint" | "missed" | "paper";
    review: boolean;
    skill: string;
    strand: string;
  }>;
};
type Estimate = { level: number; sd: number };
```

### Individual progress PDF

`GET /api/v1/families/:family/children/:learner/progress.pdf?format=Letter` (or `A4`)
uses the same individual progress reader and shared `progress-report.ts` composer.
It authorizes the holder or that family's active second parent against the child's
live ownership, including a child rostered only in another family's class. A
co-teacher cannot use this route. It grants no host-class or grade access and
includes no host roster. The PDF contains the child's progress and family name;
print rendering is per request. Missing rendering service returns `503 report_unavailable`.
The download path is `paths.progress + ".pdf"`.

## Individual time

`GET /api/v1/families/:family/children/:learner/time?period=week|weeks|term&from=YYYY-MM-DD`
returns one owned child's daily active time. Authorization is the same as individual
progress: the family's holder or active second parent, with live non-adult learner
ownership checked on every read. Teaching the host class does not grant this access.
Student sessions, co-teachers and unrelated families cannot read or export it.

```ts
type FamilyChildTime = {
  id: string;                 // learner ID
  name: string;
  group: string;              // display label only, no host class ID or link
  joined: string | null;      // first overlapping enrollment start in that group
  timezone: string;
  period: "week" | "weeks" | "term";
  range: { from: string; to: string }; // inclusive YYYY-MM-DD dates
  minutes: number;            // rounded total, as in class Time
  problems: number;
  days: Array<{ day: string; minutes: number; problems: number }>;
};
```

The reader reuses class Time's `periodRange` and `perDay` aggregation. The calendar
is the owning family's class calendar and timezone, or `America/New_York` when
that family has no class. `week` begins Monday; `weeks` starts three Mondays before
this week's Monday. Both end today in that timezone. `term` uses the current term,
or the last begun term, ending at the earlier of today and its end date. With no
begun term or no class calendar it uses the four-week range. The default is `weeks`;
`month` is accepted as the existing class API's alias.

`from`, when supplied, replaces only the inclusive start date without rounding it
to Monday. It must be a valid ISO date at or before the resolved end; invalid dates
return 400, and a start after the end returns `400 invalid_time_range`. Class Time,
its individual-student read and its CSV accept the same `from` and `weeks` alias.
All Time JSON and CSV readers enforce one shared maximum of **400 inclusive
calendar days**, including default term ranges. A longer resolved range returns
`400 time_range_too_long` before evidence queries or week expansion; it is never
truncated. Supply a later `from` to narrow a long term.
Pass the same start date when combining owned children with a Family Time range.
A host class can have a different calendar; compare its results over identical
resolved dates, within that child's enrollment.

`joined` is the earliest student enrollment start in the displayed group among
enrollments overlapping the inclusive report range, using the same overlap and
minimum-start rules as class Time. It is an ISO date, or null when there is no
current group or no overlapping enrollment. Class Time clips its roster start to
`max(joined, range.from)`; the child response preserves the actual enrollment date
so clients can hatch weeks before joining. Rejoining does not hide an earlier
start within the range. This is roster metadata only: it does not filter the
owned child's evidence or describe every gap between enrollments.

Days come from the stored evidence dates, with no rebucketing into UTC. Minutes
include every active-time surface counted by class Time: practice, lesson,
feedback, map, other, hint, video and example. Problem counts come from the same
skill-day rollups. Days without evidence are omitted and mean zero; daily minutes
retain class Time's one-decimal precision. Sum the daily values for exact-date
family totals, then round the combined total for display. Ownership reads include
learning outside a group's enrollment dates and work without an active enrollment.
They return no host roster, class summary, grades, credentials or other children.

`GET /api/v1/families/:family/children/:learner/time.csv` accepts the same query and
authorization. It uses the class CSV serializer: UTF-8 BOM, CRLF, formula-safe
cells and columns `SIS ID,Student,Date,Active minutes,Problems`, followed by `Group`.
`SIS ID` is blank because this ownership read does not disclose host identifiers.
The group label prefers an active enrollment in the family's own class, otherwise
the first active group by class ID; absent a group it uses the family display name
or `Your family`. This labels the current group, not historical attribution of each
activity day. The JSON uses the same label. Both routes are read-only and send
`Cache-Control: no-store`.

## Teaching projection

`GET /api/v1/families/:family/teaching` has no body. It requires the existing
`students.read` permission for the mapped family class. A family without a class
returns `404 teaching_place_not_found`.

```ts
{
  familyId: string;
  place: "teaching";
  scope: "whole-class";
  class: ClassSummary;
  students: TodayStudent[];
  today: { date: string; tasks: TodayTodo[]; week: WeekFacts };
  approvals: Array<{
    id: string; personId: string | null;
    status: "waiting" | "opened" | "expired" | "approved" | "withdrawn" | "paused" | "ended";
    expiresAt: string; approvedAt: string | null; endedAt: string | null;
  }>;
  coTeachers: Array<{
    id: string; name: string | null; role: "teacher" | "aide";
    status: "active" | "invited"; secondParent: boolean;
  }>;
  capabilities: {
    readClass: boolean; readStaff: boolean; readApprovals: boolean;
    manageApprovals: boolean; manageStaff: boolean; manageDevices: boolean;
    editGrades: boolean; createWorkbooks: boolean;
  };
}
```

`ClassSummary` and `TodayStudent` are exactly `classSummary` and
`todayStudentResource` in the shared teacher contracts.

```ts
type ClassSummary = {
  id: string;
  orgId: string;
  name: string;
  orgName: string;
  course: { label: string; level: number; from: number; to: number } | null;
};
type TodayStudent = {
  id: string;
  learnerId?: string;
  name: string;
  gradeLevel: number | null;
  level: Estimate | null;
  provisional: boolean;
  todayMinutes: number;
  todayProblems: number;
  weekMinutes: number;
  weekProblems: number;
  lastActive: string | null;
};
```

Here `students` includes the entire current roster, including owned, unapproved and parent-approved
children. Its facts and tasks have the same whole-class scope. No hosted child
is given an own-parent Continue action. Approval history includes ended records.
`paused` means consent is not currently effective without a recorded withdrawal.
A rostered child without an invitation has no approval record. Approval results
are bounded to 1,000 records.

Approval records require the holder's existing approval authority. Staff details
require existing `staff.read` authority. Unauthorized sections are empty arrays,
with the corresponding capability false. The API does not reveal parent email
addresses, invitation tokens or account IDs. Existing holder approval and staff
endpoints provide authorized management links. An existing second parent can
still have teaching access to the entire mixed class; presenting a separate
Family scope does not revoke that legacy authority.

## Adult profile

`PATCH /api/v1/me/profile` accepts exactly:

```json
{ "givenName": "Ada", "familyName": "Okafor" }
```

Each field is a trimmed string of 1–100 characters without control characters,
or `null`. Both fields are required; unknown fields are rejected. Its response is:

```json
{ "givenName": "Ada", "familyName": "Okafor", "displayName": "Ada Okafor" }
```

`GET /api/v1/me` includes these three nullable fields in `account`. A legacy auth
full name can supply `displayName`, but does not supply separately confirmed
given/family fields. An explicitly cleared profile has three null fields.
Updates synchronize the auth display name, linked adult roster identities and
the real adult learner, without renaming simulation profiles. The account export
includes the profile and family identity; account deletion removes both. A database trigger on the existing deletion
journal enforces this for both API versions, including after application rollback.

Other adult-name payloads expose:

- Approval lookup/detail: `teacherNames: (string | null)[]`. The legacy `teachers`
  string array contains only known names.
- Staff lists: `adultName: string | null`; legacy `name` is an empty string for an
  unknown name. No email local part is invented as a person's name.
- Invitation lookup: `inviterName: string | null`, resolved from its recorded sender.
- Second-parent reads: nullable `name`, and full known holder names in invitations.
- Report cards: `teacherNames: (string | null)[]` and the known-name `teachers` array.
- Today: nullable `teacherName`. Buyer pages and conflicts use nullable teacher names.
- Map and standings teacher lines: nullable `adultName`; legacy `name` (and map
  `first`) is empty when the name is missing. Client types allow omission of
  `adultName` for compatibility with older responses; this server always emits it.
- Class lists, org overview and year rollover expose `teacherNames` with nullable
  entries and legacy `teachers` containing only known names. Staffing counts use
  enrollment, including adults with missing names. The caller's org `personName`
  is nullable.
- Activity actors/person filters and adoption staff/roster previews use the same
  nullable resolver. Legacy string fields use an empty string for an unknown
  name, and legacy name arrays omit missing names; neither a role label nor a
  roster display override substitutes for the account profile.

The nullable fields are the display source for interfaces that ask an adult to
supply a missing name. School roster storage retains its required role label
when no given name is supplied; the public name resolver never presents that
label as the person's name.

## First course placement and deployment

Run `npm run db:migrate` before serving these endpoints. Migrations 0125–0130
install the identity/name schema, deterministic identity hooks and concurrent
class-to-family lookup index. Migration 0131 adds nullable funded-term scheduling
evidence to the financial request; apply it before running the funding workers.
The runner automatically performs the family identity
data migration after committing all schema transactions. No separate operator
backfill step is required. Successful completion is persisted as
`data:family-identities-v1` in `amp_migrations`; a failure prevents migration success
and leaves that receipt absent.

The data migration scans family account keys and learner IDs in keyset pages of
250 (the reusable backfill accepts 1–1,000), committing one account at a time.
Page reads and account work have a five-second statement timeout; account locks
have a two-second timeout. The runner bounds connection acquisition to five seconds,
serializes migrators with its session lock, and retries lock/deadlock failures up to
three attempts. Account transactions recheck ownership, existing identities and
the deletion journal. They never create classes or enrollments, rewrite published
IDs, or hold the schema migrations' DDL locks. A failed run preserves committed
accounts and safely revisits them on retry. The receipt skips completed work on
subsequent deployments. Ownership fallback remains available during migration and
for transfers from legacy writers after the scan, so rolling upgrades cannot hide
hosted-only parents. `scripts/backfill-family-identities.ts` is also an idempotent
repair command; discovery does not depend on its manual execution.

Never replace the contents of an applied migration in a persistent deployment. The runner checks file checksums. Ordinary migrations
commit separately. 0126 adds a nullable column without a table rewrite or a
backfill; existing answered learners derive the legacy prior lazily. 0127 builds
the history indexes with `CREATE INDEX CONCURRENTLY`, one statement at a time
outside a transaction, so evidence writes can continue during the builds.

The first-line `-- migrate:concurrent-indexes` directive selects this restricted
index-only mode. It accepts simple unquoted `amp_` table/index names, column lists
and optional integer comparisons; other SQL is rejected before any build starts.
The runner retains its session advisory lock, writes the checksum receipt only
after all indexes succeed, and retries lock timeouts/deadlocks. If a build fails
or the process stops, rerun the unchanged migration: valid completed indexes are
retained and invalid indexes are dropped concurrently before rebuilding. Do not
wrap this mode in an external transaction.

`amp_course_placement.enabled` defaults to false. Keep it false while any legacy
learning API or background learning writer can serve a request. Both API versions
then use the existing placement rules. An insert trigger freezes the implicit
level 2 when a legacy writer records evidence. The new reader also detects
pre-migration evidence and freezes that same prior without a bulk backfill.

After every learning reader and writer supports `starting_course_level`, enable
course selection by setting the singleton's `enabled` field to true. A child
without a birth year, explicit start, or established evidence then uses the lowest
known course band of their earliest current class (enrollment date, then class
ID). Grade 4 supplies level 4. The first read saves the chosen course or fallback
before issuing problems. A later class-band change cannot rebase those answers.
Birth years and intentional explicit starting choices take precedence; no birthday
or evidence is fabricated.

**Once course placement has been enabled, a full legacy rollback is unsafe.**
An unmodified legacy estimator ignores frozen course priors and can move a
learner's frontier even when the flag is false. For example, a saved Grade 4
course start would be read as the legacy level-2 fallback.

The safe rollback is to set `amp_course_placement.enabled` to false and deploy an
image that retains the compatible `starting_course_level` reader and writer.
Keep the database additions, attempt trigger and saved starts intact. Disabling
the flag stops new course selection; it does not discard or reinterpret frozen
starts. Prepare that compatible rollback image before enabling course placement.
A full legacy rollback is safe only before course selection has been enabled.
This is a two-phase deployment requirement, not a per-instance feature flag.

Family reads select at most 1,000 live owned children (larger legacy households
receive `409 family_child_limit`), scope authority reads to displayed places, and
batch account consent. Last activity and level use indexed latest-row probes;
Today facts retain their ownership-selected, date-bounded computation. Teaching
approval history is capped at 1,000 rows, with consent fetched in one batch for
active approvals only.


## Adult access and grant reader inventory

`account/adult-access.ts:accessGrantsFor` resolves current grants using the
reader's transaction client. It reads direct grants, removes stored `adult:`
projections, and derives the account's free adult access from current qualifying
child grants, second-parent relationships, school licenses and teacher pilots.
Deleted adults and simulation profiles do not receive derived access. The result
includes PostgreSQL's transaction clock, used by `grantInForce` and
`grantReserved`; the latter also reserves future direct paid terms.

A stored adult grant is an offline binding, not entitlement authority. Its
absence, expiry, old end date or active status cannot override live sources.
`refreshAdultAccess` materializes the resolver's result under the account lock;
unchanged access leaves the offline revision unchanged. Revocation or an interval
change invalidates the existing pack. Reads never materialize a missing grant.
Projected adult dates describe current coverage, not historical paid access.

| Reader | Resolution |
| --- | --- |
| `family/repository.ts` summary (`/family`, account `/me`) | `accessGrantsFor` on the read-only snapshot; profiles use `profilesCovered`. |
| `account/adult.ts` own practice and PDF | `accessGrantsFor` on the family read-only snapshot. |
| `account/practice-profiles.ts` | Own adult grants use `accessGrantsFor`; an account without an adult learner uses its shared `adultPracticeEnd` source calculation. Profiles acquire no grants. |
| `server/repository.ts:hasAccess` | Shared refresh and `accessGrantsFor`, followed by school-grant validity and pilot checks. Online practice, books, individual/classroom workbooks and workbook allowances inherit this path. |
| `offline/repository.ts` | Transaction refresh precedes all three stored queries: pack binding/preflight/reconciliation, quota and idempotent reuse, and grant selection/issuance. These queries need the physical row and exact signed interval/revision. |
| `billing/stripe/purchase.ts` | Status uses `accessGrantsFor` in its billing transaction; no write is needed for missing adult access. |
| `billing/stripe/repository.ts` | Batched checkout blockers, owned eligibility and reservation use the resolver on the caller's client. |
| `billing/stripe/service.ts` | Final checkout resolves access again after provider/catalog preparation, in the final account transaction. |
| `billing/stripe/enrollment.ts` | Paid enrollment assignment resolves access before financial reconciliation and assignment. |
| `access-grants/repository.ts` | Explicit and automatic learner-gift activation resolve access inside the activation transaction. Family-gift writes refresh the adult through the shared resolver. |
| `funding-purchase/provision.ts` | `fundedTermStart` resolves once before following contiguous terms. ClassWallet pay-by and staging call it on their own client. Scheduling saves the validated activation/start pair on the pending funding request (or pending learner quotes when called without a request ID). Provisioning accepts that pair or the exact saved provider payload after preceding coverage expires or is revoked, and independently resolves current overlap. |
| `family/approvals.ts` | The active-grant helper uses the resolver. Unnamed roster previews read child grants only. |
| `family/repository.ts` account export | Each learner page resolves grants on the read-only export snapshot, preserving direct grant history and projecting current adult coverage. |
| `analytics/insights.ts` | Free-practice conversion coverage uses the resolver in a read-only repeatable-read transaction. |
| `scripts/preview-billing.mjs` | Development billing status uses the resolver in a read-only snapshot. |

The physical ledger is `amp_grants`; there is no `amp_access_grants` table.
Remaining direct reads have narrower meanings:

| Direct reader | Why an adult projection cannot determine current access |
| --- | --- |
| `account/adult-access.ts` | The central resolver and its live child-source calculation own these reads. |
| `billing/stripe/repository.ts:priceTier` | Reads only Stripe grants for other non-adult children. Adult projections use the pilot channel. |
| `family/projection.ts` | Both coverage and bounded history are scoped to selected `NOT adult` children. |
| `family/repository.ts:practiceHere` | Explicitly selects a non-adult child. |
| `family/approvals.ts` unnamed preview | Selects student learners owned by `school:<person>`; account-owned adults cannot match. |
| `schools/classroom-workbooks.ts`, `schools/pilot-access.ts`, `schools/pilots.ts` | Select student enrollment learners. Teachers' own adult learners are separate from student enrollments. |
| `schools/student-me.ts` | The authenticated student principal resolves a roster learner. Adult own-practice reads use the resolver above. |
| `schools/operations.ts` | Connection retention reads `amp_people.learner_id` roster records. A staff person's separate account-owned adult learner is not linked there. |
| `commerce/postgres.ts`, `analytics/funded-cohort.ts` | Read exact `commerce:` grant IDs for financial binding and reporting. |
| `acquisition/evidence.ts` | Explicitly excludes `adult:%` from commercial-interest evidence. |
| `privacy/retention.ts` | Explicitly excludes adult grants from paid retention; other reads address exact commerce IDs, historical orphan existence or expired-row purge. |
| `family/repository.ts` deletion | Financial preservation excludes the pilot channel. `account/delete-account.ts` enumerates/deletes learner records and revokes exact seat grants; it does not authorize from adult access. School deletion, transfer, roster and rollover writers likewise revoke exact seat grants. |
| `scripts/verify-clever-scale.ts`, `scripts/verify-journeys-ui.ts` | Synthetic ledger-count/child-access benchmarks and child purchase assertions, not product entitlement readers. Other fixture scripts only insert or update synthetic grants. |
| `migrations/0006-commerce-orders.sql` | Historical commerce projection parity, restricted to `commerce:` identities. Other grant migrations define schema, indexes and offline revisions. |

`tests/adult-grant-readers.test.ts` scans TypeScript expressions and PostgreSQL
lexical tokens across source, scripts and migrations. It follows literal
concatenations, templates and local aliases; recognizes qualified/quoted
relations, comments, `ONLY`, `TABLE`, ORM calls and SQL function/view bodies;
and flags unresolved query calls, dynamic relations and SQL `EXECUTE` for review.
Standalone ledger-name fragments are also reviewed, so a helper cannot hide a
relation behind string assembly. This source guard does not prove the behavior
of arbitrary runtime-generated code.

`tests/fixtures/grant-readers.json` pins each reviewed expression by path and
whitespace-preserving hash, with a concrete reason. Query counts detect duplicate uses.
Exceptions include restricted child/history readers, grant writers and dynamic
helpers whose relation choices have been inspected. New or changed expressions
require review even within an approved file. The bypass fixtures exercise the
complete inventory comparison, including SQL functions and views. Offline
refresh ordering and the database consumer matrix guard the resolver boundary.
