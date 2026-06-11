import { describe, expect, it } from "vitest"
import { createLoadToken } from "./loadToken"

describe("createLoadToken — async snippet load gate", () => {
  it("the freshest load is current; older loads are stale", () => {
    const t = createLoadToken()
    const first = t.open()
    expect(t.isCurrent(first)).toBe(true)
    const second = t.open()
    expect(t.isCurrent(first)).toBe(false) // superseded
    expect(t.isCurrent(second)).toBe(true)
  })

  it("discards a stale load that resolves AFTER a newer selection (first-load race)", () => {
    const t = createLoadToken()
    // Selection A starts loading.
    const a = t.open()
    // Before A's async decode lands, selection B is chosen.
    const b = t.open()
    // A's decode resolves now — it must NOT win.
    expect(t.isCurrent(a)).toBe(false)
    // B's decode resolves — it wins (current selection always wins).
    expect(t.isCurrent(b)).toBe(true)
  })

  it("invalidate() drops the in-flight load without opening a new one (unmount)", () => {
    const t = createLoadToken()
    const a = t.open()
    t.invalidate()
    expect(t.isCurrent(a)).toBe(false)
  })

  it("a re-run for the SAME selection still wins (latest token is current)", () => {
    const t = createLoadToken()
    t.open() // initial mount load (stale after re-run)
    const rerun = t.open()
    expect(t.isCurrent(rerun)).toBe(true)
  })
})
