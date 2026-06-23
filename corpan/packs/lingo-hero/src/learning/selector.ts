/**
 * learning/selector.ts — The spaced-difficulty WordSelector.
 *
 * STREAM: learning. This implements the foundation's `WordSelector` hook
 * (src/ContentManager.ts) to bias which word is QUIZZED (the target) and how
 * distractors are ORDERED, using the per-word memory (WordStatsStore) and the
 * gentle adaptive-difficulty signal.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║ CORRECTNESS CONTRACT (non-negotiable):                                    ║
 * ║  - chooseTarget MUST return one of `candidates` (the valid pool) or       ║
 * ║    undefined. ContentManager validates membership (inValid) and ignores   ║
 * ║    anything else, so we can NEVER fabricate an entry.                      ║
 * ║  - weight only REORDERS the distractor scan. ContentManager ALWAYS re-runs ║
 * ║    the distinct-entries + distinct-English-answers dedup AFTER us, so the  ║
 * ║    correct English still appears on EXACTLY ONE note. We can bias, never   ║
 * ║    break.                                                                  ║
 * ║  - observePool is side-effect only (priming the memory model).            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Selection philosophy:
 *  - Target: prefer DUE / WEAK words (spaced repetition), but mix in fresh and
 *    keep it stochastic so the game never feels like a drill. The
 *    adaptive-difficulty signal controls how hard we lean into resurfacing:
 *    hot learner ⇒ more due/weak pressure; struggling ⇒ ease toward fresh and
 *    already-comfortable words. Active-language prompts are strongly preferred
 *    (matches the foundation's own fallback) so the spoken prompt is on-target.
 *  - Distractors: bias toward believable foils (words the learner half-knows)
 *    so discrimination is trained — but never at the cost of the dedup contract.
 */

import type { EntryOut } from "../sdk/types";
import type { WordSelector } from "../ContentManager";
import type { WordStatsStore } from "./wordStats";
import type { AdaptiveDifficulty } from "./difficulty";

/** Resolve the foreign/english for context stamping (cheap, best-effort). */
function readContext(
  e: EntryOut,
  activeLang: string
): { foreign?: string; english?: string } {
  const english = e.translations.find((t) => t.language_code === "en")?.text?.trim();
  const foreign =
    e.translations.find((t) => t.language_code === activeLang && t.text.trim())?.text?.trim() ||
    e.translations.find((t) => t.language_code !== "en" && t.text.trim())?.text?.trim();
  return { foreign, english };
}

/** A small deterministic-but-jittered tiebreak so picks don't feel robotic. */
function jitter(): number {
  return Math.random() * 0.12;
}

/**
 * Build the learning WordSelector bound to a memory store + difficulty signal.
 * The store/difficulty are owned by the learning init and updated from the bus;
 * the selector only READS them here (selection must be pure-ish + cheap).
 */
export function createWordSelector(
  store: WordStatsStore,
  difficulty: AdaptiveDifficulty
): WordSelector {
  return {
    observePool(candidates: EntryOut[], activeLang: string): void {
      // Prime context for any unseen words so the mastery readout + scheduler
      // have human-readable labels available. Pure bookkeeping; no scheduling
      // side effects (markShown happens when a target is actually chosen).
      for (const e of candidates) {
        if (!store.get(e.entry_id)) {
          const { foreign, english } = readContext(e, activeLang);
          // ensure-on-read via a no-op record path: we only stamp context.
          // (We deliberately do NOT advance the wave clock here.)
          store.primeContext(e.entry_id, foreign, english);
        }
      }
    },

    chooseTarget(candidates: EntryOut[], activeLang: string): EntryOut | undefined {
      if (candidates.length === 0) return undefined;

      // Prefer candidates whose prompt is actually in the active language — this
      // mirrors the foundation's own fallback and keeps the spoken prompt on
      // target. If none match, fall back to the full valid pool.
      const inLang = candidates.filter((e) =>
        e.translations.some((t) => t.language_code === activeLang && t.text.trim())
      );
      const pool = inLang.length > 0 ? inLang : candidates;

      // How hard to lean into due/weak resurfacing, from the difficulty signal.
      // Even at the gentle end we keep SOME spacing pressure (0.35 floor) so the
      // learning value is always present; hot learners get the full push.
      const pressure = 0.35 + 0.65 * difficulty.value;

      // Score every candidate: urgency (spacing/weakness) blended with a small
      // exploration term so fresh content still flows and it never feels rote.
      let best: EntryOut | undefined;
      let bestScore = -Infinity;
      for (const e of pool) {
        const urgency = store.targetUrgency(e.entry_id); // 0..1
        const explore = jitter(); // 0..~0.12 stochastic freshness
        const score = pressure * urgency + (1 - pressure) * 0.5 + explore;
        if (score > bestScore) {
          bestScore = score;
          best = e;
        }
      }
      // Returning a member of `candidates` (pool ⊆ candidates) — contract-safe.
      // If for any reason nothing scored, return undefined to let CM fall back.
      return best;
    },

    weight(entry: EntryOut, _activeLang: string): number {
      // Higher = surface sooner as a distractor. Believable foils first. This
      // ONLY reorders the distractor scan; dedup still guarantees the correct
      // English appears on exactly one note.
      return store.distractorAffinity(entry.entry_id);
    },
  };
}
