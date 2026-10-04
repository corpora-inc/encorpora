# AI activity wiring: checkpoint status (#867)

Branch `add-aha-ai-activities`. Issue #867. No PR has been opened yet, and auto-merge is not enabled.

## Done
- Provider journal v2 (`src/provider/free2z.ts`). Requests carry a per-operation `maxOutputTokens` of `'1800'` or `'2600'`. The new `activities` resume context is accepted. v1 journals stay readable and recoverable. A batch cut off by the output budget (`length`) is still deliverable, for that context only.
- Prefetch queue policy (`src/application/aiQueue.ts`) and the lazy runtime (`src/application/aiActivities.ts`: prompt, `parseBatch`, grading, `specRestorer`).
- `ai-spec` evidence in the engine (`recordSpecAttempt`, same mastery rules, every tagged skill counts). Restore re-validates the stored spec, checks its hash and re-grades the response (`src/application/recovery.ts`). The learner summary carries `missStreak`.
- Controller wiring:
  - batch request and background prefetch
  - durable `aiQueue`/`aiActivity` in the presentation session, with serialized session writes
  - lazy `<ActivityStage>` slot (`src/ui/ActivityStage.tsx`), dispute and curiosity for AI items
  - local fallback when AI is unavailable
- Tests: unit tests (`aiQueue.test.ts`, `aiActivities.test.ts`, journal v2 cases in `free2z.test.ts`) and `scripts/verify-ai.mjs` batch scenarios. These use TEST fixtures only.
- Merged origin/main (#864, #865). npm test (206), tsc, build and test:ui all passed after the merge.
- Docs: the activity README wiring section, BUILD_STATUS and INTEGRATION_STATUS are updated (wired and fixture-tested, not live-verified).

## In progress / next steps
1. Fix the adversarial-review findings, then re-run all gates.
   - HIGH: in `Controller.showSpec`, `rest` is computed before `await writeSession` and assigned after it, so a prefetch batch delivered during that write is wiped out (paid, acknowledged, then bought again). Fix: after the write, set `aiQueue.current = aiQueue.current.filter(q => q.activityId !== item.activityId)`, and build the session payload from live refs inside the callback.
   - MED: the `activities` branch of `deliverReply` does not re-check learner, account or provider after its awaits (`loadAiActivities`, `listDisputes`), so a learner switch or sign-out mid-delivery can lose the batch or deliver it to the wrong learner. Fix: re-check after each await, before merging and before acknowledging. Add `settlePrefetch()` to `onSelectLearner` and `signOut`.
   - LOW: rolling back after a failed queue save can overwrite newer state, and a concurrent duplicate delivery can acknowledge before the save. Use a functional update (remove only the ids this delivery added).
   - LOW: `parseBatch` ids use the position among accepted specs. Use the original batch index (`activityIdFor(op, originalIndex)`) so a stricter validator cannot shift the ids.
2. Merge origin/main again. Watch for the focus-mode shell (#869) in Studio.tsx and studio.css, and keep `<ActivityStage>` free of chrome.
3. Open the PR (What / Why / Blast radius / Proof), enable `gh pr merge --squash --auto`, then run `gh pr checks --watch`.
4. Optional: device smoke on R3GL80264RZ (local mode should be unchanged).

## Known failing tests
None at the checkpoint. `test:ui` can fail with "Port 1435 already in use" when another worktree runs it at the same time; retry.
