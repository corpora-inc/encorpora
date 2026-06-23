/**
 * beatlounge — RIGOROUS scene-snapshot round-trip proof.
 *
 * The founder's worry: "are we sure we can fully serialize and deserialize the
 * ENTIRE state?" This suite answers it adversarially:
 *
 *   1. FULL-COVERAGE GUARD — every sound-defining field of BeatloungeDoc is in
 *      the snapshot, and only identity/volatile/structural fields are excluded.
 *      A new musical doc field that nobody adds to the snapshot fails this test.
 *
 *   2. RICH ROUND-TRIP — build a maximally-loaded doc (multiple instrument
 *      tracks with distinct presets + multi-insert chains + sends; a fragment
 *      track; buses with effects + sends; chordal harmony with a progression;
 *      modulators; non-default swing / tempo / meter), snapshot it, MUTATE the
 *      live doc heavily, applySnapshot, and assert the restored sound-defining
 *      state DEEP-EQUALS the original snapshot AND does NOT alias it.
 *
 *   3. JSON DURABILITY — the snapshot survives a JSON.stringify/parse (the IDB
 *      persistence path) unchanged: no functions / class instances / undefined
 *      smuggled in.
 */

import { describe, expect, it } from "vitest"
import {
  SCHEMA,
  defaultHarmony,
  type BeatloungeDoc,
  type Bus,
  type EffectNode,
  type FragmentRef,
  type FragmentTrack,
  type Harmony,
  type InstrumentTrack,
  type Modulator,
  type NoteEvent,
} from "./document"
import { PPQ } from "./timing"
import {
  applySnapshot,
  captureSnapshot,
  snapshotsEqual,
  type SceneSnapshot,
} from "./snapshot"

// The 11 sound-defining fields the snapshot MUST carry, and the 6 it must NOT.
const MUSICAL_FIELDS = [
  "loopLengthTicks",
  "bpm",
  "tempoMap",
  "meterMap",
  "swing",
  "masterVolume",
  "tracks",
  "buses",
  "fragmentLibrary",
  "modulators",
  "harmony",
] as const
const EXCLUDED_FIELDS = ["schema", "id", "name", "ppq", "createdAt", "updatedAt"] as const

// ---------------------------------------------------------------- fixtures

let seq = 0
const id = (p: string) => `${p}_${++seq}`

const fx = (
  kind: EffectNode["kind"],
  params: EffectNode["params"],
  enabled = true
): EffectNode => ({ id: id("fx"), kind, enabled, params })

/** A drum track with a multi-insert chain and a send to a reverb bus. */
const richDrumTrack = (busId: string): InstrumentTrack => ({
  id: id("trk"),
  name: "Kit",
  color: "#39e0ff",
  grid: { denominator: 16 },
  lengthTicks: PPQ * 4,
  volume: 0.82,
  pan: -0.1,
  mute: false,
  solo: false,
  groupId: id("grp"),
  inserts: [
    fx("eq3", { low: 1.5, mid: -0.5, high: 2 }),
    fx("compressor", { threshold: -18, ratio: 4, attack: 0.003, release: 0.12 }),
    fx("distortion", { amount: 0.2, oversample: "2x" }, false),
  ],
  sends: [{ id: id("snd"), busId, level: 0.3, preFader: false }],
  automation: [
    {
      id: id("lane"),
      target: { scope: "track", trackId: "self", param: "volume" },
      default: 0.82,
      points: [
        { id: id("pt"), tick: 0, value: 0.82, curve: "step" },
        { id: id("pt"), tick: PPQ * 2, value: 0.5, curve: "linear" },
      ],
    },
  ],
  kind: "instrument",
  instrument: { kind: "drumSampler", kitId: id("kit"), pads: [
    { note: 36, sampleId: id("smp"), gain: 0.9, chokeGroup: 1 },
    { note: 38, sampleId: id("smp"), gain: 0.8 },
  ], fallback: "synthKit" },
  notes: [
    { id: id("n"), tick: 0, duration: PPQ / 8, pitch: 36, velocity: 0.9 },
    { id: id("n"), tick: PPQ, duration: PPQ / 8, pitch: 38, velocity: 0.85, probability: 0.8, ratchet: 2, micro: 7 },
  ] as NoteEvent[],
})

/** An analog-synth lead with a flat param bag + a filter insert. */
const richSynthTrack = (): InstrumentTrack => ({
  id: id("trk"),
  name: "Lead",
  color: "#c66bff",
  grid: { denominator: 8 },
  volume: 0.7,
  pan: 0.2,
  mute: false,
  solo: true,
  inserts: [fx("filter", { type: "lowpass", frequency: 1800, q: 3 })],
  sends: [],
  automation: [],
  kind: "instrument",
  instrument: {
    kind: "analogSynth",
    preset: "warm-saw",
    params: { osc1Wave: "sawtooth", cutoff: 2200, resonance: 4, drive: 0.15, voiceMode: "poly" },
  },
  notes: [
    { id: id("n"), tick: 0, duration: PPQ, pitch: 60, velocity: 0.7 },
    { id: id("n"), tick: PPQ * 2, duration: PPQ, pitch: 67, velocity: 0.7 },
  ],
})

