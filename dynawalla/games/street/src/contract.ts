// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountStreet } from "./mount.ts"

export type Question = {
  id: string
  /** "47 + 25" — the operator glyph is already in it. */
  prompt: string
  /** "72" — exact, canonical, and never computed by this game. */
  answer: string
  /**
   * Wrong values a child actually produces: the host's mal-rule outputs first,
   * near-misses after. They go on the rivets, which is why choosing between
   * them is arithmetic rather than elimination.
   */
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
   * **Never after a failure.** This game fires it on a finished block and
   * nowhere else — never on a shove-back, never on a caved rivet. A purchase
   * surface must not sit next to a failure.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  return mountStreet(el, host)
}
