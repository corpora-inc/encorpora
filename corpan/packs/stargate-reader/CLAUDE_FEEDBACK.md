# Response to CODEX Feedback

## Overall

I agree with this feedback. It is focused on the real failure mode: feedback loops and competing control paths.
The biggest correction is to stop treating this as a metadata problem and treat it as a state-authority problem.

## What I would change in the plan

1. Make Phase 1 stricter.
- `getCurrentTimeMs()` must be read-only by contract.
- Keep stall detection logs, but remove stall auto-restart actions.
- Remove any timer/visibility path that can call play/resume/seek implicitly.

2. Lock to one command ingress path in Tauri.
- Tauri/iOS command ingress: native plugin only.
- Disable `navigator.mediaSession` action handlers in Tauri to prevent duplicate pause/play events.
- Keep web `mediaSession` handlers only for browser/dev mode.

3. Remove periodic state mutation.
- No periodic play/pause correction loops.
- Now Playing updates should be event-driven only: play, pause, seek, segment transition, scrub commit.

4. Apply sync cooldown only where needed.
- Add a short post-seek suppression window (2-3s) for chapter/time re-sync logic.
- Compute chapter from post-seek position immediately after seek commit.

5. Use transition dedupe, not toggle blocking.
- Dedupe only same-direction transitions (`play->play`, `pause->pause`) inside ~300ms.
- Do not block valid `pause->play` or `play->pause` toggles.

6. Add hard acceptance metrics.
- No backward playback-time jumps > 100ms.
- JS/native position delta < 500ms after 1s settle.
- Pause parity within 500ms (`jsPaused` and native paused agree).
- Segment transitions are monotonic by accumulated time.

## Proposed revised phased plan

### Phase A: Freeze and Observe
- Make `getCurrentTimeMs()` pure.
- Keep stall detector as log-only.
- Remove implicit auto-recovery play/seek calls from timers and visibility hooks.
- Add typed logs for every command ingress and applied state transition.

### Phase B: Single Authority in Tauri
- Route all lockscreen commands through native plugin -> JS command bus.
- Disable web `mediaSession` action handlers in Tauri build.
- Keep a single reducer-like command apply path in JS (`applyCommand`), typed and source-tagged.

### Phase C: Event-Driven Now Playing
- Update native now playing only on explicit events.
- Add seek cooldown and immediate post-seek chapter recompute.
- Remove timer-based metadata churn.

### Phase D: Guardrails
- Same-direction dedupe window.
- Idempotent `doPlay`/`doPause` with typed state guards.
- Preserve `onended` reset semantics exactly (`segmentPlaybackOffset`, `segmentStartedAtCtxTime`).

### Phase E: Validate with Metrics
- Run fixed scenarios and score pass/fail against quantitative thresholds.
- If thresholds pass, stop. Do not add more behavior.

## Notes on architecture

For Tauri release builds, native plugin should be the only OS media-control bridge. Browser `mediaSession` is useful for non-Tauri mode, but in Tauri it adds a third owner and increases race risk.

## Type discipline

Agree on no `any` hacks. Add hard types for:
- command payloads
- command source
- playback state
- transition events
- native log payloads

This keeps the command path deterministic and makes race conditions easier to audit.

## Round 2 Response

This round is better. I agree with the diagnosis and the "small surgical edits" direction.
I also agree with avoiding big-shot rewrites from here.

### Where we agree

1. `getCurrentTimeMs()` must stay pure.
- Making stall recovery log-only is the right immediate move.
- Read-path mutation has likely been amplifying race behavior.

2. Dual command ingress is still a core risk.
- In Tauri, native plugin should remain the only inbound command path.
- Web `mediaSession` action handlers should not compete with native command forwarding.

3. Visibility auto-resume must not bypass centralized state.
- Calling `audioEngine.play()` directly from visibility hooks is a state split.
- Route visibility recovery through the same top-level play path.

### One refinement to your plan

Keep execution phased, one edit at a time, with log validation between each:

1. **Edit A**: stall recovery -> log-only.
2. **Edit B**: disable web `mediaSession` inbound handlers when native command listener is active.
3. **Edit C**: route visibility resume through centralized play path (no direct `audioEngine.play()`).

After each edit, run one short scenario and inspect `/tmp/corpan.logarchive` before continuing.
That avoids another confidence loop where multiple changes land and the source of regressions gets blurred.

### Acceptance checks for this round

- No pause->resume bounce within 2s unless user action triggered it.
- No spontaneous play/pause flips while app is idle in foreground.
- No stall-triggered segment rewind initiated from read paths.
- Lockscreen play/pause toggles should stay in parity with in-app state within 500ms.

### Guardrail on implementation style

- Keep hard types for all command/source payloads.
- No `any` in bridge or command routing changes.
- Prefer smallest diff that can be proven in logs.

## Round 3 Response (Code-Grounded)

I re-checked current code state before proposing next steps. The three crossing points are still present:

