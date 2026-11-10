# AMP product model: people, places, sign-in and screens

The current shape of AMP as of 2026-11-09, for anyone changing its screens. It sums up the decisions behind the people, places and licenses, what each person sees, and what isn't built yet. For the details, see the [schools design](schools.md), [families, classes and adult learners](families.md), [Stripe](stripe.md), and [the web architecture](architecture/web-app.md).

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
| Child                         | A class: class code → their picture label or name → 3 of 16 pictures; or a printed card's QR; or Google or Microsoft through the school (see Not built yet) | Their one learner                             |

- **Adults hold several places at once.** A person can be a parent, a teacher at a school, the head of a district and their own learner. The **place switcher**, one shared menu in the app drawer and setup, moves between them. `/` opens where the person last worked. With nothing remembered, it opens the family side if they have learners or a family class, and the school if they are staff only. An account with no place yet answers "What brings you to AMP?" first. A school setup in progress never takes over `/`.
- **A child's session is bound to their one learner.** On a shared device (the default) it lives in session storage and signs out after 30 idle minutes. On a personal device it lasts until the teacher revokes it. Parent-only routes refuse a child's session even when a parent cookie is present. A child's session never reaches a sibling's learner.
- **"Let Maya practice here".** From the family class, a parent hands their own device to a child: it starts that child's session, and the parent's view returns when the child signs out.
- **Adult learners** are marked adult, have no birth year and need no parental consent. The adult chooses where to start (Counting through Precalculus) and always sees their levels. In their class, a teacher's adult learner appears on the map and standings as a separate "Teacher" line. It sits in place by value with no rank number, is never counted in grades, seats, rosters, exports or Today, and the teacher can hide it per class.

## Places

