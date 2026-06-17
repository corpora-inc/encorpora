/**
 * beatlounge — resolve the ACTUAL value range a ParamTarget spans.
 *
 * A modulator stores its center/depth in NORMALIZED 0..1 param space; the engine
 * maps a normalized value into the target's real range before writing it onto
 * the live node via `AudioGraph.applyParam`. This module is the single source of
 * those ranges so the engine and the UI never drift:
 *
 *   • master / track volume / send level / bus volume → {0, 1}
 *   • track pan                                        → {-1, 1}
 *   • insert effect param → look up the effect kind on the track's insert chain,
 *     then read the {min,max} from EFFECT_SPECS (enum/boolean params fall back to
 *     {0,1} since modulation is continuous).
 *   • instrument param → a sensible {0, 1} fallback.
 *
 * Pure + dependency-light (reads EFFECT_SPECS only). Always returns a finite,
 * non-degenerate range (min < max) so the engine's linear map is safe.
 */

import type { BeatloungeDoc, ParamTarget } from "../model/document"
import { EFFECT_SPECS } from "../effects/params"

export interface ParamRange {
  min: number
  max: number
}

const UNIT: ParamRange = { min: 0, max: 1 }
const BIPOLAR: ParamRange = { min: -1, max: 1 }

/** Find a track's insert by id (across all tracks the target names). */
const findInsertKind = (
  doc: BeatloungeDoc,
  trackId: string,
  insertId: string
): { kind: keyof typeof EFFECT_SPECS } | undefined => {
  const track = doc.tracks.find((t) => t.id === trackId)
  if (!track) return undefined
  const fx = track.inserts.find((i) => i.id === insertId)
  return fx ? { kind: fx.kind } : undefined
}

/**
 * The {min,max} the actual node value spans for a ParamTarget. Falls back to a
 * unit range for anything we can't resolve, so modulation always has a range.
 */
export const paramRange = (target: ParamTarget, doc: BeatloungeDoc): ParamRange => {
  switch (target.scope) {
    case "master":
      return UNIT
    case "track":
      return target.param === "pan" ? BIPOLAR : UNIT
    case "send":
      return UNIT
    case "bus":
      return UNIT
    case "instrument":
      return UNIT
    case "insert": {
      const found = findInsertKind(doc, target.trackId, target.insertId)
      if (!found) return UNIT
      const spec = EFFECT_SPECS[found.kind].params.find((p) => p.key === target.param)
      if (!spec || spec.type !== "number") return UNIT
      const min = typeof spec.min === "number" ? spec.min : 0
      const max = typeof spec.max === "number" ? spec.max : 1
      return max > min ? { min, max } : UNIT
    }
    default:
      return UNIT
  }
}
