# AMP

AMP is an independent TypeScript/PostgreSQL mathematics product. Follow the repository trunk procedure. AHA's app-specific identity and persistence constraints do not apply here.

- Keep curriculum coverage claims tied to the machine-readable audit. A mapped skill is not an implemented or verified skill.
- Every new skill must join a stable exposure objective in `src/curriculum/selection.ts`. Fine-grained graph steps and new generators share that objective’s budget; creating an objective is an intentional curriculum-mix change. Keep frequency weights separate from difficulty.
- Follow [the pathway selection model](docs/pathway-selection.md) for adaptive metadata. Preserve direct evidence separately from inferred prerequisite support; do not award ancestor mastery from a downstream answer.
- Put selection tuning in the validated, versioned `src/learning/practice-policy.ts` configuration. Inject a compiled policy per run; test default equivalence and changed-parameter behavior. Keep learner-estimator and evidence-projection revisions separate.
- Mathematical truth is server-owned and deterministic. Never send grading secrets in a public problem payload.
- Preserve immutable problem versions and evidence. Retries must not duplicate attempts or progress credit.
- Parent/learner authorization must be enforced on the server. Development authentication is loopback-only and forbidden in production.
- Content authors and independent reviewers are separate workers. Do not certify a generator by calling its own answer function twice.
- Public copy explains the current product without conversation history. Provider approval requires evidence from the specific program.
- **Local gates (fast-building stage, fail forward):** before pushing, run `npm run tsc`, `npm run test:core`, and only the database or browser scripts for what you changed. `npm test` runs the core, content and inventory suites when a full local check is needed. The exhaustive inventory is a post-merge content check; it is not a pre-merge gate. Don't run the whole `test:family-ui` chain locally; CI runs it.
- **Routine CI:** `amp` (core unit, typecheck, build, database) feeds the required `ci-gate` aggregate on PRs, the merge queue and main.
- **Deep checks:** `amp-browser` and `amp-content` run in the independent `AMP deep checks` workflow, selected by changed paths on main and also nightly or manually. Content checks include the full inventory and reuse only a successful result matching the exact content inputs and runner environment. Scheduled and manual runs force revalidation. The fingerprint policy is `.github/scripts/amp_inventory_paths.py`; unknown AMP inputs are included. Failures file or update a follow-up issue. Fix those failures forward with a small PR; they do not hold routine deployment.
- **Launch acceptance:** before a launch, including a paid acquisition campaign, require successful `amp`, `ci-gate`, `amp-browser` and `amp-content` checks on the launch candidate commit. Routine deployment eligibility alone does not establish launch readiness.
- **Green ships.** Routine production deployment selects the newest `main` commit touching `amp/` with successful `amp` and `ci-gate` checks in the same `CI` run at their latest attempt. Failed, cancelled, skipped or missing checks do not qualify. If the newest commit is not green, the poll can select an earlier green commit but never replace a live release with an older one. `scripts/release-status.sh` shows what is live and why ([Releases](docs/deployment.md#releases)).
- Money, consent and privacy paths (`src/billing`, `src/parent-consent`, `src/privacy`, `src/family`) always get database tests in the PR itself.

## Interface acceptance

- Each screen and tab has a URL; browser history, refresh and direct links restore it.
- Family and learner data share one account-scoped store. Refresh it on navigation and mutation, and reject responses from an obsolete account session.
- Present an action only when its prerequisites are satisfied. Guide new parents through consent, access and learner setup without bypassing server authorization.
- Errors explain the failed action and recovery, are logged without private request data, and appear inline in reserved space or as fixed overlays. Async loading and feedback must not move existing controls.
- Use shared, accessible controls with visible focus, readable labels and touch targets of at least 44 px.
- Audit interactions alongside geometry: typing, long paste, deletion to empty, clear/reset, Escape, focus, browser Back/Forward and reload. User-entered filters must stay within route limits, and malformed shared search values must recover without replacing the screen with an error.
- Review complete composed screens in guest, signed-in and paid states. Inspect visual hierarchy, typography, alignment and control weight in screenshots; overflow and touch-target assertions alone do not establish visual quality. Keep skill titles readable rather than truncating them to make room for secondary controls.
- Verify real browser behavior and attach synthetic screenshots at 320, 390, 768 and 1280 px in light and dark themes. Measure overflow and bounding boxes during loading, validation and failed requests; verify learner state across navigation.

### Web application boundaries

Follow [the web architecture](docs/architecture/web-app.md). New auth and onboarding screens live in `src/web/features/`; typed TanStack routes and providers live in `src/web/app/`. `main.tsx` only bootstraps providers and the router. TanStack Query owns the account-scoped `/me` resource, including its Family projection; zustand owns selection and memory-only form drafts. Server mutations invalidate that canonical resource. Shared accessible controls and theme tokens live in `src/web/ui/`. The legacy host bridges Family, billing, trial, lessons and practice until their feature migrations; do not add new screens to it.
