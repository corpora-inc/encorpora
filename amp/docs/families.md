# Families, classes and adult learners

One model, from one child to a district. A family uses the same classes, sign-in and teacher screens as a school, at its own size. This is the plan; the [schools design](schools.md) covers the parts already built.

## Two kinds of sign-in

- **Adults** (parents, teachers, tutors, admins) have an account: email and password, a passkey, Google or Microsoft. One account can hold many places at once: a family, a school, a district, and the adult's own practice. The place switcher moves between them.
- **Children** join a class: a class code, their name (or "Child 2") and three private sign-in pictures, or a printed card. They never use a parent's account or email. On a shared device, the session ends with the tab, and an idle device signs out.

## Every child learns in a class

- A class belongs to an org. The smallest org is a **family**; above it are schools, networks and districts (`amp_orgs.kind`), in the tree that already exists.
- **A homeschool parent is the teacher of the family's class.** They get the full teacher view: Today, the map, grades, workbooks and Start class. A class may mix grades: a class with no course band places each child at their own level. Two parents are two teachers of the same class.
- **Children from another family can join.** A tutor's student practices with the tutor's nickname or initials for them (or "Student 3") and a birth year. Their own parent approves by a link before the student is named. For anyone who isn't a school, the child's parent is the one who consents, so the teacher can't consent for them.
- **Places grow.** A family can add classes and staff and become a school; a school can join a district. People, classes and evidence keep their ids throughout.

## Adults learn too

