// src/util/storage/migrate.ts
//
// One-time, idempotent migration of oversized localStorage blobs into the
// IndexedDB (LARGE) tier. Runs early at app startup (see main.tsx). It is the
// safety net for users upgrading from a build that persisted the phrase-pack
// catalog / game catalog directly into localStorage — those blobs are exactly
// what caused the production `QuotaExceededError`.
//
// Strategy: for each known legacy key, if a localStorage value exists, copy it
// verbatim into the LARGE tier under the store's NEW shim namespace, then
// remove the bulky localStorage entry. The migration writes a sentinel so it
// never runs twice. Because the new stores read from the LARGE-tier shim under
// the same namespace, the copied blob is picked up transparently on rehydrate.

import { storage } from "./index"

const MIGRATION_SENTINEL_KEY = "corpan-storage-migration-v1"

/** Legacy localStorage keys that hold large, growable blobs, mapped to the
 *  LARGE-tier namespace their new shim reads from. The shim stores the
 *  zustand payload under the item name === the persist `name`, so we copy
 *  `localStorage[legacyKey]` → largeTier[namespace]::[legacyKey]. */
type LegacyBlob = {
  /** The old localStorage key (zustand persist `name`). */
  legacyKey: string
  /** The LARGE-tier namespace the new shim uses. */
  namespace: string
}

const LEGACY_BLOBS: LegacyBlob[] = [
  // Phrase-pack catalog — the direct cause of the reported crash.
  {
    legacyKey: "corpan-phrase-pack-catalog-v1",
    namespace: "phrase-pack-catalog",
  },
  // Game / reader / narration catalog.
  {
    legacyKey: "corpan-catalog-v2",
    namespace: "game-catalog",
  },
]

function alreadyMigrated(): boolean {
  try {
    return localStorage.getItem(MIGRATION_SENTINEL_KEY) === "1"
  } catch {
    // No localStorage at all (SSR/tests) — treat as migrated, nothing to do.
    return true
  }
}

function markMigrated(): void {
  try {
    localStorage.setItem(MIGRATION_SENTINEL_KEY, "1")
  } catch (err) {
    // If we can't even write a 1-byte sentinel, localStorage is so full that
    // migrating away from it is MORE important — log and continue. Worst case
    // the migration re-runs next launch (it's idempotent).
    console.error("[storage/migrate] could not write sentinel:", err)
  }
}

/** Move oversized localStorage blobs into IndexedDB. Idempotent + safe to
 *  call on every launch; returns the number of blobs migrated this run. */
export async function migrateOversizedLocalStorage(): Promise<number> {
  if (alreadyMigrated()) return 0

  let migrated = 0
  for (const blob of LEGACY_BLOBS) {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(blob.legacyKey)
    } catch (err) {
      console.error(
        `[storage/migrate] read failed for ${blob.legacyKey}:`,
        err,
      )
      continue
    }
    if (raw === null) continue

    // Copy verbatim into the LARGE tier under the SAME item name the new shim
    // reads (zustand persist `name`). The shim stores raw strings, so this
    // round-trips without re-encoding.
    const ns = storage.namespace(blob.namespace, { tier: "large" })
    await ns.set(blob.legacyKey, raw, { volatile: true })

    // Drop the bulky localStorage entry now that it's safe in IndexedDB.
    try {
      localStorage.removeItem(blob.legacyKey)
    } catch (err) {
      console.error(
        `[storage/migrate] could not remove legacy key ${blob.legacyKey}:`,
        err,
      )
    }
    migrated += 1
    console.info(
      `[storage/migrate] moved "${blob.legacyKey}" (${raw.length} chars) ` +
        `from localStorage → IndexedDB(${blob.namespace}).`,
    )
  }

  markMigrated()
  if (migrated > 0) {
    console.info(`[storage/migrate] migrated ${migrated} blob(s) to IndexedDB.`)
  }
  return migrated
}
