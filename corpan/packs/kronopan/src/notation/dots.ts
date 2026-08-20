// Dots notation: the two-and-three mode.
//
// Each group is a cluster of circles, one circle per pulse, colored by group
// length exactly as the bars are. Dot size and the spacing within a cluster are
// constant across the whole cycle, so a three-cluster is naturally wider than a
// two-cluster and the long-short proportion holds for free. The gap between
// clusters is larger than the gap within one, which is what makes the grouping
// legible at a glance.
//
// Positions are returned in abstract units (a dot advances the cursor by one
// step, a new cluster adds a larger step). The view scales the whole span to its
// width. Keeping it unitless keeps this layer pure and testable.

import type { Cycle } from "../core"
import { pulseMarks } from "../core"
import { colorRoleForLength, type BarColorRole } from "./bars"

// Step between adjacent dots inside a cluster, and the larger step taken when a
// new cluster begins. The ratio is what separates the clusters visually.
export const WITHIN_STEP = 1
export const CLUSTER_STEP = 2

export type DotMark = {
  pulseIndex: number
  groupIndex: number
  indexInGroup: number
  role: BarColorRole
  isGroupHead: boolean
  isCycleStart: boolean
  pos: number // centre position in abstract units
}

export type DotsModel = {
  dots: DotMark[]
  // The position of the last dot. The view maps [0, span] onto its width. Zero
  // for a single dot or an empty cycle.
  span: number
}

export const dotsModel = (cycle: Cycle): DotsModel => {
  const dots: DotMark[] = []
  let pos = 0
  pulseMarks(cycle).forEach((m, i) => {
    if (i > 0) pos += m.isGroupHead ? CLUSTER_STEP : WITHIN_STEP
    dots.push({
      pulseIndex: m.index,
      groupIndex: m.groupIndex,
      indexInGroup: m.indexInGroup,
      role: colorRoleForLength(cycle.groups[m.groupIndex]),
      isGroupHead: m.isGroupHead,
      isCycleStart: m.isCycleStart,
      pos,
    })
  })
  return { dots, span: pos }
}
