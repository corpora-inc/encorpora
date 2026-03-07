# Claude Feedback on Round 25 Plan (iOS Audio Moonshot)

## Overall Assessment

The diagnosis is correct: dual owner + dual command path + dual timeline is the root cause. Single authority is the right goal. But the proposed solution (HTMLMediaElement backend) is riskier and more invasive than necessary. There's a simpler path.

## Critical Observation: The Native Plugin Is Already Vestigial

Looking at the current Swift code:

```swift
private let useSilentLoop = false  // line 17
private let enableExtendedTransportControls = false  // line 19
```

The silent loop is **disabled**. The extended transport controls are **disabled**. The native plugin currently does only three things:

1. Configures `AVAudioSession.category = .playback` (needed, keep this)
2. Registers `MPRemoteCommandCenter` play/pause targets (THIS IS THE PROBLEM)
3. Writes to `MPNowPlayingInfoCenter` (THIS IS THE OTHER PROBLEM)

Meanwhile, log evidence from Rounds 5-22 repeatedly shows:
- "WebKit owner toggles YES/NO while native NPIC writes continue"
- WebKit is ALREADY creating a NowPlaying entry from Web Audio activity
- The native plugin is overwriting it, creating ownership flapping

## Recommended Plan: WebKit-Only Media Session (Option A)

Instead of switching the entire audio backend to HTMLMediaElement, **remove the native plugin's media session contention and let WebKit own it**.

### Why This Is Better Than HTMLMediaElement Backend

| Concern | HTMLMediaElement Backend | WebKit-Only Media Session |
|---------|------------------------|--------------------------|
| Audio backend change | Yes (huge) | No |
| Segment transition precision | Degraded (`<audio>` timing less precise) | Preserved (Web Audio stays) |
| AnalyserNode / oscilloscope | Lost (needs parallel Web Audio path) | Preserved |
| Word-level timeline sync | Degraded | Preserved |
| Waveform extraction | Broken (no AudioBuffer access) | Preserved |
| Lines of code changed | Hundreds (new backend + interface) | ~50-80 (mostly removals) |
| Rollback complexity | High (feature flag whole backend) | Low (re-enable native calls) |
| Risk of new bugs | High (new audio path) | Low (removing contention) |

### The Key Insight

On Android, native `MediaSessionCompat` is sole owner and JS doesn't touch Web MediaSession. That works.

On iOS, the equivalent single-owner pattern is: **WebKit media session is sole owner and native plugin doesn't touch `MPNowPlayingInfoCenter` or `MPRemoteCommandCenter`.**

WebKit is already trying to own the media session via Web Audio activity. We should lean into that, not fight it.

### Execution Plan (Revised)

#### Phase 1: Strip Native Plugin to Session-Bootstrap-Only (iOS)

**Swift changes** (`AudioKeepAlivePlugin.swift`):

In `startAudioKeepalive`:
- Keep `configureAudioSession()` (sets `.playback` category — still needed)
- **Remove** `setupRemoteCommands()` call entirely
- **Remove** initial `updateNowPlayingInfo()` call
- Keep the start event trigger

In `updateNowPlaying`:
- Make it a **no-op** (or guard behind a flag). Stop writing to `MPNowPlayingInfoCenter.default()`.

In `pauseAudioKeepalive` / `resumeAudioKeepalive`:
- Remove the `MPNowPlayingInfoCenter` playbackRate writes
- Keep the event triggers (JS still needs to know about state sync requests)

The native plugin becomes: configure audio session, fire events, that's it.

**JS changes** (`game.ts`):

In `setupMediaSession()`:
- Remove the `hasNativeBridge && !isAndroid` early-return and play/pause disable
- Register ALL handlers on iOS too: `play`, `pause`, `seekto`, `seekforward`, `seekbackward`
- This makes `navigator.mediaSession` the sole lock screen control surface on iOS

In `listenForRemoteCommands` setup:
- Keep listening for native events (interruption, route change are still useful)
- But play/pause commands now come through Web MediaSession, not native plugin

In `syncMediaSessionNowPlaying()` and `syncMediaSessionPlaybackState()`:
- Remove the `nativeOwnsMediaSession` guard for iOS (iOS should USE web media session now)
- Keep the guard for Android (Android still uses native)

**Expected result:**
- WebKit owns NowPlaying based on Web Audio activity
- `navigator.mediaSession` sets metadata, position, and handlers
- No native NPIC/RemoteCommand competition
- Lock screen shows correct title/artist/time
- Lock screen play/pause/seek controls work via Web MediaSession handlers

#### Phase 2: Enable Extended Transport Controls via Web MediaSession

Add `navigator.mediaSession` handlers for:
- `seekto` — calls `seekToMsAndSync(action.seekTime * 1000)`
- `seekforward` — skips 30s forward
- `seekbackward` — skips 30s back
- `previoustrack` / `nexttrack` — chapter navigation (if supported by WebKit version)

