/**
 * The host contract. A shared package will replace this file later; keep the shape
 * EXACTLY as written so the swap is a one-line import change.
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
  /**
   * A natural stopping point the child REACHED — never one that beat them.
   *
   * PULSE sends `"level"` when a stage is climbed. The host counts these for
   * the day pass, and — since `SOUNDSCAPE_DESIGN_2026-07.md`'s rotation policy
   * — treats one as a licence to change the app's key, because it is the one
   * moment a game itself marks as "put that down". Nothing else in this file
   * may send it: stepping a stage BACK is a failure and a failure is never a
   * transition.
   *
   * Optional so the dev harness, which has no host, is not obliged to have one.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void;
};

export type Mounted = { unmount(): void };
