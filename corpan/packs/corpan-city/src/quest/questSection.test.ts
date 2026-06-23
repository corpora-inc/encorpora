// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { Quest } from "@corpan-city/contracts"
import { createInventory } from "../economy/inventory"
import { createQuestEngine } from "./questState"
import { createQuestSection, type QuestChoice } from "./questSection"
import cafeJson from "../../content/quests/es-cafe.json"

const CAFE = Quest.parse(cafeJson)

function engineFor() {
  localStorage.clear()
  const inventory = createInventory()
  inventory.reset()
  const engine = createQuestEngine({ quest: CAFE, inventory, playerId: "player-local" })
  return { engine, inventory }
}

describe("questSection — switch-quest escape hatch (#41)", () => {
  let body: HTMLElement
  beforeEach(() => {
    localStorage.clear()
    body = document.createElement("div")
    document.body.appendChild(body)
  })

  const choices = (activeId: string): QuestChoice[] => [
    { id: "es-cafe-travel", title: "Coffee on the Plaza", whereToGo: "the plaza", isActive: activeId === "es-cafe-travel", isComplete: false },
    { id: "es-guadalajara-route", title: "Across Corpan City", whereToGo: "the harbor", isActive: activeId === "es-guadalajara-route", isComplete: false },
    { id: "es-market-haggle", title: "Haggle at the Market", whereToGo: "the market", isActive: activeId === "es-market-haggle", isComplete: false },
  ]

  it("renders a card per quest, marks the active one, and others are tappable buttons", () => {
    const { engine, inventory } = engineFor()
    const onSwitchQuest = vi.fn()
    const view = createQuestSection({
      engine,
      inventory,
      questChoices: () => choices("es-cafe-travel"),
      onSwitchQuest,
    })
    view(body)

    const cards = body.querySelectorAll(".wp-quest-switch-card")
    expect(cards.length).toBe(3)
    // The active quest's card is a non-button (div) with the Current badge.
    const active = body.querySelector(".wp-quest-switch-card--active")
    expect(active).not.toBeNull()
    expect(active!.tagName).toBe("DIV")
    expect(active!.querySelector(".wp-quest-switch-badge")).not.toBeNull()
    // The other two are <button>s.
    const buttons = body.querySelectorAll("button.wp-quest-switch-card")
    expect(buttons.length).toBe(2)
  })

  it("tapping a non-active quest card fires onSwitchQuest with its id", () => {
    const { engine, inventory } = engineFor()
    const onSwitchQuest = vi.fn()
    createQuestSection({
      engine,
      inventory,
      questChoices: () => choices("es-cafe-travel"),
      onSwitchQuest,
    })(body)

    const guad = Array.from(body.querySelectorAll("button.wp-quest-switch-card")).find((b) =>
      (b.textContent ?? "").includes("Across Corpan City"),
    ) as HTMLButtonElement
    expect(guad).toBeTruthy()
    guad.click()
    expect(onSwitchQuest).toHaveBeenCalledWith("es-guadalajara-route")
  })

  it("hides the picker when there's only one quest or no switch handler", () => {
    const { engine, inventory } = engineFor()
    // no onSwitchQuest → no picker
    createQuestSection({ engine, inventory, questChoices: () => choices("es-cafe-travel") })(body)
    expect(body.querySelector(".wp-quest-switch")).toBeNull()

    body.replaceChildren()
    // only one quest → no picker (nothing to switch to)
    createQuestSection({
      engine,
      inventory,
      onSwitchQuest: vi.fn(),
      questChoices: () => [choices("es-cafe-travel")[0]],
    })(body)
    expect(body.querySelector(".wp-quest-switch")).toBeNull()
  })
})