- **Org tree:** `amp_orgs` with `kind` family, school, network or district. Every child learns in a class, and every class belongs to an org.
- **A family** is the smallest org: one class, whose parent is its admin and teacher. The class can mix grades: with no course band, each child works at their own level. A child's learner stays owned by the parent's account, so purchases, consent and family settings stay where they were. Every family that existed was converted to this model on 2026-11-08.
- **A child from another family** can begin as an unnamed learner in a tutor’s class. An emailed parent approval names and transfers that same learner to the parent after verified consent, preserving answers, class membership and the free balance. A new invitation collects only the parent’s email address; the parent supplies the child’s name after consent. The teacher sees the child’s work in the class and nothing of the other family’s account.
- **A school** exists only once AMP issues it a license, after a contract and an invoice or PO. Before that, a teacher or a school explores a demo from the starter. An operator runs `create-school`, which emails the admin a setup link, and the admin lands in guided setup. A school with "Just my class" collapses around that one class. Any admin can teach a class.
- **A district** is the same screens rolled up, with policy it can set and lock.
- **A demo class or school** ([demo places](schools.md#demo-places)) lets a teacher or school leader explore AMP fully alive before any agreement or payment: made-up students marked "Demo", twelve weeks of practice, and "Practice as" any of them. It is never billed, counted or mailed, goes after 30 idle days, and is never converted: the real class comes from the real onboarding.
- **An adult on their own,** for example an 18-year-old preparing for the SAT, buys a license for themselves. Their home is their own progress record, and adding a child later makes them a family.

## Licenses and prices

- **Family:** $599 a year or $59 a month covers one child, and the parent practices free. Each additional child is $399 a year or $39 a month. Prices show only from the server's offer and are never written into a screen.
- **Free adult practice:** every teaching adult practices free. That means any parent with a paid child and any teacher at a licensed school.
- **Existing subscriptions** keep the price they bought.
- **Funded programs** (education savings accounts and similar) sell at the price each program's listing allows.
- **Schools:** seats by license, issued by an operator. A school's students practice while it holds a seat. There is no self-serve school purchase yet; a self-serve seat pack is a possible second way later.
- **Free allowance:** every learner, including an adult, has 100 online answers or skips and five separate workbooks. All five workbooks are available immediately. Recording printed results spends neither allowance. Paid activity preserves the unused free balance.
- **Access:** after checking ownership and learning permission, `canPractice = hasAccess || freeRemaining > 0`. An active grant also covers new workbooks; otherwise the separate workbook allowance applies. Issued workbooks and result entry stay available after either allowance is exhausted.
- **Unnamed children:** picture identity and birth year establish a learner without collecting a name. Naming requires verified parental consent or an active school data agreement. Consent withdrawal or an ended school agreement stops further learning; a grant does not replace consent.
- **One product:** trying AMP and paying for it are the same app. There is no separate trial: a learner is covered by the free allowance or by a paid grant, and nothing moves when someone pays.
- **Starting:** a new account answers one question, "What brings you to AMP?" (`/start`), and the answer creates only the place it needs, in one call (`POST /api/v1/start`, `src/account/starter.ts`):
  - **Myself:** the adult's own learner; home is `/me`.
  - **Parent:** the family class with 1–6 unnamed children, each with a birth year; home is the class's Today.
  - **Tutor or co-op:** the family class with unnamed students owned by their roster person, so each one's own parent names them by an approval link; home is the class's Today.
  - **Teacher:** a demo class, alive with fictional students marked "Demo" and months of their work (`POST /api/v1/school/demo {kind:"class"}`); its bar offers "Set up your real class", which leads to the real onboarding: the data agreement, then the roster. No real student exists before that.
  - **School:** the school pitch inline, with "Explore a demo school" (`{kind:"school"}`) and "Talk to us".
  Asking again for a place the account already has opens it. Anyone can add another place from the place switcher's "Add a place".
- **When the allowance ends:** the screen in use shows one pause (`features/continue/AllowancePause.tsx`) naming the learner and the fact, with the one action that works for whoever is looking. A parent or an adult continues with AMP for that learner (`/continue/<learner>`: the plan, with the parent notice when no consent is recorded yet, then Stripe, then back to the same screen with access active, then an optional "Add Fox's name"). A class's teacher, a tutor or a school talks to us. A student is told their grown-up can continue.

Media, videos and ads carry no price; they lead to the Buy button.

## Screens by person (each is a URL)

- **Anyone:**
  - `/`: the parent pitch.
  - `/schools`: the school page. "Talk to us" goes to an inline form on the page, `#talk`.
  - `/schools/scope-and-sequence` and `/schools/trust`.
  - `/p/…`: a family progress link a teacher shares.
- **Footer of the public pages:** the support address in full with a Copy button, and links to Instagram, YouTube, TikTok, Facebook and X. Nothing on these pages opens a mail app.
- **New account:**
  - `/sign-up`, then `/start` and `/start/<choice>`: "What brings you to AMP?", on the app frame.
  - `/continue/<learner>`: Continue with AMP for one learner.
  - `/start/purchase`: Stripe's return for a purchase made before consent was recorded.
  - `/start/plan`, `/start/consent`, `/start/name` and `/start/birth-year` remain only for a parent approving another family's child, a funded program, a gift, or a paid purchase no learner holds yet.
  - `/purchase` and `/access`.
  - `/try` and `/try/…`, from older links: signed out, `/sign-up`; signed in, `/`.
- **Parent:**
  - The family class: Today lists the parent's children, each with access dates or the free problems left and "Let … practice here" (or "Continue with AMP" once those are used), plus a "From other families" list with a tutor's unnamed students and "Send to their parent".
  - "Invite a co-teacher" (for example the other parent), with a copyable link. A co-teacher teaches the class but doesn't invite other families or buy access.
  - The full class screens, as for any teacher (below), plus Calendar in the class tab row and Family in the drawer for learners, purchases, consent and privacy.
  - `/family/…`: settings, consent and billing.
  - `/learners/$id/workbooks`: the learner’s workbook history, creation and results on the shared shell, without Progress tabs. The URL identifies the learner independently of the selection in Progress.
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
- **Teacher:** `/school/$org/classes/$class/` has Today, Map, Grades (`gradebook`), Time, Workbooks, Students (`roster`) and Settings tabs in the shared app bar. Today’s **Start class** action opens the code and QR board (`start`). Grades opens `report-cards`; Students opens sign-in `cards` and student-experience settings (`experience`). Student records use `/school/$org/students/$student`. Past classes keep Grades and Time.
- **Admin and district:**
  - `/school/$org`: the overview. The shared bar has Overview, Classes, Staff, Calendar, License, Privacy and Activity tabs, filtered by the person’s access. Districts and networks also have a Schools tab. A one-class solo school omits Overview, Staff and Activity. Classes opens students, imports and student-experience settings; Staff opens sign-in help and integrations; Calendar opens year rollover.
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
- **Self-serve seat packs** for co-ops and tutors.
- **Clever, ClassLink, SAML and gradebook passback** to student information systems.
