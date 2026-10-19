# AMP

AMP is an independent TypeScript/PostgreSQL mathematics product. Follow the repository trunk procedure. AHA's app-specific identity and persistence constraints do not apply here.

- Keep curriculum coverage claims tied to the machine-readable audit. A mapped skill is not an implemented or verified skill.
- Mathematical truth is server-owned and deterministic. Never send grading secrets in a public problem payload.
- Preserve immutable problem versions and evidence. Retries must not duplicate attempts or progress credit.
- Parent/learner authorization must be enforced on the server. Development authentication is loopback-only and forbidden in production.
- Content authors and independent reviewers are separate workers. Do not certify a generator by calling its own answer function twice.
- Public copy explains the current product without conversation history. Provider approval requires evidence from the specific program.
- **Local gates (fast-building stage, fail forward):** before pushing, run `npm run tsc`, `npm test`, and only the database or browser scripts for what you changed. Don't run the whole `test:family-ui` chain locally; CI runs it.
- **CI** runs three parallel jobs through the ci-gate aggregate:
  - `amp` (unit, build, database) gates every PR and the merge queue;
  - `amp-browser` and `amp-content` run only after merge, on main.

  A red main files or updates one issue. Fix those failures forward in batches with a small PR, not a revert, unless prod is broken. Before a launch or release, everything must be green.
- Money, consent and privacy paths (`src/billing`, `src/parent-consent`, `src/privacy`, `src/family`) always get database tests in the PR itself.

## Interface acceptance

- Each screen and tab has a URL; browser history, refresh and direct links restore it.
- Family and learner data share one account-scoped store. Refresh it on navigation and mutation, and reject responses from an obsolete account session.
- Present an action only when its prerequisites are satisfied. Guide new parents through consent, access and learner setup without bypassing server authorization.
- Errors explain the failed action and recovery, are logged without private request data, and appear inline in reserved space or as fixed overlays. Async loading and feedback must not move existing controls.
- Use shared, accessible controls with visible focus, readable labels and touch targets of at least 44 px.
- Verify real browser behavior and attach synthetic screenshots at 320, 390, 768 and 1280 px in light and dark themes. Measure overflow and bounding boxes during loading, validation and failed requests; verify learner state across navigation.

### Web application boundaries

Follow [the web architecture](docs/architecture/web-app.md). New auth and onboarding screens live in `src/web/features/`; typed TanStack routes and providers live in `src/web/app/`. `main.tsx` only bootstraps providers and the router. TanStack Query owns the account-scoped `/me` resource, including its Family projection; zustand owns selection and memory-only form drafts. Server mutations invalidate that canonical resource. Shared accessible controls and theme tokens live in `src/web/ui/`. The legacy host bridges Family, billing, trial, lessons and practice until their feature migrations; do not add new screens to it.
