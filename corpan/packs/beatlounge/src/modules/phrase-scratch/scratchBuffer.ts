/**
 * beatlounge — phrase-SCRATCH word detection.
 *
 * The real turntable plays the RAW decoded wave (one buffer, one read-head — see
 * scratchEngine.ts), so the old "gapped buffer" rebuild (splitting words and
 * baking in silence) is RETIRED — that was a crutch for the granular looper. What
 * survives is the pure silence-split, used ONLY to APPROXIMATE word time ranges for
 * the visual word-placement / needle readout (see `wordTiming.ts`). Exact timings,
 * when available, come from forced alignment instead.
 *
 * The DSP is pure (works on raw Float32 frames) so it is unit-testable without an
 * AudioContext.
 */

/** A word found in the source signal, in SAMPLE indices. */
export interface SampleWord {
  start: number
  end: number
}

/** RMS amplitude over a window — the speech/silence discriminator. */
const windowRms = (data: Float32Array, from: number, to: number): number => {
  let sum = 0
  const n = Math.max(1, to - from)
  for (let i = from; i < to; i++) sum += data[i] * data[i]
  return Math.sqrt(sum / n)
}

/**
 * Split a mono signal into word spans by silence. A frame is "voiced" if its
 * short-window RMS exceeds `floor` (a fraction of the peak RMS); runs of voiced
 * frames separated by >= `minGapSec` of silence become distinct words. Trailing
 * silence is trimmed. Returns at least one span (the whole clip) if nothing
 * splits, so callers always have something to lay out.
 */
export const splitWordsBySilence = (
  data: Float32Array,
  sampleRate: number,
  opts: { floorFrac?: number; minGapSec?: number; minWordSec?: number } = {}
): SampleWord[] => {
  const n = data.length
  if (n === 0) return []
  const floorFrac = opts.floorFrac ?? 0.12
  const minGap = Math.max(1, Math.floor((opts.minGapSec ?? 0.09) * sampleRate))
  const minWord = Math.max(1, Math.floor((opts.minWordSec ?? 0.05) * sampleRate))
  const win = Math.max(1, Math.floor(0.01 * sampleRate)) // 10ms RMS window

  // Peak RMS for an adaptive floor (robust to quiet vs loud renders).
  let peak = 0
  for (let i = 0; i < n; i += win) {
    const r = windowRms(data, i, Math.min(n, i + win))
    if (r > peak) peak = r
  }
  if (peak <= 0) return [{ start: 0, end: n }]
  const floor = peak * floorFrac

  // Mark voiced windows, then coalesce into words split by long silence runs.
  const words: SampleWord[] = []
  let wordStart = -1
  let silenceRun = 0
  for (let i = 0; i < n; i += win) {
    const to = Math.min(n, i + win)
    const voiced = windowRms(data, i, to) >= floor
    if (voiced) {
      if (wordStart < 0) wordStart = i
      silenceRun = 0
    } else if (wordStart >= 0) {
      silenceRun += to - i
      if (silenceRun >= minGap) {
        const end = i - silenceRun + (to - i) // start of the silence run
        words.push({ start: wordStart, end: Math.max(wordStart + 1, end) })
        wordStart = -1
        silenceRun = 0
      }
    }
  }
  if (wordStart >= 0) words.push({ start: wordStart, end: n })

  // Merge fragments shorter than minWord into their predecessor (de-fizz).
  const merged: SampleWord[] = []
  for (const w of words) {
    const prev = merged[merged.length - 1]
    if (prev && w.end - w.start < minWord) {
      prev.end = w.end
    } else {
      merged.push({ ...w })
    }
  }
  return merged.length > 0 ? merged : [{ start: 0, end: n }]
}
