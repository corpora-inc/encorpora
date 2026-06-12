/**
 * beatlounge — createEffect: turn a JSON `EffectNode` into a live `Effect`.
 *
 * Each kind wraps one (or two) Tone nodes and exposes the frozen Effect seam
 * `{ input, output, update(params, enabled), setParam(p,v,when), dispose() }`.
 * `update()` maps the flat JSON `params` bag to Tone setters and applies a
 * BYPASS when `!enabled` (wet → 0 for wet/dry effects; pass-through routing for
 * the rest), so the audioGraph never rebuilds a chain just to toggle a node.
 *
 * The param ranges/defaults live in ./params (shared with the fx-rack UI) so
 * the setters here and the knobs there can never drift.
 */

import * as Tone from "tone"
import type { Effect } from "../contracts/engine"
import type { EffectKind, EffectNode } from "../model/document"
import { EFFECT_SPECS, numParam, strParam, type EffectParamSpec } from "./params"

type Params = Record<string, number | string | boolean>

const RAMP = 0.01 // 10ms — click-free param moves

const spec = (kind: EffectKind, key: string): EffectParamSpec => {
  const s = EFFECT_SPECS[kind].params.find((p) => p.key === key)
  if (!s) throw new Error(`beatlounge: unknown param ${kind}.${key}`)
  return s
}

const num = (kind: EffectKind, params: Params, key: string): number =>
  numParam(params, spec(kind, key))
const str = (kind: EffectKind, params: Params, key: string): string =>
  strParam(params, spec(kind, key))

/** The shape of a Tone Param/Signal we ramp (loose across unit generics). */
interface Rampable {
  rampTo: (v: number, t: number, when?: number) => unknown
  value: unknown
}

/** Ramp a Tone Param/Signal to a value (click-free) at `when` (or now). */
const ramp = (p: Rampable, v: number, when?: number): void => {
  if (when == null) p.rampTo(v, RAMP)
  else p.rampTo(v, RAMP, when)
}

/**
 * A wet/dry Tone effect (Distortion/Chorus/Phaser/BitCrusher/FeedbackDelay/
 * Freeverb): one node IS the input AND output, with a `.wet` signal. Bypass
 * forces wet→0 (dry pass-through) without unhooking the graph.
 */
const wetEffect = (
  kind: EffectKind,
  node: Tone.ToneAudioNode & { wet?: Rampable },
  apply: (params: Params, when?: number) => void,
  /** Apply ONE param to the live node (for realtime knob drags via applyParam).
   *  The shared `wet`/mix is handled here; each effect maps its own params. */
  live?: (param: string, value: number, when?: number) => void
): Effect => ({
  input: node,
  output: node,
  update(params, enabled) {
    apply(params)
    if (node.wet) {
      const wet = EFFECT_SPECS[kind].params.some((p) => p.key === "wet")
        ? num(kind, params, "wet")
        : 1
      ramp(node.wet, enabled ? wet : 0)
    }
  },
  setParam(param, value, when) {
    // Live, click-free single-param moves so fx knobs/pads sweep DURING the drag
    // (host.applyParam), not just on release. "wet" (dry/wet mix) is universal.
    if (param === "wet" && node.wet) ramp(node.wet, value, when)
    else live?.(param, value, when)
  },
  dispose() {
    node.dispose()
  },
})

const createFilter = (): Effect => {
  const node = new Tone.Filter({ type: "lowpass", frequency: 1200, Q: 1 })
  return {
    input: node,
    output: node,
    update(params, enabled) {
      node.type = str("filter", params, "type") as BiquadFilterType
      ramp(node.frequency, enabled ? num("filter", params, "frequency") : 20000)
      node.Q.value = num("filter", params, "q")
    },
    setParam(param, value, when) {
      if (param === "frequency") ramp(node.frequency, value, when)
      else if (param === "q") node.Q.setValueAtTime(value, when)
    },
    dispose() {
      node.dispose()
    },
  }
}

const createEq3 = (): Effect => {
  const node = new Tone.EQ3()
  return {
    input: node,
    output: node,
    update(params, enabled) {
      const on = enabled ? 1 : 0
      ramp(node.low, on * num("eq3", params, "low"))
      ramp(node.mid, on * num("eq3", params, "mid"))
      ramp(node.high, on * num("eq3", params, "high"))
      node.lowFrequency.value = num("eq3", params, "lowFrequency")
      node.highFrequency.value = num("eq3", params, "highFrequency")
    },
    setParam(param, value, when) {
      if (param === "low") ramp(node.low, value, when)
      else if (param === "mid") ramp(node.mid, value, when)
      else if (param === "high") ramp(node.high, value, when)
      else if (param === "lowFrequency") ramp(node.lowFrequency, value, when)
      else if (param === "highFrequency") ramp(node.highFrequency, value, when)
    },
    dispose() {
      node.dispose()
    },
  }
}

