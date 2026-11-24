# AMP screens: places, tabs and layout

The rules every AMP screen follows, decided 2026-11-10 for the design pass. [The product model](../product-model.md) says who sees what; this file says where it goes and how it looks. Where they disagree, this file wins for layout and the product model wins for permissions.

**The references for look, type, spacing and density** are the `/schools` product shots in `src/web/features/schools/screens/*.webp`: today, map, gradebook, board, cards, evidence, standings, school-overview, district-overview and stack. Compare every screen against them. Also use the pre-refactor trial (best guess, a narrowing likely range, per-area bars with uncertainty) and Inventory, which shows how a dashboard should fill the width with purpose.

## Rules before anything else

0. **Apply a founder note to the case it describes.** A note about one screen changes that screen. It becomes a rule for every screen only when he says "in general", as he did for centring. When unsure, keep the change local.
1. **First impressions.** A section without meaningful data doesn't render, or collapses to one compact line. No chart with one bar, no "None yet this year" section, no two-column dashboard with an empty column. Every screen must look intentional on day 0, day 1 and week 3 (the seeded personas cover all three).
2. **Never name the person to themselves.** A person's own pages never show their own name: no "Good afternoon, Tess Harlow", no name heading on /me, no "Mara Quill · Skills grow…" on Pathways. Titles name the content or the place. Names appear only for other people: children, students, staff.
3. **Avatars only where they help find someone else.** Never for the person themselves, never in navigation, account pages, /me or staff lists. Initials may stay where they help scan other people: a Today item's group of students, and student rows in the map and gradebook, as in the product shots. A child's chosen sign-in picture appears where the child or teacher uses it to find them (sign-in, the code board, cards).
4. **No card wrappers on app screens.** Sections are separated by space and a heading, rows by a hairline. Raised surfaces are only for things that float or are touched as objects: sheets, menus, dialogs, toasts, the practice answer area, paper previews.
5. **Plain words that describe.** Copy inside the app describes; it never sells. "Skills", not "crystals". Number and noun agree ("1 attempt"). Helper text appears only where a control is not obvious, and it is one line.
6. **Tailored to each person: share components, not screens.** An adult, a parent, a tutor, a teacher and a school admin each get screens composed for them. Where one shared screen bends itself with conditionals ("if family… else if solo…"), split it into a composition per person built from the same components (the Today feed item, level range, rows, the year section). A component is shared; a screen belongs to one person.
7. **Day 0 is a centred hero.** Before there is data, a screen is one centred column: one heading, the one visual that will fill with data (the starting estimate on the scale, the class's empty map), one sentence, one prominent action, and quiet secondary items below it. Nothing is left-aligned with empty space to its right. Once there is data, the screen takes its normal layout.

## Places and navigation

One drawer, one place switcher (`PlaceSwitcher`). A person may hold several places. The bar shows the place's tabs and one primary action. Everything rare lives in Settings, a row's overflow menu, or the drawer, never on the place's first tab.

- **The place switcher holds the places a person works in, and nothing else:** their own practice (once they have it), their family, each school or district they administer, and each class they teach. In that order, with each school followed by the classes they teach there, then Add a place. A class an admin oversees but doesn't teach is reached from the school, not listed. A lone teacher's school with one class (`solo`) is listed as that class, as its Teacher; a second class brings the school back. It never lists practice profiles, "Try a level…", children or students. Children and students are reached from their class: the Map and Students tabs, and the drill-in.
- **Starting something new is one menu.** "Get started" is the drawer's first item only for an account with no place yet. Once there is any place, starting their own practice, a family, a class or a school is an option of "Add a place", never a row of its own.
- **The drawer's Class and School items follow the place on screen.** In a class: Class (that class) and School (its school). In a school: School only. In a family: Class (the family's class). Never a class because it was the last one opened, and never "any" school; every other place is one step away in the switcher. On a class the person doesn't teach, the switcher names the school and the Class item names the class.
- **Workbooks, for an adult's own practice,** is an item of the drawer directly under Practice: a workbook is a way to practise (on paper, at your level), not a view of progress. Its pages are a place of their own: the plain bar, no Progress tabs, the drawer item current. A family's and a class's Workbooks stay their tab.
- **Practice as someone else** is a page (`/me/profiles`) reached from the drawer under My practice. It holds the saved profiles, recently used ones, and "Try a level…". While practicing as a profile, the bar keeps its way back: to where the mode was started ("Back to Grade 1 Math"), else "Back to my own practice" (see Navigation below).
- **A problem's bar holds only the problem's tools (founder, 2026-11-23).** On practice: the logo (the menu), the topic where it fits, the calculator, Colorful's points, and the raised hand while a class's or a family's session runs for that learner. Who is signed in, Sign out (a handed device's "Back to family") and, with no session running, the raised hand are rows of the menu, once each; the bar keeps the hand's place so a session starting or stopping moves nothing. Every other screen's bar is unchanged.
- **One tab header per place.** Navigating within a place never swaps in another place's tab bar. A family, a tutor or a lone teacher never lands on a school-level page.

