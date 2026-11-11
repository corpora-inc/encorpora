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

- **The place switcher holds places only:** My practice, each family or class, each school, and Add a place. It never lists practice profiles, "Try a level…", children or students. Children and students are reached from their class: the Map and Students tabs, and the drill-in.
- **Workbooks, for an adult's own practice,** is an item of the drawer directly under Practice: a workbook is a way to practise (on paper, at your level), not a view of progress. Its pages are a place of their own: the plain bar, no Progress tabs, the drawer item current. A family's and a class's Workbooks stay their tab.
- **Practice as someone else** is a page (`/me/profiles`) reached from the drawer under My practice. It holds the saved profiles, recently used ones, and "Try a level…". While practicing as a profile, the bar keeps "Back to my own practice".
- **One tab header per place.** Navigating within a place never swaps in another place's tab bar. A family, a tutor or a lone teacher never lands on a school-level page.

| Place | Who | Tabs | Bar action |
|---|---|---|---|
| My practice | an adult learner | Overview · Pathways · Inventory | ▶ Practice |
| Family | a parent, the second parent | Today · Map · Time · Workbooks · People · Settings | ▶ Practice (picks a child) |
| Class (tutor, co-op) | a tutor | Today · Map · Time · Workbooks · People · Settings | Start class |
| Class (school) | a teacher | Today · Map · Grades · Time · Workbooks · Students · Settings | Start class |
| School | an admin | Overview · Classes · Staff · Activity · Settings | none |
| Account | everyone, from the drawer | Sign-in · Learners · Billing · Privacy | none |

