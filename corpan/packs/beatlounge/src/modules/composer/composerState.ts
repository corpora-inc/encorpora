/**
 * beatlounge — composer (Harmony bar) state + the "jam onto the synth" bridge.
 *
 * Harmony itself (tonic / mode / chord timeline) now lives at the TOP LEVEL on
 * `doc.harmony` and is edited through the harmony commands — this module no
 * longer owns key/mode or a chord text field. What stays composer-local is the
 * PERFORMANCE of generating notes from the global harmony onto the bound synth:
 * the feel (melody/arp/chords/bass), density, and seed. `composeFromHarmony`
 * turns the current `doc.harmony` (chord timeline OR modal scale) into a
 * `setNotes` for the synth — pure + deterministic for a given seed.
 */

import type { Command } from "../../model/command"
import type { BeatloungeDoc, Id } from "../../model/document"
import { docHarmony } from "../../model/document"
import { PPQ } from "../../model/timing"
import { parseChord, diatonicTriads, toPc, type ScaleName } from "../../music/harmony"
import { progressionFromChords, type Progression } from "../../music/progression"
import { jam, progressionTicks, evolveSeed, type JamFeel } from "../../music/jam"
import { MODES_BY_FAMILY } from "../../music/modes"
import { loopBeats, beatsPerBar } from "./harmonyView"

export const COMPOSER_FEELS: readonly JamFeel[] = ["melody", "arp", "chords", "bass"]

/** Performance settings (NOT harmony — these shape the generated notes). */
export interface ComposerSettings {
  feel: JamFeel
  density: number
  seed: number
}

export const defaultComposerSettings = (): ComposerSettings => ({
  feel: "melody",
  density: 0.55,
  seed: 1,
})

/** Map a feel to a register (octave anchor) so each part sits where it belongs. */
export const registerForFeel = (feel: JamFeel): number =>
  feel === "bass" ? 48 : feel === "chords" ? 57 : 62

/**
 * Build a jam `Progression` from the GLOBAL harmony:
 *  - chordal: the tick-addressed chord timeline → chords with beat durations.
 *  - modal:   the modal scale's diatonic triads laid one-per-bar (so "modal"
 *    still produces a musical jam without a chord timeline).
 * Returns null when there is nothing to play (chordal with no chords).
 */
export const harmonyToProgression = (doc: BeatloungeDoc): Progression | null => {
  const h = docHarmony(doc)
  if (h.mode === "chordal") {
    if (h.progression.length === 0) return null
    const beats = loopBeats(doc)
    const items: { chord: ReturnType<typeof parseChord>; beats: number; token: string }[] = []
    const sorted = [...h.progression].sort((a, b) => a.tick - b.tick)
    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i]
      const startBeat = Math.round(ev.tick / PPQ)
      const endBeat =
        i + 1 < sorted.length ? Math.round(sorted[i + 1].tick / PPQ) : beats
      const chord = parseChord(ev.symbol)
      if (!chord) continue
      items.push({ chord, beats: Math.max(1, endBeat - startBeat), token: ev.symbol })
    }
    const valid = items.filter((it) => it.chord) as {
      chord: NonNullable<ReturnType<typeof parseChord>>
      beats: number
      token: string
    }[]
    if (valid.length === 0) return null
    return progressionFromChords(valid)
  }

  // Modal: lay the modal scale's diatonic triads one per bar (Western families
  // map cleanly to triads; world families fall back to a Western minor/major).
  const scaleName = westernScaleNameFor(doc)
  const triads = diatonicTriads(toPc(h.tonic), scaleName)
  const bpb = beatsPerBar(doc)
  const bars = Math.max(1, Math.ceil(loopBeats(doc) / bpb))
  const items = Array.from({ length: bars }, (_, i) => ({
    chord: triads[i % triads.length],
    beats: bpb,
    token: triads[i % triads.length].symbol,
  }))
  return progressionFromChords(items)
}

/**
 * Map the global modal scale onto the closest Western `ScaleName` the jam
 * generator understands (it voice-leads over 12-TET Western modes). World
 * families degrade to major/minor by their third — enough to drive a tasteful
 * jam; the LOCKED pitches still come from the resolver, not this fallback.
 */
const westernScaleNameFor = (doc: BeatloungeDoc): ScaleName => {
  const h = docHarmony(doc)
  if (h.scale.family === "western") {
    const id = h.scale.id.replace(/^western\./, "")
    const MAP: Record<string, ScaleName> = {
      ionian: "major",
      aeolian: "minor",
      dorian: "dorian",
      phrygian: "phrygian",
      lydian: "lydian",
      mixolydian: "mixolydian",
      locrian: "locrian",
      harmonicMinor: "harmonicMinor",
      melodicMinor: "melodicMinor",
      majorPentatonic: "majorPentatonic",
      minorPentatonic: "minorPentatonic",
      blues: "blues",
      wholeTone: "wholeTone",
      chromatic: "chromatic",
    }
    return MAP[id] ?? "major"
  }
  // World family → major if its 3rd is major-ish, else minor.
  const mode = MODES_BY_FAMILY[h.scale.family].find((m) => m.id === h.scale.id)
  const thirdCents = mode?.degrees[2]?.cents ?? 400
  return thirdCents >= 350 ? "major" : "minor"
}

/**
 * Compose the current harmony onto `trackId`: size the loop to the progression
 * and replace the synth's notes with the generated jam. Pure + deterministic
 * for a given seed. Returns the commands the caller applies in one undo step.
 */
export const composeFromHarmony = (
  doc: BeatloungeDoc,
  s: ComposerSettings,
  trackId: Id
): { commands: Command[]; noteCount: number; chordCount: number } => {
  const prog = harmonyToProgression(doc)
  if (!prog || prog.chords.length === 0) return { commands: [], noteCount: 0, chordCount: 0 }
  const notes = jam(prog, {
    feel: s.feel,
    density: s.density,
    register: registerForFeel(s.feel),
    seed: s.seed || 1,
    velocity: 0.72,
  })
  if (notes.length === 0) return { commands: [], noteCount: 0, chordCount: prog.chords.length }
  return {
    commands: [
      { t: "setLoopLength", ticks: progressionTicks(prog) },
      { t: "setNotes", trackId, notes },
    ],
    noteCount: notes.length,
    chordCount: prog.chords.length,
  }
}

/** A fresh random seed for "re-roll" (unrelated new material). */
export const rollSeed = (): number => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1

/** "Evolve" — a small related step from the current seed (varied but coherent). */
export const nextEvolveSeed = (seed: number): number => evolveSeed(seed)
