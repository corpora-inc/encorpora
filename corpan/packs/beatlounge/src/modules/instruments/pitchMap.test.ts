import { describe, expect, it } from "vitest"
import {
  DEFAULT_RANGE,
  midiToNoteName,
  positionToMidi,
  resolvePitch,
  rowMarkers,
  surfacePitch,
  type SurfaceRange,
} from "./pitchMap"

const RANGE: SurfaceRange = { baseMidi: 60, rowSpanSemis: 12, rows: 2 }

describe("positionToMidi", () => {
  it("maps the bottom-left corner to the base pitch", () => {
    // Bottom row (ny→1), left edge (nx→0) = lowest playable pitch.
    expect(positionToMidi(0, 1, RANGE)).toBeCloseTo(60, 5)
  })

  it("rises continuously left→right across a row (fretless)", () => {
    const a = positionToMidi(0.25, 1, RANGE)
    const b = positionToMidi(0.5, 1, RANGE)
    expect(b).toBeGreaterThan(a)
    // A quarter of a 12-semitone row = 3 semitones above base.
    expect(a).toBeCloseTo(63, 5)
    expect(b).toBeCloseTo(66, 5)
  })

  it("returns FRACTIONAL pitch between the chromatic grid", () => {
    // 1/24 of a 12-semitone row = 0.5 semitone = +50 cents.
    const p = positionToMidi(1 / 24, 1, RANGE)
    expect(p).toBeCloseTo(60.5, 5)
    expect(Number.isInteger(p)).toBe(false)
  })

  it("stacks rows so the TOP row is the highest octave", () => {
    // Top row (ny→0), left edge = base + one rowSpan (an octave up here).
    const top = positionToMidi(0, 0, RANGE)
    const bottom = positionToMidi(0, 1, RANGE)
    expect(top - bottom).toBeCloseTo(RANGE.rowSpanSemis, 5)
  })

  it("clamps out-of-bounds positions instead of exploding", () => {
    expect(positionToMidi(-5, 5, RANGE)).toBeCloseTo(60, 5)
    expect(positionToMidi(2, -2, RANGE)).toBeGreaterThan(60)
  })
})

describe("resolvePitch — the three play modes", () => {
  it("fretless returns the raw continuous pitch (no snapping)", () => {
    expect(resolvePitch(60.37, "fretless")).toBeCloseTo(60.37, 5)
  })

  it("chromatic also returns raw pitch (markers are visual-only)", () => {
    expect(resolvePitch(60.37, "chromatic")).toBeCloseTo(60.37, 5)
  })

  it("scale mode WITHOUT a quantizer falls back to chromatic identity", () => {
    // The harmony seam is absent on this branch → fully usable, just unsnapped.
    expect(resolvePitch(60.37, "scale")).toBeCloseTo(60.37, 5)
  })

  it("scale mode snaps continuous pitch through the quantize SEAM", () => {
    // A sample C-major resolver: snap to nearest of {0,2,4,5,7,9,11} pitch class.
    const SCALE = [0, 2, 4, 5, 7, 9, 11]
    const snap = (midi: number): number => {
      const octave = Math.floor(midi / 12) * 12
      const within = midi - octave
      let best = SCALE[0]
      for (const s of SCALE) if (Math.abs(s - within) < Math.abs(best - within)) best = s
      return octave + best
    }
    // 61.4 (≈ C#5+) → nearest scale degree is D (62) since C#→D is closer than C.
    expect(resolvePitch(61.4, "scale", snap)).toBe(62)
    // 60.2 → C (60).
    expect(resolvePitch(60.2, "scale", snap)).toBe(60)
  })

  it("surfacePitch composes position → mode in one call", () => {
    const SNAP = (m: number) => Math.round(m) // snap-to-semitone stand-in
    const raw = surfacePitch(1 / 24, 1, RANGE, "fretless")
    expect(raw).toBeCloseTo(60.5, 5)
    const snapped = surfacePitch(1 / 24, 1, RANGE, "scale", SNAP)
    expect(snapped).toBe(61) // 60.5 rounds to 61 (or 60); Math.round → 61
  })
})

describe("rowMarkers", () => {
  it("emits one marker per semitone in the row span", () => {
    const m = rowMarkers(60, 12)
    expect(m).toHaveLength(12)
    expect(m[0].nx).toBeCloseTo(0, 5)
    expect(m[6].nx).toBeCloseTo(0.5, 5)
  })

  it("flags octave (C) markers", () => {
    const m = rowMarkers(60, 24) // two octaves: C at 60 and 72
    const octaves = m.filter((x) => x.octave)
    expect(octaves.map((o) => o.midi)).toEqual([60, 72])
  })

  it("with no scale set, every marker is 'in scale' (chromatic)", () => {
    expect(rowMarkers(60, 12).every((m) => m.inScale)).toBe(true)
  })

  it("highlights only in-scale pitch classes when a scale is given", () => {
    const C_MAJOR = [0, 2, 4, 5, 7, 9, 11]
    const m = rowMarkers(60, 12, C_MAJOR)
    const inScale = m.filter((x) => x.inScale).map((x) => ((x.midi % 12) + 12) % 12)
    expect(inScale.sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11])
    // C# (1) is out of scale.
    expect(m.find((x) => x.midi === 61)?.inScale).toBe(false)
  })
})

describe("midiToNoteName", () => {
  it("names integer pitches", () => {
    expect(midiToNoteName(60)).toBe("C4")
    expect(midiToNoteName(69)).toBe("A4")
    expect(midiToNoteName(61)).toBe("C#4")
  })
  it("rounds fractional pitches to the nearest name", () => {
    expect(midiToNoteName(60.4)).toBe("C4")
    expect(midiToNoteName(60.6)).toBe("C#4")
  })
})

describe("DEFAULT_RANGE", () => {
  it("is a sensible multi-octave, multi-row span", () => {
    expect(DEFAULT_RANGE.rows).toBeGreaterThanOrEqual(2)
    expect(DEFAULT_RANGE.rowSpanSemis).toBeGreaterThanOrEqual(12)
    // The whole field spans several octaves so it's playable.
    const span = DEFAULT_RANGE.rowSpanSemis * DEFAULT_RANGE.rows
    expect(span).toBeGreaterThanOrEqual(36)
  })
})
