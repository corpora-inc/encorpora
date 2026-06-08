import { describe, expect, it } from "vitest"
import { createMemoryOutbox, type OutboxEnvelope } from "./outbox.js"

const env = (to: string, from: string, ts: number, ttl = 1000): OutboxEnvelope => ({
  to,
  from,
  payload: { text: `${from}->${to}@${ts}` },
  ts,
  expiresAt: ts + ttl,
})

describe("memory outbox", () => {
  it("buffers for an offline recipient and delivers once on drain", () => {
    const ob = createMemoryOutbox()
    ob.enqueue(env("b", "a", 100))
    ob.enqueue(env("b", "a", 200))
    expect(ob.size()).toBe(2)

    const drained = ob.drain("b", 300)
    expect(drained).toHaveLength(2)
    expect(ob.size()).toBe(0) // delete-on-delivery
    expect(ob.drain("b", 400)).toHaveLength(0) // nothing left
  })

  it("drops envelopes past their TTL on drain", () => {
    const ob = createMemoryOutbox()
    ob.enqueue(env("b", "a", 100, 1000)) // expires at 1100
    ob.enqueue(env("b", "a", 5000, 1000)) // expires at 6000
    const drained = ob.drain("b", 2000) // first is stale, second fresh
    expect(drained).toHaveLength(1)
    expect((drained[0].payload as { text: string }).text).toContain("@5000")
  })

  it("sweep drops only expired envelopes", () => {
    const ob = createMemoryOutbox()
    ob.enqueue(env("b", "a", 100, 1000))
    ob.enqueue(env("c", "a", 5000, 1000))
    const dropped = ob.sweep(2000)
    expect(dropped).toBe(1)
    expect(ob.size()).toBe(1)
  })

  it("removeForPair forgets messages between two players (link lapse)", () => {
    const ob = createMemoryOutbox()
    ob.enqueue(env("b", "a", 100))
    ob.enqueue(env("a", "b", 100))
    ob.enqueue(env("b", "c", 100)) // unrelated sender
    ob.removeForPair("a", "b")
    expect(ob.drain("a", 200)).toHaveLength(0)
    expect(ob.drain("b", 200).map((e) => e.from)).toEqual(["c"]) // c→b survives
  })

  it("removeForPlayer forgets everything to or from a player (block)", () => {
    const ob = createMemoryOutbox()
    ob.enqueue(env("b", "a", 100))
    ob.enqueue(env("c", "a", 100))
    ob.enqueue(env("a", "c", 100))
    ob.removeForPlayer("a")
    expect(ob.drain("a", 200)).toHaveLength(0) // nothing addressed to a
    expect(ob.drain("c", 200)).toHaveLength(0) // a's message to c gone
    expect(ob.drain("b", 200)).toHaveLength(0) // a's message to b gone
  })

  it("bounds per-recipient buffer, dropping oldest", () => {
    const ob = createMemoryOutbox({ maxPerRecipient: 3 })
    for (let i = 0; i < 5; i++) ob.enqueue(env("b", "a", i))
    const drained = ob.drain("b", 1000)
    expect(drained).toHaveLength(3)
    expect(drained.map((e) => e.ts)).toEqual([2, 3, 4]) // oldest two dropped
  })
})
