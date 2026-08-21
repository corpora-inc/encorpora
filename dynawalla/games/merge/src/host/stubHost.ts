import type { FocusableHost, Question } from "../contract.ts";
import { Rng, hashSeed } from "../core/rng.ts";
import { questionFor } from "./questions.ts";

/**
 * The local stub Host.
 *
 * It exists so FUSE is fully playable with `npm run dev` before the real
 * Dynawalla host lands. It generates exactly the same shape the real one will,
 * from a seed, so a run is reproducible.
 *
 * It also implements the optional `focus` extension: FUSE tells it which tile
 * values are coming, and it produces expressions for those values. A host
 * without `focus` still works — the game simply shows fewer expression tiles.
 */
export type StubTally = {
  asked: number;
  correct: number;
  totalMs: number;
};

export function createStubHost(seedText = "fuse"): FocusableHost & {
  tally(): StubTally;
  log: { questionId: string; correct: boolean; ms: number; answered: string }[];
} {
  const rng = new Rng(hashSeed(seedText));
  let seq = 0;
  let difficulty = 0.2;
  let wanted: number[] = [];
  let key = 10;
  const log: { questionId: string; correct: boolean; ms: number; answered: string }[] = [];
  const tally: StubTally = { asked: 0, correct: 0, totalMs: 0 };

  const canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  const patterns: Record<string, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: [26, 20, 34],
    success: [12, 40, 12],
    failure: [40, 30, 60],
  };

  return {
    next(): Question {
      seq++;
      tally.asked++;
      const value = wanted.length > 0 ? (wanted.shift() as number) : rng.range(1, key - 1);
      return questionFor(Math.max(1, value), difficulty, rng, seq);
    },
    report(r) {
      log.push(r);
      if (r.correct) tally.correct++;
      tally.totalMs += r.ms;
    },
    haptic(kind) {
      if (!canVibrate) return;
      try {
        navigator.vibrate(patterns[kind] ?? 10);
      } catch {
        /* a browser that refuses to buzz is not an error */
      }
    },
    prefersReducedMotion() {
      if (typeof matchMedia !== "function") return false;
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    focus(spec) {
      key = spec.key;
      wanted = spec.wanted.slice(0, 24);
      // difficulty tracks the key ladder: complements of 10 are easy, of 100 are not
      difficulty = Math.max(0.1, Math.min(0.95, (spec.key - 6) / 100 + 0.15));
    },
    tally() {
      return { ...tally };
    },
    log,
  };
}
