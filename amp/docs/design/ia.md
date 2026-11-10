# AMP screens: places, tabs and layout

The rules every AMP screen follows, decided 2026-11-10 for the design pass. [The product model](../product-model.md) says who sees what; this file says where it goes and how it looks. Where they disagree, this file wins for layout and the product model wins for permissions.

**The references for look, type, spacing and density** are the `/schools` product shots in `src/web/features/schools/screens/*.webp`: today, map, gradebook, board, cards, evidence, standings, school-overview, district-overview and stack. Compare every screen against them. Also use the pre-refactor trial (best guess, a narrowing likely range, per-area bars with uncertainty) and Inventory, which shows how a dashboard should fill the width with purpose.

## Five rules before anything else

1. **First impressions.** A section without meaningful data doesn't render, or collapses to one compact line. No chart with one bar, no "None yet this year" section, no two-column dashboard with an empty column. Every screen must look intentional on day 0, day 1 and week 3 (the seeded personas cover all three).
2. **Never name the person to themselves.** A person's own pages never show their own name: no "Good afternoon, Tess Harlow", no name heading on /me, no "Mara Quill · Skills grow…" on Pathways. Titles name the content or the place. Names appear only for other people: children, students, staff.
3. **Avatars only where they help find someone else.** Never for the person themselves, never in navigation, account pages, /me or staff lists. Initials may stay where they help scan other people: a Today item's group of students, and student rows in the map and gradebook, as in the product shots. A child's chosen sign-in picture appears where the child or teacher uses it to find them (sign-in, the code board, cards).
4. **No card wrappers on app screens.** Sections are separated by space and a heading, rows by a hairline. Raised surfaces are only for things that float or are touched as objects: sheets, menus, dialogs, toasts, the practice answer area, paper previews.
5. **Plain words that describe.** Copy inside the app describes; it never sells. "Skills", not "crystals". Number and noun agree ("1 attempt"). Helper text appears only where a control is not obvious, and it is one line.

## Places and navigation

One drawer, one place switcher (`PlaceSwitcher`). A person may hold several places. The bar shows the place's tabs and one primary action. Everything rare lives in Settings, a row's overflow menu, or the drawer, never on the place's first tab.

- **The place switcher holds places only:** My practice, each family or class, each school, and Add a place. It never lists practice profiles, "Try a level…", children or students. Children and students are reached from their class: the Map and Students tabs, and the drill-in.
- **Practice as someone else** is a page reached from /me (`/me/profiles`). It holds the saved profiles, recently used ones, and "Try a level…". While practicing as a profile, the bar keeps "Back to my own practice".
- **One tab header per place.** Navigating within a place never swaps in another place's tab bar. A family, a tutor or a lone teacher never lands on a school-level page.

| Place | Who | Tabs | Bar action |
|---|---|---|---|
| My practice | an adult learner | Overview · Pathways · Inventory | ▶ Practice |
| Family | a parent, the second parent | Today · Map · Time · Workbooks · People · Settings | ▶ Practice (picks a child) |
| Class (tutor, co-op) | a tutor | Today · Map · Time · Workbooks · People · Settings | Start class |
| Class (school) | a teacher | Today · Map · Grades · Time · Workbooks · Students · Settings | Start class |
| School | an admin | Overview · Classes · Staff · Calendar · License · Privacy · Activity | none |
| Account | everyone, from the drawer | Sign-in · Learners · Billing · Privacy | none |

