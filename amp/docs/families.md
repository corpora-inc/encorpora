# Families, classes and adult learners

One model, from one child to a district. A family uses the same classes, sign-in and teacher screens as a school, at its own size. This is the plan; the [schools design](schools.md) covers the parts already built.

## Two kinds of sign-in

- **Adults** (parents, teachers, tutors, admins) have an account: email and password, a passkey, Google or Microsoft. One account can hold many places at once: a family, a school, a district, and the adult's own practice. The place switcher moves between them.
- **Children** join a class: a class code, their name and three pictures, or a printed card. They never use a parent's account or email. On a shared device, the session ends with the tab, and an idle device signs out.

## Every child learns in a class

- A class belongs to an org. The smallest org is a **family**; above it are schools, networks and districts (`amp_orgs.kind`), in the tree that already exists.
- **A homeschool parent is the teacher of the family's class.** They get the full teacher view: Today, the map, grades, workbooks and Start class. A class may mix grades: a class with no course band places each child at their own level. Two parents are two teachers of the same class.
- **Children from another family can join.** That child's own parent approves by a link before the child can practice. For anyone who isn't a school, the child's parent is the one who consents, so the teacher can't consent for them.
- **Places grow.** A family can add classes and staff and become a school; a school can join a district. People, classes and evidence keep their ids throughout.

## Adults learn too

- **Every teaching adult gets their own adult learner, free.** That covers a parent of a paid child and any teacher of a paid class.
- **An adult learner** is a learner owned by the adult's account, marked adult. It has no birth year: the adult chooses where to start, and always sees their levels.
- **In their class,** the adult appears as a separate member, apart from the students. The class map and standings can show them, so a child can overtake their parent or teacher. Grades, seats and rosters never count them.

### How adult practice works

