# Daily workbooks

A daily workbook is a printable PDF of about 30, 45 or 60 minutes of work, chosen for one learner from their practice evidence. Each workbook is new and they never run out. The layout and structure are the same at every level; only the problems change. Issue [#1776](https://github.com/corpora-inc/encorpora/issues/1776) tracks the feature. It stays out of the production interface until the founder has reviewed generated workbooks.

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

## Checks

- `npm run workbook:audit` prints three problems from every template in the workbook layout. It fails on content wider than its column, a problem taller than a page, or a figure shape that lost its styles. Known failures are listed in `src/workbook/paper-exclusions.ts` and skipped by the composer; any new failure fails the audit.
- `npm run workbook:samples -- [30|45|60] [learner…]` writes PDFs for synthetic learners (`src/workbook/synthetic.ts`) to `artifacts/workbooks/` and runs the same layout checks on every page.
- `tests/workbook.test.ts` covers determinism, structure at every level and length, time targets, due review, a learner with no answers, and key placement.
