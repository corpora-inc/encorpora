// src/lib/offlineCache/hostApi.ts — the pack-facing offline-cache seam
// (offline-cache.md §6 phase 4). DEFINED here; WIRED by W10:
//
//   1. contentPacks/types.ts (HostApi block): add the additive optional
//      member  `offlineCache?: HostOfflineCacheApi`  (type re-exported from
//      this module via lib/offlineCache).
//   2. hostApi.ts createHostApi(packId): `offlineCache:
//      createOfflineCacheHostApi(packId)`.
//   3. main.tsx HOST_CAPS: `__CORPAN_HOST_CAPS.offlineCache = true`, plus
//      the SDK mirror in packs/sdk/index.d.ts.
//
// Packs feature-detect (`hostApi.offlineCache?.imageSrc(url)`) — the
// codebase's real compatibility convention (D2). packs/shared/catalog's
// narratorDetail already resolves covers through an injected resolver that
// W10 points at this seam.

import { cachedFetch } from "./jsonCache.ts"
import { cachedImageSrc, hashUrl } from "./imageCache.ts"
import type { HostOfflineCacheApi, JsonResource } from "./types.ts"

/** Default freshness window for pack-owned JSON (same as the catalogs). */
const PACK_JSON_TTL_MS = 300_000

/** Build the `hostApi.offlineCache` member for one pack. Images are
 *  immutable-by-URL and shared across packs (dedupe is a feature); JSON keys
 *  are namespaced per pack so two packs can't fight over one record. */
export function createOfflineCacheHostApi(packId?: string): HostOfflineCacheApi {
  return {
    imageSrc: (url: string) => cachedImageSrc(url),

    fetchJson: async (url: string, opts?: { key?: string; ttlMs?: number }) => {
      const key = `pack:${packId ?? "anon"}:${opts?.key ?? (await hashUrl(url))}`
      const resource: JsonResource<unknown> = {
        key,
        url: () => url,
        // Identity-on-object gatekeeper: any JSON body is accepted; the
        // pack owns its own schema discipline.
        parse: (raw) => (raw == null ? null : raw),
        policy: { ttlMs: opts?.ttlMs ?? PACK_JSON_TTL_MS, schema: 1 },
      }
      const result = await cachedFetch(resource)
      return result?.data
    },
  }
}
