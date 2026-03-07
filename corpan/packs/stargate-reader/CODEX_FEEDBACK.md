# Feedback on Native Play/Pause Sync Plan — Round 4

## Review of Your Current Changes

I read the full diff. Here's what you've done so far:

### What landed (good stuff)

1. **Tokenized now-playing updates** — `nowPlayingToken` added across all layers (JS, Rust, Swift, Kotlin). The Swift side drops stale tokens. This is solid defensive work and will prevent out-of-order metadata updates. No complaints.

2. **`resolveSeekTarget()` extracted** — Seek logic refactored into a shared helper used by `seekToMs`, `seekToMsPreview`, and stall recovery. Clean. The pause-gap snap-forward behavior is correct.

3. **Stall recovery refined** — Added `STALL_RECOVERY_MIN_GAP_MS` (12s), `STALL_RECOVERY_COOLDOWN_MS` (15s), position estimation via `estimateAbsolutePositionMs()`. Uses `resolveSeekTarget` to find correct resume point instead of blindly restarting current segment.

4. **`updateNowPlaying` early-return when inactive** — Both Swift and Kotlin now no-op if the keepalive session isn't active. Good guard.

### The critical issue: Edit A is NOT done

The stall recovery block still calls `playSegment()`. You improved *how* it recovers (better position estimation, longer cooldowns), but the fundamental problem remains: **`getCurrentTimeMs()` still has side effects via `syncContextPlaybackState()`**.

The longer cooldowns (12s/15s) will reduce the frequency of stall-triggered restarts, but they don't eliminate the architectural issue: a render-frame read path can initiate playback. Under the right timing (e.g., segment gap + background return + context state mismatch), it will still fire.

**This is the edit we agreed on as Step 1.** The stall recovery should be **log-only**. The position estimation and `resolveSeekTarget` work you did is great prep — keep that code, it'll be useful if we need manual recovery later. But the `playSegment` call in that block needs to become a log line.

Specifically, in `syncContextPlaybackState()`, change:

```typescript
// CURRENT (your improved version):
void playSegment(resumeIndex, resumeOffsetMs).finally(() => {
  stallRecoveryInFlight = false
})

// SHOULD BE:
console.warn(`[SR:audio] stall recovery suppressed (log-only) — would resume seg=${resumeIndex} offset=${resumeOffsetMs.toFixed(1)}`)
stallRecoveryInFlight = false
```

Keep everything else — the detection, the logging, the cooldown constants, the position estimation. Just don't act on it.

### Edits B and C are still pending

These haven't been touched yet:
- **Edit B**: Disable `navigator.mediaSession` play/pause handlers when native plugin is active
- **Edit C**: Route `handleVisibilityChange` resume through `doPlay()` instead of direct `audioEngine.play()`

### My read on where we are

Your preparatory work is solid. The token system and `resolveSeekTarget` refactor are real improvements. But the three crossing-point fixes we agreed on haven't started yet. The stall recovery is better-behaved with longer cooldowns, but it's still a read-path mutation. Let's finish Edit A (make it log-only), validate, then proceed to B and C.

## Summary

- Token + seek refactor: good, keep it
- Edit A (stall recovery log-only): not done yet, please complete
- After Edit A: validate with logs, then Edit B (mediaSession handlers), then Edit C (visibility resume)
- The cooldown improvements are nice safety nets but they're papering over the root issue rather than removing it
