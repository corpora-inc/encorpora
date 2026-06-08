import { describe, expect, it } from "vitest"
import {
  runtimeLanguageText,
  scriptedFallbackLine,
  genericSegueText,
} from "./runtimeLanguageText"
import {
  resolveSegue,
  segueChipLabel,
  segueTag,
} from "./challengeSegues"

const WRONG_LANGUAGE_FR = [
  "Buenos",
  "Bienvenido",
  "Hola",
  "Jugar",
  "Play",
  "traveler",
  "challenge",
]

describe("NPC target-language runtime text", () => {
  it("binds French NPC runtime text to French, not the previous Spanish stack", () => {
    const text = runtimeLanguageText("fr")
    expect(text.greetingSeed).toContain("français")
    expect(text.antiRepeat).toContain("{lines}")
    expect(text.fallback.join(" ")).toMatch(/Bonjour|ville|Reviens/)

    const renderedFallback = scriptedFallbackLine(
      "fr",
      0,
      "¡Buenos días! ¿Un café con pan dulce?",
    )
    expect(renderedFallback).toContain("Bonjour")
    for (const leak of WRONG_LANGUAGE_FR) {
      expect(renderedFallback).not.toContain(leak)
    }
  })

  it("resolves exact app stack aliases without dropping to English", () => {
    expect(runtimeLanguageText("zh-Hans").greetingSeed).toMatch(/中文/)
    expect(runtimeLanguageText("pt-BR").greetingSeed).toMatch(/português/i)
    expect(runtimeLanguageText("ko-polite").greetingSeed).toMatch(/한국어/)
    expect(runtimeLanguageText("pa-Guru").greetingSeed).toMatch(/ਪੰਜਾਬ/)
  })

  it("uses target-language generic challenge handoffs when a per-tool locale is absent", () => {
    const generic = genericSegueText("fr")
    expect(generic.chip).toBe("Jouer")
    expect(generic.phrases[0]).toContain("jeu")

    expect(segueTag("word-scramble", "fr")).toBe(generic.tag)
    expect(segueChipLabel("word-scramble", "fr")).toBe(generic.chip)
    const segue = resolveSegue("word-scramble", "fr", 0)
    expect(generic.phrases).toContain(segue)
    for (const leak of WRONG_LANGUAGE_FR) {
      expect(segue).not.toContain(leak)
    }
  })
})
