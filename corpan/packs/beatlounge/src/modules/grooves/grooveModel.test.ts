/**
 * beatlounge — Grooves module model + actions tests. Verify groove commands go
 * through existing commands only, target/create the drum track, fit the loop for
 * long cycles, optionally place phrases, and that the actions are one undo batch.
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
import { applyAction, layerAction, varyAction, evolveAction, randomizeAction } from "./actions"
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

describe("grooveModel.buildGrooveCommands", () => {
  it("writes the drum track via setNotes (no auto-play, just the grid)", () => {
    const d = doc()
    const r = getRhythm("son-clave-3-2")!
    const { commands } = buildGrooveCommands(d, r)
    const setNotes = commands.find((c) => c.t === "setNotes")
    expect(setNotes).toBeTruthy()
    expect(commands.every((c) => c.t !== "setTempo")).toBe(true)
    // Targets the existing drum track.
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

describe("grooveModel — PHRASES target (the groove brain on the phrase grid)", () => {
  /** A doc with a fragment track + a bank of `n` snippets. */
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

  it("places FragmentEvents on the groove's onsets from the bank (the real apply path)", () => {
    const { d, phraseId } = withBank(3)
    expect(findPhraseTrackId(d)).toBe(phraseId)
    const { commands, placedPhrases, phrasesUnavailable } = buildGrooveCommands(
      d,
      getRhythm("samba")!,
      { target: { kind: "phrases", trackId: phraseId }, rng: rngFrom(3), phraseDensity: 1 }
    )
    expect(phrasesUnavailable).toBe(false)
    expect(placedPhrases).toBe(true)
    const placed = commands.filter((c) => c.t === "placeFragment")
    expect(placed.length).toBeGreaterThan(0)
    for (const c of placed) {
      if (c.t !== "placeFragment") continue
      expect(c.trackId).toBe(phraseId)
      // Real placements: each references a bank snippet and lands on an onset tick.
      expect(d.fragmentLibrary!.some((r) => r.id === c.frag.fragmentId)).toBe(true)
      expect(c.frag.tick).toBeGreaterThanOrEqual(0)
    }
    // A phrases target NEVER writes drum notes.
    expect(commands.some((c) => c.t === "setNotes")).toBe(false)
  })

  it("applied placements survive the reducer as real events on the phrase track", () => {
    const { d, phraseId } = withBank(2)
    const { commands } = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      target: { kind: "phrases", trackId: phraseId },
      rng: rngFrom(9),
      phraseDensity: 1,
    })
    const after = commands.reduce((acc, c) => reduce(acc, c), d)
    const track = after.tracks.find((t) => t.id === phraseId)
    expect(track && track.kind === "fragment" ? track.fragments.length : 0).toBeGreaterThan(0)
  })

  it("Apply REPLACES existing phrase placements; Layer keeps them", () => {
    const { d, phraseId } = withBank(2)
    const seeded = reduce(d, {
      t: "placeFragment",
      trackId: phraseId,
      frag: { tick: 0, fragmentId: d.fragmentLibrary![0].id, gain: 0.9, pitchSemis: 0 },
    })
    // Apply emits a removeFragment for the held event (replace).
    const apply = buildGrooveCommands(seeded, getRhythm("samba")!, {
      target: { kind: "phrases", trackId: phraseId },
      rng: rngFrom(2),
      phraseDensity: 1,
    })
    expect(apply.commands.some((c) => c.t === "removeFragment")).toBe(true)
    // Layer never removes — it adds onto free onsets.
    const layer = buildGrooveCommands(seeded, getRhythm("samba")!, {
      target: { kind: "phrases", trackId: phraseId },
      layer: true,
      rng: rngFrom(2),
      phraseDensity: 1,
    })
    expect(layer.commands.some((c) => c.t === "removeFragment")).toBe(false)
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
      rng: rngFrom(1),
    })
    expect(res.phrasesUnavailable).toBe(true)
    expect(res.commands.length).toBe(0)
  })

  it("flags phrasesUnavailable when there is no phrase track at all", () => {
    const d = doc() // no fragment track
    const res = buildGrooveCommands(d, getRhythm("samba")!, {
      target: { kind: "phrases" },
      rng: rngFrom(1),
    })
    expect(res.phrasesUnavailable).toBe(true)
    expect(res.commands.length).toBe(0)
    // A DRUMS target on the same doc is fine (not flagged).
    const drums = buildGrooveCommands(d, getRhythm("samba")!)
    expect(drums.phrasesUnavailable).toBe(false)
    expect(drums.commands.some((c) => c.t === "setNotes")).toBe(true)
  })
})

