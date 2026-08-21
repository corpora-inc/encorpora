/**
 * The host contract.
 *
 * This is a verbatim local copy of the shape a shared `@dynawalla/game-contract`
 * package will provide. Keep it EXACTLY this shape so the swap is a one-line
 * import change. Nothing in this file may grow a Serpent-specific field.
 */

export type Question = {
  id: string;
  /** "15 − 8" — the condition, rendered huge on the arena floor. */
  prompt: string;
  /** "7" — exact, canonical. The value of one orb that satisfies `prompt`. */
  answer: string;
  /** Plausible wrong answers, ideally real mal-rule outputs. */
  distractors: string[];
  /** "add-sub" | "mult-div" | "multiples" | "fractions" | ... */
  domain: string;
  /** 0..1 */
  difficulty: number;
};

export type Report = {
  questionId: string;
  correct: boolean;
  ms: number;
  answered: string;
};

export type Host = {
  /** Pull the next question. */
  next(): Question;
  report(r: Report): void;
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
};

export type Mounted = { unmount(): void };

export type MountFn = (el: HTMLElement, host: Host) => Mounted;