- **Every adult can start their own learner with a free allowance.** A parent of a paid child (the account holder or the family's second parent) or a teacher at a licensed school also receives access for their own practice.
- **An adult learner** is a learner owned by the adult's account, marked adult. It has no birth year: the adult chooses where to start, and always sees their levels.
- **In their class,** the adult appears as a separate member, apart from the students. Standings can show them, so a child can overtake their parent or teacher; the class map shows the students only. Grades, seats and rosters never count them.

### How adult practice works

- **The learner:** `amp_learners.adult`, one live per account, with no birth year and the adult's own time zone (migration `0093`). It is never among `me.learners` (the family's) or a school's roster; `me.adultPractice` names it.
- **Consent:** `learningConsentActive(client, account, development, learnerId)` passes for the account's own adult learner; every other learner keeps the account's rules. Routes about one learner ask about that learner.
- **Access:** one grant per adult learner, channel `pilot`, id `adult:<learner>`. Reading `/me` refreshes it to the latest end among licenses in force where the account teaches (no later than a dated role's last day), grants of its children, and grants of the children of a family it is the second parent of; with nothing qualifying it lapses now. Learning requests also refresh this derived grant, so a revoked qualifying license cannot leave stale access. An unchanged end writes nothing (`src/account/adult-access.ts`). It isn't the family's licence: learning-data retention and acquisition reports ignore it.
- **Starting:** `/me/start` asks where to begin; each choice is a starting level on the grade axis (`startingLevels` in `src/learning/starting-point.ts`), then practice is the normal loop.
- **Home:** `/me` is the student record a teacher reads, from the same rollups and parts (`readProgress`, `school/classes/ProgressRecord.tsx`), with time by day and skill. The adult's answers, level days and active time roll up like a student's; active time counts on practice, lessons and the map while their own learner is the one chosen.
- **Places:** "My practice" is a place in the switcher, and `/` returns to it. Practice, lessons, pathways and workbooks are the adult's place while their own learner is the one chosen.

### Practicing as someone else (practice profiles)

Any adult who practices can practice as someone else: a parent trying their child's level, a tutor working from a parent's description, a teacher trying a student's level or how AMP would serve a group, a solo adult showing a niece. Nobody's record changes, the adult's own included.

- **Grade and pace, one tap:** "Try a level…" (`/me/profiles/new?grade=4&pace=behind`) offers grades K to 12, each behind, on level or ahead: 39 starting points. On level is the grade's level on the grade axis (`gradeNumber`: K = 0, Algebra 1 = 9, Precalculus = 12); behind and ahead are one grade lower or higher in every strand, within K and 12 (`src/learning/practice-profiles.ts`).
- **Then adjust:** the grade and pace only fill in one level per strand. Any strand moves up or down (Fractions behind, Measurement on level) before practice, or later from the profile's own screen (`/me/profiles/$id`, "Adjust levels" in the drawer), which also renames and deletes it. On a phone the levels open in a sheet; with room they sit beside the choices.
- **Saved under a name:** the adult names it ("Maya’s tutoring", or the suggested "4th grade · behind"). A saved profile opens straight into practice and adapts from the first answer, like any learner.
- **Copy a student:** a student's record (`/school/$org/students/$student`) offers "Try problems as this student" to anyone who can read it: a parent in their family's class, a second parent, a teacher, tutor or admin. It copies the student's levels now, once, rounded to whole levels (`POST /api/v1/school/students/:student/practice-profile`, `students.read`). The copy holds levels and the adult's label, never the student's name; its default label is "Student levels · Nov 10".
- **Where:** the place switcher lists the saved profiles and "Try a level…" under "My practice"; `/me` has one quiet link. While practicing as a profile, the bar names it (from 960 px) and its one action is "Back to my own practice" ("My practice" on a phone), or "Back home" for an adult with no learner of their own. The drawer says "Practicing as" with "Adjust levels". The demo class keeps its own "Practice as" for its made-up students.

#### How a profile is stored

- **The learner:** `amp_learners.simulation` (migration `0108`), on a learner owned by the adult's account and also marked `adult`, so it has no birth year, needs no parental consent and is never one of the `NOT adult` child queries. The one-adult rule counts only the real adult learner. Its name is the label; it holds nothing else about anyone.
- **Levels:** its practice settings' `strandStarts`, one per strand at revision 0, the seeding "Easier" already uses; its overall start is the nearest starting band. Moving a strand writes a new start at a new revision for that strand alone, so the others keep what practice has learned. Starting again (Reset) keeps its levels.
- **Access follows the owner:** a profile has no grant. It practices while the account has paid or licensed access of any kind, read live from its sources on every request (`profilesCovered`, `src/account/practice-profiles.ts`): a plan or gift on the adult's own learner, a child's grant, a licensed school where the adult teaches, or a family it is the second parent of. The derived `adult:` grant never counts, so a refunded plan or revoked license stops covering at once. Otherwise each profile has the per-learner free allowance, with the same pause. "Continue with AMP" there continues the family's plan for its first child without access, which covers that child, the adult and every profile; only an account with no children buys the adult's own practice, whose learner starts when they check out, not when the screen opens.
- **Left out of every real learner's place:** `me.learners`, the Family screens, `GET /api/v1/learners`, rosters, class maps and standings (the teacher line is the real adult learner), grades, Today, Time, school exports, seats and checkout (Stripe, gifts and funded requests refuse it), consent and naming, the adult learner slot, the insights report and the parent follow-up (profiles alone are no place). Profiles do count toward the one sanity limit, 1000 live learners per account, and toward nothing else. `/me` lists profiles apart, as `practiceProfiles`; `me.family.learners` carries each as `adult` and `simulation` so practice reads its access the usual way. Account export and deletion include profiles, as the adult's own data. Deleting a profile deletes it and what it practiced.
- Tests: `tests/practice-profiles.integration.ts`, `scripts/verify-practice-profiles-ui.ts`.

### The teacher in their class

- **Who:** every teacher of the class (a teacher enrollment in force, while they hold a staff role along its path) with a live adult learner. That includes a parent who teaches a family class. Aides never appear. `classTeachers` in `src/schools/teacher-line.ts` is the one query.
- **The class map:** each is a line of their own, by name with "Teacher" under it, sorted in place with the students. Your own line opens `/me`; a colleague's opens nothing. The strand columns and the scale are the students': a teacher far past the class rests at the scale's end ("8+"). `MapResponse.teachers`, apart from `students`.
- **Standings:** on whatever board the class's setting opens, on its measure and term. A teacher's line never takes a rank and never moves one: students' ranks and the top-10 rule read students alone. A line whose value reaches the lowest listed value sits in the list in place, after any student it ties, with a mark instead of a number. Below it, or on a board that lists nobody, it shows after the student's own line. A teacher with nothing to show yet isn't on it. Off means off. `StandingsBoard.teachers`, apart from `top`.
- **Show me in my class:** one switch per class on the Student experience tab, for a teacher of that class who practices, on by default. Off takes their line off that class's map and board. It's stored beside the settings as the class's `teachersHidden` list, logged as `standings.teacher_shown`, and only the teacher changes their own (`POST .../classes/$class/experience/me`).
- **Never counted:** grades and their class median, seats, rosters, Today, time, report cards, exports and school overviews read student enrollments, so a teacher's practice never reaches them. `tests/teacher-in-class.integration.ts` compares each before and after the teachers practice.

### How a family is a class

- **The org:** `amp_orgs.kind='family'`, one per parent account, found through `amp_families` (account, org, class; migration `0095`). It's "Just my class" (`solo`), set up from the start, with the parent as its admin and teacher. Its days are America/New_York until the parent sets the calendar. The class is "<parent's given name>’s class", which they can rename; it has no course band, grades by year and follows the year in use, so its code keeps working when a year ends.
- **Ownership:** a family child's learner stays owned by the parent's account. The family only adds roster rows that point at it: a person with `learner_id` (name and grade from the learner, kept in step), a student role and an enrollment. Purchases, grants, consent, family settings, exports, retention and deletion carry over untouched. Deleting a child's learning lets go of their roster row, which scrubs their name as any deleted learner's.
- **Created with the first child:** creating a child (`POST /api/v1/learners`, or the starter's parent answer) makes the family, its class and the child's roster rows in the same transaction, under the account's learning lock and then the family's own lock. `ensureFamilyClass` in `src/family/family-class.ts` is the one function; every later child joins the same class.
- **The child's sign-in:** the class code, their name and three pictures, or a printed card, exactly as at school. A student session (`st_`) acts as the owner of its one learner (`resolveStudentSession`): `school:<person>` for a school student, the parent's account for a family's child. `learningAccount` binds the request to that learner: any learner id in the path, query or body that isn't theirs answers 404, a sibling's included, and the learner list holds only theirs. Parent-only routes refuse `st_` (401), and what a family decides (adding a learner, birth year, starting point, reset, marking paper) answers 403. A child's `/me` shows only their learner. The browser keys every student's sign-in by `school:<person>`.
- **Consent and access:** a parent names their own children, or leaves them "Child 2", with no consent step ([children's names](parent-consent.md#childrens-names)); a child learns on the restricted basis until consent is verified. Withdrawing consent stops collection on either basis. Each child practices while covered by an active grant or their own free allowance. A family has no school license or seats; its screens show each child's access or remaining free problems.
- **Co-teacher:** the family's own parent chooses **Invite a co-teacher** on Today (`CoTeachers.tsx`): the staff invitation with the teacher role on the family class, with **Copy link** always on the pending row. A co-teacher sees the class and hands a device to a child, but has no family page, sends no approval links and buys nothing (`tests/family-approval.integration.ts`).
- **Second parent:** a paid family covers two adults, the account holder and one parent they invite, even with one paid child. **Add a second parent** sits on Today and in Account → Family (`features/second-parent/SecondParent.tsx`): an email, then Send. It is the staff invitation with the teacher role on the family class (`/school/invite#token`, mailed through the account mail path), and `amp_families.second_parent` marks which teacher she is (migration `0104`, one column, so never two; inviting, accepting and removing lock the family's row first). The pending row reads "Waiting for f…@…" with **Copy link**, **Send again** and **Remove**; once she accepts, only Remove. She accepts only as the invited address, confirmed by its provider, its confirmation link or the mailed link's proof (`invite_wrong_account`, `invite_email_unconfirmed`); another account sees which address the invitation is for and **Use another account**. She gets the class as a co-teacher does, "Let … practice here", the family in her switcher, the children's Overview, Pathways and Inventory read-only (`me.secondParentOf`; `GET` progress and frontier act as the holder, anything else about a child answers 403), and her own adult learner, free while any child has access. Buying, consent and its withdrawal, naming, deleting and inviting or removing her stay the holder's: the server answers `family_holder_only` (403) and the screens don't offer them. Accepting leaves her account a parent's: no staff classification, and her mail never calls it a school's. Send again takes the family's row before writing the link, so it never renews one for someone who just joined. Removing her ends her role, family access, free practice and the "Let … practice here" sessions she started (`amp_student_sessions.started_by`) on the next request, never her account or her learner (`src/family/second-parent.ts`, `tests/second-parent.integration.ts`, `scripts/verify-second-parent-ui.ts`).
- **What a family's teacher can do:** `can` allows a family only teaching: the class, its sign-in and cards, grades, calendar, settings, workbooks and staff (a co-teacher). Licenses, seats, imports, adding or removing students, the school privacy center, overviews, year rollover, integrations and share links stay schools'. A family's privacy, export and deletion are its own (`/family`).
- **"Let Maya practice here":** on the parent's own device, Today lists each child with their access dates and this action, offered only when the child can practice. `POST /api/v1/family/learners/:learnerId/practice-here` (parent only) starts that child's student session in shared mode and goes straight to practice. The device remembers it was handed over, so signing out, or the 30-minute idle sign-out, returns to `/` and the parent's class.
- **Places:** `/me` names the class (`familyClass`). Once a child can practice, `/` opens it, and before then first-run routing guides the parent there. In the place switcher the family's entry is the class, beside "My practice"; the parent's own family never appears among their schools (`staffOf`, `/school`), while a co-teacher from another account finds it there. The class's rail adds **Family** (access, purchases, consent, privacy) and has no Students, License or school Privacy.

### A child from another family

- **The teacher:** on their family class's Today, the family's own parent chooses **Add a child from another family** and gives their parent’s email. The link goes through the account mail path, without the child's name; **Copy link** stays on the row while it waits, with **Send again**. The row says "Waiting for their parent". An approval can also name an existing student of the class: the API takes their `personId` with the parent’s email, and the parent names them when approving. The learner, roster identity, sign-in, answers and allowance use survive the transfer to the parent. `amp_family_approvals` (migration `0097`), `src/family/approvals.ts`.
- **The link:** `/family/approve#<token>`, like a staff invitation: the token is derived, and the mailed copy adds a proof that confirms the parent's address, at sign-up or on opening. The parent signs in or creates an account and continues, which makes the link that account's: single use, so another account is refused (`approval_used`), as is an expired one (`approval_expired`). A teacher of the class can't open it (`teacher_cannot_approve`): the child's own parent consents.
- **The parent's page:** `/family/approvals/<id>` says what the class is, who teaches it, what the teacher sees and what stays the parent's. Consent comes the usual way: without it, **Buy a license for Ana** opens the purchase, whose verified payment records consent; first-run then returns here (`me.familyApproval`) instead of asking for a new child. With consent, **Approve** makes the child a learner of the parent's account, a student of the teacher's class with picture sign-in, and assigns a license bought on the way. The teacher's typed name and address are then erased.
- **Access:** the child's own grants or unused free allowance, as for any family child. The parent buys from their page; the teacher's **Add access** sends them the link to it, and becomes the extra-child checkout when that lands. The parent practices free once the child has paid access (step 2).
- **What each side can do:** the teacher sees the child's work in the class (Today, the map, grades and workbooks) through the roster row, and nothing of the other account: not its email, other children, consent or billing. **Remove** only ends the child's place in the class: roles, enrollment, sign-in and cards end, and the roster row lets go of the learner; learning, access and consent stay the parent's. The parent sees progress, and withdraws consent or deletes the child in Family: withdrawal pauses the child in the class at once ("Paused"), and deletion takes them out of it.
- **Their own family:** a child in another family's class stays there. Approving doesn't give the parent an empty class of their own; adding a child of their own later does, and "Let … practice here" works for both.
- **Retention:** links nobody approved are deleted 30 days after they expire or are withdrawn (`familyApprovalDays`). `tests/family-approval.integration.ts`, `scripts/verify-family-approval-ui.ts`.

## An adult on their own

An adult can buy a license for themselves, for example an 18-year-old preparing for the SAT, or a parent brushing up. That's the adult learner above, with no class around it, and it needs no other case:

- The license covers the adult's own learner.
- Their home is their own progress: the same student record a teacher sees, pointed at themselves. That includes time by day and skill, the map of every strand, levels, grades over a term and workbooks.
- Adding a child later makes the place a family, and the adult becomes its teacher. Nothing is moved or re-entered.

## Licenses

- **A family license** covers one child and the practice of both parents: the account holder and their second parent. Each additional child is an additional seat at the additional-child price, and a family class's teacher may buy a seat for another family's child in that class ([Stripe](stripe.md#each-additional-child)). An adult on their own buys the same license for themselves.
- **A school license** covers its seats. Its teachers practice free.
- **Access:** after ownership and learning permission are checked, `canPractice = hasAccess || freeRemaining > 0`. A grant covers unlimited online practice and personalized workbooks. A free allowance is not a grant or evidence of a purchase.

## Free allowance

Every learner has 100 online answers or skips and five personalized workbooks. All five workbooks are available immediately. Recording paper results does not spend online problems or another workbook. Existing workbooks remain available for reading and marking after the allowance ends. Paid access preserves the unused balance; expiration and revocation do not reset it. Ownership and consent checks apply throughout.

## Consent

A child before verified consent has the name their parent entered (or "Child 2") and a birth year, with no contact details or free-text reports. A tutor's student has a nickname or initials until their own parent names them. Ending consent stops collection on either basis. See [parent consent](parent-consent.md) for the operational boundary and retention.

- **School student:** the school's accepted data agreement, found by walking up the org path (built).
- **Family student:** the verified consent of a parent of that child. For the teacher's own children that is the teacher. For another family's child it is that child's parent, recorded through the approval link.
- **Adult learner:** the adult's own account; no parental consent applies.

## Deleting an account

Account → Sign-in → "Delete my account" (`/family/security/delete`) lists what goes, then asks the person to type "delete". `POST /api/v1/account/delete` and the operator's `scripts/delete-account.ts --email … --dry-run|--commit` share one function, `src/account/delete-account.ts`, which runs in one transaction:

- **Places this person alone runs** go whole through the operator's tree removal: their family class, a school or class with no other admin, their own demos.
- **Shared places stay.** The person's staff roles end as an admin's "Remove" would end them, and their row there becomes a nameless tombstone, so the school's grades and history still add up.
- **A family's second parent** keeps her own account and practice when the account holder deletes: the children, consent and billing were the holder's, so the family goes and her place in it with it. When she deletes her own account, she only leaves the family, and it can invite another second parent.
- **Learners** go through the learning-data deletion, with every answer, help event, workbook and rollup.
- **What stays:** payment records for the financial retention period under the account's opaque id (a learner they name becomes a "Deleted learner" reference), completed consent evidence until its own purge date, and one row in `amp_account_deletions`: the account id, when, and counts per table.
- **A renewing card plan** is cancelled in billing first. The screen offers "Manage plan" instead of the delete button until the plan no longer renews; a paid school license with no other admin asks for another admin first.

Every table has a stated handling in `ACCOUNT_TABLES`; `tests/delete-account.integration.ts` checks that list against the schema and that nothing else mentions the deleted ids. The same address signs up afterwards as a new person.

## Existing families

Every family from before is converted automatically, one transaction per family, adding only roster rows:

- **On the parent's next visit:** their `/me` runs `ensureFamilyClass` inside the family summary's transaction, under the account's exclusive lock, before anything else reads.
- **The rest:** `npm run family:convert -- [--dry-run] [--batch 200]` with the deployment's `AMP_DATABASE_URL` converts every family still waiting, in batches, and prints JSON counts (`accounts`, `familiesCreated`, `childrenEnrolled`, `failed`). Running it again changes nothing.
- The parent is the admin and teacher of the new class, and each child a student with picture sign-in. Evidence, purchases, grants and consent stay byte for byte as they were (`tests/family-class.integration.ts`).
- An account whose only learners are adults isn't converted.
- **First visit after:** one dismissible line on the class says the children now sign in with the class code and pictures, beside "Let … practice here" (`amp_families.converted_at`, `notice_dismissed_at`). No modal.

A child who signed in with an account of their own stays as they are; moving them into a parent's class is an operator procedure, which keeps their progress.

## Build order

1. An admin takes a class and teaches it. **Done** in this change.
2. Adult practice for any adult, and the adult's place in their class map and standings: **done**.
3. Families as classes: buying for a child creates or joins the family class, the child gets join sign-in, and a parent can hand their own device to a child: **done**.
4. Converting existing families: **done**. The parent's own practice is free since step 2; each additional child has its own price ([Stripe](stripe.md#each-additional-child)), sold once an environment's settings name it.
5. Approval links for another family's child: **done**. The teacher's "Add access" sends the link to the child's parent, who buys or approves; a teacher-paid seat needs that parent's verified consent first.