const createCompressor = (): Effect => {
  const node = new Tone.Compressor()
  return {
    input: node,
    output: node,
    update(params, enabled) {
      // Bypass ⇒ a transparent compressor (threshold 0, ratio 1:1).
      node.threshold.value = enabled ? num("compressor", params, "threshold") : 0
      node.ratio.value = enabled ? num("compressor", params, "ratio") : 1
      node.attack.value = num("compressor", params, "attack")
      node.release.value = num("compressor", params, "release")
      node.knee.value = num("compressor", params, "knee")
    },
    setParam(param, value, when) {
      const at = when ?? Tone.now()
      if (param === "threshold") node.threshold.setValueAtTime(value, at)
      else if (param === "ratio") node.ratio.setValueAtTime(value, at)
      else if (param === "attack") node.attack.setValueAtTime(value, at)
      else if (param === "release") node.release.setValueAtTime(value, at)
      else if (param === "knee") node.knee.setValueAtTime(value, at)
    },
    dispose() {
      node.dispose()
    },
  }
}

const createLimiter = (): Effect => {
  const node = new Tone.Limiter(-1)
  return {
    input: node,
    output: node,
    update(params, enabled) {
      node.threshold.value = enabled ? num("limiter", params, "threshold") : 0
    },
    setParam(param, value, when) {
      if (param === "threshold") node.threshold.setValueAtTime(value, when)
    },
    dispose() {
      node.dispose()
    },
  }
}

const createGain = (): Effect => {
  const node = new Tone.Gain(1)
  return {
    input: node,
    output: node,
    update(params, enabled) {
      ramp(node.gain, enabled ? num("gain", params, "gain") : 1)
    },
    setParam(param, value, when) {
      if (param === "gain") ramp(node.gain, value, when)
    },
    dispose() {
      node.dispose()
    },
  }
}

const createDistortion = (): Effect => {
  const node = new Tone.Distortion(0.3)
  return wetEffect(
    "distortion",
    node,
    (params) => {
      node.distortion = num("distortion", params, "distortion")
    },
    (param, value) => {
      if (param === "distortion") node.distortion = value
    }
  )
}

const createChorus = (): Effect => {
  const node = new Tone.Chorus(1.5, 3.5, 0.7).start()
  return wetEffect(
    "chorus",
    node,
    (params) => {
      node.frequency.value = num("chorus", params, "frequency")
      node.delayTime = num("chorus", params, "delayTime")
      node.depth = num("chorus", params, "depth")
    },
    (param, value, when) => {
      if (param === "frequency") ramp(node.frequency, value, when)
      else if (param === "delayTime") node.delayTime = value
      else if (param === "depth") node.depth = value
    }
  )
}

const createPhaser = (): Effect => {
  const node = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350 })
  return wetEffect(
    "phaser",
    node,
    (params) => {
      node.frequency.value = num("phaser", params, "frequency")
      node.octaves = num("phaser", params, "octaves")
      node.baseFrequency = num("phaser", params, "baseFrequency")
    },
    (param, value, when) => {
      if (param === "frequency") ramp(node.frequency, value, when)
      else if (param === "octaves") node.octaves = value
      else if (param === "baseFrequency") node.baseFrequency = value
    }
  )
}

const createBitcrusher = (): Effect => {
  const node = new Tone.BitCrusher(6)
  return wetEffect(
    "bitcrusher",
    node,
    (params) => {
      node.bits.value = num("bitcrusher", params, "bits")
    },
    (param, value, when) => {
      if (param === "bits") node.bits.setValueAtTime(value, when ?? Tone.now())
    }
  )
}

const createDelay = (): Effect => {
  // maxDelay 3 mirrors melopan's slowest-BPM headroom. Default = a dotted quarter
  // at the 96 BPM default (0.9375s) — the musical starting point for an echo.
  const node = new Tone.FeedbackDelay({ delayTime: 0.9375, feedback: 0.35, maxDelay: 3 })
  return wetEffect(
    "delay",
    node,
    (params) => {
      node.delayTime.value = num("delay", params, "delayTime")
      node.feedback.value = num("delay", params, "feedback")
    },
    (param, value, when) => {
      if (param === "delayTime") ramp(node.delayTime, value, when)
      else if (param === "feedback") ramp(node.feedback, value, when)
    }
  )
}

const createReverb = (): Effect => {
  const node = new Tone.Freeverb(0.7, 3000)
  return wetEffect(
    "reverb",
    node,
    (params) => {
      node.roomSize.value = num("reverb", params, "roomSize")
      node.dampening = 1000 + num("reverb", params, "dampening") * 9000
    },
    (param, value, when) => {
      if (param === "roomSize") ramp(node.roomSize, value, when)
      else if (param === "dampening") node.dampening = 1000 + value * 9000
    }
  )
}

const BUILDERS: Record<EffectKind, () => Effect> = {
  filter: createFilter,
  eq3: createEq3,
  compressor: createCompressor,
  distortion: createDistortion,
  chorus: createChorus,
  phaser: createPhaser,
  bitcrusher: createBitcrusher,
  delay: createDelay,
  reverb: createReverb,
  limiter: createLimiter,
  gain: createGain,
}

/**
 * Build a live Effect for an EffectNode and apply its initial params/enabled.
 * The audioGraph connects `effect.input`/`effect.output` into the chain and
 * calls `update()` whenever the node's params change (no rebuild).
 */
export const createEffect = (node: EffectNode): Effect => {
  const build = BUILDERS[node.kind]
  if (!build) throw new Error(`beatlounge: unknown effect kind ${node.kind}`)
  const fx = build()
  fx.update(node.params, node.enabled)
  return fx
}
