import { describe, expect, it } from "vitest"
import {
  buildEmptySnapshot,
  buildRandomSnapshot,
  buildSnapshotFromDraft,
  rollDraftWorld,
  type DraftFacet,
  type DraftWorld,
} from "./startFresh"
import { isInstrumentTrack, isFragmentTrack } from "../../model/document"
import { makeRng } from "../../music/chords/random"
import { RHYTHMS } from "../../rhythm"

const noteCount = (snap: ReturnType<typeof buildEmptySnapshot>) =>
  snap.tracks.reduce((n, t) => n + (isInstrumentTrack(t) ? t.notes.length : 0), 0)

/** Strip every `id` field so we compare MUSICAL content, not the random ids
 *  (track / chord / meter ids come from newId() and legitimately differ). */
const stripIds = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(stripIds)
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "id") continue
      out[k] = stripIds(val)
    }
    return out
  }
  return v
}

describe("buildEmptySnapshot — the fixed blank slate", () => {
  it("has no notes on any track", () => {
    expect(noteCount(buildEmptySnapshot())).toBe(0)
  })

  it("keeps the canonical layout: a drum track, a synth track, a phrase track", () => {
    const snap = buildEmptySnapshot()
    expect(snap.tracks.filter(isInstrumentTrack).length).toBeGreaterThanOrEqual(2)
    expect(snap.tracks.filter(isFragmentTrack).length).toBe(1)
  })

  it("defaults to C modal harmony in 4/4", () => {
    const snap = buildEmptySnapshot()
    expect(snap.harmony.tonic).toBe(0)
    expect(snap.harmony.mode).toBe("modal")
    expect(snap.meterMap[0].sig).toEqual({ numerator: 4, denominator: 4 })
  })
})

describe("buildRandomSnapshot — the randomized world", () => {
  it("is deterministic for a given seed (musical content; ids excepted)", () => {
    const a = buildRandomSnapshot(12345)
    const b = buildRandomSnapshot(12345)
    expect(a.grooveId).toBe(b.grooveId)
    expect(JSON.stringify(stripIds(a.snapshot))).toBe(JSON.stringify(stripIds(b.snapshot)))
  })

  it("differs across seeds (smoke)", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8]
    const grooves = new Set(seeds.map((s) => buildRandomSnapshot(s).grooveId))
    expect(grooves.size).toBeGreaterThan(1)
  })

  it("builds an EMPTY grid — three synth voices + drums + phrases, no notes", () => {
    const { snapshot } = buildRandomSnapshot(42)
    expect(noteCount(snapshot)).toBe(0)
    // drums + bass + mid + lead = 4 instrument tracks, plus 1 phrase track.
    expect(snapshot.tracks.filter(isInstrumentTrack).length).toBe(4)
    expect(snapshot.tracks.filter(isFragmentTrack).length).toBe(1)
  })

  it("drops a random kit on the drum track", () => {
    const { snapshot } = buildRandomSnapshot(7)
    const drum = snapshot.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    expect(drum && isInstrumentTrack(drum) && drum.instrument.kind === "drumSampler").toBe(true)
    if (drum && isInstrumentTrack(drum) && drum.instrument.kind === "drumSampler") {
      expect(typeof drum.instrument.kitId).toBe("string")
    }
  })

  it("selects a real groove and a sensible meter/tempo", () => {
    const { snapshot, grooveId } = buildRandomSnapshot(99)
    expect(RHYTHMS.some((r) => r.id === grooveId)).toBe(true)
    expect(snapshot.meterMap[0].sig.numerator).toBeGreaterThan(0)
    expect(snapshot.meterMap[0].sig.denominator).toBeGreaterThan(0)
    expect(snapshot.bpm).toBeGreaterThan(0)
    expect(snapshot.loopLengthTicks).toBeGreaterThan(0)
  })

  it("randomizes the time signature — not always 4/4", () => {
    const sigs = Array.from({ length: 40 }, (_, i) => {
      const s = buildRandomSnapshot(i + 1).snapshot.meterMap[0].sig
      return `${s.numerator}/${s.denominator}`
    })
    const distinct = new Set(sigs)
    // Many distinct meters, and at least one that isn't 4/4.
    expect(distinct.size).toBeGreaterThan(3)
    expect(sigs.some((s) => s !== "4/4")).toBe(true)
    // The loop length tracks the meter (one bar), so it varies too.
    expect(new Set(Array.from({ length: 40 }, (_, i) => buildRandomSnapshot(i + 1).snapshot.loopLengthTicks)).size).toBeGreaterThan(2)
  })
})

