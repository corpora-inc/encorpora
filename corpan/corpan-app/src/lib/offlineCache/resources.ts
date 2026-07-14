// src/lib/offlineCache/resources.ts — the per-resource policy table
// (offline-cache.md §3.2), expressed as concrete JsonResource definitions.
// The cache stores RAW WIRE BODIES; app-state filtering happens at read
// time so a devMode/appVersion change re-filters without a forced refetch.
//
// W10 WIRING NOTE (phase 2): the zustand stores' fetch bodies delegate to
// `cachedFetch(resource)` + `subscribeJson(resource.key, …)` and drop their
// per-store etag/lastFetched plumbing; `registerCoreResources()` is called
// once at boot (alongside installTriggers()) so trigger passes cover every
// catalog. Store public APIs (`useCatalogStore.getCatalog()` etc.) stay
// unchanged. The journey course-pack index (W6's journeyPackCatalog.ts)
// rides the same table via JOURNEY_PACK_INDEX_POLICY.

import {
  filterCatalogForApp,
  parseCatalogV3,
  type CatalogGame,
  type CatalogV3,
  type HostPlatform,
} from "../../contentPacks/catalog.ts"
import {
  DEFAULT_PHRASE_PACK_CATALOG_URL,
  parsePhrasePackCatalog,
  type PhrasePackCatalog,
} from "../../contentPacks/phrasePackCatalog.ts"
import {
  DEFAULT_WORD_PACK_CATALOG_URL,
  parseWordPackCatalog,
  type WordPackCatalog,
} from "../../contentPacks/wordPackCatalog.ts"
import { registerResource } from "./jsonCache.ts"
import type { JsonCachePolicy, JsonResource } from "./types.ts"

/** 5 min — matches the CDN's max-age=300 and the historical store TTLs. */
export const CATALOG_TTL_MS = 300_000

/** Policy for every catalog-shaped resource (§3.2 rows 1-4).
 *
 *  `skipConditionalGet: true` — every current catalog origin (CloudFront/S3
 *  for phrase-packs & word-packs, GitHub Pages/Fastly for catalog-v3) fails
 *  the CORS preflight that If-None-Match/If-Modified-Since would trigger
 *  (verified 2026-07-13: OPTIONS → 403 on CloudFront, 405 on Fastly, despite
 *  both answering plain GETs with `access-control-allow-origin: *`). See
 *  `skipConditionalGet` in types.ts for the full story. Flip back to false
 *  for a resource once its origin's CORS config is confirmed to answer
 *  OPTIONS with 2xx. */
export const CATALOG_POLICY: JsonCachePolicy = {
  ttlMs: CATALOG_TTL_MS,
  schema: 1,
  skipConditionalGet: true,
}

/** The journey course-pack index (D6) uses the same policy; the resource
 *  itself lives with journeyPackCatalog.ts (W6's module). */
export const JOURNEY_PACK_INDEX_POLICY: JsonCachePolicy = {
  ttlMs: CATALOG_TTL_MS,
  schema: 1,
  skipConditionalGet: true,
}

/** 6 h — parity with util/remoteQuotaConfig.ts (its sync-boot localStorage
 *  fast path stays; only the background refresh migrates here in phase 2). */
export const QUOTA_CONFIG_POLICY: JsonCachePolicy = { ttlMs: 21_600_000, schema: 1 }

/* ----------------------------- v3 game catalog ----------------------------- */

const CATALOG_V3_URL = "https://encorpora.io/corpan/packs/catalog-v3.json"

/** Raw `CatalogV3` body — cached UNfiltered (§3.2 row 1).
 *
 * `VITE_GAME_CATALOG_V3_URL` lets a dev point a Tauri dev build (desktop OR
 * mobile — `npm run tauri android dev` / `npm run tauri ios dev`) at a local
 * pack catalog server instead of production, e.g.:
 *
 *   VITE_GAME_CATALOG_V3_URL=http://10.0.0.49:8000/corpan/packs/catalog-v3.json \
 *     npm run tauri android dev
 *
 * This is the URL that actually matters for pack installs on this app
 * version — `VITE_GAME_CATALOG_URL` (contentPacks/catalog.ts) only feeds the
 * legacy v1/v2 fallback path, which current (>= 0.10.0) app builds only ever
 * reach if the v3 fetch itself fails. The served body must be v3-shaped
 * (`{ version: 3, generatedAt, packs: [...] }`, each pack with a
 * `minAppVersion` this build satisfies) — `parseCatalogV3` silently drops
 * anything else, and the read-time filter never clobbers a good cached
 * catalog with an empty one (see `applyRaw` in store/catalog.ts), so a
 * malformed override can look like "still hitting production" rather than
 * erroring.
 *
 * DEV-gated: ignored in release builds so a stray env var can never divert
 * a production install away from `CATALOG_V3_URL`. */
export const catalogV3Resource: JsonResource<CatalogV3> = {
  key: "catalog-v3",
  url: () => {
    const envUrl = import.meta.env.DEV
      ? import.meta.env.VITE_GAME_CATALOG_V3_URL
      : undefined
    return typeof envUrl === "string" && envUrl.length > 0 ? envUrl : CATALOG_V3_URL
  },
  parse: parseCatalogV3,
  policy: CATALOG_POLICY,
}

/** Read-time filter: raw body → the entries THIS app install may see.
 *  Filtering after the cache (not before) is what lets a devMode toggle or
 *  app upgrade re-filter instantly with zero network. */
export function visibleCatalog(
  raw: CatalogV3,
  appVersion: string,
  devMode: boolean,
  host?: { platform?: HostPlatform; osVersion?: string },
): CatalogGame[] {
  return filterCatalogForApp(raw, appVersion, devMode, host)
}

/* --------------------------- phrase-pack catalog --------------------------- */

export const phrasePackCatalogResource: JsonResource<PhrasePackCatalog> = {
  key: "phrase-pack-catalog",
  url: () => {
    const envUrl = import.meta.env.DEV
      ? import.meta.env.VITE_PHRASE_PACK_CATALOG_URL
      : undefined
    return typeof envUrl === "string" && envUrl.length > 0
      ? envUrl
      : DEFAULT_PHRASE_PACK_CATALOG_URL
  },
  parse: parsePhrasePackCatalog,
  policy: CATALOG_POLICY,
}

/* ----------------------------- word-pack index ----------------------------- */

export const wordPackIndexResource: JsonResource<WordPackCatalog> = {
  key: "word-pack-index",
  url: () => {
    const envUrl = import.meta.env.DEV
      ? import.meta.env.VITE_WORD_PACK_CATALOG_URL
      : undefined
    return typeof envUrl === "string" && envUrl.length > 0
      ? envUrl
      : DEFAULT_WORD_PACK_CATALOG_URL
  },
  parse: parseWordPackCatalog,
  policy: CATALOG_POLICY,
}

/* --------------------------------- registry -------------------------------- */

/** Register the core resources for trigger-driven revalidation. Idempotent.
 *  Called once at boot by the app shell (W10). */
export function registerCoreResources(): void {
  registerResource(catalogV3Resource as JsonResource<unknown>)
  registerResource(phrasePackCatalogResource as JsonResource<unknown>)
  registerResource(wordPackIndexResource as JsonResource<unknown>)
}
