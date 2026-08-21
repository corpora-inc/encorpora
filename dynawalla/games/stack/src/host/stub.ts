/**
 * A local stub Host so the game is playable standalone with `npm run dev`.
 * The real runtime lands underneath this and the game never notices.
 */

import type { Host, Question } from "../contract.ts";
import { generate, makeRng } from "./mathgen.ts";

export type StubOpts = {
  seed?: number;
  /** How many faces the sliding block cycles through. The game sets this. */
  slots?: number;
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void;
};

export function createStubHost(opts: StubOpts = {}): Host & { setSlots(n: number): void } {
  const rng = makeRng(opts.seed ?? 0x5745);
  let slots = opts.slots ?? 3;
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const PATTERNS: Record<string, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: 34,
    success: [12, 26, 16],
    failure: [40, 50, 40],
  };

  return {
    setSlots(n: number) {
      slots = Math.max(2, Math.min(5, n | 0));
    },
    next(o?: { domain?: string; difficulty?: number }): Question {
      return generate(rng, o?.difficulty ?? 1, slots, o?.domain);
    },
    report(r) {
      opts.onReport?.(r);
    },
    haptic(k) {
      if (!canVibrate) return;
      try {
        navigator.vibrate(PATTERNS[k] ?? 10);
      } catch (err) {
        console.warn("[stack] haptic failed", err);
      }
    },
    prefersReducedMotion() {
      return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    },
  };
}
