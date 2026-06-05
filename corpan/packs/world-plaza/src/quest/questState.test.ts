// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { Quest } from "@world-plaza/contracts"
import { createInventory } from "../economy/inventory"
import { createQuestEngine } from "./questState"
import { resolveStepContent, challengeSatisfiesStep, isTalkOnlyStep } from "./questContent"
import guadalajaraJson from "../../content/quests/es-guadalajara.json"
import cafeJson from "../../content/quests/es-cafe.json"

const QUEST = Quest.parse(guadalajaraJson)

function freshEngine() {
  localStorage.clear()
  const inventory = createInventory()
  inventory.reset()
  const engine = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
  return { engine, inventory }
}

describe("QuestEngine — es-guadalajara-route (#26: deterministic, always-completable)", () => {
  beforeEach(() => localStorage.clear())

  it("step 1 (docks) is a talk-challenge, gated needs-challenge until beaten — NO item gate", () => {
    const { engine } = freshEngine()
    const step = engine.currentStep()
    expect(step?.id).toBe("docks")
    expect(step?.kind ?? "talk").toBe("talk")
    expect(step?.toolId).toBe("translate-fast") // mic-free gate — winnable without STT
    // No inventory rule anymore → the only gate is the challenge-beaten flag.
    expect(engine.stepState("docks")).toBe("needs-challenge")
    expect(engine.isStepSatisfied("docks")).toBe(false)
    expect(engine.advance("docks")).toBe(false) // refused until beaten
  })

  it("step 2 (gate) is a TRAVERSE step — completed by REACHING it, no challenge/item", () => {
    const { engine } = freshEngine()
    // Beat + advance the talk step to reach the traverse step.
    expect(challengeSatisfiesStep(QUEST.steps[0], "translate-fast", 0.9)).toBe(true)
    engine.markStepBeaten("docks")
    expect(engine.advance("docks")).toBe(true)

    const gate = engine.currentStep()
    expect(gate?.id).toBe("gate")
    expect(gate?.kind).toBe("traverse")
    // A traverse step reports needs-challenge ("go here") until reached, and is
    // NOT satisfied by inventory — the proximity trigger sets the beaten flag.
    expect(engine.stepState("gate")).toBe("needs-challenge")
    expect(engine.isStepSatisfied("gate")).toBe(false)
    expect(engine.advance("gate")).toBe(false) // can't advance before arrival

    // Reaching the bridge marks it beaten → satisfied → advance completes.
    engine.markStepBeaten("gate")
    expect(engine.stepState("gate")).toBe("ready-to-deliver")
    expect(engine.isStepSatisfied("gate")).toBe(true)
  })

  it("full playthrough: talk-win → traverse-reach → COMPLETE + reward once", () => {
    const { engine, inventory } = freshEngine()
    const xpBefore = inventory.xp()
    let completeFired = 0
    engine.subscribe((e) => {
      if (e.type === "complete") completeFired++
    })

    // Step 1: win the talk challenge.
    engine.markStepBeaten("docks")
    expect(engine.advance("docks")).toBe(true)
    expect(engine.currentStep()?.id).toBe("gate")

    // Step 2: reach the bridge (traverse).
    engine.markStepBeaten("gate")
    expect(engine.advance("gate")).toBe(true)

    expect(engine.state().complete).toBe(true)
    expect(completeFired).toBe(1)
    expect(inventory.xp()).toBe(xpBefore + 80)
    expect(inventory.coins()).toBe(20)
    expect(inventory.has("map-scrap")).toBe(true)

    // Idempotent: re-advancing a done step does nothing.
    expect(engine.advance("gate")).toBe(false)
    expect(inventory.coins()).toBe(20)
  })

  it("getQuestMarkers points at the current objective anchor (harbor → bridge)", () => {
    const { engine } = freshEngine()
    expect(engine.getQuestMarkers().some((m) => m.kind === "objective" && m.anchorId === "harbor")).toBe(true)
    engine.markStepBeaten("docks")
    engine.advance("docks")
    expect(engine.getQuestMarkers().some((m) => m.kind === "objective" && m.anchorId === "bridge_n")).toBe(true)
  })

  it("persists across engine re-instantiation (same quest)", () => {
    const inventory = createInventory()
    localStorage.clear()
    inventory.reset()
    const e1 = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
    e1.markStepBeaten("docks")
    e1.advance("docks")
    expect(e1.state().stepDone["docks"]).toBe(true)

    const e2 = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
    expect(e2.state().stepDone["docks"]).toBe(true)
    expect(e2.currentStep()?.id).toBe("gate")
  })
})

const CAFE = Quest.parse(cafeJson)

