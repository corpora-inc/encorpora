# Practice polish review

Scope: the learner practice workspace (`PracticeWorkspace.tsx`), every
response input, answer feedback (`features/practice/AnswerFeedback.tsx`), the
hint, lesson and explanation dialogs (`FocusDialog`), figures in problems,
skip, and trial practice.

## Method

`scripts/verify-practice-polish-ui.ts` drives the real app (Vite dev server,
synthetic learning API, no database). For every response surface it starts a
topic, opens the hint and the lesson, enters an answer with the learner's own
controls, gets it wrong, gets it right, opens See why, and skips.

Response surfaces (18 cases): typed number (with an array, a scene, and no
figure), fraction, single choice (plain, scene, clocks), multi-select (plain
and with a figure), multi-part cards, inline blanks, slots and table, figure
choice, point plot, and structured work (steps to build, steps to fill, a
two-column proof). Trial practice (`/try/practice`) runs the typed case.

Full audit (`AUDIT_FULL=1`): chromium and webkit; 320×568, 320×720, 390×844,
768×1024, 1024×768 and 1280×800; light and dark; 4,500+ measured states.
Phones run as touch devices.

Each state records:

- horizontal overflow (document and every workspace or dialog element);
- layout shift: every `layout-shift` entry, input-driven or not (chromium),
  plus the boxes of the toolbar, stage, question and dock in every browser;
- targets under 44 px, and controls whose centre is covered;
- truncated text, words broken across lines, text under 12 px, and action
  labels that wrap;
- feedback controls clipped by the sheet, and answers drawn in the problem
  that are hidden under it;
- the primary action (Check, Next) fully on screen;
- untypeset TeX in visible text;
- figure fit and figure label size;
- axe (WCAG 2.1 AA) on the workspace and the lesson dialog;
- keyboard focus order and visibility;
- touch entry never raising the system keyboard.

Every state was also screenshotted and reviewed by eye.

## Measured baseline (main at 035fc054f)

