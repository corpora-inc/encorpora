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
const FERRY = "ferry-token"
const GATE = "city-gate-pass"

function fresh() {
  localStorage.clear()
  const inventory = createInventory()
  inventory.reset()
  const engine = createQuestEngine({ quest: QUEST, inventory, playerId: "player-local" })
  const special = createSpecialNpcResolver(specialJson)
  return { engine, inventory, special }
}

/**
 * Emulate the game.ts wiring: a delivery only happens when (a) the agent at this
 * anchor is the DELIVER special for the current step AND (b) the engine's gate
 * agrees. Returns true iff the step actually advanced.
 */
function tryDeliverAt(
  anchorId: string,
  engine: ReturnType<typeof createQuestEngine>,
  special: ReturnType<typeof createSpecialNpcResolver>,
): boolean {
  const step = engine.currentStep()
  if (!step) return false
  if (!special.acceptsDelivery(anchorId, QID, step.id)) return false
  return engine.advance(step.id)
}

describe("SpecialNpcResolver — content + lookups", () => {
  beforeEach(() => localStorage.clear())

  it("marks exactly the four route anchors as special; others are generic", () => {
    const { special } = fresh()
    for (const a of ["plaza", "harbor", "market", "bridge_n"]) {
      expect(special.isSpecial(a, QID)).toBe(true)
    }
    // A bystander anchor / wrong quest is NOT special.
    expect(special.isSpecial("plaza_bench_0", QID)).toBe(false)
    expect(special.isSpecial("harbor", "es-cafe-travel")).toBe(false)
  })

  it("forAnchor returns the bound def (name/role/duty); forQuest lists all four", () => {
    const { special } = fresh()
    const boatman = special.forAnchor("harbor", QID)
    expect(boatman?.role).toBe("boatman")
    expect(boatman?.name).toBe("the ferry hand")
    expect(boatman?.duty).toBe("deliver")
    expect(special.forQuest(QID)).toHaveLength(4)
    expect(special.forAnchor("nowhere", QID)).toBeNull()
  })

  it("classifies deliver vs clue NPCs per step", () => {
    const { special } = fresh()
    // docks step: ferry hand delivers at the harbor, the plaza traveler gives the ferry token.
    expect(special.deliverFor(QID, "docks")?.anchorId).toBe("harbor")
    expect(special.cluesFor(QID, "docks").map((e) => e.anchorId)).toEqual(["plaza"])
    expect(special.cluesFor(QID, "docks")[0].gives).toBe(FERRY)
    // gate step: bridge keeper delivers, the market clerk gives the gate pass.
    expect(special.deliverFor(QID, "gate")?.anchorId).toBe("bridge_n")
    expect(special.cluesFor(QID, "gate")[0].gives).toBe(GATE)
  })

  it("acceptsDelivery is true ONLY at the deliver special for the step", () => {
    const { special } = fresh()
    expect(special.acceptsDelivery("harbor", QID, "docks")).toBe(true)
    // The clue-giver (plaza traveler) never accepts a delivery.
    expect(special.acceptsDelivery("plaza", QID, "docks")).toBe(false)
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

describe("Full clue → item → deliver → advance → complete walk (specials only)", () => {
  beforeEach(() => localStorage.clear())

  it("only the ferry hand/bridge keeper advance the route, and only when the item is held", () => {
    const { engine, inventory, special } = fresh()

    // ── Step `docks`, needs-item: no ferry token yet. ────────────────────────
    expect(engine.currentStep()?.id).toBe("docks")
    expect(engine.currentStepState()).toBe("needs-item")
    // The clue source for this step is the plaza traveler (hands the token).
    expect(special.cluesFor(QID, "docks")[0].anchorId).toBe("plaza")

    // Talking to the ferry hand now must NOT advance (no token held) — the engine
    // gate refuses even though the ferry hand IS the deliver special.
    expect(tryDeliverAt("harbor", engine, special)).toBe(false)
    expect(engine.currentStep()?.id).toBe("docks")

    // ── Receive the ferry token (the clue-giver / shop / challenge hands it). ─
    inventory.grant(FERRY)
    expect(engine.currentStepState()).toBe("ready-to-deliver")

    // Handing it to a NON-deliver NPC (the plaza clue-giver) does nothing.
    expect(tryDeliverAt("plaza", engine, special)).toBe(false)
    expect(engine.currentStep()?.id).toBe("docks")

    // ── Deliver to the FERRY HAND at the harbor → step advances + token consumed. ─
    expect(tryDeliverAt("harbor", engine, special)).toBe(true)
    expect(inventory.has(FERRY)).toBe(false)
    expect(engine.state().stepDone["docks"]).toBe(true)

    // ── Now step `gate`, needs-item: no pass yet. ────────────────────────────
    expect(engine.currentStep()?.id).toBe("gate")
    expect(engine.currentStepState()).toBe("needs-item")
    expect(special.cluesFor(QID, "gate")[0].anchorId).toBe("market")

    // The ferry hand can't advance the gate step (wrong anchor for this step).
    expect(special.acceptsDelivery("harbor", QID, "gate")).toBe(false)

    // ── Receive the gate pass, hand it to the BRIDGE KEEPER → quest completes. ───
    inventory.grant(GATE)
    expect(engine.currentStepState()).toBe("ready-to-deliver")
    expect(tryDeliverAt("bridge_n", engine, special)).toBe(true)
    expect(inventory.has(GATE)).toBe(false)
    expect(engine.state().complete).toBe(true)
    // Quest reward (map-scrap + xp) was granted on completion.
    expect(inventory.has("map-scrap")).toBe(true)
    expect(inventory.xp()).toBeGreaterThanOrEqual(QUEST.rewards.xp)
    expect(engine.currentStep()).toBeNull()
  })
})
