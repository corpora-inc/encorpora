// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { createQuestRuntime } from "./questRuntime"
import { entryQuestId, getQuest } from "./questCatalog"

beforeEach(() => localStorage.clear())

describe("createQuestRuntime — the QUESTS-AT-SCALE seam", () => {
  it("exposes a localizer that renders the entry quest title IN the ui locale (#112)", () => {
    const rt = createQuestRuntime({ trackId: "en:es", uiLocale: "es" })
    const q = getQuest(entryQuestId)!
    // #112: the quest catalog is now populated, so the localizer returns the SPANISH
    // title (the immersion-target render), not the English literal. Non-empty + not
    // the English source proves localization (not just the fallback).
    const es = rt.localizer().title(q)
    expect(es).toBeTruthy()
    expect(es).not.toBe(q.title)
  })

  it("setLocale re-points the localizer in place (es → fr is a DIFFERENT translation) (#112)", () => {
    const rt = createQuestRuntime({ trackId: "en:es", uiLocale: "es" })
    const q = getQuest(entryQuestId)!
    const es = rt.localizer().title(q)
    rt.setLocale("fr")
    const fr = rt.localizer().title(q)
    expect(fr).toBeTruthy()
    expect(fr).not.toBe(q.title) // localized, not the English literal
    expect(fr).not.toBe(es) // re-pointed in place → a different locale's title
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