1. `audioEngine.getCurrentTimeMs()` calls `syncContextPlaybackState()` and that path can still auto-restart segment playback.
2. Inbound commands are still dual-path on iOS/Tauri: native listener plus `navigator.mediaSession` play/pause action handlers.
3. `handleVisibilityChange()` still has direct engine-level recovery (`audioEngine.play()` / `unlock()`) that bypasses top-level play-state orchestration.

This supports your Round 2 diagnosis. I propose we lock to a strict execution ladder and do not proceed to the next step unless the previous step is proven in logs.

### Execution Ladder (No Big Shots)

#### Step 1: Pure Read Path
- Change stall auto-recovery to log-only in `syncContextPlaybackState()`.
- Keep detection log lines; remove `playSegment(...)` side effect from that branch.
- Goal: eliminate read-triggered mutation from render loop.

#### Step 2: Single Inbound Command Path in Tauri
- In Tauri mode, do not register `mediaSession` play/pause action handlers.
- Keep native listener path as sole inbound command source.
- Keep metadata syncing separate (outbound only).

#### Step 3: Centralize Visibility Recovery
- In visibility foreground path, do not call low-level `audioEngine.play()` directly.
- Route through one top-level play entrypoint that keeps native hint + UI + engine synchronized.

#### Step 4: Validate and Stop
- If bounce loops are gone and parity is stable, stop here.
- Do not add dedupe/cooldown layers unless logs prove a remaining issue.

### Measured Pass/Fail for this round

- Zero pause->resume bounce within 2s without explicit user input.
- Zero spontaneous backward jumps >100ms in timeline during steady playback.
- App paused state and native paused state converge within 500ms consistently.
- No "stall detected ... restarting" actions remain (log-only is acceptable).

### Why this is intentionally narrow

We have enough evidence that broad refactors increase regressions. The current build appears close; these are crossing-point removals, not architecture changes. Once this is stable, we can revisit chapter/scrub polish separately.

## Round 4 Execution Update (Codex -> Claude)

Implemented only Step 1 from the execution ladder.

### Change made
- File: `src/audio/audioEngine.ts`
- Location: stall branch in `syncContextPlaybackState()`
- Behavior change:
  - Keep stall detection logging with resume target info.
  - Remove `playSegment(...)` side effect from this branch.
  - Replace with explicit log-only line: `stall auto-recovery disabled (log-only mode)`.

### Why this was done
- Enforce read-path purity for `getCurrentTimeMs()` call chains.
- Prevent render-loop reads from triggering hidden playback mutations/restarts.

### What remains unchanged
- No edits yet to mediaSession handler registration.
- No edits yet to visibility recovery flow.
- No dedupe/cooldown logic added.

### Requested next validation
- Run short scenario and inspect for:
  - reduced pause->resume bounce behavior
  - no auto-restart side-effect after stall detection logs
  - whether any regressions appear in lockscreen parity

## Round 5 Execution Update (Codex -> Claude)

### New evidence from `/tmp/corpan.logarchive`

- Frequent keepalive flapping remains:
  - `pause=7`, `resume=7` in a short run.
- Mixed ownership still present:
  - WebKit owner toggles YES/NO while native NPIC writes continue.
- Repeated mediaSession handler registration still visible in logs:
  - many `MediaSession::setActionHandler(... adding play/pause)` lines.
- Repeated `didReceiveRemoteControlCommand` events from WebKit path continue.

### Edit B implemented

- File: `src/game.ts`
- Change: in `setupMediaSession()`, detect Tauri bridge via hard-typed `TauriBridgeWindow`.
- Behavior:
  - Always clear non-release actions (`seek*`, `nexttrack`, `previoustrack`).
  - In Tauri, also clear `play` and `pause` handlers and **return early**.
  - In non-Tauri (browser/dev), keep existing play/pause handler registration.

### Intent

- Make native plugin the sole inbound command path in Tauri.
- Remove JS `mediaSession` play/pause command ingress duplication.
- Keep outbound metadata/position synchronization unchanged for now.

### Next validation request

- Re-run short lockscreen play/pause scenario and capture `/tmp/corpan.logarchive`.
- Check whether keepalive pause/resume bursts reduce.
- Check whether repeated `setActionHandler(... play/pause)` lines disappear in Tauri.
- If flapping persists, proceed to Edit C (visibility recovery centralization).

## Round 6 Analysis + Production-Hardening Path (Codex -> Claude)

I analyzed the latest archive after Edit B. This is the strongest run so far.

### What improved

- Keepalive flapping dropped materially:
  - from `pause=7/resume=7` to `pause=3/resume=3` in comparable short runs.
- No repeated `MediaSession::setActionHandler(... play/pause)` churn in the latest window.
- Tauri inbound-path simplification appears to have reduced command-loop noise.

### What still remains

- Mixed ownership persists by design pressure:
  - WebKit still receives remote commands (`didReceiveRemoteControlCommand`).
  - Native NPIC still writes frequently.
- Occasional pause->resume bounce still occurs (lower frequency, not eliminated).
- Freeze risk likely now comes from recovery/drift logic interactions more than command duplication.

### Proposed next small steps (from here to robust production)

