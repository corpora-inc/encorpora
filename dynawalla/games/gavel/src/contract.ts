// The host↔game contract. This is the shape the runtime lands underneath us;
// it must not drift. Nothing else in this package may redefine these types.
//
// `mount` delegates to `./mount.ts`. That module imports `Host` from here
// type-only, and a type-only import is erased, so there is no runtime cycle.

import { mountGavel } from "./mount.ts"

export type Question = {
  id: string
  /** "12 + 5" — the operator glyph is already in it. */
  prompt: string
  /** "17" — exact, canonical, and never computed by this game. */
  answer: string
  /**
   * Wrong values a child actually produces: the host's mal-rule outputs first,
   * near-misses after.
   *
   * THE GAVEL does not draw them. Every tablet in the room is a real question
   * with a real answer, because the thing being asked is *which of these is
   * biggest* — and a board with a fake number on it would have a biggest that
   * is not the biggest. They are on the type because the wire carries them.
   */
  distractors: string[]
  domain: string
  /** 0..1. A monotone reading of the ladder, not a claim about hardness. */
  difficulty: number
}

/** What a game asks the host for. Both scales documented in `game-host`. */
export type Ask = {
  domain?: string
  /** 1..10 is the unambiguous ladder scale; see `ladderScale` in `game/ladder.ts`. */
  difficulty?: number
  maxDifficulty?: number
}

export type Host = {
  next(opts?: Ask): Question

  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void

  /**
   * This question was never answered. Close it and record nothing.
   *
   * **Not optional for this game, and not a nicety.** A round of THE GAVEL puts
   * three to five questions in front of the child and the child answers exactly
   * one of them — the tablet they marked. The others were read and compared and
   * then left, which is neither a right answer nor a wrong one, and reporting
   * `{ correct: false, answered: "" }` for them would file four misses per
   * round: the empty string does not parse, the learner model takes a wrong
   * attempt, and the ladder steps down under a child who was doing fine.
   *
   * Feature-detected only because a stub host older than `items.skip` should
   * still run the dev harness. Inside the app it is always there.
   */
  skip?(questionId: string): void

  /** Throw away prefetched questions that no longer match what was asked for. */
  flush?(): void

  haptic(k: "light" | "medium" | "heavy" | "success" | "failure"): void

  prefersReducedMotion(): boolean

  /**
   * A natural stopping point the child *reached*: a consignment sold out.
   *
   * OPTIONAL and feature-detected. Fire and forget: nothing is returned,
   * nothing may be awaited, and the game must not branch on it.
   *
   * **Never after a failure.** THE GAVEL calls it when a consignment has been
   * cleared with at least one lot sold — never on a lot that got away. A
   * purchase surface next to a shortfall is the thing that is forbidden
   * outright.
   */
  transition?(kind: "level" | "run" | "boss", label?: string): void
}

/**
 * Mount the game into `el`.
 *
 * `pause`/`resume` are part of the surface because the host can put a sheet
 * over a still-mounted, still-running pack. See `mount.ts`.
 */
export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; pause(): void; resume(): void } {
  return mountGavel(el, host)
}
