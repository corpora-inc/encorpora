# ¡AHA! build status

## Goal
Family beta on TestFlight internal + Google Play internal. Warm math-studio design. K–8 scope with deep grades 2–6; no Dynawalla adaptive-engine reuse. No public release or new Corpora infrastructure.

## Work queue
| Task | Issue | Owner/branch | Acceptance |
|---|---|---|---|
| Foundation | #806 | Merged #813 | Frontend shell, reproducible checks, CI |
| Native storage | #807 | Merged #820 | SQLite, recovery; Android debug build and iOS cross-check verified |
| Free2Z | #808 | PR #824 + native SDK host PR #827 | Real SDK packaged; paid/live acceptance remains blocked |
| Standards and learning | #809 | Merged #815 | Original K–8 graph; 90 verified numerical facets, 139 guided-only standards |
| Experience | #810 | Merged #814; controller integration in progress | Accessible guided journey and bounded visual renderers |
| Integrated verification | #811 | 65 tests + controller browser regressions pass; emulator verification in progress | Browser fixtures are not native/live acceptance |
| Internal delivery | #812 | Release tooling merged #821 | Both store records exist; Apple internal tester preflight verified; no processed tester-available build yet |

## Active constraints
- GitHub issue creation works; Project API returns missing `read:project` scope. Issues exist but board movement is not verified. Do not claim Doing/Done transitions.
- Existing primary checkout has unrelated untracked Dynawalla files. Preserve them; all AHA changes use isolated worktrees.
- SDK source preview is usable; live service readiness remains unverified. See canonical `docs/free2z/sdk` in free2z/zuu.
- User authorized up to $5 existing Free2Z balance, no top-ups. User identifies account at sign-in; no paid calls before then.
- Existing authorized internal testers first. No new invitations or company roles.

## Current implementation boundaries
- Learning evidence separates conceptual successes, arithmetic recall and delayed retention. Standards coverage is explicit; numerical practice does not certify every requirement of a whole standard.
- The native app labels local practice when AI is disconnected. It never represents local generation or mocked receipts as paid AI.
- Controller restoration rebuilds progress from validated attempt records and excludes disputed items. Native checkpoints and presentation sessions do not duplicate the growing evidence ledger. Failed presentation saves cannot switch the grading task behind the displayed question.
- Usage records persist before sending. Pending settlement blocks fresh paid calls; explicit recovery reuses the original request identity and rechecks the spending authorization.
- Live Free2Z inference and authoritative total-grant verification remain external prerequisites. Registration alone does not establish service readiness. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).
- Operational identities, login instructions and signing details belong in the private infrastructure repository, never this public status file.

## Handoff rule
Each worker records commit/PR, exact checks, outstanding failures, and next command before stopping. Keep release artifacts outside disposable worktrees. No completion claim without both required track availabilities.
