import { describe, it, expect } from "vitest"
import {
  entryLanguageRows,
  headlineRow,
  nativeGloss,
  comboBreakdown,
  discoveryLanguageCodes,
  joinerFor,
} from "./discoveryModel"
import type { EntryOut } from "../../sdk/types"

const entry: EntryOut = {
  entry_id: 1,
  level: "A1",
  domains: ["travel"],
  translations: [
    { language_code: "en", text: "she will explain it" },
    { language_code: "es", text: "ella lo explicará" },
    { language_code: "ja", text: "彼女が説明する", romanization: "kanojo ga setsumei suru" },
  ],
}

describe("entryLanguageRows", () => {
  it("returns one row per stack language present, native first, in stack order", () => {
    const rows = entryLanguageRows(entry, ["en", "es", "ja"])
    expect(rows.map((r) => r.code)).toEqual(["en", "es", "ja"])
    expect(rows[0].isNative).toBe(true)
    expect(rows[1].isNative).toBe(false)
    expect(rows[2].romanization).toBe("kanojo ga setsumei suru")
  })

  it("drops stack languages absent from the entry", () => {
    const rows = entryLanguageRows(entry, ["en", "fr", "es"])
    expect(rows.map((r) => r.code)).toEqual(["en", "es"])
  })
})

describe("headlineRow + nativeGloss", () => {
  it("headline prefers the first target language", () => {
    expect(headlineRow(entry, ["en", "es", "ja"])?.code).toBe("es")
  })
  it("nativeGloss is the first stack language's text", () => {
    expect(nativeGloss(entry, ["en", "es"])).toBe("she will explain it")
  })
})

describe("comboBreakdown", () => {
  it("produces the triangular n-gram bands for a spaced phrase", () => {
    const b = comboBreakdown("ella lo explicará", "es")
    expect(b.tokens).toEqual(["ella", "lo", "explicará"])
    expect(b.fullCount).toBe(6) // 3*4/2
    expect(b.shownCount).toBe(6)
    expect(b.bands.map((x) => x.n)).toEqual([1, 2, 3])
    expect(b.bands[0].combos.map((c) => c.text)).toEqual(["ella", "lo", "explicará"])
    expect(b.bands[1].combos.map((c) => c.text)).toEqual(["ella lo", "lo explicará"])
    expect(b.bands[2].combos.map((c) => c.text)).toEqual(["ella lo explicará"])
    expect(b.cappedAtN).toBeUndefined()
    expect(b.hiddenCount).toBe(0)
  })

  it("caps the longest bands and surfaces what was hidden", () => {
    const b = comboBreakdown("a b c d e", "es", 2)
    // 5 tokens fully = 15; capped at N=2 → N1(5)+N2(4)=9
    expect(b.fullCount).toBe(15)
    expect(b.shownCount).toBe(9)
    expect(b.cappedAtN).toBe(2)
    expect(b.hiddenCount).toBe(6)
    expect(b.bands.map((x) => x.n)).toEqual([1, 2])
  })

  it("uses no joiner for CJK", () => {
    expect(joinerFor("彼女", "ja")).toBe("")
    expect(joinerFor("hola", "es")).toBe(" ")
  })
})

describe("discoveryLanguageCodes", () => {
  it("returns all stack languages, de-duped, order preserved", () => {
    const codes = discoveryLanguageCodes({
      languages: ["en", "es", "EN", "ja"],
      domains: [],
      levels: [],
      rate: 1,
      textSize: "m",
      showRomanization: true,
    })
    expect(codes).toEqual(["en", "es", "ja"])
  })
})
