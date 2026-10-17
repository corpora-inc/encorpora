# AMP mathematics

AMP is a TypeScript/PostgreSQL adaptive mathematics studio for parent-managed learners. Its curriculum target spans elementary mathematics through precalculus and SAT Math preparation. Interactive practice uses deterministic server-generated problems, exact grading, and shared visual models. Lessons also produce printable mini-textbooks, workbooks, and worked solutions.

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

## Architecture

- `src/math` defines bounded mathematical structures, runtime contracts, deterministic template generation, and exact numeric grading.
- `src/curriculum` separates external standards, instructional skills, assessment facets, and editorial prerequisite relationships.
- `src/content` contains original lessons, shared screen/print publishing, and evidence-based coverage auditing.
- `src/server` provides parent authorization, learner ownership checks, PostgreSQL persistence, versioned problem instances, and idempotent attempts.
- `src/web` provides the responsive learner interface and browser OIDC sign-in.
- `src/commerce` separates order approval, delivery, settlement, refund, and student access grants.
- `src/funding` records US public-funding research, sources, and separate approval gates.

The server accepts numeric answers and fractions. It does not yet grade general symbolic expressions, free-form proofs, or interactive constructions. Review-readiness summarizes evidence from the practiced family; it does not certify an entire standard. Suggested practice cannot infer readiness from unimplemented prerequisites. Default sessions interleave strands, return to missed ideas after intervening work, and reserve space for due retrieval and teachable prerequisites. Choosing an idea starts one focused problem before the mix resumes. Hints and in-session lesson reading are recorded as assistance. The scheduling intervals and grade-band probes are heuristics, not validated difficulty or mastery estimates.

Practice occupies the device viewport, with explanations in focus-managed panels. Short phones use a dedicated answer panel; landscape places the keypad beside the question. The lesson library opens a selected lesson directly and restores its catalog position on return.

See [product and experience specification](docs/product-experience.md), [curriculum coverage](docs/curriculum.md), [content production](docs/production.md), [commerce](docs/commerce.md), [funding](docs/funding.md), and [deployment requirements](docs/deployment.md).
