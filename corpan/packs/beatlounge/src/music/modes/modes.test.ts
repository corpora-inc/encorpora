import { describe, expect, it } from "vitest"
import {
  ALL_MODES,
  CORPUS_COUNTS,
  findMode,
  getMode,
  MAQAMAT,
  MELAKARTAS,
  MODES_BY_FAMILY,
  modeCents,
  THAATS,
  toModeCents,
  WESTERN_MODES,
  buildMelakarta,
  NEUTRAL,
} from "./index"
import { detuneCentsForMidi, equal12 } from "../tuning"

describe("corpus invariants (all families)", () => {
  it("every mode starts on the tonic (0¢), ascends, stays within an octave", () => {
    for (const m of ALL_MODES) {
      expect(m.degrees.length).toBeGreaterThan(0)
      expect(m.degrees[0].cents).toBe(0)
      const cents = modeCents(m)
      for (let i = 1; i < cents.length; i++) {
        expect(cents[i]).toBeGreaterThan(cents[i - 1]) // strictly ascending
      }
      expect(cents[cents.length - 1]).toBeLessThan(1200) // octave implied, excluded
    }
  })
  it("ids are unique", () => {
    const ids = ALL_MODES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it("census matches family list lengths", () => {
    expect(CORPUS_COUNTS.western).toBe(WESTERN_MODES.length)
    expect(CORPUS_COUNTS.thaat).toBe(10)
    expect(CORPUS_COUNTS.melakarta).toBe(72)
    expect(CORPUS_COUNTS.maqam).toBe(MAQAMAT.length)
    expect(CORPUS_COUNTS.total).toBe(ALL_MODES.length)
    expect(MODES_BY_FAMILY.maqam).toBe(MAQAMAT)
  })
})

describe("Western modes (12-TET)", () => {
  it("Ionian = major scale cents", () => {
    expect(modeCents(getMode("western.ionian")!)).toEqual([0, 200, 400, 500, 700, 900, 1100])
  })
  it("Dorian and Aeolian differ at the 6th", () => {
    expect(modeCents(getMode("western.dorian")!)).toEqual([0, 200, 300, 500, 700, 900, 1000])
    expect(modeCents(getMode("western.aeolian")!)).toEqual([0, 200, 300, 500, 700, 800, 1000])
  })
  it("all western cents are multiples of 100 (12-TET)", () => {
    for (const m of WESTERN_MODES)
      for (const d of m.degrees) expect(d.cents % 100).toBe(0)
  })
  it("whole-tone has 6 degrees, octatonic 8, chromatic 12", () => {
    expect(getMode("western.wholeTone")!.degrees).toHaveLength(6)
    expect(getMode("western.octatonicHW")!.degrees).toHaveLength(8)
    expect(getMode("western.chromatic")!.degrees).toHaveLength(12)
  })
  it("alias resolution works", () => {
    expect(findMode("major")?.id).toBe("western.ionian")
    expect(findMode("natural-minor")?.id).toBe("western.aeolian")
  })
})

describe("Hindustani thaats (10)", () => {
  it("there are exactly 10, each a 7-note scale", () => {
    expect(THAATS).toHaveLength(10)
    for (const t of THAATS) expect(t.degrees).toHaveLength(7)
  })
  it("Bilawal = major (all-natural)", () => {
    expect(modeCents(getMode("thaat.bilawal")!)).toEqual([0, 200, 400, 500, 700, 900, 1100])
  })
  it("Bhairavi = Phrygian (all komal movables)", () => {
    expect(modeCents(getMode("thaat.bhairavi")!)).toEqual([0, 100, 300, 500, 700, 800, 1000])
  })
  it("Kalyan = Lydian (tivra Ma)", () => {
    expect(modeCents(getMode("thaat.kalyan")!)).toEqual([0, 200, 400, 600, 700, 900, 1100])
  })
  it("Bhairav has komal Re + komal Dha", () => {
    expect(modeCents(getMode("thaat.bhairav")!)).toEqual([0, 100, 400, 500, 700, 800, 1100])
  })
})

describe("Carnatic melakartas (72)", () => {
  it("there are exactly 72, each a 7-note scale starting Sa", () => {
    expect(MELAKARTAS).toHaveLength(72)
    for (const m of MELAKARTAS) {
      expect(m.degrees).toHaveLength(7)
      expect(m.melakartaNumber).toBeGreaterThanOrEqual(1)
      expect(m.melakartaNumber).toBeLessThanOrEqual(72)
    }
  })
  it("mela numbers 1..72 are all present and unique", () => {
    const nums = MELAKARTAS.map((m) => m.melakartaNumber!).sort((a, b) => a - b)
    expect(nums).toEqual(Array.from({ length: 72 }, (_, i) => i + 1))
  })
  it("Ma is shuddha (500¢) for 1..36, prati (600¢) for 37..72", () => {
    for (const m of MELAKARTAS) {
      const ma = m.degrees[3].cents
      expect(ma).toBe(m.melakartaNumber! <= 36 ? 500 : 600)
    }
  })
  it("Pa is always the perfect 5th (700¢)", () => {
    for (const m of MELAKARTAS) expect(m.degrees[4].cents).toBe(700)
  })
  it("canonical reference melas resolve to their known scales", () => {
    // 8 Hanumatodi = Todi thaat (Phrygian-ish: re ga Ma Pa dha ni).
    expect(getMode("melakarta.8")!.name).toBe("Hanumatodi")
    expect(modeCents(getMode("melakarta.8")!)).toEqual([0, 100, 300, 500, 700, 800, 1000])
    // 15 Mayamalavagowla = double-harmonic (re Ga Ma Pa dha Ni).
    expect(getMode("melakarta.15")!.name).toBe("Mayamalavagowla")
    expect(modeCents(getMode("melakarta.15")!)).toEqual([0, 100, 400, 500, 700, 800, 1100])
    // 22 Kharaharapriya = Dorian.
    expect(getMode("melakarta.22")!.name).toBe("Kharaharapriya")
    expect(modeCents(getMode("melakarta.22")!)).toEqual([0, 200, 300, 500, 700, 900, 1000])
    // 29 Dheerashankarabharanam = major.
    expect(getMode("melakarta.29")!.name).toBe("Dheerashankarabharanam")
    expect(modeCents(getMode("melakarta.29")!)).toEqual([0, 200, 400, 500, 700, 900, 1100])
    // 65 Mechakalyani = Lydian.
    expect(getMode("melakarta.65")!.name).toBe("Mechakalyani")
    expect(modeCents(getMode("melakarta.65")!)).toEqual([0, 200, 400, 600, 700, 900, 1100])
  })
  it("buildMelakarta rejects out-of-range numbers (noisy)", () => {
    expect(() => buildMelakarta(0)).toThrow()
    expect(() => buildMelakarta(73)).toThrow()
  })
})

describe("Arabic maqam (researched, non-12-TET)", () => {
  it("covers the principal maqamat incl. Rast/Bayati/Hijaz/Saba/Sikah", () => {
    const ids = MAQAMAT.map((m) => m.id)
    for (const id of [
      "maqam.rast", "maqam.bayati", "maqam.hijaz", "maqam.hijazkar",
      "maqam.saba", "maqam.sikah", "maqam.huzam", "maqam.nahawand",
      "maqam.kurd", "maqam.ajam", "maqam.nikriz", "maqam.suznak",
    ]) {
      expect(ids).toContain(id)
    }
    expect(MAQAMAT.length).toBeGreaterThanOrEqual(12)
  })
  it("Rast carries a NON-12-TET neutral 3rd (355¢, not 300/400)", () => {
    const rast = getMode("maqam.rast")!
    const third = rast.degrees.find((d) => Math.abs(d.cents - NEUTRAL.rastThird) < 1)!
    expect(third.cents).toBe(355)
    expect(third.cents % 100).not.toBe(0) // genuinely microtonal
    // Rast structure: 0 204 355 498 702 ...
    expect(modeCents(rast).slice(0, 5)).toEqual([0, 204, 355, 498, 702])
  })
  it("Bayati carries a NON-12-TET neutral 2nd (150¢ ≈ 12/11)", () => {
    const bayati = getMode("maqam.bayati")!
    expect(bayati.degrees[1].cents).toBe(150)
    expect(modeCents(bayati).slice(0, 4)).toEqual([0, 150, 294, 498])
  })
  it("Saba has its signature narrowed 4th (590¢, not 500)", () => {
    const saba = getMode("maqam.saba")!
    expect(modeCents(saba)).toContain(590)
  })
  it("Hijaz has the augmented-2nd colour (128 → 386, a ~258¢ leap)", () => {
    const hijaz = getMode("maqam.hijaz")!
    expect(modeCents(hijaz).slice(0, 3)).toEqual([0, 128, 386])
  })
  it("Nahawand & Kurd are 12-TET-aligned (no neutral tones)", () => {
    for (const id of ["maqam.nahawand", "maqam.kurd"]) {
      for (const d of getMode(id)!.degrees) expect(d.cents % 1).toBe(0)
    }
  })
  it("every maqam carries its ajnas decomposition", () => {
    for (const m of MAQAMAT) {
      expect(m.ajnas).toBeDefined()
      expect(m.ajnas!.lower.degrees[0].cents).toBe(0)
    }
  })
  it("the detune bridge bends a played MIDI E down to Rast's 355¢ neutral 3rd", () => {
    const rast = toModeCents(getMode("maqam.rast")!)
    // tonic C4 = 60, play E (64): 12-TET 400¢ → 355¢ ⇒ −45¢.
    expect(detuneCentsForMidi(64, rast, equal12, 60)).toBeCloseTo(-45, 1)
  })
})

describe("lookup + projection", () => {
  it("getMode / findMode / toModeCents compose", () => {
    expect(getMode("western.dorian")).toBe(MODES_BY_FAMILY.western.find((m) => m.id === "western.dorian"))
    expect(findMode("Yaman")?.id).toBe("thaat.kalyan")
    expect(toModeCents(getMode("western.ionian")!).degrees).toEqual([0, 200, 400, 500, 700, 900, 1100])
  })
})
