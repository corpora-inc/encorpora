/**
 * beatlounge — chord-progressions corpus + chord API tests.
 *
 * Covers: chord-quality interval correctness, degree→pitch-class resolution,
 * MIDI/voicing/inversion, transposition, canonical-progression pitch-class
 * expansion, tick-addressed chord events, seeded-random determinism, and a
 * freshness/sanity guard on the ~1000-entry corpus (count, uniqueness,
 * well-formedness, and IP-safety — no naming).
 */

import { describe, expect, it } from "vitest"
import { PPQ } from "../../model/timing"
import { mod, toPc } from "../harmony"
import {
  QUALITY_INTERVALS,
  chordRootPc,
  chordRootOffset,
  chordPcs,
} from "./qualities"
import {
  chordToMidi,
  midiForPc,
  applyInversion,
  voiceChord,
  transposeToKey,
  progressionBeats,
  progressionToChordEvents,
} from "./chordApi"
import {
  CORPUS,
  getProgression,
  listByFamily,
  listByTag,
  familyCounts,
  allTags,
} from "./corpus"
import { makeRng, randomProgression } from "./random"
import type { CorpusChord, CorpusChordQuality } from "./types"
import { FAMILIES } from "./types"

// ---------------------------------------------------------------- qualities
describe("chord-quality interval tables", () => {
  it("expands every quality to the correct semitone set", () => {
    const expected: Record<CorpusChordQuality, number[]> = {
      maj: [0, 4, 7],
      min: [0, 3, 7],
      dim: [0, 3, 6],
      aug: [0, 4, 8],
      sus2: [0, 2, 7],
      sus4: [0, 5, 7],
      maj7: [0, 4, 7, 11],
      min7: [0, 3, 7, 10],
      dom7: [0, 4, 7, 10],
      dim7: [0, 3, 6, 9],
      m7b5: [0, 3, 6, 10],
      minMaj7: [0, 3, 7, 11],
      maj6: [0, 4, 7, 9],
      min6: [0, 3, 7, 9],
      six9: [0, 4, 7, 9, 14],
      dom9: [0, 4, 7, 10, 14],
      maj9: [0, 4, 7, 11, 14],
      min9: [0, 3, 7, 10, 14],
      dom11: [0, 7, 10, 14, 17],
      min11: [0, 3, 7, 10, 14, 17],
      dom13: [0, 4, 7, 10, 14, 21],
      maj13: [0, 4, 7, 11, 14, 21],
      add9: [0, 4, 7, 14],
      altered: [0, 4, 10, 13, 15],
      five: [0, 7],
    }
    for (const q of Object.keys(expected) as CorpusChordQuality[]) {
      expect(QUALITY_INTERVALS[q]).toEqual(expected[q])
    }
  })

  it("starts every quality on the root (0) and is ascending", () => {
    for (const ivs of Object.values(QUALITY_INTERVALS)) {
      expect(ivs[0]).toBe(0)
      for (let i = 1; i < ivs.length; i++) expect(ivs[i]).toBeGreaterThan(ivs[i - 1])
    }
  })
})

// ---------------------------------------------------------------- degrees
describe("degree → pitch-class resolution", () => {
  it("resolves major diatonic degrees against C major", () => {
    // C major scale roots: C D E F G A B
    const roots = [0, 2, 4, 5, 7, 9, 11]
    roots.forEach((pc, deg) => {
      const ch: CorpusChord = { degree: deg, quality: "maj", roman: "x" }
      expect(chordRootPc(ch, 0, "major")).toBe(pc)
    })
  })

  it("resolves minor diatonic degrees against A minor (tonic 9)", () => {
    // A natural minor: A B C D E F G
    const roots = [9, 11, 0, 2, 4, 5, 7]
    roots.forEach((pc, deg) => {
      const ch: CorpusChord = { degree: deg, quality: "min", roman: "x" }
      expect(chordRootPc(ch, 9, "minor")).toBe(pc)
    })
  })

  it("honors an explicit chromatic rootSemitone (bVII) over degree", () => {
    const bVII: CorpusChord = { rootSemitone: 10, quality: "maj", roman: "bVII", degree: 0 }
    expect(chordRootPc(bVII, 0, "major")).toBe(10) // Bb in C
    expect(chordRootOffset(bVII, "major")).toBe(10)
  })

  it("applies an accidental shift to a diatonic root", () => {
    // degree 6 (B) flattened → Bb = 10
    const ch: CorpusChord = { degree: 6, accidental: -1, quality: "maj", roman: "bVII" }
    expect(chordRootPc(ch, 0, "major")).toBe(10)
  })

  it("expands chordPcs of V7 in C to G B D F", () => {
    const V7: CorpusChord = { degree: 4, quality: "dom7", roman: "V7" }
    expect(chordPcs(V7, 0, "major").map(toPc).sort((a, b) => a - b)).toEqual(
      [2, 5, 7, 11]
    )
  })
})

