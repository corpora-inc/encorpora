/**
 * beatlounge — JAM composer tests. The generative heart: determinism by seed,
 * harmony-locked strong beats (it spells the changes), voice-leading sanity,
 * non-repetition across phrases, and that re-roll/evolve actually vary.
 */

import { describe, expect, it } from "vitest"
import { jam, jamCycle, evolveSeed, progressionTicks, defaultJamOptions, type JamOptions } from "./jam"
import { parseProgression, type Progression } from "./progression"
import { renderTemplate } from "./templates"
import { chordAtBeat } from "./progression"
import { toPc } from "./harmony"
import { PPQ } from "../model/timing"

const PROG = parseProgression("Dmin,,,,Gmin,,,,A7,,,,Dmin,,,,")
const POP = renderTemplate("pop", 0, "major")

const opts = (patch: Partial<JamOptions> = {}): JamOptions => ({
  ...defaultJamOptions(),
  ...patch,
})

/** The chord pcs sounding at a tick's beat. */
const chordPcsAtTick = (prog: Progression, tick: number): number[] => {
  const beat = Math.floor(tick / PPQ)
  const tc = chordAtBeat(prog, beat)
  return tc ? tc.chord.pcs.map(toPc) : []
}

describe("determinism", () => {
  it("same (prog, seed, opts) ⇒ identical notes", () => {
    for (const feel of ["melody", "arp", "chords", "bass"] as const) {
      const a = jam(PROG, opts({ feel, seed: 99 }))
      const b = jam(PROG, opts({ feel, seed: 99 }))
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    }
  })
  it("a different seed yields different material (re-roll)", () => {
    const a = jam(PROG, opts({ feel: "melody", seed: 1 }))
    const b = jam(PROG, opts({ feel: "melody", seed: 2 }))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe("validity", () => {
  it("every feel emits in-range MIDI + positive durations + sane velocity", () => {
    for (const feel of ["melody", "arp", "chords", "bass"] as const) {
      const notes = jam(POP, opts({ feel, seed: 7, density: 0.7 }))
      expect(notes.length).toBeGreaterThan(0)
      for (const n of notes) {
        expect(n.pitch).toBeGreaterThanOrEqual(0)
        expect(n.pitch).toBeLessThanOrEqual(127)
        expect(n.duration).toBeGreaterThan(0)
        expect(n.velocity).toBeGreaterThan(0)
        expect(n.velocity).toBeLessThanOrEqual(1)
        expect(Number.isInteger(n.tick)).toBe(true)
        expect(n.tick).toBeGreaterThanOrEqual(0)
      }
    }
  })
  it("notes stay within the progression's length", () => {
    const notes = jam(PROG, opts({ feel: "arp", seed: 3 }))
    const limit = progressionTicks(PROG)
    for (const n of notes) expect(n.tick).toBeLessThan(limit)
  })
  it("an empty progression yields no notes", () => {
    expect(jam(parseProgression(""), opts())).toHaveLength(0)
  })
})

describe("harmony-locked", () => {
  it("melody downbeats land on chord tones (spells the changes)", () => {
    const notes = jam(PROG, opts({ feel: "melody", seed: 5, density: 0.6 }))
    const downbeats = notes.filter((n) => n.tick % PPQ === 0)
    expect(downbeats.length).toBeGreaterThan(0)
    for (const n of downbeats) {
      const pcs = chordPcsAtTick(PROG, n.tick)
      expect(pcs).toContain(toPc(n.pitch))
    }
  })
  it("chords comping is built ONLY from chord tones", () => {
    const notes = jam(PROG, opts({ feel: "chords", seed: 8 }))
    for (const n of notes) {
      const pcs = chordPcsAtTick(PROG, n.tick)
      // The comp may push notes onto a weak beat of the SAME chord; pc must fit.
      if (pcs.length) expect(pcs).toContain(toPc(n.pitch))
    }
  })
  it("bass downbeats are the chord root", () => {
    const notes = jam(PROG, opts({ feel: "bass", seed: 2, density: 0.5 }))
    for (const tc of PROG.chords) {
      const tick = tc.startBeat * PPQ
      const hit = notes.find((n) => n.tick === tick)
      expect(hit).toBeTruthy()
      expect(toPc(hit!.pitch)).toBe(toPc(tc.chord.root))
    }
  })
})

describe("voice-leading sanity", () => {
  it("the arp moves mostly in small steps (no random confetti)", () => {
    const notes = jam(POP, opts({ feel: "arp", seed: 4 }))
    const leaps: number[] = []
    for (let i = 1; i < notes.length; i++) {
      leaps.push(Math.abs(notes[i].pitch - notes[i - 1].pitch))
    }
    // The TYPICAL (median) note-to-note motion is a small interval — an arp that
    // climbs a ladder, not a random spray. (Chord boundaries may leap an octave.)
    const sorted = [...leaps].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    expect(median).toBeLessThanOrEqual(7)
    // No single leap exceeds ~1.5 octaves (the ladder span).
    expect(Math.max(...leaps)).toBeLessThanOrEqual(20)
  })
  it("comp voicings move smoothly chord-to-chord (top voice within a fifth)", () => {
    const notes = jam(POP, opts({ feel: "chords", seed: 6 }))
    // Top voice per chord-onset tick.
    const tops: number[] = []
    for (const tc of POP.chords) {
      const at = notes.filter((n) => n.tick === tc.startBeat * PPQ)
      if (at.length) tops.push(Math.max(...at.map((n) => n.pitch)))
    }
    for (let i = 1; i < tops.length; i++) {
      expect(Math.abs(tops[i] - tops[i - 1])).toBeLessThanOrEqual(8)
    }
  })
})

describe("non-repetition", () => {
  it("the melody is not a single repeated motif verbatim across phrases", () => {
    // Compare the pitch contour of the first chord-span vs the third; a directed
    // jam varies them (transform + arc), so they must NOT be identical.
    const notes = jam(PROG, opts({ feel: "melody", seed: 11, density: 0.6 }))
    const span = (idx: number) => {
      const tc = PROG.chords[idx]
      return notes
        .filter((n) => n.tick >= tc.startBeat * PPQ && n.tick < (tc.startBeat + tc.beats) * PPQ)
        .map((n) => n.pitch)
    }
    const s0 = span(0)
    const s2 = span(2)
    expect(s0.length).toBeGreaterThan(0)
    expect(s2.length).toBeGreaterThan(0)
    expect(JSON.stringify(s0)).not.toBe(JSON.stringify(s2))
  })
  it("density controls how many notes appear", () => {
    const sparse = jam(POP, opts({ feel: "melody", seed: 3, density: 0.1 }))
    const dense = jam(POP, opts({ feel: "melody", seed: 3, density: 0.95 }))
    expect(dense.length).toBeGreaterThan(sparse.length)
  })
  it("register shifts the part up/down", () => {
    const low = jam(POP, opts({ feel: "melody", seed: 3, register: 48 }))
    const high = jam(POP, opts({ feel: "melody", seed: 3, register: 72 }))
    const avg = (ns: { pitch: number }[]) => ns.reduce((a, n) => a + n.pitch, 0) / ns.length
    expect(avg(high)).toBeGreaterThan(avg(low))
  })
})

describe("keep-jamming seam", () => {
  it("evolveSeed advances by a fixed, related step", () => {
    expect(evolveSeed(1)).not.toBe(1)
    expect(evolveSeed(1)).toBe(evolveSeed(1)) // deterministic
  })
  it("jamCycle returns notes + the next seed; successive cycles differ", () => {
    const c1 = jamCycle(PROG, opts({ feel: "melody", seed: 100 }))
    const c2 = jamCycle(PROG, opts({ feel: "melody", seed: c1.nextSeed }))
    expect(c1.notes.length).toBeGreaterThan(0)
    expect(c1.nextSeed).not.toBe(100)
    expect(JSON.stringify(c1.notes)).not.toBe(JSON.stringify(c2.notes))
  })
})