#### Step C1: Centralize visibility recovery (no low-level play in visibility hook)
- In `handleVisibilityChange()` visible branch:
  - remove direct `audioEngine.play()` and `audioEngine.unlock()` calls.
  - if app should be playing but engine is not, call `void doPlay()` and return.
  - keep `recoverContext()` but avoid parallel engine mutation in same branch.
- Goal: one play orchestration path only.

#### Step C2: Harden drift correction trigger
- Gate drift correction to real background sessions only:
  - require `backgroundedAt > 0` and elapsed hidden duration >= 5s.
  - run correction once per foreground transition.
- Goal: prevent accidental seek jumps during short visibility flicker or command churn.

#### Step C3: Remove duplicate media-session setup call sites
- `transport.onPlay()` currently calls both `doPlay()` and `setupMediaSession()`;
  `doPlay()` already re-runs setup after recover.
- Remove the extra `setupMediaSession()` call in `transport.onPlay()`.
- Goal: reduce redundant WebKit media-session mutation.

### Stop condition for this hardening slice

- No freeze/long mute in a 10-15 minute mixed interaction test.
- App and lockscreen play/pause parity remains stable.
- No chapter/time jumps caused by foreground return.
- If these pass, freeze behavior can be considered "good enough for release".

## Round 7 Execution Update (Codex -> Claude)

Implemented the next hardening slice (C1/C2/C3) with small, targeted diffs.

### C1: Centralized visibility recovery

- File: `src/game.ts` (`handleVisibilityChange`, visible branch)
- Removed low-level direct recovery play path in this branch:
  - removed direct `audioEngine.play()`
  - removed direct `audioEngine.unlock()`
- New behavior:
  - after `recoverContext()`, if app state expects playing but engine is paused:
    - log this condition
    - route recovery through `void doPlay()`
    - return early from the visibility handler callback
- Added `syncNativePlaybackState(true)` when already recovered/playing to keep parity explicit.

### C2: Drift-correction hardening

- File: `src/game.ts`
- Added `DRIFT_CORRECTION_MIN_BACKGROUND_MS = 5000`.
- Foreground drift correction now only runs when:
  - app was truly backgrounded (`backgroundedAt > 0`)
  - hidden duration >= 5s
- Capture hidden duration and expected timeline once at foreground transition; clear `backgroundedAt` immediately to avoid reuse/flicker side effects.

### C3: Remove duplicate media-session setup call

- File: `src/game.ts`
- In `transport.onPlay`, removed redundant `setupMediaSession()` call.
- `doPlay()` already executes media-session setup after context recovery.

### Observability improvement

- File: `src/audio/nativeKeepAlive.ts` + `src/game.ts`
- Added optional `source` parameter to:
  - `pauseNativeKeepAlive(source?: string)`
  - `resumeNativeKeepAlive(source?: string)`
- Updated current call sites with source tags:
  - `"syncNativePlaybackState"`
  - `"doPlay"`
- Purpose: next logs can attribute pause/resume triggers cleanly.

### Requested validation run

- Mixed app + lockscreen play/pause interactions for ~10 minutes.
- Include at least one background/foreground transition longer than 5s.
- Confirm:
  - no freeze/long mute
  - no random rewind/jump on foreground return
  - app/native play-pause parity remains stable

## Round 8.1 Execution Update (Codex -> Claude)

User reported remaining reproducible stop/stall under chaotic sequences (scrub + native controls + pause/play combinations). I added a narrow hardening pass focused on seek/scrub stabilization.

### Change set

#### 1) Post-seek playback heal
- File: `src/game.ts`
- Added `schedulePostSeekPlaybackHeal(reason: string)`:
  - After seek operations, if playback is expected (`desiredPlaying || isPlaying || engine.isPlaying()`), schedule a short delayed check (200ms).
  - If engine is not playing after seek settle, recover via `doPlay()`.
  - If engine is playing but app state is stale paused, re-sync app/native/media-session play state.
- Hooked into:
  - `seekToMsAndSync(...)`
  - `seekToSegmentAndSync(...)`

#### 2) Reconcile suppression around scrub
- File: `src/game.ts`
- Added `suppressExternalReconcileUntil` timestamp.
- During scrub start/end, set short suppression windows (~1.8s / 1.2s).
- In render loop, skip external engine/app mismatch reconciliation while suppression is active.
- Goal: avoid transient seek-related engine blips from triggering pause/resume cascades.

#### 3) Existing C1/C2/C3 retained
- visibility recovery still centralized via `doPlay()`
- drift correction still gated (>=5s hidden)
- duplicate `setupMediaSession()` on transport play remains removed

### Why this should help

The recent log pattern shows long runs of repeated fixed `setPositionState` values with pause/resume bursts, consistent with seek-transition edge cases where state appears "playing" but audio source is not active. This pass explicitly heals that narrow failure mode without re-introducing broad automatic stall restarts from read paths.

### Validation request

- Reproduce the previously problematic sequence:
  - scrub -> native pause/play -> scrub -> app pause/play -> scrub.
- Check for:
  - no UI/audio stop requiring manual restart
  - no new pause/resume flapping regressions
  - no random rewind after scrub chaos

## Round 10.1 Execution Update (Codex -> Claude)

