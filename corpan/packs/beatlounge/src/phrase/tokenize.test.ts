import { describe, it, expect } from "vitest"
import { tokenizePhrase, isNoSpaceScript } from "./tokenize"

const texts = (s: string, lang?: string) => tokenizePhrase(s, lang).map((t) => t.text)

describe("tokenizePhrase — spaced scripts", () => {
  it("splits Latin on whitespace, keeping inner apostrophes", () => {
    expect(texts("let's go now", "en")).toEqual(["let's", "go", "now"])
  })

  it("strips leading/trailing punctuation but not accents", () => {
    expect(texts("¡Vamos, café!", "es")).toEqual(["Vamos", "café"])
  })

  it("collapses runs of whitespace and drops empties", () => {
    expect(texts("  cae   la  noche ", "es")).toEqual(["cae", "la", "noche"])
  })

  it("tokenizes Cyrillic on whitespace", () => {
    expect(texts("привет мир", "ru")).toEqual(["привет", "мир"])
  })

  it("indexes tokens in order from zero", () => {
    expect(tokenizePhrase("one two three", "en").map((t) => t.index)).toEqual([0, 1, 2])
  })

  it("returns empty for blank / whitespace input", () => {
    expect(tokenizePhrase("", "en")).toEqual([])
    expect(tokenizePhrase("   ", "en")).toEqual([])
  })
})

describe("tokenizePhrase — no-space scripts", () => {
  it("splits Han characters one per token (by lang hint)", () => {
    expect(texts("你好世界", "zh")).toEqual(["你", "好", "世", "界"])
  })

  it("splits Japanese kana/kanji per character", () => {
    expect(texts("こんにちは", "ja")).toEqual(["こ", "ん", "に", "ち", "は"])
  })

  it("splits Thai per character and drops spaces", () => {
    const out = texts("สวัสดี", "th")
    expect(out.length).toBeGreaterThan(1)
    expect(out.join("")).toBe("สวัสดี")
  })

  it("treats Korean as space-delimited (Hangul uses inter-word spaces)", () => {
    // A single Korean word stays one token; multi-word phrases split on spaces.
    expect(texts("안녕하세요", "ko")).toEqual(["안녕하세요"])
    expect(texts("안녕 세계", "ko")).toEqual(["안녕", "세계"])
  })
})

describe("isNoSpaceScript", () => {
  it("trusts the language hint for CJK codes", () => {
    expect(isNoSpaceScript("x", "zh")).toBe(true)
    expect(isNoSpaceScript("x", "ja")).toBe(true)
  })

  it("treats Latin / Cyrillic as spaced", () => {
    expect(isNoSpaceScript("hola mundo", "es")).toBe(false)
    expect(isNoSpaceScript("привет", "ru")).toBe(false)
  })

  it("sniffs the text when the lang is unknown", () => {
    expect(isNoSpaceScript("你好世界", "und")).toBe(true)
    expect(isNoSpaceScript("hello world", "und")).toBe(false)
  })
})
