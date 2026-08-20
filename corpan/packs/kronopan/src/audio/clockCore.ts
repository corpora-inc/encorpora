// Pure clock math. No Web Audio, no timers, no side effects.
//
// This is where timing correctness lives, so it is kept pure and tested. The
// backend (internalClock.ts) is a thin shell that feeds this the current audio
// time and plays whatever clicks it plans. Musical time is derived only from the
// audio context clock passed in as `now`; never from Date.now or performance.now.

import type { Unit } from "../core"
import { pulseMarks } from "../core"
import type { Cycle } from "../core"
import type { ClickDensity, ClickRole } from "./clock"

// The transport is described by a single linear map from audio seconds to
// pulses: at time `anchorTime` the position is exactly `anchorPulse`, and it
// advances one pulse every `secondsPerPulse`. Everything else is derived from
// this, which is what makes tempo changes phase-preserving: to change tempo we
// re-pin the anchor at the current position, so the position function stays
// continuous across the change.
export type Anchor = {
  anchorPulse: number
  anchorTime: number
  secondsPerPulse: number
}

// Duration of one pulse (a note of value `unit`) at a quarter-note tempo.
// A quarter lasts 60/bpm seconds; a `unit` note is 4/unit quarters long.
export const secondsPerPulse = (bpm: number, unit: Unit): number =>
  (60 / bpm) * (4 / unit)

// Continuous position in pulses at audio time `now`.
export const positionAt = (a: Anchor, now: number): number =>
  a.anchorPulse + (now - a.anchorTime) / a.secondsPerPulse

// Audio time at which a given (possibly fractional) pulse falls. Inverse of
// positionAt.
export const timeForPulse = (a: Anchor, pulse: number): number =>
  a.anchorTime + (pulse - a.anchorPulse) * a.secondsPerPulse

// Re-pin the anchor for a new pulse duration without moving the current
// position. This is the phase-preserving tempo change: positionAt returns the
// same value immediately before and after.
export const reanchorTempo = (a: Anchor, now: number, newSecondsPerPulse: number): Anchor => ({
  anchorPulse: positionAt(a, now),
  anchorTime: now,
  secondsPerPulse: newSecondsPerPulse,
})

// The integer pulses whose scheduled time falls in [now, now + lookahead),
// starting the search at `fromPulse`. Pulses already in the past are skipped
// without being emitted (so a tempo change cannot spray stale late clicks), and
// `next` is the first pulse past the window, to resume from on the next tick.
export const collectWindow = (
  a: Anchor,
  fromPulse: number,
  now: number,
  lookahead: number,
): { pulses: number[]; next: number } => {
  const pulses: number[] = []
  const end = now + lookahead
  let p = fromPulse
  while (timeForPulse(a, p) < now) p++
  while (timeForPulse(a, p) < end) {
    pulses.push(p)
    p++
  }
  return { pulses, next: p }
}

// Classify every pulse of one cycle into its click role. Index i is the role of
// the pulse at within-cycle index i. The single cycle downbeat is "downbeat",
// the first pulse of every other group is "group-head", the rest are "pulse".
export const rolesForCycle = (cycle: Cycle): ClickRole[] =>
  pulseMarks(cycle).map((m) =>
    m.isCycleStart ? "downbeat" : m.isGroupHead ? "group-head" : "pulse",
  )

// Whether a click of the given role sounds at the given density. Densities nest:
// each level includes everything the lighter levels play.
export const playsAt = (role: ClickRole, density: ClickDensity): boolean => {
  switch (density) {
    case "cycle":
      return role === "downbeat"
    case "group-heads":
      return role === "downbeat" || role === "group-head"
    case "pulse":
    case "subdivision":
      // subdivision adds half-pulse ticks on top of every pulse; those are
      // planned separately in planWindow, not here.
      return role === "downbeat" || role === "group-head" || role === "pulse"
  }
}

export type PlannedClick = { role: ClickRole; time: number }

// Plan the clicks to schedule for the window starting at `fromPulse`. Pure: it
// returns what should sound and when, and the backend hands each to the
// metronome. `total` is the cycle's pulse count; `roles` is rolesForCycle.
export const planWindow = (
  a: Anchor,
  fromPulse: number,
  now: number,
  lookahead: number,
  roles: ClickRole[],
  total: number,
  density: ClickDensity,
): { clicks: PlannedClick[]; next: number } => {
  const clicks: PlannedClick[] = []
  if (total <= 0) return { clicks, next: fromPulse }

  const { pulses, next } = collectWindow(a, fromPulse, now, lookahead)
  for (const p of pulses) {
    const within = ((p % total) + total) % total
    const role = roles[within]
    if (playsAt(role, density)) clicks.push({ role, time: timeForPulse(a, p) })
    if (density === "subdivision") {
      clicks.push({ role: "subdivision", time: timeForPulse(a, p + 0.5) })
    }
  }
  return { clicks, next }
}