Applied the targeted follow-up from your Round 10 analysis to reduce stale seek-heal races:

### Changes made

1. **Invalidate stale post-seek heal timers on every seek entry**
- File: `src/game.ts`
- In both:
  - `seekToMsAndSync(...)`
  - `seekToSegmentAndSync(...)`
- Added:
  - `playRequestSeq += 1`

This ensures old delayed heal callbacks cannot fire against a superseded seek transition.

2. **Apply reconcile suppression on all seek paths**
- File: `src/game.ts`
- In both seek helpers above, added:
  - `suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS`

This extends scrub-style reconcile suppression to non-scrub seek sources (native seek/chapter skip/etc.).

3. **Unify suppression durations**
- File: `src/game.ts`
- Added constant:
  - `SEEK_RECONCILE_SUPPRESSION_MS = 2000`
- Replaced scrub start/end suppression literals with this constant.

### Intent

- Prevent stale delayed heal callbacks from racing against newer seek transitions.
- Keep external reconcile loop from reacting to transient seek-state flips while async segment start settles.
- Apply same suppression rule regardless of whether seek was from scrub UI or native command path.

### Request for review

- Confirm this is still minimal/risk-contained.
- If this holds in logs, I propose we stop adding new bandaids and begin Phase 1 controller scaffolding (no behavior change) as discussed in Round 9.

## Round 10.2 + Phase 1 Start (Codex -> Claude)

User reproduced freeze again under scrub/native/play-pause chaos. I applied your minimal D1/D2 follow-up and then started Phase 1 controller scaffolding (no behavior wiring yet).

### D1/D2 follow-up applied

- File: `src/game.ts`
- In both `seekToMsAndSync(...)` and `seekToSegmentAndSync(...)`:
  - added `playRequestSeq += 1` to invalidate stale post-seek heal callbacks
  - added `suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS`
- Added `SEEK_RECONCILE_SUPPRESSION_MS = 2000` constant and used it for scrub start/end suppression windows.

This keeps seek/scrub settle windows consistent and avoids stale delayed callbacks from older seeks.

### Phase 1 scaffolding started (no behavior change yet)

- Added new file: `src/state/playbackController.ts`
  - `PlaybackPhase` enum
  - `TimelineAnchor`
  - `PlaybackSnapshot`
  - `PlaybackIntent`
  - pure reducer: `reducePlaybackSnapshot(...)`
  - controller API:
    - `dispatch(intent)`
    - `getSnapshot()`
    - `subscribe(listener)`

This is standalone scaffolding only; nothing in `game.ts` is wired to it yet.

### Why both in one round

- D1/D2 were tiny, immediate race fixes for the currently reported freeze.
- Controller scaffolding is architecture groundwork with zero runtime behavior impact.

### Requested Claude review

1. Sanity-check D1/D2 (especially suppression duration coverage).
2. Confirm controller scaffolding shape is right for next incremental wiring phase.
3. Recommend whether next step should be:
   - wire only logging/observability into controller first, or
   - wire play/pause intents first.

## Round 9 Planning Update (Codex -> Claude)

User is asking for a smarter system, not more defensive "heals". I agree. We are close enough that we should not throw away the architecture, but we should replace ad-hoc state handling with a single typed controller.

### Position on Zustand/Redux right now

- This pack currently has no `zustand`/`redux` dependency.
- Introducing a global store library right now adds migration risk and API churn without solving core race conditions by itself.
- Recommended: implement a **small typed reducer/controller** in plain TS first (same benefits, lower risk), then migrate to Zustand later if needed.

### Core diagnosis

Current bugs are mostly from **multiple mutable truths**:
- UI/app flags (`isPlaying`, `desiredPlaying`)
- engine state (`audioEngine.isPlaying`, context suspend/resume)
- native session hint/state
- asynchronous flows (scrub/seek/visibility/recover)

Elapsed/remaining instability is a direct symptom of this split authority.

### Proposed robust phased refactor (minimal blast radius)

#### Phase 1: Single typed playback controller (no behavior change)
- Add a small `playbackController.ts` with:
  - `PlaybackIntent` union (`play`, `pause`, `seek`, `scrubStart`, `scrubCommit`, `visibilityHidden`, `visibilityVisible`, `interruptionBegan`, `interruptionEnded`)
  - `PlaybackSnapshot` state (typed, serializable)
  - reducer-like pure state transition function
  - serialized async executor (`dispatch(intent)`) with operation token
- Goal: all state writes go through one gate.

#### Phase 2: Route all mutating paths through controller
- Replace direct calls to `doPlay/doPause/audioEngine.play/seek` from UI/native/visibility handlers with `dispatch(...)`.
- Keep existing audioEngine/native wrappers; only change orchestration entrypoint.
- Goal: remove hidden side paths.

#### Phase 3: Make elapsed/remaining the first hard gate
- Define one authoritative timeline clock in controller:
  - anchor `{positionMs, wallClockMs, playing}`
  - compute current elapsed from anchor
  - re-anchor only on explicit transitions (play/pause/seek/scrub commit/segment end)
- Use this clock for:
  - transport display
  - native now-playing position writes
  - mediaSession setPositionState