- **The learner:** `amp_learners.adult`, one live per account, with no birth year and the adult's own time zone (migration `0093`). It is never among `me.learners` (the family's) or a school's roster; `me.adultPractice` names it.
- **Consent:** `learningConsentActive(client, account, development, learnerId)` passes for the account's own adult learner; every other learner keeps the account's rules. Routes about one learner ask about that learner.
- **Access:** one grant per adult learner, channel `pilot`, id `adult:<learner>`. Reading `/me` refreshes it to the latest end among licenses in force where the account teaches (no later than a dated role's last day) and grants of its children; with nothing qualifying it lapses now. An unchanged end writes nothing, and practice writes nothing new (`src/account/adult-access.ts`). It isn't the family's licence: learning-data retention and acquisition reports ignore it.
- **Starting:** `/me/start` asks where to begin; each choice is a starting level on the grade axis (`startingLevels` in `src/learning/starting-point.ts`), then practice is the normal loop.
- **Home:** `/me` is the student record a teacher reads, from the same rollups and parts (`readProgress`, `school/classes/ProgressRecord.tsx`), with time by day and skill. The adult's answers, level days and active time roll up like a student's; active time counts on practice, lessons and the map while their own learner is the one chosen.
- **Places:** "My practice" is a place in the switcher, and `/` returns to it. Practice, lessons, pathways and workbooks are the adult's place while their own learner is the one chosen.

### The teacher in their class

- **Who:** every teacher of the class (a teacher enrollment in force, while they hold a staff role along its path) with a live adult learner. That includes a parent who teaches a family class. Aides never appear. `classTeachers` in `src/schools/teacher-line.ts` is the one query.
- **The class map:** each is a line of their own, by name with "Teacher" under it, sorted in place with the students. Your own line opens `/me`; a colleague's opens nothing. The strand columns and the scale are the students': a teacher far past the class rests at the scale's end ("8+"). `MapResponse.teachers`, apart from `students`.
- **Standings:** on whatever board the class's setting opens, on its measure and term. A teacher's line never takes a rank and never moves one: students' ranks and the top-10 rule read students alone. A line whose value reaches the lowest listed value sits in the list in place, after any student it ties, with a mark instead of a number. Below it, or on a board that lists nobody, it shows after the student's own line. A teacher with nothing to show yet isn't on it. Off means off. `StandingsBoard.teachers`, apart from `top`.
- **Show me in my class:** one switch per class on the Student experience tab, for a teacher of that class who practices, on by default. Off takes their line off that class's map and board. It's stored beside the settings as the class's `teachersHidden` list, logged as `standings.teacher_shown`, and only the teacher changes their own (`POST .../classes/$class/experience/me`).
- **Never counted:** grades and their class median, seats, rosters, Today, time, report cards, exports and school overviews read student enrollments, so a teacher's practice never reaches them. `tests/teacher-in-class.integration.ts` compares each before and after the teachers practice.

### How a family is a class

- **The org:** `amp_orgs.kind='family'`, one per parent account, found through `amp_families` (account, org, class; migration `0095`). It's "Just my class" (`solo`), set up from the start, with the parent as its admin and teacher. Its days are America/New_York until the parent sets the calendar. The class is "<parent's given name>’s class", which they can rename; it has no course band, grades by year and follows the year in use, so its code keeps working when a year ends.
- **Ownership:** a family child's learner stays owned by the parent's account. The family only adds roster rows that point at it: a person with `learner_id` (name and grade from the learner, kept in step), a student role and an enrollment. Purchases, grants, consent, family settings, exports, retention and deletion carry over untouched. Deleting a child's learning lets go of their roster row, which scrubs their name as any deleted learner's.
- **Created with the first child:** creating a child (`POST /api/v1/learners`) or keeping a free assessment (`/trials/adopt`) makes the family, its class and the child's roster rows in the same transaction, under the account's learning lock and then the family's own lock. `ensureFamilyClass` in `src/family/family-class.ts` is the one function; every later child joins the same class.
- **The child's sign-in:** the class code, their name and three pictures, or a printed card, exactly as at school. A student session (`st_`) acts as the owner of its one learner (`resolveStudentSession`): `school:<person>` for a school student, the parent's account for a family's child. `learningAccount` binds the request to that learner: any learner id in the path, query or body that isn't theirs answers 404, a sibling's included, and the learner list holds only theirs. Parent-only routes refuse `st_` (401), and what a family decides (adding a learner, birth year, starting point, reset, marking paper) answers 403. A child's `/me` shows only their learner. The browser keys every student's sign-in by `school:<person>`.
- **Consent and access:** a family's child practices on their parent's verified consent, which `learningConsentActive` already reads for the parent's account; withdrawing it stops the child's practice at once. Access is the child's own grants, one license per child. A family has no school license or seats, so its screens show each child's access dates instead.
- **What a family's teacher can do:** `can` allows a family only teaching: the class, its sign-in and cards, grades, calendar, settings, workbooks and staff (a co-teacher). Licenses, seats, imports, adding or removing students, the school privacy center, overviews, year rollover, integrations and share links stay schools'. A family's privacy, export and deletion are its own (`/family`).
- **"Let Maya practice here":** on the parent's own device, Today lists each child with their access dates and this action, offered only when the child can practice. `POST /api/v1/family/learners/:learnerId/practice-here` (parent only) starts that child's student session in shared mode and goes straight to practice. The device remembers it was handed over, so signing out, or the 30-minute idle sign-out, returns to `/` and the parent's class.
- **Places:** `/me` names the class (`familyClass`). Once a child can practice, `/` opens it, and before then first-run routing guides the parent there. In the place switcher the family's entry is the class, beside "My practice"; the parent's own family never appears among their schools (`staffOf`, `/school`), while a co-teacher from another account finds it there. The class's rail adds **Family** (access, purchases, consent, privacy) and has no Students, License or school Privacy.

## An adult on their own

An adult can buy a license for themselves, for example an 18-year-old preparing for the SAT, or a parent brushing up. That's the adult learner above, with no class around it, and it needs no other case:

- The license covers the adult's own learner.
- Their home is their own progress: the same student record a teacher sees, pointed at themselves. That includes time by day and skill, the map of every strand, levels, grades over a term and workbooks.
- Adding a child later makes the place a family, and the adult becomes its teacher. Nothing is moved or re-entered.

## Licenses

- **A family license** covers one child and the parent's own practice. Each additional child is an additional seat at the additional-child price, and a family class's teacher may buy a seat for another family's child in that class ([Stripe](stripe.md#each-additional-child)). An adult on their own buys the same license for themselves.
- **A school license** covers its seats. Its teachers practice free.
- **Access** stays one rule: a learner practices with an active grant (`amp_grants`). A family seat writes a grant just as a school seat does.

## Consent

- **School student:** the school's accepted data agreement, found by walking up the org path (built).
- **Family student:** the verified consent of a parent of that child. For the teacher's own children that is the teacher. For another family's child it is that child's parent, recorded through the approval link.
- **Adult learner:** the adult's own account; no parental consent applies.

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
5. Approval links for another family's child.
