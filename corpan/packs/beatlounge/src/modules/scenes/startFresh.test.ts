import { describe, expect, it } from "vitest"
import { buildEmptySnapshot, buildRandomSnapshot } from "./startFresh"
import { isInstrumentTrack, isFragmentTrack } from "../../model/document"
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
