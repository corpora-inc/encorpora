/**
 * Per-Track immersion store (IMMERSION_TOGGLE §3.1) — the persisted home of each
 * Track's `Immersion` setting, keyed by the pair (`${native}:${target}`). A user
 * runs immersion ON for a strong target and OFF for a hard one *at the same time*,
 * so the setting is per-pair, exactly like character/inventory/XP/quests.
 *
 * Storage tier: ONE tiny enum per pair → a single localStorage key
 * (`wp:immersion:v1`), negligible footprint (the shared ~5MB budget memory). The
 * map is `{ "en:es": "on", "en:ar": "off" }`. A `subscribe` lets the orchestrator
 * live-re-render the world when the toggle flips (no reload).
 *
 * Default is `"off"` for a NEW two-language Track (the safety-net default, §5); a
 * single-language Track is forced `"on"` by the resolver regardless of what is
 * stored, so we never need to special-case it here.
 */

import type { LearnerPair } from "@world-plaza/contracts"
import type { Immersion } from "./immersion"

const KEY = "wp:immersion:v1"

/** The pair → its localStorage map key (`${native}:${target}`). */
function pairKey(pair: LearnerPair): string {
  return `${pair.native}:${pair.target}`
}

type ImmersionMap = Record<string, Immersion>

function readMap(): ImmersionMap {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object") return parsed as ImmersionMap
    return {}
  } catch (err) {
    console.warn("[wp/immersion] could not read immersion map:", err)
    return {}
  }
}

function writeMap(map: ImmersionMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch (err) {
    console.warn("[wp/immersion] could not persist immersion map:", err)
  }
}

export interface ImmersionStore {
  /** The stored level for a pair (default "off"; a missing entry is "off"). */
  get(pair: LearnerPair): Immersion
  /** Persist a level for a pair and notify subscribers. */
  set(pair: LearnerPair, level: Immersion): void
  /** Subscribe to changes (any pair). Returns an unsubscribe. */
  subscribe(fn: (pair: LearnerPair, level: Immersion) => void): () => void
}

/**
 * One process-wide immersion store. Cheap; in-memory subscribers + a localStorage
 * mirror. (Multiple worlds in one session share the same persisted settings.)
 */
export function createImmersionStore(): ImmersionStore {
  const subs = new Set<(pair: LearnerPair, level: Immersion) => void>()
  return {
    get(pair) {
      return readMap()[pairKey(pair)] ?? "off"
    },
    set(pair, level) {
      const map = readMap()
      map[pairKey(pair)] = level
      writeMap(map)
      for (const fn of subs) {
        try {
          fn(pair, level)
        } catch (err) {
          console.error("[wp/immersion] subscriber threw:", err)
        }
      }
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

/** A shared store instance for the pack (the world reads/writes this). */
export const immersionStore: ImmersionStore = createImmersionStore()
