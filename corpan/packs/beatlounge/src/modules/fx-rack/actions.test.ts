import { describe, expect, it } from "vitest"
import type { ActionContext } from "../../contracts/module"
import { createDefaultDoc } from "../../model/document"
import { EFFECT_SPECS } from "../../effects/params"
import { addInsertAction, clearInsertsAction } from "./actions"

const ctx = (over: Partial<ActionContext> = {}): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: () => 0.5,
  ...over,
})

describe("fx-rack addInsert", () => {
  it("appends an effect of the requested kind to the bound track", () => {
    const c = ctx()
    const trackId = c.doc.tracks[0].id
    const r = addInsertAction.run({ ...c, targetTrackId: trackId }, { kind: "delay" })
    expect(r.commands).toHaveLength(1)
    const cmd = r.commands[0]
    expect(cmd.t).toBe("addInsert")
    if (cmd.t === "addInsert") {
      expect(cmd.trackId).toBe(trackId)
      expect(cmd.effect.kind).toBe("delay")
      expect(cmd.effect.enabled).toBe(true)
      // seeded with the full default param bag
      expect(Object.keys(cmd.effect.params).sort()).toEqual(
        EFFECT_SPECS.delay.params.map((p) => p.key).sort()
      )
    }
    expect(r.summary).toContain(EFFECT_SPECS.delay.label)
  })

  it("falls back to filter for an unknown kind", () => {
    const c = ctx()
    const r = addInsertAction.run(c, { kind: "wobble" })
    const cmd = r.commands[0]
    if (cmd.t === "addInsert") expect(cmd.effect.kind).toBe("filter")
  })

  it("targets the first track when none is bound", () => {
    const c = ctx()
    const r = addInsertAction.run(c, {})
    const cmd = r.commands[0]
    if (cmd.t === "addInsert") expect(cmd.trackId).toBe(c.doc.tracks[0].id)
  })
})

describe("fx-rack clearInserts", () => {
  it("emits a removeInsert per existing insert, wrapped in one batch", () => {
    const c = ctx()
    const trackId = c.doc.tracks[0].id
    c.doc.tracks[0].inserts = [
      { id: "x1", kind: "filter", enabled: true, params: {} },
      { id: "x2", kind: "delay", enabled: true, params: {} },
    ]
    const r = clearInsertsAction.run({ ...c, targetTrackId: trackId }, {})
    expect(r.commands).toHaveLength(1)
    const batch = r.commands[0]
    expect(batch.t).toBe("batch")
    if (batch.t === "batch") {
      expect(batch.commands).toHaveLength(2)
      expect(batch.commands.every((cm) => cm.t === "removeInsert")).toBe(true)
    }
    expect(r.summary).toContain("2")
  })

  it("is a no-op when the track has no inserts", () => {
    const c = ctx()
    const r = clearInsertsAction.run({ ...c, targetTrackId: c.doc.tracks[0].id }, {})
    expect(r.commands).toHaveLength(0)
  })
})
