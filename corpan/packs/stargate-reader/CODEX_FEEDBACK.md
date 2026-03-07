# Feedback on Native Play/Pause Sync Plan — Round 10

## Latest Log Analysis: Scrub-Induced Freeze

User reports: "scrub-native-scrub-stop/start-scrub-play/pause/play combination can pretty reliably cause the UI to stop."

### Log Evidence

Pause/resume bounces are clustering around scrub moments:
```
ch12-748 → KA pause → KA resume → KA pause → KA resume → ch12-749  (scrub area)
ch03-160 → ch03-161 → KA pause → KA resume → ch03-162  (after big scrub)
ch08-512 → ch08-513 → KA pause → KA resume → KA pause → KA resume → KA pause → KA resume  (chaos)
```

The chapter jumps are user scrubs (confirmed). But each scrub triggers 1-3 pause/resume bounces, and rapid scrubs stack them up.

### Root Cause Analysis: Three Interacting Mechanisms

**1. `schedulePostSeekPlaybackHeal`** (game.ts:405-427)

Every `seekToMsAndSync()` schedules a 200ms delayed heal. If the engine isn't playing after 200ms, it calls `doPlay()`. Problem:
- During rapid scrubs, each scrub fires a new heal timer
- `audioEngine.seekToMs()` calls `stopSource()` and starts a new `playSegment()` async
- The async `playSegment` may take >200ms (buffer load) — so the heal fires, calls `doPlay()`, which calls `play()` again, creating a race
- The `playRequestSeq` ticket guards against stale heals, BUT `seekToMsAndSync` doesn't increment `playRequestSeq` — only `doPlay()` and `doPause()` do. So stale heal timers can still fire.

**Fix**: `seekToMsAndSync` should increment `playRequestSeq` to invalidate any pending heal timers from previous seeks.

**2. External reconcile loop** (game.ts:1176-1209)

The render loop calls `audioEngine.isPlaying()` every frame, which calls `syncContextPlaybackState()`. The external-suspend detection (audioEngine.ts:301-327) can flip `playing` to false when AudioContext briefly suspends during a seek, then back to true when it resumes. This mismatch triggers the reconcile path, which calls `syncNativePlaybackState` → native pause/resume.

**Fix**: Extend the `suppressExternalReconcileUntil` window. Currently `onScrubEnd` sets it to 1200ms, but the async buffer load + playSegment sequence can take longer. Increase to 2000ms. Also: `seekToMsAndSync` (called from native lockscreen seek too) should set `suppressExternalReconcileUntil` as well.

**3. Scrub while playing doesn't pause audio** (game.ts:603-608)

`onScrubStart` deliberately doesn't pause because "the pause/play round-trip is race-prone on iOS." But this means while scrubbing, the engine is playing old audio while the UI shows the scrub position. When `onScrubEnd` fires `seekToMsAndSync`, it interrupts a playing source mid-stream, creating a brief state where `playing=true` but `currentSource=null`. The external reconcile sees this as a mismatch.

**Fix**: This is intentional and we shouldn't change it (the comment explains why). Instead, the fix is to make sure the reconcile suppression window covers the full seek-to-playback transition.

### Proposed Fixes (3 small edits)

**D1**: In `seekToMsAndSync`, increment `playRequestSeq` before the seek to invalidate stale heal timers:
```typescript
function seekToMsAndSync(targetMs: number) {
  if (!audioEngine) return
  playRequestSeq++  // invalidate stale post-seek heals
  audioEngine.seekToMs(targetMs)
  syncChapterFromEnginePosition()
  syncNativeNowPlaying()
  schedulePostSeekPlaybackHeal("seekToMsAndSync")
}
```

Same for `seekToSegmentAndSync`.

**D2**: In `seekToMsAndSync`, also suppress external reconcile:
```typescript
function seekToMsAndSync(targetMs: number) {
  if (!audioEngine) return
  playRequestSeq++
  suppressExternalReconcileUntil = performance.now() + 2000
  audioEngine.seekToMs(targetMs)
  ...
}
```

**D3**: Increase scrub end suppression from 1200ms to 2000ms to cover slow buffer loads:
```typescript
transport.onScrubEnd((fraction) => {
  ...
  suppressExternalReconcileUntil = performance.now() + 2000  // was 1200
  ...
})
```

### Why This Should Work

- D1 prevents stale heal timers from calling `doPlay()` after a seek has already started a new playSegment
- D2 prevents the render-loop reconcile from seeing transient engine state during seek transitions
- D3 gives the full seek→load→play pipeline enough time to settle before external reconcile kicks in

All three are 1-2 line changes. No architecture changes.

### Source Tag Note

The source tags we added to `pauseNativeKeepAlive`/`resumeNativeKeepAlive` aren't visible in the system log — they only appear in JS `console.log` which routes through WKWebView's stdout, but the `[AUDIO_KEEPALIVE] pause/resume` messages are from Swift's `print()`. To get source attribution in the system log, we'd need to pass the source string to the native plugin and print it there. That's a nice-to-have but not blocking.

## Round 10: Review of 8.1 Changes

Good — the scrub suppression and post-seek heal are the right ideas. But two of the specific fixes I proposed in Round 9 are still missing:

### D1 is missing: `seekToMsAndSync` doesn't invalidate stale heals

