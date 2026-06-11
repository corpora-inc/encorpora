/**
 * beatlounge — phrase-SCRATCH buffer prep: split a decoded snippet into WORDS by
 * silence and rebuild a "gapped" timeline (each word followed by a fixed silent
 * pad) so that, scrubbing the disc, every word is cleanly separated by audible
 * space and individually legible. The rebuild bakes the gaps into a real buffer,
 * so the engine stays a dumb looped source and the gaps are silent BY
 * CONSTRUCTION (no runtime envelope gating to drift).
 *
 * The DSP (silence-splitting + the sample layout plan) is pure and works on raw
 * Float32 frames, so it is unit-testable without an AudioContext. The thin
 * `buildGappedBuffer` wrapper just allocates the AudioBuffer and copies samples
 * per the plan.
 */

import { SILENCE_GAP, type WordSpan } from "./scratchMath"

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

/** One word's place in the rebuilt, gapped buffer (all in SAMPLES). */
export interface GapPlanSlot {
  /** Source span (samples) copied verbatim. */
  src: SampleWord
  /** Where the word's audio starts in the output buffer (samples). */
  outStart: number
  /** Where the word's audio ends in the output buffer (samples). */
  outEnd: number
  /** End of this slot including its trailing silent gap (samples). */
  slotEnd: number
}

export interface GapPlan {
  slots: GapPlanSlot[]
  /** Total length of the rebuilt buffer in samples (incl. all gaps). */
  totalSamples: number
}

/**
 * Plan a gapped layout: each word copied back-to-back with `gapSec` of silence
 * after it. Pure — returns sample offsets a copier follows. The source's own
 * (variable) inter-word silence is dropped so the spacing is uniform + tight.
 */
export const planGappedLayout = (
  words: SampleWord[],
  sampleRate: number,
  gapSec: number = SILENCE_GAP
): GapPlan => {
  const gap = Math.max(0, Math.floor(gapSec * sampleRate))
  const slots: GapPlanSlot[] = []
  let cursor = 0
  for (const w of words) {
    const len = Math.max(0, w.end - w.start)
    const outStart = cursor
    const outEnd = outStart + len
    const slotEnd = outEnd + gap
    slots.push({ src: { ...w }, outStart, outEnd, slotEnd })
    cursor = slotEnd
  }
  return { slots, totalSamples: cursor }
}

/** Word spans projected to SECONDS on the gapped output (for label sync). */
export const planToSeconds = (
  plan: GapPlan,
  sampleRate: number
): { spans: WordSpan[]; totalSeconds: number } => ({
  spans: plan.slots.map((s) => ({
    start: s.outStart / sampleRate,
    end: s.outEnd / sampleRate,
  })),
  totalSeconds: plan.totalSamples / sampleRate,
})

export interface GappedBuffer {
  buffer: AudioBuffer
  /** Audible word spans on the rebuilt buffer (seconds). */
  spans: WordSpan[]
  /** Per-word text aligned to `spans` (parallel array; may be undefined). */
  words: (string | undefined)[]
  totalSeconds: number
}

/**
 * Rebuild a decoded snippet into a gapped buffer: split into words, lay them out
 * with a uniform silent gap, and copy the samples into a fresh mono buffer.
 * `wordTexts` (optional) labels the slots in order; if there are more/fewer
 * detected words than texts the extras are left unlabeled (the disc still shows
 * the snippet text via the parent). The returned `spans` drive the rotating
 * label so the printed word matches what's heard.
 */
export const buildGappedBuffer = (
  ctx: BaseAudioContext,
  source: AudioBuffer,
  wordTexts: string[] = [],
  gapSec: number = SILENCE_GAP
): GappedBuffer => {
  const sr = source.sampleRate
  const src = source.getChannelData(0)
  const words = splitWordsBySilence(src, sr)
  const plan = planGappedLayout(words, sr, gapSec)
  const total = Math.max(1, plan.totalSamples)

  const out = ctx.createBuffer(1, total, sr)
  const dst = out.getChannelData(0)
  for (const slot of plan.slots) {
    const len = slot.outEnd - slot.outStart
    for (let i = 0; i < len; i++) {
      dst[slot.outStart + i] = src[slot.src.start + i] ?? 0
    }
  }

  const { spans, totalSeconds } = planToSeconds(plan, sr)
  const labels = plan.slots.map((_, i) => wordTexts[i])
  return { buffer: out, spans, words: labels, totalSeconds }
}
