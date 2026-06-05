// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { allQuests, getQuest, nextQuests } from "./questCatalog"
import { hasQuestString, questTitleKey, questStepKey } from "../i18n/quests"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) =>
  JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

/** The anchors the LIVE city (generateCity.ts) actually produces — the only ids a
 *  step may target so its objective NPC + beacon land on a real spot. */
const CITY_ANCHORS = new Set([
  "plaza",
  "fountain",
  "market",
  "harbor",
  "station",
  "hospital",
  "bridge_n",
  "bridge_s",
])

/** STT (mic) tools — a BEGINNER step must NOT gate on these (the unwinnable-mic-gate
 *  bug). `repeat-after`/`pronunciation-duel` alias to STT tools too. */
const MIC_TOOLS = new Set([
  "say-it-back",
  "read-aloud",
  "repeat-after",
  "pronunciation-duel",
])

/** Valid item ids for `rewards.grant` (the economy catalog). */
const ITEM_IDS = new Set<string>(
  (content("items/catalog.json").items as Array<{ id: string }>).map((i) => i.id),
)

// The NEW pair-agnostic catalog ids (the legacy es-* quests keep their own keyed
// path + are exercised elsewhere; these are the QUESTS-AT-SCALE additions).
const NEW_IDS = [
  "plaza-greetings",
  "plaza-cafe-order",
  "plaza-business",
  "market-numbers",
  "market-groceries",
  "fountain-directions",
  "fountain-meetup",
  "harbor-ferry-ride",
  "harbor-fishmonger",
  "harbor-route-master",
  "station-departures",
  "civic-cityhall",
  "civic-clinic",
  "bridge-crossing",
]

describe("QUESTS-AT-SCALE — the expanded catalog", () => {
  it("registers a large, varied catalog (legacy + new)", () => {
    const ids = allQuests().map((q) => q.id)
    expect(ids.length).toBeGreaterThanOrEqual(16)
    for (const id of NEW_IDS) expect(ids, id).toContain(id)
  })

  it("spans many scenes + domains (breadth, not repetition)", () => {
    const quests = allQuests()
    const anchors = new Set<string>()
    const domains = new Set<string>()
    for (const q of quests) {
      domains.add(q.domain)
      for (const s of q.steps) if (s.anchorId) anchors.add(s.anchorId)
    }
    // Every scene anchor is touched by at least one quest.
    for (const a of ["plaza", "market", "fountain", "harbor", "station", "hospital", "bridge_n"]) {
      expect(anchors, a).toContain(a)
    }
    // A wide domain spread.
    for (const d of ["greetings", "food", "market", "directions", "social", "travel", "transit", "civic", "health", "business"]) {
      expect(domains, d).toContain(d)
    }
    expect(domains.size).toBeGreaterThanOrEqual(8)
  })

  it("every quest is well-formed: real anchors + declared domain+levels", () => {
    for (const q of allQuests()) {
      expect(q.domain.length, q.id).toBeGreaterThan(0)
      for (const s of q.steps) {
        if (s.anchorId) {
          expect(CITY_ANCHORS.has(s.anchorId), `${q.id}/${s.id} anchor ${s.anchorId}`).toBe(true)
        }
      }
      // The phrase resolver consumes domain + levels — every quest must declare both.
      expect(q.promptProgram.contentSelector.domains?.length ?? 0, q.id).toBeGreaterThan(0)
      expect(q.promptProgram.contentSelector.levels?.length ?? 0, q.id).toBeGreaterThan(0)
    }
  })

  it("NEW quests grant only REAL economy items (no placeholder grants)", () => {
    for (const id of NEW_IDS) {
      for (const g of getQuest(id)!.rewards.grant ?? []) {
        expect(ITEM_IDS.has(g), `${id} grants unknown item ${g}`).toBe(true)
      }
    }
  })

  it("NEW quests are pair-agnostic: no hardcoded entryIds (vocab from the corpus)", () => {
    for (const id of NEW_IDS) {
      const q = getQuest(id)!
      for (const s of q.steps) {
        expect(s.entryIds, `${id}/${s.id} must not pin corpus ids`).toBeUndefined()
      }
    }
  })

  it("BEGINNER scaffolds never gate on a mic tool (winnable by tapping)", () => {
    for (const q of allQuests()) {
      if (q.promptProgram.scaffold !== "beginner") continue
      for (const s of q.steps) {
        if (s.toolId) {
          expect(MIC_TOOLS.has(s.toolId), `${q.id}/${s.id} beginner mic gate ${s.toolId}`).toBe(false)
        }
      }
    }
  })

  it("a mic (speak) gate appears ONLY as a capstone in an explicitly-advanced quest", () => {
    for (const q of allQuests()) {
      for (let i = 0; i < q.steps.length; i++) {
        const s = q.steps[i]
        if (s.toolId && MIC_TOOLS.has(s.toolId)) {
          expect(q.promptProgram.scaffold, `${q.id}/${s.id}`).toBe("advanced")
          // The first step must be reachable WITHOUT a mic (never block the start).
          expect(i, `${q.id} opens on a mic gate`).toBeGreaterThan(0)
        }
      }
    }
  })

  it("every quest forks a non-empty next branch (the journey never dead-ends)", () => {
    for (const q of allQuests()) {
      const next = nextQuests(q.id)
      expect(next.length, q.id).toBeGreaterThan(0)
      expect(next.map((n) => n.id), q.id).not.toContain(q.id)
    }
  })

  it("every NEW quest's title + step labels are KEYED in the en catalog", () => {
    for (const id of NEW_IDS) {
      const q = getQuest(id)!
      expect(hasQuestString(questTitleKey(id), "en"), `${id} title key`).toBe(true)
      for (const s of q.steps) {
        expect(hasQuestString(questStepKey(id, s.id), "en"), `${id}/${s.id} step key`).toBe(true)
      }
    }
  })

  it("authored nextQuestIds all resolve to real quests (no dangling forks)", () => {
    for (const q of allQuests()) {
      for (const id of q.nextQuestIds ?? []) {
        expect(getQuest(id), `${q.id} → ${id}`).toBeDefined()
      }
    }
  })
})
