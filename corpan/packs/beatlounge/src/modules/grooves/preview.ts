/**
 * beatlounge — Grooves preview model (pure): collapse a Rhythm into a small,
 * per-lane cell grid for the picker's mini-pattern thumbnail. No audio/React.
 */

import { rhythmCells, type Rhythm } from "../../rhythm"

export interface PreviewCell {
  on: boolean
  accent: boolean
  ghost: boolean
}
export interface PreviewLane {
  role: string
  signature: boolean
  cells: PreviewCell[]
}
export interface RhythmPreview {
  cells: number
  stepsPerBeat: number
  lanes: PreviewLane[]
}

/** Build a per-lane on/accent/ghost grid (lanes capped so the thumb stays calm). */
export const buildPreview = (r: Rhythm, maxLanes = 5): RhythmPreview => {
  const cells = rhythmCells(r)
  const lanes: PreviewLane[] = r.lanes.slice(0, maxLanes).map((lane) => {
    const row: PreviewCell[] = Array.from({ length: cells }, () => ({
      on: false,
      accent: false,
      ghost: false,
    }))
    for (const h of lane.hits) {
      if (h.cell < 0 || h.cell >= cells) continue
      const c = row[h.cell]
      c.on = true
      if (h.accent) c.accent = true
      if (h.ghost) c.ghost = true
    }
    return { role: lane.role, signature: Boolean(lane.signature), cells: row }
  })
  return { cells, stepsPerBeat: r.stepsPerBeat, lanes }
}
