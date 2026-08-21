// Effect-registry tests (PREMIUM_SCROLL §3.4): the rotation is intensity- and
// reduced-motion gated, non-repeating, and COMBO-WEIGHTED so the feed escalates
// from calm to fireworks. The picker is pure (RNG injected) — no renderer.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  EFFECTS,
  eligibleEffects,
  isEligible,
  effectWeight,
  createEffectPicker,
} from "./registry.ts"
import type { EffectContext } from "./types.ts"

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let tt = Math.imul(a ^ (a >>> 15), 1 | a)
    tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt
    return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296
  }
}

function ctx(p: Partial<EffectContext> = {}): EffectContext {
  return {
    comboCount: 1,
    perfect: false,
    tier: 1,
    reducedMotion: false,
    intensity: "full",
    cx: 100,
    cy: 100,
    width: 400,
    height: 800,
    hue: 262,
    canvas: null,
    ...p,
  }
}

test("minimal intensity yields NO effects (quiet text only)", () => {
  assert.equal(eligibleEffects(ctx({ intensity: "minimal" })).length, 0)
})

test("reduced intensity keeps only the no-3D floor effects", () => {
  const ids = eligibleEffects(ctx({ intensity: "reduced", comboCount: 20 })).map((e) => e.id)
  assert.deepEqual(new Set(ids), new Set(["confetti", "shockwave"]))
})

test("reduced-motion excludes every 3D-spin effect", () => {
  const ids = eligibleEffects(ctx({ reducedMotion: true, comboCount: 20 })).map((e) => e.id)
  assert.ok(!ids.includes("shards"))
  assert.ok(!ids.includes("flip"))
})

test("full intensity at a deep combo unlocks the whole registry", () => {
  const ids = eligibleEffects(ctx({ comboCount: 20 })).map((e) => e.id)
  assert.equal(ids.length, EFFECTS.length)
})

test("minCombo withholds the high-energy effects on early cards", () => {
  const early = eligibleEffects(ctx({ comboCount: 1 })).map((e) => e.id)
  assert.ok(!early.includes("neonpop"), "neonpop is withheld at combo 1")
  assert.ok(!early.includes("shards"), "shards is withheld at combo 1")
  assert.ok(early.includes("confetti"))
  assert.ok(early.includes("shockwave"))
})

test("isEligible agrees with the intensity ranking", () => {
  const neon = EFFECTS.find((e) => e.id === "neonpop")!
  assert.equal(isEligible(neon, ctx({ intensity: "reduced", comboCount: 20 })), false)
  assert.equal(isEligible(neon, ctx({ intensity: "full", comboCount: 20 })), true)
})

test("escalation: low-energy dominates when calm, high-energy when hot", () => {
  const confetti = EFFECTS.find((e) => e.id === "confetti")!
  const neon = EFFECTS.find((e) => e.id === "neonpop")!
  // Calm (combo 1): the gentle confetti outweighs the fireworks.
  assert.ok(effectWeight(confetti, 1) > effectWeight(neon, 1))
  // Hot (combo 20): the fireworks outweigh the gentle confetti.
  assert.ok(effectWeight(neon, 20) > effectWeight(confetti, 20))
  // And the neon effect's own weight strictly climbs from calm → hot.
  assert.ok(effectWeight(neon, 20) > effectWeight(neon, 1))
})

test("picker only ever returns eligible effects", () => {
  const picker = createEffectPicker({ rng: mulberry32(11) })
  for (let i = 0; i < 200; i++) {
    const c = ctx({ intensity: "reduced", comboCount: 30 })
    const e = picker.pick(c)
    assert.ok(e && ["confetti", "shockwave"].includes(e.id))
  }
})

test("picker avoids an immediate repeat (avoid=1) when >1 eligible", () => {
  const picker = createEffectPicker({ avoid: 1, rng: mulberry32(5) })
  let prev: string | null = null
  for (let i = 0; i < 300; i++) {
    const e = picker.pick(ctx({ comboCount: 20 }))!
    assert.notEqual(e.id, prev, `immediate repeat at ${i}`)
    prev = e.id
  }
})

test("picker returns null when nothing is eligible", () => {
  const picker = createEffectPicker({ rng: mulberry32(1) })
  assert.equal(picker.pick(ctx({ intensity: "minimal" })), null)
})

test("a single eligible effect is allowed to repeat (no starvation)", () => {
  // Force a context where only one effect is eligible by using a 1-effect list.
  const only = [EFFECTS.find((e) => e.id === "confetti")!]
  const picker = createEffectPicker({ effects: only, avoid: 1, rng: mulberry32(2) })
  assert.equal(picker.pick(ctx())!.id, "confetti")
  assert.equal(picker.pick(ctx())!.id, "confetti")
})