describe("QuestEngine — challenge-gated step (no inventory rule) requires markStepBeaten", () => {
  beforeEach(() => localStorage.clear())

  function cafeEngine() {
    localStorage.clear()
    const inventory = createInventory()
    inventory.reset()
    const engine = createQuestEngine({ quest: CAFE, inventory, playerId: "player-local" })
    return { engine, inventory }
  }

  it("the entry quest is ONE challenge step, gated needs-challenge until beaten", () => {
    const { engine } = cafeEngine()
    expect(CAFE.steps).toHaveLength(1)
    const step = engine.currentStep()
    expect(step?.id).toBe("order-coffee")
    expect(step?.toolId).toBe("translate-fast") // mic-free gate — winnable without STT
    // No inventory rule for this quest's step → state is "needs-challenge".
    expect(engine.stepState("order-coffee")).toBe("needs-challenge")
    expect(engine.isStepSatisfied("order-coffee")).toBe(false)
    expect(engine.isStepBeaten("order-coffee")).toBe(false)
  })

  it("advance() is REFUSED until the challenge is marked beaten", () => {
    const { engine } = cafeEngine()
    // The model (or a stray caller) can't move the gate without the beaten flag.
    expect(engine.advance("order-coffee")).toBe(false)
    expect(engine.state().complete).toBe(false)

    // The deterministic challenge referee agrees → mark beaten, THEN advance.
    expect(challengeSatisfiesStep(CAFE.steps[0], "translate-fast", 0.9)).toBe(true)
    engine.markStepBeaten("order-coffee")
    expect(engine.isStepBeaten("order-coffee")).toBe(true)
    expect(engine.stepState("order-coffee")).toBe("ready-to-deliver")
    expect(engine.isStepSatisfied("order-coffee")).toBe(true)

    let completeFired = 0
    engine.subscribe((e) => {
      if (e.type === "complete") completeFired++
    })
    expect(engine.advance("order-coffee")).toBe(true)
    expect(engine.state().complete).toBe(true)
    expect(completeFired).toBe(1)
  })

  it("the beaten flag persists across engine re-instantiation", () => {
    const inventory = createInventory()
    localStorage.clear()
    inventory.reset()
    const e1 = createQuestEngine({ quest: CAFE, inventory, playerId: "player-local" })
    e1.markStepBeaten("order-coffee")
    expect(e1.isStepBeaten("order-coffee")).toBe(true)

    const e2 = createQuestEngine({ quest: CAFE, inventory, playerId: "player-local" })
    expect(e2.isStepBeaten("order-coffee")).toBe(true)
    expect(e2.isStepSatisfied("order-coffee")).toBe(true)
  })

  it("markStepBeaten is idempotent + notifies subscribers", () => {
    const { engine } = cafeEngine()
    let changes = 0
    engine.subscribe((e) => {
      if (e.type === "change") changes++
    })
    engine.markStepBeaten("order-coffee")
    engine.markStepBeaten("order-coffee") // no-op the second time
    expect(changes).toBe(1)
  })
})

describe("questContent — talk-only step helper", () => {
  it("isTalkOnlyStep is true only with no toolId and no required items", () => {
    expect(isTalkOnlyStep({ id: "x", label: "" }, 0)).toBe(true)
    expect(isTalkOnlyStep({ id: "x", label: "", toolId: "repeat-after" }, 0)).toBe(false)
    expect(isTalkOnlyStep({ id: "x", label: "" }, 1)).toBe(false)
  })
})

describe("questContent — step → challenge binding", () => {
  it("resolveStepContent pins the step's entryIds + quest domain", () => {
    const step = QUEST.steps[0]
    const content = resolveStepContent(QUEST, step)
    expect(content.entryIds).toEqual([1008, 1023])
    expect(content.domain).toBe("travel")
    expect(content.levels).toContain("A1")
    expect(content.languageCodes).toContain("es")
  })

  it("resolveStepContent falls back to selector-only when step has no entryIds", () => {
    const content = resolveStepContent(QUEST, null)
    expect(content.entryIds).toEqual([])
    expect(content.domain).toBe("travel")
  })

  it("challengeSatisfiesStep gates on matching tool + score threshold", () => {
    const step = QUEST.steps[0] // toolId: translate-fast (mic-free gate)
    expect(challengeSatisfiesStep(step, "translate-fast", 0.9)).toBe(true)
    expect(challengeSatisfiesStep(step, "translate-fast", 0.3)).toBe(false) // below threshold
    expect(challengeSatisfiesStep(step, "repeat-after", 0.9)).toBe(false) // wrong tool
  })
})

describe("QuestEngine — per-pair progress isolation (#42)", () => {
  beforeEach(() => localStorage.clear())

  it("each Track (native:target) keeps its OWN quest progress", () => {
    const CAFE = Quest.parse(cafeJson)
    // Pair A (en:es): win the café step.
    const invA = createInventory()
    invA.reset()
    const a = createQuestEngine({ quest: CAFE, inventory: invA, playerId: "p", trackId: "en:es" })
    a.markStepBeaten("order-coffee")
    a.advance("order-coffee")
    expect(a.state().complete).toBe(true)

    // Pair B (en:fr): a FRESH journey — pair A's progress must NOT leak in.
    const invB = createInventory()
    invB.reset()
    const b = createQuestEngine({ quest: CAFE, inventory: invB, playerId: "p", trackId: "en:fr" })
    expect(b.state().complete).toBe(false)
    expect(b.isStepBeaten("order-coffee")).toBe(false)

    // Reopening pair A still sees its completed progress (separate key).
    const a2 = createQuestEngine({ quest: CAFE, inventory: invA, playerId: "p", trackId: "en:es" })
    expect(a2.state().complete).toBe(true)
  })

  it("the no-trackId (legacy/global) key is distinct from any pair key", () => {
    const CAFE = Quest.parse(cafeJson)
    const inv = createInventory()
    inv.reset()
    const legacy = createQuestEngine({ quest: CAFE, inventory: inv, playerId: "p" })
    legacy.markStepBeaten("order-coffee")
    legacy.advance("order-coffee")
    expect(legacy.state().complete).toBe(true)
    // A pair-keyed engine does NOT inherit the legacy global progress.
    const paired = createQuestEngine({ quest: CAFE, inventory: createInventory(), playerId: "p", trackId: "en:es" })
    expect(paired.state().complete).toBe(false)
  })
})
