/**
 * Unit tests for the parts of the kit that are pure logic.
 *
 * There is no Web Audio in Node, so signal behaviour is NOT tested here — it is
 * measured for real in a browser by `measure/`, which is the only honest place
 * to do it. What IS testable without a soundcard is the maths and the policy,
 * and those are exactly the things that silently drift.
 *
 *     npm test
 */

import { strict as assert } from "node:assert"
import { describe, it } from "node:test"

import { MATERIALS, expandMaterial } from "./dsp/materials.ts"
import { T60_TAUS, tauFor } from "./dsp/env.ts"
import { cents, clamp, equalPower, hashString, midiHz, mulberry32, rotate, semi, spread } from "./rng.ts"
import { ALL_PRESETS, HIJAZ, PENTA, ROOT_HZ } from "./presets/library.ts"
import { TIERS } from "./engine.ts"
import { WORKLET_SOURCE } from "./worklets/source.ts"

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) assert.equal(a(), b())
  })

  it("stays in [0,1)", () => {
    const r = mulberry32(7)
    for (let i = 0; i < 10000; i++) {
      const v = r()
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`)
    }
  })

  it("spread pushes values away from the centre", () => {
    // The anti-fatigue shaper must NOT be uniform, or repeated sounds cluster
    // around the unmodified pitch and the variation is inaudible.
    const r = mulberry32(3)
    let near = 0
    let uniformNear = 0
    for (let i = 0; i < 20000; i++) {
      const u = r()
      if (Math.abs(spread(u)) < 0.25) near++
      if (Math.abs(u * 2 - 1) < 0.25) uniformNear++
    }
    assert.ok(near < uniformNear, `spread should be less centre-heavy: ${near} vs ${uniformNear}`)
  })

  it("rotate never repeats the previous index", () => {
    const r = mulberry32(11)
    let last = 0
    for (let i = 0; i < 5000; i++) {
      const n = rotate(r(), 4, last)
      assert.notEqual(n, last)
      assert.ok(n >= 0 && n < 4)
      last = n
    }
  })

  it("music maths is right", () => {
    assert.ok(Math.abs(semi(12) - 2) < 1e-12)
    assert.ok(Math.abs(cents(1200) - 2) < 1e-12)
    assert.ok(Math.abs(midiHz(69) - 440) < 1e-9)
    assert.ok(Math.abs(midiHz(57) - 220) < 1e-9)
    assert.equal(clamp(5, 0, 1), 1)
    assert.ok(Math.abs(equalPower(0.5) - Math.SQRT1_2) < 1e-12)
    assert.equal(hashString("a"), hashString("a"))
    assert.notEqual(hashString("a"), hashString("b"))
  })
})

describe("envelopes", () => {
  it("tauFor gives a -60dB point at the requested time", () => {
    // setTargetAtTime decays as exp(-t/tau). We want exp(-T60/tau) = 1e-3.
    const t60 = 1.4
    const tau = tauFor(t60)
    assert.ok(Math.abs(Math.exp(-t60 / tau) - 0.001) < 1e-9)
    assert.ok(Math.abs(T60_TAUS - Math.log(1000)) < 1e-12)
  })
})

describe("modal materials", () => {
  it("every material starts at ratio 1 and has matching array lengths", () => {
    for (const [id, m] of Object.entries(MATERIALS)) {
      assert.equal(m.ratios[0], 1, `${id} must start at the fundamental`)
      assert.equal(m.ratios.length, m.amps.length, `${id} ratios/amps mismatch`)
      assert.ok(m.t60 > 0, `${id} needs a decay`)
      assert.ok(m.decayExp >= 0, `${id} decayExp must not amplify high modes`)
    }
  })

  it("expands to the requested frequency with high modes decaying faster", () => {
    const { freqs, t60s, amps } = expandMaterial(MATERIALS.brass, 200, {
      rand: mulberry32(1),
      bright: 0.5,
    })
    // Fundamental lands within the detune budget.
    const detuneRatio = freqs[0] / 200
    assert.ok(Math.abs(1200 * Math.log2(detuneRatio)) <= MATERIALS.brass.detuneCents + 0.01)
    // All real objects damp high frequencies first. If this ever inverts, every
    // struck sound turns to plastic.
    for (let i = 1; i < t60s.length; i++) {
      assert.ok(t60s[i] < t60s[i - 1], `mode ${i} must decay faster than ${i - 1}`)
    }
    // Amplitudes are peak-normalised so `bright` is a tone control, not a fader.
    assert.ok(Math.abs(Math.max(...amps) - 1) < 1e-6)
  })

  it("damping shortens every mode", () => {
    const dry = expandMaterial(MATERIALS.glass, 300, { rand: mulberry32(2), damp: 0 })
    const wet = expandMaterial(MATERIALS.glass, 300, { rand: mulberry32(2), damp: 0.8 })
    for (let i = 0; i < dry.t60s.length; i++) assert.ok(wet.t60s[i] < dry.t60s[i])
  })

  it("bright changes timbre without changing level", () => {
    const dark = expandMaterial(MATERIALS.bell, 400, { rand: mulberry32(4), bright: 0 })
    const bright = expandMaterial(MATERIALS.bell, 400, { rand: mulberry32(4), bright: 1 })
    assert.ok(Math.abs(Math.max(...dark.amps) - Math.max(...bright.amps)) < 1e-6)
    // The upper partials must actually survive better when bright.
    const lastDark = dark.amps[dark.amps.length - 1]
    const lastBright = bright.amps[bright.amps.length - 1]
    assert.ok(lastBright > lastDark, "bright must preserve upper modes")
  })

  it("reuses caller-provided arrays so a strike allocates nothing", () => {
    const into = { freqs: new Float32Array(10), amps: new Float32Array(10), t60s: new Float32Array(10) }
    const out = expandMaterial(MATERIALS.tile, 220, { into, rand: mulberry32(5) })
    assert.equal(out.freqs.buffer, into.freqs.buffer)
    assert.equal(out.freqs.length, MATERIALS.tile.ratios.length)
  })
})

describe("preset library", () => {
  it("has unique ids", () => {
    const seen = new Set<string>()
    for (const p of ALL_PRESETS) {
      assert.ok(!seen.has(p.id), `duplicate preset id ${p.id}`)
      seen.add(p.id)
    }
  })

  it("every preset is bus-routed, levelled and describes its own visual weight", () => {
    for (const p of ALL_PRESETS) {
      assert.ok(["sfx", "ui", "music", "ambience"].includes(p.bus), `${p.id} bad bus`)
      assert.ok(p.gain > 0 && p.gain <= 6, `${p.id} gain out of range: ${p.gain}`)
      // A cue with no weight cannot drive a visual, and audio must never be the
      // only channel carrying information.
      assert.ok(p.weight !== undefined && p.weight > 0, `${p.id} needs a visual weight`)
      assert.ok(p.haptic !== undefined, `${p.id} needs a haptic hint`)
    }
  })

  it("UI presets are quiet, short-gapped and heavily varied", () => {
    // These are heard hundreds of times a session; the anti-fatigue budget for
    // them is deliberately larger than for a once-a-level reward.
    for (const p of ALL_PRESETS.filter((x) => x.id.startsWith("ui."))) {
      assert.equal(p.bus, "ui", `${p.id} must be on the ui bus`)
      assert.ok((p.jitterCents ?? 30) >= 20, `${p.id} needs pitch variation`)
    }
  })

  it("no preset ducks the mix to silence", () => {
    for (const p of ALL_PRESETS) {
      assert.ok((p.duck ?? 0) <= 0.6, `${p.id} ducks too hard: ${p.duck}`)
    }
  })

  it("scales are musically well-formed", () => {
    for (const scale of [HIJAZ, PENTA]) {
      for (let i = 1; i < scale.length; i++) {
        assert.ok(scale[i] > scale[i - 1], "scale degrees must ascend")
      }
      assert.equal(scale[0], 0)
    }
    // Hijaz is defined by its augmented second between b2 and 3.
    assert.equal(HIJAZ[2] - HIJAZ[1], 3)
    assert.ok(Math.abs(ROOT_HZ - 146.83) < 0.01)
  })
})

describe("tier profiles", () => {
  it("degrade monotonically", () => {
    const order = ["ultra", "high", "medium", "low"] as const
    for (let i = 1; i < order.length; i++) {
      const hi = TIERS[order[i - 1]]
      const lo = TIERS[order[i]]
      assert.ok(lo.maxVoices <= hi.maxVoices, "voices must not increase as tier drops")
      assert.ok(lo.maxModes <= hi.maxModes)
      assert.ok(lo.maxGrainRate <= hi.maxGrainRate)
      assert.ok(lo.musicLayers <= hi.musicLayers)
      assert.ok(lo.reverbSeconds <= hi.reverbSeconds)
    }
  })

  it("the lowest tier still makes sound", () => {
    assert.ok(TIERS.low.maxVoices >= 8, "low tier must still be playable")
    assert.ok(TIERS.low.musicLayers >= 1)
  })
})

describe("worklet source", () => {
  it("registers every processor the kit asks for", () => {
    for (const name of ["dw-string", "dw-modal", "dw-meter"]) {
      assert.ok(WORKLET_SOURCE.includes(`registerProcessor('${name}'`), `missing ${name}`)
    }
  })

  it("allocates nothing on the audio render thread", () => {
    // A `new` inside process() (or anything it calls) eventually drags a GC
    // pause into a 2.67 ms budget and it is heard as a click. This was actually
    // violated twice while building the kit: a per-pluck excitation
    // Float32Array, and Array#push into the pending-event list.
    const src = WORKLET_SOURCE.replace(/\/\/[^\n]*/g, "")
    const bodyOf = (signature: string): string => {
      const at = src.indexOf(signature)
      if (at < 0) return ""
      let depth = 0
      let i = src.indexOf("{", at)
      const start = i
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++
        else if (src[i] === "}") {
          depth--
          if (depth === 0) return src.slice(start, i)
        }
      }
      return src.slice(start)
    }
    // Every method reachable from the render thread. Constructors are exempt —
    // that is precisely where the preallocation is supposed to happen.
    const hot = ["process(_inputs, outputs)", "process(inputs)", "start(ev)", "allocate()", "rnd()", "function drain("]
    for (const sig of hot) {
      const body = bodyOf(sig)
      if (!body) continue
      assert.ok(
        !/\bnew\s+\w*Array|\bnew\s+Map|\bnew\s+Set|\.map\(|\.filter\(|\.slice\(|\.sort\(/.test(body),
        `allocation on the audio thread in ${sig}`,
      )
    }
  })

  it("is valid JavaScript", () => {
    // Cheapest possible guard against a typo in a string that only ever runs
    // inside an AudioWorkletGlobalScope, where a syntax error is silent.
    const stub = `
      const registerProcessor = () => {};
      const currentTime = 0;
      const sampleRate = 48000;
      class AudioWorkletProcessor { constructor() { this.port = { onmessage: null, postMessage(){} } } }
    `
    assert.doesNotThrow(() => new Function(stub + WORKLET_SOURCE))
  })
})
