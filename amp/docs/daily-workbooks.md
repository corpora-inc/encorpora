# Daily workbooks

A daily workbook is a printable document of about 30, 45 or 60 minutes of work, chosen for one learner from their practice evidence. Each workbook is new and they never run out. The layout and structure are the same at every level; only the problems change. Issue [#1776](https://github.com/corpora-inc/encorpora/issues/1776) tracks the feature. Parent entry points stay off until release: `workbooksEnabled` in `src/web/features/workbooks/config.ts` is the one switch. The routes work by URL either way.

## Structure

| Section | Purpose | Selection (offset from the strand's estimated level) |
| --- | --- | --- |
| Warm-up | Quick work to start | Skills with at least 3 of their last 5 answers independently correct, then material 0.75–1.75 grades below |
| Today's idea | One lesson, taught | A lesson card (summary, one method section with its diagram, worked example, one pitfall), then guided problems from the lesson's own templates. Started-but-unsecured skills come first, then new skills near the frontier |
| Practice | Moderate challenge | 0.8 below to 0.2 above, at most two per strand, round-robin across strands, filling the remaining time |
| Review | Spaced retrieval | Skills whose `reviewDueAt` has passed, oldest first, on a different template than last time when possible |
| Challenge | Just beyond reach | 0.5–1.3 above, in the strand with the most independent evidence, preferring multi-step or figure problems |

A detachable answer key (answer plus worked steps for every problem, and the lesson's parent note) and a results page (a right/not-yet mark per problem, plus the workbook code) follow the student pages.

Selection is a scheduling heuristic, like mixed practice. Success levels per section are targets, not measurements. Problem times in `minutesFor` are editorial estimates, to be calibrated against in-app response times.

## Determinism

`composeWorkbook` (`src/workbook/compose.ts`) returns a `WorkbookSpec` that names every problem by template, version and seed. The seed derives from learner key, date and workbook number, so the same inputs reprint the same workbook, and "another one" (the next number) is new. `workbookCode` is a short hash of the spec, printed on every page so results can be entered against exactly those problems.

## Rendering

`workbookHtml` (`src/workbook/render.tsx`) prints with the same exercise component as the lesson workbooks (`src/content/print-exercise.tsx`), and Chromium makes the PDF. Problems sit two to a row. Worked steps, tables and long formulas take a full row. Each row is one block that a page break never splits. Early levels use larger type and more room.

## Storage and API

`amp_workbooks` (migration 0077) stores one row per learner, date, number and length: the spec, its code and the parent's paper size. Rows are learning data. They appear in the family export, are deleted with the learner's learning data, and cascade when a learner row is removed.

The routes (`src/workbook/routes.ts`) require the learner's parent with consent and an active license, as practice does; a free trial has no workbooks.

| Route | Result |
| --- | --- |
| `POST /api/v1/learners/:id/workbooks` `{date, minutes: 30\|45\|60, paper: letter\|a4, number?}` | The workbook for that date, number and length: stored the first time (201), returned unchanged afterwards (200). No `number` means the next number for the date ("Another one"). A new workbook is for today (within a day of the server's UTC date); stored ones of any date stay available. A changed paper size is saved; the problems are not |
| `GET /api/v1/learners/:id/workbooks[?date=]` | History, newest first, as summaries (sections, problem counts, estimated minutes, code), and `pdf`: whether downloads are PDFs. Without a configured renderer the screens download the printable document instead |
| `GET /api/v1/learners/:id/workbooks/:workbookId/pdf[?format=Letter\|A4]` | The workbook PDF, rendered by the [render service](deployment.md#workbook-render-service) on first request and cached for a day. A renderer that is down answers a logged 503, "Your workbook is being prepared; try again in a minute.", and the screen downloads the printable document instead. 410 as below |
| `GET /api/v1/learners/:id/workbooks/:workbookId/document[?paper=]` | The printable workbook as one HTML document. 410 when a template has changed version since the workbook was made, because its problems would no longer reprint exactly |

A stored spec never changes when evidence changes later; the next number is composed from the new evidence. `workbookCode` hashes the spec with sorted keys, because JSONB storage reorders them.

## Results

Results come back from paper through `/learners/:id/workbooks/:workbookId/results`. The QR code on a workbook's results page links there; parents can also reach it with "Enter results" on the workbook or in history, or by typing the printed code in history.

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

- `/learners/:id/workbooks/:date` (today): length and paper size as segmented controls, Download and Another one. Length, paper and number live in the URL (`?minutes=&paper=&number=`), so Back, reload and shared links restore the screen. Opening it makes today's first workbook, from the starting estimate when the learner has no answers yet. Other dates list that day's workbooks.
- `/learners/:id/workbooks`: every workbook, newest first, each downloadable again.
- Family → Learners shows "Download today's workbook" and "Past workbooks" when `workbooksEnabled` is on and the learner can practice.

`npm run test:workbooks-ui` runs the real routes (in memory) in Chromium at 320, 390, 768 and 1280 px, light and dark: overflow, touch targets, controls that never move while workbooks load, change, fail or download, Back and reload, and the unlicensed state. Screenshots: `docs/reviews/workbooks/`.

## Checks

- `npm run workbook:audit` prints three problems from every template in the workbook layout. It fails on content wider than its column, a problem taller than a page, or a figure shape that lost its styles. Known failures are listed in `src/workbook/paper-exclusions.ts` and skipped by the composer; any new failure fails the audit.
- `npm run workbook:samples -- [30|45|60] [learner…]` writes PDFs for synthetic learners (`src/workbook/synthetic.ts`) to `artifacts/workbooks/` and runs the same layout checks on every page.
- `tests/workbook.test.ts` covers determinism, structure at every level and length, time targets, due review, a learner with no answers, and key placement.
- `tests/workbooks.test.ts` covers the API with an in-memory repository; `tests/workbooks.integration.ts` covers storage, concurrency, export and deletion on PostgreSQL.
- `tests/workbook-results.test.ts` covers grading, paper evidence, idempotent re-entry, refused rows, code lookup, held-back templates and the weights. `tests/workbook-results.integration.ts` covers the same flow on PostgreSQL, and `tests/skill-evidence.integration.ts` checks that the SQL and TypeScript projections agree with paper marks.
