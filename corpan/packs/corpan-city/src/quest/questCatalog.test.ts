// @vitest-environment happy-dom
import { describe, it, expect } from "vitest"
import {
  allQuests,
  getQuest,
  nextQuests,
  firstStep,
  entryQuestId,
  objectiveAnchorIds,
  questOpeningAnchor,
  questClosingAnchor,
} from "./questCatalog"

describe("questCatalog — the data-driven quest graph", () => {
  it("parses every authored quest and exposes them by id", () => {
    const quests = allQuests()
    expect(quests.length).toBeGreaterThanOrEqual(4)
    expect(getQuest("es-cafe-travel")?.title).toBe("Coffee on the Plaza")
    expect(getQuest("es-guadalajara-route")?.id).toBe("es-guadalajara-route")
    expect(getQuest("does-not-exist")).toBeUndefined()
  })

  it("the entry quest is the dead-simple 1-step café quest", () => {
    expect(entryQuestId).toBe("es-cafe-travel")
    const entry = getQuest(entryQuestId)!
    expect(entry.steps).toHaveLength(1)
    expect(firstStep(entry)?.anchorId).toBe("plaza")
  })

  it("nextQuests resolves the authored nextQuestIds (2–3), capped at 3", () => {
    const next = nextQuests("es-cafe-travel")
    expect(next.length).toBeGreaterThanOrEqual(2)
    expect(next.length).toBeLessThanOrEqual(3)
    expect(next.map((q) => q.id)).toContain("es-market-haggle")
    // Never offers the just-completed quest as a follow-up.
    expect(next.map((q) => q.id)).not.toContain("es-cafe-travel")
  })

  it("falls back to other quests when a quest declares no follow-ups", () => {
    // An unknown id has no nextQuestIds → fallback to other known quests (non-empty).
    const next = nextQuests("totally-unknown")
    expect(next.length).toBeGreaterThan(0)
    expect(next.length).toBeLessThanOrEqual(3)
  })

  it("each follow-up exposes a first step with an anchor + label for the picker", () => {
    for (const q of nextQuests("es-cafe-travel")) {
      const s = firstStep(q)
      expect(s).not.toBeNull()
      expect(typeof s!.label).toBe("string")
      expect(s!.anchorId).toBeTruthy()
    }
  })

  it("#75 — the next-quest branch never OPENS at the venue you just finished", () => {
    // The "same special three quests in a row" bug: a completion fork must not send
    // the player straight back to the SAME place. For every quest whose CLOSING venue
    // has at least one elsewhere-opening quest in the catalog, the FIRST offered
    // follow-up must open somewhere else.
    const quests = allQuests()
    for (const q of quests) {
      const finished = questClosingAnchor(q.id)
      if (!finished) continue
      const elsewhereExists = quests.some(
        (o) => o.id !== q.id && questOpeningAnchor(o.id) && questOpeningAnchor(o.id) !== finished,
      )
      if (!elsewhereExists) continue
      const next = nextQuests(q.id)
      expect(next.length, q.id).toBeGreaterThan(0)
      expect(questOpeningAnchor(next[0].id), `${q.id} sends you straight back to "${finished}"`).not.toBe(
        finished,
      )
    }
  })

  it("#58 — objectiveAnchorIds covers EVERY step anchor across the whole catalog", () => {
    const ids = objectiveAnchorIds()
    // Distinct (no dupes) and non-empty.
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThan(0)
    // Every quest's every step anchor is present — so a stationed objective NPC
    // exists for whichever quest the player switches to.
    for (const q of allQuests()) {
      for (const s of q.steps) {
        if (s.anchorId) expect(ids, `${q.id}/${s.id}`).toContain(s.anchorId)
      }
    }
    // The known beginner-arc anchors are all there.
    for (const a of ["plaza", "market", "fountain", "harbor", "bridge_n"]) {
      expect(ids).toContain(a)
    }
  })
})
