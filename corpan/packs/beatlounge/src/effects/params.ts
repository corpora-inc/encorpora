/**
 * beatlounge — per-effect PARAM SCHEMAS (the single source of truth shared by
 * the audio engine's `createEffect` mappers and the fx-rack UI knobs).
 *
 * Each kind declares its automatable params with type/range/default/unit and a
 * one-line describe. Keeping this pure + UI-free means the same metadata drives
 * the Tone setters AND the knob set, so they can never drift. Defaults here are
 * what a freshly-added insert starts at (see `defaultEffectParams`).
 */

import type { EffectKind } from "../model/document"

export type EffectParamType = "number" | "enum" | "boolean"

export interface EffectParamSpec {
  key: string
  label: string
  type: EffectParamType
  min?: number
  max?: number
  step?: number
  default: number | string | boolean
  /** Logarithmic feel for the UI (frequencies); engine still gets the raw value. */
  log?: boolean
  unit?: string
  options?: readonly string[]
  describe: string
}

export interface EffectSpec {
  kind: EffectKind
  label: string
  params: EffectParamSpec[]
}

const freq = (
  key: string,
  label: string,
  def: number,
  describe: string
): EffectParamSpec => ({
  key,
  label,
  type: "number",
  min: 20,
  max: 18000,
  step: 1,
  default: def,
  log: true,
  unit: "Hz",
  describe,
})

const db = (
  key: string,
  label: string,
  def: number,
  describe: string,
  min = -24,
  max = 24
): EffectParamSpec => ({
  key,
  label,
  type: "number",
  min,
  max,
  step: 0.5,
  default: def,
  unit: "dB",
  describe,
})

const unit01 = (
  key: string,
  label: string,
  def: number,
  describe: string
): EffectParamSpec => ({
  key,
  label,
  type: "number",
  min: 0,
  max: 1,
  step: 0.01,
  default: def,
  describe,
})