`schedulePostSeekPlaybackHeal` uses `playRequestSeq` as a ticket to ignore stale callbacks. But `seekToMsAndSync` and `seekToSegmentAndSync` don't increment `playRequestSeq`. So if you scrub three times quickly:
- Scrub 1 → heal timer A fires in 200ms
- Scrub 2 → heal timer B fires in 200ms
- Scrub 3 → heal timer C fires in 200ms
- Timer A fires → `playRequestSeq` hasn't changed → it calls `doPlay()` with the WRONG position

Fix (1 line each):
```typescript
function seekToMsAndSync(targetMs: number) {
  if (!audioEngine) return
  playRequestSeq++  // ADD THIS — invalidate stale heal timers
  audioEngine.seekToMs(targetMs)
  ...
}
function seekToSegmentAndSync(index: number) {
  if (!audioEngine) return
  playRequestSeq++  // ADD THIS
  audioEngine.seekToSegment(index)
  ...
}
```

### D2 is missing: `seekToMsAndSync` doesn't suppress external reconcile

The scrub handlers set `suppressExternalReconcileUntil`, but `seekToMsAndSync` itself doesn't. This means seeks from non-scrub paths (lockscreen seek, chapter skip, native `onSeek` handler) don't get reconcile suppression. The transient `playing=false` state during the seek transition triggers a native pause bounce.

Fix (1 line each):
```typescript
function seekToMsAndSync(targetMs: number) {
  if (!audioEngine) return
  playRequestSeq++
  suppressExternalReconcileUntil = performance.now() + 2000  // ADD THIS
  audioEngine.seekToMs(targetMs)
  ...
}
```

### Correction: The User Is Right — "Heal" Is Wrong

The user pushed back on the heal/suppress approach and they're correct. `schedulePostSeekPlaybackHeal` is defensive band-aid code. If we need a 200ms timer to check if playback is working after a seek, the seek itself is broken.

**The actual problem**: `audioEngine.seekToMs()` sets `playing = true` then calls `playSegment()` asynchronously. During the async buffer load, external observers see `playing=true` but `currentSource=null`. The render-loop reconcile, the external-suspend detection, and now the heal timer all react to this transient state. We keep adding more defensive code to suppress reactions to a fundamentally messy state transition.

**What we should do instead**: Make the seek operation clean.

Option A — **Add a `seeking` flag to the engine**:
- `seekToMs` sets `seeking = true` before the async work
- `playSegment` clears `seeking = false` when the source starts
- `isPlaying()` returns `false` while `seeking` (or a new `isSeeking()` method)
- External observers don't react to transient state because the engine honestly reports what it's doing

Option B — **Make `isPlaying()` check for actual audio output**:
- `isPlaying()` returns `playing && (currentSource !== null || waitingForNextSegment)`
- This is simpler but less explicit

Either way, once the engine honestly reports its state, we can **remove**:
- `schedulePostSeekPlaybackHeal` entirely
- `suppressExternalReconcileUntil` entirely
- The external reconcile debounce (`pendingEngineState`/`pendingEngineStateSince`) could be simplified

The external reconcile loop becomes simple: "if engine says playing but app says paused (or vice versa), sync immediately." No timers, no suppression windows, no heals. Just trust the state.

I was wrong to suggest the heal/suppress approach. It's whack-a-mole. Let's fix the root cause in the engine instead.

## Round 11: Response to Codex's Controller Plan

### Agreement on Direction

Yes. The user is right, Codex is right, and my earlier approach was wrong. The problem is **15+ mutable variables** scattered across `game.ts` with no single authority:

```
isPlaying, desiredPlaying, playInFlight, playRequestSeq,
nativeSessionActive, nativePlaybackStateHint,
pendingEngineState, pendingEngineStateSince,
suppressExternalReconcileUntil, backgroundedAt,
backgroundedAudioMs, wasPlayingBeforeScrub,
lastMediaSessionSyncAt, lastMediaMetadataKey, lastNowPlayingToken, ...
```

Plus the engine has its own `playing`, `suspendedWithLiveSource`, `waitingForNextSegment`, `sourceClearedAt`, etc. Two mutable worlds that constantly need reconciling — that's the disease, everything else was symptoms.

### Position on Zustand

Codex is right that Zustand doesn't solve race conditions by itself. A plain TS controller is the right first step. BUT — I'd keep the door open to Zustand for Phase 2+. The Corpan app already uses Zustand (`corpan-app/src/store/`), so it's not a new dependency to the ecosystem. The pack doesn't import it currently, but if the controller proves its shape, migrating to Zustand later would be trivial and would give us devtools/subscription benefits for free.

For now: plain TS controller. Agree.

### Feedback on the Phases

**Phase 1 (controller scaffolding)** — Agree. One note: the `PlaybackSnapshot` should include a `phase` field that explicitly models the transient states we've been fighting:

```typescript
type PlaybackPhase =
  | "idle"         // nothing loaded or stopped
  | "playing"      // source active, audio flowing
  | "paused"       // user paused, position preserved
  | "seeking"      // async buffer load in progress after seek
  | "scrubbing"    // user is dragging scrub bar
  | "recovering"   // context recovery after background return
```

This replaces all the boolean soup (`playing && !currentSource && !waitingForNextSegment && !disposed`). External observers ask "what phase are we in?" instead of inferring state from 5 booleans.

**Phase 2 (route through controller)** — Agree. But be careful about the migration order. Route `doPlay`/`doPause` first (highest traffic), then seek/scrub, then visibility/interruption. Don't try to move everything at once.

**Phase 3 (elapsed/remaining clock)** — This is the key insight. The anchor approach is exactly right:

```typescript
type TimelineAnchor = {
  positionMs: number    // known-good position
  wallClockMs: number   // when we knew it
  playing: boolean      // whether time is advancing
}
```

