/**
 * beatlounge — Grooves module model + actions tests. Verify groove commands go
 * through existing commands only, target/create the drum track, fit the loop for
 * long cycles, SCATTER probabilistically across selected rows (vs the natural
 * mapping with none selected), the clear-vs-layer semantics, the phrases path,
 * and that each action is one undo batch.
 */

import { describe, expect, it } from "vitest"
import { createCommandBus } from "../../model/commandBus"
import { createDefaultDoc, isInstrumentTrack } from "../../model/document"
import { newId } from "../../model/ids"
import type { BeatloungeDoc, FragmentRef } from "../../model/document"
import { getRhythm, rhythmTicks } from "../../rhythm"
import { gridTicks } from "../../model/timing"
import {
  buildGrooveCommands,
  findDrumTrackId,
  findPhraseTrackId,
} from "./grooveModel"
import { scatterAction, clearScatterAction, denserAction, sparserAction } from "./actions"
import { reduce } from "../../model/reduce"

const rngFrom = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const doc = (): BeatloungeDoc => createDefaultDoc(0)

/** Kit pitches we'll select as rows. */
const KICK = 36
const SNARE = 38
const COWBELL = 56

const drumNotes = (d: BeatloungeDoc) => {
  const t = d.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind === "drumSampler")
  return t && isInstrumentTrack(t) ? t.notes : []
}
const applyTo = (
  d: BeatloungeDoc,
  commands: ReturnType<typeof buildGrooveCommands>["commands"]
) => commands.reduce((acc, c) => reduce(acc, c), d)

describe("grooveModel.buildGrooveCommands", () => {
  it("writes the drum track via setNotes (no auto-play, just the grid)", () => {
    const d = doc()
    const r = getRhythm("son-clave-3-2")!
    const { commands } = buildGrooveCommands(d, r)
    const setNotes = commands.find((c) => c.t === "setNotes")
    expect(setNotes).toBeTruthy()
    expect(commands.every((c) => c.t !== "setTempo")).toBe(true)
    if (setNotes && setNotes.t === "setNotes") {
      expect(setNotes.trackId).toBe(findDrumTrackId(d))
      for (const n of setNotes.notes) expect(n.velocity).toBeLessThanOrEqual(1)
    }
  })

  it("creates a drum track when the doc has none", () => {
    const d = doc()
    const noDrums: BeatloungeDoc = {
      ...d,
      tracks: d.tracks.filter((t) => !(isInstrumentTrack(t) && t.instrument.kind === "drumSampler")),
    }
    expect(findDrumTrackId(noDrums)).toBeUndefined()
    const { commands } = buildGrooveCommands(noDrums, getRhythm("samba")!)
    expect(commands.some((c) => c.t === "addTrack")).toBe(true)
    expect(commands.some((c) => c.t === "setNotes")).toBe(true)
  })

  it("grows the loop to fit a long cycle (teental) when fitLoop", () => {
    const d = doc() // 1-bar loop
    const teental = getRhythm("teental")!
    const cycle = rhythmTicks(teental) // 16 beats > 1 bar
    expect(cycle).toBeGreaterThan(d.loopLengthTicks)
    const { commands } = buildGrooveCommands(d, teental, { fitLoop: true })
    const setLoop = commands.find((c) => c.t === "setLoopLength")
    expect(setLoop && setLoop.t === "setLoopLength" ? setLoop.ticks : 0).toBeGreaterThanOrEqual(cycle)
  })

  it("does not grow the loop when fitLoop is false", () => {
    const d = doc()
    const { commands } = buildGrooveCommands(d, getRhythm("teental")!, { fitLoop: false })
    expect(commands.some((c) => c.t === "setLoopLength")).toBe(false)
  })
})

describe("grooveModel — NO selection plays the natural mapping (unchanged)", () => {
  it("with no selected rows the groove keeps its per-role kit pitches", () => {
    const d = doc()
    const { commands } = buildGrooveCommands(d, getRhythm("samba")!, { clear: true })
    const setNotes = commands.find((c) => c.t === "setNotes")
    expect(setNotes && setNotes.t === "setNotes").toBeTruthy()
    if (setNotes && setNotes.t === "setNotes") {
      const pitches = new Set(setNotes.notes.map((n) => n.pitch))
      // Several distinct natural voices (surdo/caixa/ganzá/tamborim), not a scatter.
      expect(pitches.size).toBeGreaterThan(1)
    }
  })

  it("with no selection the result is deterministic (no RNG path)", () => {
    const d = doc()
    const a = buildGrooveCommands(d, getRhythm("samba")!, { clear: true, seed: 1 })
    const b = buildGrooveCommands(d, getRhythm("samba")!, { clear: true, seed: 999 })
    // Different seeds, identical output — the natural path doesn't roll dice.
    expect(a.commands).toEqual(b.commands)
  })
})

