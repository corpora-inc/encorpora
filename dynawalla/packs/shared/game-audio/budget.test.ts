import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { VoiceBudget } from "./budget.ts"
import { FREE_VOICES, MAX_VOICES } from "./ceiling.ts"

describe("VoiceBudget", () => {
  it("gives the first voices away untouched", () => {
    const b = new VoiceBudget()
    for (let i = 0; i < FREE_VOICES; i++) assert.equal(b.take(0.2, 0), 1)
  })

  it("attenuates once the bus is busy", () => {
    const b = new VoiceBudget()
    let last = 1
    for (let i = 0; i < MAX_VOICES; i++) {
      const g = b.take(0.2, 0)
      assert.ok(g > 0, `voice ${i} was refused early`)
      assert.ok(g <= last)
      last = g
    }
  })

  it("refuses outright when the budget is spent", () => {
    const b = new VoiceBudget(6)
    for (let i = 0; i < 6; i++) assert.ok(b.take(0.2, 0) > 0)
    assert.equal(b.take(0.2, 0), 0)
    assert.equal(b.take(0.2, 0), 0)
  })

  it("bounds the summed amplitude of a stampede", () => {
    // MOSAIC fired glass() once per shattered tile with no effective cap; a
    // laser sweep put six four-voice cues on the bus in one frame, and the
    // rendered peak was 13.955 — fourteen times full scale.
    //
    // The budget's job is not to make a crowd sound like one voice. It is to
    // make the total FINITE, so the limiter and the ceiling downstream have
    // something bounded to work on. A full budget totals ~9.65x one voice
    // however many hits are asked for, which is the sum of voiceScale(1..MAX).
    const b = new VoiceBudget()
    let sum = 0
    for (let i = 0; i < 500; i++) sum += b.take(0.3, 0)
    assert.ok(sum < 10, `500 simultaneous requests summed to ${sum}`)
    assert.ok(sum > 5, `500 simultaneous requests summed to ${sum} — that is not a crowd`)
  })

  it("gives voices back when they have decayed", () => {
    const b = new VoiceBudget(4)
    for (let i = 0; i < 4; i++) b.take(0.2, 0)
    assert.equal(b.take(0.2, 0.1), 0)
    assert.equal(b.live(0.1), 4)
    assert.equal(b.live(0.3), 0)
    assert.equal(b.take(0.2, 0.3), 1)
  })

  it("uses only the clock it is handed — no timers, no Date.now", () => {
    const b = new VoiceBudget(2)
    b.take(1, 1000)
    b.take(1, 1000)
    assert.equal(b.take(1, 1000), 0)
    // A clock that never advances in real time still frees the voices.
    assert.equal(b.take(1, 1002), 1)
  })

  it("clears", () => {
    const b = new VoiceBudget(2)
    b.take(5, 0)
    b.take(5, 0)
    assert.equal(b.take(5, 0), 0)
    b.clear()
    assert.equal(b.take(5, 0), 1)
  })

  it("survives a zero or negative duration", () => {
    const b = new VoiceBudget(2)
    assert.equal(b.take(0, 0), 1)
    assert.equal(b.take(-5, 0), 1)
    assert.equal(b.live(0.0001), 0)
  })
})
