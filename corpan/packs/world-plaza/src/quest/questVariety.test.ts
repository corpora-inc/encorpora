import { describe, it, expect } from "vitest"
import {
  hashSeed,
  mulberry32,
  seededShuffle,
  pickNextQuests,
  pushRecent,
  varyQuestPlay,
} from "./questVariety"
import type { Quest } from "@world-plaza/contracts"

describe("questVariety — seeded helpers", () => {
  it("hashSeed is stable + distinct", () => {
    expect(hashSeed("a")).toBe(hashSeed("a"))
    expect(hashSeed("a")).not.toBe(hashSeed("b"))
    expect(hashSeed("plaza-cafe#0")).not.toBe(hashSeed("plaza-cafe#1"))
  })

  it("mulberry32 is deterministic for a seed", () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it("seededShuffle is a permutation, deterministic per seed, varying across seeds", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const s1 = seededShuffle(items, 42)
    const s2 = seededShuffle(items, 42)
    const s3 = seededShuffle(items, 99)
    expect(s1).toEqual(s2) // deterministic
    expect([...s1].sort((a, b) => a - b)).toEqual(items) // permutation
    expect(s1).not.toEqual(s3) // different seed → (almost surely) different order
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]) // input untouched
  })
})

describe("pickNextQuests — authored fork first, rotated backfill", () => {
  const allIds = ["a", "b", "c", "d", "e", "f"]

  it("honours the authored fork first, capped + de-duped, never the completed quest", () => {
    const picked = pickNextQuests({
      completedId: "a",
      preferredIds: ["b", "c", "a", "b"], // a (completed) + dup b are dropped
      allIds,
      seed: 1,
      max: 3,
    })
    expect(picked.slice(0, 2)).toEqual(["b", "c"]) // authored fork leads, in order
    expect(picked).toHaveLength(3)
    expect(picked).not.toContain("a")
    expect(new Set(picked).size).toBe(picked.length) // no dupes
  })

  it("backfills from the catalog when the fork is short, never empty", () => {
    const picked = pickNextQuests({ completedId: "a", preferredIds: [], allIds, seed: 7, max: 3 })
    expect(picked).toHaveLength(3)
    expect(picked).not.toContain("a")
  })

  it("biases backfill AWAY from recently-played quests", () => {
    // With only backfill, recent ids should sort to the back and not be picked while
    // fresh ones remain.
    const recent = ["b", "c", "d", "e"]
    const picked = pickNextQuests({
      completedId: "a",
      preferredIds: [],
      allIds,
      recent,
      seed: 3,
      max: 1,
    })
    // The one fresh non-recent, non-completed id is "f" → it must win.
    expect(picked).toEqual(["f"])
  })

  it("rotates the backfill between replays (different seed → can differ)", () => {
    const base = { completedId: "a", preferredIds: [], allIds, max: 2 } as const
    const seeds = [1, 2, 3, 4, 5].map((s) => pickNextQuests({ ...base, seed: s }).join())
    // At least two distinct orderings across seeds (rotation actually varies output).
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it("returns empty only when the catalog has nothing but the completed quest", () => {
    expect(pickNextQuests({ completedId: "a", preferredIds: [], allIds: ["a"], seed: 1 })).toEqual([])
  })

  it("NO CONSECUTIVE VENUE — never OPENS the branch at the just-finished venue", () => {
    // a/b share the venue "x" (the place we just finished); c/d/e/f are elsewhere.
    const venue: Record<string, string> = { a: "x", b: "x", c: "y", d: "z", e: "y", f: "z" }
    const anchorOf = (id: string) => venue[id]
    // Even when the AUTHORED fork leads with a same-venue quest (b), it must not be
    // offered first while a different-venue option exists.
    const picked = pickNextQuests({
      completedId: "a",
      preferredIds: ["b", "c"],
      allIds,
      anchorOf,
      completedVenue: "x",
      seed: 5,
      max: 3,
    })
    expect(anchorOf(picked[0]), "first option is back at the same venue").not.toBe("x")
    expect(picked).not.toContain("a")
  })

  it("NO CONSECUTIVE VENUE — demotes but never DROPS same-venue (branch stays full)", () => {
    // Only same-venue options exist besides the completed quest → the branch must
    // still fill (de-prioritisation, not a hard filter), never go empty.
    const venue: Record<string, string> = { a: "x", b: "x", c: "x" }
    const picked = pickNextQuests({
      completedId: "a",
      preferredIds: [],
      allIds: ["a", "b", "c"],
      anchorOf: (id) => venue[id],
      completedVenue: "x",
      seed: 9,
      max: 3,
    })
    expect(picked.sort()).toEqual(["b", "c"]) // both surfaced despite same venue
  })
})

describe("pushRecent — most-recent-first, de-duped, capped", () => {
  it("prepends, de-dupes, caps", () => {
    let ring: string[] = []
    ring = pushRecent(ring, "a")
    ring = pushRecent(ring, "b")
    ring = pushRecent(ring, "a") // moves a to front, no dup
    expect(ring).toEqual(["a", "b"])
    for (const id of ["c", "d", "e", "f", "g", "h"]) ring = pushRecent(ring, id, 6)
    expect(ring).toHaveLength(6)
    expect(ring[0]).toBe("h")
  })
})

describe("varyQuestPlay — stable-per-attempt rotation", () => {
  const quest = { id: "demo-quest" } as Quest
  it("is reload-stable for (questId, attempt) and rotates per attempt", () => {
    expect(varyQuestPlay(quest, 0)).toEqual(varyQuestPlay(quest, 0))
    expect(varyQuestPlay(quest, 0).vocabRotation).not.toBe(varyQuestPlay(quest, 1).vocabRotation)
    expect(varyQuestPlay(quest, 3).vocabRotation).toBeGreaterThanOrEqual(0)
    expect(varyQuestPlay(quest, 3).vocabRotation).toBeLessThan(997)
  })
})