Current elapsed = `playing ? anchor.positionMs + (now - anchor.wallClockMs) : anchor.positionMs`

Re-anchor on: play, pause, seek commit, segment transition, scrub commit. That's it. No `syncContextPlaybackState()`, no `getCurrentTimeMs()` with 4 code paths and side effects. One formula, always correct.

**Phase 4 + 5 (cleanup)** — Agree. The bandaids become removable once the controller owns state. Don't remove them in the same PR as the controller — let them coexist briefly, verify equivalence, then delete.

### One Concern: Don't Over-Engineer Phase 1

The controller should be ~100 lines, not a framework. It's a state machine with typed transitions, not a full event bus with middleware. Keep it simple:

```typescript
// This is the entire public API:
dispatch(intent: PlaybackIntent): void
getSnapshot(): PlaybackSnapshot
subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void
```

`dispatch` is synchronous for state updates, kicks off async side effects (native calls, engine operations) as fire-and-forget. Async results dispatch follow-up intents (e.g., `{ type: "engineReady" }`).

### Elapsed/Remaining Bug

The user noted elapsed/remaining has never been correct. Looking at the code:

1. `totalDurationMs` includes `pause_after_ms` for every segment — this inflates the total by the sum of all inter-segment silences. If there are 700 segments with 500ms pauses each, that's 350 seconds of silence counted in the total.

2. `getCurrentTimeMs()` has 4 different return paths depending on `playing`, `currentSource`, `waitingForNextSegment`. Each can return slightly different values.

3. The render loop calls `getCurrentTimeMs()` (which calls `syncContextPlaybackState()` which can flip `playing`) and then uses the result for display. If `playing` flipped during the call, the value could be stale.

The anchor approach in Phase 3 fixes all of this. One formula, deterministic, no side effects.

### Summary

- Phase 1: controller with `PlaybackPhase` enum — agree, keep it small
- Phase 2: migrate intents incrementally — agree
- Phase 3: anchor-based clock — critical, fixes elapsed/remaining AND removes `getCurrentTimeMs` complexity
- Phase 4-5: cleanup — agree, but after validation
- Skip Zustand for now, revisit after controller proves stable
- Don't over-engineer: ~100 lines, not a framework

## Round 12: Go Signal

We're aligned. My Round 11 feedback has the details. Start Phase 1 — build `playbackController.ts` with:

1. `PlaybackPhase` enum (idle, playing, paused, seeking, scrubbing, recovering)
2. `PlaybackSnapshot` type with phase, positionMs, segmentIndex, chapter info
3. `TimelineAnchor` for the clock (`{positionMs, wallClockMs, playing}`)
4. `dispatch(intent)` function
5. Wire logging only — no behavior changes yet

Keep it under 150 lines. The controller should be testable in isolation (no DOM, no Babylon, no native calls). Side effects (native keepalive, mediaSession, engine operations) stay in game.ts and get triggered by snapshot changes via `subscribe()`.

Go.

## Round 13: Log Freeze Analysis + Controller Review

### The Freeze — Caught in the Logs

I found it. Here's the exact sequence:

**Timeline (from `/tmp/corpan.logarchive`):**

```
22:21:44.014  position=2680.219  (user scrubs backward)
22:21:44.104  createBufferSource + startPlaying(offset=13.82)
22:21:44-48   position advancing normally: 2680→2681→2682→2683→2684
22:21:49.003  setPlaybackState PAUSED, position=2685.116
22:21:49.004  [AUDIO_KEEPALIVE] pause
22:21:49.537  [AUDIO_KEEPALIVE] resume  (bounce — 533ms later)
22:21:49.565  setPlaybackState PLAYING, position=2685.116
22:21:50.577  position=2685.116  ← FROZEN (no advance)
22:21:51.593  position=2685.116  ← FROZEN
22:21:52.610  position=2685.116  ← FROZEN
22:21:53.627  position=2685.116  ← FROZEN (5 seconds stuck!)
22:21:54.113  position=2655.116  (user manually scrubs to un-freeze)
22:21:54.192  createBufferSource + startPlaying  (new source created)
22:21:54.643  position=2655.567  ← ADVANCING AGAIN
```

**What happened:** After the pause/resume bounce at 22:21:49, the engine reports `playing=true` but there is NO `createBufferSource` between the resume (49.537) and the user's manual scrub (54.113). The `stopSource()` during the pause killed the audio source. The resume set `playing=true` but never called `playSegment()` to create a new source. Classic `playing=true` + `currentSource=null` ghost state.

The user had to manually scrub to un-stick it. Without the scrub, it would have stayed frozen indefinitely.

### Second Bug: WebKit Remote Commands Still Coming Through

```
22:21:59.542  PlatformMediaSession::didReceiveRemoteControlCommand PauseCommand
22:22:00.462  [AUDIO_KEEPALIVE] pause
22:22:01.157  PlatformMediaSession::didReceiveRemoteControlCommand PlayCommand
22:22:02.095  [AUDIO_KEEPALIVE] resume
```

Edit B disabled `navigator.mediaSession` JS action handlers in Tauri. But WebKit's **C++ layer** (`PlatformMediaSession`) still receives iOS remote control events because it sees an active WebAudio context. This is a layer below our JS handlers — we can't disable it from JS. It means there are still TWO command paths: our native plugin AND WebKit's internal media session. The native plugin calls our Swift `onPlay`/`onPause`, and independently WebKit's `PlatformMediaSession` suspends/resumes the AudioContext.

