// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountTrueDraw } from "./mount.ts"

export type Question = {
  id: string
  /** "47 + 25" — the operator glyph is already in it. */
  prompt: string
  /** "72" — exact, canonical, and never computed by this game. */
  answer: string
  /**
   * Wrong values a child actually produces. The host puts its mal-rule outputs
   * first, near-misses after. This game turns them into the *plausible*
   * falsehoods a statement can claim, which is the whole reason it is rigorous.
   */
  distractors: string[]
  domain: string
  difficulty: number
}

export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void

  /**
   * The child did not answer this one. Close it and record nothing.
   *
   * **This is the only honest ending for a lapse, and `report` is not it.** The
   * SDK is explicit: `report({ correct: false, answered: "" })` is not filed as
   * "unanswered", it is filed as a MISS — the empty string does not parse, the
   * learner model takes a wrong attempt, and the ladder steps DOWN for a child who
   * was still carrying the hundreds column. This pack was one of the six named as
   * having done exactly that.
   *
   * OPTIONAL and feature-detected only because a pre-#667 host may not have it. The
   * real `GameHost` implements it unconditionally.
   */
  skip?(questionId: string): void

  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void
  prefersReducedMotion(): boolean

  /**
   * A natural stopping point the child *reached*: a level cleared, a run
   * completed, a boss down.
   *
   * OPTIONAL and feature-detected — a stub host does not implement it and the
   * game must not care. Fire and forget: nothing is returned, nothing may be
   * awaited, and the game must not branch on it.
   *
   * **Never after a failure.** A run that ended because the last shot went dark
   * is a failure, so this game never calls it there.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  return mountTrueDraw(el, host)
}
