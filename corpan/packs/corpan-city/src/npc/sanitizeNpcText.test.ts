import { describe, it, expect } from "vitest"
import { sanitizeNpcText } from "./sanitizeNpcText"

describe("#79 sanitizeNpcText — strip emoji/pictographs, keep every real script", () => {
  it("strips the screenshot emoji and tidies the spacing", () => {
    expect(sanitizeNpcText("...frutas frescas! 🍓").trim()).toBe("...frutas frescas!")
    expect(sanitizeNpcText("Good job 👍 friend")).toBe("Good job friend")
  })

  it("strips multi-codepoint emoji: flags (regional pairs), skin-tone modifiers, ZWJ, keycaps", () => {
    expect(sanitizeNpcText("from 🇺🇸 today").trim()).toBe("from today")
    expect(sanitizeNpcText("thumbs 👍🏽 up")).toBe("thumbs up")
    expect(sanitizeNpcText("a family 👨‍👩‍👧 here").trim()).toBe("a family here")
    // A keycap (1️⃣ = "1" + VS16 + U+20E3): the decorative combiner/selector go, but
    // the DIGIT survives — never strip a plain number (that's the over-strip trap).
    expect(sanitizeNpcText("press 1️⃣ now").trim()).toBe("press 1 now")
    expect(sanitizeNpcText("love ❤️ it")).toBe("love it")
  })

  it("an all-emoji line collapses to blank (→ finalize trims → scripted fallback)", () => {
    expect(sanitizeNpcText("👍").trim()).toBe("")
    expect(sanitizeNpcText("😀😀😀").trim()).toBe("")
  })

  it("does NOT touch non-Latin scripts — CJK, Arabic, Devanagari, Japanese, Korean", () => {
    expect(sanitizeNpcText("你好，朋友")).toBe("你好，朋友")
    expect(sanitizeNpcText("مرحبا يا صديقي")).toBe("مرحبا يا صديقي")
    expect(sanitizeNpcText("नमस्ते दोस्त")).toBe("नमस्ते दोस्त")
    expect(sanitizeNpcText("こんにちは、友達")).toBe("こんにちは、友達")
    expect(sanitizeNpcText("안녕하세요 친구")).toBe("안녕하세요 친구")
  })

  it("keeps accented Latin, currency, digits, #/* and ordinary punctuation", () => {
    // `#`/`*`/digits are Emoji-ELIGIBLE, so a naive \p{Emoji} would wrongly strip
    // them — this proves we use \p{Extended_Pictographic} instead.
    expect(sanitizeNpcText("Un café cuesta €3.50, ¿sí? — «bien»")).toBe(
      "Un café cuesta €3.50, ¿sí? — «bien»",
    )
    expect(sanitizeNpcText("price is 3 # 5 * ok")).toBe("price is 3 # 5 * ok")
    expect(sanitizeNpcText("¥1,200 → ✓ done")).toBe("¥1,200 → ✓ done")
  })

  it("is idempotent (running twice == running once) and a no-op on clean text", () => {
    const dirty = "fresco 🍓 y rico 👍"
    expect(sanitizeNpcText(sanitizeNpcText(dirty))).toBe(sanitizeNpcText(dirty))
    expect(sanitizeNpcText("Hola, ¿cómo estás?")).toBe("Hola, ¿cómo estás?")
  })

  it("does NOT end-trim (streaming needs the trailing whitespace a token carries)", () => {
    // The runtime trims at finalize; mid-stream this must preserve the trailing
    // space/newline so `proseShown` length-diffing stays correct.
    expect(sanitizeNpcText("Bien hecho.\n")).toBe("Bien hecho.\n")
    expect(sanitizeNpcText("Hola 👍 ")).toBe("Hola ")
  })
})
