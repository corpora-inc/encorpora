// src/lib/offlineCache/legacySeed.ts — phase-2 upgrade migration
// (offline-cache.md §6): the three catalog stores' zustand `migrate` hooks
// call these to seed the offline-cache-json records from the LEGACY per-store
// persisted state, so no device cold-refetches (or worse, cold-blanks
// offline) after the app upgrade that moved the stores onto cachedFetch.
//
// Two shapes of legacy state exist:
//
//  - phrase-pack catalog + word-pack index persisted the RAW parsed wire
//    body → seeded verbatim, WITH the legacy ETag/Last-Modified validators
//    (they describe exactly that body, so the first revalidation can 304).
//
//  - the game catalog persisted the FILTERED CatalogGame[] (post
//    filterCatalogForApp), while the cache layer stores the RAW CatalogV3
//    body (§3.2 row 1 — filtering happens at read time). We reconstruct a
//    synthetic CatalogV3 from the filtered list: every field CatalogGame
//    carries maps 1:1 onto a `channel:"stable"` entry, so read-time
//    filtering over the synthetic body reproduces the exact catalog the
//    device was already showing. The legacy validators are deliberately
//    DROPPED — they describe the raw CDN body, and carrying them over
//    would let a 304 confirm our synthetic (filtered) body as current.
//    fetchedAt seeds as-is, so the record is stale by TTL and the first
//    online pass replaces the synthetic body with the true raw one.

import type { Validators } from "../../contentPacks/catalogFetch.ts"
import type { CatalogGame, CatalogV3, CatalogV3Entry } from "../../contentPacks/catalog.ts"
import { seedJsonRecord } from "./jsonCache.ts"
import {
  catalogV3Resource,
  phrasePackCatalogResource,
  wordPackIndexResource,
} from "./resources.ts"

/** Loose view of a legacy persisted store state (zustand partialize shape). */
export type LegacyCatalogPersist = {
  catalog?: unknown
  lastFetched?: unknown
  etag?: unknown
  lastModified?: unknown
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

function legacyValidators(state: LegacyCatalogPersist): Validators {
  const validators: Validators = {}
  const etag = asStringOrNull(state.etag)
  const lastModified = asStringOrNull(state.lastModified)
  if (etag) validators.etag = etag
  if (lastModified) validators.lastModified = lastModified
  return validators
}

/**
 * Reconstruct a synthetic raw CatalogV3 body from a legacy FILTERED
 * CatalogGame[] snapshot. Lossless for every field CatalogGame carries;
 * `minAppVersion` defaults to "0.0.0" (the device already passed the real
 * gate when this list was filtered) and `channel` to "stable" (preview
 * entries a dev device saw re-appear on the first real fetch).
 */
export function legacyCatalogGamesToRawV3(games: CatalogGame[]): CatalogV3 {
  const packs: CatalogV3Entry[] = games
    .filter((g) => g && typeof g === "object" && typeof g.id === "string" && g.id.length > 0)
    .map((g) => ({
      id: g.id,
      name: g.name || g.id,
      ...(g.nameLocalized ? { nameLocalized: g.nameLocalized } : {}),
      version: g.version || "0.0.0",
      ...(g.manifestUrl ? { manifestUrl: g.manifestUrl } : {}),
      ...(g.description ? { description: g.description } : {}),
      ...(g.descriptionLocalized ? { descriptionLocalized: g.descriptionLocalized } : {}),
      ...(g.imageUrl ? { imageUrl: g.imageUrl } : {}),
      ...(g.purchase ? { purchase: g.purchase } : {}),
      minAppVersion: g.minAppVersion ?? "0.0.0",
      channel: "stable" as const,
      ...(g.systemPack === true ? { systemPack: true } : {}),
      ...(g.categories ? { categories: g.categories } : {}),
      ...(g.goodForClass ? { goodForClass: g.goodForClass } : {}),
      ...(g.recommendOrder !== undefined ? { recommendOrder: g.recommendOrder } : {}),
      ...(g.featuredFor ? { featuredFor: g.featuredFor } : {}),
      ...(g.kidFriendly !== undefined ? { kidFriendly: g.kidFriendly } : {}),
      ...(g.languages ? { languages: g.languages } : {}),
      ...(g.tagline ? { tagline: g.tagline } : {}),
      ...(g.taglineLocalized ? { taglineLocalized: g.taglineLocalized } : {}),
      ...(g.activities ? { activities: g.activities } : {}),
    }))
  return {
    version: 3,
    generatedAt: new Date(0).toISOString(),
    packs,
  }
}

/** Seed `catalog-v3` from the legacy `corpan-catalog-v2` persisted state.
 *  Returns true when a record was written. Never throws (migrate hooks must
 *  never brick rehydration). */
export async function seedGameCatalogFromLegacy(state: LegacyCatalogPersist): Promise<boolean> {
  try {
    if (!Array.isArray(state.catalog) || state.catalog.length === 0) return false
    const raw = legacyCatalogGamesToRawV3(state.catalog as CatalogGame[])
    if (raw.packs.length === 0) return false
    return await seedJsonRecord(catalogV3Resource, {
      data: raw,
      // Validators dropped on purpose — see header note.
      fetchedAt: asNumberOrNull(state.lastFetched),
    })
  } catch (err) {
    console.warn("[offlineCache] legacy game-catalog seed failed:", err)
    return false
  }
}

/** Seed `phrase-pack-catalog` from the legacy persisted raw body. */
export async function seedPhrasePackCatalogFromLegacy(
  state: LegacyCatalogPersist,
): Promise<boolean> {
  try {
    if (!state.catalog || typeof state.catalog !== "object") return false
    return await seedJsonRecord(phrasePackCatalogResource, {
      data: state.catalog,
      validators: legacyValidators(state),
      fetchedAt: asNumberOrNull(state.lastFetched),
    })
  } catch (err) {
    console.warn("[offlineCache] legacy phrase-pack-catalog seed failed:", err)
    return false
  }
}

/** Seed `word-pack-index` from the legacy persisted raw body. */
export async function seedWordPackIndexFromLegacy(
  state: LegacyCatalogPersist,
): Promise<boolean> {
  try {
    if (!state.catalog || typeof state.catalog !== "object") return false
    return await seedJsonRecord(wordPackIndexResource, {
      data: state.catalog,
      validators: legacyValidators(state),
      fetchedAt: asNumberOrNull(state.lastFetched),
    })
  } catch (err) {
    console.warn("[offlineCache] legacy word-pack-index seed failed:", err)
    return false
  }
}