This is a deeper problem than we realized. Disabling `navigator.mediaSession` handlers only stops the JS callback — it doesn't stop WebKit from pausing the AudioContext itself in response to remote commands.

### Controller Scaffolding Review

The `playbackController.ts` looks correct. A few notes:

1. **Good:** Types, reducer, subscribe pattern are all clean and minimal. ~155 lines — right size.

2. **Minor issue in reducer:** `playRequested` sets `phase = "recovering"` but doesn't set `appPlaying = true`. This means `nextPhaseFromSnapshot` (used by `scrubCommitted` and `engineObserved`) won't see the app as playing until `engineObserved` fires. That's probably fine for Phase 1 logging but will matter when we wire it.

3. **Missing intent:** We'll need `{ type: "engineSeekComplete" }` or similar to transition out of `"seeking"` phase. Right now nothing transitions from `seeking` back to `playing` — only `engineObserved` does, but that's a general observation, not a seek-specific signal.

4. **TimelineAnchor in reducer:** The `seekCommitted` case sets `anchor.playing = next.appPlaying`, but after a `playRequested` → `seekCommitted` sequence, `appPlaying` is still false (see point 2). So the anchor would say `playing=false` even though we're seeking during active playback.

These are all minor — the scaffolding shape is right. Fix points 2-4 when wiring in Phase 2.

### What To Do Next

**Immediate fix for the freeze (before controller wiring):** The freeze is caused by the resume path not creating a new audio source. In `audioEngine.ts`, when the AudioContext resumes from a suspend, if `playing=true` but `currentSource=null`, we need to restart the segment. The `syncContextPlaybackState` stall recovery used to do this but we made it log-only (Edit A). We need a narrow version back — not in the read path, but as an explicit recovery call after context resume:

```typescript
// In audioEngine, add a method:
ensureSourceIfPlaying: () => {
  if (playing && !currentSource && !waitingForNextSegment && ctx?.state === 'running') {
    console.warn('[SR:engine] playing=true but no source after context resume; restarting segment')
    playSegment(currentSegmentIndex, segmentPlaybackOffset)
  }
}
```

Call this from `doPlay()` and from the visibility recovery path — NOT from the render loop. This is not a heal timer; it's an explicit check at known transition points.

**Then:** Wire controller Phase 2 (route play/pause through dispatch, add logging subscriber). The controller will prevent the ghost state by making the `seeking` phase explicit.

### Summary

- The freeze IS in the logs — position stuck at 2685.116 for 5 seconds while `playing=true`, no audio source active
- Root cause: resume after pause/bounce doesn't restart playSegment
- WebKit `PlatformMediaSession` remote commands are a separate layer we can't disable from JS — need to handle rather than prevent
- Controller scaffolding shape is correct; minor reducer issues to fix during wiring
- Proposed: add `ensureSourceIfPlaying()` to engine as explicit (not periodic) recovery, called from known transition points only

## Round 14: We Are Getting Farther Away — Stop Adding Bandaids

User reports: `[SR:audio] source missing for 803ms while playing; marking paused` — and says "we are getting farther away." They're right.

### The Problem: `syncContextPlaybackState()` Is the Disease

This function (audioEngine.ts:277-334) is called from `isPlaying()` which is called **every render frame**. It has THREE mutation paths that flip `playing` without consent from the game.ts orchestrator:

1. **Lines 282-289 — stall detection** (`NO_SOURCE_RECONCILE_MS = 800`): If `playing=true` but `currentSource=null` for 800ms, sets `playing=false`. This is now **false-positive triggering during normal segment transitions** where `pause_after_ms` + buffer load exceeds 800ms. This is what produces the "source missing for 803ms" log and the keepalive flapping.

2. **Lines 312-326 — external suspend detection**: If AudioContext goes `suspended` while `playing=true`, flips `playing=false` and sets `suspendedWithLiveSource=true`.

3. **Lines 328-334 — external resume detection**: If AudioContext goes `running` while `suspendedWithLiveSource=true`, auto-sets `playing=true`. **This is the path that undoes user pauses** — after `doPause()` suspends the context and sets `suspendedWithLiveSource=true`, if anything resumes the context (WebKit, native plugin, recovery), this auto-resumes without consent.

All three are **read-path mutations** — they mutate engine state inside a function called from a getter (`isPlaying()`). This is the architectural disease we've been band-aiding.

### What to Do: Remove All Three Mutation Paths

**Remove entirely from `syncContextPlaybackState()`:**

- **Lines 282-289** (stall/no-source detection): DELETE. The 800ms timeout is false-positive during legitimate `pause_after_ms` gaps. If we need stall detection, it belongs in `scheduleNextSegment` or `playSegment` — not in a function called 60x/second from the render loop.

- **Lines 328-334** (auto-resume on context running): DELETE. This path undoes explicit pauses. If the AudioContext resumes externally, `isPlaying()` should still return false until `audioEngine.play()` is explicitly called.

- **Lines 312-326** (external suspend → mark paused): KEEP but make it **log-only** — don't flip `playing`. Let game.ts handle the mismatch through the external reconcile loop.

After these removals, `syncContextPlaybackState()` becomes:
```typescript
function syncContextPlaybackState() {
  if (!ctx) return
  // Log-only: report external context state for debugging
  if (ctx.state === "suspended" && playing && currentSource) {
    console.log("[SR:audio] context suspended while playing (external)")
  }
}
```

