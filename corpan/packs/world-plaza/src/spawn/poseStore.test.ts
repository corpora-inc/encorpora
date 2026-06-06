// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import type { LearnerPair } from "@world-plaza/contracts"
import { createPoseStore, resolveResumeSpawn } from "./poseStore"
import type { SpawnCollision } from "../world/collision"

/**
 * poseStore — the per-pair RESUME POSE (#103) + its unified safe-spawn landing
 * (#104). Proves: a saved pose round-trips for the SAME pair, is ISOLATED per pair,
 * persists across instances (reload), clears, and rejects NaN/corrupt rows; and that
 * the resume DECISION routes the saved pose through the SHARED `findSafeSpawn` so a
 * pose now inside new geometry resolves to CLEAR walkable ground (never a wall).
 */

const EN_ES: LearnerPair = { native: "en", target: "es" }
const EN_AR: LearnerPair = { native: "en", target: "ar" }

const FREE: SpawnCollision = { blocked: () => false }
/** blocked only INSIDE a disc of radius 5 at the origin — the spiral walks out. */
const DISC_AT_ORIGIN: SpawnCollision = {
  blocked: (x, z, _r) => x * x + z * z < 5 * 5,
}

beforeEach(() => {
  localStorage.clear()
})

describe("poseStore — per-pair resume pose", () => {
  it("round-trips a saved pose for the same pair", () => {
    const store = createPoseStore()
    expect(store.get(EN_ES)).toBeNull()
    store.set(EN_ES, { x: 12.5, z: -40.25, f: 1.57 })
    expect(store.get(EN_ES)).toEqual({ x: 12.5, z: -40.25, f: 1.57 })
  })

  it("isolates poses per language pair", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 1, z: 2, f: 0 })
    store.set(EN_AR, { x: 300, z: -7, f: 3.1 })
    expect(store.get(EN_ES)).toEqual({ x: 1, z: 2, f: 0 })
    expect(store.get(EN_AR)).toEqual({ x: 300, z: -7, f: 3.1 })
  })

  it("persists across store instances (a reload re-reads the saved spot)", () => {
    createPoseStore().set(EN_ES, { x: -88, z: 64, f: -2.0 })
    expect(createPoseStore().get(EN_ES)).toEqual({ x: -88, z: 64, f: -2.0 })
  })

  it("clears a pair back to the default start", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 5, z: 5, f: 0 })
    store.clear(EN_ES)
    expect(store.get(EN_ES)).toBeNull()
  })

  it("never persists a NaN/Infinity pose", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: Number.NaN, z: 0, f: 0 })
    store.set(EN_ES, { x: 0, z: Number.POSITIVE_INFINITY, f: 0 })
    expect(store.get(EN_ES)).toBeNull()
  })

  it("ignores a corrupt localStorage payload (default, no throw)", () => {
    localStorage.setItem("wp:pose:v1", "{ not valid json")
    const store = createPoseStore()
    expect(store.get(EN_ES)).toBeNull()
    store.set(EN_ES, { x: 9, z: 9, f: 1 })
    expect(store.get(EN_ES)).toEqual({ x: 9, z: 9, f: 1 })
  })
})

describe("resolveResumeSpawn — rebuild resumes at the (safe) saved spot, per pair (#103+#104)", () => {
  it("rebuilding for the SAME pair resumes at the saved pose (clear ground)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 42, z: -13, f: 0.5 })
    expect(resolveResumeSpawn(EN_ES, FREE, 0.55, store)).toEqual({ x: 42, z: -13, f: 0.5 })
  })

  it("a DIFFERENT pair with no saved pose falls back to the default start (null)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 42, z: -13, f: 0.5 })
    expect(resolveResumeSpawn(EN_AR, FREE, 0.55, store)).toBeNull()
  })

  it("a saved pose now inside a collider resumes on SAFE ground, keeping facing (#104)", () => {
    const store = createPoseStore()
    store.set(EN_ES, { x: 0, z: 0, f: 1.2 }) // dead-centre of the blocking disc
    const out = resolveResumeSpawn(EN_ES, DISC_AT_ORIGIN, 0.55, store)
    expect(out).not.toBeNull()
    expect(DISC_AT_ORIGIN.blocked(out!.x, out!.z, 0.55)).toBe(false) // landed clear
    expect(out!.f).toBe(1.2) // heading kept
  })

  it("first visit on a pair (nothing saved) → default start", () => {
    expect(resolveResumeSpawn(EN_ES, FREE, 0.55, createPoseStore())).toBeNull()
  })
})
