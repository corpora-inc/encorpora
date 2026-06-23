import { describe, expect, it } from "vitest"
import {
  emptyScratchChain,
  chainHasActive,
  addInsert,
  removeInsert,
  moveInsert,
  toggleInsert,
  setInsertParams,
} from "./scratchFxLive"
import { EFFECT_SPECS } from "../../effects/params"

describe("scratchFxLive", () => {
  it("starts empty", () => {
    expect(emptyScratchChain()).toEqual([])
    expect(chainHasActive([])).toBe(false)
  })

  it("addInsert appends a fresh, ENABLED insert with shared default params", () => {
    const a = addInsert(emptyScratchChain(), "delay")
    expect(a).toHaveLength(1)
    expect(a[0].kind).toBe("delay")
    expect(a[0].enabled).toBe(true) // DJ-natural: added effect is live
    for (const p of EFFECT_SPECS.delay.params) {
      expect(a[0].params[p.key]).toEqual(p.default)
    }
    // Immutable + unique ids over multiple adds.
    const b = addInsert(a, "filter")
    expect(b).toHaveLength(2)
    expect(a).toHaveLength(1)
    expect(new Set(b.map((n) => n.id)).size).toBe(2)
  })

  it("chainHasActive reflects engagement", () => {
    const chain = addInsert(emptyScratchChain(), "reverb")
    expect(chainHasActive(chain)).toBe(true)
    expect(chainHasActive(toggleInsert(chain, chain[0].id))).toBe(false)
  })

  it("removeInsert drops only the target, immutably", () => {
    let chain = addInsert(emptyScratchChain(), "filter")
    chain = addInsert(chain, "delay")
    const id = chain[0].id
    const next = removeInsert(chain, id)
    expect(next).toHaveLength(1)
    expect(next[0].kind).toBe("delay")
    expect(chain).toHaveLength(2) // original untouched
  })

  it("moveInsert reorders within bounds and is a no-op at the ends", () => {
    let chain = addInsert(emptyScratchChain(), "filter")
    chain = addInsert(chain, "delay")
    chain = addInsert(chain, "reverb")
    const [f, d, r] = chain.map((n) => n.id)
    // move delay up → [delay, filter, reverb]
    expect(moveInsert(chain, d, -1).map((n) => n.id)).toEqual([d, f, r])
    // move reverb down at the end → unchanged order
    expect(moveInsert(chain, r, 1).map((n) => n.id)).toEqual([f, d, r])
    // move filter up at the top → unchanged order
    expect(moveInsert(chain, f, -1).map((n) => n.id)).toEqual([f, d, r])
    // original array untouched
    expect(chain.map((n) => n.id)).toEqual([f, d, r])
  })

  it("toggleInsert flips only the target, immutably", () => {
    let chain = addInsert(emptyScratchChain(), "filter")
    chain = addInsert(chain, "delay")
    const next = toggleInsert(chain, chain[1].id)
    expect(next[1].enabled).toBe(false)
    expect(next[0].enabled).toBe(true)
    expect(chain[1].enabled).toBe(true) // original untouched
  })

  it("setInsertParams merges params WITHOUT force-engaging", () => {
    // Build a bypassed insert explicitly.
    let c = addInsert(emptyScratchChain(), "filter")
    c = toggleInsert(c, c[0].id) // now bypassed
    const id = c[0].id
    const next = setInsertParams(c, id, { frequency: 800 })
    expect(next[0].params.frequency).toBe(800)
    expect(next[0].enabled).toBe(false) // not force-engaged
    expect(next[0].params.q).toEqual(c[0].params.q) // siblings preserved
  })
})
