# A complete AMP problem type

A problem type is a registered, replayable generator with valid answers, usable
teaching, and buildable print inputs. Add it through a descriptor in
`src/families/`, then run `npm run families:index`. Legacy types also belong to
the combined `templates` registry in `src/math/engine.ts`.

From `amp/`, run `npx tsx --test tests/problem-type-complete.test.ts`. This test
derives its inventory from the registry and runs on every AMP pull request and
merge-queue candidate through the existing `amp-core` / `ci-gate` checks.

| Requirement | Source | Check in `tests/` |
| --- | --- | --- |
| Unique registration and deterministic, versioned generator; preserve historical replay | `src/families/<family>.ts`, `src/math/*-practice.ts`, `src/math/historical-templates.ts` | `problem-type-complete.test.ts`, `family-index.test.ts`, family replay tests |
| Valid public response, private answer and grading metadata; no answer leakage | `src/math/contracts.ts`, generator | `problem-type-complete.test.ts`, `contracts.test.ts` |
| Exact grading; equivalent correct answers accepted and incorrect answers rejected | `src/math/engine.ts`, response-specific graders | `problem-type-complete.test.ts` checks the key; family tests and `independent-review.test.ts` check mathematical correctness |
| Honest guessing probability for every response variant | `src/math/guess-chance.ts`, response metadata | `problem-type-complete.test.ts` checks the input; `frontier-guessing.test.ts` checks the estimator |
| Capability admission and working fallback for older clients | `src/math/contracts.ts`, `generateProblemFor` in `src/math/engine.ts`, response adapters | `contracts.test.ts`, `scene-capability-negotiation.test.ts` |
| Existing skill, valid standard links, exposure objective and explicit facet mapping | `src/curriculum/catalog.ts`, `src/curriculum/selection.ts`, family descriptor / `src/content/facet-mappings.ts` | `problem-type-complete.test.ts`, `curriculum.test.ts`, `selection-policy.test.ts`, `coverage.test.ts` |
| Written lesson or validated book-page binding; worked example, method, principle and common-error advice | `src/content/*-lessons.ts`, `src/content/problem-methods.ts`, `src/content/problem-principles.ts`, `src/books/catalog.ts` | `problem-type-complete.test.ts`, `problem-lessons.test.ts`, book tests |
| Hint teaches the first move using the instance's givens without revealing its answer | Generator; `src/content/AGENTS.md` | `problem-type-complete.test.ts` checks presence; `instance-hints.test.ts` checks quality |
| Glossary terms and senses resolve; diagrams describe the actual quantities and render | `src/glossary/`, `src/content/scene-illustrations.ts`, generated scenes | `problem-type-complete.test.ts`, `glossary-contexts.test.ts`, `scene.test.ts`, browser figure checks |
| Worksheet plan covers the family's required cases and builds twelve exercises per type | `src/content/*-worksheets.ts`; shared dispatch in `src/content/publications.tsx::publicationProblems` | `problem-type-complete.test.ts`, family worksheet tests |
| Printable reference lesson, workbook and solutions in Letter/A4, or validated printable book pages | `src/content/publications.tsx`, `scripts/publication-documents.ts`, `src/publishing/book.tsx` | `problem-type-complete.test.ts` builds inputs/components; `publications.test.ts` and PDF deep checks validate full output |
| Independent oracle route; every declared released-item/archetype reference resolves | `scripts/*_math_oracle.py`, `scripts/independent-math-review.py`, `src/curriculum/released-items/`, family descriptor | `problem-type-complete.test.ts`, `independent-review.test.ts`, `released-items.test.ts` |

The completeness test calls the production worksheet builder and print
components, plus the actual independent oracle dispatcher. It collects failures
per type. It does not render PDFs or exhaust generator seeds. The image build
also computes `guessChanceTable()` in `scripts/build-server.ts` and renders and
verifies PDFs through `scripts/build-pdf-release.ts` and `scripts/pdf-release.ts`.
Post-merge deep checks add typography, grammar, hint quality, 256-seed oracle
review, and browser/PDF layout inspection. Passing the fast check establishes
artifact completeness; those deeper checks and an independent content review
establish correctness and teaching quality. A released-item citation or a new
scene is required only when the type uses or claims one.
