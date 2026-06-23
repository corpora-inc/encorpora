import { describe, expect, it } from "vitest"
import type { EffectNode } from "../model/document"
import { chainSig, chainStructureChanged } from "./chainSig"

const fx = (id: string, kind: EffectNode["kind"]): EffectNode => ({
  id,
  kind,
  enabled: true,
  params: {},
})

describe("chainSig — the rebuild-vs-update decision", () => {
  it("ignores params/enabled (those are an update, not a rebuild)", () => {
    const a = [{ ...fx("a", "filter"), params: { frequency: 200 }, enabled: true }]
    const b = [{ ...fx("a", "filter"), params: { frequency: 9000 }, enabled: false }]
    expect(chainSig(a)).toBe(chainSig(b))
    expect(chainStructureChanged(a, b)).toBe(false)
  })

  it("flags an added insert as a structure change", () => {
    const a = [fx("a", "filter")]
    const b = [fx("a", "filter"), fx("b", "delay")]
    expect(chainStructureChanged(a, b)).toBe(true)
  })

  it("flags a removed insert as a structure change", () => {
    const a = [fx("a", "filter"), fx("b", "delay")]
    const b = [fx("a", "filter")]
    expect(chainStructureChanged(a, b)).toBe(true)
  })

  it("flags a reorder as a structure change", () => {
    const a = [fx("a", "filter"), fx("b", "delay")]
    const b = [fx("b", "delay"), fx("a", "filter")]
    expect(chainStructureChanged(a, b)).toBe(true)
  })

  it("flags a kind swap at the same id as a structure change", () => {
    const a = [fx("a", "filter")]
    const b = [fx("a", "reverb")]
    expect(chainStructureChanged(a, b)).toBe(true)
  })

  it("treats undefined like an empty chain", () => {
    expect(chainStructureChanged(undefined, [])).toBe(false)
    expect(chainStructureChanged(undefined, [fx("a", "gain")])).toBe(true)
  })
})
