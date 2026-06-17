/**
 * beatlounge — "Start fresh" SNAPSHOT BUILDERS.
 *
 * Three ways to wipe the slate and begin again, each producing a SceneSnapshot
 * the controller applies via the `loadScene` command (one undoable step):
 *
 *   - buildEmptySnapshot()        → the fixed empty default (Clear).
 *   - buildRandomSnapshot(rng)    → an empty grid but randomized instruments,
 *                                   kit, harmony and meter (Randomize / "new").
 *   - (demos live in ./demos)     → a shipped starter song dropped on the grid.
 *
 * "Empty grid" is the through-line: every builder here returns NO notes, so
 * pressing play is silence until the user (or the +/− dial, or a demo) adds
 * content. Randomize sets up the *world* — three synth voices (bass / mid /
 * lead), a drum kit, a key + scale + progression, and a time signature taken
 * from a randomly chosen world groove — without committing a single note.
 *
 * Pure + seeded: every random choice flows from the injected `Rng`, so a roll
 * is fully reproducible (tests pass a fixed seed). The chosen groove id is
 * returned alongside the snapshot because the selected-groove slice lives
 * OUTSIDE the doc (localStorage), so the caller applies it as a side effect.
 */

import {
  createDefaultDoc,
  defaultHarmony,
  newFragmentTrack,
  newInstrumentTrack,
  type BeatloungeDoc,
  type Harmony,
  type HarmonyChordEvent,
  type InstrumentTrack,
  type MeterEvent,
  type TimeSignature,
} from "../../model/document"
import { newId } from "../../model/ids"
import { PPQ, clampLoopTicks } from "../../model/timing"
import { captureSnapshot, type SceneSnapshot } from "../../model/snapshot"
import { makeRng, randomProgression, type Rng } from "../../music/chords/random"
import { pickRandomMode } from "../../music/modes/random"
import { corpusProgressionToHarmony } from "../../modules/composer/harmonyView"
import { pickRandomPresetForClass, type VoiceClass } from "../../instruments/random"
import { instantiatePreset } from "../../instruments/presets"
import { pickRandomKitId } from "../../kits/random"
import { getRhythm } from "../../rhythm"
import { pickRandomRhythmId } from "../grooves/randomRhythm"

/** The fixed EMPTY default — the same blank slate the app boots with. */
export const buildEmptySnapshot = (): SceneSnapshot =>
  captureSnapshot(createDefaultDoc(0))

// A fresh random world shouldn't always be 4/4 — randomize the TIME SIGNATURE
// and the beat count directly, surfacing odd meters (5/4, 7/8, 13/8…) too. The
// common meters are weighted up so it stays musical, not pure chaos.
const METER_NUMERATORS = [2, 3, 4, 4, 4, 5, 6, 6, 7, 9, 11, 12, 13] as const
const METER_DENOMINATORS = [4, 4, 8] as const

const pickRandomMeter = (rng: Rng): TimeSignature => ({
  numerator: METER_NUMERATORS[Math.min(METER_NUMERATORS.length - 1, Math.floor(rng() * METER_NUMERATORS.length))],
  denominator: METER_DENOMINATORS[Math.min(METER_DENOMINATORS.length - 1, Math.floor(rng() * METER_DENOMINATORS.length))],
})

/** Ticks in one cycle of `beats` beats at the given meter denominator. */
const cycleTicks = (beats: number, denominator: number): number => {
  const beatTicks = (4 * PPQ) / denominator // a 1/denominator beat in ticks
  return clampLoopTicks(Math.round(beats * beatTicks))
}

/** A small, readable palette for the randomized voice tracks. */
const VOICE_COLORS: Record<VoiceClass, string> = {
  bass: "#5f9bff",
  mid: "#c66bff",
  lead: "#ffae5b",
}

/**
 * Build a randomized "world": three synth voices, a drum kit, a key/scale/
 * progression, and a meter — all empty of notes. Returns the snapshot plus the
 * groove id the caller should select (the selected-groove slice is not on the
 * doc). Deterministic from `rngOrSeed`.
 */