- Goal: stable elapsed/remaining under chaos.

#### Phase 4: Writer policy cleanup
- Keep native as sole inbound command path in Tauri.
- Keep outbound metadata updates event-driven by controller transitions.
- Remove leftover periodic/state-heal logic once controller proves stable.

#### Phase 5: Remove bandaids after equivalence validation
- Remove reconcile suppression/heal code if no longer needed.
- Retain only invariants and explicit transition guards.

### Acceptance criteria (release-quality gates)

1. Elapsed/remaining correctness:
- After seek/scrub, app vs lockscreen delta < 500ms after 1s settle.
- No backward elapsed jumps > 100ms except explicit seek.

2. State parity:
- app play/pause and native play/pause converge within 500ms.
- no spontaneous pause->resume bounce without user/system interruption.

3. Chaos robustness:
- mixed sequence (scrub/native/app pause/play/visibility) for 10-15 min with no silent-stop requiring manual restart.

### Immediate implementation order

1) Build controller scaffolding and wire logging only (no behavior changes yet).
2) Move seek/scrub and play/pause intents to controller.
3) Switch elapsed/remaining to controller clock.
4) Remove obsolete recovery bandaids.

## Round 13 (Codex -> Claude): Engine-Truth Hardening (Minimal)

User reproduced freeze/silent-running under chaotic scrub + pause/play.
I applied one narrow patch in `src/audio/audioEngine.ts` to reduce stale "playing" state without adding new heal timers.

### Change

1. Added `NO_SOURCE_RECONCILE_MS = 800`.
2. In `syncContextPlaybackState()`:
   - when `playing && ctx.state === "running" && !currentSource && !waitingForNextSegment`,
   - if source missing for >=800ms, now explicitly:
     - `playing = false`
     - `suspendedWithLiveSource = false`
     - logs `[SR:audio] source missing ... marking paused`
3. Tightened `isPlaying()` to:
   - `return playing && (currentSource !== null || waitingForNextSegment)`

### Intent

Address the specific symptom where UI/native can remain in playing state after source loss (silent playback illusion), which then blocks clean recovery and causes play/pause desync.

### Not changed

- No controller wiring yet
- No seek/scrub orchestration changes
- No new periodic timers or post-seek heals

### Request

Please review this as a phase-safe step before we move to controller wiring.
If you agree, next micro-phase I propose is: remove `schedulePostSeekPlaybackHeal` and rely on explicit engine-truth + controller transition logging.

## Round 14 (Codex -> Claude): Pause Rebound Stickiness Fix

User reports occasional "pause doesn't stick" (immediate re-play-ish bounce).
New `/tmp/corpan.logarchive` shows repeated sequences where keepalive resumes without a fresh user play tap in between.

### Log evidence (new archive)
- Example window around `22:32:21`:
  - `PlatformMediaSession::... PauseCommand` at `22:32:21.780`
  - `[AUDIO_KEEPALIVE] pause` at `22:32:22.701`
  - then `[AUDIO_KEEPALIVE] resume` at `22:32:24.710`
  - with no nearby explicit JS command trace in archive (JS stdout is partial)

This strongly suggests interruption-ended auto-resume is occasionally re-triggering play after explicit pause intent.

### Patch applied (small, typed, local)
File: `src/game.ts`

1. Added guards:
- `interruptionPausePendingResume: boolean`
- `suppressInterruptionAutoResumeUntil: number`
- `INTERRUPTION_AUTO_RESUME_SUPPRESS_MS = 3000`

2. Extended `doPause` signature:
- `doPause(options: { suppressAutoResume?: boolean } = {})`
- default path (`suppressAutoResume=true`) now sets suppression window and clears pending interruption resume.

3. Interruption listeners:
- `onInterruptionBegan`:
  - only when app is playing
  - sets `interruptionPausePendingResume = true`
  - calls `doPause({ suppressAutoResume: false })`
- `onInterruptionEnded`:
  - ignores resume if within suppression window (recent explicit user pause)
  - only resumes when both `shouldResume` and `interruptionPausePendingResume` are true
  - clears pending flag in all paths

### Intent
Make explicit user/app pause sticky while still allowing genuine interruption-ended auto-resume path.

### Request
Please sanity-check this suppression-window approach as an interim phase while we move toward controller-owned transitions.

## Round 15 (Codex -> Claude): Freeze Window Near End — Remove Interruption Control Path

User reports clear freeze near end of latest `/tmp/corpan.logarchive`.
I inspected final window and found dense pause/resume oscillation with very sparse/no matching remote user commands.

### Evidence (near end)
- Around `22:39:31` onward:
  - repeated cycles of:
    - `MediaSessionManageriOS::updateNowPlayingInfo clearing now playing info`
    - `[AUDIO_KEEPALIVE] pause`
    - `[AUDIO_KEEPALIVE] resume`
    - `updateNowPlayingInfo ... isPlaying=false` then `isPlaying=true`
- Multiple such loops occur every ~0.5–2s, consistent with internal control-loop flapping, not normal user intent.

### Patch applied
File: `src/game.ts`

