/**
 * beatlounge — synth-analog module actions. Pure, LLM-callable patch edits that
 * also back the immersive surface's buttons. Each returns the commands the bus
 * applies in one undo step plus a human summary. No React, so unit-testable.
 *
 * The analog synth's whole patch lives in one `setInstrument` config (a flat
 * param bag), so a tweak/preset/randomize is ONE setInstrument command = one
 * undo step. `makeAnalog` converts the bound track into an analogSynth.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import { findTrack, isInstrumentTrack, type InstrumentConfig } from "../../model/document"
import {
  ANALOG_PARAMS,
  ANALOG_PRESET_NAMES,
  defaultAnalogParams,
  numParam,
  resolveAnalogPreset,
  type AnalogParams,
} from "../../instruments/analogSynth"

/** Resolve the track this surface is bound to (else the first instrument track). */
const targetTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const inst = ctx.doc.tracks.find((t) => isInstrumentTrack(t))
  return inst?.id ?? ctx.doc.tracks[0]?.id
}

/** The analogSynth config currently on a track, if any (for read-modify-write). */
const analogParamsOf = (ctx: ActionContext, trackId: string): AnalogParams => {
  const track = findTrack(ctx.doc, trackId)
  if (track && isInstrumentTrack(track) && track.instrument.kind === "analogSynth") {
    return { ...defaultAnalogParams(), ...track.instrument.params }
  }
  return defaultAnalogParams()
}

const analogConfig = (preset: string, params: AnalogParams): InstrumentConfig => ({
  kind: "analogSynth",
  preset,
  params,
})

/** makeAnalog — turn the bound track into the analog synth (named preset). */
export const makeAnalogAction: ModuleAction = {
  name: "makeAnalog",
  describe: "Turn the bound track into the premium analog synth, with an optional preset.",
  params: {
    preset: {
      type: "enum",
      options: ANALOG_PRESET_NAMES,
      default: "init",
      describe: "Starting sound: init, fat bass, warm pad, acid lead, pluck.",
    },
  },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = targetTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No track" }
    const preset = ANALOG_PRESET_NAMES.includes(params.preset as string)
      ? (params.preset as string)
      : "init"
    return {
      commands: [
        { t: "setInstrument", trackId, config: analogConfig(preset, resolveAnalogPreset(preset)) },
      ],
      summary: `Analog synth · ${preset}`,
    }
  },
}

/** applyPreset — load a named preset onto an already-analog track. */
export const applyPresetAction: ModuleAction = {
  name: "applyAnalogPreset",
  describe: "Load a named analog-synth preset onto the bound track.",
  params: {
    preset: {
      type: "enum",
      options: ANALOG_PRESET_NAMES,
      default: "init",
      describe: "Preset to load.",
    },
  },
  impact: "mutate",
  run(ctx, params): ActionResult {
    const trackId = targetTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No track" }
    const preset = ANALOG_PRESET_NAMES.includes(params.preset as string)
      ? (params.preset as string)
      : "init"
    return {
      commands: [
        { t: "setInstrument", trackId, config: analogConfig(preset, resolveAnalogPreset(preset)) },
      ],
      summary: `Preset · ${preset}`,
    }
  },
}

/** randomizePatch — a tasteful, deterministic-by-seed random analog patch. */
export const randomizePatchAction: ModuleAction = {
  name: "randomizeAnalog",
  describe: "Roll a fresh, musical analog patch on the bound track.",
  params: {},
  stochastic: true,
  impact: "mutate",
  run(ctx): ActionResult {
    const trackId = targetTrackId(ctx)
    if (!trackId) return { commands: [], summary: "No track" }
    const base = analogParamsOf(ctx, trackId)
    const next: AnalogParams = { ...base }
    const rng = ctx.rng
    const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

    // Randomize a curated, musical subset (leave envelopes/voice mode sane).
    next.osc1Wave = pick(["sawtooth", "fatsawtooth", "square", "pulse"] as const)
    next.osc2Wave = pick(["square", "sawtooth", "triangle"] as const)
    next.oscMix = 0.2 + rng() * 0.6
    next.osc2Detune = Math.round(rng() * 24)
    next.subLevel = rng() * 0.6
    next.cutoff = Math.round(300 + rng() * rng() * 6000)
    next.resonance = 1 + rng() * 12
    next.filterEnvAmount = 0.2 + rng() * 0.7
    next.drive = rng() * 0.5
    next.lfoTarget = pick(["pitch", "filter"] as const)
    next.lfoDepth = rng() < 0.5 ? 0 : rng() * 0.3

    return {
      commands: [{ t: "setInstrument", trackId, config: analogConfig("custom", next) }],
      summary: "Rolled a new patch",
    }
  },
}

/** Update an arbitrary numeric param (the UI knobs commit through this for one
 *  undo step; the live drag is handled by the instrument's setParam path). */
export const setAnalogParam = (
  ctx: ActionContext,
  trackId: string,
  key: string,
  value: number | string | boolean
): ActionResult => {
  const base = analogParamsOf(ctx, trackId)
  const track = findTrack(ctx.doc, trackId)
  const preset =
    track && isInstrumentTrack(track) && track.instrument.kind === "analogSynth"
      ? track.instrument.preset ?? "custom"
      : "custom"
  const params: AnalogParams = { ...base, [key]: value }
  return {
    commands: [{ t: "setInstrument", trackId, config: analogConfig(preset, params) }],
    summary: `${key} = ${typeof value === "number" ? numParam(params, key) : value}`,
  }
}

/** Keys that are safe to expose as continuous LLM tweaks (numeric). */
export const NUMERIC_KEYS = ANALOG_PARAMS.filter((s) => s.type === "number").map((s) => s.key)

export const synthAnalogActions: ReadonlyArray<ModuleAction> = [
  makeAnalogAction,
  applyPresetAction,
  randomizePatchAction,
]
