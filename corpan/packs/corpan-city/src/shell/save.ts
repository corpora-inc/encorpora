/**
 * save — the persistence seam for Corpan City (DESIGN + minimal impl).
 *
 * Today, `game.ts` persists only the player IDENTITY (name + avatar) under
 * `wp:identity:v1` (see `loadIdentity`/`saveIdentity` there). This module
 * defines the FULL save shape the shell will own as the game grows, so a fresh
 * load can restore the player exactly where they were — without game.ts having
 * to grow its own ad-hoc keys.
 *
 * Storage tier (per PREMIUM_FOUNDATIONS §7 + the shared-localStorage memory):
 * this is a TINY record (identity + a few scalars) → localStorage is correct.
 * Anything large (catalogs, transcripts, generated atlases) must NOT live here;
 * it belongs in IndexedDB. The single key keeps our localStorage footprint to a
 * few KB, a good citizen of the shared ~5 MB origin budget.
 *
 * The schema is VERSIONED (`v`). On a breaking change, bump `SAVE_VERSION` and
 * migrate (or drop) old records in `loadSave`.
 *
 * INTEGRATION NOTE (what the orchestrator wires, when ready):
 *   - game.ts already writes identity. To restore POSITION/PROGRESS too, the
 *     orchestrator passes a `snapshot()` getter into `createShell` (reads
 *     player.getPos(), current questStep, etc.) and the shell calls `writeSave`
 *     on pause/exit/visibilitychange; on boot, game.ts reads `loadSave()` and
 *     seeds the player + quest from it. This file is the contract for that.
 */

import type { OnboardingResult } from "../onboarding/onboarding"

export const SAVE_KEY = "wp:save:v1"
export const SAVE_VERSION = 1 as const

/** A world position (the player's last standing spot). */
export type SavedPosition = { x: number; z: number; facing?: number }

/** Lightweight progress the shell restores on a fresh load. */
export type SavedProgress = {
  /** Active quest id + the step the player has reached. */
  questId?: string
  questStepId?: string
  /** Soft economy counters (server-reconciled later — this is just the cache). */
  xp?: number
  coins?: number
}

export type CorpanCitySave = {
  v: typeof SAVE_VERSION
  /** Player identity (name + avatar). Mirrors `wp:identity:v1` for self-containment. */
  identity: OnboardingResult
  /** Last world position, so re-entry drops you where you left. */
  position?: SavedPosition
  /** Quest / economy progress. */
  progress?: SavedProgress
  /** Epoch millis of the last write (for "continue?" UX + debugging). */
  savedAt: number
}

/** What the orchestrator hands the shell so it can snapshot on demand. */
export type SaveSnapshotProvider = () => Omit<CorpanCitySave, "v" | "savedAt">

export function loadSave(): CorpanCitySave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CorpanCitySave
    if (parsed.v !== SAVE_VERSION) {
      // Future: migrate. For now, a version mismatch means "start fresh" but we
      // keep identity if present so the player isn't re-onboarded needlessly.
      console.warn(`[wp/shell/save] save version ${parsed.v} != ${SAVE_VERSION}; ignoring stale progress.`)
      return null
    }
    return parsed
  } catch (err) {
    console.warn("[wp/shell/save] could not read save:", err)
    return null
  }
}

export function writeSave(snapshot: SaveSnapshotProvider): void {
  try {
    const body = snapshot()
    const record: CorpanCitySave = { v: SAVE_VERSION, savedAt: Date.now(), ...body }
    localStorage.setItem(SAVE_KEY, JSON.stringify(record))
  } catch (err) {
    // QuotaExceededError or serialization failure — never throw into the game
    // loop; just log loudly (project rule: noisy, not silent).
    console.error("[wp/shell/save] could not write save:", err)
  }
}

/** QA / "reset" affordance: wipe the save (identity stays under its own key). */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch (err) {
    console.warn("[wp/shell/save] could not clear save:", err)
  }
}
