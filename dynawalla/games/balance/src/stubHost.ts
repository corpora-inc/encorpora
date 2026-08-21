// The local stub Host. Seeded, exact, deterministic, and it attaches the full
// board so the standalone build plays the real ladder. Delete when the shared
// curriculum package lands; `specFromQuestion` already covers the fallback.
//
// Two things changed here after the game was played end to end.
//
// **The seed is no longer a constant.** It defaulted to `0x5eed1e`, so every
// session — every time a child came back — replayed the identical run in the
// identical order. A seed reproduces a run *on purpose*: `?seed=` in the shell
// and every test in this package pass one. Nobody asked for the default.
//
// **It answers a difficulty request.** The rung used to be a counter that went
// up by one per question no matter who was playing. It is now a position on the
// same 0..1 ladder the real host speaks, so the standalone shell and the
// shipped pack adapt the same way and the pacing has somewhere to be tested.

import type { DifficultyRequest, Host, Question } from "./contract.ts";
import { toKey } from "./frac.ts";
import { puzzleAt, distractorsAt, MOVEMENTS, PUZZLES_PER_MOVEMENT } from "./generate.ts";
import { freshSeed } from "./rng.ts";
import type { QuestionWithSpec } from "./adapter.ts";

export type StubReport = {
  questionId: string;
  correct: boolean;
  ms: number;
  answered: string;
};

export type StubHost = Host & {
  reports: StubReport[];
  /** The rung the next question will be drawn from. */
  index: number;
  /** The floor `raiseFloor` has pushed under the stream, 0..1. */
  floor: number;
};

/** How many rungs the local ladder has. Difficulty 1 is the last one. */
export const LADDER_RUNGS = MOVEMENTS.length * PUZZLES_PER_MOVEMENT;

/** A 0..1 ladder position as a rung of the local ladder. */
export function rungFor(difficulty: number): number {
  if (!Number.isFinite(difficulty)) return 0;
  const d = difficulty < 0 ? 0 : difficulty > 1 ? 1 : difficulty;
  return Math.round(d * (LADDER_RUNGS - 1));
}

export function makeStubHost(opts?: {
  seed?: number;
  startIndex?: number;
  reducedMotion?: boolean;
  onReport?: (r: StubReport) => void;
}): StubHost {
  const seed = opts?.seed ?? freshSeed();
  let index = opts?.startIndex ?? 0;
  let served = 0;
  let floor = 0;
  const reports: StubReport[] = [];
  // The rung says *which* board; the draw keeps two questions at the same rung
  // from being the same question, which a difficulty that holds still would
  // otherwise guarantee.
  const drawSeed = (): number => (seed ^ Math.imul(served + 1, 0x85ebca6b)) >>> 0;
  const host: StubHost = {
    get index() {
      return index;
    },
    get floor() {
      return floor;
    },
    reports,
    next(request?: DifficultyRequest): Question {
      const d = request?.difficulty;
      const asked = typeof d === "number" && Number.isFinite(d);
      if (asked) index = rungFor(Math.max(d as number, floor));
      const s = drawSeed();
      const spec = puzzleAt(index, s);
      const q: QuestionWithSpec = {
        id: spec.id,
        prompt: spec.prompt,
        answer: toKey(spec.answer),
        distractors: distractorsAt(index, s),
        domain: spec.domain,
        difficulty: spec.difficulty,
        spec,
      };
      served++;
      // With no request at all this is the counter it always was.
      if (!asked) index++;
      return q;
    },
    report(r) {
      reports.push(r);
      opts?.onReport?.(r);
    },
    raiseFloor(difficulty: number) {
      if (!Number.isFinite(difficulty)) return;
      floor = Math.max(floor, Math.min(1, Math.max(0, difficulty)));
    },
    haptic() {
      // The real host routes to tauri-plugin-haptics. In a browser we try the
      // Vibration API and fall silent where it does not exist (all of iOS).
    },
    prefersReducedMotion(): boolean {
      if (opts?.reducedMotion !== undefined) return opts.reducedMotion;
      return (
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    },
  };
  return host;
}
