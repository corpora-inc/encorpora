import { describe, it, expect } from "vitest"
import { languageLabel } from "./langLabel"

describe("languageLabel", () => {
  it("resolves a known code to a readable name (when Intl.DisplayNames present)", () => {
    // happy-dom / node both ship Intl.DisplayNames; assert it's not just the code.
    const es = languageLabel("es", "en")
    expect(es.toLowerCase()).toContain("span")
  })

  it("falls back to the uppercased code for empty/unknown input", () => {
    expect(languageLabel("")).toBe("")
    // an obviously-bogus subtag has no display name → bare code.
    expect(languageLabel("zz-not-real")).toBe("ZZ-NOT-REAL".toUpperCase())
  })

  it("handles script/region subtags by falling back to the base language", () => {
    const zh = languageLabel("zh-hant", "en")
    expect(zh.toLowerCase()).toContain("chinese")
  })
})