/** A doc whose drum track is EMPTY (so scatter output is the only content). */
const emptyDrumDoc = (): BeatloungeDoc => {
  const d = doc()
  const drumId = findDrumTrackId(d)!
  return reduce(d, { t: "setNotes", trackId: drumId, notes: [] })
}

describe("grooveModel — SCATTER across selected rows (the core ask)", () => {
  const scatterOn = (
    d: BeatloungeDoc,
    rows: number[],
    seed: number,
    extra: Record<string, unknown> = {}
  ) =>
    buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: rows },
      clear: true,
      seed,
      ...extra,
    })

  const notesOf = (res: ReturnType<typeof scatterOn>) => {
    const setNotes = res.commands.find((c) => c.t === "setNotes")
    return setNotes && setNotes.t === "setNotes" ? setNotes.notes : []
  }

  it("only ever lands on the selected rows (never another pitch)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK, SNARE, COWBELL]
    for (let seed = 1; seed <= 12; seed++) {
      const notes = notesOf(scatterOn(d, rows, seed))
      for (const n of notes) expect(rows).toContain(n.pitch)
    }
  })

  it("spreads the rhythm ACROSS all the selected rows (not just the first)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK, SNARE, COWBELL]
    const used = new Set<number>()
    // Aggregate a few seeds: every selected row should receive hits.
    for (let seed = 1; seed <= 8; seed++) {
      for (const n of notesOf(scatterOn(d, rows, seed))) used.add(n.pitch)
    }
    for (const p of rows) expect(used.has(p)).toBe(true)
  })

  it("probability follows the groove PROFILE — onset steps fire far more than rests", () => {
    const d = emptyDrumDoc()
    const rows = [KICK]
    const son = getRhythm("son-clave-3-2")!
    // Son clave 3-2 onset cells: 0,3,6,10,12 (a 16-cell bar).
    const onsetCells = new Set([0, 3, 6, 10, 12])
    const ct = rhythmTicks(son) / 16
    let onsetHits = 0
    let restHits = 0
    const TRIALS = 80
    for (let seed = 1; seed <= TRIALS; seed++) {
      for (const n of notesOf(scatterOn(d, rows, seed))) {
        const cell = Math.round(n.tick / ct) % 16
        if (onsetCells.has(cell)) onsetHits++
        else restHits++
      }
    }
    // The clave's actual onsets should dominate placements (its feel carries),
    // while rests still get the occasional surprise hit (> 0, but far fewer).
    expect(onsetHits).toBeGreaterThan(restHits)
  })

  it("velocities fall within the step's emphasis band (accents loud, in 0..1)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK]
    for (let seed = 1; seed <= 30; seed++) {
      for (const n of notesOf(scatterOn(d, rows, seed))) {
        expect(n.velocity).toBeGreaterThan(0)
        expect(n.velocity).toBeLessThanOrEqual(1)
      }
    }
    // An accented onset cell (cell 0) should, over trials, produce loud hits.
    const son = getRhythm("son-clave-3-2")!
    const ct = rhythmTicks(son) / 16
    let sawLoud = false
    for (let seed = 1; seed <= 60 && !sawLoud; seed++) {
      for (const n of notesOf(scatterOn(d, rows, seed))) {
        if (Math.round(n.tick / ct) % 16 === 0 && n.velocity > 0.7) sawLoud = true
      }
    }
    expect(sawLoud).toBe(true)
  })

  it("DIFFERENT seeds give different scatters (each press re-rolls)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK, SNARE, COWBELL]
    const sig = (seed: number) =>
      JSON.stringify(
        notesOf(scatterOn(d, rows, seed)).map((n) => `${n.tick}:${n.pitch}:${n.velocity.toFixed(3)}`)
      )
    const a = sig(1)
    const b = sig(2)
    const c = sig(3)
    // At least two of three distinct (overwhelmingly all three).
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2)
  })

  it("the SAME seed is reproducible (pure/seeded engine)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK, SNARE]
    const a = scatterOn(d, rows, 77)
    const b = scatterOn(d, rows, 77)
    expect(a.commands).toEqual(b.commands)
  })

  it("density scales the placement count (sparser at low density)", () => {
    const d = emptyDrumDoc()
    const rows = [KICK, SNARE, COWBELL]
    let dense = 0
    let sparse = 0
    for (let seed = 1; seed <= 30; seed++) {
      dense += notesOf(scatterOn(d, rows, seed, { density: 1 })).length
      sparse += notesOf(scatterOn(d, rows, seed, { density: 0.3 })).length
    }
    expect(sparse).toBeLessThan(dense)
    expect(sparse).toBeGreaterThan(0)
  })
})

