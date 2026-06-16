/**
 * beatlounge — DEMO SONG compiler + validator.
 *
 * `compileDemo(spec)` turns a beat-addressed DemoSongSpec into a SceneSnapshot
 * (the same shape Scenes load), resolving beats→ticks at the spec's meter and
 * materializing instruments / kit / harmony from the corpora. `validateDemo`
 * returns a list of human-readable problems (empty ⇒ valid) so a typo'd id is a
 * loud test failure, not a silent wrong sound.
 */

import {
  createDefaultDoc,
  defaultHarmony,
  newFragmentTrack,
  newInstrumentTrack,
  synthPreset,
  type BeatloungeDoc,
  type Harmony,
  type HarmonyChordEvent,
  type InstrumentTrack,
  type NoteEvent,
} from "../../../model/document"
import { newId } from "../../../model/ids"
import { PPQ, clampLoopTicks, type GridDenominator } from "../../../model/timing"
import { captureSnapshot, type SceneSnapshot } from "../../../model/snapshot"
import { getPreset, instantiatePreset } from "../../../instruments/presets"
import { getKit, ROLE_TO_PITCH } from "../../../kits"
import { getMode } from "../../../music/modes"
import { getRhythm } from "../../../rhythm"
import type { DemoNote, DemoSongSpec, DemoTrackSpec } from "./types"

/** Ticks per 1/denominator beat at this meter. */
const beatTicksFor = (denominator: number): number => (4 * PPQ) / denominator

/** Resolve a demo note's MIDI pitch (drum `role` → pitch via the kit map). */
const resolvePitch = (n: DemoNote): number => {
  if (typeof n.pitch === "number") return n.pitch
  if (n.role && n.role in ROLE_TO_PITCH) return ROLE_TO_PITCH[n.role]
  return 60
}

/** Build the NoteEvents for one track, beats→ticks at the given beat length. */
const compileNotes = (track: DemoTrackSpec, beatTicks: number): NoteEvent[] => {
  const defaultLen = track.role === "drums" ? 0.25 : 1
  return track.notes
    .map((n) => ({
      id: newId("n"),
      tick: Math.max(0, Math.round(n.beat * beatTicks)),
      duration: Math.max(1, Math.round((n.len ?? defaultLen) * beatTicks)),
      pitch: Math.max(0, Math.min(127, Math.round(resolvePitch(n)))),
      velocity: n.vel != null ? Math.max(0, Math.min(1, n.vel)) : 0.85,
    }))
    .sort((a, b) => a.tick - b.tick)
}

const VOICE_COLORS: Record<DemoTrackSpec["role"], string> = {
  drums: "#39e0ff",
  bass: "#5f9bff",
  mid: "#c66bff",
  lead: "#ffae5b",
}

/** Build the harmony block (scale + optional progression). */
const compileHarmony = (spec: DemoSongSpec, beatTicks: number): Harmony => {
  const base = defaultHarmony()
  const mode = getMode(spec.harmony.modeId)
  const harmony: Harmony = {
    ...base,
    tonic: ((spec.harmony.tonic % 12) + 12) % 12,
    scale: mode
      ? { family: mode.family, id: mode.id, tuning: "equal12" }
      : base.scale,
    mode: "modal",
    progression: [],
  }
  const chords = spec.harmony.chords ?? []
  const isChordal = spec.harmony.mode === "chordal" || chords.length > 0
  if (!isChordal) return harmony

  const progression: HarmonyChordEvent[] = chords
    .map((c) => ({
      id: newId("chd"),
      tick: Math.max(0, Math.round(c.beat * beatTicks)),
      symbol: c.symbol,
      durationTicks: c.lenBeats != null ? Math.max(1, Math.round(c.lenBeats * beatTicks)) : beatTicks,
    }))
    .sort((a, b) => a.tick - b.tick)
  return { ...harmony, mode: "chordal", progression }
}

/** Compile a track spec into an InstrumentTrack (drums or melodic). */
const compileTrack = (track: DemoTrackSpec, beatTicks: number): InstrumentTrack => {
  const grid = { denominator: (track.grid ?? 16) as GridDenominator }
  const notes = compileNotes(track, beatTicks)
  const patch = { color: VOICE_COLORS[track.role], grid, volume: track.volume ?? 0.8 }
  if (track.role === "drums") {
    return newInstrumentTrack(
      track.name,
      { kind: "drumSampler", pads: [], fallback: "synthKit", kitId: track.kitId },
      notes,
      patch
    )
  }
  const config = track.presetId ? instantiatePreset(track.presetId) : undefined
  return newInstrumentTrack(
    track.name,
    (config ?? synthPreset("triangle")) as InstrumentTrack["instrument"],
    notes,
    patch
  )
}

/**
 * Compile a demo spec into a SceneSnapshot. Throws if the spec is invalid (call
 * `validateDemo` first to surface friendly errors). A Phrases track is always
 * appended so the mixer's Phrases strip is present, matching the default doc.
 */
export const compileDemo = (spec: DemoSongSpec): SceneSnapshot => {
  const problems = validateDemo(spec)
  if (problems.length > 0) {
    throw new Error(`Invalid demo "${spec.id}": ${problems.join("; ")}`)
  }
  const beatTicks = beatTicksFor(spec.meter.denominator)
  const loopTicks = clampLoopTicks(
    Math.round(spec.bars * spec.meter.numerator * beatTicks)
  )
  const base: BeatloungeDoc = createDefaultDoc(0)
  const tracks = [
    ...spec.tracks.map((t) => compileTrack(t, beatTicks)),
    newFragmentTrack(),
  ]
  const doc: BeatloungeDoc = {
    ...base,
    bpm: spec.bpm,
    meterMap: [{ id: newId("m"), tick: 0, sig: spec.meter }],
    loopLengthTicks: loopTicks,
    tracks,
    harmony: compileHarmony(spec, beatTicks),
  }
  return captureSnapshot(doc)
}

/** Validate a demo spec; returns friendly problem strings ([] ⇒ valid). */
export const validateDemo = (spec: DemoSongSpec): string[] => {
  const problems: string[] = []
  if (!spec.id) problems.push("missing id")
  if (!spec.source) problems.push("missing source/attribution")
  if (!(spec.bpm > 0)) problems.push("bpm must be > 0")
  if (!(spec.meter?.numerator > 0) || !(spec.meter?.denominator > 0))
    problems.push("meter must be positive")
  if (!(spec.bars > 0)) problems.push("bars must be > 0")
  if (!getMode(spec.harmony?.modeId)) problems.push(`unknown modeId "${spec.harmony?.modeId}"`)
  if (spec.grooveId && !getRhythm(spec.grooveId)) problems.push(`unknown grooveId "${spec.grooveId}"`)
  if (!Array.isArray(spec.tracks) || spec.tracks.length === 0) {
    problems.push("at least one track is required")
  } else {
    for (const t of spec.tracks) {
      if (t.role === "drums") {
        if (t.kitId && !getKit(t.kitId)) problems.push(`unknown kitId "${t.kitId}"`)
      } else if (t.presetId && !getPreset(t.presetId)) {
        problems.push(`unknown presetId "${t.presetId}"`)
      }
      for (const n of t.notes ?? []) {
        if (t.role !== "drums" && typeof n.pitch !== "number") {
          problems.push(`melodic note in "${t.name}" missing pitch`)
          break
        }
      }
    }
  }
  return problems
}
