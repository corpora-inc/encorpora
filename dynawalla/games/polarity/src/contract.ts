/**
 * The game <-> runtime contract.
 *
 * A shared package will replace this file. Keep the shape EXACTLY as written so
 * the swap is a one-line import change. `mount` here is the *declaration* only —
 * the real implementation is exported from `./index.ts`, and a test asserts the
 * two stay assignable.
 */

export type Question = {
  id: string;
  prompt: string; // "−9 + 4"
  answer: string; // "−5"  — exact, canonical
  distractors: string[]; // plausible wrong answers, ideally real mal-rule outputs
  domain: string; // "int-add" | "int-sub" | ...
  difficulty: number; // 0..1
};

export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question;
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void;
  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
};

export function mount(_el: HTMLElement, _host: Host): { unmount(): void } {
  throw new Error("contract declaration only — the implementation is ./index.ts");
}
