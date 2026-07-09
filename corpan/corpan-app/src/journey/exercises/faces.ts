// src/journey/exercises/faces.ts — pure direction/face resolution for the
// translation renderers (ChoicePick, MatchPairs, FlipRecall). Extracted so the
// language-defense invariants (contract #2/#3) are unit-testable without a
// React renderer:
//
//   • a translation card NEVER renders identical prompt/option (or
//     prompt/reveal, or left/right) LANGUAGE — the EN→EN bug (defect #1);
//   • a missing native face degrades to a listening/reading form, never to
//     target-vs-target nonsense (Team A guards upstream; this is depth).

import { seededShuffle } from "../content/distractors.ts"
import { normalizeAnswer } from "../content/normalize.ts"
import type { ResolvedItem } from "../content/resolve.ts"

export type Direction = "toNative" | "toTarget" | "targetOnly"

/**
 * A usable native FACE exists when the item resolved a native-language string
 * that is a genuinely different language from the target. This is the real
 * translation-integrity gate (contract #2): it keys on the resolved face, NOT
 * on `nativeLang` (which is only a display hint and is sometimes absent even
 * when a gloss resolved), and it refuses a same-language "native" (the EN→EN
 * case). `nativeLang` undefined ≠ same language, so a gloss still shows.
 */
const hasNativeFace = (item: ResolvedItem, targetLang: string, nativeLang: string | undefined): boolean =>
  !!item.native?.text && nativeLang !== targetLang

/** Lang attribute for the native side — a display hint; "" (no attr) when
 *  the spec omitted nativeLang, which is fine (the native text still renders). */
const natLangOf = (nativeLang: string | undefined): string => nativeLang ?? ""

/* -------------------------------------------------------------- choice_pick */

export interface ChoiceFaces {
  /**
   * How the prompt is shown. "audio" whenever there is no valid
   * cross-language TEXT prompt (targetOnly, or a missing native face) — the
   * learner hears the target and picks the written target; we never print a
   * same-language text-vs-text pseudo-translation.
   */
  promptMode: "text" | "audio"
  promptText: string
  promptLang: string
  /** Which face the option tiles carry. */
  optionFace: "target" | "native"
  optionLang: string
}

export function choicePickFaces(
  item: ResolvedItem,
  direction: Direction,
  targetLang: string,
  nativeLang: string | undefined,
): ChoiceFaces {
  const hasNative = hasNativeFace(item, targetLang, nativeLang)
  if (direction === "toNative" && hasNative) {
    // See the target, pick its native meaning.
    return {
      promptMode: "text",
      promptText: item.target.text,
      promptLang: targetLang,
      optionFace: "native",
      optionLang: natLangOf(nativeLang),
    }
  }
  if (direction === "toTarget" && hasNative) {
    // See the native meaning, pick the target.
    return {
      promptMode: "text",
      promptText: item.native!.text,
      promptLang: natLangOf(nativeLang),
      optionFace: "target",
      optionLang: targetLang,
    }
  }
  // targetOnly, or a translation card whose native face is missing (should not
  // happen post-guard): fall back to a LISTENING form — audio prompt, target
  // options — never identical-language text.
  return {
    promptMode: "audio",
    promptText: item.target.text,
    promptLang: targetLang,
    optionFace: "target",
    optionLang: targetLang,
  }
}

/** The correct-answer text for a choice card given its resolved faces. */
export function choiceAnswerText(item: ResolvedItem, faces: ChoiceFaces): string {
  return faces.optionFace === "native" ? (item.native?.text ?? item.target.text) : item.target.text
}

/* -------------------------------------------------------------- match_pairs */

export type MatchAxis = "text-text" | "text-audio"

export interface MatchSide {
  key: string
  label: string
  /** Left side of a text-audio card plays audio instead of showing text. */
  audio?: boolean
}

export interface MatchColumns {
  /** Keys that formed a valid pair (spec order). The card completes when all
   *  of these are matched; per-item outcomes are keyed by these. */
  usableKeys: string[]
  left: MatchSide[]
  right: MatchSide[]
  leftLang: string
  rightLang: string
}

/** Max pairs rendered on one match card (Team A supplies 4–6-item sets). */
export const MATCH_MAX_PAIRS = 6

/**
 * Keep only items whose column labels are all UNIQUE across the board — a match
 * card must NEVER show the same choice text twice (defect: "Une las parejas"
 * with a duplicate tile). Two distinct items can resolve to the same target
 * surface (a case/diacritic twin) OR the same native gloss (e.g. two words that
 * both gloss to "el barco"); either collision makes a tile ambiguous — tapping
 * one "el barco" when its twin is the true pair reads as a wrong answer. We drop
 * the LATER colliding item (spec order preserved) rather than render the dupe.
 * `labels` are the concrete column strings for one item, in the language each
 * column surfaces in (so normalization folds case/punctuation/diacritics the
 * same way the answer-collision check does).
 */
