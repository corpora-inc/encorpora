import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CEILING,
  FREE_VOICES,
  KNEE,
  MIN_ATTACK,
  dbfs,
  safeAttack,
  shape,
  shaperCurve,
  voiceScale,
} from "./ceiling.ts"

describe("safeAttack", () => {
  it("refuses the brick-wall transients the games were writing", () => {
    // MOSAIC's glass transient, verbatim.
    assert.equal(safeAttack(0.002), MIN_ATTACK)
    assert.equal(safeAttack(0.001), MIN_ATTACK)
    assert.equal(safeAttack(0), MIN_ATTACK)
  })

  it("leaves a slow attack alone", () => {
    assert.equal(safeAttack(0.15), 0.15)
    assert.equal(safeAttack(MIN_ATTACK), MIN_ATTACK)
  })

  it("survives NaN rather than producing a NaN envelope", () => {
    assert.equal(safeAttack(Number.NaN), MIN_ATTACK)
    assert.equal(safeAttack(Number.POSITIVE_INFINITY), MIN_ATTACK)
  })

  it("is short enough to still be an impact", () => {
    // Onset order is resolvable at roughly 10 ms; a floor above that would
    // start to sound like a fade, which is the failure mode we are NOT
    // allowed to ship. This asserts the fix stayed juicy.
    assert.ok(MIN_ATTACK < 0.01, `MIN_ATTACK ${MIN_ATTACK} would be audible as a fade`)
  })
})

describe("shape — the output ceiling", () => {
  it("is exactly transparent below the knee", () => {
    for (const x of [0, 0.01, 0.1, 0.25, 0.4, KNEE]) {
      assert.equal(shape(x), x)
      assert.equal(shape(-x), -x)
    }
  })

  it("never exceeds the ceiling, for any input at all", () => {
    // The MOSAIC numbers, and then some absurd ones.
    for (const x of [0.9, 1, 1.5, 2.344, 6, 13.955, 100, 1e6, Number.MAX_SAFE_INTEGER]) {
      assert.ok(
        Math.abs(shape(x)) <= CEILING + 1e-9,
        `shape(${x}) = ${shape(x)} exceeds ceiling ${CEILING}`,
      )
      assert.ok(Math.abs(shape(-x)) <= CEILING + 1e-9)
    }
  })

  it("is odd-symmetric, so saturation adds no DC offset", () => {
    for (const x of [0.2, 0.7, 1.4, 9]) assert.ok(Math.abs(shape(x) + shape(-x)) < 1e-12)
  })

  it("has a continuous slope at the knee — a corner would be its own distortion", () => {
    const h = 1e-6
    const below = (shape(KNEE) - shape(KNEE - h)) / h
    const above = (shape(KNEE + h) - shape(KNEE)) / h
    assert.ok(Math.abs(below - 1) < 1e-3, `slope below knee ${below}`)
    assert.ok(Math.abs(above - 1) < 1e-3, `slope above knee ${above}`)
  })

  it("is monotonic, so louder input is never quieter output", () => {
    let prev = shape(-2)
    for (let x = -2; x <= 2; x += 0.001) {
      const y = shape(x)
      assert.ok(y >= prev - 1e-12, `not monotonic at x=${x}`)
      prev = y
    }
  })
})

describe("shaperCurve", () => {
  it("ends at the ceiling — which is where the guarantee actually lives", () => {
    // Web Audio: an input outside [-1, 1] uses the nearest curve value. So the
    // last entry IS the maximum sample the node can ever emit.
    const c = shaperCurve(2048)
    assert.ok(Math.abs(c[c.length - 1]! - CEILING) < 1e-6, `last = ${c[c.length - 1]}`)
    assert.ok(Math.abs(c[0]! + CEILING) < 1e-6, `first = ${c[0]}`)
  })

  it("holds no sample above the ceiling anywhere in the table", () => {
    const c = shaperCurve(2048)
    for (let i = 0; i < c.length; i++) {
      assert.ok(Math.abs(c[i]!) <= CEILING + 1e-9, `curve[${i}] = ${c[i]}`)
    }
  })

  it("honours a custom ceiling", () => {
    const c = shaperCurve(512, 0.5, 0.25)
    assert.ok(Math.abs(c[c.length - 1]! - 0.5) < 1e-6)
  })
})

describe("voiceScale — N hits must not sum to N times one hit", () => {
  it("does not touch an ordinary layered cue", () => {
    // transient + body + tail is three voices and must sound as authored.
    for (let n = 1; n <= FREE_VOICES; n++) assert.equal(voiceScale(n), 1)
  })

  it("rolls off equal-power beyond the free voices", () => {
    assert.ok(Math.abs(voiceScale(16) - Math.sqrt(FREE_VOICES / 16)) < 1e-12)
    assert.ok(voiceScale(12) < 1)
    assert.ok(voiceScale(12) > voiceScale(24))
  })

  it("bounds the sum: twelve hits are under 7x one hit, not 12x", () => {
    const sum = 12 * voiceScale(12)
    assert.ok(sum < 7, `12 voices summed to ${sum}`)
    assert.ok(sum > 4, `12 voices summed to ${sum} — that is a fade, not a crowd`)
  })
})

describe("dbfs", () => {
  it("reports the MOSAIC numbers in the units the report used", () => {
    assert.ok(Math.abs(dbfs(2.344) - 7.4) < 0.1)
    assert.ok(Math.abs(dbfs(1) - 0) < 1e-9)
  })
})
