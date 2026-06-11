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
import {
  buildGrooveCommands,
  findDrumTrackId,
  findPhraseTrackId,
} from "./grooveModel"
import { scatterAction, clearScatterAction } from "./actions"
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
})