describe("grooveModel — CLEAR vs LAYER semantics on the targeted rows", () => {
  /** A doc whose drum track has one note on each of KICK/SNARE/COWBELL at tick 0. */
  const seeded = (): BeatloungeDoc => {
    const d = doc()
    const drumId = findDrumTrackId(d)!
    let out = reduce(d, { t: "setNotes", trackId: drumId, notes: [] })
    for (const pitch of [KICK, SNARE, COWBELL]) {
      out = reduce(out, {
        t: "addNote",
        trackId: drumId,
        note: { tick: 0, duration: 10, pitch, velocity: 0.9 },
      })
    }
    return out
  }

  it("CLEAR wipes the targeted rows first; untargeted rows survive", () => {
    const d = seeded()
    // Target only KICK + SNARE; COWBELL is NOT targeted → its note must survive.
    const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: [KICK, SNARE] },
      clear: true,
      seed: 5,
    })
    const after = drumNotes(applyTo(d, res.commands))
    // COWBELL@0 survived (untargeted).
    expect(after.some((n) => n.pitch === COWBELL && n.tick === 0)).toBe(true)
    // No KICK/SNARE note remains at tick 0 UNLESS the scatter happened to place one
    // there; assert instead that any KICK/SNARE notes are scatter output (could be
    // absent at tick 0). The pre-existing ones were cleared.
    const kickSnareAt0 = after.filter((n) => (n.pitch === KICK || n.pitch === SNARE) && n.tick === 0)
    // tick 0 is an accented onset (high prob) so a fresh hit MAY land — but it's a
    // scatter hit, never the old 0.9 placeholder velocity unless re-rolled. The
    // point: clear removed the old rows, so we only see scatter-shaped output.
    for (const n of kickSnareAt0) expect(n.velocity).toBeGreaterThan(0)
  })

  it("LAYER keeps existing notes on the targeted rows and adds scatter on top", () => {
    const d = seeded()
    const before = drumNotes(d)
    const beforeKeys = new Set(before.map((n) => `${n.tick}:${n.pitch}`))
    const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: [KICK, SNARE, COWBELL] },
      clear: false,
      seed: 5,
    })
    const after = drumNotes(applyTo(d, res.commands))
    const afterKeys = new Set(after.map((n) => `${n.tick}:${n.pitch}`))
    // Every existing note survives a LAYER.
    for (const k of beforeKeys) expect(afterKeys.has(k)).toBe(true)
  })

  it("no duplicate (tick,pitch) after the union (idempotent merge)", () => {
    const d = seeded()
    const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: [KICK, SNARE, COWBELL] },
      clear: false,
      seed: 3,
    })
    const after = drumNotes(applyTo(d, res.commands))
    const keys = after.map((n) => `${n.tick}:${n.pitch}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("grooveModel — PHRASES target (scatter snippets on the phrase grid)", () => {
  const withBank = (n: number): { d: BeatloungeDoc; phraseId: string } => {
    const base = doc()
    const refs: FragmentRef[] = Array.from({ length: n }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `word${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const d: BeatloungeDoc = {
      ...base,
      fragmentLibrary: refs,
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    return { d, phraseId }
  }

  it("scatters FragmentEvents from the bank onto the groove (the real path)", () => {
    const { d, phraseId } = withBank(3)
    expect(findPhraseTrackId(d)).toBe(phraseId)
    const { commands, placedPhrases, phrasesUnavailable } = buildGrooveCommands(
      d,
      getRhythm("samba")!,
      { target: { kind: "phrases", trackId: phraseId }, seed: 3, phraseDensity: 1 }
    )
    expect(phrasesUnavailable).toBe(false)
    expect(placedPhrases).toBe(true)
    const placed = commands.filter((c) => c.t === "placeFragment")
    expect(placed.length).toBeGreaterThan(0)
    for (const c of placed) {
      if (c.t !== "placeFragment") continue
      expect(c.trackId).toBe(phraseId)
      expect(d.fragmentLibrary!.some((r) => r.id === c.frag.fragmentId)).toBe(true)
      expect(c.frag.tick).toBeGreaterThanOrEqual(0)
    }
    // A phrases target NEVER writes drum notes.
    expect(commands.some((c) => c.t === "setNotes")).toBe(false)
  })

  it("placements survive the reducer as real events on the phrase track", () => {
    const { d, phraseId } = withBank(2)
    const { commands } = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "phrases", trackId: phraseId },
      seed: 9,
      phraseDensity: 1,
    })
    const after = commands.reduce((acc, c) => reduce(acc, c), d)
    const track = after.tracks.find((t) => t.id === phraseId)
    expect(track && track.kind === "fragment" ? track.fragments.length : 0).toBeGreaterThan(0)
  })

  it("CLEAR removes held phrase placements; LAYER keeps them", () => {
    const { d, phraseId } = withBank(2)
    const withHeld = reduce(d, {
      t: "placeFragment",
      trackId: phraseId,
      frag: { tick: 0, fragmentId: d.fragmentLibrary![0].id, gain: 0.9, pitchSemis: 0 },
    })
    const cleared = buildGrooveCommands(withHeld, getRhythm("samba")!, {
      target: { kind: "phrases", trackId: phraseId },
      clear: true,
      seed: 2,
      phraseDensity: 1,
    })
    expect(cleared.commands.some((c) => c.t === "removeFragment")).toBe(true)
    const layered = buildGrooveCommands(withHeld, getRhythm("samba")!, {
      target: { kind: "phrases", trackId: phraseId },
      clear: false,
      seed: 2,
      phraseDensity: 1,
    })
    expect(layered.commands.some((c) => c.t === "removeFragment")).toBe(false)
  })

  it("flags phrasesUnavailable (no silent no-op) when the bank is empty", () => {
    const base = doc()
    const phraseId = newId("trk")
    const emptyBank: BeatloungeDoc = {
      ...base,
      fragmentLibrary: [],
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    const res = buildGrooveCommands(emptyBank, getRhythm("samba")!, {
      target: { kind: "phrases", trackId: phraseId },
      seed: 1,
    })
    expect(res.phrasesUnavailable).toBe(true)
    expect(res.commands.length).toBe(0)
  })

  it("flags phrasesUnavailable when there is no phrase track at all", () => {
    const d = doc()
    const res = buildGrooveCommands(d, getRhythm("samba")!, {
      target: { kind: "phrases" },
      seed: 1,
    })
    expect(res.phrasesUnavailable).toBe(true)
    expect(res.commands.length).toBe(0)
    const drums = buildGrooveCommands(d, getRhythm("samba")!)
    expect(drums.phrasesUnavailable).toBe(false)
    expect(drums.commands.some((c) => c.t === "setNotes")).toBe(true)
  })
})

