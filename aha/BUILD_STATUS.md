# ¡AHA! build status

Start a fresh session with [HANDOFF.md](HANDOFF.md).

## Goal
Family beta on TestFlight internal + Google Play internal. Warm math-studio design. K–8 scope with deep grades 2–6; no Dynawalla adaptive-engine reuse. No public release or new Corpora infrastructure.

## Work queue
| Task | Issue | Owner/branch | Acceptance |
|---|---|---|---|
| Foundation | #806 | Merged #813 | Frontend shell, reproducible checks, CI |
| Native storage | #807 | Merged #820 | SQLite, recovery; Android debug build and iOS cross-check verified |
| Free2Z | #808 | Merged #824/#827/#843 | Unified SDK + current-grant integration; paid/live acceptance remains pending |
| Standards and learning | #809 | Merged #815/#840 | Original K–8 graph; 90 verified numerical facets, 139 guided-only standards |
| Experience | #810 | Merged #814/#824/#842/#843 | Accessible guided journey and bounded visual renderers |
| Integrated verification | #811 | 99 tests + controller/SDK browser regressions pass; native Android emulator/upgrade and iOS simulator verified | See ACCEPTANCE.md; live and physical-device acceptance remains |
| Internal delivery | #812 | Signed builds uploaded; see [RELEASE.md](RELEASE.md) | TestFlight build `0.1.0.29843614` is `IN_BETA_TESTING` in the existing internal group. Play build `29843596` is completed internally with a Console-attested existing audience. Physical installs remain unverified. |

## Active constraints
- iOS startup uses ASCII native executable identifiers (fixed in #831); the visible brand remains ¡AHA!. Native simulator learning, restart, quarantine and backup acceptance passed with proper simulator Keychain entitlements. Signed TestFlight processing and existing-group availability are verified; physical-device acceptance remains required.
- GitHub issue creation works; Project API returns missing `read:project` scope. Issues exist but board movement is not verified. Do not claim Doing/Done transitions.
- Existing primary checkout has unrelated untracked Dynawalla files. Preserve them; all AHA changes use isolated worktrees.
- SDK source preview is usable; live service readiness remains unverified. See canonical `docs/free2z/sdk` in free2z/zuu.
- Paid acceptance requires an explicitly authorized account and shared spending limit, a fresh service-enforced grant, and verified service readiness. Keep account-specific testing instructions in the private runbook.
- Existing internal audiences remain unchanged. The owner additionally authorized one AHA external TestFlight tester and accepted the external-review route. Group membership and build assignment are verified; Apple beta review is pending (#848). No company roles or public links were added. The Play owner list remains verified saved and selected. Identities remain private. See [RELEASE.md](RELEASE.md).

## Current implementation boundaries
- Task-specific local teaching and bounded fresh variants support continued practice. Conceptual advancement and optional all-skill fact practice remain separate, and recent errors take priority over unrelated fluency.
- Completed AI answers remain recoverable until their presentation is saved. Parent controls expose saved answers, account recovery, and distinct allowance/balance failures. A fixed system-browser route opens Free2Z account management.

- Learning evidence separates conceptual successes, arithmetic recall and delayed retention. Standards coverage is explicit; numerical practice does not certify every requirement of a whole standard.
- The native app labels local practice when AI is disconnected. It never represents local generation or mocked receipts as paid AI.
- Controller restoration rebuilds progress from validated attempt records and excludes disputed items. Native checkpoints and presentation sessions do not duplicate the growing evidence ledger. Failed presentation saves cannot switch the grading task behind the displayed question.
- Usage records persist before sending. Pending settlement blocks fresh paid calls; explicit recovery reuses the original request identity and rechecks the spending authorization.
- Supported current-grant verification is implemented. Live Free2Z inference, native authentication, and receipt acceptance remain external/device prerequisites. Registration alone does not establish service readiness. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).
- Operational identities, login instructions and signing details belong in the private infrastructure repository, never this public status file.

## Handoff rule
Each worker records commit/PR, exact checks, outstanding failures, and next command before stopping. Keep release artifacts outside disposable worktrees. No completion claim without both required track availabilities.