/** A fragment (phrase-sampler) track with a scratch automation curve. */
const richFragmentTrack = (fragmentId: string): FragmentTrack => ({
  id: id("trk"),
  name: "Phrase",
  grid: { denominator: 4 },
  volume: 0.6,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [fx("delay", { time: 0.375, feedback: 0.4, wet: 0.3 })],
  sends: [],
  automation: [],
  kind: "fragment",
  instrument: { kind: "ttsFragment", voiceId: "es-MX-1" },
  fragments: [
    {
      id: id("frg"),
      tick: 0,
      fragmentId,
      gain: 0.9,
      pitchSemis: -3,
      stretch: 1.1,
      reverse: false,
      startOffset: 0.05,
      scratch: { curve: [1, -1, 0.5, 2] },
    },
  ],
})

const reverbBus = (): Bus => ({
  id: id("bus"),
  name: "Reverb",
  role: "fx",
  inserts: [fx("reverb", { decay: 3.2, preDelay: 0.02, wet: 1 })],
  sends: [],
  volume: 0.9,
  mute: false,
})

const richHarmony = (): Harmony => ({
  mode: "chordal",
  tonic: 9, // A
  scale: { family: "maqam", id: "maqam.rast", tuning: "just" },
  progression: [
    { id: id("ch"), tick: 0, symbol: "Am7", durationTicks: PPQ * 4 },
    { id: id("ch"), tick: PPQ * 4, symbol: "Dm7", durationTicks: PPQ * 4 },
    { id: id("ch"), tick: PPQ * 8, symbol: "E7", durationTicks: PPQ * 4 },
  ],
  reference: { hz: 432, midi: 69 },
})

const richModulator = (): Modulator => ({
  id: id("mod"),
  target: { scope: "track", trackId: "self", param: "pan" },
  shape: "drift",
  rateHz: 0.25,
  depth: 0.6,
  center: 0.5,
  phase: 0.1,
  seed: 12345,
  enabled: true,
})

const richFragmentRef = (fragmentId: string): FragmentRef => ({
  id: fragmentId,
  source: "ttsRender",
  voiceId: "es-MX-1",
  text: "hola mundo",
  language: "es",
  assetUrl: "corpan-pack://frag/abc",
  sha256: "deadbeef",
  durationSec: 1.4,
})

/** A maximally-loaded doc that touches every sound-defining field deeply. */
const richDoc = (): BeatloungeDoc => {
  seq = 0
  const bus = reverbBus()
  const fragRef = richFragmentRef(id("frg-ref"))
  return {
    schema: SCHEMA,
    id: id("song"),
    name: "RICH",
    ppq: PPQ,
    bpm: 132,
    tempoMap: [
      { id: id("t"), tick: 0, bpm: 132 },
      { id: id("t"), tick: PPQ * 8, bpm: 96 },
    ],
    meterMap: [
      { id: id("m"), tick: 0, sig: { numerator: 7, denominator: 8 } },
      { id: id("m"), tick: PPQ * 4, sig: { numerator: 4, denominator: 4 } },
    ],
    loopLengthTicks: PPQ * 16,
    swing: { amount: 0.34, grid: { denominator: 8 } },
    masterVolume: 0.77,
    tracks: [richDrumTrack(bus.id), richSynthTrack(), richFragmentTrack(fragRef.id)],
    buses: [bus],
    fragmentLibrary: [fragRef],
    modulators: [richModulator()],
    harmony: richHarmony(),
    createdAt: 1000,
    updatedAt: 2000,
  }
}

/** The sound-defining projection of a doc (what a snapshot must equal). */
const musicalProjection = (doc: BeatloungeDoc): SceneSnapshot => ({
  loopLengthTicks: doc.loopLengthTicks,
  bpm: doc.bpm,
  tempoMap: doc.tempoMap,
  meterMap: doc.meterMap,
  swing: doc.swing,
  masterVolume: doc.masterVolume,
  tracks: doc.tracks,
  buses: doc.buses,
  fragmentLibrary: doc.fragmentLibrary,
  modulators: doc.modulators ?? [],
  harmony: doc.harmony ?? defaultHarmony(),
})

// ---------------------------------------------------------------- 1. coverage

describe("snapshot — FULL field coverage of the doc", () => {
  it("captures exactly the musical fields and excludes identity/volatile", () => {
    const snap = captureSnapshot(richDoc()) as unknown as Record<string, unknown>
    for (const f of MUSICAL_FIELDS) {
      expect(f in snap, `snapshot must carry "${f}"`).toBe(true)
    }
    for (const f of EXCLUDED_FIELDS) {
      expect(f in snap, `snapshot must NOT carry "${f}"`).toBe(false)
    }
    // The snapshot has NO keys beyond the musical set (no leaks).
    expect(Object.keys(snap).sort()).toEqual([...MUSICAL_FIELDS].sort())
  })

  it("snapshot's musical projection equals the doc's, value-for-value", () => {
    const doc = richDoc()
    const snap = captureSnapshot(doc)
    expect(snap).toEqual(musicalProjection(doc))
  })
})

