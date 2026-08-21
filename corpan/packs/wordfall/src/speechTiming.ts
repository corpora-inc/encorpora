/**
 * speechTiming.ts — a self-contained words-per-minute estimate for how long a
 * `hostApi.speak()` call is likely still audible.
 *
 * `HostApi.speak` is fire-and-forget by contract (`sdk/types.ts`:
 * `speak: (lang: string, text: string) => void` — no promise, no completion
 * event), so Wordfall can't `await` it to know when a spoken word actually
 * finishes. Before dispatching `corpan:exit`, the host's teardown calls
 * `hostApi.stopSpeech()` — cutting the final "you got it right" reward
 * mid-word if we exit immediately after firing it (see Game.ts `endRun`).
 * This estimates the remaining time instead, capped so an exit can never
 * hang on a bad estimate. Mirrors corpan-app's `util/audioManager.ts`
 * heuristic (same numbers) — duplicated here because packs build standalone
 * with no access to the host app's internals, only the HostApi surface.
 */

const WORDS_PER_MINUTE = 165
const MIN_DURATION_MS = 350
const MAX_DURATION_MS = 6000

/** Heuristic spoken-duration estimate for a short TTS utterance. */
export function estimateSpeechDurationMs(text: string): number {
  const words = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)
  const ms = (words / WORDS_PER_MINUTE) * 60_000
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
  now: () => number = () => performance.now()
): Promise<void> {
  if (!startedAt) return
  const elapsed = now() - startedAt
  const remaining = Math.max(0, estimatedDurationMs - elapsed)
  const waitMs = Math.min(remaining, capMs)
  if (waitMs <= 0) return
  await new Promise<void>((resolve) => setTimeout(resolve, waitMs))
}