function dedupByLabels(
  items: ResolvedItem[],
  labelsOf: (item: ResolvedItem) => { label: string; lang: string }[],
): ResolvedItem[] {
  const seen: Set<string>[] = []
  const kept: ResolvedItem[] = []
  outer: for (const item of items) {
    const labels = labelsOf(item)
    while (seen.length < labels.length) seen.push(new Set<string>())
    const norms = labels.map((l) => normalizeAnswer(l.label, l.lang))
    // Reject if ANY column's label already appeared, OR the item's own two
    // labels are identical after folding (a degenerate self-collision).
    if (new Set(norms).size !== norms.length) continue
    for (let c = 0; c < norms.length; c++) {
      if (seen[c].has(norms[c])) continue outer
    }
    for (let c = 0; c < norms.length; c++) seen[c].add(norms[c])
    kept.push(item)
  }
  return kept
}

export function matchColumns(
  items: ResolvedItem[],
  axis: MatchAxis,
  cardId: string,
  targetLang: string,
  nativeLang: string | undefined,
): MatchColumns {
  // text-text REQUIRES a native face on the right; without one there is no
  // legitimate translation pairing, so degrade to the audio form rather than
  // render target-vs-target (contract #2). The gate keys on the resolved
  // native FACE, not on nativeLang (which is only a display hint).
  const natLang = natLangOf(nativeLang)
  const withNative = items.filter((i) => hasNativeFace(i, targetLang, nativeLang))
  // Dedup BEFORE capping so a dropped dupe doesn't cost the board a real pair.
  const usableText = dedupByLabels(withNative, (i) => [
    { label: i.target.text, lang: targetLang },
    { label: i.native!.text, lang: natLang },
  ]).slice(0, MATCH_MAX_PAIRS)
  if (axis === "text-text" && usableText.length > 0) {
    return {
      usableKeys: usableText.map((i) => i.key),
      left: seededShuffle(`${cardId}-l`, usableText.map((i) => ({ key: i.key, label: i.target.text }))),
      right: seededShuffle(`${cardId}-r`, usableText.map((i) => ({ key: i.key, label: i.native!.text }))),
      leftLang: targetLang,
      rightLang: natLang,
    }
  }
  // Audio form: hear the target (left), match to the written target (right).
  // Identical language is fine here — one side is audio, not text — but the
  // WRITTEN target column still must not show the same word twice, so dedup on
  // the target surface (both columns carry it here).
  const usable = dedupByLabels(items, (i) => [{ label: i.target.text, lang: targetLang }]).slice(
    0,
    MATCH_MAX_PAIRS,
  )
  return {
    usableKeys: usable.map((i) => i.key),
    left: seededShuffle(`${cardId}-l`, usable.map((i) => ({ key: i.key, label: i.target.text, audio: true }))),
    right: seededShuffle(`${cardId}-r`, usable.map((i) => ({ key: i.key, label: i.target.text }))),
    leftLang: targetLang,
    rightLang: targetLang,
  }
}

/* -------------------------------------------------------------- flip_recall */

export interface FlipFaces {
  promptText: string
  promptLang: string
  revealText: string
  revealLang: string
  /** Prompt face is in the target language (renders via TargetText). */
  promptIsTarget: boolean
  /** Reveal face is the target language (gets audio + TargetText render). */
  revealIsTarget: boolean
}

export function flipFaces(
  item: ResolvedItem,
  direction: Direction,
  targetLang: string,
  nativeLang: string | undefined,
): FlipFaces {
  const hasNative = hasNativeFace(item, targetLang, nativeLang)
  if (direction === "toNative" && hasNative) {
    // Recall the MEANING: front target, back native.
    return {
      promptText: item.target.text,
      promptLang: targetLang,
      revealText: item.native!.text,
      revealLang: natLangOf(nativeLang),
      promptIsTarget: true,
      revealIsTarget: false,
    }
  }
  if (hasNative) {
    // Default / toTarget: front native meaning, back target (+audio).
    return {
      promptText: item.native!.text,
      promptLang: natLangOf(nativeLang),
      revealText: item.target.text,
      revealLang: targetLang,
      promptIsTarget: false,
      revealIsTarget: true,
    }
  }
  // native missing (defense): a target-only flashcard — front target, back
  // target with audio (an echo, not a translation).
  return {
    promptText: item.target.text,
    promptLang: targetLang,
    revealText: item.target.text,
    revealLang: targetLang,
    promptIsTarget: true,
    revealIsTarget: true,
  }
}
