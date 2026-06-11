/**
 * beatlounge — instrument-page action registry (LLM-callable, pure).
 *
 *  • setGmInstrument — turn a track into a real General-MIDI soundfont voice by
 *    GM program number ("make the bass track a fretless bass").
 *  • makeAnalog / applyAnalogPreset / randomizeAnalog — re-homed from the retired
 *    synth-analog module (the analog synth is now a VOICE TYPE on this page).
 *    Action IDS ARE PRESERVED so existing voice commands ("make analog / set
 *    cutoff") still resolve. `setAnalogParam` backs the panel's committed knobs.
 *
 * Pure: each returns the commands; the store applies them as one undo step.
 */

import type { ActionContext, ActionResult, ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import { findTrack, isInstrumentTrack, type InstrumentConfig } from "../../model/document"
import { GM_SOUNDFONT_ID } from "../../instruments/gmSoundbank"
import { gmProgramName } from "../../instruments/gmPrograms"
import {
  ANALOG_PARAMS,
  ANALOG_PRESET_NAMES,
  defaultAnalogParams,
  numParam,
  resolveAnalogPreset,
  type AnalogParams,
} from "../../instruments/analogSynth"

/** Clamp + wrap any number into a valid 0..127 GM program. */
const toProgram = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0
  return ((v % 128) + 128) % 128
}

/** Set a track to a GM soundfont voice by program (and optional bank). */
export const setGmProgramAction: ModuleAction = {
  name: "setGmInstrument",
  describe:
    "Make a track play a real General-MIDI instrument by program number (0-127). " +
    "Programs follow the GM standard, e.g. 0 Acoustic Grand Piano, 24 Nylon Guitar, " +
    "35 Fretless Bass, 48 String Ensemble, 56 Trumpet, 73 Flute.",
  impact: "mutate",
  params: {
    track: { type: "track", describe: "Which track to re-voice." },
    program: {
      type: "int",
      min: 0,
      max: 127,
      default: 0,
      describe: "GM program number (0-127).",
    },
    bank: {
      type: "int",
      min: 0,
      max: 128,
      default: 0,
      describe: "Bank select (0 = melodic; 128 = GM drum kits).",
    },
  },
  run(ctx, params) {
    const trackId =
      (typeof params.track === "string" && params.track) || ctx.targetTrackId
    if (!trackId) {
      return { commands: [], summary: "No track to re-voice." }
    }
    const program = toProgram(params.program)
    const bank =
      typeof params.bank === "number" && Number.isFinite(params.bank)
        ? Math.max(0, Math.min(128, Math.round(params.bank)))
        : 0
    const command: Command = {
      t: "setInstrument",
      trackId,
      config: { kind: "soundfont", soundfontId: GM_SOUNDFONT_ID, program, bank },
    }
    return {
      commands: [command],
      summary: `${gmProgramName(program, bank)}`,
    }
  },
}

// ============================================================ analog synth
// Re-homed from synth-analog/actions.ts (ids unchanged). The analog patch lives
// in one setInstrument config (a flat param bag), so each edit is ONE undo step.

/** Resolve the bound target (else the first instrument track). */
const analogTargetTrackId = (ctx: ActionContext): string | undefined => {
  if (ctx.targetTrackId) return ctx.targetTrackId
  const inst = ctx.doc.tracks.find((t) => isInstrumentTrack(t))
  return inst?.id ?? ctx.doc.tracks[0]?.id
}

/** The analogSynth params currently on a track, if any (read-modify-write). */
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
    const trackId = analogTargetTrackId(ctx)
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

/** applyAnalogPreset — load a named preset onto an already-analog track. */
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
    const trackId = analogTargetTrackId(ctx)
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

/** randomizeAnalog — a tasteful, deterministic-by-seed random analog patch. */
export const randomizePatchAction: ModuleAction = {
  name: "randomizeAnalog",
  describe: "Roll a fresh, musical analog patch on the bound track.",
  params: {},
  stochastic: true,
  impact: "mutate",
  run(ctx): ActionResult {
    const trackId = analogTargetTrackId(ctx)
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

/** Update an arbitrary numeric analog param (the panel's committed knobs go
 *  through this for one undo step; the live drag uses the instrument setParam). */
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

/** Keys safe to expose as continuous LLM tweaks (numeric). */
export const NUMERIC_KEYS = ANALOG_PARAMS.filter((s) => s.type === "number").map((s) => s.key)

export const instrumentsActions: ReadonlyArray<ModuleAction> = [
  setGmProgramAction,
  makeAnalogAction,
  applyPresetAction,
  randomizePatchAction,
]