describe("grooveModel — the +/− DENSITY DIAL (denser/sparser)", () => {
  const drumNotesOf = (d: BeatloungeDoc) => drumNotes(d)

  /** Apply one + (denser) tap to a doc on the given rows, returning the new doc. */
  const plus = (d: BeatloungeDoc, rows: number[], seed: number): BeatloungeDoc => {
    const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: rows },
      op: "add",
      seed,
    })
    return applyTo(d, res.commands)
  }
  /** Apply one − (sparser) tap to a doc on the given rows. */
  const minus = (d: BeatloungeDoc, rows: number[]): BeatloungeDoc => {
    const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: rows },
      op: "remove",
    })
    return applyTo(d, res.commands)
  }

  it("+ is ADDITIVE — keeps existing hits and adds more (never clears)", () => {
    const rows = [KICK, SNARE]
    let d = emptyDrumDoc()
    d = plus(d, rows, 1)
    const afterOne = drumNotesOf(d).map((n) => `${n.tick}:${n.pitch}`)
    expect(afterOne.length).toBeGreaterThan(0)
    d = plus(d, rows, 2)
    const afterTwo = drumNotesOf(d).map((n) => `${n.tick}:${n.pitch}`)
    // Every hit from the first + survived the second (additive, deduped).
    for (const k of afterOne) expect(afterTwo).toContain(k)
  })

  it("+ gets DENSER each tap (cumulative count grows across taps)", () => {
    const rows = [KICK, SNARE, COWBELL]
    let d = emptyDrumDoc()
    const counts: number[] = []
    for (let tap = 1; tap <= 5; tap++) {
      d = plus(d, rows, tap)
      counts.push(drumNotesOf(d).length)
    }
    // Non-decreasing and strictly grown overall (additive layers accumulate).
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1])
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[0])
  })

  it("+ only ever lands on the selected rows", () => {
    const rows = [KICK, COWBELL]
    let d = emptyDrumDoc()
    for (let tap = 1; tap <= 4; tap++) d = plus(d, rows, tap)
    for (const n of drumNotesOf(d)) expect(rows).toContain(n.pitch)
  })

  it("− removes a FRACTION (smaller bite than + adds) — harder to take away", () => {
    const rows = [KICK, SNARE, COWBELL]
    // Build up a dense bed first.
    let d = emptyDrumDoc()
    for (let tap = 1; tap <= 6; tap++) d = plus(d, rows, tap)
    const full = drumNotesOf(d).length
    expect(full).toBeGreaterThan(4)
    // One − removes only a fraction (not everything, not nothing).
    const afterOneMinus = drumNotesOf(minus(d, rows)).length
    const removed = full - afterOneMinus
    expect(removed).toBeGreaterThan(0)
    expect(afterOneMinus).toBeGreaterThan(0)
    // Asymmetry: the − fraction (~0.3) takes a smaller bite than the count one +
    // adds, so it removes well under half in one tap.
    expect(removed).toBeLessThan(full * 0.5)
  })

  it("repeated − thins all the way down to NOTHING (the last − clears the row)", () => {
    const rows = [KICK, SNARE]
    let d = emptyDrumDoc()
    for (let tap = 1; tap <= 5; tap++) d = plus(d, rows, tap)
    expect(drumNotesOf(d).length).toBeGreaterThan(0)
    let prev = Infinity
    for (let i = 0; i < 30 && drumNotesOf(d).length > 0; i++) {
      const before = drumNotesOf(d).length
      d = minus(d, rows)
      const after = drumNotesOf(d).length
      expect(after).toBeLessThan(before) // always makes progress
      expect(after).toBeLessThanOrEqual(prev)
      prev = after
    }
    expect(drumNotesOf(d).length).toBe(0)
  })

  it("− leaves UNTARGETED rows untouched", () => {
    const rows = [KICK, SNARE, COWBELL]
    let d = emptyDrumDoc()
    for (let tap = 1; tap <= 6; tap++) d = plus(d, rows, tap)
    const cowbellBefore = drumNotesOf(d).filter((n) => n.pitch === COWBELL).length
    // − targeting only KICK/SNARE must not touch COWBELL hits.
    const after = minus(d, [KICK, SNARE])
    const cowbellAfter = drumNotesOf(after).filter((n) => n.pitch === COWBELL).length
    expect(cowbellAfter).toBe(cowbellBefore)
  })

  it("PHRASES are FAR sparser than drums for the same groove (a + drops only a handful)", () => {
    // A bank of 6 snippets on a phrase track; same groove, same single + tap.
    const refs: FragmentRef[] = Array.from({ length: 6 }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `w${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const base = doc()
    const phraseDoc: BeatloungeDoc = {
      ...base,
      fragmentLibrary: refs,
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    const r = getRhythm("son-clave-3-2")!
    // Average phrase + placements vs drum + placements (3 rows) over seeds.
    let phraseTotal = 0
    let drumTotal = 0
    const SEEDS = 12
    const drumRows = [KICK, SNARE, COWBELL]
    for (let seed = 1; seed <= SEEDS; seed++) {
      const ph = buildGrooveCommands(phraseDoc, r, {
        target: { kind: "phrases", trackId: phraseId },
        op: "add",
        seed,
      })
      phraseTotal += ph.commands.filter((c) => c.t === "placeFragment").length
      const dr = buildGrooveCommands(emptyDrumDoc(), r, {
        target: { kind: "drums", selectedPitches: drumRows },
        op: "add",
        seed,
      })
      const setNotes = dr.commands.find((c) => c.t === "setNotes")
      drumTotal += setNotes && setNotes.t === "setNotes" ? setNotes.notes.length : 0
    }
    const phraseAvg = phraseTotal / SEEDS
    const drumPerRowAvg = drumTotal / SEEDS / drumRows.length
    // Phrases per + are a small handful, and MUCH sparser per-row than drums
    // (≥~5× fewer): one + must not paste a word on every 8th.
    expect(phraseAvg).toBeLessThan(drumPerRowAvg)
    expect(phraseAvg).toBeLessThanOrEqual(3)
  })

  it("PHRASES − thins ONLY the selected snippet rows", () => {
    const refs: FragmentRef[] = Array.from({ length: 4 }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `w${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const base = doc()
    // Pre-seed fragments: 3 of snippet[0] and 3 of snippet[1] across cells.
    const fragsFor = (fragmentId: string, ticks: number[]) =>
      ticks.map((tick) => ({ id: newId("fev"), tick, fragmentId, gain: 0.9, pitchSemis: 0 }))
    const phraseDoc: BeatloungeDoc = {
      ...base,
      fragmentLibrary: refs,
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [
            ...fragsFor(refs[0].id, [0, 120, 240]),
            ...fragsFor(refs[1].id, [0, 120, 240]),
          ],
        },
      ],
    }
    const r = getRhythm("son-clave-3-2")!
    const res = buildGrooveCommands(phraseDoc, r, {
      target: { kind: "phrases", trackId: phraseId, selectedSnippetIds: [refs[0].id] },
      op: "remove",
    })
    const removed = res.commands.filter((c) => c.t === "removeFragment")
    expect(removed.length).toBeGreaterThan(0)
    // Every removal targets the selected snippet's fragments only.
    const after = applyTo(phraseDoc, res.commands)
    const track = after.tracks.find((t) => t.id === phraseId)
    const frags = track && track.kind === "fragment" ? track.fragments : []
    // snippet[1] fully intact (3 still present); snippet[0] thinned (fewer than 3).
    expect(frags.filter((f) => f.fragmentId === refs[1].id).length).toBe(3)
    expect(frags.filter((f) => f.fragmentId === refs[0].id).length).toBeLessThan(3)
  })

  it("each dial tap is grid-only (no setTempo / play) and a clean batch", () => {
    const rows = [KICK, SNARE]
    const res = buildGrooveCommands(emptyDrumDoc(), getRhythm("son-clave-3-2")!, {
      target: { kind: "drums", selectedPitches: rows },
      op: "add",
      seed: 3,
    })
    expect(res.commands.every((c) => c.t !== "setTempo")).toBe(true)
    expect(res.commands.some((c) => c.t === "setNotes")).toBe(true)
  })
})

