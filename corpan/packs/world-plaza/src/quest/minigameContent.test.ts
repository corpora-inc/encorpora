import { describe, it, expect } from "vitest"
import { Quest, type NpcRole } from "@world-plaza/contracts"
import {
  resolveMinigameContent,
  npcDomains,
  ARCHETYPE_DOMAIN_AFFINITY,
} from "./minigameContent"
import { PERSONA_ARCHETYPES } from "../npc/personaGen"
import cafeJson from "../../content/quests/es-cafe.json"
import directionsJson from "../../content/quests/es-directions.json"

/**
 * The content-resolution layer: every minigame should draw RICH, VARIED, RELEVANT
 * phrases tied to WHO the player talks to (the NPC's trade → corpus domains) and
 * WHAT the quest is about (its theme + the step's authored ids), scaled to the
 * player's CEFR level — instead of the same six fixed phrases.
 */

const CAFE = Quest.parse(cafeJson)
const DIRECTIONS = Quest.parse(directionsJson)

/** Build a minimal NpcRole carrying an archetype (a GeneratedPersona superset). */
function persona(archetype: string): NpcRole {
  return {
    id: `crowd:${archetype}:1`,
    anchorId: `crowd:${archetype}:1`,
    basePersona: { tone: "warm", quirks: [] },
    scriptedFallback: [],
    // enrichment field the resolver reads (additive; runtime ignores it)
    archetype,
  } as unknown as NpcRole
}

describe("npcDomains — NPC trade → real corpus domains", () => {
  it("maps a baker to everyday/numbers (food + prices)", () => {
    expect(npcDomains(persona("baker"))).toEqual(["everyday", "numbers", "social"])
  })

  it("maps a boatman-ish sailor/dockhand to travel", () => {
    expect(npcDomains(persona("sailor"))[0]).toBe("travel")
    expect(npcDomains(persona("dockhand"))).toContain("travel")
  })

  it("maps a scribe to business/civic (paperwork)", () => {
    expect(npcDomains(persona("scribe"))).toContain("business")
    expect(npcDomains(persona("scribe"))).toContain("civic")
  })

  it("returns [] for an authored role with no archetype", () => {
    const bare: NpcRole = {
      id: "boatman",
      anchorId: "docks",
      basePersona: { tone: "gruff", quirks: [] },
      scriptedFallback: [],
    }
    expect(npcDomains(bare)).toEqual([])
  })

  it("returns [] for an unknown archetype (no throw)", () => {
    expect(npcDomains(persona("dragon-rider"))).toEqual([])
  })

  it("returns [] for null/undefined", () => {
    expect(npcDomains(null)).toEqual([])
    expect(npcDomains(undefined)).toEqual([])
  })

  it("covers EVERY persona archetype with a domain affinity", () => {
    // Every generated archetype must map to at least one real corpus domain so no
    // NPC falls through to fully-generic content.
    for (const a of PERSONA_ARCHETYPES) {
      expect(ARCHETYPE_DOMAIN_AFFINITY[a.id], `archetype ${a.id}`).toBeTruthy()
      expect(ARCHETYPE_DOMAIN_AFFINITY[a.id].length).toBeGreaterThan(0)
    }
  })

  it("only ever yields REAL corpus domain codes", () => {
    const REAL = new Set([
      "everyday", "travel", "business", "health", "education", "social",
      "housing", "environment", "emergency", "civic", "numbers", "technology", "culture",
    ])
    for (const a of PERSONA_ARCHETYPES) {
      for (const d of ARCHETYPE_DOMAIN_AFFINITY[a.id]) {
        expect(REAL.has(d), `${a.id} → ${d}`).toBe(true)
      }
    }
  })
})

describe("resolveMinigameContent — blend NPC × quest × level", () => {
  it("keeps the step's authored entryIds as the cohesive CORE", () => {
    const step = CAFE.steps[0]
    const content = resolveMinigameContent(persona("baker"), CAFE, step)
    expect(content.coreEntryIds).toEqual(step.entryIds)
  })

  it("scales to the player via the quest's CEFR levels", () => {
    const content = resolveMinigameContent(persona("baker"), CAFE, CAFE.steps[0])
    expect(content.filter.levels).toEqual(["A1", "A2"])
  })

  it("constrains to the TARGET language only (single-language safe)", () => {
    const content = resolveMinigameContent(persona("baker"), CAFE, CAFE.steps[0])
    expect(content.filter.languageCodes).toEqual(["es"])
    // never a native gate — only the target code(s) the quest pins
    expect(content.filter.languageCodes).not.toContain("en")
  })

  it("blends the quest theme (travel) FIRST, then the NPC trade for variety", () => {
    // es-cafe selector domains: ["travel","food"] — only "travel" is a real corpus
    // code; "food" is dropped. A baker adds everyday/numbers/social. Quest theme
    // leads, NPC trade follows.
    const content = resolveMinigameContent(persona("baker"), CAFE, CAFE.steps[0])
    expect(content.filter.domains?.[0]).toBe("travel") // quest theme first
    expect(content.filter.domains).toContain("everyday") // baker variety
    expect(content.filter.domains).toContain("numbers")
    expect(content.filter.domains).not.toContain("food") // not a real corpus domain
  })

  it("a DIRECTIONS quest pulls travel phrases regardless of NPC", () => {
    const content = resolveMinigameContent(persona("scribe"), DIRECTIONS, DIRECTIONS.steps[0])
    expect(content.filter.domains).toContain("travel")
  })

  it("de-dupes when the NPC trade overlaps the quest theme", () => {
    // a sailor's trade leads with travel, same as the directions quest theme.
    const content = resolveMinigameContent(persona("sailor"), DIRECTIONS, DIRECTIONS.steps[0])
    const travels = (content.filter.domains ?? []).filter((d) => d === "travel")
    expect(travels.length).toBe(1)
  })

  it("falls back to the NPC's domains when the quest pins none usable", () => {
    // Synthesize a quest whose selector domains are all non-corpus labels so only
    // the NPC's trade can carry the theme.
    const q = Quest.parse({
      ...cafeJson,
      promptProgram: {
        ...cafeJson.promptProgram,
        contentSelector: { levels: ["A1"], domains: ["food", "shopping"], languageCodes: ["es"] },
      },
    })
    const content = resolveMinigameContent(persona("herbalist"), q, q.steps[0])
    // herbalist → health/environment/everyday; none of food/shopping survive.
    expect(content.filter.domains?.[0]).toBe("health")
    expect(content.filter.domains).not.toContain("food")
  })

  it("leaves domains UNSET (unfiltered draw) when nothing resolves", () => {
    const q = Quest.parse({
      ...cafeJson,
      promptProgram: {
        ...cafeJson.promptProgram,
        contentSelector: { levels: ["A1"], domains: ["food"], languageCodes: ["es"] },
      },
    })
    // a bare authored role (no archetype) + non-corpus quest domains → no filter
    const bare: NpcRole = {
      id: "x",
      anchorId: "x",
      basePersona: { tone: "", quirks: [] },
      scriptedFallback: [],
    }
    const content = resolveMinigameContent(bare, q, q.steps[0])
    expect(content.filter.domains).toBeUndefined()
    // level still scales the (now unfiltered) draw
    expect(content.filter.levels).toEqual(["A1"])
  })

  it("handles a null step (no active step) — selector-only, no core ids", () => {
    const content = resolveMinigameContent(persona("baker"), CAFE, null)
    expect(content.coreEntryIds).toEqual([])
    expect(content.filter.domains).toContain("travel")
  })
})
