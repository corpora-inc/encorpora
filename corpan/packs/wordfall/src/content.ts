/**
 * content.ts — how Wordfall turns entries into a "target word / meaning" round.
 *
 * Wordfall's decision each round: show ONE prompt (the meaning) at the top, and
 * rain several target-language word tiles; exactly the correct one means the
 * prompt. This module resolves, per entry, which translation is the TARGET
 * (the falling tile the learner should catch) and which is the PROMPT/meaning
 * (shown at top). It honors packs/SINGLE_LANGUAGE_RULE.md: a single-language
 * stack has no native gloss, so the prompt IS the target word and the learner
 * catches it by recognition/reading of that one language.
 */

import type { EntryOut, StackConfig, TranslationOut } from "./sdk/types"

export type RoundContent = {
  /** entry this round is built from (spec item, when journey-launched). */
  entryId: number
  /** the tile the learner must catch (target-language surface). */
  targetText: string
  /** optional romanization shown under the target tile. */
  targetRoman?: string
  /** BCP-47 code the target tile is spoken/labelled in. */
  targetLang: string
  /** the prompt shown at the top — the meaning to match. Equals targetText on
   *  a single-language (immersion) stack (there is no native gloss). */
  promptText: string
  /** true when prompt === target (immersion: recognise the written word). */
  immersion: boolean
}

const findTr = (
  entry: EntryOut,
  code: string
): TranslationOut | undefined =>
  entry.translations.find((t) => t.language_code === code)

/**
 * Pick target + prompt for an entry, given the stack. Mirrors the canonical
 * pronunciation-coach pattern: single-language stacks short-circuit to
 * immersion (prompt === target, no native gloss). Returns null when the entry
 * carries no usable target translation.
 */
export function resolveRound(
  entry: EntryOut,
  cfg: Pick<StackConfig, "languages">,
  specTarget?: string,
  specNative?: string
): RoundContent | null {
  const langs = cfg.languages.filter(Boolean)
  const native = specNative ?? langs[0]
  // Prefer the spec's target; else the first non-native studied language; else
  // the sole language on an immersion stack.
  const target =
    specTarget ??
    langs.find((l) => l !== native) ??
    langs[0]
  if (!target) return null

  const targetTr = findTr(entry, target)
  if (!targetTr || !targetTr.text) return null

  const singleLanguage = langs.length <= 1 || !native || native === target
  if (singleLanguage) {
    return {
      entryId: entry.entry_id,
      targetText: targetTr.text,
      targetRoman: targetTr.romanization,
      targetLang: target,
      promptText: targetTr.text,
      immersion: true,
    }
  }

  const nativeTr = findTr(entry, native)
  // No native gloss available even on a multi-language stack → fall back to
  // immersion rather than dropping the round.
  const promptText = nativeTr?.text || targetTr.text
  return {
    entryId: entry.entry_id,
    targetText: targetTr.text,
    targetRoman: targetTr.romanization,
    targetLang: target,
    promptText,
    immersion: !nativeTr?.text,
  }
}

/**
 * Build a distractor set of target-language surfaces for a round: other
 * entries' target words, deduped against the correct answer (and each other).
 * Distractors come from the same sampler the feed uses (hostApi.getRandomEntries).
 */
export function buildDistractors(
  pool: EntryOut[],
  correct: RoundContent,
  target: string,
  wanted: number
): string[] {
  const seen = new Set<string>([correct.targetText.toLowerCase()])
  const out: string[] = []
  for (const entry of pool) {
    if (entry.entry_id === correct.entryId) continue
    const tr = findTr(entry, target)
    const text = tr?.text?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= wanted) break
  }
  return out
}