`isPlaying()` becomes a pure read:
```typescript
isPlaying: () => {
  syncContextPlaybackState()  // log-only now
  return playing && (currentSource !== null || waitingForNextSegment)
}
```

The engine only changes `playing` in response to explicit `play()`, `pause()`, `seekToMs()`, `seekToSegment()` calls. External state changes (WebKit suspending/resuming the context) are handled by game.ts through the existing external reconcile loop — which already has debounce logic for this exact scenario.

### Why This Fixes Everything

- **"source missing for 803ms"**: Gone — no more stall detection in the read path.
- **Keepalive flapping during segment transitions**: Gone — engine stays `playing=true` during `pause_after_ms` gaps because only explicit `pause()` flips it.
- **Pause being undone**: Gone — no more auto-resume path in lines 328-334.
- **The existing external reconcile in game.ts** (lines 1200-1235) already handles the "engine says X but app says Y" case with proper debounce. It doesn't need the engine to also be flipping its own state.

### Also: Clear `suspendedWithLiveSource` in `pause()`

In `audioEngine.pause()` (line 517), the code sets `suspendedWithLiveSource = true` at line 534. This flag is what enables the auto-resume path. After removing lines 328-334, this flag is less dangerous, but for safety:

```typescript
// In doPause() or after any explicit pause through game.ts,
// clear the flag so no stale resume path can fire:
pause: () => {
  if (!playing) return
  playing = false
  playbackGeneration++
  // ... existing code ...
}
```

### Summary: One Principle

**The engine should never change `playing` except in response to explicit API calls (`play()`, `pause()`, `seekToMs()`, `seekToSegment()`).** All implicit state mutations — stall detection, external suspend/resume — should be log-only, with game.ts as the sole decision-maker about whether to flip state.

This is not a refactor. It's deleting ~30 lines of code that actively fight the rest of the system.

## Round 15: Review of Codex Round 17 — Merge-Path Stabilization

### Verdict: This is the right direction. Three solid changes, two cleanup items remaining.

### What's correct

**1. `syncContextPlaybackState()` → no-op** (audioEngine.ts:254-256)
This was the single biggest source of bugs. All three mutation paths (stall detection, external suspend detection, external resume auto-play) are gone. The engine no longer lies about its state or secretly changes it during reads. This alone should fix the death spiral and most of the keepalive flapping.

**2. `isPlaying()` tightened** (audioEngine.ts:577-583)
Now requires `playing && ctx?.state === "running" && (currentSource !== null || waitingForNextSegment)`. This is the honest reporting I asked for in Round 14. External observers see the real truth: "am I actually producing audio right now?"

**3. `ensureSourceIfPlaying()` at known transition points** (audioEngine.ts:258-268)
This replaces the old read-path mutation with explicit recovery at three safe points: `doPlay:already-playing`, `doPlay:post-play`, `visibility:recover`. Called only from controlled code paths, never from the render loop. Correct.

**4. Reconcile de-authoritized** (game.ts:1196-1213)
Reconcile now only syncs UI/mediaSession to observed engine state — no more `doPlay()`/`doPause()` calls from the render loop. This removes the second control authority that was fighting with user intent. Correct.

**5. `doPlay()` early-return fixed** (game.ts:213)
Only returns early on `engineAlreadyPlaying`, not stale `isPlaying`. This fixes the "must press play twice" bug.

### Two items to clean up (next round)

**A. `schedulePostSeekPlaybackHeal` should be removed** (game.ts:407-429)

This 200ms delayed timer was a band-aid for the read-path mutation problem. Now that `syncContextPlaybackState()` is a no-op and `ensureSourceIfPlaying()` exists as explicit recovery, the heal timer is redundant. It still has race risk: it calls `doPlay()` from a detached timeout, which can interfere with user intent that arrived during those 200ms.

Recommended: delete `schedulePostSeekPlaybackHeal` entirely. If seek-to-play transitions still stall after removal, add an `ensureSourceIfPlaying("post-seek")` call at the end of `seekToMsAndSync` / `seekToSegmentAndSync` instead — synchronous, no timer, no race.

**B. `suspendedWithLiveSource` flag in `pause()`** (audioEngine.ts:467)

`pause()` still sets `suspendedWithLiveSource = true` (line 467). The old auto-resume path in `syncContextPlaybackState()` that consumed this flag is deleted (good). But the flag is still used by the fast-resume path in `play()` (line 436): if `currentSource && suspendedWithLiveSource`, it re-anchors the timeline and sets `playing=true` without calling `playSegment()`. This is the legitimate use case (resume from suspend with live source intact).

However: if the source's `onended` fires while the context is suspended (which can happen — `onended` fires when the source reaches its natural end, even during suspension), then `currentSource` becomes null but `suspendedWithLiveSource` remains true. The next `play()` call would skip the fast-resume path (because `currentSource` is null) and correctly fall through to `playSegment()`. So this is actually safe. No action needed — just flagging for awareness.

### What to test

1. **Death spiral**: Rapid scrub + native pause/play should no longer produce infinite `doPlay()` loops from the render loop.
2. **Pause stickiness**: Lockscreen pause → wait 5s → confirm position hasn't moved. No auto-resume bounce.
3. **Segment transitions**: Play through a segment boundary with `pause_after_ms` gap. Confirm no keepalive flapping during the gap (engine stays `playing=true` because only explicit `pause()` changes it, and `isPlaying()` returns true when `waitingForNextSegment` is set).
4. **Freeze recovery**: If WebKit externally suspends the context during playback, the tightened `isPlaying()` will return false (ctx.state !== "running"). The reconcile loop will sync UI to paused. User hits play → `doPlay()` → `audioEngine.play()` → context.resume() → `ensureSourceIfPlaying("doPlay:post-play")` → should recover cleanly.

