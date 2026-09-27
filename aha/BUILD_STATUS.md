# ¡AHA! build status

## Goal
Family beta on TestFlight internal + Google Play internal. Warm math-studio design. K–8 scope with deep grades 2–6; no Dynawalla adaptive-engine reuse. No public release or new Corpora infrastructure.

## Work queue
| Task | Issue | Owner/branch | Acceptance |
|---|---|---|---|
| Foundation | #806 | lead / add-aha-foundation | Frontend shell, reproducible checks, CI |
| Native storage | #807 | native / add-aha-storage | SQLite, recovery, native builds |
| Free2Z | #808 | lead next | Real SDK + separately verified live path |
| Standards and learning | #809 | mathematics / add-aha-mathematics | Original graph, exact grading, evidence |
| Experience | #810 | UI / add-aha-experience | Complete accessible guided journey |
| Integrated verification | #811 | pending | Native/live/security evidence |
| Internal delivery | #812 | pending | Processed builds + tester availability |

## Active constraints
- GitHub issue creation works; Project API returns missing `read:project` scope. Issues exist but board movement is not verified. Do not claim Doing/Done transitions.
- Existing primary checkout has unrelated untracked Dynawalla files. Preserve them; all AHA changes use isolated worktrees.
- SDK source preview is usable; live service readiness remains unverified. See canonical `docs/free2z/sdk` in free2z/zuu.
- User authorized up to $5 existing Free2Z balance, no top-ups. User identifies account at sign-in; no paid calls before then.
- Existing authorized internal testers first. No new invitations or company roles.

## Handoff rule
Each worker records commit/PR, exact checks, outstanding failures, and next command before stopping. Keep release artifacts outside disposable worktrees. No completion claim without both required track availabilities.