- Removed interruption-driven control actions:
  - `onInterruptionBegan` no longer calls `doPause()`
  - `onInterruptionEnded` no longer calls `doPlay()`
- Kept only log lines for interruption events.
- Reverted `doPause(...)` back to plain `doPause()` signature.

### Rationale
Interruption callbacks are noisy in this architecture (WebKit + native keepalive both touching session). Letting interruption events drive app play/pause is creating a feedback loop. For release stability, explicit commands (`onPlay`/`onPause`, UI, remote buttons) should be the only playback control path.

Please sanity-check this simplification direction.

## Round 16 (Codex -> Claude): Fix "Must Press Play Twice" Race

User reproducibly sees: press play, app auto-repauses, then second play works.

### New archive finding
At/near freeze window, keepalive pause/resume cycles continue without clear user command cadence. The render-loop mismatch reconcile was still mutating state and acting as a second control authority.

### Patch applied (game.ts renderLoop reconcile)

Changed mismatch handling to be **intent-driven**:

1. Removed `desiredPlaying = enginePlaying` mutation in reconcile.
2. Removed `syncNativePlaybackState(true/false)` side-effects from reconcile block.
3. Added desired-driven decisions after debounce:
   - if `desiredPlaying && !enginePlaying` -> `doPlay()` recovery
   - if `!desiredPlaying && enginePlaying` -> `doPause()` enforcement
   - otherwise adopt engine state for UI/mediaSession only

### Rationale
`desiredPlaying` must remain authoritative for user intent. Engine blips should not flip desired state to paused, which caused the "need to hit play twice" behavior.

Please review this direction; it should reduce control-loop flapping and improve pause/play stickiness.

## Round 17 (Codex -> Claude): Merge-Path Stabilization Phase 1 Applied

Per latest user report (easy freeze + `[SR:audio] source missing ... marking paused`) I applied a strict simplification pass to remove read-path mutations and secondary control loops.

### 1) Engine read-path made pure (`audioEngine.ts`)

- Removed all mutation logic from `syncContextPlaybackState()`.
  - no no-source forced pause
  - no external suspend->playing flip
  - no stall bookkeeping in getter path
- `syncContextPlaybackState()` is now explicit no-op (documented).

- Tightened `isPlaying()` read:
  - now requires `playing && ctx.state === "running" && (currentSource || waitingForNextSegment)`

- Added explicit safe-point recovery API:
  - `ensureSourceIfPlaying(reason?: string)` to `AudioEngine` type + implementation
  - if playing is expected but no source/waiting and context running, it restarts segment from preserved offset.

### 2) `doPlay` early-return bug fixed (`game.ts`)

- Changed early return condition from `if (engineAlreadyPlaying || isPlaying)` to `if (engineAlreadyPlaying)`.
  - stale UI `isPlaying=true` no longer blocks real recovery.

- Added explicit source ensure calls at safe points:
  - after early-return already-playing path: `ensureSourceIfPlaying("doPlay:already-playing")`
  - right after `audioEngine.play()`: `ensureSourceIfPlaying("doPlay:post-play")`
  - after visibility recovery while app expects playing: `ensureSourceIfPlaying("visibility:recover")`

### 3) Render-loop reconcile de-authoritized (`game.ts`)

- Removed desired-driven auto `doPlay()/doPause()` calls from reconcile block.
- Reconcile now only updates app/UI/media session state to observed engine state after debounce.
- No play/pause actuation in render loop anymore.

### Why this phase

Goal is merge-safe stabilization: explicit control paths only (UI/native commands) + explicit source recovery at known transition points, not from getters/frame loop.

Please sanity-check this as a stop-the-bleeding phase before any further controller wiring.

## Round 18 (Codex -> Claude): New Random-Pause Evidence + Likely Root Cause

User reports: random pause or two, one near end; app now clearly shows paused when it happens.

I checked latest `/tmp/corpan.logarchive` (timestamps ~23:01:50–23:04:05).

### Observed pattern

- Many pauses/resumes occur with **no nearby `PlatformMediaSession::didReceiveRemoteControlCommand PauseCommand`**.
- Example windows:
  - `23:02:11.075` WebKit `updateNowPlayingInfo clearing` + `MediaSession::setPlaybackState paused`
  - `23:02:11.077` `[AUDIO_KEEPALIVE] pause`
  - `23:02:14.746` `[AUDIO_KEEPALIVE] resume`
  - similar cycles repeat at `23:03:14`, `23:03:46`, `23:04:04`.
- Only one explicit remote pause/play pair appears around `23:02:24`.

So most pause/resume events are not direct user remote taps.

### Hypothesis: stale `doPlay()` cancellation path is still forcing pause

In `doPlay()`, cancellation branches currently do:
- `syncMediaSessionPlaybackState("paused")`
- `syncNativePlaybackState(false)`
- `syncNativeNowPlaying()`

This happens even when cancellation reason is only `requestId !== playRequestSeq` (stale doPlay) while `desiredPlaying` may still be true due a newer play request.

That means an old in-flight `doPlay` can pause keepalive/media state underneath a newer legitimate play request.

This aligns with user symptom "hit play/pause/play quickly and it re-pauses unless slower" from the previous run.

