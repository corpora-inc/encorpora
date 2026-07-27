/**
 * The local stub Host.
 *
 * It exists so Serpent is fully playable on its own with `npm run dev`, and it
 * behaves the way a real adaptive host will: it serves a *run* of questions
 * sharing one condition, then rotates. The game reads a prompt change as a
 * mutation of the world, so the host — not the game — decides when the arena
 * transforms. That keeps the interesting decision on the side that will one day
 * know the learner model.
 */

import type { Host, Question, Report } from "../contract.ts";
import { makeCondition, type Condition } from "./generators.ts";
import { makeRng, type Rng } from "./rng.ts";

export type StubOptions = {
  seed?: string;
  startLevel?: number;
  /** Questions per condition before the arena mutates. */
  epochMin?: number;
  epochMax?: number;
  distractorsPerQuestion?: number;
  onReport?: (r: Report) => void;
};

export type StubHost = Host & {
  /** Diagnostics for the dev overlay. Never read by game logic. */
  stats(): { served: number; level: number; accuracy: number; domain: string };
};

function vibrate(kind: Parameters<Host["haptic"]>[0]): void {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (!nav || typeof nav.vibrate !== "function") return;
  const pattern: Record<typeof kind, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: 34,
    success: [10, 26, 16],
    failure: [30, 40, 30],
  };
  try {
    nav.vibrate(pattern[kind]);
  } catch {
    /* a browser that refuses haptics is not an error */
  }
}

export function createStubHost(options: StubOptions = {}): StubHost {
  const seed = options.seed ?? `serpent-${Date.now()}`;
  const rng: Rng = makeRng(seed);
  const epochMin = options.epochMin ?? 4;
  const epochMax = options.epochMax ?? 7;
  const nDistractors = options.distractorsPerQuestion ?? 5;

  let level = options.startLevel ?? 0;
  let baseLevel = options.startLevel ?? 0;
  let served = 0;
  let condition: Condition = makeCondition(rng, level);
  let epochLeft = rng.int(epochMin, epochMax);
  const recent: boolean[] = [];

  const reduced = (): boolean => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  function rotate(): void {
    baseLevel = Math.min(6, Math.floor(served / 6));
    const acc = recent.length >= 8 ? recent.filter(Boolean).length / recent.length : 0.7;
    const bump = acc > 0.85 ? 1 : acc < 0.55 ? -1 : 0;
    level = Math.max(0, Math.min(6, baseLevel + bump));
    condition = makeCondition(rng, level, condition.key);
    epochLeft = rng.int(epochMin, epochMax);
  }

  return {
    next(): Question {
      if (epochLeft <= 0) rotate();
      epochLeft -= 1;
      served += 1;

      const answer = rng.pick(condition.satisfying);
      const pool = rng.shuffle(condition.failing.slice());
      const distractors: string[] = [];
      for (const d of pool) {
        if (d === answer) continue;
        if (distractors.includes(d)) continue;
        distractors.push(d);
        if (distractors.length >= nDistractors) break;
      }

      return {
        id: `q${served}`,
        prompt: condition.prompt,
        answer,
        distractors,
        domain: condition.domain,
        difficulty: condition.difficulty,
      };
    },

    report(r: Report): void {
      recent.push(r.correct);
      if (recent.length > 12) recent.shift();
      options.onReport?.(r);
    },

    haptic: vibrate,

    prefersReducedMotion: reduced,

    stats() {
      const acc = recent.length === 0 ? 1 : recent.filter(Boolean).length / recent.length;
      return { served, level, accuracy: acc, domain: condition.domain };
    },
  };
}