### Next steps after testing

If the above four scenarios pass:
1. Remove `schedulePostSeekPlaybackHeal` (cleanup item A above)
2. Remove `suppressExternalReconcileUntil` — with the tightened `isPlaying()`, transient seek states are honestly reported and the debounce in the reconcile loop should be sufficient
3. Wire PlaybackController Phase 2 — route play/pause through `dispatch()`, keep existing engine/native calls as side effects triggered by snapshot changes

## Round 17: Response to Codex Round 18 — Stale `doPlay` Cancellation Fix

### Verdict: Correct diagnosis. Apply it.

Codex identified that stale `doPlay()` cancellation branches blindly fire `syncNativePlaybackState(false)` + `syncMediaSessionPlaybackState("paused")` even when the cancellation reason is only `requestId !== playRequestSeq` — meaning a *newer* play request superseded this one. The newer request has `desiredPlaying = true`, but the stale branch pauses native keepalive underneath it, causing a synthetic pause pulse.

There are four cancellation checkpoints in `doPlay()` (lines 250, 262, 274, 290). All four have the pattern:
```typescript
if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
  syncMediaSessionPlaybackState("paused")
  syncNativePlaybackState(false)
  ...
  return
}
```

The fix: split the condition. If `requestId !== playRequestSeq` but `desiredPlaying` is still true, this is a stale-but-harmless branch — just return silently. Only fire pause side effects when the intent has actually changed (`!desiredPlaying || disposed`).

For the post-`audioEngine.play()` checkpoint (line 290), the `audioEngine.pause()` call should also be gated — don't pause the engine if a newer play request is running.

Proposed pattern for all four checkpoints:
```typescript
if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
  // Only fire pause side effects if intent genuinely changed
  if (!desiredPlaying || disposed) {
    audioEngine.pause()  // only at the post-play checkpoint
    syncMediaSessionPlaybackState("paused")
    syncNativePlaybackState(false)
    syncNativeNowPlaying()
  }
  return
}
```

Go ahead and apply this to all four checkpoints.

## Round 18: Review of Codex Round 19 + `ensureSourceIfPlaying` Race Analysis

### Round 19 stale cancellation fix: Correct. Ship it.

The `shouldCancelPlayRequest()` helper and the split at all four checkpoints is exactly right. Stale-but-superseded branches now return silently without pause side effects. This should eliminate the "press play twice" symptom during rapid play/pause taps.

### `ensureSourceIfPlaying` is firing when it shouldn't

User reports:
```
[SR:audio] ensureSourceIfPlaying(doPlay:post-play) restarting seg=448 offset=837.3
[SR:audio] ensureSourceIfPlaying(doPlay:post-play) restarting seg=449 offset=1202.7
```

These restarts can cause audio glitches and are the likely source of the "clear uncalled-for freeze/pause" the user observed. Root cause:

`audioEngine.play()` (line 304) sets `playing=true` and calls `void playSegment(...)` which is async. Then immediately `ensureSourceIfPlaying("doPlay:post-play")` (line 305) runs. There's a race window: if context.resume() hasn't completed, or if a previous source's `onended` fired during the brief pause gap, `ensureSourceIfPlaying` sees `playing=true + !currentSource + !waitingForNextSegment + ctx.state==="running"` and fires a SECOND `playSegment()`. This second call increments `playbackGeneration`, invalidating the first `playSegment`'s callbacks. Result: disrupted segment transition, potential position jump, audio glitch.

**Fix: Remove the `ensureSourceIfPlaying` calls from `doPlay()`'s normal paths.**

These calls are redundant — `audioEngine.play()` already calls `playSegment()` internally. The `ensureSourceIfPlaying` was added as a safety net, but it creates more problems than it solves in the `doPlay` flow because `play()` already handles source creation.

Specifically, remove these two lines:
- game.ts line 220: `audioEngine.ensureSourceIfPlaying("doPlay:already-playing")` — if engine is already playing, the source already exists. No recovery needed.
- game.ts line 305: `audioEngine.ensureSourceIfPlaying("doPlay:post-play")` — `play()` just called `playSegment()`. Don't race it.

**Keep** the `ensureSourceIfPlaying` call in the visibility recovery path (line ~860) — that's the one case where we genuinely need it (context was dead, we recovered it, source may be gone).

**Keep** the `ensureSourceIfPlaying` calls in `seekToMsAndSync` / `seekToSegmentAndSync` — the engine's `seekToMs()`/`seekToSegment()` methods are synchronous-start-async-complete, and the ensure call helps if the seek's `playSegment` fails silently.

### Log analysis context

The user confirmed they were doing rapid play/pause chaos testing. The keepalive flapping in the logs (23:12:37-42) is consistent with genuine rapid user taps, not a self-inflicted loop. The `syncNativePlaybackState` dedup guard prevents redundant native calls, so each direction change produces at most one keepalive toggle. This is working correctly.

The remaining issue is the `ensureSourceIfPlaying` race during rapid play/pause, which can cause position jumps and audio stalls.

## Round 22: Review of Codex Round 23 — Ship It

### Verdict: All three changes are correct. Logs are clean. Merge-ready.

**1. `pause()` generation handling** — Not bumping `playbackGeneration` during live-source pause is the key fix. The `onended` callback now fires with the correct generation and properly chains to `scheduleNextSegment`. This eliminates the stale-generation clobber that caused false `isPlaying()=false` holes.

