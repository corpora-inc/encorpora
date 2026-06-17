/**
 * beatlounge — a human label for a ParamTarget (e.g. "Synth · Filter Freq",
 * "Master Vol", "Drums Pan"). Pure; resolves track/effect names from the doc so
 * the Tweakers list reads naturally. Falls back gracefully for stale ids.
 */

import type { BeatloungeDoc, ParamTarget } from "../../model/document"
import { EFFECT_SPECS } from "../../effects/params"

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s)

const trackName = (doc: BeatloungeDoc, trackId: string): string =>
  doc.tracks.find((t) => t.id === trackId)?.name ?? "Track"

export const targetLabel = (target: ParamTarget, doc: BeatloungeDoc): string => {
  switch (target.scope) {
    case "master":
      return "Master Vol"
    case "track":
      return `${trackName(doc, target.trackId)} ${target.param === "pan" ? "Pan" : "Vol"}`
    case "send":
      return `${trackName(doc, target.trackId)} Send`
    case "bus": {
      const bus = doc.buses.find((b) => b.id === target.busId)
      return `${bus?.name ?? "Bus"} ${cap(target.param)}`
    }
    case "instrument":
      return `${trackName(doc, target.trackId)} ${cap(target.param)}`
    case "insert": {
      const track = doc.tracks.find((t) => t.id === target.trackId)
      const fx = track?.inserts.find((i) => i.id === target.insertId)
      const effectLabel = fx ? EFFECT_SPECS[fx.kind].label : "FX"
      const paramSpec = fx
        ? EFFECT_SPECS[fx.kind].params.find((p) => p.key === target.param)
        : undefined
      const paramLabel = paramSpec?.label ?? cap(target.param)
      return `${track?.name ?? "Track"} · ${effectLabel} ${paramLabel}`
    }
    default:
      return "Param"
  }
}
