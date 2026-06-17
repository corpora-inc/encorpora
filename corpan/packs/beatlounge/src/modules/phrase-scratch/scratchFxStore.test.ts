import { describe, it, expect, beforeEach } from "vitest"
import type { EffectNode } from "../../model/document"
import { defaultEffectParams } from "../../effects/params"
import {
  loadScratchChain,
  saveScratchChain,
  __resetScratchFxForTest,
} from "./scratchFxStore"

describe("scratchFxStore", () => {
  beforeEach(() => __resetScratchFxForTest())

  it("returns [] when nothing is persisted", () => {
    expect(loadScratchChain()).toEqual([])
  })

  it("round-trips a chain through save → load", () => {
    const chain: EffectNode[] = [
      { id: "scrfx-1", kind: "delay", enabled: true, params: defaultEffectParams("delay") },
      { id: "scrfx-2", kind: "reverb", enabled: false, params: defaultEffectParams("reverb") },
    ]
    saveScratchChain(chain)
    const back = loadScratchChain()
    expect(back).toHaveLength(2)
    expect(back[0].kind).toBe("delay")
    expect(back[0].enabled).toBe(true)
    expect(back[1].kind).toBe("reverb")
    expect(back[1].enabled).toBe(false)
  })

  it("drops inserts with an unknown kind", () => {
    saveScratchChain([
      { id: "a", kind: "delay", enabled: true, params: {} },
      // a kind that no longer exists
      { id: "b", kind: "wormhole" as EffectNode["kind"], enabled: true, params: {} },
    ])
    const back = loadScratchChain()
    expect(back).toHaveLength(1)
    expect(back[0].kind).toBe("delay")
  })

  it("merges persisted params over the current spec defaults", () => {
    // A persisted insert missing a param the spec now has → filled from defaults.
    saveScratchChain([{ id: "a", kind: "filter", enabled: true, params: {} }])
    const back = loadScratchChain()
    expect(back[0].params).toMatchObject(defaultEffectParams("filter"))
  })

  it("survives malformed JSON without throwing", () => {
    localStorage.setItem("beatlounge:scratchFx", "{not json")
    expect(loadScratchChain()).toEqual([])
  })
})