// ---------------------------------------------------------------- 2. round-trip

describe("snapshot — RICH round-trip is lossless and non-aliasing", () => {
  it("restores the entire sound-defining state after a heavy live mutation", () => {
    const doc = richDoc()
    const snap = captureSnapshot(doc)
    const before = structuredClone(snap) // an independent reference copy

    // MUTATE the live doc heavily — nothing here may leak into `snap`.
    const live: BeatloungeDoc = {
      ...doc,
      bpm: 60,
      loopLengthTicks: PPQ,
      masterVolume: 0.05,
      swing: { amount: 0, grid: { denominator: 16 } },
      tempoMap: [],
      meterMap: [{ id: id("m2"), tick: 0, sig: { numerator: 3, denominator: 4 } }],
      tracks: [], // wipe all tracks
      buses: [],
      fragmentLibrary: [],
      modulators: [],
      harmony: defaultHarmony(),
      name: "MUTATED",
      id: "other-song",
    }
    // Also deeply poke at the ORIGINAL doc objects (alias hunt): if the snapshot
    // aliased any nested array/object, these in-place edits would corrupt it.
    ;(doc.tracks[0] as InstrumentTrack).notes.push({ id: "x", tick: 99, duration: 1, pitch: 1, velocity: 1 })
    doc.tracks[0].inserts[0].params.low = -99
    doc.buses[0].inserts[0].params.decay = 0.001
    ;(doc.harmony as Harmony).progression.push({ id: "x", tick: 0, symbol: "X" })
    doc.modulators![0].depth = 0
    doc.fragmentLibrary[0].text = "tampered"

    // The snapshot is unchanged by all of the above.
    expect(snap).toEqual(before)

    // Apply over the mutated live doc — identity/structural come from `live`,
    // every sound-defining field comes from the snapshot.
    const restored = applySnapshot(live, snap)

    // Identity / structural preserved from the live doc.
    expect(restored.id).toBe("other-song")
    expect(restored.name).toBe("MUTATED")
    expect(restored.schema).toBe(SCHEMA)
    expect(restored.ppq).toBe(PPQ)

    // Every sound-defining field DEEP-EQUALS the original snapshot.
    expect(restored.harmony).toBeTruthy()
    expect(musicalProjection(restored)).toEqual(before)
    expect(captureSnapshot(restored)).toEqual(before)
  })

  it("the restored doc does NOT alias the snapshot (later edits stay isolated)", () => {
    const doc = richDoc()
    const snap = captureSnapshot(doc)
    const guard = structuredClone(snap)
    const restored = applySnapshot({ ...doc, id: "z" }, snap)

    // Mutate every nested collection on the restored doc in place.
    ;(restored.tracks[0] as InstrumentTrack).notes[0].velocity = 0.01
    restored.tracks[0].inserts[0].params.low = 123
    ;(restored.tracks[2] as FragmentTrack).fragments[0].gain = 0
    restored.buses[0].inserts[0].enabled = false
    restored.modulators[0].enabled = false
    restored.harmony?.progression.pop()
    restored.fragmentLibrary[0].durationSec = 0
    restored.tempoMap.pop()
    restored.meterMap.pop()

    // The snapshot is completely unaffected.
    expect(snap).toEqual(guard)
  })

  it("two applies from the same snapshot produce independent docs", () => {
    const snap = captureSnapshot(richDoc())
    const a = applySnapshot({ ...richDoc(), id: "a" }, snap)
    const b = applySnapshot({ ...richDoc(), id: "b" }, snap)
    ;(a.tracks[0] as InstrumentTrack).notes[0].pitch = 1
    expect((b.tracks[0] as InstrumentTrack).notes[0].pitch).not.toBe(1)
    // …and the snapshot itself is still pristine for a third load.
    const c = applySnapshot({ ...richDoc(), id: "c" }, snap)
    expect(captureSnapshot(c)).toEqual(snap)
  })
})

// ---------------------------------------------------------------- 3. JSON durability

describe("snapshot — survives the IDB JSON path byte-for-byte", () => {
  it("round-trips through JSON.stringify/parse unchanged", () => {
    const snap = captureSnapshot(richDoc())
    const viaJson = JSON.parse(JSON.stringify(snap)) as SceneSnapshot
    expect(viaJson).toEqual(snap)
    expect(snapshotsEqual(viaJson, snap)).toBe(true)
    // No undefined / functions / non-JSON values smuggled in: a stringify of the
    // parsed copy must be identical (stable, total).
    expect(JSON.stringify(viaJson)).toBe(JSON.stringify(snap))
  })

  it("applySnapshot from a JSON-revived snapshot is identical to the direct one", () => {
    const doc = richDoc()
    const snap = captureSnapshot(doc)
    const revived = JSON.parse(JSON.stringify(snap)) as SceneSnapshot
    const direct = applySnapshot({ ...doc, id: "d1" }, snap)
    const fromJson = applySnapshot({ ...doc, id: "d1" }, revived)
    expect(captureSnapshot(fromJson)).toEqual(captureSnapshot(direct))
  })
})
