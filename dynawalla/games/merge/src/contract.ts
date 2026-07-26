/**
 * The Dynawalla game <-> host contract.
 *
 * This file is a temporary local copy of the shared contract. Keep it EXACTLY
 * this shape so swapping in the shared package is a one-line import change.
 */

export type Question = {
  id: string;
  /** "15 − 8" */
  prompt: string;
  /** "7" — exact, canonical */
  answer: string;
  /** plausible wrong answers, ideally real mal-rule outputs */
  distractors: string[];
  /** "add-sub" | "fractions" | ... */
  domain: string;
  /** 0..1 */
  difficulty: number;
};

export type Host = {
  /** pull the next question */
  next(): Question;
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void;
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void;
  prefersReducedMotion(): boolean;
};

export function mount(_el: HTMLElement, _host: Host): { unmount(): void } {
  throw new Error("contract stub — import mount from ./mount.ts");
}

/**
 * OPTIONAL host extension, feature-detected — never required.
 *
 * FUSE spawns tiles whose face may be an expression with a specific value, so
 * it wants questions with a chosen answer. A host that can bias its stream
 * implements `focus`; one that cannot simply produces fewer expression tiles.
 * The base `Host` shape above is untouched.
 */
export type FocusableHost = Host & {
  focus?(spec: { key: number; wanted: number[] }): void;
};
