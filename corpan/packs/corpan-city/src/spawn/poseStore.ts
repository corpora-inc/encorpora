/**
 * Per-pair RESUME POSE store — remembers WHERE the player was standing when they
 * last left a stack, so re-entering that language pair drops them back at the EXACT
 * spot (not at the current quest's objective NPC). Per-pair, exactly like the
 * immersion/quest/name/outfit state (#42): the player resumes a strong target where
 * they wandered to AND a hard one where they left it, independently.
 *
 * Storage tier: ONE tiny record per pair → a single localStorage key
 * (`wp:pose:v1`), negligible footprint (the shared ~5MB budget). The map is
 * `{ "en:es": {x, z, f}, "en:ar": {x, z, f} }` (`f` = facing yaw radians). Mirrors
 * `immersion/store.ts` deliberately — same pair key, same single-key map, same
 * defensive read/write.
 *
 * Cheap by construction: the orchestrator THROTTLES `set` (a few seconds while
 * moving) + saves once on exit/teardown — never per frame. A missing/invalid entry
 * resolves to `null`, so a first visit keeps today's near-objective default start.
 *
 * The RESUME-vs-default decision lives in `resolveResumeSpawn` (below), which
 * routes the saved pose through the SAME safe-spawn (`findSafeSpawn`) every
 * teleport/arrival uses — so a pose left inside new geometry resolves to clear
 * walkable ground, never a wall (#104).
 */

import type { LearnerPair } from "@corpan-city/contracts"
import { findSafeSpawn, type SpawnCollision } from "../world/collision"

const KEY = "wp:pose:v1"

/** A saved world pose for a pair: ground position + facing yaw (radians). */
export interface ResumePose {
  x: number
  z: number
  /** facing yaw in radians (the player's heading; `player.getFacing()`). */
  f: number
}

/** The pair → its localStorage map key (`${native}:${target}`) — identical to the
 *  immersion store's key so resume-pose lines up 1:1 with the other per-pair state. */
function pairKey(pair: LearnerPair): string {
  return `${pair.native}:${pair.target}`
}

type PoseMap = Record<string, ResumePose>

/** A finite number guard (rejects NaN/Infinity that would teleport the player to
 *  nowhere / break collision). */
function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function isPose(v: unknown): v is ResumePose {
  if (!v || typeof v !== "object") return false
  const p = v as Record<string, unknown>
  return isFiniteNum(p.x) && isFiniteNum(p.z) && isFiniteNum(p.f)
}

function readMap(): PoseMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: PoseMap = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPose(v)) out[k] = { x: v.x, z: v.z, f: v.f }
    }
    return out
  } catch (err) {
    console.warn("[wp/pose] could not read resume-pose map:", err)
    return {}
  }
}

function writeMap(map: PoseMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (err) {
    console.warn("[wp/pose] could not persist resume-pose map:", err)
  }
}

export interface PoseStore {
  /** The saved pose for a pair, or `null` if none/invalid (→ default start). */
  get(pair: LearnerPair): ResumePose | null
  /** Persist the player's current pose for a pair. Cheap; caller throttles. */
  set(pair: LearnerPair, pose: ResumePose): void
  /** Forget a pair's saved pose (e.g. on a deliberate "start over"). */
  clear(pair: LearnerPair): void
}

/**
 * One process-wide resume-pose store (a localStorage mirror; no subscribers needed
 * — the pose is read once at spawn + written on a throttle/exit). Multiple worlds in
 * one session share the same persisted poses, exactly like the immersion store.
 */
export function createPoseStore(): PoseStore {
  return {
    get(pair) {
      return readMap()[pairKey(pair)] ?? null
    },
    set(pair, pose) {
      if (!isPose(pose)) return // never persist a NaN/Infinity pose
      const map = readMap()
      map[pairKey(pair)] = { x: pose.x, z: pose.z, f: pose.f }
      writeMap(map)
    },
    clear(pair) {
      const map = readMap()
      if (pairKey(pair) in map) {
        delete map[pairKey(pair)]
        writeMap(map)
      }
    },
  }
}

/** A shared store instance for the pack (the world reads/writes this). */
export const poseStore: PoseStore = createPoseStore()

/**
 * Resolve the SPAWN pose for a freshly-built world (#103): the saved resume pose for
 * `pair` IF one exists, routed through the SHARED safe-spawn (`findSafeSpawn`) so the
 * landing point is ALWAYS clear walkable ground — never inside a collider (#104). A
 * pose left inside new geometry after a city re-layout is nudged to the nearest free
 * point rather than dropping the player in a wall. Returns `null` when there is no
 * saved pose (→ the caller frames the player on the active objective, today's
 * first-visit default).
 *
 * Pure (store + collision injected) so the resume-vs-default + safe-landing choice is
 * unit-testable without the whole world.
 */
export function resolveResumeSpawn(
  pair: LearnerPair,
  field: SpawnCollision,
  bodyRadius: number,
  store: PoseStore = poseStore,
): ResumePose | null {
  const saved = store.get(pair)
  if (!saved) return null
  const safe = findSafeSpawn(field, saved.x, saved.z, bodyRadius)
  return { x: safe.x, z: safe.z, f: saved.f }
}