// Facet names don't 1:1 the DraftWorld keys (tempo→bpm, kit→kitId, groove→grooveId),
// so read a facet's comparable value explicitly.
const facetValue = (w: DraftWorld, f: DraftFacet): unknown => {
  switch (f) {
    case "meter":
      return w.meter
    case "tempo":
      return w.bpm
    case "key":
      return w.key
    case "kit":
      return w.kitId
    case "groove":
      return w.grooveId
    case "bass":
    case "mid":
    case "lead":
      return w.voices[f]
  }
}

describe("rollDraftWorld — per-facet lock / reroll", () => {
  const ALL_FACETS: DraftFacet[] = ["meter", "tempo", "key", "kit", "bass", "mid", "lead", "groove"]

  it("keeps every locked facet and rerolls the rest", () => {
    const base = rollDraftWorld(makeRng(123))
    // Reroll with everything locked but one facet, many times, and confirm the
    // locked facets never move (the free one is allowed to, but isn't required to).
    for (const free of ALL_FACETS) {
      const lock = new Set(ALL_FACETS.filter((f) => f !== free))
      for (let s = 1; s <= 8; s++) {
        const next = rollDraftWorld(makeRng(s), { from: base, lock })
        for (const f of ALL_FACETS) {
          if (f === free) continue
          expect(facetValue(next, f)).toEqual(facetValue(base, f))
        }
      }
    }
  })

  it("with no locks is a full reroll (matches the all-random path)", () => {
    // Same seed → identical draft whether via buildRandomSnapshot or rollDraftWorld.
    const a = buildSnapshotFromDraft(rollDraftWorld(makeRng(77)))
    const b = buildRandomSnapshot(77)
    expect(stripIds(a.snapshot)).toEqual(stripIds(b.snapshot))
    expect(a.grooveId).toBe(b.grooveId)
  })
})

describe("buildSnapshotFromDraft — concrete draft → snapshot", () => {
  // Seed a real draft for a valid Mode, then override the facets we assert on.
  const seeded = rollDraftWorld(makeRng(5))
  const draft: DraftWorld = {
    ...seeded,
    meter: { numerator: 7, denominator: 8 },
    bpm: 96,
    key: { ...seeded.key, tonic: 2, symbols: [] },
    kitId: "studio",
    voices: { bass: "sub-bass", mid: "warm-pad", lead: "saw-lead" },
    grooveId: RHYTHMS[0].id,
  }

  it("honors the draft's meter, tempo, kit, and groove; no notes", () => {
    const { snapshot, grooveId } = buildSnapshotFromDraft(draft)
    expect(snapshot.bpm).toBe(96)
    expect(snapshot.meterMap[0].sig).toEqual({ numerator: 7, denominator: 8 })
    expect(grooveId).toBe(RHYTHMS[0].id)
    expect(noteCount(snapshot)).toBe(0)
    const drum = snapshot.tracks.find(
      (t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler"
    )
    expect(drum && isInstrumentTrack(drum) && drum.instrument.kind === "drumSampler"
      ? drum.instrument.kitId
      : null).toBe("studio")
  })

  it("empty key symbols ⇒ a modal harmony", () => {
    const { snapshot } = buildSnapshotFromDraft(draft)
    expect(snapshot.harmony.mode).toBe("modal")
    expect(snapshot.harmony.tonic).toBe(2)
  })
})