### Proposed next micro-fix (for your review)

- Split cancellation handling in `doPlay()`:
  1. If `disposed || !desiredPlaying`: keep current pause-sync behavior.
  2. If `requestId !== playRequestSeq && desiredPlaying`: **stale request; return without pause side effects**.

This should remove synthetic pause pulses from stale async branches.

I did not apply this yet; waiting for your sanity check first.

## Round 19 (Codex -> Claude): Stale `doPlay` Cancellation Side-Effects Removed

Applied the micro-fix from your Round 17 recommendation.

### Change made
File: `src/game.ts` (`doPlay`)

I added a local helper:

```ts
const shouldCancelPlayRequest = (): { canceled: boolean; staleSuperseded: boolean } => {
  const staleSuperseded = requestId !== playRequestSeq && desiredPlaying && !disposed
  const canceled = staleSuperseded || !desiredPlaying || disposed
  return { canceled, staleSuperseded }
}
```

Then at all four existing cancellation checkpoints:
- after `startNativeKeepAlive`
- after `resumeNativeKeepAlive`
- after `recoverContext`
- after `audioEngine.play`

I replaced the old combined branch with:
- if canceled due **stale superseded request** (`requestId !== playRequestSeq && desiredPlaying && !disposed`):
  - return immediately
  - **no** pause side effects
- if canceled due `!desiredPlaying || disposed`:
  - keep existing pause side effects (`syncMediaSessionPlaybackState("paused")`, `syncNativePlaybackState(false)`, `syncNativeNowPlaying()`)
  - and at post-play checkpoint, still call `audioEngine.pause()`

### Why
This removes synthetic pause pulses from stale in-flight `doPlay` completions while preserving explicit intent-cancel behavior.

### Not changed in this phase
- No reconcile logic changes.
- No seek/scrub path changes.
- No audioEngine behavior changes.

### Request
Please review for any hidden stale-path edge where we should still emit a side effect (especially native keepalive pause) and confirm this is safe as a narrow stabilization step.

## Round 20 (Codex -> Claude): `ensureSourceIfPlaying` Is Symptom, Not Root Cause

User observed:
- `[SR:audio] ensureSourceIfPlaying(doPlay:post-play) restarting seg=761 offset=3372.0`

Assessment:
- This is almost certainly **after-effect recovery**, not root cause.
- `ensureSourceIfPlaying(...)` only fires when state is already invalid for active playback:
  - `playing=true`
  - `currentSource=null`
  - `waitingForNextSegment=false`
  - `ctx.state===running`

Likely root cause still unresolved:
- stale async generation/timer callbacks (`scheduleNextSegment` / `playSegment` overlap) can clobber waiting ownership.
- A stale callback can clear `waitingForNextSegment` after newer intent already set it, creating a false "no source + not waiting" hole.
- `doPlay:post-play` then sees that hole and forces restart (freeze/rewind symptom).

Proposed next micro-phase (surgical):
1. Make stale `scheduleNextSegment` callbacks side-effect free on generation mismatch.
2. Attach waiting/pending fields to explicit owner generation token.
3. Only clear waiting/pending from owner generation paths.
4. Keep `ensureSourceIfPlaying` as fallback; verify it almost never fires after patch.

Please sanity-check this before I patch.

## Round 21 (Codex -> Claude): Ordered Trace Spine Added (JS + Native Sink)

User asked for deeper observability because root cause order is still unclear.

I implemented a minimally invasive trace spine with deterministic ordering.

### What changed

1) New typed trace module
- File: `src/diagnostics/trace.ts`
- Added `srTrace(event, fields, options)` with:
  - monotonic `seq`
  - elapsed ms from session start
  - stable key-sorted field formatting
  - optional native sink (`options.native`) via plugin command

2) JS-to-native trace sink command (audio-keepalive plugin)
- Added new command `trace_event` end-to-end:
  - Rust: `models.rs` (`TraceEventArgs`), `commands.rs`, `mobile.rs`, `desktop.rs`, `lib.rs`
  - Build + perms: `build.rs`, `permissions/default.toml`
  - iOS Swift: `@objc traceEvent(_ invoke: Invoke)` in `AudioKeepAlivePlugin.swift`
- Native log format:
  - `[AUDIO_KEEPALIVE][TRACE] seq=<n> t=<ms> event=<name> details=<kv>`

3) High-value instrumentation in `game.ts`
- Added `tracePlayback()` helper that snapshots:
  - `appPlaying`, `desiredPlaying`, `playInFlight`, `nativeSessionActive`, `nativeHint`
  - plus engine snapshot if available (`enginePlaying`, `ctx`, `seg`, `posMs`)
- Instrumented control transitions (native sink enabled):
  - `doPlay:start/done/finally` and each cancel checkpoint with stale-vs-intent cause
  - `doPause:start/no-op/done`
  - seeks (`seek:ms`, `seek:segment`)
  - scrub lifecycle (`scrub:start`, `scrub:end`)
  - command ingress (`cmd:window`, `cmd:native:onPlay`, `cmd:native:onPause`)
  - visibility transitions + recover route
  - reconcile mismatch commits
  - session init start/ready/error

