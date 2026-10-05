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
| Activity Spec v1 | #863 | `add-aha-activity-spec` | `src/activity/`: AI-authored spec, strict validator, local grader, SVG renderer, 43 test fixtures, batch prompt. Merged #866 |
| AI-authored activities drive learning | #867 | `add-aha-ai-activities` | Signed-in + AI ready: batch of 4 specs per paid call (journal v2, 2600-token budget), durable prefetch queue, focus-stage spec rendering (lazy `ActivityView`), local grading, `ai-spec` mastery evidence (guided-only standards reachable), empty-queue local fallback. Wired and fixture-tested (unit + `test:ai` with TEST fixture specs); NOT live-verified |
| Production spending policy | #879 | `update-aha-spend-policy` | "Budget optional": any app budget the user sets in Free2Z, or none; `platform_disabled` → local practice; estimate must fit balance and budget remainder; optional 100 2Z/month sign-in suggestion; read-only budget/cost in Settings. Fixture-tested only; NOT live-verified |
| Internal delivery | #812 | Signed builds uploaded; see [RELEASE.md](RELEASE.md) | TestFlight build `0.1.0.29843614` is `IN_BETA_TESTING` in the existing internal group. Play build `29843596` is completed internally with a Console-attested existing audience. Physical installs remain unverified. |

## Active constraints
- iOS startup uses ASCII native executable identifiers (fixed in #831); the visible brand remains ¡AHA!. Native simulator learning, restart, quarantine and backup acceptance passed with proper simulator Keychain entitlements. Signed TestFlight processing and existing-group availability are verified; physical-device acceptance remains required.
- GitHub issue creation works; Project API returns missing `read:project` scope. Issues exist but board movement is not verified. Do not claim Doing/Done transitions.
- Existing primary checkout has unrelated untracked Dynawalla files. Preserve them; all AHA changes use isolated worktrees.
- SDK source preview `42acc57f` is usable; it adds opt-in structured output (`response_format`), which AI activity batches use when the model advertises it (#884, not yet live-verified). The 2026-10-05 S26 run that rejected most gpt-4o activities came from a stale APK built before #884, so no structured request was sent. The strict schema and the validator now come from one source, a property test holds them together, and every batch logs `structured=yes|no` with the reason (#890). Sign-in suggests an optional 100 2Z monthly app budget. Paid admission accepts any budget or none (#879, policy changed, not yet live-verified). Live service readiness remains unverified. See canonical `docs/free2z/sdk` in free2z/zuu.
- Paid acceptance requires an explicitly authorized account and shared spending limit, a fresh service-enforced grant, and verified service readiness. Keep account-specific testing instructions in the private runbook.
- Existing internal audiences remain unchanged. The owner additionally authorized one AHA external TestFlight tester and accepted the external-review route. Group membership and build assignment are verified; Apple beta review is pending (#848). No company roles or public links were added. The Play owner list remains verified saved and selected. Identities remain private. See [RELEASE.md](RELEASE.md).

## Current implementation boundaries
- Task-specific local teaching and bounded fresh variants support continued practice. Conceptual advancement and optional all-skill fact practice remain separate, and recent errors take priority over unrelated fluency.
- Local practice after errors (#860): one miss is retried, a second miss shows a worked example of a different task (recorded as assisted), and a skill is never repeated more than three times while failing; confidence items and bracketed step-downs replace the old one-level-per-miss cascade. Evidence rules are unchanged.
- Forgiving retry (#857): a first miss shows a short in-place nudge line and hands the answer field back for one retry; the worked explanation docks after a second miss or on "See how" (assisted). The ledger keeps one attempt per activity with an optional `firstAnswer`; a correct retry is assisted. The pending retry is saved before the nudge and resumes after restart. No native schema change (attempt data is stored as validated JSON).
- Completed AI answers remain recoverable until their presentation is saved. Settings expose saved answers, account recovery, distinct budget/balance failures, and read-only balance, app budget (with remainder) and cost per activity batch. A fixed system-browser route opens Free2Z account management.

- Learning evidence separates conceptual successes, arithmetic recall and delayed retention. Standards coverage is explicit; numerical practice does not certify every requirement of a whole standard.
- The native app labels local practice when AI is disconnected. It never represents local generation or mocked receipts as paid AI.
- Controller restoration rebuilds progress from validated attempt records and excludes disputed items. Native checkpoints and presentation sessions do not duplicate the growing evidence ledger. Failed presentation saves cannot switch the grading task behind the displayed question.
- Usage records persist before sending. Pending settlement blocks fresh paid calls; explicit recovery reuses the original request identity and rechecks the spending authorization.
- Signed-in learners with AI ready get AI-authored Activity Spec batches (#867): one paid call per 4 activities, queued in the presentation session and prefetched when one remains. Answers are graded locally and recorded as `ai-spec` evidence under the same mastery rules; restore re-validates and re-grades stored specs. Verified only with TEST fixture specs over the fake SDK/IPC; no live model output has been seen.
- When a signed-in learner's AI activity cannot be produced (outage, no model, grant check, pending receipt), the same account continues with labeled local practice and retries AI after a task/time backoff; paid calls still require fresh grant verification and settled receipts.
- Focus mode (#869): the learning loop is one screen — a slim bar (home, progress, practice-status dot), the problem, and an answer dock with five help icons in the thumb zone. Brand, taglines, Growth and Settings live on the studio home. `npm run test:ui` holds local tasks and all Activity Spec fixtures to no page scroll at 384×832, prompt/answer/Check visible at 384×500, ≤12 chrome words and 44px targets. Settings open with no gate and audience-neutral copy (#870).
- Stable stage (#892): within an item the focus bar, the problem region, the answer field and the Check/Next slot never move. Answer feedback is a toast above the dock; hints and explanations are a drawer that rises from the dock (grab handle, close button, Escape) and never covers the answer field; moving to the next item veils the finished problem with a shimmer and holds Stop inside the veil; errors float at the top of the stage until dismissed; Check and Next share one fixed-size slot that shows dots while waiting. Activity Spec help comes from the spec itself, and the Hint icon is disabled for a spec with no hints. A response label is a quiet suffix inside the answer field (or the placeholder when long), never a heading row; answers in the problem area keep a lane clear of the toast.  measures the four regions across every state at 384×832 and 820×1180 (≤1px) and checks that nothing covers the answer field while typing.
- Phone layout (verified on a physical Samsung S26, Android 16, debug build): a fixed backdrop sits behind the edge-to-edge status bar with dark icons, every control has a 44×44 CSS px hit area, the sign key appears only for grade 6+ task kinds whose answers can be negative, and figures size to their content. iOS dark mode status-bar contrast is not yet device-checked.
- Supported current-grant verification is implemented. Live Free2Z inference, native authentication, and receipt acceptance remain external/device prerequisites. Registration alone does not establish service readiness. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md).
- Settings offer Report a problem (#852): a scrubbed 200-entry diagnostics log (WebView storage, never learning data) plus version/build, platform and yes/no connection state, shared as .txt through the native share/save path or copied. Browser-fixture verified; on-device share remains unverified.
- Operational identities, login instructions and signing details belong in the private infrastructure repository, never this public status file.

## Handoff rule
Each worker records commit/PR, exact checks, outstanding failures, and next command before stopping. Keep release artifacts outside disposable worktrees. No completion claim without both required track availabilities.
