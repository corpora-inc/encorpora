// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountSkyLedger } from "./mount.ts"

export type Question = {
  id: string
  /** "247 + 225" — the operator glyph is already in it. */
  prompt: string
  /** "472" — exact, canonical, and never computed by this game. */
  answer: string
  /**
   * Wrong values a child actually produces: the host's mal-rule outputs first,
   * near-misses after. SKY LEDGER never plants one on the sky — there is
   * nothing anywhere to point at — but it recognises them: a mark that lands on
   * a named slip is a measurement the register has seen before and it costs no
   * sighting, where a wild guess does.
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
   * **Never after a failure.** SKY LEDGER calls it at the end of a *watch the
   * child logged stars in*, and never when the last lamp goes out. The run
   * ending is the closest thing this game has to a loss, and a purchase surface
   * next to a loss is the thing that is forbidden outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

/**
 * Mount the observatory into `el`.
 *
 * `pause`/`resume` are part of the surface because the host can put a sheet
 * over a still-mounted, still-running pack. See `mount.ts` and
 * `src/test/pause.test.ts`.
 */
export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  return mountSkyLedger(el, host)
}
