// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { Quest } from "@world-plaza/contracts"
import { createInventory } from "../economy/inventory"
import {
  createQuestEngine,
  authoredClueForStep,
  authoredNextHint,
} from "./questState"
import { resolveStepContent, challengeSatisfiesStep, isTalkOnlyStep } from "./questContent"
import guadalajaraJson from "../../content/quests/es-guadalajara.json"
import cafeJson from "../../content/quests/es-cafe.json"

const QUEST = Quest.parse(guadalajaraJson)
const FERRY = "ferry-token"
const GATE = "city-gate-pass"

function freshEngine() {
  localStorage.clear()
  const inventory = createInventory()
  inventory.reset()
  const engine = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
  return { engine, inventory }
}

describe("QuestEngine — es-guadalajara-route state machine", () => {
  beforeEach(() => localStorage.clear())

  it("starts on the first step, needs-item (no ferry token held)", () => {
    const { engine } = freshEngine()
    const step = engine.currentStep()
    expect(step?.id).toBe("docks")
    expect(engine.stepState("docks")).toBe("needs-item")
    expect(engine.currentStepState()).toBe("needs-item")
    expect(engine.isStepSatisfied("docks")).toBe(false)
    expect(engine.state().complete).toBe(false)
  })

  it("flips needs-item → ready-to-deliver when the ferry token is granted", () => {
    const { engine, inventory } = freshEngine()
    expect(engine.stepState("docks")).toBe("needs-item")
    inventory.grant(FERRY)
    expect(engine.stepState("docks")).toBe("ready-to-deliver")
    expect(engine.isStepSatisfied("docks")).toBe(true)
  })

  it("advance() is DETERMINISTICALLY GATED — refused while the item is missing", () => {
    const { engine } = freshEngine()
    // No ferry token → the gate must refuse even an explicit advance (the model
    // can emit questStep but cannot move a gate it doesn't control).
    expect(engine.advance("docks")).toBe(false)
    expect(engine.currentStep()?.id).toBe("docks")
    expect(engine.state().stepDone["docks"]).toBeUndefined()
  })

  it("clue → item → deliver → advance runs end to end (→ done)", () => {
    const { engine, inventory } = freshEngine()
    // 1. NEEDS-ITEM: authored clue points at the ferry token.
    expect(engine.stepState("docks")).toBe("needs-item")
    expect(authoredClueForStep(inventory, QUEST.id, "docks")).toContain("token")

    // 2. acquire the item.
    inventory.grant(FERRY)
    expect(engine.stepState("docks")).toBe("ready-to-deliver")

    // 3. deliver → advance: token consumed, step done, NEXT step active.
    expect(engine.advance("docks")).toBe(true)
    expect(inventory.has(FERRY)).toBe(false) // consumed on delivery
    expect(engine.state().stepDone["docks"]).toBe(true)
    expect(engine.currentStep()?.id).toBe("gate")
    expect(engine.stepState("gate")).toBe("needs-item") // now needs the gate pass

    // 4. second step: same chain.
    inventory.grant(GATE)
    expect(engine.stepState("gate")).toBe("ready-to-deliver")
    expect(engine.advance("gate")).toBe(true)
    expect(inventory.has(GATE)).toBe(false)
  })

  it("completing the final step marks complete + grants the quest reward once", () => {
    const { engine, inventory } = freshEngine()
    inventory.grant(FERRY)
    engine.advance("docks")
    inventory.grant(GATE)

    const xpBefore = inventory.xp()
    let completeFired = 0
    engine.subscribe((e) => {
      if (e.type === "complete") completeFired++
    })
    engine.advance("gate")

    expect(engine.state().complete).toBe(true)
    expect(completeFired).toBe(1)
    // Reward granted: +80 xp, +20 coins, +map-scrap.
    expect(inventory.xp()).toBe(xpBefore + 80)
    expect(inventory.coins()).toBe(20)
    expect(inventory.has("map-scrap")).toBe(true)

    // Idempotent: re-advancing a done step does nothing (no double reward).
    expect(engine.advance("gate")).toBe(false)
    expect(inventory.coins()).toBe(20)
  })

  it("authoredNextHint surfaces the NEXT step's clue after a delivery", () => {
    const { engine, inventory } = freshEngine()
    const hint = authoredNextHint(inventory, QUEST, "docks")
    expect(hint).toContain("pass") // the gate step's clue
    // After both steps' items held, the final step has no next hint.
    inventory.grant(FERRY)
    engine.advance("docks")
    expect(authoredNextHint(inventory, QUEST, "gate")).toBeUndefined()
  })

  it("getQuestMarkers points at the current objective + missing-item sources", () => {
    const { engine } = freshEngine()
    const markers = engine.getQuestMarkers()
    expect(markers.some((m) => m.kind === "objective" && m.anchorId === "harbor")).toBe(true)
    expect(markers.some((m) => m.kind === "source-hint" && m.itemId === FERRY)).toBe(true)
  })

  it("persists across engine re-instantiation (same quest)", () => {
    const inventory = createInventory()
    localStorage.clear()
    inventory.reset()
    const e1 = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
    inventory.grant(FERRY)
    e1.advance("docks")
    expect(e1.state().stepDone["docks"]).toBe(true)

    // A fresh engine reads the persisted stepDone.
    const e2 = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
    expect(e2.state().stepDone["docks"]).toBe(true)
    expect(e2.currentStep()?.id).toBe("gate")
  })

  it("notifies subscribers when inventory changes (needs-item → ready flip)", () => {
    const { engine, inventory } = freshEngine()
    let changes = 0
    engine.subscribe((e) => {
      if (e.type === "change") changes++
    })
    inventory.grant(FERRY)
    expect(changes).toBeGreaterThan(0)
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
    expect(step?.toolId).toBe("repeat-after")
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
    expect(challengeSatisfiesStep(CAFE.steps[0], "repeat-after", 0.9)).toBe(true)
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
    const step = QUEST.steps[0] // toolId: repeat-after
    expect(challengeSatisfiesStep(step, "repeat-after", 0.9)).toBe(true)
    expect(challengeSatisfiesStep(step, "repeat-after", 0.3)).toBe(false) // below threshold
    expect(challengeSatisfiesStep(step, "listen-choose", 0.9)).toBe(false) // wrong tool
  })
})
