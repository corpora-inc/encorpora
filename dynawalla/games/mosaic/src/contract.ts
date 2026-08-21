/**
 * The game <-> host contract.
 *
 * Kept EXACTLY at the shape handed down so the swap to the shared package is
 * mechanical: delete this file, change the import specifier, done. Do not add
 * fields here — if the game needs something the host does not give it, the game
 * computes it itself (see `src/game/rules.ts`).
 */

export type Question = {
  id: string;
  /** "15 − 8" — display-ready, already in the learner's numerals. */
  prompt: string;
  /** "7" — exact, canonical. Never a float, never a rounded string. */
  answer: string;
  /** Plausible wrong answers, ideally real mal-rule outputs. */
  distractors: string[];
  /** "add-sub" | "mul-div" | "fractions" | ... */
  domain: string;
  /** 0..1 */
  difficulty: number;
};

export type Host = {
  next(): Question;
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void;
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
};

export type GameHandle = { unmount(): void };
