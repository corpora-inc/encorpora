// The local stub Host. Seeded, exact, deterministic, and it attaches the full
// board so the standalone build plays the real ladder. Delete when the shared
// curriculum package lands; `specFromQuestion` already covers the fallback.

import type { Host, Question } from "./contract.ts";
import { toKey } from "./frac.ts";
import { puzzleAt, distractorsAt } from "./generate.ts";
import type { QuestionWithSpec } from "./adapter.ts";

export type StubReport = {
  questionId: string;
  correct: boolean;
  ms: number;
  answered: string;
};

export type StubHost = Host & {
  reports: StubReport[];
  index: number;
};

export function makeStubHost(opts?: {
  seed?: number;
  startIndex?: number;
  reducedMotion?: boolean;
  onReport?: (r: StubReport) => void;
}): StubHost {
  const seed = opts?.seed ?? 0x5eed1e;
  let index = opts?.startIndex ?? 0;
  const reports: StubReport[] = [];
  const host: StubHost = {
    get index() {
      return index;
    },
    reports,
    next(): Question {
      const spec = puzzleAt(index, seed);
      const q: QuestionWithSpec = {
        id: spec.id,
        prompt: spec.prompt,
        answer: toKey(spec.answer),
        distractors: distractorsAt(index, seed),
        domain: spec.domain,
        difficulty: spec.difficulty,
        spec,
      };
      index++;
      return q;
    },
    report(r) {
      reports.push(r);
      opts?.onReport?.(r);
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
