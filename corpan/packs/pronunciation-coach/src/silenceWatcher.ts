// Pack-side silence detector.
//
// Consumes the native plugin's `audio_level` event stream (per-buffer
// RMS, ~11 Hz iOS / ~8 Hz Android). Runs a tiny state machine:
//
//   1. lead-in window: ignore everything (taps, breath, pre-start chatter)
//   2. waiting: watch for RMS above threshold sustained for `speechStartMs`
//      → transition to "speaking"
//   3. speaking: any frame above threshold resets the silence clock; first
//      sustained `silenceMs` of quiet fires `onSilence()` and stops.
//
// All policy lives here in JS so it ships with the pack and can be
// tuned per-language without touching native (see `whisperTuning.ts`).
// Native does the bare minimum — capture, RMS, emit.

import type { SttAudioLevelEvent } from "./game"

export type SilencePolicy = {
  /** 0..1 RMS threshold below which we count a sample as silence.
   *  Default tuned for `voice` AudioSource on Android + standard iOS
   *  input gain. */
  rmsThreshold?: number
  /** RMS above threshold must persist this long before we consider
   *  the user "speaking". Filters out room thumps and pop noises. */
  speechStartMs?: number
  /** After speech starts, this much continuous quiet fires the stop. */
  silenceMs?: number
  /** Drop the first N ms of events. Avoids triggering on the mic-tap
   *  artifact that can precede the first real audio buffer. */
  leadInMs?: number
}

export type ResolvedSilencePolicy = Required<SilencePolicy>

export const DEFAULT_SILENCE_POLICY: ResolvedSilencePolicy = {
  rmsThreshold: 0.012,
  speechStartMs: 120,
  silenceMs: 1500,
  leadInMs: 250,
}

export type SilenceWatcherHandle = {
  stop: () => void
}

export type SubscribeAudioLevel = (
  cb: (event: SttAudioLevelEvent) => void,
) => Promise<() => void>

export const startSilenceWatcher = (
  subscribe: SubscribeAudioLevel,
  policy: SilencePolicy,
  onSilence: () => void,
): SilenceWatcherHandle => {
  const cfg: ResolvedSilencePolicy = { ...DEFAULT_SILENCE_POLICY, ...policy }

  let stopped = false
  let unsubscribe: (() => void) | null = null

  // State machine
  let speechAboveSince: number | null = null
  let speechStartedAt: number | null = null
  let silenceStartedAt: number | null = null

  // Diagnostics. First-event log always fires (one-shot per watcher) so
  // we can confirm the native→JS wire is alive. Per-event verbose log
  // is opt-in via localStorage so it doesn't spam.
  let loggedFirst = false
  let verbose = false
  try {
    verbose = localStorage.getItem("pc:silence-debug") === "1"
  } catch {
    // localStorage can throw in obscure WebView contexts; we just
    // skip verbose mode.
  }

  const teardown = () => {
    if (stopped) return
    stopped = true
    const u = unsubscribe
    unsubscribe = null
    if (u) {
      try {
        u()
      } catch (err) {
        console.error("[silence-watcher] unsubscribe threw:", err)
      }
    }
  }

  const fire = () => {
    if (stopped) return
    teardown()
    try {
      onSilence()
    } catch (err) {
      console.error("[silence-watcher] onSilence threw:", err)
    }
  }

  const onEvent = (e: SttAudioLevelEvent) => {
    if (stopped) return
    if (!loggedFirst) {
      loggedFirst = true
      console.log(
        `[silence-watcher] first audio_level event: rms=${e.rms.toFixed(4)} t=${e.t}ms ` +
          `(policy: rmsThreshold=${cfg.rmsThreshold}, speechStartMs=${cfg.speechStartMs}, silenceMs=${cfg.silenceMs}, leadInMs=${cfg.leadInMs})`,
      )
    }
    if (verbose) {
      console.log(
        `[silence-watcher] rms=${e.rms.toFixed(4)} t=${e.t}ms ` +
          `state=${speechStartedAt === null ? "waiting" : "speaking"}`,
      )
    }
    if (e.t < cfg.leadInMs) return

    const above = e.rms >= cfg.rmsThreshold

    if (speechStartedAt === null) {
      if (above) {
        if (speechAboveSince === null) speechAboveSince = e.t
        if (e.t - speechAboveSince >= cfg.speechStartMs) {
          speechStartedAt = e.t
          silenceStartedAt = null
          console.log(
            `[silence-watcher] speech detected at t=${e.t}ms rms=${e.rms.toFixed(4)}`,
          )
        }
      } else {
        speechAboveSince = null
      }
      return
    }

    if (above) {
      silenceStartedAt = null
      return
    }
    if (silenceStartedAt === null) silenceStartedAt = e.t
    if (e.t - silenceStartedAt >= cfg.silenceMs) {
      console.log(
        `[silence-watcher] auto-stop at t=${e.t}ms ` +
          `(quiet for ${e.t - silenceStartedAt}ms after speech)`,
      )
      fire()
    }
  }

  console.log("[silence-watcher] subscribing to audio_level…")
  subscribe(onEvent)
    .then((u) => {
      console.log("[silence-watcher] subscribed; waiting for first event")
      if (stopped) {
        try {
          u()
        } catch (err) {
          console.error(
            "[silence-watcher] late unsubscribe threw:",
            err,
          )
        }
        return
      }
      unsubscribe = u
    })
    .catch((err) => {
      console.warn(
        "[silence-watcher] subscribe failed; auto-stop disabled:",
        (err as Error)?.message || err,
      )
    })

  return { stop: teardown }
}
