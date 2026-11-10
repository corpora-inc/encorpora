# AMP web components: inventory and finish

Every component in `amp/src/web` that draws a visible piece of the product:
where it lives, who uses it, whether it is properly modular, and how finished
it looks today. The design pass works from this list. The gallery at `/design`
draws the shared ones in their states (see [The gallery](#the-gallery)).

Paths are relative to `amp/src/web/`. "Users" counts the files that render the
component, outside tests and the gallery.

**Modular** means all four of these hold:

- self-contained, with one job;
- plain props: no fetching, no global store, no router state inside;
- styles colocated in its own CSS module;
- no copy-paste twin elsewhere.

When a component isn't modular, the column names what fails.

**Finish**, judged in the gallery at 390 and 1280 px, light and dark:

- **A**: premium now; leave it alone except to share it more widely.
- **B**: sound, but needs finish (spacing, an edge case, a missing state).
- **C**: looks unfinished, or is the kind of thing the founder has flagged.
- **?**: not judged yet, because the gallery can't draw it without a fixture
  it doesn't have.

## What to fix first

1. **Practice is one 2,131-line component.** `PracticeWorkspace.tsx` draws the
   stage, the answer dock and keypad, the choice forms, the feedback sheet, the
   hint and lesson panels, the calculator and the report flag inline. Its
   layout follows `matchMedia` and a class on `<html>`, and its styles live in
   four global sheets. Nothing in it can be polished on its own. Split it into
   `ProblemStage`, `AnswerDock`, `ChoiceAnswer`, `FeedbackSheet` and
   `PracticeBar` (see [Practice](#practice)).
2. **The level view is drawn four ways.** These are `LevelTrack`
   (`ui/LevelChart.tsx`), `FrontierMap`'s own track markup (`Home.tsx` and
   `theme.css`), `RecordLevels` (`features/school/classes/ProgressRecord.tsx`),
   and a copy of `RecordLevels` inside `features/schools/ParentScreen.tsx`. The
   new `ui/level-range/` should replace all of them, not become a fifth.
3. **The workbook surfaces are grade C.** `WorkbookEntry` is a card with
   full-width stacked buttons. `WorkbookList` has no empty state, shows raw
   error text, and leaves a blank row above the list. The builder
   (`WorkbookDayScreen`) is a 590-line form of full-width controls.
4. **Every screen invents its own empty and error lines.** `EmptyState` is in
   31 files, but about 30 more draw a "quiet" line of their own. `DataGrid` and
   `WorkbookList` draw nothing at all when empty. There are 47 files with an
   inline `role="alert"`, beside `Toast` and `FormNote`.
5. **There are four modal surfaces with three close buttons.** They are
   `Sheet`, `Dialog`, `FocusDialog` (a native `<dialog>` exported from
   `PracticeWorkspace.tsx`) and the option sheet inside `Select`, plus
   `TermCard`'s own dialog.
6. **Legacy element rules leak into new components.** `style.css` and
   `theme.css` style bare `header` (105 px tall, flex), `nav` (bottom border,
   34 px margin), `h1` (76 px), `h2`, `li` and `button`. Any new component that
   uses those elements inherits them. The gallery hit both the `header` and
   `nav` rules. New components should set their own values or avoid the bare
   elements until the legacy cascade is retired.

## Duplicates and one-offs to unify

| What | Where now | Becomes |
|---|---|---|
| Level track (band, dot, age tick) | `ui/LevelChart.tsx` `LevelTrack`; `Home.tsx` `FrontierMap` (`frontier-track`, `frontier-range`, `frontier-dot` in `theme.css`) | one track in `ui/level-range/` |
| Level rows by strand | `ProgressRecord.tsx` `RecordLevels`; `features/schools/ParentScreen.tsx` (same `row()` code, own CSS); `FrontierMap` rows | one `LevelRows` with an optional key line |
| Single-choice radio rows | `ui/Segmented.tsx`; hand-rolled in `features/profiles/GradePicker.tsx`, `features/school/SetupScreen.tsx` (experience cards), `features/school/classroom/WorkbookStackScreen.tsx` (day picker), `features/workbooks/WorkbookResultsScreen.tsx` (mark picker) | `Segmented`, adding a card variant if the cards need one |
| Grade picker | `features/profiles/GradePicker.tsx` (radio row) and `features/school/parts.tsx` `GradePicker` (a `Select`): one name, two controls | one `GradePicker` in `ui/` |
| Modal surfaces | `ui/Sheet.tsx`, `ui/Dialog.tsx`, `FocusDialog` in `PracticeWorkspace.tsx` (used by 6 files), `ui/Select.tsx`'s own Radix dialog, `ui/TermCard.tsx`'s `<dialog>` | `Sheet` for side detail and `Dialog` for reading, with one header and one close button |
| Page frames | `ui/PageFrame.tsx`, `app/AppShell.tsx`, `features/school/SchoolFrame.tsx`, `OrgFrame.tsx`, `classes/ClassFrame.tsx`, `join/JoinFrame.tsx`, `features/schools/PublicFrame.tsx`, `features/workbooks/WorkbookFrame.tsx`, `features/me/OwnRecordScreen.tsx` `OwnPage` | the app frame plus one content-width container (`docs/design/ia.md`) |
| Drawers | `features/navigation/NavigationDrawer.tsx` (legacy, on `PageFrame`, `LegacyApp`, Standings, Pathways) and `ShellDrawer.tsx`, both on `ui/NavigationSheet.tsx` | `ShellDrawer` only |
| Empty lines | `ui/EmptyState.tsx` (31 files) beside about 30 ad hoc `styles.quiet`, `quietLine`, `empty` and `none` lines | `EmptyState`, with a compact inline size for a section |
| Load failure | `LoadFailed` (`classes/teacher-shared.tsx`, a wrapper on `EmptyState`), `OwnRecordScreen`'s own `EmptyState`, and `WorkbookList`'s inline message and retry link | `LoadFailed`, moved to `ui/` |
| Inline errors | `ui/Toast.tsx` (36 files), `FormNote` (`features/school/parts.tsx`, 11 files), the `TextField` error row, and inline `role="alert"` paragraphs in 47 files | the standard's one pattern: an inline message at the field, or a `Toast` |
| Bar charts | `RecordWeeks` and `TimeDetail` repeat one day-column chart (`dayChart` in `Teacher.module.css`); `TrendChart` (`features/school/org/charts.tsx`) is a third with axes | one `BarChart` with optional axes |
| Copy to clipboard | `CopyButton` (`features/school/parts.tsx`, 5 files); its own logic in `features/support/ContactAddress.tsx` and `features/funding/InvoiceForm.tsx` | `CopyButton` in `ui/` |
| "Talk to us" | `features/schools/TalkToUs.tsx` and `TalkToUsButton` in `features/continue/AllowancePause.tsx` | one |
| Shared module | `ui/Controls.module.css` styles `Button`, `TextField`, `TextArea`, `Select`'s overlay and the field error row | one module each |
| Dead alias | `ui/YearPicker.tsx` re-exports `BirthYearPicker` and has no users | delete it |
| Same names, different things | `ContinueScreen` in `features/continue/` and in `features/school/join/`; `GradePicker` (above) | rename one of each |

## Shared primitives (`ui/`)

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `Button`, `buttonClass` | `ui/Button.tsx` | 86 | Mostly: the busy wave is in global `ui/loading.css`, and it shares `Controls.module.css` | **B**: three solid variants at 44 px with a clear focus ring. It has no width or size API, so callers stretch it full-width (the founder's "wide-ass buttons"), and disabled is a washed-out 55% opacity. |
| `Segmented` | `ui/Segmented.tsx` | 16 | Yes | **A**: equal segments, roving focus, a badge row reserved so nothing moves. Four short names in a compact row crowd at 390 px; the two-row rule starts only above 32 characters. |
| `Stepper` | `ui/Stepper.tsx` | 5 | Yes | **A**: holds its width at every value and reads inert at its limits. |
| `Chips` | `ui/Chips.tsx` | 3 | Yes | **B**: clear on and off states. The check-in-a-ring mark is heavy beside the label, and disabled checked chips lose contrast. |
| `Checkbox`, `CheckboxControl` | `ui/Checkbox.tsx` | 16 | No: global `ui/Checkbox.css`, loaded through `style.css` | **B**: a good control, but the row is a bordered card, heavy when several are stacked; the disabled box is dashed. |
| `TextField`, `TextArea` | `ui/TextField.tsx` | 23 | Shares `Controls.module.css` | **B**: the error row is reserved, so nothing shifts. The label is an unstyled `span` with no token, and the field has no focus treatment beyond the legacy outline. |
| `SearchField` | `ui/SearchField.tsx` | 3 | Yes | **A**: the clear button and Escape never move the text. |
| `Select`, `BirthYearPicker` | `ui/Select.tsx` | 15 | No: global `premium-select` and `premium-options` classes, and its own Radix dialog | **B**: a designed trigger and option sheet. It has no visible label, unlike `DatePicker` and `TextField`. |
| `Listbox`, `ListboxDisclosure`, `ChoicePicker` | `ui/Listbox.tsx` | 4 | Yes | **B**: good two-line options. It is a third single-choice look beside `Select` and `Segmented`. |
| `Menu`, `MenuItem`, `MenuLabel` | `ui/Menu.tsx` | 6 | Yes | **B**: correct behaviour; the trigger is a bordered button that reads as a form field. |
| `DatePicker` | `ui/DatePicker.tsx` | 4 | Yes | **B**: a labelled trigger with a reserved error line. Not reviewed open yet. |
| `DataGrid` | `ui/DataGrid.tsx` | 10 | Yes | **B**: real sort buttons and keyboard walking; below 640 px rows become labelled cards. With no rows it draws only its header, or as cards only the sort control: no empty state. |
| `LevelTrack`, `LevelBand`, `LevelAxis`, `LevelTrend` | `ui/LevelChart.tsx` | 4 (`LevelTrend`: none) | Yes | **B**: band, dot and age tick read well. A dot at either end of the scale hangs half off the track, the axis hides its centre label when the track is narrow, and `LevelTrend` is unused since the trial screens went (#2110). |
| `LevelReadout` | `ui/LevelReadout.tsx` | 1 (`Home.tsx`) | No: reads the curriculum-details context and draws nothing when grade numbers are hidden | **B**: clear figures, but the scale line ("K = 0 · Grades 1–8 …") is explanation text. |
| `Meter` | `ui/Meter.tsx` | 3 | Yes | **A**: one hue, length carries the value, tabular numbers. |
| `StatRow`, `StatTile` | `ui/StatTile.tsx` | 6 | Yes | **B**: quiet figures. Spacing comes from the caller; in `TimeDetail` the row runs into the next heading. |
| `Badge` | `ui/Badge.tsx` | 13 | Yes | **A**: words first, colour repeats them. |
| `Avatar`, `AvatarStack` | `ui/Avatar.tsx` | 16 | Yes | **C**: well built, but the founder: "avatar is useless". It is the "little SS avatar next to the huge name" on `/me`. Drop it from one's own pages; keep it, if at all, in lists of other people. |
| `EmptyState` | `ui/EmptyState.tsx` | 31 | Yes | **B**: title, line and next step. The 48 px block padding and serif title are too big inside a section, which is why screens draw their own lines instead. |
| `Toast` | `ui/Toast.tsx` | 36 | Yes | **A**: fixed over the content, errors stay, confirmations close themselves. |
| `Sheet` | `ui/Sheet.tsx` | 19 | Yes | **A**: from the side on wide screens and the bottom on phones; focus returns. |
| `Dialog` | `ui/Dialog.tsx` | 9 | Yes | **B**: a different header and a "×" glyph close where `Sheet` draws an icon. |
| `NavigationSheet` | `ui/NavigationSheet.tsx` | 2 | Yes | **B**: hosts two different drawers (see duplicates). |
| `Tabs` | `ui/Tabs.tsx` | 1 (`app/AppShell.tsx`) | Router links (by design) | **A**: one geometry for every state; the strip scrolls, never the page. |
| `Loading`, `Wave` | `ui/Loading.tsx` | 39 | No: global `ui/loading.css` | **A**: one wait treatment, delayed so fast answers never flash it. |
| `LoadingScreen`, `RouteError` | `ui/LoadingScreen.tsx` | 15 | No: global CSS | **A**: the first-paint wave; the error keeps the same frame. |
| `PageFrame`, `FrameBrand` | `ui/PageFrame.tsx` | 11 | No: renders `NavigationDrawer` (session and learner store) and `SupportHelp` | **B**: the sign-in and first-run frame, a separate design from the app frame. |
| `AppLogo`, `WaveMark` | `ui/AppLogo.tsx`, `ui/WaveMark.tsx` | 2, 2 | Yes; `AppLogo` styles live in `AppBar.module.css` | **A** |
| `QrCode` | `ui/QrCode.tsx` | 2 | Yes | **A** |
| `Glossary`, `GlossaryBlock`, `Term`, `TermCard`, `KeyWords` | `ui/Glossary.tsx`, `ui/Term.tsx`, `ui/TermCard.tsx`, `ui/KeyWords.tsx` | 3 | Need a glossary payload from the server; global `ui/glossary.css` | **?**: not in the gallery yet. |

## Feature components that recur

### Practice

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `PracticeWorkspace` (stage, answer dock, keypad, choice forms, feedback sheet, hint and lesson panels, toolbar) | `PracticeWorkspace.tsx` | `app/LegacyApp.tsx` | No. Props only, but one component of 2,131 lines; it follows the viewport with `matchMedia`, sets `practice-open` on `<html>`, writes the shell bar through `useShellTools`, and is styled by global `practice.css`, `feedback-sheet.css`, `practice-tablet.css` and `theme.css` | **B**: the stage and feedback read well in every state the gallery draws. The feedback column, the explanation length and the dock are all tied together and can't be iterated apart. |
| `AnswerFeedback` (skill line, strength bars, Builds on and Leads to) | `features/practice/AnswerFeedback.tsx` | `LegacyApp` | Mostly: progress arrives through a `loadProgress` prop, but it runs its own query and reads the curriculum-details context | **B**: the five strength bars are tiny, and the "+1 XP" chip competes with the skill name. |
| `FocusDialog` | `PracticeWorkspace.tsx` | 6 | Exported from the practice monolith | **C**: a third modal style (a native `<dialog>` with its own heading and a circled close), styled in global `practice.css`. |
| `Calculator` | `Calculator.tsx` | `PracticeWorkspace` | Yes | **?** |
| `ReportProblemButton`, `ReportProblemForm` | `ProblemFlag.tsx`, `ReportProblemSheet.tsx` | `PracticeWorkspace` | Yes; the sheet loads on demand | **?** |
| `ProblemLesson`, `LessonVideo`, `FilmLink` | `ProblemLesson.tsx`, `LessonVideo.tsx`, `features/films/FilmLink.tsx` | practice, `LessonIndex`, `SkillLesson` | Props; the lesson arrives from the server | **?** |
| Answer inputs: `CounterBuilderInput`, `EqualAddendsInput`, `FigureChoiceInput`, `LinePlotBuildInput`, `MultiPartChoiceInput`, `PegBoardInput`, `PointPlotInput`, `ShapeComposerInput`, `StructuredWorkInput`, `TrendLineFitInput`, `UnitSquareMarkingInput` | `*Input.tsx` at the top of `src/web` | `PracticeWorkspace` | Props; each has its own global stylesheet | **?**: each needs a generated problem; the next gallery batch should draw one per kind. |
| Figures (`Figure` and about 25 kinds) and scenes | `*Figure.tsx`, `scene/` | practice, lessons, books | Props | **?** |
| `PracticeControls`, `FeedbackPreferences`, `SatMathFocus`, `StudentSignOut` | `features/practice/` | the drawer and practice | `PracticeControls` and `SatMathFocus` fetch | **?** |

Extraction plan for practice, smallest first: `FeedbackSheet` (result head,
explanation list, `AnswerFeedback` slot, Next), `AnswerDock` (field and
keypad), `ChoiceAnswer` (single and multi-select forms), `ProblemStage`
(prompt, figure, scroll spacer) and `PracticeBar`. Each takes the problem and
the outcome as props; the media queries move into one `usePracticeLayout()`
whose result is a prop, so the gallery can draw every layout at any width.

### Levels

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `FrontierMap` ("Where you are", by strand) | `Home.tsx` | `LegacyApp`, `ChildOverview`, `PathwaysScreen` | No: its track is a copy of `LevelTrack` in global `theme.css`, and it reads the curriculum-details context | **B**: clear, but it draws its own card, and the paragraph of key text explains instead of showing. |
| `Home`, `HomeLevel` | `Home.tsx` | `LegacyApp` | Props, in the legacy cascade | **?** |
| `RecordLevels`, `RecordWeeks`, `RecordObjectives`, `RecordWork`, `TimeDetail` | `features/school/classes/ProgressRecord.tsx` | `/me` (`OwnRecordScreen`), a teacher's `StudentScreen`, `TimeScreen` | Plain props, but styled by the shared `Teacher.module.css`, with the dense element resets from a side-effect import of `SchoolFrame.module.css` | **B**: the level rows are small and quiet next to the old trial's level view the founder preferred. `TimeDetail`'s stats run into its first heading, and the week bars have no values. |
| Parent progress levels | `features/schools/ParentScreen.tsx` | `/p` | A copy of `RecordLevels` | **B** |
| `ClassMap`, `MapKey` | `features/school/classes/ClassMap.tsx` | `TodayScreen`, `MapScreen` | No: sort and lens live in the URL (`useClassSearch`), and names are router links | **B**: one column joins into a course stripe, a strong idea. The stripe breaks at any row whose name wraps, and a teacher far past the class sits on the scale's end. |
| *(coming)* `LevelRange`, `LevelAxis` | `ui/level-range/` | the `/me` worker | | |

### Rows and tables

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `WorkList` | `features/school/classes/teacher-shared.tsx` | `RecordWork`, `EvidenceSheet` | Yes | **B**: on a phone the prompt is squeezed beside its badge into a tall, narrow column. |
| `TipZone` | `teacher-shared.tsx` | 4 | Yes | **A** |
| `LoadFailed` | `teacher-shared.tsx` | 3 | Yes (wraps `EmptyState`) | **B** |
| Family learner rows | inline in `FamilyCenter.tsx` (1,208 lines, 25 raw `<button>`s) | `/family` | No: inline in a page, with 4 queries | **C** |
| `FamilyPanel`, `OtherFamilies`, `CoTeachers` | `features/school/classes/` | the family class's Today | No: each fetches | **?**: the family-class worker is replacing these rows and adding `ui/SortHeader`. |
| Students, staff and classes rows | inline column definitions in `features/school/StudentsScreen.tsx`, `StaffScreen.tsx`, `ClassesScreen.tsx`, `classes/RosterScreen.tsx`, `classes/GradebookScreen.tsx` | school | Inline in screens that fetch | **?** |

### Workbooks

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `WorkbookEntry` (the workbook card) | `features/workbooks/WorkbookEntry.tsx` | `FamilyCenter` | Yes | **C**: a bordered card with full-width stacked buttons on a phone. When the free workbooks are used, "Make a workbook" simply disappears, with nothing to say why or what comes next. |
| `WorkbookList` (past workbooks) | `features/workbooks/WorkbookList.tsx` | `WorkbookHistoryScreen`, `WorkbookDayScreen` | No: takes a `session` and a `UseQueryResult` and downloads by itself; it should take rows and `onDownload` | **C**: no empty state, raw error text ("Network error") beside a retry link, a blank reserved row above the list, and dates that wrap after the "·". |
| `WorkbookFrame` | `features/workbooks/WorkbookFrame.tsx` | 3 workbook screens | Renders `AllowancePause` (fetches) | **C**: no link back to where the parent came from (the founder: "How do I even get back to where I was?"), and its own notice blocks for errors and gates. |
| Workbook builder | `features/workbooks/WorkbookDayScreen.tsx` (590 lines, 13 fetch hooks) | `/learners/<id>/workbooks/<date>` | No | **C**: every control full width; the founder asks for a sheet or drawer instead of a giant form. |
| Results picker | inline radiogroup in `WorkbookResultsScreen.tsx` | results | No: a hand-rolled `Segmented` | **?** |

### Frames, navigation and status

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `AppShell`, `ShellBar` | `app/AppShell.tsx` | root | No: session, `/me`, learner store, shell slots | **?**: see the app itself. |
| `ShellDrawer`, `DrawerContents`, `PlaceSwitcher` | `features/navigation/` | `AppShell` | No: stores and queries | **?** |
| `NavigationDrawer` (legacy) | `features/navigation/NavigationDrawer.tsx` | `PageFrame`, `LegacyApp`, Standings, Pathways | No | **?**: a duplicate of `ShellDrawer`. |
| `ProfileMark`, `ProfileBackAction` | `features/profiles/ProfileBar.tsx` | `AppShell` | Yes | **?** |
| `DemoMark` | `features/school/demo/DemoMark.tsx` | `AppShell`, `PlaceSwitcher` | Yes | **?** |
| `AllowancePause` | `features/continue/AllowancePause.tsx` | 7 | No: fetches | **?** |
| `PageHead`, `FormNote`, `CopyButton` | `features/school/parts.tsx` | 14, 11 and 5 | Yes; shared `School.module.css` | **B**: borrowed outside the school (second parent, sharing) from a school module; belongs in `ui/`. |
| `ContactAddress`, `SupportHelp`, `SiteFooter` | `features/support/` | footer, frames | `SupportHelp` fetches | `ContactAddress` **B**; others **?** |

### First run, billing and sign-in

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `Progress` (step dots) | `features/onboarding/Progress.tsx` | 3 steps | Yes | **B** |
| `PlanChoice` | `features/billing/PlanChoice.tsx` | `AnnualPurchase`, `BuyOptions` | Yes | **A**: a `Segmented` with price and saving, with the extra-child line kept after it. |
| `PlanOptions` | `PlanOptions.tsx` | `AnnualPurchase`, `ChooseHowToPay` | Props | **?** |
| `ProviderButtons` | `features/auth/ProviderButtons.tsx` | sign-in, join, integrations | Yes | **B** |
| `CodeTiles`, `Picture` | `features/school/join/` | join, start class, roster | Yes | **B** |
| `Starter` role choices | inline in `features/onboarding/Starter.tsx` (588 lines) | `/start` | No: inline in a screen that fetches | **?**: the starter worker owns it. |
| Pitch sections | `features/pitch/PitchScreen.tsx`, `BuyOptions.tsx` (fetches), `PitchVideo.tsx` | `/` | Inline in the screen | **?** |
| Public school parts | `features/schools/PublicFrame.tsx`, `ProductShot.tsx`, `CurriculumRibbon.tsx`, `TalkToUs.tsx`, `ShareWithFamily.tsx` | `/schools`, `/p` | `ShareWithFamily` fetches | **?** |

### School charts

| Component | File | Users | Modular | Finish |
|---|---|---|---|---|
| `TrendChart`, `StandingChart` | `features/school/org/charts.tsx` | `OverviewScreen` | Yes | **B**: clear bars with the current week marked, and a grade band down the middle. The standing chart's axis ticks assume exactly 14 bins. |
| `YearRibbon` | `features/school/YearRibbon.tsx` | Setup, Calendar, Rollover | Yes | **B**: the month letters crowd at 390 px ("A S" collide), and the term list reserves a tall block even for two terms. |

## What can't render in isolation yet

These read the API, a global store or the router, so the gallery can't draw
them from fixtures. Each line says what blocks it and the smallest change that
would let it render.

- `WorkbookList`: a session and a query result. Take `rows`, `pdf` and
  `onDownload`; the screen keeps the query. The gallery draws it now through a
  settled fake query, inert.
- `PracticeWorkspace`: renders from props, but only in a document of its own,
  because it owns the viewport. The gallery frames each state.
- `AnswerFeedback`: queries through its `loadProgress` prop; the gallery passes
  a fixture. Taking the snapshot as a prop would make it plain.
- `FrontierMap`, `LevelReadout`: the curriculum-details context. This PR adds
  `CurriculumDetailsFixture` (`features/curriculum/CurriculumDetails.tsx`), so
  the gallery shows them with grade numbers on and off without touching a
  learner's stored choice.
- `ClassMap`: sort and lens in the URL. Sorting in the gallery rewrites the
  gallery's own address, which is harmless. A `sort` and `onSortChange` prop
  pair would make it plain.
- `PageFrame`, `FrameBrand`: `NavigationDrawer` reads the session and learner
  store. Pass the drawer in as a slot.
- `FamilyPanel`, `OtherFamilies`, `CoTeachers`, `EvidenceSheet`,
  `ShareWithFamily`, `SecondParent`, `ChildOverview`, `AllowancePause`,
  `PlaceSwitcher`, `PracticeControls`, `SatMathFocus`, `BuyOptions`,
  `AfterPurchase`, `SupportHelp`: each fetches. Split each into a view with
  plain props and a container that fetches.
- `AppShell`, `ShellDrawer`, `DrawerContents`: shell and learner stores. Open
  any app screen to see them.
- `Glossary`, `TermCard`, `KeyWords`: need a glossary payload fixture (the next
  batch).
- Every `*Screen`: screens fetch by design. Their recurring pieces are listed
  above.

## The gallery

`/design` (`features/design/`) draws the shared components in their states
from fixtures (`features/design/fixtures.ts`). It calls no API for them and
reads no account. Controls choose the width (Fill, 320, 390, 768, 1280) and
the theme (light, dark). The page frames the canvas (`/design?frame=canvas`)
at that width, so every media query answers to it as on a device; a 1280 px
canvas on a phone is scaled down to fit. Components that own the viewport
(practice, sheets, dialogs, toasts, the loading screen) render in frames of
their own (`/design?frame=specimen&specimen=<id>`). Each section has an
anchor, and the address keeps the width, the theme and the section, so a link
reopens exactly what was shared.

**Gate.** The route exists in production but renders only on a development
server (`import.meta.env.DEV`) or in a browser marked as staff:
`localStorage['amp.analytics.traffic'] = 'internal'`, the marker that already
excludes staff from analytics (`docs/engagement-measurement.md`). Everyone
else is redirected to `/`. It is linked from nowhere, carries
`<meta name="robots" content="noindex, nofollow">`, and nginx sends
`X-Robots-Tag: noindex, nofollow` for `/design`. It shows fixtures only, so
the gate keeps it out of sight rather than guarding data.

**Drawn now:** the practice states (typed, choice, correct, mastered, wrong,
long explanation, choice wrong, skipped, send error), level tracks, bands,
axis, trend and readout, the record parts, the frontier map, the class map,
the data grid, the work list, avatars, buttons, segmented controls, steppers,
chips, checkboxes, listboxes, selects, the date picker, the menu, text fields,
search, empty states, loading, toasts, badges, meters and stat tiles, the
workbook card and list, sheets, dialogs, the focus dialog, the logo, tabs and
QR code, page heads, form notes and copy buttons, both grade pickers, plan
choice, provider buttons, first-run steps, code tiles, the school charts and
the year ribbon.

**Next:** one problem of each answer kind and figure, the glossary cards, the
calculator, the report sheet, and the new `ui/level-range/` and
`ui/SortHeader` once they land. Add a component's section to
`features/design/catalog.tsx` when it is created, and its row here.