// ---------------------------------------------------------------- midi/voicing
describe("chordToMidi + voicing + inversion", () => {
  it("places I (C major) at octave 3 as 48 52 55", () => {
    const I: CorpusChord = { degree: 0, quality: "maj", roman: "I" }
    expect(chordToMidi(I, 0, 3, "major")).toEqual([48, 52, 55])
  })

  it("midiForPc puts C3 at 48 and A4 at 69", () => {
    expect(midiForPc(0, 3)).toBe(48)
    expect(midiForPc(9, 4)).toBe(69) // A4 = 69 (concert A)
  })

  it("first inversion of C major raises the root an octave", () => {
    expect(applyInversion([48, 52, 55], 1)).toEqual([52, 55, 60])
  })

  it("second inversion of C major puts the 5th in the bass", () => {
    expect(applyInversion([48, 52, 55], 2)).toEqual([55, 60, 64])
  })

  it("drop2 voicing lowers the 2nd-from-top voice an octave", () => {
    const Cmaj7: CorpusChord = { degree: 0, quality: "maj7", roman: "Imaj7" }
    const close = chordToMidi(Cmaj7, 0, 3, "major") // 48 52 55 59
    const drop2 = voiceChord(Cmaj7, 0, { octave: 3, mode: "major", style: "drop2" })
    // 2nd-highest (55) dropped to 43, re-sorted.
    expect(drop2).toEqual([43, 48, 52, 59])
    expect(close).toEqual([48, 52, 55, 59])
  })

  it("voiceChord caps to maxVoices", () => {
    const V13: CorpusChord = { degree: 4, quality: "dom13", roman: "V13" }
    const v = voiceChord(V13, 0, { maxVoices: 4 })
    expect(v.length).toBe(4)
  })
})

// ---------------------------------------------------------------- transpose
describe("transposition is key-agnostic", () => {
  it("the SAME progression voices in any key by changing keyRoot", () => {
    const p = getProgression("cadence:maj:authentic")!
    const inC = progressionToChordEvents(p, { keyRoot: 0 })
    const inG = progressionToChordEvents(p, { keyRoot: 7 })
    // Every note in G is exactly a fifth (7 semitones) above the C version.
    inC.forEach((evC, i) => {
      evC.notes.forEach((n, j) => {
        expect(mod(inG[i].notes[j] - n, 12)).toBe(7)
      })
    })
  })

  it("transposeToKey binds and clamps the key root", () => {
    const p = getProgression("cadence:maj:authentic")!
    expect(transposeToKey(p, 19).keyRoot).toBe(7) // 19 mod 12 = 7
  })

  it("ii-V-I in C expands to the right pitch-class sets", () => {
    const p = getProgression("cadence:maj:ii7-V7-I")!
    const ev = progressionToChordEvents(p, { keyRoot: 0, maxVoices: 4 })
    const pcSet = (ns: number[]) => [...new Set(ns.map(toPc))].sort((a, b) => a - b)
    // ii7 = Dm7 (D F A C), V7 = G7 (G B D F), Imaj7 = Cmaj7 (C E G B)
    expect(pcSet(ev[0].notes)).toEqual([0, 2, 5, 9])
    expect(pcSet(ev[1].notes)).toEqual([2, 5, 7, 11])
    expect(pcSet(ev[2].notes)).toEqual([0, 4, 7, 11])
  })
})

// ---------------------------------------------------------------- events
describe("progressionToChordEvents (tick-addressed)", () => {
  it("aligns to the document PPQ and is contiguous", () => {
    const p = getProgression("pop-loop:axis:rot0:I-V-vi-IV")!
    const ev = progressionToChordEvents(p)
    expect(ev.length).toBe(4)
    expect(ev[0].startTick).toBe(0)
    expect(ev[0].durationTicks).toBe(4 * PPQ) // 4 beats
    // contiguous
    for (let i = 1; i < ev.length; i++) {
      expect(ev[i].startTick).toBe(ev[i - 1].startTick + ev[i - 1].durationTicks)
    }
    expect(ev[ev.length - 1].startTick + ev[ev.length - 1].durationTicks).toBe(
      progressionBeats(p) * PPQ
    )
  })

  it("respects a custom ppq", () => {
    const p = getProgression("cadence:maj:authentic")!
    const ev = progressionToChordEvents(p, { ppq: 480 })
    expect(ev[0].durationTicks).toBe(4 * 480)
  })

  it("honors per-chord beat arrays (12-bar blues = 48 beats)", () => {
    const p = getProgression("blues:12bar:basic")!
    expect(p.degrees.length).toBe(12)
    expect(progressionBeats(p)).toBe(48)
  })
})

