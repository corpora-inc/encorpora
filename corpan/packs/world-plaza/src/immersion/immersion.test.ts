import { describe, it, expect } from "vitest"
import {
  createImmersionResolver,
  immersionToggleApplies,
  nextImmersionLevel,
} from "./immersion"
import type { LearnerPair } from "@world-plaza/contracts"

const EN_ES: LearnerPair = { native: "en", target: "es" }
const ES_ES: LearnerPair = { native: "es", target: "es" } // single-language (immersion)
const AR_EN: LearnerPair = { native: "ar", target: "en" }

describe("createImmersionResolver — off/reveal/on × pair matrix", () => {
  it("off: native shown, UI in native, challenge keeps native gloss", () => {
    const r = createImmersionResolver({ level: "off", learnerPair: EN_ES })
    expect(r.level()).toBe("off")
    expect(r.hideNative()).toBe(false)
    expect(r.uiLocale()).toBe("en")
    expect(r.challengeNativeLanguage()).toBe("en")
    expect(r.offerReveal()).toBe(false)
    expect(r.proactiveReveal()).toBe(false)
  })

  it("on: native hidden, UI flips to TARGET everywhere, challenge drops native", () => {
    const r = createImmersionResolver({ level: "on", learnerPair: EN_ES })
    expect(r.hideNative()).toBe(true)
    expect(r.uiLocale()).toBe("es") // the owner's ask: target EVERYWHERE
    expect(r.challengeNativeLanguage()).toBeUndefined()
    expect(r.offerReveal()).toBe(true)
    expect(r.proactiveReveal()).toBe(false)
  })

  it("reveal: hides native by default but nudges the reveal hatch", () => {
    const r = createImmersionResolver({ level: "reveal", learnerPair: EN_ES })
    expect(r.hideNative()).toBe(true)
    expect(r.uiLocale()).toBe("es")
    expect(r.challengeNativeLanguage()).toBeUndefined()
    expect(r.offerReveal()).toBe(true)
    expect(r.proactiveReveal()).toBe(true) // only reveal nudges
  })

  it("an AR-native learning EN with immersion ON → whole UI in English, RTL-off", () => {
    const r = createImmersionResolver({ level: "on", learnerPair: AR_EN })
    expect(r.uiLocale()).toBe("en") // target = en → UI English (and dir becomes ltr)
  })

  it("single-language Track is FORCED on regardless of stored level", () => {
    for (const level of ["off", "reveal", "on"] as const) {
      const r = createImmersionResolver({ level, learnerPair: ES_ES })
      expect(r.level()).toBe("on")
      expect(r.hideNative()).toBe(true)
      expect(r.uiLocale()).toBe("es")
      expect(r.challengeNativeLanguage()).toBeUndefined()
    }
  })

  it("languageDiscipline drops the gloss-permission clause under immersion", () => {
    const off = createImmersionResolver({ level: "off", learnerPair: EN_ES })
    const on = createImmersionResolver({ level: "on", learnerPair: EN_ES })
    expect(off.languageDiscipline("Spanish", "English")).toContain("gloss")
    expect(on.languageDiscipline("Spanish", "English")).toContain("Do NOT translate")
    expect(on.languageDiscipline("Spanish", "English")).not.toContain("gloss in parentheses")
  })

  it("resolveStrings picks target under immersion, native otherwise / when keepNative", () => {
    const on = createImmersionResolver({ level: "on", learnerPair: EN_ES })
    expect(on.resolveStrings("EN", "ES")).toBe("ES")
    expect(on.resolveStrings("EN", "ES", { keepNative: true })).toBe("EN") // Leave-confirm exception
    const off = createImmersionResolver({ level: "off", learnerPair: EN_ES })
    expect(off.resolveStrings("EN", "ES")).toBe("EN")
  })
})

describe("toggle helpers", () => {
  it("immersionToggleApplies hides the control for a single-language Track", () => {
    expect(immersionToggleApplies(EN_ES)).toBe(true)
    expect(immersionToggleApplies(ES_ES)).toBe(false)
  })
  it("nextImmersionLevel cycles off ⇄ on", () => {
    expect(nextImmersionLevel("off")).toBe("on")
    expect(nextImmersionLevel("on")).toBe("off")
    expect(nextImmersionLevel("reveal")).toBe("off")
  })
})
