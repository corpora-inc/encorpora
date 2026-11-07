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

## An adult on their own

An adult can buy a license for themselves, for example an 18-year-old preparing for the SAT, or a parent brushing up. That's the adult learner above, with no class around it, and it needs no other case:

- The license covers the adult's own learner.
- Their home is their own progress: the same student record a teacher sees, pointed at themselves. That includes time by day and skill, the map of every strand, levels, grades over a term and workbooks.
- Adding a child later makes the place a family, and the adult becomes its teacher. Nothing is moved or re-entered.

## Licenses

- **A family license** covers one child and the parent's own practice. Each additional child is an additional seat. An adult on their own buys the same license for themselves.
- **A school license** covers its seats. Its teachers practice free.
- **Access** stays one rule: a learner practices with an active grant (`amp_grants`). A family seat writes a grant just as a school seat does.

## Consent

- **School student:** the school's accepted data agreement, found by walking up the org path (built).
- **Family student:** the verified consent of a parent of that child. For the teacher's own children that is the teacher. For another family's child it is that child's parent, recorded through the approval link.
- **Adult learner:** the adult's own account; no parental consent applies.

## Existing families

On release, every existing family is converted in one transaction per family:

- A family org and class are created, and the parent becomes their admin and teacher.
- Each child becomes a student of that class with picture sign-in.
- Evidence, purchases, grants and consent carry over unchanged.

A child who signed in with an account of their own is moved by an operator procedure, which keeps their progress.

## Build order

1. An admin takes a class and teaches it. **Done** in this change.
2. Adult practice for any adult, and the adult's place in their class map and standings: **done**.
3. Families as classes: buying for a child creates or joins the family class, the child gets join sign-in, and a parent can hand their own device to a child.
4. Converting existing families, and family licenses that include the parent.
5. Approval links for another family's child.
