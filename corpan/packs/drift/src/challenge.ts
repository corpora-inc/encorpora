/**
 * challenge.ts — the Drift "light game" logic, DOM-free + deterministic so it
 * unit-tests headless (mirrors wordfall's tileLayout/session split).
 *
 * The mechanic is TAP-THE-WORD-YOU-HEARD, grounded in the beat just narrated:
 * after a beat is spoken, Drift isolates ONE content word from that beat, speaks
 * it alone, and floats 3–4 candidate words (the target + distractors drawn from
 * the story's other words). The learner taps the word they heard. This reuses
 * the existing beat/token/gloss data model (glossable tokens are the natural
 * candidate surfaces) and needs no new content — it stays pair-agnostic and
 * multilingual.
 *
 * This module produces the challenges (`buildChallenges`) and scores answered
 * ones (`scoreChallenges`). It never touches the DOM, TTS, or the journey seam
 * (that is `session.ts` + `game.ts`).
 */

import type { Beat, ComposedStory } from "./content/compose"
import type { ItemRef } from "./sdk/activityContract"

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 4
/** A candidate word must be at least this many characters to be worth hearing. */
export const MIN_WORD_LEN = 2
/** Longest chip-friendly candidate for whitespace-segmented scripts. */
export const MAX_WORD_LEN = 24
/**
 * Longest chip-friendly candidate for unsegmented han/kana text. Chinese and
 * Japanese lines carry no spaces, so the tokenizer yields the WHOLE LINE as one
 * "word" — a real word in those scripts is 1–4 glyphs, anything longer is an
 * unsegmented sentence and must never be posed as a tap-the-word target.
 */
export const MAX_CJK_WORD_LEN = 4

/** One light challenge: hear `targetWord`, tap it among `options`. */
export type Challenge = {
  /** Index of the beat this challenge follows (narration order). */
  beatIndex: number
  /** The word to identify — display form, surrounding punctuation stripped. */
  targetWord: string
  /** Native gloss for the target, when the host had one (feedback only). */
  targetGloss: string
  /** Candidate surfaces incl. the target, in presentation order (shuffled). */
  options: string[]
  /** The phrase/entry this beat came from — journey per-item evidence key. */
  itemRef?: ItemRef
}

/** A resolved challenge, ready to score. */
export type ChallengeAnswer = {
  challenge: Challenge
  correct: boolean
  /** Presentation → tap latency, ms. */
  latencyMs: number
}

// ---- word helpers ----------------------------------------------------------

const PUNCT = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu

/** Strip surrounding punctuation/symbols and trim (keeps the word's script). */
export function normalizeWord(s: string): string {
  return s.replace(PUNCT, "").trim()
}

/** Case-folded key for dedup/compare (harmless no-op on caseless scripts). */
function wordKey(s: string): string {
  return normalizeWord(s).toLocaleLowerCase()
}

/** Compare a learner's tap to a challenge target (punctuation/case-insensitive). */
export function isCorrectPick(pick: string, target: string): boolean {
  return wordKey(pick) === wordKey(target)
}

type WordEntry = { word: string; gloss: string }

/** Han + kana ranges (unsegmented scripts; hangul/Thai excluded — Korean is
 *  space-segmented and Thai needs a real segmenter, see MAX_CJK_WORD_LEN). */
const HAN_KANA = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/gu

/** True when `word` is short enough to be a plausible single spoken word. */
export function isChipFriendly(word: string): boolean {
  const hanKana = word.match(HAN_KANA)?.length ?? 0
  if (hanKana >= word.length / 2) return word.length <= MAX_CJK_WORD_LEN
  return word.length <= MAX_WORD_LEN
}

/** Distinct content words from a beat (normalized display + best gloss). */
function beatWords(beat: Beat): WordEntry[] {
  const seen = new Set<string>()
  const out: WordEntry[] = []
  for (const tok of beat.tokens) {
    if (!tok.glossable) continue
    const word = normalizeWord(tok.text)
    if (word.length < MIN_WORD_LEN) continue
    if (!isChipFriendly(word)) continue // unsegmented sentence / over-long token
    const k = wordKey(word)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ word, gloss: tok.gloss ?? beat.nativeGloss ?? "" })
  }
  return out
}

// ---- deterministic RNG (mulberry32) ----------------------------------------

/** Tiny seeded PRNG so challenge generation is reproducible in tests. */
export function makeRng(seed: number): () => number {
  let a = (Math.floor(seed) || 1) >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickIndex(rng: () => number, len: number): number {
  return Math.min(len - 1, Math.floor(rng() * len))
}

/** Fisher–Yates using the seeded rng (does not mutate the input). */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Sample up to `n` distinct entries (by word key) from a pool, seeded. */
function sampleDistinct(pool: readonly WordEntry[], n: number, rng: () => number): WordEntry[] {
  const out: WordEntry[] = []
  const used = new Set<string>()
  for (const e of shuffle(pool, rng)) {
    if (out.length >= n) break
    const k = wordKey(e.word)
    if (used.has(k)) continue
    used.add(k)
    out.push(e)
  }
  return out
}

// ---- generation ------------------------------------------------------------

/**
 * Build one tap-the-word challenge per beat that has a content word AND at
 * least one distinct distractor available in the story. Beats with no viable
 * choice are skipped (the reader still narrates them). Deterministic for a
 * given `seed` so the same mount always poses the same challenges.
 */
export function buildChallenges(story: ComposedStory, seed = 1): Challenge[] {
  const rng = makeRng(seed)

  // Global distractor pool: distinct content words across the whole story.
  const poolByKey = new Map<string, WordEntry>()
  for (const beat of story.beats) {
    for (const w of beatWords(beat)) {
      const k = wordKey(w.word)
      if (!poolByKey.has(k)) poolByKey.set(k, w)
    }
  }
  const pool = [...poolByKey.values()]

  const challenges: Challenge[] = []
  story.beats.forEach((beat, beatIndex) => {
    const words = beatWords(beat)
    if (words.length === 0) return
    const target = words[pickIndex(rng, words.length)]
    const targetKey = wordKey(target.word)
    const distractPool = pool.filter((w) => wordKey(w.word) !== targetKey)
    const distractors = sampleDistinct(distractPool, MAX_OPTIONS - 1, rng)
    if (distractors.length < MIN_OPTIONS - 1) return // no real choice → skip beat
    const options = shuffle([target.word, ...distractors.map((d) => d.word)], rng)
    challenges.push({
      beatIndex,
      targetWord: target.word,
      targetGloss: target.gloss,
      options,
      ...(beat.itemRef ? { itemRef: beat.itemRef } : {}),
    })
  })
  return challenges
}

// ---- scoring ---------------------------------------------------------------

export type ChallengeScore = {
  /** Normalized aggregate over ALL answered challenges, 0..1. */
  score: number
  faced: number
  correct: number
}

/** Aggregate answered challenges into a 0..1 score (empty ⇒ 0). */
export function scoreChallenges(answers: readonly ChallengeAnswer[]): ChallengeScore {
  const faced = answers.length
  const correct = answers.reduce((n, a) => n + (a.correct ? 1 : 0), 0)
  return { score: faced > 0 ? correct / faced : 0, faced, correct }
}