4) Engine-level instrumentation in `audioEngine.ts`
- Added trace events (console only, no native sink) for async ordering:
  - `audio:playSegment:start`
  - `audio:playSegment:buffer-missing`
  - `audio:playSegment:stale-after-buffer`
  - `audio:source:start-ok`, `audio:source:onended`
  - `audio:scheduleNextSegment`, `...:run`, `...:dropped`
  - `audio:ensureSourceIfPlaying`
  - `audio:play`, `audio:play:fast-resume`, `audio:pause`
  - `audio:seekToMs`, `audio:seekToSegment`, `audio:seekToMsPreview`
  - `audio:recoverContext:*`

### Why
This gives a single ordered timeline across JS decisions and native plugin state (for opted-in high-value events), so we can finally prove causality around freeze/restart races.

### Request
Please review for any over-logging risk or better event naming, and confirm whether you want native sink enabled for additional engine events or keep that limited to control transitions.

## Round 22 (Codex -> Claude): Malicious play-pause-play repause — evidence points to false engine pause report

Reviewed `/tmp/corpan.logarchive` for user’s repeated play-pause-play sequence.

### Strong evidence seen

At `2026-03-07 00:31:42.904` we have:
- `event=reconcile:mismatch`
- details include:
  - `appPlaying=true`
  - `desiredPlaying=true`
  - `enginePlaying=false`
  - `ctx=running`
  - `posMs=1329247 seg=207`

Immediately after:
- `seq=52 doPlay:start` (`requestId=5`)
- `seq=58 doPlay:done` (`latencyMs=1`)

Then later:
- `seq=66 doPause:start` (`requestId=6`)
- followed by native `[AUDIO_KEEPALIVE] pause` then `[AUDIO_KEEPALIVE] resume`

### Interpretation

This looks like the app is being forced into paused UI state by reconcile because engine transiently reports `enginePlaying=false` while user intent still says playing (`desiredPlaying=true`).

So the "malicious repause" symptom appears to be:
1. transient no-source/no-wait window,
2. reconcile commits paused,
3. user play/pause/play interactions race around that unstable window.

This is consistent with our existing hypothesis:
- a generation/timer race can create false `currentSource=null && waitingForNextSegment=false` holes,
- and `audioEngine.isPlaying()` returns false in those holes.

### Secondary observability finding

Our native trace lines are still partially truncated in unified logs (`...<…>`), likely because multiple trace lines are batched into one stdout event. We still got enough signal from key lines, but this truncation is reducing fidelity.

### Requested review

Please confirm the next fix should prioritize:
1) generation-safe waiting ownership (stale timer callbacks must not clear active waiting flags),
2) optional reconcile guard: when `desiredPlaying=true`, require a longer/stronger confidence window before committing paused.

I can patch (1) first as the deterministic root-cause candidate.

## Round 23 (Codex -> Claude): Deterministic pause/resume + seam-chain fix applied

User reports are consistent regardless of tap speed. Latest logs show this pattern repeatedly:
- pause path sets `playbackGeneration++` while keeping `currentSource` alive via context suspend
- later `audio:source:onended currentGen=N gen=N-1 isCurrentSource=true playing=true`
- stale `onended` returns early (`gen !== playbackGeneration`) and does not schedule next segment
- reconcile then sees `enginePlaying=false` and triggers `ensureSourceIfPlaying(...)` restart (rewind/freeze feel)

### Changes applied

1) `audioEngine.pause()` generation handling
- File: `src/audio/audioEngine.ts`
- Removed unconditional `playbackGeneration++` in pause.
- New behavior:
  - If `currentSource` exists: keep live-source path (`ctx.suspend` when running), set `suspendedWithLiveSource=true`, **do not bump generation**.
  - If no live source: bump generation and `stopSource()` (invalidate pending async/timers).

Rationale: fast-resume reuses the same source; bumping generation during pause makes its eventual `onended` stale and breaks segment chaining.

2) Reconcile behavior for `desiredPlaying=true && enginePlaying=false`
- File: `src/game.ts`
- Branch now splits by context state:
  - `ctxState === "suspended"`: treat as external/native pause signal; call `doPause()` (authoritative pause sync).
  - otherwise (`ctxState === "running"`): keep hold + `ensureSourceIfPlaying("reconcile:hold-desired-playing")` only.
- Removed `void doPlay()` call from hold branch to avoid repeated resume churn while already in a recovery path.

3) Removed aggressive ensure calls from normal `doPlay` path
- File: `src/game.ts`
- Removed:
  - `audioEngine.ensureSourceIfPlaying("doPlay:already-playing")`
  - `audioEngine.ensureSourceIfPlaying("doPlay:post-play")`

Rationale: these were redundant and can race source creation/chaining.

### Expected impact
- Native pause should stick (no reconcile auto-resume loop when context is suspended).
- Fewer seam rewinds/freezes caused by stale-generation `onended` after pause/resume.
- Less unnecessary restart churn from doPlay-side ensure calls.

Please sanity-check this direction and call out any edge case where not bumping generation in live-source pause could leak stale async work.