| Place                | Who                         | Tabs                                                          | Bar action                 |
| -------------------- | --------------------------- | ------------------------------------------------------------- | -------------------------- |
| My practice          | an adult learner            | Overview · Pathways · Inventory                               | ▶ Practice                 |
| Family               | a parent, the second parent | Today · Settings                                              | ▶ Practice (picks a child) |
| Class (tutor, co-op) | a tutor                     | Today · Map · Workbooks · Time · Report cards · People · Settings | Start class (a live session) |
| Class (school)       | a teacher                   | Today · Map · Grades · Time · Workbooks · Students · Settings | Start class (a live session) |
| School               | an admin                    | Overview · Classes · Staff · Activity · Settings              | none                       |
| Account              | everyone, from the drawer   | Sign-in · Learners · Billing · Privacy                        | none                       |

- **A place with one class opens on that class's Today**, never on a list of one (teacher demo, family, second parent).
- **The roster tab is named by the org's kind:** "People" in a family org (a family or a tutor's class), where it holds children, the second parent and co-teachers. It is "Students" in a school's class.
- **Tabs follow the class's size.** A family or tutor class (6 or fewer learners) has no Grades tab and no Calendar tab. Grades are a line in each learner's Map panel, and the weekly target is set in Settings with its progress on Today. A teacher's class keeps Grades.
- **Calendar is configuration, not a place.** No place has a Calendar tab. A school's year and terms are a section of its Settings. A family's, a tutor's or a lone class's year is one compact section of the class's Settings.
- **Opening a student never leaves the page.** From a class or a school, a student opens as a layer over the page it was opened from (`?open=student:<id>`, see Navigation), and the place's tabs stay. Over a school's page the layer adds the admin's actions (share with the family, move to another school). The old school-level address (`/school/<org>/students/<id>`) opens that layer over Students.
- **Account tabs follow the account:** an adult with no child sees "Your practice", not "Who's learning?" with "Add a child"; Privacy says "your data", and Learning consent appears only once a child exists. The tab label and the page title are the same words.

## Navigation: places, modes and layers

The founder (Q-67, Q-69, Q-70): "Almost everything should be addressable and linked everywhere, but we need an exquisite way to maintain context, so we can X out or go back to exactly where we were and not end up on some default page in some other mode." One system does this everywhere. Follow it for every new screen; don't build a screen's own.

**The URL names the screen.** Where someone is and how it's viewed live in the address, owned by `src/web/nav` and `src/web/lib/return-to.ts`. What is open over the screen (its layers) lives in one zustand store, `nav/layer-store.ts`, keyed by the screen (QA 2026-11-16). React Query holds data. Refresh, Back, Forward and a shared link therefore always restore the same screen, with its layers as they were.