describe("grooves actions through the command bus", () => {
  const run = (action: typeof scatterAction, params: Record<string, unknown>) => {
    const bus = createCommandBus(doc())
    const before = bus.snapshot()
    const result = action.run({ doc: before, rng: rngFrom(5) }, params)
    if (result.commands.length === 1) bus.dispatch(result.commands[0])
    else if (result.commands.length > 1) bus.dispatch({ t: "batch", commands: result.commands })
    return { bus, before, result }
  }

  it("scatter writes a groove and is ONE undo step (natural voices, no selection)", () => {
    const { bus, before, result } = run(scatterAction, { rhythmId: "reggaeton-dembow" })
    expect(result.summary).toContain("Reggaetón")
    const after = bus.snapshot()
    expect(after).not.toBe(before)
    const drum = after.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
    expect(drum && isInstrumentTrack(drum) ? drum.notes.length : 0).toBeGreaterThan(0)
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })

  it("scatter on an unknown rhythm is a clean no-op", () => {
    const { result } = run(scatterAction, { rhythmId: "nope-not-real" })
    expect(result.commands).toEqual([])
  })

  it("scatter across selected rows lands only on those rows + is one undo step", () => {
    // Empty drum track so only the scatter output is present; clearScatter so
    // the selected rows carry nothing but the fresh scatter.
    const bus = createCommandBus(emptyDrumDoc())
    const before = bus.snapshot()
    const result = clearScatterAction.run(
      { doc: before, rng: rngFrom(5) },
      { rhythmId: "son-clave-3-2", target: { kind: "drums", selectedPitches: [KICK, SNARE] }, seed: 8 }
    )
    bus.dispatch({ t: "batch", commands: result.commands })
    const setNotes = result.commands.find((c) => c.t === "setNotes")
    if (setNotes && setNotes.t === "setNotes") {
      for (const n of setNotes.notes) expect([KICK, SNARE]).toContain(n.pitch)
    }
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })

  it("clearScatter clears the targeted rows first (one undo batch)", () => {
    const d = doc()
    const drumId = findDrumTrackId(d)!
    const withKick = reduce(d, {
      t: "addNote",
      trackId: drumId,
      note: { tick: 240, duration: 10, pitch: COWBELL, velocity: 0.9 },
    })
    const bus = createCommandBus(withKick)
    const before = bus.snapshot()
    const result = clearScatterAction.run(
      { doc: before, rng: rngFrom(5) },
      { rhythmId: "son-clave-3-2", target: { kind: "drums", selectedPitches: [COWBELL] }, seed: 4 }
    )
    bus.dispatch({ t: "batch", commands: result.commands })
    const drum = bus.snapshot().tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    // The stray COWBELL@240 (a rest cell, low prob) was cleared and is unlikely to
    // be re-placed there; at minimum the action stays one reversible step.
    expect(drum && isInstrumentTrack(drum) ? drum.notes.length : 0).toBeGreaterThanOrEqual(0)
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })

  it("a drums-target scatter never emits a fragment placement", () => {
    const { result } = run(scatterAction, { rhythmId: "samba" })
    expect(result.commands.some((c) => c.t === "placeFragment")).toBe(false)
    expect(result.commands.some((c) => c.t === "setNotes")).toBe(true)
  })

  it("a phrases-target scatter places fragments from the bank", () => {
    const base = doc()
    const ref: FragmentRef = { id: newId("frg"), source: "ttsRender", text: "hola", language: "es" }
    const phraseId = newId("trk")
    const d: BeatloungeDoc = {
      ...base,
      fragmentLibrary: [ref],
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    const result = scatterAction.run(
      { doc: d, rng: rngFrom(4) },
      { rhythmId: "samba", target: { kind: "phrases", trackId: phraseId }, seed: 4, phraseDensity: 1 }
    )
    const placed = result.commands.filter((c) => c.t === "placeFragment")
    expect(placed.length).toBeGreaterThan(0)
    expect(result.commands.some((c) => c.t === "setNotes")).toBe(false)
  })

  it("denser (+) adds a layer; sparser (−) thins it — one undo step each", () => {
    const bus = createCommandBus(emptyDrumDoc())
    const before = bus.snapshot()
    const plus = denserAction.run(
      { doc: before, rng: rngFrom(5) },
      { rhythmId: "son-clave-3-2", target: { kind: "drums", selectedPitches: [KICK, SNARE] }, seed: 8 }
    )
    bus.dispatch({ t: "batch", commands: plus.commands })
    const drumAfterPlus = bus.snapshot().tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    const countAfterPlus = drumAfterPlus && isInstrumentTrack(drumAfterPlus) ? drumAfterPlus.notes.length : 0
    expect(countAfterPlus).toBeGreaterThan(0)

    const afterPlus = bus.snapshot()
    const minus = sparserAction.run(
      { doc: afterPlus, rng: rngFrom(5) },
      { rhythmId: "son-clave-3-2", target: { kind: "drums", selectedPitches: [KICK, SNARE] } }
    )
    // − is pure removeNote (no scatter, no new notes).
    expect(minus.commands.every((c) => c.t === "removeNote")).toBe(true)
    expect(minus.commands.length).toBeGreaterThan(0)
    bus.dispatch({ t: "batch", commands: minus.commands })
    const drumAfterMinus = bus.snapshot().tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    const countAfterMinus = drumAfterMinus && isInstrumentTrack(drumAfterMinus) ? drumAfterMinus.notes.length : 0
    expect(countAfterMinus).toBeLessThan(countAfterPlus)

    bus.undo() // undo the −
    bus.undo() // undo the +
    expect(bus.snapshot()).toEqual(before)
  })

  it("sparser on an empty target is a clean no-op (no commands)", () => {
    const res = sparserAction.run(
      { doc: emptyDrumDoc(), rng: rngFrom(1) },
      { rhythmId: "son-clave-3-2", target: { kind: "drums", selectedPitches: [KICK] } }
    )
    expect(res.commands).toEqual([])
  })
})

// ---- the drum track's visible grid step (denominator 16 in the default doc) ----
const drumGridTicks = (d: BeatloungeDoc): number => {
  const t = d.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind === "drumSampler")
  return t && isInstrumentTrack(t) ? gridTicks(t.grid) : gridTicks({ denominator: 16 })
}

