/**
 * beatlounge — phrase-SCRATCH word-timing seam.
 *
 * The Platter places each word along the spiral groove at its REAL buffer-time
 * range, and the needle readout names the word under the head. To do that it needs
 * a `WordTiming[]` for the loaded phrase: where, in seconds, each word lives in the
 * single decoded wave.
 *
 * THE FORCED-ALIGNMENT SEAM (see SCRATCH.md): exact per-word timings are best
 * produced by forced alignment (e.g. Whisper, à la Parlometron). The host may one
 * day expose such a capability; when it does, EXACT timings plug in here — pass
 * them as `WordTiming[]` and the Platter consumes them verbatim. Until then we
 * APPROXIMATE: prefer the silence-split word boundaries from `scratchBuffer`
 * (`splitWordsBySilence`, mapped to seconds), and if silence detection is weak
 * (one blob, or word-count mismatch) fall back to an EVEN distribution by token
 * count over the phrase duration. We do NOT build Whisper now.
 */

import type { WordSpan } from "./scratchMath"
import { splitWordsBySilence, type SampleWord } from "./scratchBuffer"

/** A word's exact (or approximated) time range in the phrase, plus its text. */
export interface WordTiming {
  text: string
  startSec: number
  endSec: number
}

/** Project sample-index word spans to second-spans. */
const samplesToSpans = (words: SampleWord[], sampleRate: number): WordSpan[] =>
  words.map((w) => ({ start: w.start / sampleRate, end: w.end / sampleRate }))

/**
 * Evenly distribute `count` words across `[0, durationSec]` (the weak-signal
 * fallback). Each word gets an equal slice; legible + monotonic, never overlaps.
 */
export const evenWordSpans = (count: number, durationSec: number): WordSpan[] => {
  if (count <= 0 || !(durationSec > 0)) return []
  const slice = durationSec / count
  const spans: WordSpan[] = []
  for (let i = 0; i < count; i++) {
    spans.push({ start: i * slice, end: (i + 1) * slice })
  }
  return spans
}

/**
 * Resolve word spans (seconds, on the REAL phrase timeline) + their labels for a
 * decoded phrase. Precedence:
 *   1. EXACT `provided` timings (forced alignment) — used verbatim if present.
 *   2. SILENCE-SPLIT boundaries, IF the detected word count matches the token count
 *      (a clean split we can trust to label).
 *   3. EVEN distribution by token count (the robust fallback).
 *
 * `channel` is the mono signal (channel 0); `tokens` are the phrase's words.
 */
export const resolveWordSpans = (
  channel: Float32Array,
  sampleRate: number,
  durationSec: number,
  tokens: string[],
  provided?: WordTiming[]
): { spans: WordSpan[]; labels: string[] } => {
  // 1. Exact forced-alignment timings win.
  if (provided && provided.length > 0) {
    return {
      spans: provided.map((w) => ({ start: w.startSec, end: w.endSec })),
      labels: provided.map((w) => w.text),
    }
  }

  const cleanTokens = tokens.filter(Boolean)

  // 2. Trust the silence split only when it matches the token count.
  if (cleanTokens.length > 0 && channel.length > 0) {
    const detected = splitWordsBySilence(channel, sampleRate)
    if (detected.length === cleanTokens.length) {
      return { spans: samplesToSpans(detected, sampleRate), labels: cleanTokens }
    }
  }

  // 3. Even distribution by token count (or one span for the whole clip).
  if (cleanTokens.length > 0) {
    return { spans: evenWordSpans(cleanTokens.length, durationSec), labels: cleanTokens }
  }
  return { spans: [{ start: 0, end: durationSec }], labels: cleanTokens }
}