export const EFFECT_SPECS: Record<EffectKind, EffectSpec> = {
  filter: {
    kind: "filter",
    label: "Filter",
    params: [
      {
        key: "type",
        label: "Type",
        type: "enum",
        default: "lowpass",
        options: ["lowpass", "highpass", "bandpass", "notch"],
        describe: "Filter response shape.",
      },
      freq("frequency", "Freq", 1200, "Cutoff / center frequency."),
      {
        key: "q",
        label: "Q",
        type: "number",
        min: 0.1,
        max: 20,
        step: 0.1,
        default: 1,
        describe: "Resonance / bandwidth.",
      },
    ],
  },
  eq3: {
    kind: "eq3",
    label: "EQ3",
    params: [
      db("low", "Low", 0, "Low-band gain."),
      db("mid", "Mid", 0, "Mid-band gain."),
      db("high", "High", 0, "High-band gain."),
      freq("lowFrequency", "Lo×", 400, "Low/mid crossover."),
      freq("highFrequency", "Hi×", 2500, "Mid/high crossover."),
    ],
  },
  compressor: {
    kind: "compressor",
    label: "Comp",
    params: [
      db("threshold", "Thresh", -18, "Level above which it compresses.", -60, 0),
      {
        key: "ratio",
        label: "Ratio",
        type: "number",
        min: 1,
        max: 20,
        step: 0.5,
        default: 4,
        describe: "Compression ratio (n:1).",
      },
      {
        key: "attack",
        label: "Attack",
        type: "number",
        min: 0,
        max: 1,
        step: 0.001,
        default: 0.01,
        unit: "s",
        describe: "Onset response time.",
      },
      {
        key: "release",
        label: "Release",
        type: "number",
        min: 0,
        max: 1,
        step: 0.001,
        default: 0.2,
        unit: "s",
        describe: "Recovery time.",
      },
      db("knee", "Knee", 24, "Transition softness around the threshold.", 0, 40),
    ],
  },
  distortion: {
    kind: "distortion",
    label: "Drive",
    params: [
      unit01("distortion", "Drive", 0.3, "Waveshaper amount."),
      unit01("wet", "Mix", 1, "Dry/wet blend."),
    ],
  },
  chorus: {
    kind: "chorus",
    label: "Chorus",
    params: [
      {
        key: "frequency",
        label: "Rate",
        type: "number",
        min: 0.05,
        max: 8,
        step: 0.05,
        default: 1.5,
        unit: "Hz",
        describe: "LFO rate.",
      },
      {
        key: "delayTime",
        label: "Delay",
        type: "number",
        min: 1,
        max: 20,
        step: 0.1,
        default: 3.5,
        unit: "ms",
        describe: "Base modulation delay.",
      },
      unit01("depth", "Depth", 0.7, "Modulation depth."),
      unit01("wet", "Mix", 0.5, "Dry/wet blend."),
    ],
  },
  phaser: {
    kind: "phaser",
    label: "Phaser",
    params: [
      {
        key: "frequency",
        label: "Rate",
        type: "number",
        min: 0.05,
        max: 8,
        step: 0.05,
        default: 0.5,
        unit: "Hz",
        describe: "LFO sweep rate.",
      },
      {
        key: "octaves",
        label: "Octaves",
        type: "number",
        min: 1,
        max: 6,
        step: 0.5,
        default: 3,
        describe: "Sweep range in octaves.",
      },
      freq("baseFrequency", "Base", 350, "Sweep base frequency."),
      unit01("wet", "Mix", 0.5, "Dry/wet blend."),
    ],
  },
  bitcrusher: {
    kind: "bitcrusher",
    label: "Crush",
    params: [
      {
        key: "bits",
        label: "Bits",
        type: "number",
        min: 1,
        max: 16,
        step: 1,
        default: 6,
        describe: "Bit depth (lower = crunchier).",
      },
      unit01("wet", "Mix", 1, "Dry/wet blend."),
    ],
  },
  delay: {
    kind: "delay",
    label: "Delay",
    params: [
      {
        key: "delayTime",
        label: "Time",
        type: "number",
        min: 0,
        max: 3,
        step: 0.001,
        default: 0.25,
        unit: "s",
        describe: "Delay time (seconds; maxDelay 3).",
      },
      unit01("feedback", "Feedback", 0.35, "Regeneration amount."),
      unit01("wet", "Mix", 0.3, "Dry/wet blend."),
    ],
  },
  reverb: {
    kind: "reverb",
    label: "Reverb",
    params: [
      {
        key: "roomSize",
        label: "Size",
        type: "number",
        min: 0,
        max: 0.98,
        step: 0.01,
        default: 0.7,
        describe: "Tail length / room size.",
      },
      unit01("dampening", "Damp", 0.5, "High-frequency damping."),
      unit01("wet", "Mix", 0.3, "Dry/wet blend."),
    ],
  },
  limiter: {
    kind: "limiter",
    label: "Limit",
    params: [db("threshold", "Ceiling", -1, "Output ceiling.", -24, 0)],
  },
  gain: {
    kind: "gain",
    label: "Gain",
    params: [
      {
        key: "gain",
        label: "Gain",
        type: "number",
        min: 0,
        max: 2,
        step: 0.01,
        default: 1,
        describe: "Linear gain (1 = unity).",
      },
    ],
  },
}

/** All known EffectKinds, in a stable add-menu order. */
export const EFFECT_KINDS: readonly EffectKind[] = [
  "filter",
  "eq3",
  "compressor",
  "distortion",
  "chorus",
  "phaser",
  "bitcrusher",
  "delay",
  "reverb",
  "limiter",
  "gain",
]

/** A fresh param bag for a newly-added insert of `kind` (UI add-menu uses it). */
export const defaultEffectParams = (
  kind: EffectKind
): Record<string, number | string | boolean> => {
  const out: Record<string, number | string | boolean> = {}
  for (const p of EFFECT_SPECS[kind].params) out[p.key] = p.default
  return out
}

/** Read a numeric param with the spec default as fallback (coerces strings). */
export const numParam = (
  params: Record<string, number | string | boolean>,
  spec: EffectParamSpec
): number => {
  const v = params[spec.key]
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : (spec.default as number)
}

/** Read a string/enum param with the spec default as fallback. */
export const strParam = (
  params: Record<string, number | string | boolean>,
  spec: EffectParamSpec
): string => {
  const v = params[spec.key]
  return typeof v === "string" ? v : String(spec.default)
}