// ---------------------------------------------------------------- random
describe("seeded random selection is deterministic", () => {
  it("same seed → same pick", () => {
    const a = randomProgression(12345)
    const b = randomProgression(12345)
    expect(a?.id).toBe(b?.id)
  })

  it("different seeds generally differ", () => {
    const ids = new Set<string>()
    for (let s = 0; s < 50; s++) ids.add(randomProgression(s)!.id)
    expect(ids.size).toBeGreaterThan(10)
  })

  it("an Rng function stream is reproducible", () => {
    const r1 = makeRng(7)
    const r2 = makeRng(7)
    expect(randomProgression(r1)?.id).toBe(randomProgression(r2)?.id)
  })

  it("filters by family", () => {
    const p = randomProgression(99, { family: "blues" })
    expect(p?.family).toBe("blues")
  })

  it("filters by tag", () => {
    const p = randomProgression(3, { tags: ["andalusian"] })
    expect(p?.tags).toContain("andalusian")
  })

  it("returns undefined for an impossible filter", () => {
    const p = randomProgression(1, { tags: ["no-such-tag-xyz"] })
    expect(p).toBeUndefined()
  })
})

// ---------------------------------------------------------------- listing
describe("corpus listing API", () => {
  it("getProgression round-trips ids", () => {
    for (const sample of ["cadence:maj:authentic", "andalusian:i-bVII-bVI-V"]) {
      expect(getProgression(sample)?.id).toBe(sample)
    }
    expect(getProgression("does-not-exist")).toBeUndefined()
  })

  it("listByFamily returns only that family", () => {
    const blues = listByFamily("blues")
    expect(blues.length).toBeGreaterThan(0)
    expect(blues.every((p) => p.family === "blues")).toBe(true)
  })

  it("listByTag returns entries carrying the tag", () => {
    const tritone = listByTag("tritone-sub")
    expect(tritone.length).toBeGreaterThan(0)
    expect(tritone.every((p) => p.tags.includes("tritone-sub"))).toBe(true)
  })
})

// ---------------------------------------------------------------- freshness
describe("corpus freshness / sanity", () => {
  it("has roughly ~1000 entries", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(900)
    expect(CORPUS.length).toBeLessThanOrEqual(1300)
  })

  it("every id is unique", () => {
    const ids = new Set(CORPUS.map((p) => p.id))
    expect(ids.size).toBe(CORPUS.length)
  })

  it("every entry is well-formed", () => {
    const validQ = new Set(Object.keys(QUALITY_INTERVALS))
    for (const p of CORPUS) {
      expect(p.degrees.length).toBeGreaterThanOrEqual(2)
      expect(FAMILIES).toContain(p.family)
      expect(p.tags.length).toBeGreaterThan(0)
      for (const ch of p.degrees) {
        expect(validQ.has(ch.quality)).toBe(true)
        // exactly one root source resolves; just assert it resolves to 0..11.
        const offset = chordRootOffset(ch, p.mode)
        expect(offset).toBeGreaterThanOrEqual(0)
        expect(offset).toBeLessThan(12)
        expect(typeof ch.roman).toBe("string")
        expect(ch.roman.length).toBeGreaterThan(0)
      }
    }
  })

  it("every entry resolves to valid MIDI in 12-TET (0..127)", () => {
    for (const p of CORPUS) {
      const ev = progressionToChordEvents(p, { keyRoot: 0, octave: 3 })
      for (const e of ev) {
        for (const n of e.notes) {
          expect(Number.isInteger(n)).toBe(true)
          expect(n).toBeGreaterThanOrEqual(0)
          expect(n).toBeLessThanOrEqual(127)
        }
      }
    }
  })

  it("covers every declared family with at least one entry", () => {
    const counts = familyCounts()
    for (const fam of FAMILIES) {
      expect(counts[fam] ?? 0).toBeGreaterThan(0)
    }
  })

  it("exposes a rich tag taxonomy", () => {
    expect(allTags().length).toBeGreaterThan(40)
  })

  it("IP-SAFE: no entry text mentions a song/artist/album marker", () => {
    // Defensive guard: ids/tags/romans must read as theory, never naming.
    // Flag obvious naming markers ("by", "ft", quotes, "song", "©").
    const banned = /(\bby\b|\bft\.?\b|©|™|"|“|”|\bsong\b|\balbum\b|\bartist\b)/i
    for (const p of CORPUS) {
      expect(banned.test(p.id)).toBe(false)
      for (const t of p.tags) expect(banned.test(t)).toBe(false)
      for (const ch of p.degrees) expect(banned.test(ch.roman)).toBe(false)
    }
  })
})
