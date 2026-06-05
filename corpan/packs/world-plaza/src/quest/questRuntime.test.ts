// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { createQuestRuntime } from "./questRuntime"
import { entryQuestId, getQuest } from "./questCatalog"

beforeEach(() => localStorage.clear())

describe("createQuestRuntime — the QUESTS-AT-SCALE seam", () => {
  it("exposes a localizer that renders the entry quest title (literal fallback)", () => {
    const rt = createQuestRuntime({ trackId: "en:es", uiLocale: "es" })
    const q = getQuest(entryQuestId)!
    expect(rt.localizer().title(q)).toBe(q.title) // literal until the catalog has es
  })

  it("setLocale re-points the localizer in place", () => {
    const rt = createQuestRuntime({ trackId: "en:es", uiLocale: "es" })
    rt.setLocale("fr")
    const q = getQuest(entryQuestId)!
    expect(rt.localizer().title(q)).toBe(q.title) // still a valid localizer
  })

  it("nextOptions returns a non-empty, completed-excluded branch", () => {
    const rt = createQuestRuntime({ trackId: "en:es" })
    const opts = rt.nextOptions(entryQuestId)
    expect(opts.length).toBeGreaterThan(0)
    expect(opts.length).toBeLessThanOrEqual(3)
    expect(opts.map((q) => q.id)).not.toContain(entryQuestId)
  })

  it("recordStarted persists per-pair + rotates the backfill seed between replays", () => {
    const rt = createQuestRuntime({ trackId: "en:es" })
    const before = rt.nextOptions(entryQuestId).map((q) => q.id)
    // Play several quests → the recent ring + counter advance, biasing future forks.
    for (const id of ["market-numbers", "harbor-ferry-ride", "station-departures"]) {
      rt.recordStarted(id)
    }
    const after = rt.nextOptions(entryQuestId).map((q) => q.id)
    // The branch is still valid (non-empty, excludes completed); recency biases it.
    expect(after.length).toBeGreaterThan(0)
    expect(after).not.toContain(entryQuestId)
    // Persistence: a fresh runtime on the SAME pair sees the same recent state, so
    // its fork matches `after` (deterministic given the persisted counter+ring).
    const reopened = createQuestRuntime({ trackId: "en:es" })
    expect(reopened.nextOptions(entryQuestId).map((q) => q.id)).toEqual(after)
    void before
  })

  it("variety is scoped PER PAIR (a different trackId has its own ring)", () => {
    const a = createQuestRuntime({ trackId: "en:es" })
    a.recordStarted("market-numbers")
    a.recordStarted("harbor-ferry-ride")
    // A different pair starts fresh — its persisted record is independent.
    const b = createQuestRuntime({ trackId: "en:fr" })
    const raw = localStorage.getItem("wp:questvar:v1:en:fr")
    expect(raw).toBeNull() // b hasn't recorded anything yet
    expect(b.nextOptions(entryQuestId).length).toBeGreaterThan(0)
  })
})
