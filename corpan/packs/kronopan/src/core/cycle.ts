// Pure model for an additive rhythmic cycle.
//
// No DOM, no Web Audio, no React. This layer is the single source of truth for
// what a cycle IS. Everything downstream (geometry, notation, views, audio) is
// a different vocabulary for the same numbers defined here.
//
// The invariant that governs the whole pack: everything is proportional to
// duration. A group of 3 lasts, and therefore occupies, exactly 1.5 times a
// group of 2. Because every pulse has equal duration, "proportional to
// duration" is the same statement as "proportional to pulse count", and the
// geometry layer relies on that equivalence. If any layer ever lays groups out
// as equal-width slots, that is the bug.

export type Unit = 4 | 8 | 16

export type Cycle = {
  id: string
  name: string
  // A sequence of groups. Groups are arbitrary positive integers. Never assume
  // they are only 2 and 3. Never enumerate supported cycle lengths. A cycle of
  // [5, 7, 2] is valid and must render correctly. An empty array is a valid
  // transient state while the user is editing, so it is not an error, but such
  // a cycle is not playable (see isPlayable).
  groups: number[]
  // The notated value of one pulse. Affects staff notation and how a chosen
  // tempo is read, never the proportional geometry.
  unit: Unit
  tradition?: string
  notes?: string
}

// A single group is valid when it is a positive integer. Fractional or
// zero-or-negative group lengths have no meaning in an additive meter.
export const isValidGroup = (n: number): boolean => Number.isInteger(n) && n > 0

export type CycleValidation = {
  // Every present group is a positive integer. An empty cycle is still valid.
  valid: boolean
  // Valid and non-empty, so the clock and views have something to render.
  playable: boolean
  errors: string[]
}

export const validateCycle = (cycle: Cycle): CycleValidation => {
  const errors: string[] = []
  cycle.groups.forEach((g, i) => {
    if (!isValidGroup(g)) {
      errors.push(`group ${i} is not a positive integer: ${String(g)}`)
    }
  })
  const valid = errors.length === 0
  const playable = valid && cycle.groups.length > 0
  return { valid, playable, errors }
}

export const isPlayable = (cycle: Cycle): boolean => validateCycle(cycle).playable

// Total number of pulses in one cycle. This is the cycle's duration measured in
// pulses, and the denominator for every normalized position.
export const totalPulses = (cycle: Cycle): number =>
  cycle.groups.reduce((sum, g) => sum + g, 0)

export const groupCount = (cycle: Cycle): number => cycle.groups.length

// The additive time signature, e.g. "3+2+2". This grouping is the pedagogical
// payload, so it is preferred over the collapsed "7/8" reading.
export const additiveSignature = (cycle: Cycle): string => cycle.groups.join("+")

// The collapsed signature, e.g. "7/8". Useful as a secondary label, never as
// the primary one.
export const collapsedSignature = (cycle: Cycle): string =>
  `${totalPulses(cycle)}/${cycle.unit}`