describe("grooveModel — LAYER (additive apply)", () => {
  /** Apply a build's commands to a doc so we can inspect the resulting notes. */
  const applyTo = (d: BeatloungeDoc, commands: ReturnType<typeof buildGrooveCommands>["commands"]) =>
    commands.reduce((acc, c) => reduce(acc, c), d)

  const drumNotes = (d: BeatloungeDoc) => {
    const t = d.tracks.find((x) => isInstrumentTrack(x) && x.instrument.kind === "drumSampler")
    return t && isInstrumentTrack(t) ? t.notes : []
  }

  it("Apply REPLACES the pattern (only the groove's hits remain)", () => {
    const d = doc()
    const before = drumNotes(d).length
    expect(before).toBeGreaterThan(0)
    const { commands } = buildGrooveCommands(d, getRhythm("son-clave-3-2")!)
    const after = drumNotes(applyTo(d, commands))
    // The clave's hits, not the default four-on-the-floor + backbeat + hats.
    expect(after.length).toBeGreaterThan(0)
    expect(after.length).toBeLessThan(before)
  })

  it("Layer UNIONS the groove with the existing pattern (keeps both)", () => {
    const d = doc()
    const existing = drumNotes(d)
    const existingKeys = new Set(existing.map((n) => `${n.tick}:${n.pitch}`))
    const { commands, summary } = buildGrooveCommands(d, getRhythm("son-clave-3-2")!, {
      layer: true,
    })
    expect(summary).toMatch(/layered/i)
    const after = drumNotes(applyTo(d, commands))
    const afterKeys = new Set(after.map((n) => `${n.tick}:${n.pitch}`))
    // Every existing hit survives, and the layer added new ones on top.
    for (const k of existingKeys) expect(afterKeys.has(k)).toBe(true)
    expect(after.length).toBeGreaterThanOrEqual(existing.length)
  })

  it("Layer is idempotent — re-layering the same groove adds no duplicate (tick,pitch)", () => {
    const d = doc()
    const once = applyTo(d, buildGrooveCommands(d, getRhythm("son-clave-3-2")!, { layer: true }).commands)
    const onceCount = drumNotes(once).length
    const twice = applyTo(once, buildGrooveCommands(once, getRhythm("son-clave-3-2")!, { layer: true }).commands)
    expect(drumNotes(twice).length).toBe(onceCount)
    // No duplicate (tick,pitch) keys.
    const keys = drumNotes(twice).map((n) => `${n.tick}:${n.pitch}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("layerAction summary says 'Layered' and is one undo batch through the bus", () => {
    const bus = createCommandBus(doc())
    const before = bus.snapshot()
    const result = layerAction.run({ doc: before, rng: rngFrom(7) }, { rhythmId: "son-clave-3-2" })
    expect(result.summary).toMatch(/Layered/)
    bus.dispatch({ t: "batch", commands: result.commands })
    expect(bus.snapshot()).not.toEqual(before)
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })
})

describe("grooves actions through the command bus", () => {
  const run = (action: typeof applyAction, params: Record<string, unknown>) => {
    const bus = createCommandBus(doc())
    const before = bus.snapshot()
    const result = action.run({ doc: before, rng: rngFrom(5) }, params)
    if (result.commands.length === 1) bus.dispatch(result.commands[0])
    else if (result.commands.length > 1) bus.dispatch({ t: "batch", commands: result.commands })
    return { bus, before, result }
  }

  it("apply writes a recognizable groove and is one undo step", () => {
    const { bus, before, result } = run(applyAction, { rhythmId: "reggaeton-dembow" })
    expect(result.summary).toContain("Reggaetón")
    const after = bus.snapshot()
    expect(after).not.toBe(before)
    const drum = after.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
    expect(drum && isInstrumentTrack(drum) ? drum.notes.length : 0).toBeGreaterThan(0)
    // single undo restores the original
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })

  it("apply on an unknown rhythm is a clean no-op", () => {
    const { result } = run(applyAction, { rhythmId: "nope-not-real" })
    expect(result.commands).toEqual([])
  })

  it("vary applies and stays one undo step", () => {
    const { bus, before } = run(varyAction, { rhythmId: "samba", amount: 0.3 })
    expect(bus.snapshot()).not.toEqual(before)
    bus.undo()
    expect(bus.snapshot()).toEqual(before)
  })

  it("evolve applies across generations", () => {
    const { bus, result } = run(evolveAction, { rhythmId: "samba", generations: 5 })
    expect(result.summary).toContain("5 gens")
    const drum = bus.snapshot().tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    expect(drum && isInstrumentTrack(drum) ? drum.notes.length : 0).toBeGreaterThan(0)
  })

  it("randomize within a family yields a groove", () => {
    const { bus, result } = run(randomizeAction, { family: "indian" })
    expect(result.commands.length).toBeGreaterThan(0)
    const after = bus.snapshot()
    const drum = after.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
    expect(drum && isInstrumentTrack(drum) ? drum.notes.length : 0).toBeGreaterThan(0)
  })

  it("is deterministic given a seed (apply against the same doc)", () => {
    const d = doc() // same doc ⇒ same track ids, so output is identical
    const a = applyAction.run({ doc: d, rng: rngFrom(11) }, { rhythmId: "samba" })
    const b = applyAction.run({ doc: d, rng: rngFrom(11) }, { rhythmId: "samba" })
    expect(a).toEqual(b)
  })

  it("a drums-target apply never emits a fragment placement", () => {
    const { result } = run(applyAction, { rhythmId: "samba" })
    expect(result.commands.some((c) => c.t === "placeFragment")).toBe(false)
    expect(result.commands.some((c) => c.t === "setNotes")).toBe(true)
  })

  it("a phrases-target apply (through the action) places fragments from the bank", () => {
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
    const result = applyAction.run(
      { doc: d, rng: rngFrom(4) },
      { rhythmId: "samba", target: { kind: "phrases", trackId: phraseId }, phraseDensity: 1 }
    )
    const placed = result.commands.filter((c) => c.t === "placeFragment")
    expect(placed.length).toBeGreaterThan(0)
    expect(result.commands.some((c) => c.t === "setNotes")).toBe(false)
  })
})
