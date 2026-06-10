/**
 * beatlounge — progression-template tests. Named roman-numeral templates render
 * into any key/mode with key-correct chords, and the catalog is sound.
 */

import { describe, expect, it } from "vitest"
import { TEMPLATES, TEMPLATE_NAMES, renderTemplate } from "./templates"
import { inScale } from "./harmony"

describe("template catalog", () => {
  it("every template has steps and a fitting scale", () => {
    for (const name of TEMPLATE_NAMES) {
      const tpl = TEMPLATES[name]
      expect(tpl.steps.length).toBeGreaterThan(0)
      expect(tpl.preferScale).toBeTruthy()
      for (const step of tpl.steps) {
        expect(step.degree).toBeGreaterThanOrEqual(0)
        expect((step.beats ?? 4) > 0).toBe(true)
      }
    }
  })
})

describe("renderTemplate", () => {
  it("pop in C major is C–G–Am–F", () => {
    const p = renderTemplate("pop", 0, "major")
    expect(p.chords.map((c) => c.chord.root)).toEqual([0, 7, 9, 5])
    expect(p.chords.map((c) => c.chord.quality)).toEqual(["maj", "maj", "min", "maj"])
  })

  it("renders into a different key (pop in G major → G–D–Em–C)", () => {
    const p = renderTemplate("pop", 7, "major")
    expect(p.chords.map((c) => c.chord.root)).toEqual([7, 2, 4, 0])
  })

  it("jazz forces ii-min7 / V-dom7 / I-maj7 qualities", () => {
    const p = renderTemplate("jazz", 0, "major")
    expect(p.chords.map((c) => c.chord.quality)).toEqual(["min7", "dom7", "maj7"])
    // ii in C is Dm7, V is G7, I is Cmaj7
    expect(p.chords.map((c) => c.chord.root)).toEqual([2, 7, 0])
  })

  it("blues lays dominant-7 chords (I7 IV7 V7)", () => {
    const p = renderTemplate("blues", 0, "mixolydian")
    expect(p.chords.every((c) => c.chord.quality === "dom7")).toBe(true)
    expect(p.chords[0].chord.root).toBe(0)
  })

  it("epic/sad minor templates root on the minor tonic", () => {
    const epic = renderTemplate("epic", 9, "minor") // A minor
    expect(epic.chords[0].chord.root).toBe(9)
    expect(epic.chords[0].chord.quality).toBe("min")
  })

  it("an unknown template name falls back to pop", () => {
    const p = renderTemplate("nonsense", 0, "major")
    expect(p.chords.map((c) => c.chord.root)).toEqual([0, 7, 9, 5])
  })

  it("diatonic template roots stay in the key", () => {
    for (const name of ["pop", "doowop", "emotional", "threechord", "canon"]) {
      const p = renderTemplate(name, 2, "major") // D major
      for (const tc of p.chords) {
        expect(inScale(tc.chord.root, 2, "major")).toBe(true)
      }
    }
  })

  it("totalBeats sums the per-chord beats", () => {
    const p = renderTemplate("pop", 0, "major") // 4 chords × 4 beats
    expect(p.totalBeats).toBe(16)
  })
})
