// Bars notation: a pure layout model for one cycle.
//
// It is a thin, presentation-oriented read over the core geometry. It adds only
// what bars mode needs on top of groupSpans: a color role per group (by length)
// and the fractional positions of the interior pulse hairlines. It draws
// nothing and knows nothing about pixels or canvases.
//
// The hairlines come straight from the same pulse marks the dots mode will use,
// which is what keeps a dot sitting exactly on a bar hairline across a mode
// switch.

import type { Cycle } from "../core"
import { groupSpans, pulseMarks } from "../core"

export type BarColorRole = "two" | "three" | "many"

export const colorRoleForLength = (length: number): BarColorRole =>
  length === 2 ? "two" : length === 3 ? "three" : "many"

export type BarGroup = {
  index: number
  length: number
  startFraction: number
  widthFraction: number
  role: BarColorRole
}

export type BarsModel = {
  groups: BarGroup[]
  // Fractional positions of the pulse divisions that fall inside a bar. Group
  // heads are bar edges, not hairlines, so they are excluded here.
  hairlines: number[]
}

export const barsModel = (cycle: Cycle): BarsModel => {
  const groups: BarGroup[] = groupSpans(cycle).map((s) => ({
    index: s.index,
    length: s.length,
    startFraction: s.startFraction,
    widthFraction: s.widthFraction,
    role: colorRoleForLength(s.length),
  }))

  const hairlines = pulseMarks(cycle)
    .filter((m) => !m.isGroupHead)
    .map((m) => m.startFraction)

  return { groups, hairlines }
}
