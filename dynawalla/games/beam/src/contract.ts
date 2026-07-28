// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountBeam } from "./mount.ts"

export type Question = {
  id: string
  prompt: string
  answer: string
  distractors: string[]
  domain: string
  difficulty: number
}

export type Host = {
  next(opts?: { domain?: string; difficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
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
   * **Never after a failure.** Not a defeat, not a breach, not a wrong answer,
   * not a timer. This is the call the host may put a sheet on top of, and a
   * purchase surface next to a failure is the thing that is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

export type Handle = {
  unmount(): void
  /**
   * The host has put something over the frame, or the app went to the
   * background. **Stop the clock dead.**
   *
   * This is not cosmetic for this game: the answering window *is* the
   * candidates' fall to the floor, so a wave that keeps descending behind a
   * sheet expires against a child who was never shown it — and it is this
   * game's own `transition()` call that most often raises that sheet. While
   * paused nothing advances, nothing is reported, no input is read, and on
   * resume every wall-clock mark is shifted forward by exactly the time the
   * sheet was up, so the latency the host records is the child's and not the
   * sheet's.
   */
  setPaused(paused: boolean): void
}

export function mount(el: HTMLElement, host: Host): Handle {
  return mountBeam(el, host)
}
