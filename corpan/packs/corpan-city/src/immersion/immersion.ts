/**
 * Immersion resolver (IMMERSION_TOGGLE §3) — the ONE pure seam that decides *how
 * much native language appears on screen*. NEVER touches the DOM; returns
 * DECISIONS the orchestrator/surfaces apply.
 *
 * A per-Track setting (`off` | `reveal` | `on`) controls presentation:
 *   - `off`    → native help everywhere (glosses, native UI copy, bilingual games).
 *   - `reveal` → target-first; native hidden but available behind a reveal hatch.
 *   - `on`     → TOTAL immersion: NO native shown — UI copy renders in TARGET,
 *                the LLM is target-only, challenges drop their native gloss.
 *
 * The owner's ask in one line: **immersion ON = TARGET language EVERYWHERE.** That
 * is exactly `uiLocale() = hideNative() ? target : native` — every `t()` call and
 * the RTL `dir` resolve to `uiLocale()`, so the whole UI flips to target.
 *
 * SINGLE_LANGUAGE_RULE: a one-language Track (`target === native`) is INHERENTLY
 * `on` (there is no separate native to show); the resolver forces `on` regardless
 * of the stored value, and the toggle UI hides itself (no choice to offer).
 *
 * This mirrors the `ImmersionResolver` contract in `contracts/runtime.ts` verbatim
 * — surfaces consume the contract type; this is its concrete producer.
 */

import type { LearnerPair } from "@corpan-city/contracts"
import type { ImmersionResolver, Immersion } from "../contracts/runtime"

export type { Immersion } from "../contracts/runtime"
export type { ImmersionResolver } from "../contracts/runtime"

export interface CreateImmersionArgs {
  /** the Track's stored setting (default "off" for a new two-language Track). */
  level: Immersion
  /** to detect `target === native` → forced "on" (single-language immersion). */
  learnerPair: LearnerPair
}

/**
 * Build the pure resolver for a Track. Composition rules (the whole behavior,
 * centralized — IMMERSION_TOGGLE §3.2):
 *   - a single-language Track (`target === native`) is forced `on`.
 *   - `hideNative = level !== "off"`.
 *   - `uiLocale = hideNative ? target : native`.
 *   - `challengeNativeLanguage = hideNative ? undefined : native`.
 *   - `offerReveal = hideNative` (the reveal hatch exists whenever native hidden).
 *   - `proactiveReveal = level === "reveal"` (only this tier nudges the hatch).
 */
export function createImmersionResolver(args: CreateImmersionArgs): ImmersionResolver {
  const { learnerPair } = args
  const single = learnerPair.target === learnerPair.native
  // A single-language Track is inherently total immersion (no native to show).
  const level: Immersion = single ? "on" : args.level
  const hideNative = level !== "off"

  return {
    level: () => level,
    hideNative: () => hideNative,
    offerReveal: () => hideNative,
    proactiveReveal: () => level === "reveal",
    uiLocale: () => (hideNative ? learnerPair.target : learnerPair.native),
    challengeNativeLanguage: () => (hideNative ? undefined : learnerPair.native),
    languageDiscipline: (target, native) =>
      hideNative
        ? `Reply in ${target} ONLY. Do NOT translate or add any ${native} text or gloss; if a word is hard, rephrase it in simpler ${target}.`
        : `Reply in ${target} ONLY (one tiny (${native}) gloss in parentheses allowed for a new word).`,
    resolveStrings: <T>(native: T, target: T, opts?: { keepNative?: boolean }): T =>
      opts?.keepNative || !hideNative ? native : target,
  }
}

/**
 * True when the immersion TOGGLE should be shown for a pair. A single-language
 * Track has no native to hide, so the toggle is meaningless and hidden
 * (SINGLE_LANGUAGE_RULE). Two-language Tracks always show it.
 */
export function immersionToggleApplies(pair: LearnerPair): boolean {
  return pair.target !== pair.native
}

/** The next level when cycling the toggle (off → on → off; `reveal` collapses to
 *  the nearer endpoint so a 2-state control stays simple). Kept here so the
 *  control + any keyboard handler agree on the cycle. */
export function nextImmersionLevel(level: Immersion): Immersion {
  return level === "off" ? "on" : "off"
}