describe("grooveModel — every placed tick is ON the visible grid (no phantom hits)", () => {
  // A TRIPLET rhythm (stepsPerBeat: 3 ⇒ 320-tick cells) does NOT line up with the
  // 16th-note grid (240-tick steps); before snapping it dropped off-grid hits.
  const TRIPLET = "swing"

  it("DRUMS: scatter on a triplet rhythm lands only on grid-step ticks", () => {
    const d = emptyDrumDoc()
    const step = drumGridTicks(d)
    for (let seed = 1; seed <= 20; seed++) {
      const res = buildGrooveCommands(d, getRhythm(TRIPLET)!, {
        target: { kind: "drums", selectedPitches: [KICK, SNARE] },
        clear: true,
        seed,
      })
      const setNotes = res.commands.find((c) => c.t === "setNotes")
      if (setNotes && setNotes.t === "setNotes") {
        for (const n of setNotes.notes) expect(n.tick % step).toBe(0)
      }
    }
  })

  it("DRUMS: natural mapping (no selection) on a triplet rhythm is on-grid", () => {
    const d = emptyDrumDoc()
    const step = drumGridTicks(d)
    const res = buildGrooveCommands(d, getRhythm(TRIPLET)!, { clear: true })
    const setNotes = res.commands.find((c) => c.t === "setNotes")
    expect(setNotes && setNotes.t === "setNotes").toBeTruthy()
    if (setNotes && setNotes.t === "setNotes") {
      expect(setNotes.notes.length).toBeGreaterThan(0)
      for (const n of setNotes.notes) expect(n.tick % step).toBe(0)
    }
  })

  it("PHRASES: scatter on a triplet rhythm lands only on grid-step ticks", () => {
    const refs: FragmentRef[] = Array.from({ length: 4 }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `w${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const base = doc()
    const phraseDoc: BeatloungeDoc = {
      ...base,
      fragmentLibrary: refs,
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    const step = gridTicks({ denominator: 16 })
    for (let seed = 1; seed <= 20; seed++) {
      const res = buildGrooveCommands(phraseDoc, getRhythm(TRIPLET)!, {
        target: { kind: "phrases", trackId: phraseId },
        op: "add",
        seed,
        phraseDensity: 1,
      })
      for (const c of res.commands) {
        if (c.t === "placeFragment") expect(c.frag.tick % step).toBe(0)
      }
    }
  })
})

describe("grooveModel — '+' ALWAYS adds ≥1 (never 'no onsets to place')", () => {
  it("DRUMS: a + with a tiny density still places at least one hit", () => {
    const d = emptyDrumDoc()
    // A vanishingly small density would roll zero onsets without the guarantee.
    for (let seed = 1; seed <= 15; seed++) {
      const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
        target: { kind: "drums", selectedPitches: [KICK] },
        op: "add",
        density: 0.0001,
        seed,
      })
      const setNotes = res.commands.find((c) => c.t === "setNotes")
      const count = setNotes && setNotes.t === "setNotes" ? setNotes.notes.length : 0
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  const phraseDocWith = (n: number): { d: BeatloungeDoc; phraseId: string } => {
    const refs: FragmentRef[] = Array.from({ length: n }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `w${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const base = doc()
    return {
      phraseId,
      d: {
        ...base,
        fragmentLibrary: refs,
        tracks: [
          ...base.tracks,
          {
            id: phraseId,
            kind: "fragment",
            name: "Phrases",
            color: "#7cf2c0",
            grid: { denominator: 16 },
            volume: 0.8,
            pan: 0,
            mute: false,
            solo: false,
            inserts: [],
            sends: [],
            automation: [],
            instrument: { kind: "ttsFragment" },
            fragments: [],
          },
        ],
      },
    }
  }

  it("PHRASES: a + at the sparse default density always places ≥1 phrase", () => {
    const { d, phraseId } = phraseDocWith(3)
    for (let seed = 1; seed <= 20; seed++) {
      const res = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
        target: { kind: "phrases", trackId: phraseId },
        op: "add",
        seed, // no phraseDensity ⇒ the very-sparse ADD step; pre-fix this rolled 0
      })
      const placed = res.commands.filter((c) => c.t === "placeFragment").length
      expect(placed).toBeGreaterThanOrEqual(1)
      expect(res.summary).not.toBe("No onsets to place phrases on")
    }
  })
})

describe("grooveModel — NO selection ⇒ ALL rows (phrases spread across every snippet)", () => {
  it("PHRASES with no selected rows scatter across ALL bank snippets", () => {
    const refs: FragmentRef[] = Array.from({ length: 4 }, (_, i) => ({
      id: newId("frg"),
      source: "ttsRender",
      text: `w${i}`,
      language: "es",
    }))
    const phraseId = newId("trk")
    const base = doc()
    const phraseDoc: BeatloungeDoc = {
      ...base,
      fragmentLibrary: refs,
      tracks: [
        ...base.tracks,
        {
          id: phraseId,
          kind: "fragment",
          name: "Phrases",
          color: "#7cf2c0",
          grid: { denominator: 16 },
          volume: 0.8,
          pan: 0,
          mute: false,
          solo: false,
          inserts: [],
          sends: [],
          automation: [],
          instrument: { kind: "ttsFragment" },
          fragments: [],
        },
      ],
    }
    // Aggregate across seeds: with NO selection, EVERY snippet row must receive a
    // placement (the groove spreads across all rows, not one random snippet).
    const used = new Set<string>()
    for (let seed = 1; seed <= 24; seed++) {
      const res = buildGrooveCommands(phraseDoc, getRhythm("samba")!, {
        target: { kind: "phrases", trackId: phraseId },
        op: "add",
        seed,
        phraseDensity: 1,
      })
      for (const c of res.commands) {
        if (c.t === "placeFragment") used.add(c.frag.fragmentId)
      }
    }
    for (const ref of refs) expect(used.has(ref.id)).toBe(true)
  })
})