- **A place with one class opens on that class's Today**, never on a list of one (teacher demo, family, second parent).
- **The roster tab is named by the org's kind:** "People" in a family org (a family or a tutor's class), where it holds children, the second parent and co-teachers. It is "Students" in a school's class.
- **Tabs follow the class's size.** A family or tutor class (6 or fewer learners) has no Grades tab and no Calendar tab. Grades are a line in each learner's Map panel, and the weekly target is set in Settings with its progress on Today. A teacher's class keeps Grades.
- **Calendar:** for a family, a tutor or a lone class, the school year's dates and the term type are one compact section of the class's Settings. There is no Calendar tab and no school-level page. A school with staff keeps its Calendar tab, in the same frame and density as every other screen: a designed year view, without the vast empty space.
- **Opening a student never leaves the class.** From a class, a student opens inside it (the Map's drill-in route), and the class tabs stay. The school-level student page (`/school/<org>/students/<id>`) is only for an admin who came from the school.
- **Account tabs follow the account:** an adult with no child sees "Your practice", not "Who's learning?" with "Add a child"; Privacy says "your data", and Learning consent appears only once a child exists. The tab label and the page title are the same words.

## Each person

### Solo adult (My practice)

- **First run:** "Myself" → where to begin → straight into practice. They never land on an empty Overview.
- **Overview (`/me`)**, in order:
  1. Where you are: the overall best guess and likely range, then one row per area with its uncertainty bar (the trial's level view). On day 0 this is the only section: a range that is wide on purpose, plus Practice.
  2. This week: minutes and days as one compact line with a 12-week strip once there are two or more weeks.
  3. Objectives gained, newest first, kept once earned.
  4. Recent work.
- **Secondary:** Workbooks and Print report sit as quiet actions on the title row. "Practice as someone else" is in the drawer under My practice.
- **Pathways and Inventory:** full width. Inventory filters update their counts.

### Parent (Family)

- **First run:** "Parent" → the children's names (parent-entered nicknames) and birth years → the first child's first problem on this device. Consent and access are steps in that flow, never a separate page.
- **Today** is the same feed component as a teacher's Today (below), led by the children:
  1. One row per child: name, this week (minutes, problems, last practiced), and the one action that works now ("Let Pip practice here", or "Continue with AMP" when the free problems are used). No access dates on Today; they go to Billing.
  2. Needs attention, when there is something (a skill missed three times, no practice in a week). Absent otherwise.
  3. This week's work across the family, once there is any.
- **People:** the children, the second parent, co-teachers, children from other families, and their invitations. None of these are on Today.
- **Map** shows the whole family on one K–12 axis, each child at their own level.

### Tutor (Class)

As the family, with Start class (the code and QR board) as the bar action. Today leads with who practiced today and who needs attention. Students from other families waiting for a parent's approval appear as one line on Today ("2 waiting for a parent") linking to Students.

### Teacher (Class)

- **Today** is a feed of actions, each with its reason: a group stuck on a skill (Teach this lesson / Print a group sheet), a student to sit with, students behind the week's target, students ready for more, a good day. It ends with a compact This week line. It has no class map, because Map is its own tab. The class name is the title, with the date under it. There is no greeting by name.
- **Map** adapts to the class's size. A small class (a family, a tutor) gets one full-width panel per learner on a K–12 axis. A large class gets a wide matrix with one row per student and one column per area.
- **Map, Grades, Time:** full-width tables and charts (the gradebook is the reference).
- **Students:** the roster, sign-in cards and student experience.
- **Settings:** class settings and the calendar.
- A demo class says "Demo" once in the bar, and its bar action is "Set up your real class". It never offers an action a demo refuses, such as Add class or Add student.

### School admin (School)

The Overview is a dashboard across classes: the active share, minutes, and classes needing attention, at full width. Classes, Staff and the rest are tables. Setup is a guided flow (`/school/new`) and never an empty screen.

## Layout

### Widths

| Content | Width |
|---|---|
| Reading text: lessons, explanations, account settings, forms | a 68-character measure (max 720 px); forms use `--width-form` (480 px) |
| Dashboards, tables, maps, charts | the content width, `--width-content-wide` (1120 px), with 24 px gutters (16 px on phones) |
| The class map, gradebook and time grid | can use the full viewport less the gutters once the table needs it |
| Practice | full screen, edge to edge, no card around the problem |

Every screen in a place shares one left edge: the page title, the first section and the tab row's content line up. A narrow screen (reading, a form) aligns left to that edge on desktop, not centred in a sea of space. The exceptions are the one-step flows on `PageFrame` (sign-in, the starter), which stay centred.

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
- **Designed controls only:** segmented pickers, steppers, `Listbox` and `Menu`. Never a raw select. Code entry (a class code, a workbook code) is one designed field with its button inside or beside it, sized to the code, not the page.
- **Rows and names never underline on hover.** A row that opens something gets a refined hover: a quiet surface tint across the whole row and the pointer. Text links in running prose may underline.
- **A builder or a form for a secondary task opens in a sheet or dialog** over the screen it belongs to, with Back and Escape returning there. The workbook builder is an example.

### Empty states and first run

- **A whole screen with nothing yet** shows what will be there (a real preview drawn quietly from the layout, never lorem or boilerplate), one sentence, and the one action that fills it.
- **A section with nothing yet** is absent, or one line ("No practice this week").
- **A new place begins with guided setup**, never empty templates: a family asks for the children, a class for its roster, a school goes through setup.

### Errors, waits, printing

- Errors follow `AGENTS.md`: inline beside their cause, or a fixed toast. The text says what failed and what to do, and it is logged. Never "This request could not be completed".
- Waits use `Loading`, `LoadingScreen` and skeletons the size of the content.
- Anything printable (lessons, workbooks, progress reports, report cards) is a TeX PDF. Never `window.print()` of a screen.

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
