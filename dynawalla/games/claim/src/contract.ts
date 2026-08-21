// The game↔host contract.
//
// This file is a placeholder for a shared package that lands later. Keep the
// shape EXACTLY as written so the swap is a one-line import change.

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
}