1. **A place is the path prefix:** `/school/<org>/…`, `/school/<org>/classes/<class>/…` (a family's class too), or own practice (`/me`, `/practice`, `/pathways`…). Links resolve inside the current prefix. Only the place switcher changes prefix.
2. **Entities and layers.** A student, an answer, a skill or a problem type's lesson is an entity (`nav/entities.ts`: kind and id format). Opening one never leaves the page. It becomes a layer over it, in the screen's stack in `nav/layer-store.ts`. A stack is keyed by its screen: a family's or a school's address (which names its account and learner), else the signed-in account and the address. A device handed to a child for practice and back keeps the parent's stack.
   - The page under the layers stays mounted, with its scroll, sort, filters and tabs.
   - **Layers are no steps in history.** Opening, going deeper, the trail and closing change the store only. Back and Forward go between screens, never through layers, so there is no history to walk out of a deep stack. Coming back to a screen (Back from practice, Forward, a refresh) shows its stack exactly as it was, at once.
   - **ONE overlay** (`ui/LayerFrame.tsx`): one scrim and one sheet, however deep. The top layer is the sheet's panel; going deeper slides the next panel in from the right, going up slides back from the left (no motion with reduced motion). A trail at the top names the way down ("Linear systems › Systems modeling › Geometric design"), each step a way back up. ✕ and the scrim close the whole overlay to the page; Escape goes up one level, or closes at the first.
   - Only a person's own open or close moves anything. A restored stack (Back, a refresh, a remount for another identity) is drawn settled, never replaying its entrance.
   - `nav/LayerHost.tsx` draws the stack in every school and class frame, and over Pathways and Inventory in own practice (a skill or a lesson there; students and answers are staff-only kinds). A layer's own `Sheet` or `Dialog` draws its panel in the frame (`useLayerPanel`); what that panel opens (a confirmation) is its own modal again. An answer is the full-screen replay, a base of its own: the layers under it wait, the ones over it (its lesson) are the overlay's, and closing that overlay returns to the replay.
   - **Shared links.** A layer's link (`EntityLink`) has a shareable href naming the stack the way addresses did before the store (`?open=student:<id>,work:<student>.<attempt>`). A click opens the layer in place; a new tab or a pasted link opens the screen, and the router moves `?open=` into the store and drops it from the address in one replaced entry (`settleLegacyLayers`). Nothing in the app writes `?open=` to the address bar.
   - **A layer knows whose it is (QA 2026-11-23).** A family's Today shows several children. A skill opened from one child's block, or a lesson or skill from a "For today" entry about one child, carries that child: `<EntityLink with={{ for: child.id }}>`, in the store with the layer and as `?for=<learner>` in its shared link, never left in the address once the layer is in place or closed. What opens over it (a lesson, a connected skill) is that child's too. A page that names its child (`/family/<family>/kids/<child>/…`) needs no key, and the layers over a child's answer are that child's. The practice a layer offers is theirs, started as the child's own Practice button starts it (the hand-over: their session, their record), held to the skill, type or area, and named for them ("Practice Mean and median with Wren"). Where a family's screen names no child the control is the adult's own practice: the press takes the adult as the learner, starting their own practice if they haven't yet; an adult who can't practice themselves is offered none. No practice control reads the learner last selected on the device. An id that isn't one of the family's own children offers nothing, and the server refuses the hand-over. A tutoring group (the family's own class with another family's child in it) keeps its class address, where a child's record is a layer over the class's page: over their own child's record or answer a parent gets that child's practice the same way; over another family's child's, and for any staff who are not that child's parent, there is none. `scripts/verify-child-practice-ui.ts` walks every child's area as both parents and presses every practice control.
   - A skill is the same entity everywhere. Over a class it shows the class on it, over a student their evidence, and in own practice the learner's own: progress, status, answers without help, last practiced and their recent work on it (no replay, a staff-only kind), then its problem types and the skills it builds on, leads to and relates to, each opening over it. The page adds its own action (Pathways and Inventory: Try a problem).
   - Pathways' map is the page under its skills: opening and closing one never moves the map. The 3D map always opens on the whole map, framed (Q-9), on every way in: from Grades, with skills open, a refresh, a link, a tab. An open skill is marked where it is, and only a skill found by the search or the list once the map is on view glides into view.
   - Old addresses redirect to their layers: `map/<student>` and `map/<student>/work/<answer>`, the school-level `students/<student>` and `students/<student>/work/<answer>`, Pathways' `/pathways/<skill>` and `?skill=<skill>`, and `?lesson=<type>` on Pathways and Today. The public `/pathways/<skill>` pages stay the canonical addresses for search engines.
3. **One link primitive.** Screens open details only with `<EntityLink entity={…}>`, or `useLayers()` from code. `EntityLink` takes an array to open several layers in one step (a student, then their answer). An answer's `skill` for Previous and Next travels with its layer.
4. **Every close goes through `closeTo`** (`lib/return-to.ts`). Each history entry records the address it was pushed from, and the record survives a refresh. Opened in the app, a close goes Back, so X and Back agree and Back never reopens what was closed. With no history (a shared link, a new tab), a close replaces the view with its `from`, or else its logical parent in its context. A view with an address of its own, such as a film, carries `?from=`, which is checked as an internal path. Stepping within a layer (Previous and Next) swaps the top layer in the store.
5. **Modes are part of the place's address.** Practicing as a student is `/practice?profile=<id>&from=<where it started>` (`features/profiles/practice-mode.ts`). Learning screens inside the mode carry both keys. Its way back ("← Grade 1 Math", in the bar and the drawer), X, Back and Forward all return to where it was started. A learning screen without `?profile=` puts a leftover profile down.
6. **The root `/` resolves to a place,** the one last used, on arrival and on Back and Forward alike. First-run onboarding appears only for an account with no place. An account with a place and no practice of its own never sees family setup: a practice screen sends it to its place.
7. **Banned outside the navigation module:** `navigate({ to: "/" })`, `<Link to="/">`, `redirect({ to: "/" })`, `window.location` assignment and `history.back()`. `npm run lint:navigation` (`scripts/check-navigation.ts`, part of `npm run build`) fails on any new one. A screen outside any place (a signed-out page, the first run, a gift, a student's own practice) reaches the root only through `nav/root.tsx` (`RootLink`, `useToRoot`, `rootRedirect`). The allowed uses are only those that leave the app's history: signing in or out, a payment provider's page (Stripe, ClassWallet) and development, each listed there with its reason.

**Proof that grows with the app:** `scripts/verify-layer-crawl-ui.ts` reads the router's route table (`window.ampRouteTable`, development only) and the entity registry. As a demo school's leader, a real school's admin, a teacher, a parent, a tutor and an adult in their own practice, it opens every route each can fill in (their school and class, a catalog skill and problem type, and ids their own screens link to). A screen is reached when it stays at its address, an old address when it opens inside the same place. A route no one reaches fails the crawl unless the crawler's `UNREACHABLE` list names it with the reason (signed out only, first run, a student's device, a district…). On every reached page of each place they hold it opens every kind of entity link, nests one more, then pops with Escape, Back, Forward, refresh and Escape again. It asserts that the prefix, the page under the layers and its view and scroll never change, that no first-run screen shows, that a nested layer names where X returns, and that every registered kind is reachable, including a student at school level and a skill and a lesson in own practice. It then opens each old address as its layer, checks that a skill opened and closed over Pathways leaves the map exactly where it was, that a family's and a tutor's old Students and Standing addresses open their People and Map and that none of their screens links to them, and closes consent back to Privacy. `verify-close-context-ui.ts` (an answer's lesson and film) and `verify-place-mode-ui.ts` (practicing as a student) cover the founder's exact paths.

### Phase 2: the rest of the places

Done:

- Sheets opened by a search key close with `closeSearch`: a gradebook's evidence, curve and export sheets, a Time day sheet, Students' student and add sheets, and Calendar's edit sheet. Settings → Export now comes back to Settings.
- Pages of their own go Back to where they were opened, else to their logical parent (`useCloseClick`): Report cards, Sign-in cards, the Start-class board, a workbook day and a funded invoice claim. Their labels read "Back" where the opener varies.
- The lesson reader goes Back to Progress or to the skill it was opened from.
- Pathways' lessons and Today's lesson to-dos are `lesson` layers.
- The school-level student page is a `student` layer over Students and the standing drill.
- The legacy family and purchase centres close with `closeTo`: purchases, consent, the birth year and the family centre itself. A family section is the centre's view, so switching replaces its entry. Practicing as a profile with no `from` and no practice of its own goes Back ("Back"), else to the root.
- The crawler covers every place type: classes, schools and own practice.

### Phase 3

Done:

- Pathways' skill panel is the `skill` layer, the learner's view of the entity the school side uses. `/pathways/<skill>` and `?skill=` redirect to it. Inventory opens the same layer over its list.
- The crawler's page list comes from the route table and the entity registry; unreachable routes are named with a reason.
- A family org (a family's or a tutor's) has no school-level Students or Standing. Their old addresses open the family's own equivalents in its class: Students → People (`roster`, any open student layer kept), Standing and a class's standing drill → Map. The crawler checks both, and that no family or tutor screen links to them.

## Where settings live

Every setting lives in exactly one place, chosen by its scope: school (or district), then class, then learner, then account, then device. A screen at a lower scope links to the scope above for what it inherits, and never repeats that setting. A school can lock a setting for everyone below; the class shows it as locked and who set it.

**One home per scope.** For a school or district, that is the Settings tab. For a class, it is the class's Settings tab. For a learner, it is Account → Learners. For the account, it is the Account tabs. For a device, it is the drawer.

| Setting                                                                           | Scope                          | Its one home                                                                                               | Elsewhere, only a link                                  |
| --------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| School year dates and terms (None · Semesters · Trimesters · Quarters)            | school                         | School Settings → School year and terms                                                                    | a class's Settings links to the school's                |
| The same, for a family, a tutor or a lone class                                   | class                          | Class Settings → School year                                                                               | —                                                       |
| Grading periods a class grades by (Full year · Semesters · Trimesters · Quarters) | class                          | Class Settings                                                                                             | —                                                       |
| Student experience: levels shown, standings, what a board counts, devices         | school default, class override | School Settings → Student experience; Class Settings → Student experience, for what the school leaves open | —                                                       |
| Weekly practice target                                                            | class                          | Class Settings                                                                                             | its progress shows on Today and Time                    |
| License and seats                                                                 | school                         | School Settings → License                                                                                  | the Overview's seat line                                |
| Data agreement, what AMP collects, export, deletion                               | school                         | School Settings → Privacy and data                                                                         | —                                                       |
| Google and Microsoft sign-in, rostering                                           | school                         | School Settings → Integrations                                                                             | Staff → Sign-in help                                    |
| Staff and their roles                                                             | school                         | Staff                                                                                                      | —                                                       |
| Class code and join link                                                          | class                          | Class Settings                                                                                             | Today's code and the sign-in board show it              |
| Roster and sign-in cards                                                          | class                          | Students (school class) or People (family org)                                                             | —                                                       |
| Second parent, co-teachers, other families' children                              | family org                     | People                                                                                                     | —                                                       |
| A learner's name, birth year, SAT focus, deletion                                 | learner                        | Account → Learners                                                                                         | —                                                       |
| Plan, renewal, receipts                                                           | account                        | Account → Billing                                                                                          | the allowance pause and Continue lead there             |
| Sign-in methods and passkeys                                                      | account                        | Account → Sign-in                                                                                          | —                                                       |
| Consent and the account's own data                                                | account                        | Account → Privacy                                                                                          | —                                                       |
| Practice profiles                                                                 | adult                          | Practice as someone else (`/me/profiles`)                                                                  | the drawer, under My practice                           |
| An adult's own workbooks                                                          | adult                          | Workbooks (`/learners/<own>/workbooks`), its own place                                                     | the drawer, directly under Practice                     |
| A child's workbooks                                                               | family or class                | child’s progress page → Workbooks (family), or Workbooks tab (class)                                                                                  | —                                                       |
| Show grade level (what a child sees as themselves)                                | learner                        | the child's settings, on their page                                                                        | a school's "Show levels to students" can also hide them |
| Sound, haptics                                                                    | device                         | the drawer                                                                                                 | —                                                       |

**An optional choice always has a way back.** Every segmented control that sets something optional includes None or Off, so a choice can always be undone (terms: None · Semesters · Trimesters · Quarters; standings: Off · Class · School). A picker that only views something (a term in the gradebook, a period on Time) needs no None.

## Each person

Each of these is that person's own composition of shared components (rule 6). The shared parts are: the level range (`ui/level-range`), the Today feed item, rows and tables (`DataGrid`), the year section (`YearCalendar`), the allowance pause, and the day-0 hero.

### Adult (My practice)

- **First run:** "Myself" → the year they were born → straight into practice. The year is always enough: an adult's starts mid-scale and practice finds the level within a few problems. There is no level chooser. They never land on an empty Overview.
- **Overview (`/me`), day 0:** the centred hero (rule 7). It has the heading "Where you are" and the starting estimate on the scale, large and centred. One sentence ("AMP starts near Algebra 2. Every answer narrows the range.") sits above a prominent Start practicing button. The free problems left sit quietly below.
- **Overview, with data:** two columns from 1024 px.
  - The left column has the best guess and likely range, then one row per area with its uncertainty bar. Under them sits "How it narrowed".
  - The right column has this week's line with the 12-week strip, then objectives gained.
  - Recent work runs full width below.
  - The header is the title alone, "Where you are" (with the free problems left as one quiet line). Workbooks and Practice as someone else are in the drawer. A report prints with Cmd+P and a print stylesheet, not a Print button. The bar holds the one Practice button.
- **Pathways and Inventory:** full width. On day 0 each is a centred hero over the whole curriculum.
- **Workbooks:** the drawer item under Practice. The workbook pages are their own place (the plain bar with its Practice, no Progress tabs, the drawer item current); a workbook's page keeps its in-page way back to "Your workbooks", and the builder opens in a sheet.
- **Lessons** are not a destination of their own. They are reached from a skill's layer (over Pathways and Inventory), from practice (Lesson in the feedback) and from Pathways' search. The `/lessons/<id>` reader stays for links. `/lessons` alone opens Pathways, carrying any `?q=` into its search.
- **One search, on Pathways and Inventory:** skills, lessons and glossary terms, grouped (the semantic search), through one field, hook and result list (`features/search/SiteSearch.tsx`). Every result opens its skill where that screen opens skills; Inventory lists its found skills with their progress, best first.
- **The drawer, for an adult:** Practice · Workbooks (a book icon) · Progress (Overview · Pathways · Inventory) · Practice as someone else (its own icon) · Account. Exactly one item is current. There is no Lessons item.
- **Practice as someone else (`/me/profiles`):** saved profiles, recent ones, and "Try a level…", reached from the drawer. It is never in the place switcher.
- **Account:** Learners lists "Your practice" first. Billing shows the free problems left or the plan.

### Parent (Family)

- **First run:** "Parent" → each child's name (a parent-entered nickname) and birth year → the first child's first problem on this device. Consent and access are steps inside that flow, never a separate page.
- **Today, day 0:** a centred hero: the level scale every child will fill, one sentence, each child's name with "Practice" as the prominent action, and how the children get in (QR, link, family code) quietly below.
- **Today, with data: the parent's dashboard.** A parent sees how each child is doing in five seconds.
  - One block per child, parted by a hairline, no cards. Its row: the name (their page), this week's seven day dots, minutes, problems and percent right, and the one action that works now, "Practice" or "Continue with AMP".
  - Under it, what AMP is working on and why, as one line: the last problems counted as Catching up, Reviewing, Checking earlier and New ground (all four always, a 0 as 0, so every child's line is the same shape), and how many were chosen practice when any. The line is one control of a fixed height (44 px on one line from 700 px of block; 60 px, then 80 px on a phone, below that); it opens a sheet over Today with every skill behind each reason, each opening the skill.
  - Then the five areas: where the child is working (the likely range and best guess, grade numbers only with that child's switch on) and what was checked in the two grades below, as one bar of Strong, Earned, Tried and Not asked yet. "N not asked" opens those skills, each one tap from practice held to it. A caption says how many answers the levels rest on and that AMP started from the birth year.
  - The key to the bars sits once above the children, always on screen: Strong is 4 of the last 5 right without help; Earned is right once without help.
  - Beside the children from 1024 px (under them on a phone): the feed (a skill missed three times, no practice in a week, ready for more, the weekly target), This week for the family, and How your kids get in.
- **Today, a live practice session (round 2026-11-20, L8).** A family's class runs the same session a teacher's does, in a family's words. At rest the dashboard has one quiet bar above "Your kids": Start practice with the optional length. While a session runs the cockpit takes the bar's place and the children's live rows sit above the dashboard's blocks: clock and Stop, the totals, the requests ("Got it" for a raised hand, "Reset" for a forgotten picture), then one row per child (status, last five answers, problems, percent right, help, skill, last active), a short list at every width, never a grid. A child's row opens the child's page. A child on the parent's device who hasn't answered yet reads "Not started". Levels show per child, in grade words, only where that child's "Show grade level" is on. Stop asks, then opens the report at `/family/<family>/sessions/<session>` with Today the current tab; past sessions are a compact "Past sessions" list at the foot of Today, which does not render before the first one has ended. The second parent sees and stops the same session. The cockpit's code is its own chunk: a family with no session running never downloads it.
- **A child's page:** their name opens their record, with current estimates, daily practice time, earned skills, recent work, workbooks, practice time and report cards.
- **Inventory, by grade or by area.** One more way to slice Inventory, chosen by a two-way switch under its title. "By area" is Inventory as it was: the learner's collection, its filters and bars. "By grade" is one grade as a flat index, read top to bottom: the row of grades and courses (each one tap), the key (Strong, Earned, Tried, Not asked yet), then each of the five areas, its skills in teaching order (strand by strand, a skill after what it builds on), each with where the learner stands in the dashboard's words and swatches, and under each skill its problem types, each opening its lesson. From 768 px everything is listed; on a phone a skill's problem types sit behind its own "4 problem types" (a grade has up to 160, and listed out the skills were lost among them). The search and the math area narrow either slice. A grown-up reading a child's Inventory opens by grade, on the child's own grade (the best guess of their level); a learner's own opens by area. The choice and the grade are part of Inventory's view (`features/inventory/inventory-view.ts`), kept for the tab like its search, never in the address. Two entries open a child's on their grade: "Skills by grade" at the foot of their block on Today, and "All Grade 4 skills" in their Overall on their page. Printed (Cmd+P), one grade is a checklist: whose and which grade, the key, every skill and problem type with a box to tick, no controls. `scripts/verify-skill-index-ui.ts` walks it at 390 and 1280.
- **Workbooks:** each child’s printable practice and recorded paper work.
- **Settings:** children, people and sharing, the class code, the school year, the weekly target, and what children see (levels, standings, devices).
- **The second parent** sees the same Family screens. She sees no buying, consent, naming or deletion.

### Tutor (a family org's class of students from other families)

- **First run:** "Tutor or co-op" → how many students and their birth years → the code board, with a link for each family to approve.
- **Today, day 0:** a centred hero with the code board's code, "Each student signs in with the code and their pictures", and Start class.
- **Today, with data:** the Today feed for a small class. Who practiced today comes first, then who needs attention. Students waiting for a parent's approval appear as one line ("2 waiting for a parent"), linking to People.
- **Map, Time, Workbooks, People, Settings:** as the family's. The bar action is Start class.

### Teacher (a school's class)

- **Today is the live session's cockpit (#2465).** Its top is the session control: at rest Start class with its length and the requests strip ("Needs you", one line); while a session runs, the cockpit (clock and Stop, the totals, requests, every student live, needs-you first, rows that never reorder by themselves). The feed and the week stay below it. Stop asks, then opens the session's report, a page of its own under Time (`sessions/<session>`): the headline, who to follow up with first, every student, the skills worked on. It prints with Cmd+P. Time lists the class's sessions. A session that ends by its own time stays on screen as it ended, with its report a tap away.
- **The bar's Start class starts the session** and lands on Today; on Today itself the page's control is the action. While a session runs, every other tab's bar shows Live with the clock, back to Today. The projected sign-in board opens from Today's code (Full screen); the cockpit is private, the board public.
- **Today's feed:** as in the product shots. Each item is an action with its reason:
  - a group stuck on a skill (Teach this lesson, or Print a group sheet);
  - a student to sit with;
  - students behind the week's target;
  - students ready for more;
  - a good day.

  It ends with a compact This week line. Map is its own tab, so Today has no class map. The class name is the title, with the date under it, and there's no greeting by name.

- **Map:** a wide matrix with one row per student, one area at a time, in a K–12 band. A student opens inside the class (`map/<student>`).
- **Grades, Time:** full-width tables, with the gradebook as the reference.
- **Students:** the roster, sign-in cards, and adding a student.
- **Settings:** the class code, grading periods, and the weekly target. It also holds this class's student experience, where the school leaves it open, and a link to the school's Settings.
- **A demo class** says "Demo" once in the bar, and its bar action is "Set up your real class". It never offers an action a demo refuses.

### School admin (School)

- **Overview:** the school by name, the week in a sentence, seats, the trend beside what needs attention, and where students stand beside the counts. Then every class with its use.
- **Classes:** the classes table, with sub-tabs Classes · Students · Import.
- **Staff:** the staff table, with sub-tabs Staff · Sign-in help.
- **Activity:** the log.
- **Settings:** one page with School year and terms, Student experience and License, plus Privacy and data and Integrations as its sub-pages.
- **Setup** (`/school/new`) is a guided flow and never an empty screen. A lone teacher's school ("Just my class") collapses to the class. Its school Settings hold the license and privacy.

## Layout

### Widths

| Content                                                      | Width                                                                                     |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Reading text: lessons, explanations, account settings, forms | a 68-character measure (max 720 px); forms use `--width-form` (480 px)                    |
| Dashboards, tables, maps, charts                             | the content width, `--width-content-wide` (1120 px), with 24 px gutters (16 px on phones) |
| The class map, gradebook and time grid                       | can use the full viewport less the gutters once the table needs it                        |
| Practice                                                     | full screen, edge to edge, no card around the problem                                     |

**A single-column page is centred in the viewport:** /me, the account pages, a reading page, a settings form, a lesson. A dashboard or table that uses the content width starts at the content column's left edge. Within a place, every page's title sits at the top of its own column, so moving between tabs never shifts the title vertically.

### Spacing and type

- **Spacing** uses only `--space-1`…`--space-8` (4, 8, 12, 16, 24, 32, 48, 64). The page top is 24 px (32 px from 768 px up). Sections are 32 px apart (24 px on phones), and a heading sits 12 px above its content. List rows are at least 48 px high, and table rows 44 px. Nothing uses a gap above 48 px.
- **Type:**
  - page titles use the serif title token (`--text-heading-1`, 28 px on phones);
  - section headings use the serif `--text-heading-2`;
  - labels and column heads are sans `--text-label` (14 px, semibold, muted);
  - body text is `--text-body`, and tables `--text-table`;
  - nothing is under 12 px. Numbers use `--numeric`.

### Two columns

From 1024 px, a dashboard may use two columns when both carry data of similar weight: main data on the left (2fr), compact facts on the right (1fr). A column with nothing to show is dropped, and its partner takes the width. Below 1024 px there is one column.

### Controls

- **Buttons are their natural width.** A full-width button appears only on phones for the single primary action at the bottom of a first-run step or the practice answer bar.
- **One primary button per screen.** Other actions are secondary (outline) or quiet (text). Rare actions go in an overflow menu or in Settings.
- **Headers are compact: the title alone.** Secondary actions live in the place's tabs, the drawer or one overflow menu. A header never grows a second row of links on a phone.
- **No Print buttons for screen reports.** A record, a progress report or a gradebook prints with Cmd+P through a print stylesheet that sets a title, the period, the person and white paper. Lessons, workbooks and report cards are real documents, so they download as TeX PDFs.
- **Designed controls only:** segmented pickers, steppers, `Listbox` and `Menu`. Never a raw select. Code entry (a class code, a workbook code) is one designed field with its button inside or beside it, sized to the code, not the page.
- **Rows and names never underline on hover.** A row that opens something gets a refined hover: a quiet surface tint across the whole row and the pointer. Text links in running prose may underline.
- **A builder or a form for a secondary task opens in a sheet or dialog** over the screen it belongs to, with Back and Escape returning there. The workbook builder is an example.

### Empty states and first run

- **A whole screen with nothing yet** is the day-0 hero (rule 7): the one visual that will fill with data, centred and large, one sentence, the one action that fills it, and quiet secondary items. It is never lorem or boilerplate.
- **A section with nothing yet** is absent, or one line ("No practice this week").
- **A new place begins with guided setup**, never empty templates: a family asks for the children, a class for its roster, a school goes through setup.

### Errors, waits, printing

- Errors follow `AGENTS.md`: inline beside their cause, or a fixed toast. The text says what failed and what to do, and it is logged. Never "This request could not be completed".
- Waits use `Loading`, `LoadingScreen` and skeletons the size of the content.
- Lessons, workbooks and report cards are TeX PDFs. A screen report prints with the browser's own print (Cmd+P) through a print stylesheet; there is no Print button.

### Smoothness

The founder: "impeccable smoothness, never a wild flash of state transitions." A screen appears once, whole.

- **One change per navigation.** A link preloads its screen's code and data on intent (hover, focus, touch), and opening the drawer preloads its items' screens. The screen on show stays until the next one can render whole. The wave shows only for a wait longer than a second, so a short one never flashes the page to a loader and back.
- **A route loads its data before it renders.** Its loader ensures the queries the screen reads (`ensureQueryData`), so it paints with its data. Pathways and Inventory load the curriculum and the learner's record and level (`preloadLearningView`); a class's Settings loads every section's data.
- **One placeholder at most.** Where a wait can't be avoided, one stable skeleton the size of the content stands in, then the content. Never a spinner, then a skeleton, then the content. A screen never waits on lists at its foot, which arrive in place.
- **An empty state only after the data has truly come back empty** (`isSuccess` and empty), never while it loads.
- **Coming back is where you left (QA 2026-11-23).** Back and Forward show a screen at the scroll position it was left at (the router's scroll restoration, `app/router.tsx`); a new screen starts at its top; a move that keeps the page (a sheet, an overlay, a toggle) keeps its place. A parent who scrolls down Today, starts a child's practice and returns is back at the same place. On a problem the way home is the menu's "Back to family" (the bar holds only the problem's tools); on the child's other screens it is the bar's family mark. Handed over from the very screen before this one, either goes Back to it, with no fresh load (`features/navigation/DrawerContents.tsx`, `features/practice/StudentSignOut.tsx`); from anywhere else the screen opens afresh, at its top. `scripts/verify-child-practice-ui.ts` asserts it at 390 and 1280.
- **Checked:** `npm run test:smooth-load-ui` loads the main screens cold on a slow phone (4x CPU, slow network, no cache) and fails on more than one change after the boot wave, or any layout shift.

## Element finish (the `/design` gallery first)

Every shared element is taken to its final finish in the gallery (`/design`, `features/design/`) before it is applied to screens. The elements are:

- buttons;
- segmented and stepper pickers (with None or Off where optional);
- the birth-year grid;
- rows and tables;
- page and section headers and sub-tabs;
- sheets and dialogs;
- the level range bars;
- the day-0 hero and section empty lines;
- the Today feed item;
- the year section.

Each has its states (rest, hover, focus, selected, disabled, busy, error) at 390 and 1280 px in light and dark.

## Checklist for a screen

Day 0, day 1 and week 3; 390, 768 and 1280 px; light and dark:

- no own name;
- no avatar;
- no card wrapper;
- no empty section;
- no full-width desktop button;
- one primary action;
- titles serif and aligned to the left edge;
- copy that describes rather than sells;
- every number agrees with its noun.