This gives iOS users the forward/back/scrub controls that are currently missing, through the same API that Chrome uses on Android desktop.

#### Phase 3: Deterministic Position State

Use `navigator.mediaSession.setPositionState()` as the sole position writer:
- Update on explicit events only: play, pause, seek commit, segment transition
- Remove periodic now-playing sync entirely (the `15s autosave` path's native sync)
- Compute position from audioEngine.getCurrentTimeMs() at event time
- No background timer position updates

Anchor model:
```ts
// On each state transition:
navigator.mediaSession.setPositionState({
  duration: totalDurationMs / 1000,
  playbackRate: isPlaying ? 1.0 : 0.0,
  position: audioEngine.getCurrentTimeMs() / 1000,
})
```

This fixes elapsed/remaining resets because there's exactly one position writer and it only writes on real transitions.

#### Phase 4: Validate and Harden

Same gates as Round 25:
- Play/pause parity within 500ms
- No backward elapsed jumps > 100ms
- Zero unrecoverable freeze in 10-minute chaos test
- Every visible lockscreen control works

### Risk Assessment

**Primary risk:** `navigator.mediaSession` on iOS WKWebView might not show all controls.

Mitigation: Test Phase 1 immediately. If WKWebView doesn't show lockscreen controls via `navigator.mediaSession`, we know within 1 build. Fallback is to re-enable native remote commands but keep NPIC writes removed (partial single-owner).

**Secondary risk:** Background audio might stop without native remote command registration.

Mitigation: The silent loop is already disabled (`useSilentLoop = false`). Background audio currently works via Web Audio + `.playback` session category. If it stops working after removing native remote commands, re-enable the silent loop as an independent fix (it uses raw AVAudioEngine which doesn't auto-register with MPNowPlayingInfoCenter, so it won't create contention).

**Tertiary risk:** `navigator.mediaSession.setPositionState()` might not update iOS lock screen progress bar.

Mitigation: Testable in isolation. If it doesn't work, the native NPIC position writer can be kept as a position-only writer (no metadata/command ownership, just position updates).

## What NOT To Do

1. **Do not introduce HTMLMediaElement backend** unless Phase 1 proves that WebKit won't show lock screen controls for Web Audio at all. The HTMLMediaElement path breaks the visualization system (AnalyserNode, waveform extraction, precise timing) and requires building an entirely new audio backend.

2. **Do not add more reconciliation/heal logic.** 25 rounds of evidence prove that defensive patches on top of dual ownership make things worse.

3. **Do not wire the playbackController.ts in this phase.** The controller solves multiple-mutable-truths, which goes away with single owner. If single-owner proves stable, the controller is unnecessary. If single-owner fails, the controller doesn't help because contention is at the OS media session level, not JS state.

## Immediate Next Step

**One build, one test:**

1. Comment out `setupRemoteCommands()` in Swift `startAudioKeepalive`
2. Comment out `updateNowPlayingInfo()` calls in Swift
3. Remove the `hasNativeBridge && !isAndroid` early-return in `setupMediaSession()`
4. Add `seekto`, `seekforward`, `seekbackward` handlers in `setupMediaSession()`
5. Build, deploy to iPad, test lock screen

If lock screen shows controls and they work: proceed with Phase 2-4.
If lock screen is blank: we know WebKit/WKWebView doesn't surface `navigator.mediaSession` for Web Audio, and we switch to HTMLMediaElement backend (Round 25's plan).

This takes 30 minutes to test and avoids weeks of HTMLMediaElement backend development that might not be necessary.

## Summary

The plan should be **remove contention first, add new backend second (only if needed)**. Twenty-five rounds of patching prove that you cannot reconcile two media session owners. The simplest path to single ownership on iOS is removing the native plugin's media session writes, not replacing the entire audio backend.

---

## Appendix: File Change Inventory

### Files to modify (Phase 1):

1. `plugins/tauri-plugin-audio-keepalive/ios/Sources/AudioKeepAlivePlugin.swift`
   - Remove `setupRemoteCommands()` call from `startAudioKeepalive`
   - Remove `updateNowPlayingInfo()` calls
   - Remove NPIC writes from pause/resume handlers

2. `packs/stargate-reader/src/game.ts`
   - `setupMediaSession()`: remove iOS early-return, add seek/skip handlers
   - Remove `nativeOwnsMediaSession` guard from `syncMediaSessionPlaybackState` / `syncMediaSessionNowPlaying` for iOS

### Files NOT to modify:

- `src/audio/audioEngine.ts` — no changes needed, Web Audio stays
- `src/ui/transportBar.ts` — no changes needed
- `src/audio/nativeKeepAlive.ts` — keep as-is (event listening still works for interruptions)
- `src/state/playbackController.ts` — defer (not wired, not needed yet)
- Android plugin files — no changes (already working)
- `src/diagnostics/trace.ts` — keep for validation
