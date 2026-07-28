// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountLattice } from "./mount.ts"

export type Question = {
  id: string
  /** "47 + 25" — the operator glyph is already in it. */
  prompt: string
  /** "72" — exact, canonical, and never computed by this game. */
  answer: string
  /**
   * Wrong values a child actually produces: the host's mal-rule outputs first.
   * THE LATTICE seeds the field so that at least one of them is *reachable* —
   * its primes are drifting out there too — so a child who drops a carry can
   * assemble their own mistake and the misconception routes back to the host
   * with no extra wiring.
   */
  distractors: string[]
  domain: string
  /** 0..1. A monotone reading of the ladder, not a claim about hardness. */
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
   * **Never after a failure.** THE LATTICE calls it when a resonator has been
   * opened, never when one has refused — a purchase surface next to a mistake
   * is the thing that is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

/**
 * Mount the game into `el`.
 *
 * `pause`/`resume` are part of the surface because the host can put a sheet
 * over a still-mounted, still-running pack — and this game calls `transition`
 * every time a resonator opens, so it raises that sheet itself. See `mount.ts`.
 */
export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  return mountLattice(el, host)
}