- **A place with one class opens on that class's Today**, never on a list of one (teacher demo, family, second parent).
- **The roster tab is named by the org's kind:** "People" in a family org (a family or a tutor's class), where it holds children, the second parent and co-teachers. It is "Students" in a school's class.
- **Tabs follow the class's size.** A family or tutor class (6 or fewer learners) has no Grades tab and no Calendar tab. Grades are a line in each learner's Map panel, and the weekly target is set in Settings with its progress on Today. A teacher's class keeps Grades.
- **Calendar is configuration, not a place.** No place has a Calendar tab. A school's year and terms are a section of its Settings. A family's, a tutor's or a lone class's year is one compact section of the class's Settings.
- **Opening a student never leaves the class.** From a class, a student opens inside it (the Map's drill-in route), and the class tabs stay. The school-level student page (`/school/<org>/students/<id>`) is only for an admin who came from the school.
- **Account tabs follow the account:** an adult with no child sees "Your practice", not "Who's learning?" with "Add a child"; Privacy says "your data", and Learning consent appears only once a child exists. The tab label and the page title are the same words.

## Where settings live

Every setting lives in exactly one place, chosen by its scope: school (or district), then class, then learner, then account, then device. A screen at a lower scope links to the scope above for what it inherits, and never repeats that setting. A school can lock a setting for everyone below; the class shows it as locked and who set it.

**One home per scope.** For a school or district, that is the Settings tab. For a class, it is the class's Settings tab. For a learner, it is Account → Learners. For the account, it is the Account tabs. For a device, it is the drawer.

| Setting | Scope | Its one home | Elsewhere, only a link |
|---|---|---|---|
| School year dates and terms (None · Semesters · Trimesters · Quarters) | school | School Settings → School year and terms | a class's Settings links to the school's |
| The same, for a family, a tutor or a lone class | class | Class Settings → School year | — |
| Grading periods a class grades by (Full year · Semesters · Trimesters · Quarters) | class | Class Settings | — |
| Student experience: levels shown, standings, what a board counts, devices | school default, class override | School Settings → Student experience; Class Settings → Student experience, for what the school leaves open | — |
| Weekly practice target | class | Class Settings | its progress shows on Today and Time |
| License and seats | school | School Settings → License | the Overview's seat line |
| Data agreement, what AMP collects, export, deletion | school | School Settings → Privacy and data | — |
| Google and Microsoft sign-in, rostering | school | School Settings → Integrations | Staff → Sign-in help |
| Staff and their roles | school | Staff | — |
| Class code and join link | class | Class Settings | the Start class board shows it |
| Roster and sign-in cards | class | Students (school class) or People (family org) | — |
| Second parent, co-teachers, other families' children | family org | People | — |
| A learner's name, birth year, SAT focus, deletion | learner | Account → Learners | — |
| Plan, renewal, receipts | account | Account → Billing | the allowance pause and Continue lead there |
| Sign-in methods and passkeys | account | Account → Sign-in | — |
| Consent and the account's own data | account | Account → Privacy | — |
| Practice profiles | adult | Practice as someone else (`/me/profiles`) | the drawer, under My practice |
| An adult's own workbooks | adult | Workbooks (`/learners/<own>/workbooks`), its own place | the drawer, directly under Practice |
| A child's workbooks | family or class | the place's Workbooks tab | — |
| Show grade numbers, sound, haptics | device | the drawer | — |

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
- **Lessons** are not a destination of their own. They are reached from Pathways (skill nodes and the skill panel), from practice (Lesson in the feedback) and from Pathways' search. The `/lessons/<id>` reader stays for links. `/lessons` alone opens Pathways, carrying any `?q=` into its search.
- **Pathways' search is the one search:** skills, lessons and glossary terms, grouped (the semantic search).
- **The drawer, for an adult:** Practice · Workbooks (a book icon) · Progress (Overview · Pathways · Inventory) · Practice as someone else (its own icon) · Account. Exactly one item is current. There is no Lessons item.
- **Practice as someone else (`/me/profiles`):** saved profiles, recent ones, and "Try a level…", reached from the drawer. It is never in the place switcher.
- **Account:** Learners lists "Your practice" first. Billing shows the free problems left or the plan.

### Parent (Family)

- **First run:** "Parent" → each child's name (a parent-entered nickname) and birth year → the first child's first problem on this device. Consent and access are steps inside that flow, never a separate page.
- **Today, day 0:** a centred hero. Each child's name is shown with "Let Pip practice here" as the one prominent action, and the class code sits quietly below for a child's own device.
- **Today, with data:** the Today feed, led by the children.
  - First, one row per child: name, this week (minutes, problems, last practiced), and the one action that works now, "Let Pip practice here" or, when the free problems are used, "Continue with AMP". Access dates belong in Billing, not on Today.
  - Then feed items when there is something to act on: a skill missed three times, no practice in a week, ready for more, the weekly target.
  - Then a compact This week line.
- **Map:** one full-width panel per child on one K–12 axis, each child at their own level, with a grade line in each panel. A child opens inside the class.
- **Time, Workbooks:** per child. The workbook builder opens in a sheet.
- **People:** the children, the second parent, co-teachers, children from other families, and their invitations. None of these are on Today.
- **Settings:** the class code (the Join element), the school year with None · Semesters · Trimesters · Quarters, the weekly target, and what children see (levels, standings, devices).
- **The second parent** sees the same Family screens. She sees no buying, consent, naming or deletion.

### Tutor (a family org's class of students from other families)

- **First run:** "Tutor or co-op" → how many students and their birth years → the code board, with a link for each family to approve.
- **Today, day 0:** a centred hero with the code board's code, "Each student signs in with the code and their pictures", and Start class.
- **Today, with data:** the Today feed for a small class. Who practiced today comes first, then who needs attention. Students waiting for a parent's approval appear as one line ("2 waiting for a parent"), linking to People.
- **Map, Time, Workbooks, People, Settings:** as the family's. The bar action is Start class.

### Teacher (a school's class)

- **Today:** the Today feed, as in the product shots. Each item is an action with its reason:
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

| Content | Width |
|---|---|
| Reading text: lessons, explanations, account settings, forms | a 68-character measure (max 720 px); forms use `--width-form` (480 px) |
| Dashboards, tables, maps, charts | the content width, `--width-content-wide` (1120 px), with 24 px gutters (16 px on phones) |
| The class map, gradebook and time grid | can use the full viewport less the gutters once the table needs it |
| Practice | full screen, edge to edge, no card around the problem |

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
