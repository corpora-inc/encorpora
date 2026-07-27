/**
 * The stub Host.
 *
 * It stands in for the Dynawalla runtime so the game is fully playable with
 * `npm run dev`, and it is deliberately a *plausible* stand-in rather than a
 * generous one: a real adaptive ladder that walks up on clean answers and drops
 * hard on a miss, real mal-rule distractors, and a real reduced-motion query.
 * A harness that is kinder than the runtime proves nothing.
 */

import type { Host, Question } from "./contract.ts";
import { generate } from "./math/generate.ts";

export type DevHostOptions = {
  seed?: number;
  /** Start further up the ladder — used by the QA driver to reach two-step work. */
  difficulty?: number;
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
};

export function createDevHost(options: DevHostOptions = {}): Host {
  const seed = options.seed ?? (Date.now() & 0xffffffff);
  let index = 0;
  let difficulty = options.difficulty ?? 0.06;
  const motion =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  return {
    next(): Question {
      return generate(seed, index++, difficulty);
    },
    report(r) {
      // Up slowly, down fast — the shape every mastery ladder wants, and it
      // keeps a struggling child out of two-step work.
      if (r.correct) difficulty = Math.min(1, difficulty + (r.ms < 2500 ? 0.022 : 0.012));
      else difficulty = Math.max(0, difficulty - 0.055);
      options.onReport?.(r);
    },
    haptic(kind) {
      if (typeof navigator === "undefined" || !navigator.vibrate) return;
      const pattern: Record<typeof kind, number | number[]> = {
        light: 8,
        medium: 16,
        heavy: 32,
        success: [10, 26, 14],
        failure: [26, 40, 26],
      };
      try {
        navigator.vibrate(pattern[kind]);
      } catch {
        /* vibration is a courtesy, never a dependency */
      }
    },
    prefersReducedMotion() {
      return motion?.matches ?? false;
    },
  };
}
