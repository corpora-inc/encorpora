# AMP Mathematics

AMP (Adaptive Math Pathways) is a TypeScript/PostgreSQL adaptive mathematics studio for parent-managed learners. Its curriculum target spans elementary mathematics through precalculus and SAT Math preparation. Interactive practice uses deterministic server-generated problems, exact grading, and shared visual models. Lessons also produce printable mini-textbooks, workbooks, and worked solutions.

This workspace is a development preview. It contains a complete numbered Common Core inventory and a planned skill graph, with selected working problem families and lessons. Inventory coverage does not establish complete instruction, assessment, or learning outcomes. Run the audits below for the current counts and gaps. The product is not approved by an ESA program and does not process live subscription payments.

## Run locally

Prerequisites: Node 22 or newer, Python 3.10 or newer, Docker, and npm. Run these commands from `amp/`:

```sh
npm ci
docker compose -p amp-foundation up -d database
export AMP_DATABASE_URL=postgres://amp:amp@127.0.0.1:55439/amp
export AMP_AUTH_MODE=development
npm run db:migrate
npm run dev:api
```

In a second terminal in `amp/`, run `npm run dev`, then open <http://127.0.0.1:4310>. Create a learner using a nickname. Local development uses one household, bypasses licensing and consent enrollment, and binds the API to loopback. It must not be exposed through a public tunnel or reverse proxy.

The database volume preserves practice between runs. `docker compose -p amp-foundation stop` stops the local database without deleting its contents. Set `AMP_DB_PORT` if the default port is occupied, and use the corresponding port in the database URL.

## Review problems and lessons locally

Run `npm run dev:content` from `amp/`, then open <http://127.0.0.1:4312>. This standalone review tool uses the real generators, math renderers, figures and lessons. It needs installed dependencies but no database or parent account, and records no attempts or mastery.

Choose a problem type and seed. The address preserves both, so a reviewer can reproduce the exact problem. Try an answer, reveal its hint or worked solution, and compare the in-practice lesson with the full reference lesson. “Another problem” changes the seed. Browser back and forward restore selections. Review a few representative instances and boundary cases before expanding a family; feedback should include the address and the part to change.

The tool binds only to `127.0.0.1`; `AMP_REVIEW_PORT` changes its default port. It is a separate local presentation surface, not a check of account flows, adaptive scheduling or learner progress. The full AMP application runs separately at <http://127.0.0.1:4310>.

## Verify and publish documents

```sh
npm test
npm run build
npm run audit
export AMP_TEST_DATABASE_URL=postgres://amp:amp@127.0.0.1:55439/amp
npm run test:db
npx playwright install chromium
npm run test:ui
npm run publications
npm run production:queue
```

Database tests require a disposable database; they create and remove their own fixtures. Browser verification starts its own loopback API and Vite server, so stop development servers on ports 4310/4311 first.

Publications are written to `artifacts/publications/` in Letter and A4 formats. Each workbook has a matching solution volume with the same deterministic problems. The lesson library offers authenticated PDF downloads after these artifacts have been built. PDFs and screenshots are generated artifacts, not Git source files.


## Test suites

| Command | Coverage | When required |
| --- | --- | --- |
| `npm run test:core` | Application unit tests and focused mathematics tests | Every AMP pull request and merge queue run |
| `npm run test:inventory` | Full independent mathematics inventory and deliberate-corruption checks | After merge on main when no exact successful input/environment result exists; manual revalidation |
| `npm test` | Both unit suites | Complete local verification |
| `npm run test:db` | Database integration and access/payment isolation | Every AMP CI run; locally for affected persistence, money, consent and privacy paths |

The content fingerprint in `.github/scripts/amp_inventory_paths.py` includes mathematics, content, publications, scripts, simulations, dependencies, rendering and unknown AMP areas. It excludes explicitly independent billing/family/privacy/consent code, ordinary core-test files and documentation. Filenames, Git blob identifiers and file modes are hashed, so edits, removals and renames invalidate the result. Keep this boundary current when adding dependencies between application and content code.

Expensive content checks run after merge. A main run may reuse only an exact successful content/environment fingerprint; cache misses, failed runs and unknown inputs trigger verification. The success marker is saved only after all content commands pass. Manual runs force revalidation. An unrelated commit cannot turn a failed content check green because failed inputs have no successful marker.

The existing `ci-gate` aggregates results; no path-specific job is an independent required status. Main also runs browser checks. Production advances only to a main commit whose three AMP release jobs succeed, either by executing content checks or verifying their exact reusable result. Failures are fixed forward through another PR.

## Architecture

- `src/math` defines bounded mathematical structures, runtime contracts, deterministic template generation, and exact numeric grading.
- `src/curriculum` separates external standards, instructional skills, assessment facets, and editorial prerequisite relationships.
- `src/content` contains original lessons, shared screen/print publishing, and evidence-based coverage auditing.
- `src/server` provides parent authorization, learner ownership checks, PostgreSQL persistence, versioned problem instances, and idempotent attempts.
- `src/web` provides the responsive learner interface and browser OIDC sign-in.
- `src/commerce` separates order approval, delivery, settlement, refund, and student access grants.
- `src/funding` records US public-funding research, sources, and separate approval gates.

The server accepts numeric answers and fractions. It does not yet grade general symbolic expressions, free-form proofs, or interactive constructions.

Placement starts from the learner's birth year: the estimate begins at the grade a learner of that age is typically working in (born 2016 → grade 4 in October 2026) with wide uncertainty. Each strand (numbers, fractions, algebra, …) keeps a Bayesian estimate of its grade level: a posterior over grades −1…13 updated by every answer, under a response model in which a problem at a learner's level is answered independently about 70% of the time. Answers with help count as not independent; very easy successes and out-of-reach misses carry little information. Untouched strands inherit the overall estimate with wider uncertainty. Problems are aimed above the estimate while it is uncertain and settle near 80% success; strands with wide uncertainty or below the age-expected grade get priority, and work stays interleaved with spaced review, revisits and prerequisite repair. The home map shows each strand's estimate and 90% range on a scale centred on the age-expected grade. The estimate is replayed from the attempt history, so no stored state can drift. These are scheduling estimates, not validated psychometric measurements; `tests/frontier.test.ts` simulates learners to check them. The next problem is planned as soon as an answer is recorded, so it reflects that answer and is ready when the learner continues.

Practice occupies the device viewport, with explanations in focus-managed panels. Short phones use a dedicated answer panel; landscape places the keypad beside the question. The lesson library opens a selected lesson directly and restores its catalog position on return.

See [product and experience specification](docs/product-experience.md), [curriculum coverage](docs/curriculum.md), [content production](docs/production.md), [commerce](docs/commerce.md), and [deployment requirements](docs/deployment.md).
