/**
 * beatlounge — paramRange tests: scopes resolve to the right actual range,
 * insert params read EFFECT_SPECS, and unknowns degrade to a safe unit range.
 */

import { describe, expect, it } from "vitest"
import { paramRange } from "./ranges"
import { createDefaultDoc } from "../model/document"
import { newId } from "../model/ids"
import type { BeatloungeDoc, EffectNode } from "../model/document"

const withInsert = (doc: BeatloungeDoc, fx: EffectNode): BeatloungeDoc => {
  const t0 = doc.tracks[0]
  return {
    ...doc,
    tracks: [{ ...t0, inserts: [...t0.inserts, fx] }, ...doc.tracks.slice(1)],
  }
}

describe("paramRange", () => {
  const doc = createDefaultDoc(0)
  const trackId = doc.tracks[0].id

  it("master volume → {0,1}", () => {
    expect(paramRange({ scope: "master", param: "volume" }, doc)).toEqual({ min: 0, max: 1 })
  })

  it("track volume → {0,1}, pan → {-1,1}", () => {
    expect(paramRange({ scope: "track", trackId, param: "volume" }, doc)).toEqual({ min: 0, max: 1 })
    expect(paramRange({ scope: "track", trackId, param: "pan" }, doc)).toEqual({ min: -1, max: 1 })
  })

  it("send / bus / instrument → {0,1}", () => {
    expect(paramRange({ scope: "send", trackId, sendId: "x", param: "level" }, doc)).toEqual({ min: 0, max: 1 })
    expect(paramRange({ scope: "bus", busId: "b", param: "volume" }, doc)).toEqual({ min: 0, max: 1 })
    expect(paramRange({ scope: "instrument", trackId, param: "cutoff" }, doc)).toEqual({ min: 0, max: 1 })
  })

  it("insert param reads EFFECT_SPECS for the resolved kind", () => {
    const fx: EffectNode = { id: newId("fx"), kind: "filter", enabled: true, params: {} }
    const d = withInsert(doc, fx)
    // filter "frequency" spec is 20..18000.
    expect(paramRange({ scope: "insert", trackId, insertId: fx.id, param: "frequency" }, d)).toEqual({
      min: 20,
      max: 18000,
    })
    // distortion "distortion" is 0..1.
    const dist: EffectNode = { id: newId("fx"), kind: "distortion", enabled: true, params: {} }
    const d2 = withInsert(doc, dist)
    expect(paramRange({ scope: "insert", trackId, insertId: dist.id, param: "distortion" }, d2)).toEqual({
      min: 0,
      max: 1,
    })
  })

  it("unknown insert / enum param falls back to {0,1}", () => {
    expect(paramRange({ scope: "insert", trackId, insertId: "nope", param: "x" }, doc)).toEqual({ min: 0, max: 1 })
    const fx: EffectNode = { id: newId("fx"), kind: "filter", enabled: true, params: {} }
    const d = withInsert(doc, fx)
    // "type" is an enum → unit fallback.
    expect(paramRange({ scope: "insert", trackId, insertId: fx.id, param: "type" }, d)).toEqual({ min: 0, max: 1 })
  })
})
