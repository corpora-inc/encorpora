// The host contract. A shared package will replace this file verbatim — keep
// the shape EXACTLY as written so the swap is a one-line import change.

export type Question = {
  id: string
  prompt: string // "15 − 8"
  answer: string // "7"  — exact, canonical
  distractors: string[] // plausible wrong answers, ideally real mal-rule outputs
  domain: string // "add-sub" | "fractions" | ...
  difficulty: number // 0..1
}

export type Host = {
  next(): Question // pull the next question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(kind: "light" | "medium" | "heavy" | "success" | "failure"): void
  prefersReducedMotion(): boolean

  /**
   * A natural stopping point the child *reached*: a level cleared, a run
   * completed, a boss down.
   *
   * OPTIONAL and feature-detected — a stub host does not implement it and the
   * game must not care. Fire and forget: nothing is returned, nothing may be
   * awaited, and the game must not branch on it.
   *
   * **Never after a failure.** Not a defeat, not a breach, not a wrong answer,
   * not a timer. This is the call the host may put a sheet on top of, and a
   * purchase surface next to a failure is the thing that is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

export type Mounted = { unmount(): void }
