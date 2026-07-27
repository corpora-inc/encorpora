/**
 * The game <-> runtime contract.
 *
 * This is a verbatim local copy of the shape the shared Dynawalla package will
 * export. Keep it EXACTLY this shape so the swap is a one-line import change.
 * Nothing in this file may import anything.
 */

export type Question = {
  id: string;
  /** "15 − 8" — already formatted for display, using real math glyphs. */
  prompt: string;
  /** "7" — exact, canonical, string-compared. Never a float. */
  answer: string;
  /** Plausible wrong answers, ideally real mal-rule outputs. */
  distractors: string[];
  /** "add-sub" | "mul" | "div" | "two-step" | ... */
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
