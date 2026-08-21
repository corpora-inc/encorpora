// Proportional geometry for a cycle.
//
// This is the one place the "everything is proportional to duration" invariant
// becomes concrete numbers. Positions are expressed two ways:
//
//   * in pulses, where pulse i starts at time i and spans [i, i + 1), so the
//     whole cycle spans [0, totalPulses)
//   * as a fraction in [0, 1), which is the pulse position divided by
//     totalPulses
//
// A view (linear, column, ring) takes the fraction and multiplies by its own
// extent: width in pixels, height in pixels, or 2*PI radians. The geometry
// itself is dimensionless and knows nothing about the medium.
//
// Bars, dots, and the staff all read the SAME marks from here. That is what
// guarantees a dot sits exactly where the corresponding bar hairline sits: they
// are literally the same number.

import type { Cycle } from "./cycle"
import { totalPulses } from "./cycle"

// One group laid out in the cycle. widthFraction is the group's share of the
// whole cycle and is directly proportional to its pulse count, so a group of 3
// has 1.5 times the widthFraction of a group of 2.
export type GroupSpan = {
  index: number
  length: number
  startPulse: number
  endPulse: number
  startFraction: number
  endFraction: number
  widthFraction: number
}

// One pulse. startFraction is where a bar hairline sits; centerFraction is where
// a dot sits. isGroupHead marks the first pulse of a group; isCycleStart marks
// the single downbeat of the whole cycle.
export type PulseMark = {
  index: number
  groupIndex: number
  indexInGroup: number
  isGroupHead: boolean
  isCycleStart: boolean
  startPulse: number
  centerPulse: number
  startFraction: number
  centerFraction: number
}

// Where the playhead currently is. All fields wrap within one cycle. Returns
// null for a cycle that is not playable (an empty cycle has no pulses to be on).
export type ActivePosition = {
  // Continuous position within one cycle, in pulses, in [0, totalPulses).
  phasePulses: number
  // Same position as a fraction in [0, 1).
  phaseFraction: number
  pulseIndex: number
  groupIndex: number
  indexInGroup: number
  isGroupHead: boolean
  isCycleStart: boolean
}

export const groupSpans = (cycle: Cycle): GroupSpan[] => {
  const total = totalPulses(cycle)
  const spans: GroupSpan[] = []
  let cursor = 0
  cycle.groups.forEach((length, index) => {
    const startPulse = cursor
    const endPulse = cursor + length
    spans.push({
      index,
      length,
      startPulse,
      endPulse,
      // total is 0 only for an empty cycle, which produces no groups, so this
      // division is never reached with total === 0.
      startFraction: startPulse / total,
      endFraction: endPulse / total,
      widthFraction: length / total,
    })
    cursor = endPulse
  })
  return spans
}

export const pulseMarks = (cycle: Cycle): PulseMark[] => {
  const total = totalPulses(cycle)
  const marks: PulseMark[] = []
  let pulseIndex = 0
  cycle.groups.forEach((length, groupIndex) => {
    for (let indexInGroup = 0; indexInGroup < length; indexInGroup++) {
      marks.push({
        index: pulseIndex,
        groupIndex,
        indexInGroup,
        isGroupHead: indexInGroup === 0,
        isCycleStart: pulseIndex === 0,
        startPulse: pulseIndex,
        centerPulse: pulseIndex + 0.5,
        startFraction: pulseIndex / total,
        centerFraction: (pulseIndex + 0.5) / total,
      })
      pulseIndex++
    }
  })
  return marks
}

// Wrap a raw, possibly negative or multi-cycle position into [0, totalPulses).
// The clock reports a continuous float that grows without bound; this folds it
// back onto one cycle for display.
export const wrapPulses = (positionPulses: number, cycle: Cycle): number => {
  const total = totalPulses(cycle)
  if (total <= 0) return 0
  return ((positionPulses % total) + total) % total
}

// Resolve a continuous playhead position (in pulses) to the active pulse and
// group. Returns null for an unplayable (empty) cycle.
export const activeAt = (
  positionPulses: number,
  cycle: Cycle,
): ActivePosition | null => {
  const total = totalPulses(cycle)
  if (total <= 0) return null

  const phasePulses = wrapPulses(positionPulses, cycle)
  // floor gives the pulse we are inside; clamp guards the exact-end edge where
  // floating point could land phasePulses on total.
  const pulseIndex = Math.min(Math.floor(phasePulses), total - 1)

  // Walk the groups to find which one contains this pulse. Cycles are short, so
  // a linear scan is clearer and fast enough.
  let cursor = 0
  let groupIndex = 0
  let indexInGroup = 0
  for (let i = 0; i < cycle.groups.length; i++) {
    const length = cycle.groups[i]
    if (pulseIndex < cursor + length) {
      groupIndex = i
      indexInGroup = pulseIndex - cursor
      break
    }
    cursor += length
  }

  return {
    phasePulses,
    phaseFraction: phasePulses / total,
    pulseIndex,
    groupIndex,
    indexInGroup,
    isGroupHead: indexInGroup === 0,
    isCycleStart: pulseIndex === 0,
  }
}
