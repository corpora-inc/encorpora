// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountCounterweight } from "./mount.ts"

export type Question = {
  id: string
  prompt: string
  answer: string
  distractors: string[]
  domain: string
  difficulty: number
}

export type Host = {
  /**
   * `difficulty` is the rung the yard is asking for and `maxDifficulty` is the
   * ceiling it wants the stream held under. Both on the host's ladder scale,
   * where `1` is the bottom. See `game/ladder.ts` — the game names a rung on
   * every single weight, because a game that names none gets whatever the
   * scheduler had stocked, and on a fresh session that is how a child meets a
   * borrow across a zero on their first round.
   */
  next(opts?: { domain?: string; difficulty?: number; maxDifficulty?: number }): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void

  /**
   * The child did not answer this one. Close it; record nothing.
   *
   * OPTIONAL and feature-detected, like `transition` — a host that predates it
   * simply does not hear about the round, which is strictly better than what
   * this game used to do.
   *
   * **Why it is not a `report`.** `report` forwards `answered` to the host's
   * item ledger, so a whistle filed as `{ correct: false }` is not recorded as
   * "unanswered" — it is a MISS, it takes a wrong attempt against the learner
   * model, and it walks the ladder down. The child who ran out of time while
   * carrying the hundreds column has told us nothing about what they know, and
   * this is the ending that says nothing back.
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
   * **Never after a failure.** Here that means exactly one call site: the Turk
   * going over. Being pinned yourself is not a stopping point, and a purchase
   * surface next to a defeat is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

/**
 * The handle `mount` returns.
 *
 * `pause` and `resume` are not optional decoration. The host can drop a sheet
 * over a still-mounted, still-running pack — a transition surface, a parent
 * gate — and this game's round is a clock with a verdict at the end of it. A
 * window that opened and closed behind a sheet would seat the beam wherever it
 * happened to stand and mark the child wrong for a sum they were never shown.
 */
export type Handle = {
  unmount(): void
  pause(): void
  resume(): void
}

export function mount(el: HTMLElement, host: Host): Handle {
  return mountCounterweight(el, host)
}
