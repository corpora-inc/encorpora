// What a pulse does to the thing it meets.
//
// Extracted out of the frame loop on purpose: this is the decision the whole
// game turns on, and it should be provable without a canvas. `resolveStrike` is
// a pure function of the beam, the class of automaton and the number on its
// hull, and the tests assert the biconditional it exists to enforce — a kill is
// possible **if and only if** the beam divides the value.

import { A_CANDIDATE, A_CORE } from "./field.ts"
import { resonates } from "./lattice.ts"

export type Strike =
  /** The automaton comes apart. The beam divides it. */
  | "shatter"
  /** A CORE candidate comes apart, and its value is handed in as the answer. */
  | "submit"
  /** The beam does not divide it: it rings and is shoved down the lattice. */
  | "dissonance"
  /** Nothing happens — the pulse rings off armour, or off a body behind one. */
  | "pass"

/**
 * @param isFirst whether this is the first body the pulse met on its way up.
 *   Only the first one rings: a stray shot must not shove a whole column of
 *   automata down the lattice for a single wrong read.
 */
export function resolveStrike(
  beam: number,
  kind: number,
  value: number,
  isFirst: boolean,
): Strike {
  // A CORE is armoured until it fractures. The problem written on it is not the
  // target; the values it throws out are.
  if (kind === A_CORE) return "pass"
  if (resonates(beam, value)) return kind === A_CANDIDATE ? "submit" : "shatter"
  return isFirst ? "dissonance" : "pass"
}

/** Whether a pulse fired up `beam` can kill `value` at all. The rule, restated. */
export function canKill(beam: number, value: number): boolean {
  return resonates(beam, value)
}

/** Ceiling on the shove, so a column of stray shots cannot teleport a hull. */
const MAX_URGENCY = 2.4
const SHOVE = 0.35

/**
 * What a dissonant strike does to how fast a body is walking.
 *
 * On an ORDINARY automaton the cost of a wrong read is time: it is shoved
 * further down the lattice. Nothing is deducted and nothing is scolded, and
 * that is the right cost for a number the game itself made up.
 *
 * On a **CANDIDATE it is nothing at all.** A candidate's fall IS the
 * comprehension window, probing the beams is this game's listening verb, and
 * charging the child's thinking time for using it rations precisely what
 * `docs/EXPERIENCE_DESIGN.md` forbids rationing — by up to 2.4× at that. A
 * candidate rings, and stays exactly where the arithmetic left it.
 */
export function shovedUrgency(kind: number, urgency: number): number {
  if (kind === A_CANDIDATE) return urgency
  return Math.min(MAX_URGENCY, urgency + SHOVE)
}
