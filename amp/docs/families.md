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

## Licenses

- **A family license** covers one child and the parent's own practice. Each additional child is an additional seat.
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
2. Adult practice for any adult, and the adult's place in their class.
3. Families as classes: buying for a child creates or joins the family class, the child gets join sign-in, and a parent can hand their own device to a child.
4. Converting existing families, and family licenses that include the parent.
5. Approval links for another family's child.
