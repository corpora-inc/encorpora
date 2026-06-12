import { describe, expect, it } from "vitest"
import {
  defaultScratchChain,
  chainHasActive,
  toggleInsert,
  setInsertParams,
} from "./scratchFxChain"
import { SCRATCH_FX_KINDS } from "./scratchFxBus"
import { EFFECT_SPECS } from "../../effects/params"

describe("scratchFxChain", () => {
  it("builds the curated rack in stable order, all bypassed, with default params", () => {
    const chain = defaultScratchChain()
    expect(chain.map((n) => n.kind)).toEqual([...SCRATCH_FX_KINDS])
    expect(chain.every((n) => n.enabled === false)).toBe(true)
    // Every insert carries the shared param defaults (no drift with EFFECT_SPECS).
    for (const n of chain) {
      for (const p of EFFECT_SPECS[n.kind].params) {
        expect(n.params[p.key]).toEqual(p.default)
      }
    }
    // Ids are unique.
    expect(new Set(chain.map((n) => n.id)).size).toBe(chain.length)
  })

  it("chainHasActive reflects whether any insert is engaged", () => {
    const chain = defaultScratchChain()
    expect(chainHasActive(chain)).toBe(false)
    expect(chainHasActive(toggleInsert(chain, chain[0].id))).toBe(true)
  })

  it("toggleInsert flips only the targeted insert, immutably", () => {
    const chain = defaultScratchChain()
    const next = toggleInsert(chain, chain[1].id)
    expect(next[1].enabled).toBe(true)
    expect(next[0].enabled).toBe(false)
    expect(next[2].enabled).toBe(false)
    // Original untouched (new objects).
    expect(chain[1].enabled).toBe(false)
    expect(next).not.toBe(chain)
    expect(next[1]).not.toBe(chain[1])
  })

  it("setInsertParams merges params and engages the insert on first touch", () => {
    const chain = defaultScratchChain()
    const filter = chain.find((n) => n.kind === "filter")!
    const next = setInsertParams(chain, filter.id, { frequency: 800 })
    const after = next.find((n) => n.id === filter.id)!
    expect(after.params.frequency).toBe(800)
    expect(after.enabled).toBe(true) // engaged on first touch (DJ-natural)
    // Other params preserved.
    expect(after.params.q).toEqual(filter.params.q)
    // Siblings untouched.
    expect(next.find((n) => n.kind === "reverb")!.enabled).toBe(false)
  })

  it("setInsertParams can edit without engaging when asked", () => {
    const chain = defaultScratchChain()
    const id = chain[0].id
    const next = setInsertParams(chain, id, { frequency: 500 }, false)
    expect(next[0].enabled).toBe(false)
    expect(next[0].params.frequency).toBe(500)
  })

  it("all curated kinds are known effect kinds", () => {
    for (const kind of SCRATCH_FX_KINDS) {
      expect(EFFECT_SPECS[kind]).toBeDefined()
    }
  })
})
