// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import type { LearnerPair } from "@world-plaza/contracts"
import { createPoseStore, resolveResumeSpawn } from "./poseStore"

/**
 * poseStore — the per-pair RESUME POSE (#103). Proves the owner's spec: a saved
 * pose round-trips for the SAME language pair, is ISOLATED per pair (en:es vs en:ar
 * resume independently), persists across store instances (a reload re-reads it), a
 * first visit / cleared pair resolves to `null` (→ default near-objective start),
 * and a corrupt/NaN row can never strand the player.
 */

const EN_ES: LearnerPair = { native: "en", target: "es" }
const EN_AR: LearnerPair = { native: "en", target: "ar" }

beforeEach(() => {
  localStorage.clear()
})

describe("poseStore — per-pair resume pose", () => {
  it("round-trips a saved pose for the same pair", () => {
    const store = createPoseStore()
    expect(store.get(EN_ES)).toBeNull() // first visit → default start
    store.set(EN_ES, { x: 12.5, z: -40.25, f: 1.57 })
    expect(store.get(EN_ES)).toEqual({ x: 12.5, z: -40.25, f: 1.57 })
  })

  it("isolates poses per language pair", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 1, z: 2, f: 0 })
    store.set(EN_AR, { x: 300, z: -7, f: 3.1 })
    // each pair resumes at its OWN spot; neither leaks into the other.
    expect(store.get(EN_ES)).toEqual({ x: 1, z: 2, f: 0 })
    expect(store.get(EN_AR)).toEqual({ x: 300, z: -7, f: 3.1 })
  })

  it("persists across store instances (a reload re-reads the saved spot)", () => {
    createPoseStore().set(EN_ES, { x: -88, z: 64, f: -2.0 })
    // a fresh store (mimics a page reload / new world build) reads the same pose.
    const reloaded = createPoseStore()
    expect(reloaded.get(EN_ES)).toEqual({ x: -88, z: 64, f: -2.0 })
  })

  it("clears a pair back to the default start", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 5, z: 5, f: 0 })
    store.clear(EN_ES)
    expect(store.get(EN_ES)).toBeNull()
  })

  it("never persists a NaN/Infinity pose (would teleport / break collision)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: Number.NaN, z: 0, f: 0 })
    store.set(EN_ES, { x: 0, z: Number.POSITIVE_INFINITY, f: 0 })
    expect(store.get(EN_ES)).toBeNull() // both rejected → default start
  })

  it("ignores a corrupt localStorage payload (resolves to default, no throw)", () => {
    localStorage.setItem("wp:pose:v1", "{ not valid json")
    const store = createPoseStore()
    expect(store.get(EN_ES)).toBeNull()
    // and it can still write a fresh, good pose over the garbage.
    store.set(EN_ES, { x: 9, z: 9, f: 1 })
    expect(store.get(EN_ES)).toEqual({ x: 9, z: 9, f: 1 })
  })

  it("drops a malformed row but keeps the well-formed ones", () => {
    localStorage.setItem(
      "wp:pose:v1",
      JSON.stringify({ "en:es": { x: 1, z: 2, f: 3 }, "en:ar": { x: "nope" } }),
    )
    const store = createPoseStore()
    expect(store.get(EN_ES)).toEqual({ x: 1, z: 2, f: 3 })
    expect(store.get(EN_AR)).toBeNull()
  })
})

describe("resolveResumeSpawn — rebuild spawns at the saved spot, per pair (#103 spec)", () => {
  const NEVER_BLOCKED = () => false
  const ALWAYS_BLOCKED = () => true

  it("rebuilding for the SAME pair resumes at the saved pose", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 42, z: -13, f: 0.5 })
    // a fresh world build for en:es → spawn returns the saved pose (not the default).
    expect(resolveResumeSpawn(EN_ES, NEVER_BLOCKED, store)).toEqual({ x: 42, z: -13, f: 0.5 })
  })

  it("a DIFFERENT pair with no saved pose falls back to the default start (null)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 42, z: -13, f: 0.5 })
    // en:ar was never visited → null → caller frames on the objective (default).
    expect(resolveResumeSpawn(EN_AR, NEVER_BLOCKED, store)).toBeNull()
  })

  it("ignores a saved pose that landed inside new geometry (→ default start)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 42, z: -13, f: 0.5 })
    // a city re-layout makes the old spot un-walkable → resolve to null, not a wall.
    expect(resolveResumeSpawn(EN_ES, ALWAYS_BLOCKED, store)).toBeNull()
  })

  it("first visit on a pair (nothing saved) → default start", () => {
    expect(resolveResumeSpawn(EN_ES, NEVER_BLOCKED, createPoseStore())).toBeNull()
  })
})
