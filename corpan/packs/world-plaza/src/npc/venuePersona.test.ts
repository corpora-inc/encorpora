/**
 * #107 — Believable venue-typed NPC personas.
 *
 * Three regressions this proves (the owner saw a "dusk-loving lamplighter" giving
 * purple Spanish word-salad OUTSIDE THE CLINIC, saying "Soy un lamplighter"):
 *
 *  1. VENUE-FIT ROLE — a clinic/hospital anchor yields a MEDICAL role (doctor),
 *     a café anchor a barista, a station a conductor, etc. — driven by the VENUE
 *     anchor, NOT the seed/demeanor (a sleepy face must NOT make the clinic NPC a
 *     lamplighter).
 *  2. NO ENGLISH LEAK — the role injected into the system prompt is in (or neutral
 *     to) the TARGET language for a non-EN/ES pair; never a bare English trade noun
 *     like "lamplighter"/"barista" the 4B model parrots. The target-language
 *     DIRECTIVE is still present (it always was).
 *  3. COHERENCE / VENUE GROUNDING — the venue NPC's seed pins it to "you work right
 *     here and never deny it" so it can't contradict the venue it stands at.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { Scene, Quest } from "@world-plaza/contracts"
import {
  generatePersona,
  roleTermFor,
  archetypeIds,
  PERSONA_ARCHETYPES,
  type PersonaContext,
} from "./personaGen"
import { composeSystemPrompt, personaSeed } from "./promptProgram"
import { targetLanguageDirective } from "./promptLocale"
import type { CharacterSpec, Demeanor } from "../character/characterSpec"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) =>
  JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

const scene = Scene.parse(content("scenes/antigua-1770.json"))

/** A minimal CharacterSpec with a chosen demeanor — only `demeanor` is read by
 *  personaGen, so a thin cast keeps the test focused (mirrors crowd.ts usage). */
const specWith = (demeanor: Demeanor): CharacterSpec =>
  ({ demeanor }) as unknown as CharacterSpec

const persona = (anchorId: string, demeanor: Demeanor, target?: string) =>
  generatePersona(`t:${anchorId}:${demeanor}`, {
    scene,
    spec: specWith(demeanor),
    anchorId,
    target,
  } satisfies PersonaContext)

