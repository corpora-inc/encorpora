// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { Quest } from "@world-plaza/contracts"
import { createInventory } from "../economy/inventory"
import { createQuestEngine } from "./questState"
import { createSpecialNpcResolver } from "./specialNpc"
import specialJson from "../../content/npc/special.json"
import guadalajaraJson from "../../content/quests/es-guadalajara.json"

const QUEST = Quest.parse(guadalajaraJson)
const QID = "es-guadalajara-route"

function fresh() {
  localStorage.clear()
  const inventory = createInventory()
  inventory.reset()
  const engine = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
  const special = createSpecialNpcResolver(specialJson)
  return { engine, inventory, special }
}

describe("SpecialNpcResolver — content + lookups", () => {
  beforeEach(() => localStorage.clear())

  it("marks the two route anchors (harbor, bridge) as special; others are generic", () => {
    const { special } = fresh()
    for (const a of ["harbor", "bridge_n"]) {
      expect(special.isSpecial(a, QID)).toBe(true)
    }
    // A bystander anchor / wrong quest is NOT special.
    expect(special.isSpecial("plaza_bench_0", QID)).toBe(false)
    expect(special.isSpecial("harbor", "es-cafe-travel")).toBe(false)
  })

  it("forAnchor returns the bound def (name/role/duty); forQuest lists both", () => {
    const { special } = fresh()
    const boatman = special.forAnchor("harbor", QID)
    expect(boatman?.role).toBe("boatman")
    expect(boatman?.name).toBe("the ferry hand")
    expect(boatman?.duty).toBe("deliver")
    expect(special.forQuest(QID)).toHaveLength(2)
    expect(special.forAnchor("nowhere", QID)).toBeNull()
  })

  it("classifies the deliver NPCs per step (the route has no clue-givers now)", () => {
    const { special } = fresh()
    // docks step: ferry hand is the objective NPC at the harbor.
    expect(special.deliverFor(QID, "docks")?.anchorId).toBe("harbor")
    expect(special.cluesFor(QID, "docks")).toEqual([])
    // gate step (talk): bridge keeper on the ground.
    expect(special.deliverFor(QID, "gate")?.anchorId).toBe("bridge_n")
    expect(special.cluesFor(QID, "gate")).toEqual([])
  })

  it("acceptsDelivery is true ONLY at the deliver special for the step", () => {
    const { special } = fresh()
    expect(special.acceptsDelivery("harbor", QID, "docks")).toBe(true)
    // The bridge's deliver-NPC doesn't accept the docks step.
    expect(special.acceptsDelivery("bridge_n", QID, "docks")).toBe(false)
    // A generic anchor never accepts.
    expect(special.acceptsDelivery("plaza_bench_0", QID, "docks")).toBe(false)
  })

  it("displayName localizes via Translate when nameKey resolves, else falls back", () => {
    const { special } = fresh()
    const boatman = special.forAnchor("harbor", QID)!
    // No translator → authored English name.
    expect(special.displayName(boatman)).toBe("the ferry hand")
    // Translator that knows the key → localized.
    const t = (key: string, _lang: string) =>
      key === "special.guadalajara.docks.name" ? "el barquero" : key
    expect(special.displayName(boatman, t, "es")).toBe("el barquero")
    // Translator that returns the key back (no entry) → still falls back to name.
    const tMiss = (key: string) => key
    expect(special.displayName(boatman, tMiss, "es")).toBe("the ferry hand")
  })

  it("anchorName resolves a friendly name from an anchor id (map helper)", () => {
    const { special } = fresh()
    expect(special.anchorName("bridge_n", QID)).toBe("the bridge keeper")
    expect(special.anchorName("plaza_bench_0", QID)).toBeNull()
  })

  it("an empty/garbage special list degrades to the noSpecials stub", () => {
    const none = createSpecialNpcResolver([])
    expect(none.isSpecial("harbor", QID)).toBe(false)
    expect(none.forAnchor("harbor", QID)).toBeNull()
    expect(none.forQuest(QID)).toEqual([])
    const garbage = createSpecialNpcResolver([{ anchorId: "x" }, "nope", null])
    expect(garbage.forQuest(QID)).toEqual([])
  })
})

describe("Full playable walk (#26): talk-challenge → keeper talk → complete", () => {
  beforeEach(() => localStorage.clear())

  it("docks is a talk-challenge at the ferry hand; gate completes by talking to the keeper", () => {
    const { engine, inventory, special } = fresh()

    // ── Step `docks` (talk): the ferry hand is the objective NPC at the harbor.
    expect(engine.currentStep()?.id).toBe("docks")
    expect(engine.currentStepState()).toBe("needs-challenge")
    expect(special.deliverFor(QID, "docks")?.anchorId).toBe("harbor")

    // Win the talk challenge (the game marks it beaten, then advances).
    engine.markStepBeaten("docks")
    expect(engine.advance("docks")).toBe(true)
    expect(engine.state().stepDone["docks"]).toBe(true)

    // ── Step `gate` (talk): the bridge keeper stands on the GROUND at the bridge
    // foot; talking + winning the keeper's challenge completes it (no deck-walk).
    expect(engine.currentStep()?.id).toBe("gate")
    expect(engine.currentStep()?.kind ?? "talk").toBe("talk")
    expect(engine.currentStepState()).toBe("needs-challenge")
    expect(special.anchorName("bridge_n", QID)).toBe("the bridge keeper")

    engine.markStepBeaten("gate") // ← the keeper's challenge win
    expect(engine.advance("gate")).toBe(true)

    // Quest complete + reward granted once.
    expect(engine.state().complete).toBe(true)
    expect(inventory.has("map-scrap")).toBe(true)
    expect(inventory.xp()).toBeGreaterThanOrEqual(QUEST.rewards.xp)
    expect(engine.currentStep()).toBeNull()
  })
})
