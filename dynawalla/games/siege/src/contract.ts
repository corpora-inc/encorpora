/**
 * The game <-> runtime contract.
 *
 * A shared package will replace this file. Keep the shape EXACTLY as written so
 * the swap is a one-line import change.
 */

export type Question = {
  id: string;
  prompt: string; // "15 − 8"
  answer: string; // "7"  — exact, canonical
  distractors: string[]; // plausible wrong answers, ideally real mal-rule outputs
  domain: string; // "add-sub" | "fractions" | ...
  difficulty: number; // 0..1
};

export type Host = {
  next(): Question; // pull the next question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void;
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
};

export function mountSignature(_el: HTMLElement, _host: Host): { unmount(): void } {
  throw new Error("see ./index.ts — this file only declares the contract");
}
