// src/util/audioManager.ts — tracks the single active spoken utterance across
// the app so APP-initiated flows (auto-advance timers, reward-then-advance)
// can wait for it to finish before cutting the audio, while USER-initiated
// advancement (swipe/tap) keeps cutting it instantly via stopSpeech().
//
// Why an estimate instead of a real "finished" event: we don't have a
// completion signal from every backend.
//   - Browser Web Speech: `SpeechSynthesisUtterance.onend` IS a real signal —
//     speak.ts wires it to `endUtterance()`.
//   - Native (macOS/iOS/Android via tauri-plugin-tts): `invoke("...speak")`
//     resolves as soon as the OS is TOLD to speak, not when playback actually
//     ends (verified against plugins/tauri-plugin-tts — the desktop/macOS
//     command returns immediately after `speakUtterance:`, and no completion
//     event is wired to the frontend today). So native playback is tracked
//     with a words-per-minute estimate instead.
// Either way, callers get one simple API: `waitForActiveUtterance()`, capped
// so a bad estimate can never hang an app-initiated advance.

export interface ActiveUtterance {
  id: number
  startedAt: number
  estimatedDurationMs: number
}

let seq = 0
let active: ActiveUtterance | null = null

const WORDS_PER_MINUTE_AT_RATE_1 = 165 // rough average spoken-word rate
const MIN_DURATION_MS = 350
const MAX_DURATION_MS = 6000

/** Heuristic spoken-duration estimate for a short TTS utterance. */
export function estimateSpeechDurationMs(text: string, rate: number = 1): number {
  const words = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)
  const effectiveRate = rate > 0 ? rate : 1
  const ms = (words / (WORDS_PER_MINUTE_AT_RATE_1 * effectiveRate)) * 60_000
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms))
}

/**
 * Registers a newly-started utterance as "active". Call this at the moment
 * speech is dispatched — synchronously, before any `await` — so a
 * fire-and-forget `void speak(...)` call is already visible to a
 * synchronously-following advance decision (e.g. settle() → onRequestAdvance).
 */
export function beginUtterance(text: string, rate: number = 1): ActiveUtterance {
  const handle: ActiveUtterance = {
    id: ++seq,
    startedAt: Date.now(),
    estimatedDurationMs: estimateSpeechDurationMs(text, rate),
  }
  active = handle
  return handle
}

/** Marks the active utterance as finished early (browser onend/onerror, explicit stop). */
export function endUtterance(id?: number): void {
  if (id !== undefined && active?.id !== id) return
  active = null
}

/** True if we believe an utterance is still audibly playing. */
export function isUtteranceActive(): boolean {
  if (!active) return false
  return Date.now() - active.startedAt < active.estimatedDurationMs
}

/**
 * The id of the currently-tracked active utterance, if any. Lets a caller
 * that's about to do async work (e.g. stopSpeech() awaiting a native stop
 * call) capture "which utterance I'm stopping" up front and later end only
 * that id — so a new utterance that begins mid-await (e.g. the next card's
 * autoplay) isn't wiped out by a stale unscoped endUtterance() once the
 * await resolves.
 */
export function getActiveUtteranceId(): number | undefined {
  return active?.id
}

/**
 * Resolve once the active utterance is believed to be finished, capped at
 * `capMs` so an app-initiated advance can never hang on a bad estimate.
 * Safe/instant no-op when nothing is playing or it has already elapsed.
 */
export async function waitForActiveUtterance(capMs: number = 2000): Promise<void> {
  const u = active
  if (!u) return
  const elapsed = Date.now() - u.startedAt
  const remaining = Math.max(0, u.estimatedDurationMs - elapsed)
  const waitMs = Math.min(remaining, capMs)
  if (waitMs <= 0) return
  await new Promise((resolve) => setTimeout(resolve, waitMs))
}

/** Test/debug seam: force-clear tracked state. */
export function _resetAudioManagerForTests(): void {
  active = null
  seq = 0
}
