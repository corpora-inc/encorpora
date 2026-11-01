# Daily workbooks

A daily workbook is a printable document of about 30, 45 or 60 minutes of work, chosen for one learner from their practice evidence. Each workbook is new and they never run out. The layout and structure are the same at every level; only the problems change. Issue [#1776](https://github.com/corpora-inc/encorpora/issues/1776) tracks the feature. Parent entry points stay off until release: `workbooksEnabled` in `src/web/features/workbooks/config.ts` is the one switch. The routes work by URL either way.

## Structure

| Section | Purpose | Selection (offset from the strand's estimated level) |
| --- | --- | --- |
| Warm-up | Quick work to start | Skills with at least 3 of their last 5 answers independently correct, then material 0.75–1.75 grades below |
| Today's idea | One lesson, taught | A lesson card (summary, one method section with its diagram, worked example, one pitfall), then guided problems from the lesson's own templates. Started-but-unsecured skills come first, then new skills near the frontier |
| Practice | Moderate challenge | 0.8 below to 0.2 above, at most two per strand, round-robin across strands, filling the remaining time |
| Review | Spaced retrieval | Skills whose `reviewDueAt` has passed, oldest first, on a different template than last time when possible |
| Challenge | Just beyond reach | One problem from the curated challenge pool (several steps or a figure to reason about), from the nearest bands at or above the strand level (0.5–1.3 first), shared among the three strands with the most independent evidence so it changes day to day. Then any template above the level; a pool problem below the level only at the top of the catalog |

A detachable answer key (answer plus worked steps for every problem, and the lesson's parent note) and a results page (a Right / Not yet box per problem, the workbook code, and a QR code that opens the results entry) follow the student pages.

Selection is a scheduling heuristic, like mixed practice. Success levels per section are targets, not measurements. Problem times in `minutesFor` are editorial estimates, to be calibrated against in-app response times.

## Determinism

`composeWorkbook` (`src/workbook/compose.ts`) returns a `WorkbookSpec` that names every problem by template, version and seed. The seed derives from learner key, date and workbook number, so the same inputs reprint the same workbook, and "another one" (the next number) is new. `workbookCode` is a short hash of the spec, printed on every page so results can be entered against exactly those problems.

## Rendering

`workbookHtml` (`src/workbook/render.tsx`) prints with the same exercise component as the lesson workbooks (`src/content/print-exercise.tsx`), and Chromium makes the PDF. Print with `printWorkbookPdf` (`src/workbook/pdf.ts`): it waits for the page composition, prints backgrounds, and draws no browser header or footer.

- **Pages.** A script in the HTML (`src/workbook/layout-script.ts`) measures the typeset blocks once the embedded fonts load and builds explicit Letter or A4 pages. A section heading always travels with the block after it. The lesson card stays on one page with its guided problems when they fit. A page's spare height becomes extra workspace in its rows, so pages end level. A page that has nothing to grow (a lesson card alone) takes rows from the end of the page before. The key and results pages never share a page with student work. Every page has a footer with the workbook code and "Page n of N". Without scripts the same blocks still print in order through CSS page breaks.
- **Bands.** The working level sets the print scale: kindergarten to grade 2 (Andika, the single-storey letters children learn to write; 14–15 pt; round badges and large answer boxes), grades 3–5 (12 pt, graph-paper workspace), grades 6–8 (11 pt) and high school (10.75 pt, dot-grid workspace, outlined number badges and a single ink colour). Reading text is IBM Plex Sans (1, l and I differ; 0 is a plain oval); headings are Fraunces. All are embedded (SIL OFL 1.1), so every renderer prints the same letters.
- **Problems.** Problems sit two to a row with a hanging number badge coloured by section. Worked steps, tables and long formulas take a full row. Each row is one block that a page break never splits. Workspace is a light grid sized to the work: a short answer zone for choices, room to work for typed answers, a large area for the challenge.
- **Today's idea.** The lesson card shows the summary, one explanation under "The idea" (an illustrated section, else the plain-words introduction), its diagram when the lesson has one, the worked example with numbered steps, and the first pitfall. A card always fits one page with its heading: a long one drops its extra paragraphs, then its pitfall, then its diagram, then prints at no less than 75%. When the card's page has room left, a "Your turn" space follows it. Multi-part items print each blank's options as an aligned grid of drawn boxes.
- **Results.** Pass `results: { baseUrl, learnerId, workbookId }` to print a QR code for `<baseUrl>/learners/<learnerId>/workbooks/<workbookId>/results` (`src/workbook/links.ts`). The code is drawn as SVG from the `qrcode` package's module matrix.

## Storage and API

`amp_workbooks` (migration 0077) stores one row per learner, date, number and length: the spec, its code and the parent's paper size. Rows are learning data. They appear in the family export, are deleted with the learner's learning data, and cascade when a learner row is removed.

The routes (`src/workbook/routes.ts`) require the learner's parent with consent and an active license, as practice does; a free trial has no workbooks.

| Route | Result |
| --- | --- |
| `POST /api/v1/learners/:id/workbooks` `{date, minutes: 30\|45\|60, paper: letter\|a4, number?}` | The workbook for that date, number and length: stored the first time (201), returned unchanged afterwards (200). No `number` means the next number for the date ("Another one"). A new workbook is for today (within a day of the server's UTC date); stored ones of any date stay available. A changed paper size is saved; the problems are not |
| `GET /api/v1/learners/:id/workbooks[?date=]` | History, newest first, as summaries (sections, problem counts, estimated minutes, code) |
| `GET /api/v1/learners/:id/workbooks/:workbookId/document[?paper=]` | The printable workbook as one HTML document. 410 when a template has changed version since the workbook was made, because its problems would no longer reprint exactly |

A stored spec never changes when evidence changes later; the next number is composed from the new evidence. `workbookCode` hashes the spec with sorted keys, because JSONB storage reorders them.

## Parent screens

- `/learners/:id/workbooks/:date` (today): length and paper size as segmented controls, Download and Another one. Length, paper and number live in the URL (`?minutes=&paper=&number=`), so Back, reload and shared links restore the screen. Opening it makes today's first workbook, from the starting estimate when the learner has no answers yet. Other dates list that day's workbooks.
- `/learners/:id/workbooks`: every workbook, newest first, each downloadable again.
- Family → Learners shows "Download today's workbook" and "Past workbooks" when `workbooksEnabled` is on and the learner can practice.

`npm run test:workbooks-ui` runs the real routes (in memory) in Chromium at 320, 390, 768 and 1280 px, light and dark: overflow, touch targets, controls that never move while workbooks load, change, fail or download, Back and reload, and the unlicensed state. Screenshots: `docs/reviews/workbooks/`.

## Checks

- `npm run workbook:audit` prints three problems from every template in the workbook layout (and kindergarten to grade 2 templates again at the early scale). It fails on content wider than its column, a problem taller than a page, or a figure shape that lost its styles. Known failures are listed in `src/workbook/paper-exclusions.ts` and skipped by the composer; any new failure fails the audit.
- `npm run workbook:samples -- [30|45|60|all] [--paper letter|a4|all] [--png] [--gray] [learner…]` writes PDFs for synthetic learners (`src/workbook/synthetic.ts`) to `artifacts/workbooks/` and checks every composed page: no overflow or split problem, no heading ending a page, student pages at least 90% full (except the last), key and results never mixed with student pages, the PDF page count equal to the composed pages, no word broken across lines, 4.5:1 text contrast (which is also the grayscale contrast), and no unstyled figure shape. `--png` renders every page with Poppler for review.
- `npm run test:workbook-paper-ui` runs the same checks on a fixed set of learners, lengths and paper sizes in CI, composes every lesson card at each print scale and fails on any taller than a page, and composes three workbooks in Firefox and WebKit, because parents also print the HTML from their own browser.
- `npx tsx scripts/workbook-challenge-pool.ts --write` regenerates `src/workbook/challenge-pool.ts` and documents its scoring; curate with its `routine` list.
- `tests/workbook.test.ts` covers determinism, structure at every level and length, time targets, due review, a learner with no answers, key placement, the results link and the challenge pool.
- `tests/workbooks.test.ts` covers the API with an in-memory repository; `tests/workbooks.integration.ts` covers storage, concurrency, export and deletion on PostgreSQL.
- Review pages of representative learners are in `docs/reviews/workbooks/` (`paper-*.png`).
