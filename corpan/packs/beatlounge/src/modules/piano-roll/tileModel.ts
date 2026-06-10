/**
 * beatlounge — the piano-roll TILE model: plot the melodic track as a note
 * cloud. Each note becomes a normalized dot: x = step / steps (position in the
 * loop), y = (pitch - lo) / range (vertical position within the used range).
 * Pure, so the tile's layout is unit-testable.
 */

import type { BeatloungeDoc, InstrumentTrack } from "../../model/document"
import { stepForTick, stepsInLoop } from "../../model/timing"

export interface CloudDot {
  /** 0..1 across the loop. */
  x: number
  /** 0..1 within the used pitch range (0 = lowest note). */
  y: number
  velocity: number
  /** The step index this dot sits on (for playhead match). */
  active: number
}

export interface CloudView {
  steps: number
  dots: CloudDot[]
}

export const buildCloud = (doc: BeatloungeDoc, track: InstrumentTrack): CloudView => {
  const steps = Math.max(1, stepsInLoop(doc.loopLengthTicks, track.grid))
  if (track.notes.length === 0) return { steps, dots: [] }

  let lo = Infinity
  let hi = -Infinity
  for (const n of track.notes) {
    if (n.pitch < lo) lo = n.pitch
    if (n.pitch > hi) hi = n.pitch
  }
  const range = Math.max(1, hi - lo)

  const dots: CloudDot[] = track.notes.map((n) => {
    const step = stepForTick(n.tick, track.grid)
    return {
      x: Math.max(0, Math.min(1, step / steps)),
      y: (n.pitch - lo) / range,
      velocity: n.velocity,
      active: step,
    }
  })

  return { steps, dots }
}
