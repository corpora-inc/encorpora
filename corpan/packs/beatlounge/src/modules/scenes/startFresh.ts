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

/** Parse a corpus time-signature label ("13/8", "4/4") into a TimeSignature. */
const parseTimeSig = (label: string): TimeSignature => {
  const [n, d] = label.split("/").map((x) => Number.parseInt(x, 10))
  const numerator = Number.isFinite(n) && n > 0 ? n : 4
  const denominator = Number.isFinite(d) && d > 0 ? d : 4
  return { numerator, denominator }
}

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

  // --- groove → meter, tempo, loop length (the "random N beats / 13/8" knob) ---
  const grooveId = pickRandomRhythmId(rng)
  const rhythm = getRhythm(grooveId)
  const sig = rhythm ? parseTimeSig(rhythm.timeSig) : { numerator: 4, denominator: 4 }
  const loopTicks = rhythm ? cycleTicks(rhythm.beats, sig.denominator) : base.loopLengthTicks
  const bpm = rhythm?.bpm && rhythm.bpm > 0 ? rhythm.bpm : base.bpm
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
