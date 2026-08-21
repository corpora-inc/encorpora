/**
 * speechTiming.ts — a self-contained words-per-minute estimate for how long a
 * `hostApi.speak()` call is likely still audible.
 *
 * `HostApi.speak` may return void OR a Promise (`sdk/types.ts`), and even where
 * it returns a Promise the NATIVE backends resolve as soon as the OS is TOLD to
 * speak, not when playback actually ends (see corpan-app/src/util/audioManager.ts
 * for the same caveat). So Drift cannot rely on `await speak(...)` alone to pace
 * its auto-narration; it awaits the call AND then waits out the estimated
 * remaining audible time, capped so a user-instant exit never hangs on a bad
 * estimate. Numbers mirror the host's audioManager heuristic (WPM/min/max) —
 * duplicated here because packs build standalone with no access to app internals.
 */

const WORDS_PER_MINUTE_AT_RATE_1 = 165
const MIN_DURATION_MS = 350
const MAX_DURATION_MS = 6000

/** Han + kana (unsegmented scripts): a whitespace split sees a whole Chinese/
 *  Japanese sentence as ONE "word", which would floor the estimate at 350ms
 *  and let the next utterance trample the narration. Count roughly two glyphs
 *  per spoken word instead. (The host's audioManager shares the WPM/min/max
 *  numbers but not — yet — this correction.) */
const HAN_KANA = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g

/** Spoken-word-equivalent count for a whitespace token (CJK-aware). */
function spokenUnits(token: string): number {
  const hanKana = token.match(HAN_KANA)?.length ?? 0
  return hanKana > 0 ? Math.max(1, Math.ceil(hanKana / 2)) : 1
}

/** Heuristic spoken-duration estimate for a short TTS utterance. */
export function estimateSpeechDurationMs(text: string, rate = 1): number {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  const words = Math.max(1, tokens.reduce((n, t) => n + spokenUnits(t), 0))
  const effectiveRate = rate > 0 ? rate : 1
  const ms = (words / (WORDS_PER_MINUTE_AT_RATE_1 * effectiveRate)) * 60_000
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms))
}

/**
 * Resolve once `startedAt + estimatedDurationMs` (both in `performance.now()`
 * units) has elapsed, capped at `capMs`. Instant no-op when nothing was ever
 * started (`startedAt` falsy), already elapsed, or `capMs <= 0`.
 */
export async function waitForEstimatedSpeech(
  startedAt: number,
  estimatedDurationMs: number,
  capMs: number,
  now: () => number = () => performance.now(),
): Promise<void> {
  if (!startedAt) return
  const elapsed = now() - startedAt
  const remaining = Math.max(0, estimatedDurationMs - elapsed)
  const waitMs = Math.min(remaining, capMs)
  if (waitMs <= 0) return
  await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
}