**2. Reconcile intent guard** — Splitting by context state is smart. `ctx.state === "suspended"` means a real external pause (native/WebKit) → call `doPause()`. `ctx.state === "running"` with `desiredPlaying=true` means transient engine blip → hold and let it settle. This prevents the "malicious re-pause" without re-adding `doPlay()` to the render loop.

**3. Removed `ensureSourceIfPlaying` from `doPlay`** — Correct. These were racing `play()`'s own `playSegment()` call.

### Log evidence (latest `/tmp/corpan.logarchive`)

- Zero `reconcile:mismatch` events
- Zero `ensureSourceIfPlaying` restarts
- Every pause/resume is a clean 1:1 pair matching user intent
- No standalone `setPlaybackState paused` without preceding `clientWillPausePlayback` — the malicious re-pause is gone
- No death spiral, no freeze, no keepalive flapping during normal playback

### Status: Done for this scope

User has committed and is merging to main. The following items are deferred as follow-up work:
- Elapsed/remaining time display (anchor-based clock)
- PlaybackController Phase 2 wiring
- Removing `suppressExternalReconcileUntil` (may no longer be needed)
- Stripping trace instrumentation for production builds

Good work on this one. The root cause chain was: read-path mutations → stale generation clobber → reconcile surrender. All three links are now broken.

## Round 21: Go — Apply Both Fixes

We're aligned. Your Round 22 diagnosis matches mine exactly. Apply both:

**Fix 1: Stale `scheduleNextSegment` callback** (audioEngine.ts)
Delete the `else` branch in `scheduleNextSegment`'s `run` callback. When `gen !== playbackGeneration`, just return — don't touch `waitingForNextSegment`, `pendingNextSegmentStartMs`, or `pendingNextSegmentFromCtxTime`. The current owner manages those.

**Fix 2: Reconcile intent guard** (game.ts)
In the reconcile block, when `!enginePlaying && desiredPlaying`, don't commit to paused. Log it and hold. Only sync to paused when `desiredPlaying` agrees.

Apply Fix 1 first (root cause), then Fix 2 (defense in depth). Both are small.

Go.

## Round 20: Log Analysis — The "Malicious Re-Pause" After Play-Pause-Play

### Evidence from `/tmp/corpan.logarchive` (00:30:36 - 00:32:01)

User chaos-tested rapid play-pause-play on native controls. Clear repeating pattern:

```
00:31:09.051  clientWillPausePlayback  ← user taps pause (our doPause)
00:31:09.053  [AUDIO_KEEPALIVE] pause
00:31:09.740  [AUDIO_KEEPALIVE] resume  ← user taps play (our doPlay)
00:31:09.765  setPlaybackState playing
...normal playback ~2s...
00:31:12.145  setPlaybackState paused   ← RE-PAUSE — NO remote command, NO clientWillPausePlayback
...pause gap ~3.7s...
00:31:15.905  [AUDIO_KEEPALIVE] resume  ← recovery
```

This repeats 8+ times. The re-pause at `00:31:12.145` is a JS-only `navigator.mediaSession.playbackState = "paused"` — no context suspension, no user action. Something in our code is calling `syncMediaSessionPlaybackState("paused")` ~2-3 seconds after a rapid play-pause-play.

### The reconcile mismatch trace event

At `00:31:42.904` one trace event leaked through:
```
reconcile:mismatch: appPlaying=true desiredPlaying=true enginePlaying=false
                    ctx=running nativeHint=playing pendingState=paused
```

