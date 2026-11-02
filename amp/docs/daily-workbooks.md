# Workbooks

A workbook is a printable document of about 30, 45 or 60 minutes of work, chosen for one learner from their practice evidence. Parents print as many or as few as they like: every roll is a different workbook at the learner's level, and they never run out. Parents can mix and match areas, the level and whether a lesson is included. The layout and structure are the same at every level; only the problems change. Issue [#1776](https://github.com/corpora-inc/encorpora/issues/1776) tracks the feature. Parents reach workbooks from Family → Learners; `workbooksEnabled` in `src/web/features/workbooks/config.ts` switches those entry points off again if needed. The routes work by URL either way.

## Structure

| Section | Purpose | Selection (offset from the strand's estimated level) |
| --- | --- | --- |
| Warm-up | Quick work to start | Skills with at least 3 of their last 5 answers independently correct, then material 0.75–1.75 grades below |
| Today's idea | One lesson, taught | A lesson card (summary, one method section with its diagram, worked example, one pitfall), then guided problems from the lesson's own templates. Started-but-unsecured skills come first, then new skills near the frontier |
| Practice | Moderate challenge | 0.8 below to 0.2 above, at most two per strand, round-robin across strands, filling the remaining time |
| Review | Spaced retrieval | Skills whose `reviewDueAt` has passed, oldest first, on a different template than last time when possible |
| Challenge | Just beyond reach | One problem 0.5–1.3 grades above the learner (`CHALLENGE_WINDOW`): above its strand's level and never more than 1.3 above the overall level. From the curated challenge pool (several steps or a figure to reason about) when it has one in that window, shared among the three strands with the most independent evidence so it changes day to day; then any template in the window. Only at the ends of the catalog, where the window is empty, the closest template |

A detachable answer key (answer plus worked steps for every problem, and the lesson's parent note) and a results page (a Right / Not yet box per problem, the workbook code, and a QR code that opens the results entry) follow the student pages.

The estimate never exceeds the chosen length. The challenge keeps to a fifth of it (the first candidate in order that fits, else the quickest). When long problems fill the time before practice (high school problems run 1.3 times longer), the warm-up gives way to half, then the guided problems to two, then review to two (then each to one), so practice keeps about a quarter. A practice problem longer than the time left is passed over for a shorter one.

Selection is a scheduling heuristic, like mixed practice. Success levels per section are targets, not measurements. Problem times in `minutesFor` are editorial estimates, to be calibrated against in-app response times.

## Choices

A workbook's choices are stored in its spec (`choices`, spec version 2):

| Choice | Values | Effect |
| --- | --- | --- |
| Areas | Mixed (recommended), or strands near the learner's level | Every section draws only from the chosen strands. The areas offered are strands with printable work from 1.5 grades below to 1 grade above the strand's estimate (`workbookAreas`) |
| Level | Easier, At level, Harder (`lean`: easier, level, stretch) | Moves practice and today's idea by −0.5, 0 or +0.4 grades. Easier also has half again as much review. The warm-up and the challenge keep their windows |
| Today's idea | Include, Leave out (problems only) | Leaving it out drops the lesson; practice takes its time |

Version 1 specs have no `choices` and read as mixed, at level, with a lesson (`specChoices`). They reprint the same problems under the same code; `tests/fixtures/workbook-v1-spec.json` checks it.

## Variety

Each roll is composed after the learner's recent workbooks (the last 12, `WORKBOOK_HISTORY`), so it avoids what they printed. The newest weighs most:
- Practice, warm-up, the challenge and review templates put work no recent workbook printed first, then skills not practised recently, then this workbook's own order.
- Today's idea rotates among the eligible frontier lessons: a lesson no recent workbook taught comes first, then started-but-unsecured skills, then new skills near the frontier.
- Review brings back due skills that a recent workbook has not reviewed first, then the longest overdue (by week).

The selection windows stay the same, so a roll is varied but never off level. Over six rolls in a day, the mean template overlap between consecutive workbooks (Jaccard) is 0.035, against 0.170 before history-aware selection, and every roll has a different lesson (`tests/workbook.test.ts`).

## Determinism

`composeWorkbook` (`src/workbook/compose.ts`) returns a `WorkbookSpec` that names every problem by template, version and seed. The seed derives from learner key, date, workbook number and choices. With the same evidence and history, the same inputs compose the same workbook, and a stored spec always reprints the same pages. "Roll another" (the next number) is new. `workbookCode` is a short hash of the spec, printed on every page so results can be entered against exactly those problems.

## Rendering

`workbookHtml` (`src/workbook/render.tsx`) prints with the same exercise component as the lesson workbooks (`src/content/print-exercise.tsx`), and Chromium makes the PDF. The render service (`src/render-service/server.ts`) and `printWorkbookPdf` (`src/workbook/pdf.ts`) run the document's composition script in an offline context that refuses every request, wait for `data-layout="ready"` on a document marked `<html data-compose>`, and refuse one that reports an error (the service answers 422). They print backgrounds and draw no browser header or footer.

- **Pages.** A script in the HTML (`src/workbook/layout-script.ts`) measures the typeset blocks once the embedded fonts load and builds explicit Letter or A4 pages. A section heading always travels with the block after it. The lesson card stays on one page with its guided problems when they fit. A page's spare height becomes extra workspace in its rows, so pages end level. A page that has nothing to grow (a lesson card alone) takes rows from the end of the page before. The key and results pages never share a page with student work. Every page has a footer with the workbook code and "Page n of N". Without scripts the same blocks still print in order through CSS page breaks.
- **Bands.** The working level sets the print scale: kindergarten to grade 2 (Andika, the single-storey letters children learn to write; 14–15 pt; round badges and large answer boxes), grades 3–5 (12 pt, graph-paper workspace), grades 6–8 (11 pt) and high school (10.75 pt, dot-grid workspace, outlined number badges and a single ink colour). Reading text is IBM Plex Sans (1, l and I differ; 0 is a plain oval); headings are Fraunces. All are embedded (SIL OFL 1.1), so every renderer prints the same letters.
- **Problems.** Problems sit two to a row with a hanging number badge coloured by section. Worked steps, tables and long formulas take a full row. Each row is one block that a page break never splits. Workspace is a light grid sized to the work: a short answer zone for choices, room to work for typed answers, a large area for the challenge.
- **Today's idea.** The lesson card shows the summary, one explanation under "The idea" (an illustrated section, else the plain-words introduction), its diagram when the lesson has one, the worked example with numbered steps, "Words to know" (up to six shared-glossary entries the card's own text uses, in first-use order, each with its plain definition; the lesson's senses decide ambiguous words) and the first pitfall. A card always fits one page with its heading, however long the lesson: the composition script measures it and gives up content one step at a time, in a fixed order (`cardTrimRanks`): extra paragraphs (last first), the pitfall, the first paragraph's later sentences, the diagram, words to know (one at a time), the worked example's later steps (the card then says the rest is in the answer key, and the key prints the whole example), the example's figure; only then does it print smaller, never below 75%. `test:workbook-paper-ui` composes every lesson card at every print band on Letter and A4 and fails any taller than a page. When the card's page has room left, a "Your turn" space follows it. Multi-part items print each blank's options as an aligned grid of drawn boxes.
- **Cover and footers.** The cover reads "Workbook for <first name>" and the workbook's date written out (the parent's local date when it was made); every footer reads "AMP · Workbook for <first name> · <short date> · No. n · <code>". The name comes from the learner's display name at print time, outside the spec, so stored workbooks of every version print the same cover. Without a name (samples), the cover says "Workbook" with a line to write a name.
- **Results.** The results page is always one page. The composition script tries four densities in order and keeps the first that fits: three tile columns, four columns, a compact heading and smaller QR code, then compact tiles. Only past those do the tiles print smaller, never below 70%. Pass `results: { baseUrl, learnerId, workbookId }` to print a QR code for `<baseUrl>/learners/<learnerId>/workbooks/<workbookId>/results` (`src/workbook/links.ts`). The code is drawn as SVG from the `qrcode` package's module matrix.

## Storage and API

`amp_workbooks` (migration 0077) stores one row per learner, date, number and length: the spec, its code and the parent's paper size. Rows are learning data. They appear in the family export, are deleted with the learner's learning data, and cascade when a learner row is removed.

The routes (`src/workbook/routes.ts`) require the learner's parent with consent and an active license, as practice does; a free trial has no workbooks.

| Route | Result |
| --- | --- |
| `POST /api/v1/learners/:id/workbooks` `{date, minutes: 30\|45\|60, paper: letter\|a4, number?, choices?: {areas, lean, lesson}}` | The workbook for that date, number and length: stored the first time (201), with the choices given; returned unchanged afterwards (200), with its own. No `number` means the next number for the date ("Roll another"). Up to 999 a day. An area not offered for the learner is left out (none left is mixed); the stored choices say what was used. A new workbook is for today (within a day of the server's UTC date); stored ones of any date stay available. A changed paper size is saved; the problems are not |
| `GET /api/v1/learners/:id/workbooks/areas` | The areas a parent can choose for this learner, in curriculum order, with their names |
| `GET /api/v1/learners/:id/workbooks[?date=]` | History, newest first, as summaries (sections, problem counts, estimated minutes, choices, code), and `pdf`: whether downloads are PDFs. Without a configured renderer the screens download the printable document instead |
| `GET /api/v1/learners/:id/workbooks/:workbookId/pdf[?format=Letter\|A4]` | The workbook PDF, rendered by the [render service](deployment.md#workbook-render-service) for each request. PDFs are never stored; only the spec is. A renderer that is down answers a logged 503, "Your workbook is being prepared; try again in a minute.", and the screen downloads the printable document instead. 410 as below |
| `GET /api/v1/learners/:id/workbooks/:workbookId/document[?paper=]` | The printable workbook as one HTML document. 410 when a template has changed version since the workbook was made, because its problems would no longer reprint exactly |

A stored spec never changes when evidence changes later; the next number is composed from the new evidence. `workbookCode` hashes the spec with sorted keys, because JSONB storage reorders them.

## Results

Results come back from paper through `/learners/:id/workbooks/:workbookId/results`. The QR code on a workbook's results page links there; parents can also reach it with "Enter results" on the workbook or in history, or by typing the printed code in history.

Rows on the printed results page and on the screen are named by the problem type's authored title (`resultLabel`, `src/workbook/result-labels.ts`). A title longer than two lines in the narrowest results tile (four columns on Letter) uses a short authored label from that file; `npm run workbook:audit` measures every label.

The screen has one row per problem.
- **Typed answers.** Numbers and fractions can be typed, and printed choices picked by letter. The app's exact grader checks them (`gradeAnswer`), and they count as independent attempts.
- **Marks.** Every row can instead be marked right or not yet, at half weight. Responses that don't type well are always marked: several choices, plotted points, multi-part answers and shown work.

Recording works like this:
- Each problem is stored once, as an attempt with `evidenceSource: "paper"`. Its problem instance (`paper:<workbook>:<n>`) is regenerated from the spec.
- Rows already recorded are kept, so entering a workbook again changes nothing. Recorded rows show their result and lock.
- A row the server refuses (an unreadable answer, a number not in the workbook) is named in the error. Nothing from that save is stored.
- Progress, levels and practice read the same evidence, and the screen invalidates the account store after saving.

The weights are in [adaptive evidence](adaptive-evidence.md).

| Route | Result |
| --- | --- |
| `GET …/workbooks/:workbookId/results` | The rows, with what is already recorded |
| `POST …/workbooks/:workbookId/results` `{entries: [{n, answer} \| {n, mark: right\|not-yet}]}` | Records new rows; returns the rows and how many were new. 400 names the problem; 410 for a stale workbook |
| `GET …/workbooks?code=ABCD-EFGH` | The workbook with that code (any case, dash optional) |

**Held back from practice.** Templates printed in a workbook made in the last 24 hours are left out of mixed practice (`reservedTemplateIds` in `planMixedPractice`), so the app does not repeat the paper that day. A focused or recovery pool made only of printed templates is still served.

## Parent screens

- `/learners/:id/workbooks/:date` (today): length, paper size, level and today's idea as segmented controls, areas as one row of chips that scrolls sideways (so loading them never moves anything), Download and Roll another. Changing a level, area or today's idea rolls a new workbook with that choice. Length, paper, number and choices live in the URL (`?minutes=&paper=&number=&areas=&lean=&lesson=off`), so Back, reload and shared links restore the screen. A stored workbook keeps its own choices, and the URL follows them. Opening it makes today's first workbook, from the starting estimate when the learner has no answers yet. Other dates list that day's workbooks.
- `/learners/:id/workbooks`: every workbook, newest first, each downloadable again.
- Family → Learners shows "Make a workbook" and "Past workbooks" when the learner can practice (and `workbooksEnabled` is on).

`npm run test:workbooks-ui` runs the real routes (in memory) in Chromium at 320, 390, 768 and 1280 px, light and dark: overflow, touch targets, controls that never move while workbooks load, change, fail or download, Back and reload, and the unlicensed state. Screenshots: `docs/reviews/workbooks/`.

## Checks

- `npm run workbook:audit` prints three problems from every template in the workbook layout (and kindergarten to grade 2 templates again at the early scale). It fails on content wider than its column, a problem taller than a page, or a figure shape that lost its styles. Known failures are listed in `src/workbook/paper-exclusions.ts` and skipped by the composer; any new failure fails the audit.
- `npm run workbook:samples -- [30|45|60|all] [--paper letter|a4|all] [--png] [--gray] [learner…]` writes PDFs for synthetic learners (`src/workbook/synthetic.ts`) to `artifacts/workbooks/` and checks every composed page: no overflow or split problem, no heading ending a page, student pages at least 90% full (except the last), key and results never mixed with student pages, the PDF page count equal to the composed pages, no word broken across lines, 4.5:1 text contrast (which is also the grayscale contrast), and no unstyled figure shape. `--png` renders every page with Poppler for review.
- `npm run test:workbook-paper-ui` runs the same checks on a fixed set of learners, lengths and paper sizes in CI, composes every lesson card at each print scale and fails on any taller than a page, and composes three workbooks in Firefox and WebKit, because parents also print the HTML from their own browser. Then it runs a randomized sweep, because fixed samples once let a results page spill onto an extra sheet. The sweep draws random learners from kindergarten to precalculus, dates, numbers, lengths and paper sizes, using the whole catalog, a few strands or one course near the learner's level. It fails if any results page overflows (240 random compositions, plus the largest possible composition with the longest labels at every print band on both papers) and runs four whole random workbooks through every page check. Its seed is the UTC day, so a rerun the same day repeats it, and it prints the seed: `WORKBOOK_SWEEP_SEED` reproduces a run, `WORKBOOK_SWEEP_COUNT` and `WORKBOOK_SWEEP_FULL` set its size, and `WORKBOOK_SWEEP_ONLY=1` runs the sweep alone. It also reports how often each results density is used.
- `npx tsx scripts/workbook-challenge-pool.ts --write` regenerates `src/workbook/challenge-pool.ts` and documents its scoring; curate with its `routine` list.
- `tests/workbook.test.ts` covers determinism, structure at every level and length, time targets (an estimate never over its length), due review, a learner with no answers, key placement, the results link, the challenge pool and the lesson card's words to know.
- `tests/workbooks.test.ts` covers the API with an in-memory repository; `tests/workbooks.integration.ts` covers storage, concurrency, export and deletion on PostgreSQL.
- `tests/workbook-results.test.ts` covers grading, paper evidence, idempotent re-entry, refused rows, code lookup, held-back templates and the weights. `tests/workbook-results.integration.ts` covers the same flow on PostgreSQL, and `tests/skill-evidence.integration.ts` checks that the SQL and TypeScript projections agree with paper marks.
- Review pages of representative learners are in `docs/reviews/workbooks/` (`paper-*.png`).
