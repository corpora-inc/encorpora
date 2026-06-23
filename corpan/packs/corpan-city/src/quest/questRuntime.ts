/**
 * questRuntime — the SINGLE seam the orchestrator (`game.ts`) wires to the
 * QUESTS-AT-SCALE layer. It bundles the two cross-cutting concerns the quest
 * surfaces need but that the engine itself shouldn't own:
 *
 *   1. KEYED LOCALIZATION. `localizer()` is the live `QuestLocalizer` for the
 *      current UI locale (NATIVE by default, TARGET under immersion). The Status
 *      Capsule, Quest section, and completion interlude render quest copy through
 *      it; `setLocale(uiLocale)` on an immersion/locale flip re-points it (the
 *      surfaces' `relocalizeQuest` / getter pick it up). Before this, the surfaces
 *      rendered raw English literals and the keyed catalog was never consulted.
 *
 *   2. REPLAY VARIETY. A per-pair, persisted recent-history ring biases the
 *      completion interlude's next-quest BACKFILL away from repeats, and a per-pair
 *      play counter rotates the backfill between replays — so the journey forks
 *      differently each time instead of looping the same 3 cards. `nextOptions(id)`
 *      returns the rotated 2–3-way branch; `recordStarted(id)` updates the ring +
 *      counter when a quest is (re)started.
 *
 * Storage is one compact per-pair record (`wp:questvar:v1:<trackId>`, < 1KB) — the
 * same quota-safe discipline as the quest engine. Pure-ish: it touches only
 * localStorage + the pure catalog/variety helpers; no DOM, no host.
 */

import type { Quest } from "@corpan-city/contracts"
import { nextQuests, allQuests } from "./questCatalog"
import { makeQuestLocalizer, literalQuestLocalizer, type QuestLocalizer } from "./questLocalize"
import { pushRecent, hashSeed } from "./questVariety"

const LOG = "[wp/questRuntime]"
const STORE_PREFIX = "wp:questvar:v1"

interface PersistedVariety {
  /** recently-played quest ids, most-recent-first. */
  r: string[]
  /** monotonic play counter (rotates the next-quest backfill between replays). */
  n: number
}

function storeKey(trackId?: string): string {
  return trackId ? `${STORE_PREFIX}:${trackId}` : STORE_PREFIX
}

function loadVariety(key: string): PersistedVariety {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return { r: [], n: 0 }
    const p = JSON.parse(raw) as Partial<PersistedVariety>
    return {
      r: Array.isArray(p.r) ? p.r.filter((x): x is string => typeof x === "string") : [],
      n: typeof p.n === "number" && p.n >= 0 ? p.n | 0 : 0,
    }
  } catch (err) {
    console.warn(`${LOG} could not read variety state:`, err)
    return { r: [], n: 0 }
  }
}

function saveVariety(key: string, v: PersistedVariety): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch (err) {
    // Noisy, never silent — a persistence miss must not break the loop.
    console.error(`${LOG} could not persist variety state (in-memory only):`, err)
  }
}

export interface QuestRuntime {
  /** The live keyed-quest localizer for the current UI locale. */
  localizer(): QuestLocalizer
  /** Re-point the localizer on an immersion/locale flip (surfaces re-resolve). */
  setLocale(uiLocale: string): void
  /**
   * The rotated 2–3-way next-quest branch shown by the completion interlude:
   * authored fork first, catalog backfill biased away from recently-played quests
   * and rotated by the per-pair play counter. Never empty (unless the catalog has
   * only the completed quest).
   */
  nextOptions(completedQuestId: string): Quest[]
  /**
   * Record that a quest was (re)started — pushes it onto the recent ring + bumps the
   * play counter, then persists. Call on the entry quest AND on every interlude
   * pick so the ring reflects the real journey.
   */
  recordStarted(questId: string): void
}

export interface QuestRuntimeOptions {
  /** The active Track id (`native:target`) — scopes variety per language pair. */
  trackId?: string
  /** The initial UI locale (the immersion resolver's `uiLocale()`). */
  uiLocale?: string
}

/**
 * Build the quest runtime seam. Cheap; the orchestrator builds one per world and
 * rebuilds it on a pair switch (so variety is per-pair, matching the engine).
 */
export function createQuestRuntime(opts: QuestRuntimeOptions = {}): QuestRuntime {
  const key = storeKey(opts.trackId)
  const variety = loadVariety(key)
  let loc: QuestLocalizer = opts.uiLocale ? makeQuestLocalizer(opts.uiLocale) : literalQuestLocalizer

  return {
    localizer: () => loc,
    setLocale(uiLocale: string): void {
      loc = makeQuestLocalizer(uiLocale)
    },
    nextOptions(completedQuestId: string): Quest[] {
      // A seed that varies with the per-pair play counter, so replays rotate the
      // backfill; combined with the completed id so different quests fork differently.
      const seed = hashSeed(`${completedQuestId}#${variety.n}`)
      return nextQuests(completedQuestId, { recent: variety.r, seed })
    },
    recordStarted(questId: string): void {
      variety.r = pushRecent(variety.r, questId)
      variety.n = (variety.n + 1) | 0
      saveVariety(key, variety)
    },
  }
}

/** Re-export so callers wire from one module (the catalog stays the source of ids). */
export { allQuests }