describe("#107 venue-typed NPC personas", () => {
  // ── MODERN catalogue (#107 era decision) — no colonial-1770 storybook trades ─
  it("the wandering catalogue is MODERN Corpan City — no colonial-1770 trades", () => {
    const ids = new Set(archetypeIds())
    // the old storybook trades must be gone (they read as nonsense in a modern city)
    for (const gone of [
      "lamplighter", "fishmonger", "scribe", "friar", "sailor", "dockhand",
      "merchant", "weaver", "herbalist", "water-seller", "flower-girl", "smuggler",
    ]) {
      expect(ids.has(gone), `colonial id "${gone}" should be removed`).toBe(false)
    }
    // and the modern, everyday Corpan City roles are present
    for (const want of [
      "baker", "vendor", "shopkeeper", "dog-walker", "student", "guide", "courier",
      "cook", "busker", "elder", "child", "cart-vendor", "office-worker", "barber",
      "florist", "commuter", "cyclist", "cleaner", "fixer",
    ]) {
      expect(ids.has(want), `modern id "${want}" should exist`).toBe(true)
    }
  })

  it("every archetype label is plausible modern-city (no quill/loom/friar/ferry words)", () => {
    const storybook = /\b(friar|scribe|lamplighter|fishmonger|weaver|loom|quill|ferry|smuggler|dockhand)\b/i
    for (const a of PERSONA_ARCHETYPES) {
      expect(storybook.test(a.label), `label "${a.label}"`).toBe(false)
    }
  })

  // ── (a) the venue drives the role — a clinic NPC is medical ────────────────
  it("a clinic/hospital anchor yields a MEDICAL role (not a wandering trade)", () => {
    for (const id of ["hospital", "clinic"]) {
      const p = persona(id, "friendly")
      expect(p.archetype).toBe("doctor")
      expect(p.venueRole).toBe(true)
    }
  })

  it("the venue WINS over the demeanor lean — a SLEEPY face at the clinic is STILL a doctor, never a lamplighter", () => {
    // `sleepy` is exactly the demeanor whose DEMEANOR_LEAN points at "lamplighter"
    // (the bug the owner saw). The venue override must beat it.
    const p = persona("hospital", "sleepy")
    expect(p.archetype).toBe("doctor")
    expect(p.archetype).not.toBe("lamplighter")
  })

  it("other venues map to fitting roles (café→barista, market→grocer, station→conductor, exchange→banker)", () => {
    expect(persona("cafe", "friendly").archetype).toBe("barista")
    expect(persona("plaza", "friendly").archetype).toBe("barista") // plaza café host quest
    expect(persona("market", "gruff").archetype).toBe("grocer")
    expect(persona("rail_station", "friendly").archetype).toBe("conductor")
    expect(persona("bus_station", "friendly").archetype).toBe("conductor")
    expect(persona("exchange", "sly").archetype).toBe("banker")
  })

  it("a normalised anchor (market_2, station_n) still resolves its venue role", () => {
    expect(persona("market_2", "friendly").archetype).toBe("grocer")
    expect(persona("station_n", "friendly").archetype).toBe("conductor")
  })

  it("an UNMAPPED anchor keeps a seed-chosen wandering trade (the colourful crowd is untouched)", () => {
    // harbor/bridge are intentionally NOT venue-mapped — they keep their old roles.
    const p = persona("harbor", "gruff")
    expect(p.venueRole).toBe(false)
    // and it's a real catalogue archetype, just not a forced venue one.
    expect(archetypeIds()).toContain(p.archetype)
  })

  // ── (b) NO ENGLISH LEAK for a non-EN/ES pair ───────────────────────────────
  it("the venue role is named in the TARGET language (ja) — never a bare English trade noun", () => {
    // ja has no authored ROLE_TERMS entry → must fall back to the language-NEUTRAL
    // venuePhrase ("the local who runs the … here"), which carries NO bare English
    // trade noun the model would parrot.
    const term = roleTermFor("doctor", "ja")
    expect(term).toBeTruthy()
    expect(term!.toLowerCase()).not.toContain("doctor") // no raw trade noun
    expect(term!.toLowerCase()).not.toContain("lamplighter")
    expect(term).toContain("clinic") // venue-grounded, not a trade label
  })

  it("an authored target (es) gets the in-language role noun", () => {
    expect(roleTermFor("doctor", "es")).toContain("médico")
    expect(roleTermFor("barista", "es")).toContain("barista del café")
  })

  it("the COMPOSED PROMPT for a non-EN/ES clinic NPC carries the target directive AND no raw English role noun", () => {
    // Build a real clinic-venue persona, then a real system prompt for a ja←en pair
    // (the explicit non-EN/ES case the lead asked to prove).
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const clinicNpc = persona("hospital", "sleepy", "ja")
    const prompt = composeSystemPrompt({
      npcRole: clinicNpc,
      scene,
      quest,
      learnerPair: { target: "ja", native: "en" },
    })
    // (1) the decisive target-language directive is present, IN Japanese.
    const directive = targetLanguageDirective("ja", false)
    expect(prompt).toContain(directive)
    expect(directive).toContain("日本語") // the ja endonym, in-script
    // (2) NO English trade noun leaks into the prompt's persona seed. These are the
    // exact words a 4B model parrots → "Soy un lamplighter". The clinic NPC's seed
    // must carry NONE of them.
    const seed = personaSeed(clinicNpc, scene, "ja")
    expect(prompt).toContain(seed)
    for (const banned of ["lamplighter", "barista", "doctor", "pharmacist", "conductor"]) {
      expect(seed.toLowerCase()).not.toContain(banned)
    }
    // (3) it IS venue-grounded so the model can't deny the clinic.
    expect(seed).toContain("clinic")
    expect(seed).toContain("never deny it")
  })

  // ── (c) coherence / grounding clause on venue roles only ───────────────────
  it("venue roles get the grounding clause; plain wandering NPCs do NOT", () => {
    const clinic = persona("hospital", "friendly", "es")
    const wanderer = persona("harbor", "gruff", "es")
    expect(personaSeed(clinic, scene, "es")).toContain("never deny it")
    expect(personaSeed(wanderer, scene, "es")).not.toContain("never deny it")
  })

  it("determinism — same (anchor, demeanor, target) rebuilds the same role", () => {
    const a = persona("cafe", "friendly", "fr")
    const b = persona("cafe", "friendly", "fr")
    expect(a.archetype).toBe(b.archetype)
    expect(a.name).toBe(b.name)
    expect(personaSeed(a, scene, "fr")).toBe(personaSeed(b, scene, "fr"))
  })
})