export const buildRandomSnapshot = (
  rngOrSeed: Rng | number
): { snapshot: SceneSnapshot; grooveId: string } => {
  const rng: Rng = typeof rngOrSeed === "number" ? makeRng(rngOrSeed) : rngOrSeed
  const base = createDefaultDoc(0)

  // --- random time signature + beat count, tempo, loop length ---
  // Meter is randomized OUTRIGHT (not inherited from the groove, which is almost
  // always 4/4) so a fresh world genuinely varies — 5/4, 7/8, 13/8 and friends.
  // The groove is still rolled to seed the +/− dial and suggest a tempo.
  const grooveId = pickRandomRhythmId(rng)
  const rhythm = getRhythm(grooveId)
  const sig = pickRandomMeter(rng)
  const loopTicks = cycleTicks(sig.numerator, sig.denominator) // one bar of the meter
  const bpm = rhythm?.bpm && rhythm.bpm > 0 ? rhythm.bpm : 80 + Math.floor(rng() * 50)
  const meterMap: MeterEvent[] = [{ id: newId("m"), tick: 0, sig }]

  // --- drums: keep the kind-named drum track, swap to a random kit, no notes ---
  const baseDrum = base.tracks[0] as InstrumentTrack
  const drumTrack: InstrumentTrack = {
    ...baseDrum,
    id: newId("trk"),
    instrument: { kind: "drumSampler", pads: [], fallback: "synthKit", kitId: pickRandomKitId(rng) },
    notes: [],
  }

  // --- three synth voices: one bass, one mid, one lead — random within class ---
  const classes: VoiceClass[] = ["bass", "mid", "lead"]
  const voiceTracks = classes.map((voiceClass) => {
    const preset = pickRandomPresetForClass(rng, voiceClass)
    // Preset configs are always melodic instruments (never ttsFragment), so the
    // narrowing to InstrumentTrack["instrument"] is sound.
    const config = (instantiatePreset(preset.id) ?? preset.config) as InstrumentTrack["instrument"]
    return newInstrumentTrack(preset.name, config, [], { color: VOICE_COLORS[voiceClass] })
  })

  // --- harmony: random tonic + scale, with a random progression spread to fit ---
  const harmony = buildRandomHarmony(rng, loopTicks)

  const doc: BeatloungeDoc = {
    ...base,
    bpm,
    meterMap,
    loopLengthTicks: loopTicks,
    tracks: [drumTrack, ...voiceTracks, newFragmentTrack()],
    harmony,
  }
  return { snapshot: captureSnapshot(doc), grooveId }
}

/**
 * A random key + scale + chord progression. The progression's chord SYMBOLS are
 * spread evenly across the loop so it fits ANY meter (a 4-chord loop in 13/8 is
 * four equal slices), keeping the result coherent regardless of the groove.
 */
const buildRandomHarmony = (rng: Rng, loopTicks: number): Harmony => {
  const tonic = Math.floor(rng() * 12) % 12
  const mode = pickRandomMode(rng)
  const base = defaultHarmony()
  const harmony: Harmony = {
    ...base,
    mode: "modal",
    tonic,
    scale: { family: mode.family, id: mode.id, tuning: "equal12" },
    progression: [],
  }

  const prog = randomProgression(rng)
  if (!prog) return harmony
  const symbols = corpusProgressionToHarmony(prog, tonic).chords.map((c) => c.symbol)
  if (symbols.length === 0) return harmony

  const slice = Math.max(1, Math.round(loopTicks / symbols.length))
  const progression: HarmonyChordEvent[] = symbols.map((symbol, i) => ({
    id: newId("chd"),
    tick: Math.min(loopTicks - 1, Math.round((i * loopTicks) / symbols.length)),
    symbol,
    durationTicks: slice,
  }))
  return { ...harmony, mode: "chordal", progression }
}
