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
