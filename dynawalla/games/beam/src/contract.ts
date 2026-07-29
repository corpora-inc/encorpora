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
  /**
   * An attempt the child made. **Only ever an attempt.**
   *
   * `report` is not a place to say "nothing happened". The shared adapter
   * discards `correct` — the host judges, not the game — and forwards
   * `answered` as the response to `items.answer`, so a report with an empty
   * answer is not recorded as "unanswered", it is recorded as a MISS: the
   * empty string does not parse, the learner model takes a wrong answer, and
   * the ladder steps down. Against a child who may simply have still been
   * carrying the hundreds column.
   *
   * So this game reports exactly one thing: a value that was struck.
   */
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void
  prefersReducedMotion(): boolean

  /**
   * The item ran out of time on the lattice and nothing was handed in.
   *
   * OPTIONAL and feature-detected, exactly like `transition`. The SDK has the
   * method this is for — `items.skip` marks an item closed **without recording
   * an outcome and without moving the ladder**, which is the only honest thing
   * to say about a child who was still computing — but the shared
   * `game-host` adapter does not surface it yet. Until it does, a timeout here
   * is reported as *nothing at all*, which is the safe direction: an unmeasured
   * item costs a child nothing, and a fabricated miss costs them a rung.
   *
   * Never a judgement, never a latency worth modelling: the child did not
   * answer, so there is no answer time to record.
   */
  skip?(questionId: string): void

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
