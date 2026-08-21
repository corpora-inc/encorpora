// src/lib/offlineCache/index.ts — public API of the D12 offline-first cache
// layer (docs/journey/specs/offline-cache.md). Two halves, one philosophy:
// cache-first render, policy-driven background revalidate, never clobber on
// failure. Stale beats empty; images never break.

export type {
  CachedImageState,
  CachedJson,
  CacheTrigger,
  HostOfflineCacheApi,
  ImageIndexRecord,
  JsonCachePolicy,
  JsonResource,
  StoredJsonRecord,
} from "./types.ts"

export {
  cachedFetch,
  registerResource,
  revalidateAll,
  subscribeJson,
  JSON_CACHE_NS,
} from "./jsonCache.ts"

export {
  cachedImageSrc,
  enforceImageBudget,
  hydrateImageIndex,
  peekCachedImage,
  peekImageDisplay,
  prefetchImages,
  repairImage,
  resolveImageDisplay,
  IMAGE_CACHE_BUDGET_BYTES,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NS,
  type ImageDisplay,
} from "./imageCache.ts"

export { useCachedImage } from "./useCachedImage.ts"
export { singleflight } from "./singleflight.ts"
export { installTriggers, REVALIDATE_CHECK_INTERVAL_MS } from "./triggers.ts"
export { createOfflineCacheHostApi } from "./hostApi.ts"
export {
  catalogV3Resource,
  phrasePackCatalogResource,
  wordPackIndexResource,
  registerCoreResources,
  visibleCatalog,
  CATALOG_POLICY,
  CATALOG_TTL_MS,
  JOURNEY_PACK_INDEX_POLICY,
  QUOTA_CONFIG_POLICY,
} from "./resources.ts"
