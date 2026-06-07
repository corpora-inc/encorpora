import { describe, it, expect } from "vitest"
import { writeFileSync } from "node:fs"
import { promptLocales, targetLanguageDirective } from "./promptLocale"

const LATIN = /[A-Za-z]/
const SCRIPT: Record<string, RegExp> = {
  en: LATIN, es: LATIN, fr: LATIN, de: LATIN, it: LATIN, pt: LATIN, "pt-BR": LATIN,
  nl: LATIN, sv: LATIN, no: LATIN, da: LATIN, fi: LATIN, is: LATIN, pl: LATIN,
  cs: LATIN, sk: LATIN, sl: LATIN, lt: LATIN, hr: LATIN, "sr-Latn": LATIN, ro: LATIN, hu: LATIN, tr: LATIN,
  ca: LATIN, ga: LATIN, cy: LATIN, vi: LATIN, id: LATIN, ms: LATIN, tl: LATIN, sw: LATIN,
  ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, bg: /[Ѐ-ӿ]/, sr: /[Ѐ-ӿ]/,
  el: /[Ͱ-Ͽ]/,
  ar: /[؀-ۿ]/, fa: /[؀-ۿ]/, ur: /[؀-ۿ]/, "pa-Arab": /[؀-ۿݐ-ݿ]/,
  he: /[֐-׿]/,
  hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, ne: /[ऀ-ॿ]/,
  bn: /[ঀ-৿]/, pa: /[਀-੿]/, gu: /[઀-૿]/,
  ta: /[஀-௿]/, te: /[ఀ-౿]/, kn: /[ಀ-೿]/, ml: /[ഀ-ൿ]/,
  th: /[฀-๿]/,
  zh: /[一-鿿]/, "zh-Hans": /[一-鿿]/, "zh-Hant": /[一-鿿]/, yue: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/, "ko-polite": /[가-힯]/,
  am: /[ሀ-፿]/,
}

describe("promptLocale full-set script correctness", () => {
  it("every authored locale resolves + renders in its OWN expected script", () => {
    const probs: string[] = []
    const codes = Object.keys(promptLocales())
    for (const code of codes) {
      const re = SCRIPT[code]
      if (!re) {
        probs.push(`${code}: no expected-script rule`)
        continue
      }
      for (const single of [false, true]) {
        const d = targetLanguageDirective(code, single)
        const label = single ? "immersion" : "directive"
        if (!re.test(d)) probs.push(`${code} ${label}: wrong/missing script`)
        if (d.includes("{lang}")) probs.push(`${code} ${label}: unsubstituted {lang}`)
        if (re !== LATIN) {
          const ascii = (d.match(/[A-Za-z]/g) || []).length
          const non = (d.match(/[^\x00-\x7F]/g) || []).length
          if (ascii > non) probs.push(`${code} ${label}: ASCII-dominant (ascii=${ascii} non=${non})`)
        }
      }
    }
    writeFileSync(
      "/tmp/locale_report.txt",
      `codes=${codes.length}\n${codes.join(" ")}\nproblems:\n${probs.join("\n") || "(none)"}\n`,
    )
    expect(probs).toEqual([])
  })

  it("script-variant codes resolve to their OWN (different-script) entry, not the base", () => {
    expect(targetLanguageDirective("sr-Latn", false)).toMatch(/[A-Za-z]/)
    expect(targetLanguageDirective("sr-Latn", false)).not.toMatch(/[Ѐ-ӿ]/)
    expect(targetLanguageDirective("pa-Arab", false)).toMatch(/[؀-ۿ]/)
    expect(targetLanguageDirective("pa-Arab", false)).not.toMatch(/[਀-੿]/)
  })

  it("unknown + region subtags fall back correctly", () => {
    expect(targetLanguageDirective("xx", false)).toContain("Speak ONLY in")
    expect(targetLanguageDirective("es-MX", false)).toContain("Habla SOLO en español")
  })
})
