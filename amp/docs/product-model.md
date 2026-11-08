# AMP product model: people, places, sign-in and screens

The current shape of AMP as of 2026-11-08, for anyone changing its screens. It sums up the decisions behind the people, places and licenses, what each person sees, and what isn't built yet. For the details, see the [schools design](schools.md), [families, classes and adult learners](families.md), [Stripe](stripe.md), and [the web architecture](architecture/web-app.md).

The practice loop (one problem at a time, adaptive across strands) is the product, and none of this changes it. Everything below decides who practices, who watches, and who pays.

## Principles behind every screen

- **The best and the most expensive.** AMP is sold as a premium product, the best math program on the market, and every screen should feel that way. The [interface acceptance rules](../AGENTS.md#interface-acceptance) are not optional: no layout shift, no button that can't succeed, one error pattern, designed controls, a real URL for every screen, and a guided first run.
- **Scale up and down.** The same screens serve one parent with one child, a tutor, a 100-student school and a 10,000-student district. Small places collapse; nothing is a separate product.
- **Few options, rational defaults.** A teacher or parent decides the things that matter (a final grade, whether standings are on) and nothing else needs configuring.
- **Children are not account holders.** Adults have accounts. Children join a class.

## People and sign-in

| Who                           | Signs in with                                                                                                                              | Practices as                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Parent, teacher, tutor, admin | An account: email and password, passkey, Google, Microsoft or Apple                                                                        | Their own **adult learner**, if they have one |
| Child                         | A class: class code → their name → 3 of 16 pictures; or a printed card's QR; or Google or Microsoft through the school (see Not built yet) | Their one learner                             |

- **Adults hold several places at once.** A person can be a parent, a teacher at a school, the head of a district and their own learner. The **place switcher**, one shared menu in the family drawer, the school rail and setup, moves between them. `/` opens where the person last worked. With nothing remembered, it opens the family side if they have learners or a trial, and the school if they are staff only. A school setup in progress never takes over `/`.
- **A child's session is bound to their one learner.** On a shared device (the default) it lives in session storage and signs out after 30 idle minutes. On a personal device it lasts until the teacher revokes it. Parent-only routes refuse a child's session even when a parent cookie is present. A child's session never reaches a sibling's learner.
- **"Let Maya practice here".** From the family class, a parent hands their own device to a child: it starts that child's session, and the parent's view returns when the child signs out.
- **Adult learners** are marked adult, have no birth year and need no parental consent. The adult chooses where to start (Counting through Precalculus) and always sees their levels. In their class, a teacher's adult learner appears on the map and standings as a separate "Teacher" line. It sits in place by value with no rank number, is never counted in grades, seats, rosters, exports or Today, and the teacher can hide it per class.

## Places

- **Org tree:** `amp_orgs` with `kind` family, school, network or district. Every child learns in a class, and every class belongs to an org.
- **A family** is the smallest org: one class, whose parent is its admin and teacher. The class can mix grades: with no course band, each child works at their own level. A child's learner stays owned by the parent's account, so purchases, consent and family settings stay where they were. Every family that existed was converted to this model on 2026-11-08.
- **A child from another family** joins a family class only after their own parent approves through an emailed link. That parent owns the child's learner and gives verified consent, and either they or the teacher pays. The teacher sees the child's work in the class and nothing of the other family's account.
- **A school** exists only once AMP issues it a license, after a contract and an invoice or PO. An operator runs `create-school`, which emails the admin a setup link, and the admin lands in guided setup. A school with "Just my class" collapses around that one class. Any admin can teach a class.
- **A district** is the same screens rolled up, with policy it can set and lock.
- **An adult on their own,** for example an 18-year-old preparing for the SAT, buys a license for themselves. Their home is their own progress record, and adding a child later makes them a family.

## Licenses and prices

- **Family:** $599 a year or $59 a month covers one child, and the parent practices free. Each additional child is $399 a year or $39 a month. Prices show only from the server's offer and are never written into a screen.
- **Free adult practice:** every teaching adult practices free. That means any parent with a paid child and any teacher at a licensed school.
- **Existing subscriptions** keep the price they bought.
- **Funded programs** (education savings accounts and similar) sell at the price each program's listing allows.
- **Schools:** seats by license, issued by an operator. A school's students practice while it holds a seat. There is no self-serve school purchase yet; a self-serve seat pack is a possible second way later.
- **Access:** one rule for every learner: an active grant.

Media, videos and ads carry no price; they lead to the Buy button.

## Screens by person (each is a URL)

- **Anyone:**
  - `/`: the parent pitch.
  - `/schools`: the school page. "Talk to us" goes to an inline form on the page, `#talk`.
  - `/schools/scope-and-sequence` and `/schools/trust`.
  - `/p/…`: a family progress link a teacher shares.
- **Footer of the public pages:** the support address in full with a Copy button, and links to Instagram, YouTube, TikTok, Facebook and X. Nothing on these pages opens a mail app.
- **New family:**
  - `/try`, `/try/map` and `/try/practice`: the free assessment.
  - `/start/…`: plan, consent, name, birth year and purchase.
  - `/purchase` and `/access`.
- **Parent:**
  - The family class: Today lists the parent's children, each with access dates and "Let … practice here", plus a "From other families" list.
  - The full class screens, as for any teacher (below).
  - `/family/…`: settings, consent and billing.
  - `/learners/$id/workbooks`.
  - `/family/approvals/$id`: a parent approving another family's class.
- **Adult practice:**
  - `/me/start`: choose where to begin.
  - `/me`: their own record, with levels per strand, 12 weeks of time, time by day and skill, objectives and recent work.
  - `/practice` and `/pathways`.
- **Child:**
  - `/join`, `/join/$code` and `/join/$code/$person`: sign-in.
  - `/c/…`: a printed card.
  - `/practice`.
  - `/standings`: only when their class turns standings on.
- **Teacher:** `/school/$org/classes/$class/` with tabs `today`, `map`, `gradebook`, `time`, `workbooks`, `roster`, `experience`, `start` (the projected Start class board with the code and QR), `cards` and `report-cards`; plus `/school/$org/students/$student`.
- **Admin and district:**
  - `/school/$org`: the overview.
  - `staff`, `calendar`, `experience`, `import`, `integrations`, `license`, `privacy`, `activity`, and `schools` for districts.
  - `/school/new?org=…`: guided setup, reached only from a setup invitation; without one it goes to `/schools`.

Screenshots of most of these, at 390 and 1280 px in light and dark, are under `docs/reviews/`. The relevant folders are `schools-public`, `school-setup`, `school-places`, `school-classroom`, `school-teacher`, `school-org`, `adult-practice`, `teacher-in-class`, `family-class`, `family-approval` and `extra-child-price`.

## Settled decisions to keep

- **Grades:** the teacher decides every grade. AMP suggests a range from course progress, growth, practice and retention, and every grade opens to its evidence.
- **Defaults for schools and families:** levels hidden from students, standings off, shared devices. A higher level can lock a setting, and the screen says who set it.
- **Standings:** independent work only. A board shows the top 10 plus your own line, never a list down to last place.
- **Contact:** show the address with a Copy button; don't open a mail app.
- **No operator UI:** schools, licenses and seats are run by operator commands (`npm run school:admin -- create-school | issue-license | set-seats | delete-org …`, `npm run family:convert`) and the API, not by admin screens.
- **Student data:** students get no analytics or ad measurement, and staff get no marketing collection.

## Not built yet

- **Google sign-in for students:** the Google console's redirect addresses are still to be added. Microsoft student sign-in is configured.
- **Teacher-paid access for another family's child:** this needs that child's parent to give verified consent without buying. Today a purchase is the verified method.
- **Moving a child who already has their own account into a parent's family class.**
- **Co-teacher invitations** from the family screens. They work by URL only.
- **Approval duplicates learners:** a family approval always creates a new learner, so a child already in a class gets a second one.
- **Self-serve seat packs** for co-ops and tutors.
- **Clever, ClassLink, SAML and gradebook passback** to student information systems.
