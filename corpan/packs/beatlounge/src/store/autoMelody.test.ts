/**
 * beatlounge — AUTO-MELODY slice tests. The per-track generative-conductor
 * config that survives reload: persist, restore, repair stale corpus ids, stay
 * idempotent, and report the armed set. Pure (no DOM beyond jsdom localStorage).
 */

import { describe, expect, it, beforeEach, vi } from "vitest"
import { METRIC_PROFILES, TRANSITION_TABLES } from "../music/melody"
import {
  __resetAutoMelodyForTest,
  getAutoConfig,
  listArmedTracks,
  setAutoArmed,
  setAutoOption,
  subscribeAuto,
} from "./autoMelody"

const LS_KEY = "beatlounge:autoMelody"

beforeEach(() => __resetAutoMelodyForTest())

describe("getAutoConfig defaults", () => {
  it("returns documented defaults for an unknown track", () => {
    const c = getAutoConfig("trk_x")
    expect(c.on).toBe(false)
    expect(c.metricId).toBe(METRIC_PROFILES[0].id)
    expect(c.tableId).toBe(TRANSITION_TABLES[0].id)
    expect(c.density).toBe(0.55)
    expect(c.variation).toBe("evolve")
    expect(c.lockSeed).toBe(0)
  })
})

describe("setters + persistence round-trip", () => {
  it("arming persists and round-trips through localStorage", () => {
    setAutoArmed("trk_a", true)
    setAutoOption("trk_a", { metricId: TRANSITION_TABLES[0].id }) // wrong family → ignored/repaired
    setAutoOption("trk_a", { metricId: METRIC_PROFILES[1].id, variation: "lock" })

    const raw = localStorage.getItem(LS_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw as string)
    expect(parsed.trk_a.on).toBe(true)
    expect(parsed.trk_a.metricId).toBe(METRIC_PROFILES[1].id)
    expect(parsed.trk_a.variation).toBe("lock")
    // lockSeed rolled (non-zero) on first arm
    expect(parsed.trk_a.lockSeed).not.toBe(0)
  })

  it("arming rolls a stable non-zero lockSeed once and reuses it", () => {
    setAutoArmed("trk_a", true)
    const seed1 = getAutoConfig("trk_a").lockSeed
    expect(seed1).not.toBe(0)
    setAutoArmed("trk_a", false)
    setAutoArmed("trk_a", true)
    expect(getAutoConfig("trk_a").lockSeed).toBe(seed1) // not re-rolled
  })

  it("density clamps to 0..1", () => {
    setAutoOption("trk_a", { density: 5 })
    expect(getAutoConfig("trk_a").density).toBe(1)
    setAutoOption("trk_a", { density: -2 })
    expect(getAutoConfig("trk_a").density).toBe(0)
  })
})

describe("validate-on-read repairs stale ids", () => {
  it("repairs an unknown metricId / tableId to the [0] default and never throws", () => {
    setAutoOption("trk_b", { metricId: "metric:nope", tableId: "transition:nope" })
    const c = getAutoConfig("trk_b")
    expect(c.metricId).toBe(METRIC_PROFILES[0].id)
    expect(c.tableId).toBe(TRANSITION_TABLES[0].id)
  })

  it("repairs persisted stale ids on a fresh module load", async () => {
    // Persist a doc with corpus ids that no longer exist, then load the slice
    // FRESH (resetModules) so the constructor's readPersisted/sanitize path runs.
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        trk_gone: {
          on: true,
          metricId: "metric:does-not-exist",
          tableId: "transition:vanished",
          density: 2,
          variation: "bogus",
          lockSeed: 123,
        },
      })
    )
    vi.resetModules()
    const fresh = await import("./autoMelody")
    const c = fresh.getAutoConfig("trk_gone")
    expect(c.metricId).toBe(METRIC_PROFILES[0].id)
    expect(c.tableId).toBe(TRANSITION_TABLES[0].id)
    expect(c.density).toBe(1) // clamped
    expect(c.variation).toBe("evolve") // bad enum repaired to default
    expect(c.on).toBe(true)
  })
})

describe("idempotent setters", () => {
  it("does not write/persist when nothing changes", () => {
    setAutoArmed("trk_a", true)
    let calls = 0
    const off = subscribeAuto(() => {
      calls += 1
    })
    setAutoArmed("trk_a", true) // already on
    setAutoOption("trk_a", { density: getAutoConfig("trk_a").density }) // unchanged
    expect(calls).toBe(0)
    setAutoOption("trk_a", { density: 0.9 }) // real change
    expect(calls).toBe(1)
    off()
  })
})

describe("listArmedTracks", () => {
  it("returns exactly the on===true ids", () => {
    setAutoArmed("trk_a", true)
    setAutoArmed("trk_b", true)
    setAutoArmed("trk_c", true)
    setAutoArmed("trk_b", false)
    const armed = listArmedTracks().sort()
    expect(armed).toEqual(["trk_a", "trk_c"])
  })
})

describe("__resetAutoMelodyForTest", () => {
  it("clears the store and localStorage", () => {
    setAutoArmed("trk_a", true)
    expect(localStorage.getItem(LS_KEY)).toBeTruthy()
    __resetAutoMelodyForTest()
    expect(listArmedTracks()).toEqual([])
    expect(localStorage.getItem(LS_KEY)).toBeNull()
  })
})