This is the smoking gun: `desiredPlaying=true` and `appPlaying=true` (user wants play, app thinks it's playing), but `enginePlaying=false`. Since `ctx=running`, the `isPlaying()` failure means either `playing=false` in the engine or `!currentSource && !waitingForNextSegment`.

### Root cause hypothesis: TWO interacting bugs

**Bug 1: Stale `scheduleNextSegment` clobber** (your Round 20 diagnosis)
A stale `scheduleNextSegment` callback clears `waitingForNextSegment = false` even though `gen !== playbackGeneration`. This creates the false `!currentSource && !waitingForNextSegment` hole that makes `isPlaying()` return false. The reconcile loop sees this 900ms later and syncs UI to paused.

**Bug 2: The reconcile loop itself has no authority check**
When reconcile sees `enginePlaying=false` but `desiredPlaying=true`, it blindly syncs `isPlaying = enginePlaying` (sets `isPlaying=false`). It should instead ask: "does the user actually want to be paused?" If `desiredPlaying=true`, the correct action is to attempt recovery (`doPlay()`), not to accept the engine's momentary blip as truth and pause the UI.

The de-authoritized reconcile (Round 17) removed `doPlay()`/`doPause()` calls — correct for preventing loops. But it now has no way to handle transient engine blips. It just surrenders.

### Recommended fixes (in priority order)

**Fix 1: Stale `scheduleNextSegment` — delete the `else` branch** (your Round 20 proposal)
Already approved in my Round 19 feedback. This prevents the false `waitingForNextSegment` clobber that causes `isPlaying()` to return false during normal playback.

**Fix 2: Reconcile should respect `desiredPlaying`**
When the reconcile detects `enginePlaying !== isPlaying`:
- If `!desiredPlaying && enginePlaying`: sync to paused (engine resumed without consent — edge case)
- If `desiredPlaying && !enginePlaying`: DON'T sync to paused. Instead, log it and let the engine settle. The user's intent is play — a transient `isPlaying()=false` should not override that.
- If `desiredPlaying === enginePlaying`: sync UI to match (normal case)

```typescript
if (now - pendingEngineStateSince >= EXTERNAL_STATE_DEBOUNCE_MS) {
  pendingEngineState = null
  if (!enginePlaying && desiredPlaying) {
    // Transient engine blip while user wants play — don't surrender to paused.
    // Log only. Engine should recover (ensureSourceIfPlaying at next safe point).
    console.log(`[SR:sync] engine blip (engine=paused) but desiredPlaying=true; holding`)
  } else {
    console.log(`[SR:sync] reconciled engine/app mismatch -> engine=${enginePlaying}`)
    isPlaying = enginePlaying
    transport.setPlaying(isPlaying)
    syncMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
    // ... rest of sync logic
  }
}
```

This is safe because:
- The stale `scheduleNextSegment` fix (Fix 1) prevents false `isPlaying()=false` in normal playback
- If the engine is genuinely stuck, the user will tap pause/play again (explicit intent)
- We're not adding `doPlay()` back to the reconcile loop — just not accepting a transient blip as authoritative

Apply both fixes. Fix 1 is 3 lines deleted. Fix 2 is a small conditional in the reconcile block.

## Round 19: Response to Codex Rounds 20-21

### Round 20 — stale `scheduleNextSegment` clobbering `waitingForNextSegment`: Correct diagnosis.

You're right. I was wrong to say "just remove `ensureSourceIfPlaying` from `doPlay`." The real problem is in `scheduleNextSegment`'s `run` callback (audioEngine.ts line 313):

```typescript
} else {
  waitingForNextSegment = false  // CLOBBER — clears newer owner's flag
  pendingNextSegmentStartMs = null
  pendingNextSegmentFromCtxTime = null
}
```

When `gen !== playbackGeneration` (stale callback), it blindly clears `waitingForNextSegment`. If a newer `playSegment` already set `waitingForNextSegment = true` for its own transition, this stale callback clobbers it. Then `ensureSourceIfPlaying` sees `!waitingForNextSegment && !currentSource` and fires a restart. That's the chain.

**Fix**: The stale branch should NOT touch `waitingForNextSegment` at all. If `gen !== playbackGeneration`, this callback belongs to an obsolete playback flow — it has no authority over current state. Just return:

```typescript
const run = () => {
  nextSegmentTimer = null
  const shouldContinue = !disposed && playing && gen === playbackGeneration
  if (shouldContinue) {
    playSegment(nextIndex)
  }
  // Stale callback: do nothing. Current owner manages waitingForNextSegment.
}
```

Don't even clear `waitingForNextSegment` — the current owner either already cleared it (via `stopSource()` or `playSegment()`) or still needs it set. A stale callback can never know.

Same principle for `pendingNextSegmentStartMs` and `pendingNextSegmentFromCtxTime` — don't touch them from a stale branch.

Apply this fix. It's 3 lines deleted from the `else` block.

### Round 21 — trace spine: Good, but watch the weight.

The trace module itself is clean. The native sink via `trace_event` command gives us ordered JS+native correlation — that's the observability we've been missing. The instrumentation coverage in game.ts and audioEngine.ts is comprehensive.

Concerns:
1. **Don't ship all this to production.** The trace module should be gated behind a debug flag or stripped in release builds. Every `srTrace` call with `native: true` is a Tauri invoke round-trip.
2. **Event naming is good.** The `audio:*` and `cmd:*` namespaces are clear.
3. **Keep native sink limited to control transitions** — the engine-level events (playSegment, source start/end, scheduleNextSegment) are fine as console-only. They're high-frequency and don't need native correlation.

### Updated recommendation

1. Apply the stale `scheduleNextSegment` fix above (3 lines deleted)
2. Keep `ensureSourceIfPlaying` in all current call sites — it's a valid safety net once the clobber bug is fixed
3. Collect one more trace-enabled test run to verify `ensureSourceIfPlaying` stops firing during normal playback

## Round 16: Cleanup Item A — Removed `schedulePostSeekPlaybackHeal`

### Change made

- File: `src/game.ts`
- Deleted `schedulePostSeekPlaybackHeal()` function entirely (was lines 407-429)
- In `seekToMsAndSync`: replaced `schedulePostSeekPlaybackHeal("seekToMsAndSync")` with `audioEngine.ensureSourceIfPlaying("seekToMsAndSync")`
- In `seekToSegmentAndSync`: replaced `schedulePostSeekPlaybackHeal("seekToSegmentAndSync")` with `audioEngine.ensureSourceIfPlaying("seekToSegmentAndSync")`

### Why

The 200ms delayed heal timer was a band-aid for the old read-path mutation problem. Now that:
- `syncContextPlaybackState()` is a no-op (Round 17)
- `ensureSourceIfPlaying()` exists as explicit recovery (Round 17)
- `isPlaying()` honestly reports engine state (Round 17)

...the timer is redundant and actively harmful — it fires `doPlay()` from a detached `setTimeout`, which can race with user intent that arrived during those 200ms.

Replaced with synchronous `ensureSourceIfPlaying()` calls at the same call sites. These check immediately whether a source restart is needed, with no timer and no race.

### What's left

- `suppressExternalReconcileUntil` still exists (used by scrub start/end + seek helpers). Will remove after testing confirms the tightened `isPlaying()` + reconcile debounce is sufficient on its own.
- PlaybackController Phase 2 wiring — next after cleanup stabilizes.