Clean on: horizontal overflow, targets under 44 px, words broken mid-word,
truncation, figure overflow, axe contrast and structure, focus visibility, and
touch keyboard (`inputmode="none"` with AMP's keypad on every phone entry).

Not clean: text under 12 px (900 instances, four elements), See why growing
the sheet upward (CLS 0.17), a first-open lesson shift (CLS 0.017–0.032), and
a WebKit `ResizeObserver loop` page error on the two-column proof. The most
serious problems only showed up in the screenshots, so the verifier now
asserts each of them.

## Verify matrix: before and after

`npm run test:practice-polish-ui` checks 720 states: 8 response surfaces, at
320×568, 390×844, 768×1024 and 1280×800, in light and dark, with the trial
flow included. It fails on any finding above, on any layout shift on a
problem state, on any axe violation and on any invisible focus.

| | main (035fc054f) | this branch |
| --- | ---: | ---: |
| feedback controls clipped by the sheet | 114 | 0 |
| raw TeX in visible text | 92 | 0 |
| text under 12 px | 84 | 0 |
| hint as a full-screen page | 54 | 0 |
| marked answer hidden under the sheet | 24 | 0 |
| action labels wrapping | 10 | 0 |
| primary action off screen | 4 | 0 |
| **total failures** | **382** | **0** |

## Findings, by severity

### High

1. **The feedback sheet cut its own buttons to a sliver.** On short phones
   the progress block shrank with the explanation, leaving Builds on as a
   few pixels of border (320×568: single choice, multi-select and skip).
   **Fixed:** progress keeps its height and only the explanation scrolls.
   Asserted: `clipped-control`.
2. **An answer drawn in the problem was hidden under the sheet.** "The
   answer is circled" showed no circle: on 320×568 the sheet rose above the
   dock, over the plotted grid, the marked blanks and the marked steps, and
   the stage could not scroll them above it. **Fixed:** while the sheet
   overlaps, the stage scrolls that much further (an out-of-flow spacer, so a
   centred problem never moves). An incorrect or skipped answer scrolls the
   marks into view above the sheet. Asserted: `review-hidden`, and zero
   layout shift measured in the stage's scroll space.
3. **Raw TeX in scientific notation.** Givens and the skipped answer read
   `3.6 \times 10^` with the exponent on a separate line. **Fixed:** the
   answer text pairs coefficient and power as one typeset number
   (3.6 × 10⁶), givens set the unit outside math, and entry boxes read
   × 10ⁿ instead of a caret. Asserted: `raw-tex`, and a unit test in
   `tests/structured-work.test.ts`.
4. **Long answers filled the sheet.** Statements, selections and skipped
   work were set at 22 px bold, up to eight lines on a tablet. They pushed
   progress and connections out of view and, for skipped work on a phone,
   pushed Next off screen. **Fixed:** answers over 24 characters use body
   size, skipped work lists one value per line, and a still-long answer
   scrolls inside the head. Asserted: `offscreen-action`, `clipped-control`.

### Medium

5. **A skip marked multi-part answers as misses.** Every blank showed a
    red ✕, against the rule that a skip is neutral. **Fixed:** a skipped
    multi-part choice fills in the worked answer with no marks, and the sheet
    reads "The answer is filled in". Asserted: `skip-miss-mark`.

6. **A two-line hint opened as a full-screen page** on phones and tablets up
   to 840 px, covering the problem it explains. **Fixed:** on those widths
   the hint is a sheet sized to its content, rising from the bottom edge,
   with a lighter, unblurred scrim so the problem stays readable. Asserted:
   `full-screen-hint`.
7. **Check fell below the fold in the compact answer sheet** (320×568,
   a choice with a figure). **Fixed:** Check stays pinned at the bottom of
   the sheet while the figure and options scroll. Asserted:
   `offscreen-action`.
8. **"Try easier" wrapped onto two lines** in the four-tool row after a
   skip at 320 px. **Fixed:** tools never wrap, and the narrowest phones
   tighten the row's gap, padding and type. Asserted: `wrapped-label`.
9. **Hover stuck on touch.** The tool that appears under the finger (Skip
   becomes Try easier, Check becomes Lesson) kept the hover pill. **Fixed:**
   the pill only appears on devices that really hover.
10. **A lesson that failed to open was neither logged nor shown in the error
   pattern.** It appeared as an unstyled paragraph pinned to the bottom of
   the workspace. **Fixed:** the failure is logged and shown in the fixed,
   dismissible toast already used for practice navigation errors.

### Low

11. **Text under 12 px:** choice letters and the answer label were 11 px on
    phones. **Fixed** (12 px and 13 px). Asserted: `tiny-text`.
12. **"You entered" for a chosen statement.** **Fixed:** a chosen statement
    now reads "You chose".
13. **See why grows the sheet upward** (CLS 0.17 when input-driven shifts
    are counted). **Kept.** It is a disclosure the learner asks for, Next
    stays fixed (`verify-answer-feedback-ui.ts`), and the problem does not
    move. The verifier excludes this one state from its shift assertion.
14. **The first lesson open shifts 0.017–0.032** when the lazy animation
    chunk replaces its fixed 460 px placeholder. **Deferred:** this sits
    inside `ProblemLesson.tsx` while the glossary work (#1781 G2) is changing
    it. The fix is to reserve the model's measured height, or to preload the
    chunk when Lesson is pressed.
15. **WebKit reports `ResizeObserver loop completed with undelivered
    notifications`** on the two-column proof (320 to 768 px). It is
    harmless, but it is noise in error logs. **Deferred:** needs a trace of
    which observer re-enters.
16. **Skill and topic titles disagree on case** ("Multiplication Facts"
    beside "Multiplication facts"). **Fixed in round 2.**
17. **The correct-answer sheet keeps the full dock height.** Above a tall
    dock (multi-select) this leaves an empty band between progress and Next.
    **Fixed in round 2.**
18. **Check's enable transition (0.12 s) runs under reduced motion.**
    **Fixed in round 2.**
19. **Safe areas.** `index.html` does not opt into `viewport-fit=cover`, so
    browser `env()` insets are zero. Practice CSS already pads the shell,
    feedback sheet, calculator and dialogs with `env(safe-area-inset-*)` for
    surfaces that opt in. **No change.**

## Round 2

1. **Feedback sheet sized to its content.** Stacked, the sheet is as tall
   as what it says, anchored at the bottom where Check was. Next stays in
   the thumb zone and no empty band opens above it when the dock was taller
   (multi-select, keypad). Side by side, the sheet sits at the foot of the
   answer column, where Next has always been. Before, it filled the column
   and left a gap of up to 500 px between the result and Next. Growing (See
   why) moves only its top edge. Asserted: `feedback-gap`.
2. **Reduced motion.** The shared button rule (`theme.css`) eases fills and
   shrinks a pressed button only under `prefers-reduced-motion:
   no-preference`. With reduced motion, Check enabling changes at once.
   Nothing changes for learners who allow motion. Asserted:
   `motion-under-reduce`.
3. **Print: no caret.** Worksheets and answer keys print a coefficient and
   its power as one cell: 3 × 10⁻³ in the key, and on the worksheet a blank
   × 10 with a raised blank for the exponent. `powerBase` and `powerTex` in
   `src/math/structured-work.ts` are the one rule for screen and paper.
   Covered by a render test in `tests/structured-work.test.ts`.
   `npm run workbook:audit` still reports only the six templates already in
   `paper-exclusions.ts`.
4. **Sentence-case skill titles from one source.** Skill titles were
   built from ids in title case ("Count To 20", "Ten More Less"). Problem-type
   titles are sentence case (1,148 of 1,151). `skillTitle` in
   `src/curriculum/catalog.ts` now builds sentence case from the id, keeping
   names and initialisms (Pythagorean, Cavalieri, GCF, LCM). Every skill
   title goes through it. Asserted in `tests/curriculum.test.ts`.
5. **Large tablets and desktops** (1024×768, 1366×1024 and 1440×900, in
   both orientations). The sheet changes above remove the stretched-phone
   gaps. Figures in the side-by-side workspace at 1200×760 and up, and on
   tall portrait tablets, get more height (up to 520 px and 460 px). A
   labelled figure still stops where its labels reach the figure type size
   (`FigureTextCap`, enforced by `verify-graphical-ui.ts` and
   `verify-ui.ts`), so the gain goes to unlabelled and lightly labelled
   figures. On tall portrait screens the dock and sheet widen to 680 px.
6. **Not changed (another owner):** `ProgressWorkspace.tsx` re-cases skill
   titles itself (lowercases, then capitalises the first letter), so GCF
   and LCM read "Gcf lcm" there. Reported to the app-shell owner.

Screenshots: `round-2/before/` and `round-2/after/` (same seeds), plus
`round-2/after/print-scientific-notation-{worksheet,key}.png`.

## Screenshots

`before/` and `after/` hold the same seeded states at the same sizes, from
main and from this branch. Each file is named
`<browser>-<size>-<theme>-<case>-<state>.png`:

- `choice-scene-incorrect`, `parts-inline-incorrect` and `point-plot-skipped`
  (320×568): connections no longer clipped; marks visible above the sheet.
- `parts-cards-skipped` (320×568): a skip fills in the answer, with no ✕ on
  boxes the learner never filled.
- `choice-scene-filled` (320×568): Check is pinned in the answer sheet.
- `figure-choice-skipped` (320×568): Try easier stays on one line.
- `number-hint` (390×844 light, 768×1024 dark): the hint is a sheet over a
  visible problem.
- `work-steps-skipped` (768×1024) and `multi-select-figure-skipped`
  (390×844 dark): long answers at body size, listed one value per line.
- `scientific-notation/` (#1786): typeset scientific notation.

## Running it

```bash
cd amp
npm run test:practice-polish-ui                 # verify matrix, fails on findings
AUDIT_FULL=1 npx tsx scripts/verify-practice-polish-ui.ts   # full audit, report only
```
