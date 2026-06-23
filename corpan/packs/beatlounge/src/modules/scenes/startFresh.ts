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
import type { Mode } from "../../music/modes/types"
import { corpusProgressionToHarmony } from "../../modules/composer/harmonyView"
import { pickRandomPresetForClass, type VoiceClass } from "../../instruments/random"
import { getPreset, instantiatePreset } from "../../instruments/presets"
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

/** The eight independently-lockable / rerollable facets of a fresh world. */
export type DraftFacet = "meter" | "tempo" | "key" | "kit" | "bass" | "mid" | "lead" | "groove"

/** A concrete, fully-resolved draft of a randomized world — every facet a real
 *  value (never "random"). The New form holds one of these, rerolls the unlocked
 *  facets into a fresh draft, and builds a snapshot from it. */
export interface DraftWorld {
  meter: TimeSignature
  bpm: number
  /** Tonic + mode + the chord symbols of a progression (empty ⇒ purely modal).
   *  Tick placement is deferred to build time so the key is meter-independent. */
  key: { tonic: number; mode: Mode; symbols: string[] }
  kitId: string
  /** Preset id per voice class (bass / mid / lead). */
  voices: Record<VoiceClass, string>
  grooveId: string
}

const VOICE_CLASSES: readonly VoiceClass[] = ["bass", "mid", "lead"]

/** Tempo for a draft: the groove's natural bpm when it has one, else a musical
 *  random in 80–130. Reads the groove so rerolling tempo alone (groove locked)
 *  still tracks the groove. */
const rollTempo = (rng: Rng, grooveId: string): number => {
  const rhythm = getRhythm(grooveId)
  return rhythm?.bpm && rhythm.bpm > 0 ? rhythm.bpm : 80 + Math.floor(rng() * 50)
}

/** A random key facet: tonic + mode + the chord symbols of a random progression. */
const rollKey = (rng: Rng): DraftWorld["key"] => {
  const tonic = Math.floor(rng() * 12) % 12
  const mode = pickRandomMode(rng)
  const prog = randomProgression(rng)
  const symbols = prog ? corpusProgressionToHarmony(prog, tonic).chords.map((c) => c.symbol) : []
  return { tonic, mode, symbols }
}

/**
 * Roll a fresh DraftWorld. With `from` + `lock`, the locked facets are carried
 * over unchanged and only the unlocked ones are rerolled — the one engine behind
 * both "reroll all" (lock = the user's locks) and per-facet reroll (lock =
 * everything but the one facet). Deterministic from `rng`.
 */
export const rollDraftWorld = (
  rng: Rng,
  opts: { from?: DraftWorld; lock?: ReadonlySet<DraftFacet> } = {}
): DraftWorld => {
  const { from, lock } = opts
  const kept = (f: DraftFacet): boolean => !!from && !!lock?.has(f)
  const grooveId = kept("groove") ? from!.grooveId : pickRandomRhythmId(rng)
  const meter = kept("meter") ? from!.meter : pickRandomMeter(rng)
  const bpm = kept("tempo") ? from!.bpm : rollTempo(rng, grooveId)
  const key = kept("key") ? from!.key : rollKey(rng)
  const kitId = kept("kit") ? from!.kitId : pickRandomKitId(rng)
  const voices: Record<VoiceClass, string> = {
    bass: kept("bass") ? from!.voices.bass : pickRandomPresetForClass(rng, "bass").id,
    mid: kept("mid") ? from!.voices.mid : pickRandomPresetForClass(rng, "mid").id,
    lead: kept("lead") ? from!.voices.lead : pickRandomPresetForClass(rng, "lead").id,
  }
  return { meter, bpm, key, kitId, voices, grooveId }
}

/** Build the empty-grid SceneSnapshot for a fully-resolved draft, plus the groove
 *  id the caller selects (that slice lives outside the doc). */
export const buildSnapshotFromDraft = (
  draft: DraftWorld
): { snapshot: SceneSnapshot; grooveId: string } => {
  const base = createDefaultDoc(0)
  const loopTicks = cycleTicks(draft.meter.numerator, draft.meter.denominator)
  const meterMap: MeterEvent[] = [{ id: newId("m"), tick: 0, sig: draft.meter }]

  // --- drums: keep the kind-named drum track, swap to the chosen kit, no notes ---
  const baseDrum = base.tracks[0] as InstrumentTrack
  const drumTrack: InstrumentTrack = {
    ...baseDrum,
    id: newId("trk"),
    instrument: { kind: "drumSampler", pads: [], fallback: "synthKit", kitId: draft.kitId },
    notes: [],
  }

  // --- three synth voices: bass / mid / lead, each the chosen preset ---
  const voiceTracks = VOICE_CLASSES.map((voiceClass) => {
    const id = draft.voices[voiceClass]
    const preset = getPreset(id)
    // Preset configs are always melodic instruments (never ttsFragment), so the
    // narrowing to InstrumentTrack["instrument"] is sound.
    const config = (instantiatePreset(id) ?? preset?.config) as InstrumentTrack["instrument"]
    return newInstrumentTrack(preset?.name ?? id, config, [], { color: VOICE_COLORS[voiceClass] })
  })

  const harmony = buildHarmonyFromKey(draft.key, loopTicks)

  const doc: BeatloungeDoc = {
    ...base,
    bpm: draft.bpm,
    meterMap,
    loopLengthTicks: loopTicks,
    tracks: [drumTrack, ...voiceTracks, newFragmentTrack()],
    harmony,
  }
  return { snapshot: captureSnapshot(doc), grooveId: draft.grooveId }
}

/**
 * Build a randomized "world": three synth voices, a drum kit, a key/scale/
 * progression, and a meter — all empty of notes. Returns the snapshot plus the
 * groove id the caller should select. Deterministic from `rngOrSeed`. Thin
 * wrapper over rollDraftWorld → buildSnapshotFromDraft (the all-random path).
 */
export const buildRandomSnapshot = (
  rngOrSeed: Rng | number
): { snapshot: SceneSnapshot; grooveId: string } => {
  const rng: Rng = typeof rngOrSeed === "number" ? makeRng(rngOrSeed) : rngOrSeed
  return buildSnapshotFromDraft(rollDraftWorld(rng))
}

/**
 * A key's harmony for a given loop length. The progression's chord SYMBOLS are
 * spread evenly across the loop so it fits ANY meter (a 4-chord loop in 13/8 is
 * four equal slices); no symbols ⇒ a purely modal key.
 */
const buildHarmonyFromKey = (key: DraftWorld["key"], loopTicks: number): Harmony => {
  const base = defaultHarmony()
  const harmony: Harmony = {
    ...base,
    mode: "modal",
    tonic: key.tonic,
    scale: { family: key.mode.family, id: key.mode.id, tuning: "equal12" },
    progression: [],
  }
  if (key.symbols.length === 0) return harmony

  const slice = Math.max(1, Math.round(loopTicks / key.symbols.length))
  const progression: HarmonyChordEvent[] = key.symbols.map((symbol, i) => ({
    id: newId("chd"),
    tick: Math.min(loopTicks - 1, Math.round((i * loopTicks) / key.symbols.length)),
    symbol,
    durationTicks: slice,
  }))
  return { ...harmony, mode: "chordal", progression }
}
