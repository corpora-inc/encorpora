import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { NpcRole, Quest, Scene } from "@corpan-city/contracts"
import {
  composeSystemPrompt,
  questFactsSection,
  type QuestFacts,
} from "../npc/promptProgram"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) =>
  JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

const roles = NpcRole.array().parse(content("npc/roles.json"))
const scene = Scene.parse(content("scenes/antigua-1770.json"))
const quest = Quest.parse(content("quests/es-guadalajara.json"))
const role = roles[0]
const learnerPair = quest.learnerPair

const FERRY_CLUE =
  "The boatman won't even look up: 'No token, no crossing. Ask around the market — someone always has a spare.'"

describe("special-NPC prompt FACTS wiring (§7)", () => {
  const facts: QuestFacts = {
    npcName: "Aldo the Boatman",
    npcRoleLabel: "the ferry boatman",
    stepLabel: "Cross at the docks",
    stepState: "needs-item",
    neededItemLabel: "Ferry Token",
    authoredClue: FERRY_CLUE,
    target: "Spanish",
    native: "English",
    maxSentences: 2,
  }

  it("questFactsSection contains the authored clue VERBATIM + the facts", () => {
    const block = questFactsSection(facts)
    expect(block).toContain(FERRY_CLUE) // authored line, re-voiced not invented
    expect(block).toContain("Aldo the Boatman")
    expect(block).toContain("Cross at the docks")
    expect(block).toContain("Situation: needs-item")
    expect(block).toContain("AT MOST 2 short sentences")
    expect(block).toContain("Never invent new quest facts")
  })

  it("ready-to-deliver branch re-voices the next hint, not the clue", () => {
    const block = questFactsSection({
      ...facts,
      stepState: "ready-to-deliver",
      authoredClue: undefined,
      authoredNextHint: "Now, the city gate opens at dawn — you'll need a pass.",
    })
    expect(block).toContain("city gate opens at dawn")
    expect(block).toContain("Warmly accept it")
    expect(block).not.toContain(FERRY_CLUE)
  })

  it("composeSystemPrompt INCLUDES the FACTS block when questFacts is present", () => {
    const prompt = composeSystemPrompt({ npcRole: role, scene, quest, learnerPair, questFacts: facts })
    expect(prompt).toContain(FERRY_CLUE)
    expect(prompt).toContain("QUEST CONTEXT (facts — obey exactly")
    expect(prompt).toContain("Situation: needs-item")
  })

  it("REGRESSION GUARD: a normal NPC (no questFacts, no clues) is UNCHANGED", () => {
    const base = composeSystemPrompt({ npcRole: role, scene, quest, learnerPair })
    const withEmptyClues = composeSystemPrompt({
      npcRole: role,
      scene,
      quest,
      learnerPair,
      clues: [],
      questFacts: undefined,
    })
    // The wiring is ADDITIVE: passing empty clues + no facts must be byte-identical
    // to the legacy call — generic crowd NPCs behave exactly as before.
    expect(withEmptyClues).toBe(base)
    // And the FACTS block must be absent.
    expect(base).not.toContain("QUEST CONTEXT (facts — obey exactly")
    expect(base).not.toContain(FERRY_CLUE)
  })

  it("clues lean (without facts) still injects the QUEST WHISPERS block", () => {
    const prompt = composeSystemPrompt({
      npcRole: role,
      scene,
      quest,
      learnerPair,
      clues: [FERRY_CLUE],
    })
    expect(prompt).toContain("QUEST WHISPERS")
    expect(prompt).toContain(FERRY_CLUE)
  })
})
