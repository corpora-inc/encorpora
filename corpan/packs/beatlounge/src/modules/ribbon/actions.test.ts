import { describe, expect, it } from "vitest"
import { clearAction, ribbonActions, ribbonTrackId } from "./actions"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import { withStockRiff } from "../../testing/stockLoop"
import type { ActionContext } from "../../contracts/module"

const ctx = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  doc: createDefaultDoc(0),
  rng: () => 0.5,
  ...overrides,
})

describe("ribbon actions", () => {
  it("exposes a clearRibbon action", () => {
    expect(ribbonActions.map((a) => a.name)).toEqual(["clearRibbon"])
    expect(clearAction.impact).toBe("destructive")
  })

  it("resolves the melodic (non-drum) track by default", () => {
    const c = ctx()
    const id = ribbonTrackId(c)
    const t = c.doc.tracks.find((x) => x.id === id)
    expect(t && isInstrumentTrack(t) && t.instrument.kind).not.toBe("drumSampler")
    expect(t?.name).toBe("Synth")
  })

  it("prefers an explicit target track", () => {
    const c = ctx({ targetTrackId: "trk-explicit" })
    expect(ribbonTrackId(c)).toBe("trk-explicit")
  })

  it("clears a non-empty melodic track", () => {
    const c = ctx({ doc: withStockRiff(createDefaultDoc(0)) })
    const r = clearAction.run(c, {})
    expect(r.commands).toHaveLength(1)
    expect(r.commands[0]).toMatchObject({ t: "clearTrack" })
    expect(r.summary).toMatch(/Cleared \d+ notes/)
  })

  it("is a no-op on an empty track", () => {
    const base = createDefaultDoc(0)
    const synth = base.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
    )!
    const emptied = {
      ...base,
      tracks: base.tracks.map((t) =>
        t.id === synth.id && isInstrumentTrack(t) ? { ...t, notes: [] } : t
      ),
    }
    const r = clearAction.run(ctx({ doc: emptied }), {})
    expect(r.commands).toHaveLength(0)
    expect(r.summary).toBe("Already empty")
  })
})
