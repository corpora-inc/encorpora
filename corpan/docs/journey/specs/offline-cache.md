# Journey Spec — Shared Offline-First Cache Layer (D12)

**Status: v1.0 implementable. Owner: CTO/integrator. Branch: `journey`.**
Implements `ARCHITECTURE.md` D12 (operator directive, 2026-07-03): *everything works
offline; being online only means things quietly get fresher.* One shared cache layer —
cache-first, revalidate-when-appropriate — used by HomeHub, the three catalogs, Journey
course-pack discovery (D6), and packs via the host API. The named bug this kills:
**Home catalog cover images vanish offline.**

All paths relative to `/home/skyl/encorpora/corpan/` unless absolute. Line refs verified
against the `journey` branch on 2026-07-03.

---

## 1. Audit — current reality

### 1.1 Every remote read in the app today

| # | Resource | Code | Offline behavior today | Cached? |
|---|----------|------|------------------------|---------|
| 1 | **v3 experience-pack catalog** `https://encorpora.io/corpan/packs/catalog-v3.json` (`contentPacks/catalog.ts:540`), v1 fallback `catalog.json` (`catalog.ts:311`) | `fetchGameCatalogFresh` (`catalog.ts:754-824`) → `fetchJsonFresh` (`catalogFetch.ts:131-200`); store `store/catalog.ts` | **Good.** Catalog JSON persisted via zustand `persist` → `createLocalStorageShim("game-catalog", {tier:"large"})` → IndexedDB (`store/catalog.ts:185-201`). Offline cold start renders persisted catalog; fetch is skipped when `!isOnline` (`store/catalog.ts:79-82`); errors never clobber cache (`store/catalog.ts:121-134`). 5-min TTL (`store/catalog.ts:37`), ETag/Last-Modified conditional GET (first attempt only — CloudFront preflight workaround, `catalogFetch.ts:147-163`), `cache:"no-store"` deliberately bypasses the WebView HTTP cache (`catalogFetch.ts:158-160`). | IDB (JSON only) |
| 2 | **Catalog cover images** `imageUrl` per entry, e.g. `https://encorpora.io/assets/*-avatar.png` (`catalog.ts:198,218,239…`) | Raw `<img src={imageUrl}>` in `components/home/HomeHub.tsx:65-69` (`Glyph`), `components/packs/PackScreenshot.tsx:48-56` (via `PackCard.tsx:65-66`), `components/PackLaunchTransition.tsx:146-150`, `components/tour/OnboardingTour.tsx:154-156` | **THE NAMED BUG.** The JSON (with `imageUrl` strings) survives offline; the pixels don't. The app never caches image bytes anywhere; the WebView's own HTTP cache is the only hope and is unreliable (no control over CDN cache headers, OS purges it, and every JSON fetch is `no-store` by design so the codebase philosophy is explicit freshness, not WebView cache). Offline: `Glyph` renders a broken/empty `<img>`; `PackScreenshot` `onError` → renders **nothing** (`PackScreenshot.tsx:43-45`). Covers vanish. | **No** |
| 3 | **Phrase-pack catalog** `https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json` (`contentPacks/phrasePackCatalog.ts:35-36`) | `fetchPhrasePackCatalogFresh` → `fetchJsonFresh`; store `store/phrasePackCatalog.ts` (same pattern as #1, `CACHE_DURATION` 5 min at line 27) | Good — same stale-beats-empty store pattern as #1. `iconUrl`/`accentColor` fields exist (`phrasePackCatalog.ts:83-86`) — icons would hit bug #2 when adopted. | IDB (JSON only) |
| 4 | **Word-pack index** `https://d38iwc9748jekz.cloudfront.net/corpan/word-packs/index.json` (`contentPacks/wordPackCatalog.ts:46-47`) | `fetchWordPackCatalogFresh`; store `store/wordPackCatalog.ts` (`CACHE_DURATION` 5 min = the CDN's `max-age=300`, `codebase/content-data.md:140`) | Good — same pattern. This is the module `journeyPackCatalog.ts` will be cloned from (D6, `codebase/content-data.md §6`). | IDB (JSON only) |
| 5 | **Remote quota config** `https://d38iwc9748jekz.cloudfront.net/quota-config.json` (`util/remoteQuotaConfig.ts:37-39`) | Hand-rolled SWR: sync `localStorage` read applied at `main.tsx` top, background refresh, 6 h TTL (`remoteQuotaConfig.ts:41-45,197`) | Good offline (baked defaults + last-good cache). A private, third SWR implementation — migration candidate, not urgent. | localStorage |
| 6 | **App-version manifest + Apple lookup** `…/app-version.json`, `itunes.apple.com/lookup` (`lib/latestVersion.ts:15-24,50-75`) | Plain `fetch` with hourly cache-bust, no persistence | Offline → `null` → no update prompt. Acceptable by design ("err on the side of NOT prompting"). | No (fine) |
| 7 | **Pack manifest fetch (install/update path)** | Tauri: `content_packs_fetch_text` command (`contentPacks/install.ts:84-87` → `native.ts:42-44` → Rust reqwest, `src-tauri/src/content_packs.rs:314`); dev browser: proxied `fetch` (`install.ts:91`) | Offline → install fails with a thrown error. Correct (installs need bytes); UX covered by `OfflineNotice` (`components/OfflineNotice.tsx`). | n/a |
| 8 | **Pack ZIP / module downloads** | Rust `content_packs_install_from_url` / `content_packs_install_module` (`src-tauri/src/lib.rs:1168-1195`), streamed to disk with connect/stall watchdogs (`content_packs.rs:15-42`) | Offline → command errors, surfaced by install dialogs. Correct. | Installed packs ARE the cache |
| 9 | **Reader/Library narration catalog** `catalog-v2.json` (`packs/shared/catalog/src/appShell.ts:99`, `catalogFetch.ts:296-343`) | Pack-side `fetch` with `localStorage` fallback cache (`readCache()` on failure) | JSON survives offline. **Book covers do not**: `coverImageUrl` is rendered as remote CSS `background-image` (`packs/shared/catalog/src/narratorDetail.ts:453-455`, `appShell.ts:679`) — same class of bug as #2, inside a pack. Fixed via the hostApi seam (§7). | localStorage (JSON only) |
| 10 | **Entitlement server POSTs** (`contentPacks/purchase.ts:894,961,1296`), **analytics POST** (`util/analytics.ts:482`) | Write-path RPCs, not cacheable reads. Entitlements already keep an offline lifeline (`store/entitlements.ts`, `codebase/app-shell.md:67`). | Out of scope for this spec. | n/a |
| 11 | **World Radio streams, YouTube embeds** (`PackScreenshot.tsx:21-39`) | Online-only by nature (D11 already parks teletron/world-radio as online side-quests). | Out of scope. | n/a |

### 1.2 Existing caching machinery (what we build on, not around)

- **`contentPacks/catalogFetch.ts`** — the resilient JSON network engine: hard timeout +
  abort (12 s), conditional GET with persisted `Validators`, bounded jittered retry,
  parse-gated results, "a throw means keep your cache" contract. **Reused as-is** as the
  network layer under `cachedFetch`. Do not rewrite it.
- **`util/storage/`** — the D13 tiered storage service: `storage.namespace(name, {tier})`
  → quota-safe IndexedDB (`idb.ts`, LRU + volatile eviction, memory-mirror degradation,
  TTL + schema stamping at `index.ts:46-57,101-106`). **The JSON cache and the image-cache
  index live here.**
- **Revalidation triggers already wired in the shell**: 60 s jittered check loop +
  `focus` + `visibilitychange` (`App.tsx:48,242-274`); connectivity-regained via
  `window online/offline` → `useCatalogStore.setOnlineStatus` (`utils/network.ts:18-31`,
  `store/catalog.ts:150-164,207-211`); explicit pull (`components/home/PacksSection.tsx:69`
  `handleRefresh` → `fetchCatalog(true)`).
- **`contentPacks/devReload.ts`** — dev-only cache-busting for locally served packs;
  orthogonal, unchanged (installed `corpan-pack://` URLs are never dev-reloaded).
- **Custom protocol `corpan-pack`** — registered in
  `plugins/tauri-plugin-game-packs/src/lib.rs:45-114`: serves ANY
  `<first-segment>/<rel-path>` under `app_data_dir/corpan-packs/` with correct MIME
  (`content_type_for_path`, `lib.rs:148-168`; png/jpg/webp/svg all mapped). Reachable as
  `corpan-pack://localhost/…` on macOS/iOS/Linux and `http://corpan-pack.localhost/…` on
  Android/Windows (`src-tauri/src/content_packs.rs:113-118` `pack_url_base()`). Proven in
  production for `<img>`/fonts/audio inside installed packs
  (`content_packs.rs:98-112` doc comment).
- **No service worker** exists (zero `serviceWorker` references in `corpan-app/src`;
  `public/` contains only `locales/` + two svgs). **No `@tauri-apps/plugin-fs` or
  `plugin-http`** in the frontend (`package.json:35-37`) — all privileged I/O goes through
  bespoke commands. **`assetProtocol` is not enabled** (`src-tauri/tauri.conf.json` —
  `app.security` carries only `"csp": null`), so `convertFileSrc` URLs would 404 today.

### 1.3 What image-caching mechanism actually works here (definitive)

| Mechanism | Verdict | Why |
|---|---|---|
| Service Worker + Cache API | **Not usable.** | The main window origin is Tauri's custom scheme (`tauri://localhost` on iOS/macOS/Linux, `http://tauri.localhost` on Android). WKWebView restricts service-worker registration to http(s) origins with the App-Bound-Domains entitlement; custom-scheme documents cannot register SWs on iOS. Android System WebView likewise refuses SW registration for non-https custom-scheme origins. Even if it registered on one platform, we'd ship a mechanism that silently doesn't exist on the other. Banned for this app. |
| WebView HTTP cache (`<img>` relying on CDN headers) | **Not acceptable as the fix.** | We don't control eviction (iOS purges WK website data under pressure), we don't control the CDN headers per-asset, and the codebase already committed to explicit freshness management (`catalogFetch.ts:158-160` bypasses it on purpose). "Sometimes works after a warm run" is exactly the current bug. |
| IndexedDB blobs + `URL.createObjectURL` | **Workable but rejected.** | JS-side `fetch()` of image bytes from the Tauri origin is CORS-gated — `encorpora.io/assets/*.png` responses are not guaranteed to carry ACAO headers (only the catalog JSONs are known-good), so the byte fetch would have to hop through the Rust `content_packs_fetch_bytes` command anyway (`content_packs.rs:700-734`, "no CORS restrictions"). That means: bytes cross IPC into JS, get structured-cloned into IDB, then re-materialized as object URLs every session, competing with catalogs for the same LARGE-tier eviction budget. All cost, no advantage over fs. |
| **Tauri fs blob cache served by the existing `corpan-pack` protocol** | **CHOSEN.** | Download happens in Rust (reqwest — no CORS, existing timeout/stall watchdogs `content_packs.rs:34-42`), lands as a file under the pack root, and the already-registered protocol serves it to `<img src>` natively with correct MIME on every platform, streaming from disk with zero per-render IPC/JS copies. Stable string URLs persist across sessions (no object-URL lifecycle). Survives WK website-data purges (it's app data, not website data). One small additive Rust surface (§5); **zero changes** to the protocol handler itself. |
| `convertFileSrc` / `assetProtocol` | Rejected (viable runner-up). | Would require enabling `assetProtocol` + a scope in `tauri.conf.json` and shipping a second local-file scheme with broader reach (scope maintenance, review surface) when an app-owned, path-constrained protocol already exists and is battle-tested on iOS + Android. |

---

## 2. Design overview

One module: **`corpan-app/src/lib/offlineCache/`**. Two halves, one philosophy
(cache-first render, policy-driven background revalidate, never clobber on failure):

- **JSON cache** — `cachedFetch(resource)` for catalogs/indexes/config. Wraps
  `fetchJsonFresh`; persists `{data, validators, fetchedAt}` per key in the D13 LARGE
  tier; single-flight; TTL per policy; subscribers notified on update.
- **Image cache** — `cachedImageSrc(url)` / `useCachedImage(url)` /
  `<OfflineImage>`. Immutable-by-URL fs blobs under
  `corpan-packs/.offline-cache/img/`, LRU-evicted against a byte budget, index in the
  LARGE tier, served via `corpan-pack` protocol.

```
src/lib/offlineCache/
  index.ts          // public API re-exports
  types.ts          // all exported types below
  jsonCache.ts      // cachedFetch, registry, revalidateAll
  imageCache.ts     // cachedImageSrc, LRU, repair, budget
  useCachedImage.ts // React hook
  singleflight.ts   // shared in-flight coalescing map
  native.ts         // invoke() wrappers for the new commands (mirrors contentPacks/native.ts)
  triggers.ts       // installTriggers(): foreground/online/interval/pull wiring
  jsonCache.test.ts
  imageCache.test.ts
  singleflight.test.ts
src/components/ui/OfflineImage.tsx
src-tauri/src/offline_cache.rs   // new module, commands registered in lib.rs
```

House conventions honored: additive optional hostApi member + feature detection
(`codebase/pack-contract.md §5`), D13 storage tiers, `node --test` unit tests colocated as
`*.test.ts`, loud logging / never-throw degradation, changelog entries per shippable unit.

---

## 3. Types and public API (exact)

```ts
// src/lib/offlineCache/types.ts

/** Why a revalidation pass is running — used for logging + jitter decisions. */
export type CacheTrigger = "startup" | "foreground" | "online" | "interval" | "pull"

export type JsonCachePolicy = {
  /** Freshness window. Within it, cachedFetch serves cache and does NOT hit
   *  the network (except force). */
  ttlMs: number
  /** Forwarded to fetchJsonFresh. Defaults: 12_000 / 3 (catalogFetch.ts:26-27). */
  timeoutMs?: number
  maxAttempts?: number
  /** Schema stamp for the persisted record — bump to invalidate old shapes
   *  (storage semantics: mismatch reads as miss, util/storage/index.ts:101-106). */
  schema?: number
}

export type JsonResource<T> = {
  /** Stable cache key, e.g. "catalog-v3". Also the single-flight key. */
  key: string
  /** Resolved at call time so VITE_* env overrides keep working. */
  url: () => string
  /** Wire-format gatekeeper. null = malformed (soft-fail, keep cache). */
  parse: (raw: unknown) => T | null
  policy: JsonCachePolicy
}

export type CachedJson<T> = {
  data: T
  /** Epoch ms of the last successful network confirmation (200 or 304). */
  fetchedAt: number
  /** True when fetchedAt is outside policy.ttlMs (we're serving stale). */
  stale: boolean
  /** Where this call's data came from. */
  source: "network" | "cache"
}

export type CachedImageState = "resolving" | "cached" | "remote" | "fallback"
```

```ts
// src/lib/offlineCache/jsonCache.ts

/**
 * Cache-first JSON read. Resolution order:
 *   1. Load persisted record for `resource.key` (LARGE tier).
 *   2. Fresh (within ttlMs) and !force → return it, no network.
 *   3. Stale/missing + offline → return stale record (or undefined on true miss).
 *   4. Stale/missing + online → if a record exists and `opts.background` !== false,
 *      RETURN THE STALE RECORD IMMEDIATELY and revalidate in the background
 *      (subscribers notified on change). On a true miss, await the network.
 * Network errors NEVER remove the persisted record. Concurrent calls for the
 * same key coalesce onto one in-flight promise (singleflight.ts).
 */
export async function cachedFetch<T>(
  resource: JsonResource<T>,
  opts?: { force?: boolean; background?: boolean },
): Promise<CachedJson<T> | undefined>

/** Subscribe to updates for a key (background revalidations land here).
 *  Returns an unsubscribe fn. */
export function subscribeJson<T>(
  key: string,
  cb: (value: CachedJson<T>) => void,
): () => void

/** Register a resource for trigger-driven revalidation (revalidateAll). */
export function registerResource(resource: JsonResource<unknown>): void

/** Revalidate every registered resource whose record is stale. Fire-and-forget;
 *  coalesced; jittered internally per catalogFetch.jitter so a fleet never
 *  stampedes (catalogFetch.ts:74-81). */
export function revalidateAll(trigger: CacheTrigger): void
```

```ts
// src/lib/offlineCache/imageCache.ts

/**
 * Resolve a display URL for a remote image, cache-first.
 *  - Non-http(s) src (bundled import, data:, blob:, corpan-pack:) → returned as-is.
 *  - Cache hit → local corpan-pack URL (served_url from the index), touch LRU.
 *  - Miss + online  → kicks a background native download (single-flight per URL),
 *                     resolves to the REMOTE url now; the index gains the entry
 *                     for next render.
 *  - Miss + offline → resolves to undefined (caller shows fallback).
 * Never throws.
 */
export async function cachedImageSrc(url: string): Promise<string | undefined>

/** Pre-warm covers for a catalog (called after each successful catalog
 *  revalidation with the visible entries' imageUrls). Serialized, low priority,
 *  skipped offline. */
export function prefetchImages(urls: string[]): void

/** Drop entries until total bytes <= budget. Volatile-safe to call anytime. */
export async function enforceImageBudget(): Promise<void>

/** Remove a broken index row (file missing on disk) and optionally re-fetch. */
export async function repairImage(url: string): Promise<void>
```

```ts
// src/lib/offlineCache/useCachedImage.ts

/** React binding. Synchronous fast-path: an in-memory mirror of the index is
 *  hydrated once per session, so warm lookups don't flash. */
export function useCachedImage(url?: string): {
  src?: string
  state: CachedImageState
}
```

### 3.1 Storage layout

- **JSON records** — `storage.namespace("offline-cache-json", { tier: "large" })`, key =
  `resource.key`, value:

  ```ts
  type StoredJsonRecord = {
    data: unknown
    validators: Validators        // from catalogFetch.ts:30-33
    fetchedAt: number
  }
  ```

  Stored with `{ schema: policy.schema, volatile: true }` — caches are volatile by
  D13 convention (`util/storage/index.ts:52-56`).

- **Image index** — `storage.namespace("offline-cache-img", { tier: "large" })`, key =
  `sha256(url)` hex (computed via `crypto.subtle.digest`, same helper style as
  `install.ts:60-69`), value:

  ```ts
  type ImageIndexRecord = {
    url: string          // original remote URL (identity — immutable-by-URL)
    relPath: string      // "img/<sha256>.<ext>" under .offline-cache/
    servedUrl: string    // platform-correct corpan-pack URL from Rust
    size: number         // bytes on disk
    contentType: string
    cachedAt: number
    lastUsedAt: number   // LRU clock, touched on every resolve
  }
  ```

  Marked `volatile: false` — eviction is governed by our own byte budget, not the
  generic KV LRU (evicting the index without the file would strand bytes).

- **Blobs** — `app_data_dir/corpan-packs/.offline-cache/img/<sha256(url)>.<ext>`,
  written only by Rust (§5). Extension derived from response `Content-Type`
  (fallback: URL path extension, fallback `bin`).

### 3.2 Per-resource policy table

| Resource | key | ttlMs | schema | Revalidate mode | Notes |
|---|---|---|---|---|---|
| v3 game/reader catalog (raw `CatalogV3`) | `catalog-v3` | `300_000` (5 min — matches current `store/catalog.ts:37` and CDN `max-age=300`) | 1 | background; ETag/Last-Modified conditional | Cache the **raw parsed `CatalogV3` body**; `filterCatalogForApp` (`catalog.ts:616`) runs at read time so a devMode/appVersion change re-filters without a forced refetch (fixes the `catalog.ts` force-on-devMode dance at `store/catalog.ts:166-170`). |
| phrase-pack catalog | `phrase-pack-catalog` | `300_000` | 1 | background; conditional | Wire format v1 (`phrasePackCatalog.ts:31`). |
| word-pack index | `word-pack-index` | `300_000` | 1 | background; conditional | Honors the publisher's `max-age=300` (`codebase/content-data.md:140`). |
| **Journey course-pack index** (D6) | `journey-pack-index` | `300_000` | 1 | background; conditional | `journeyPackCatalog.ts` is built ON this layer from day one — no zustand fetch plumbing of its own. |
| quota config | `quota-config` | `21_600_000` (6 h — parity with `remoteQuotaConfig.ts:45`) | 1 | background | Migration keeps the sync-at-boot localStorage fast path (§6 phase 2); the fetch plumbing moves here. |
| app-version manifest | `app-version` | `86_400_000` (24 h) | 1 | background | Optional adoption; current behavior is acceptable. |
| **Images (covers, icons)** | `sha256(url)` | **immutable-by-URL** (no TTL; a changed cover must ship under a new URL — already the fleet convention: ZIPs immutable, fix = new name, `codebase/content-data.md:216`) | n/a | none (re-fetch only on repair) | **LRU with byte budget** `IMAGE_CACHE_BUDGET_BYTES = 64 * 1024 * 1024` and `IMAGE_CACHE_MAX_ENTRIES = 512`. Current fleet needs ~15 MB (≈40 pack avatars + ≈41 book covers + phrase-pack icons); 64 MiB leaves imagepan-era headroom without threatening disk. |

### 3.3 Revalidation triggers (single wiring point)

`installTriggers()` (called once from `App.tsx`, replacing the inline effect at
`App.tsx:242-274`):

1. **startup** — after first paint (idle callback), `revalidateAll("startup")`.
2. **app-foreground** — `document.visibilitychange → visible` plus `window focus`
   (the exact signals already proven at `App.tsx:260-274`; on iOS/Android Tauri the
   WebView fires `visibilitychange` on app resume — this is the same signal the
   entitlement re-check relies on at `App.tsx:277-295`).
3. **connectivity-regained** — `window "online"` via the existing
   `listenToNetworkChanges` bridge (`utils/network.ts:18-31`); the store bridge at
   `store/catalog.ts:207-211` remains the `useOnlineStatus()` source of truth.
4. **interval** — 60 s jittered loop (`CATALOG_REFRESH_CHECK_INTERVAL_MS`,
   `App.tsx:48`; jitter from `catalogFetch.ts:74`). The loop *checks* staleness; TTLs
   decide whether anything actually hits the network.
5. **explicit pull** — refresh buttons call `cachedFetch(resource, { force: true })`
   (today: `PacksSection.tsx:69`).

Guards on every pass: skip when `document.visibilityState === "hidden"` or
`!navigator.onLine` (as today, `App.tsx:244-246`). Triggers that fire together
(online + foreground) coalesce in the single-flight map — at most one network call
per key.

### 3.4 Stampede control / coalescing

`singleflight.ts`:

```ts
/** At most one in-flight promise per key; concurrent callers share it. */
export function singleflight<T>(key: string, run: () => Promise<T>): Promise<T>
```

Used by both halves (JSON key = `resource.key`; image key = `img:<sha256>`). This
subsumes the per-store `isFetching` re-entrancy flags (`store/catalog.ts:61-64`) — the
stores keep the flag only as UI state (spinner). Fleet-scale stampede protection stays
where it lives today: full-jitter retry backoff + interval jitter in `catalogFetch.ts`.

### 3.5 Corruption / partial-write recovery

- **JSON**: writes are parse-gated (only a successfully parsed body is persisted —
  same contract as `fetchJsonFresh`); records carry `schema` so shape changes read as
  misses; a record that fails `resource.parse` on read is deleted and treated as a miss;
  network/parse failures never delete the last-good record.
- **Image blobs (Rust)**: download streams to
  `.offline-cache/tmp/<uuid>` then `fs::rename` into `img/` — atomic on the same volume,
  so a crash mid-download never leaves a half-file at a servable path. On startup the
  put command's first invocation sweeps `tmp/` entries older than 1 h.
- **Index ↔ fs drift**:
  - Index row, file missing → `<OfflineImage>`'s local-URL `onError` calls
    `repairImage(url)`: delete row; if online, re-download.
  - File present, no index row (index evicted/corrupted) → weekly-ish opportunistic
    sweep inside `enforceImageBudget()`: `offline_cache_list()` minus index → orphans
    deleted via `offline_cache_delete`.
- **IndexedDB unavailable** → the D13 storage layer already degrades to a memory
  mirror (`util/storage/index.ts:88-95`); the cache layer inherits session-only
  behavior and the remote-URL passthrough keeps images working online.

---

## 4. `<OfflineImage>` component

`src/components/ui/OfflineImage.tsx` — the drop-in replacement for every raw
`<img>` whose `src` may be remote:

```tsx
import { type ReactNode, type ImgHTMLAttributes } from "react"
import { useCachedImage } from "@/lib/offlineCache"

export function OfflineImage({
  src,
  fallback,
  alt = "",
  ...imgProps
}: {
  /** Remote https URL, bundled asset import, or undefined. */
  src?: string
  /** Rendered when no pixels are available (offline miss / load error).
   *  Callers pass their existing lucide glyph. Never render a broken image. */
  fallback?: ReactNode
  alt?: string
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt">): ReactNode
```

Behavior (exact):

1. `useCachedImage(src)` resolves the display URL per §3 `cachedImageSrc` semantics.
2. `state === "resolving"` (first-ever lookup, index not yet warm) → render `fallback`
   (glyphs render instantly; no layout shift — same box).
3. `state === "cached"` → `<img src={servedUrl} …>`; `onError` → `repairImage(url)`
   then fall through to remote-if-online else `fallback`.
4. `state === "remote"` (online, not yet cached) → `<img src={remoteUrl} …>`;
   background caching is already in flight; `onError` → `fallback`.
5. `state === "fallback"` (offline miss) → `fallback`.
6. Non-http(s) `src` (bundled `phraseFlipArt`, `corpanMark`, data/blob URLs) →
   plain `<img>` passthrough, no caching.

Call-site swaps (phase 1): `HomeHub.tsx:65-69` (`Glyph` keeps its lucide fallback via
the `fallback` prop), `PackScreenshot.tsx:48-56` (fallback stays `null` — screenshots
are optional content, but the cached copy now renders offline),
`PackLaunchTransition.tsx:146-150`, `tour/OnboardingTour.tsx:154-156`.

`prefetchImages()` is invoked from the jsonCache subscriber after each successful
catalog revalidation with the filtered entries' `imageUrl`s — covers are warm before
the user ever goes offline, not only after they were once rendered.

---

## 5. Rust additions (additive; no existing behavior changes)

New module `src-tauri/src/offline_cache.rs`; commands registered in the
`invoke_handler` list at `src-tauri/src/lib.rs:1580-1598`.

```rust
/// Reserved top-level dirs under corpan-packs/ that can never be a pack id.
/// validate_pack_id (content_packs.rs:747-771) currently ACCEPTS dotted names
/// like ".offline-cache" (charset is [A-Za-z0-9._-]) — add this rejection there:
const RESERVED_PACK_DIRS: &[&str] = &[".offline-cache"];

#[derive(Serialize)]
pub struct OfflineCachePutResult {
    pub rel_path: String,     // "img/<sha256>.<ext>"
    pub served_url: String,   // pack_url_base() + ".offline-cache/" + rel_path
    pub size: u64,
    pub content_type: String,
}

/// Download `url` (https, or http for private hosts — same policy as
/// fetch_bytes, content_packs.rs:705-715) into
/// corpan-packs/.offline-cache/img/<sha256(url)>.<ext>.
/// Uses download_client() (connect 30s / stall 120s watchdogs,
/// content_packs.rs:34-42). Streams to .offline-cache/tmp/<uuid>, verifies
/// size <= max_bytes (default 8 MiB — covers are ~100 KB; anything bigger is
/// a config error), then renames atomically. Idempotent: if the final file
/// already exists, returns it without a network hit.
#[tauri::command]
pub async fn offline_cache_put(
    app: AppHandle,
    url: String,
    max_bytes: Option<u64>,
) -> Result<OfflineCachePutResult, String>

/// Delete cached files. Every rel_path is sanitize_rel'd + canonicalize-
/// contained inside .offline-cache/ (mirror of fetch_text's containment,
/// content_packs.rs:339-353). Missing files are not errors.
#[tauri::command]
pub fn offline_cache_delete(app: AppHandle, rel_paths: Vec<String>) -> Result<u32, String>

#[derive(Serialize)]
pub struct OfflineCacheEntry { pub rel_path: String, pub size: u64, pub modified_ms: i64 }

/// List files under .offline-cache/img/ (for orphan sweeps / budget audits).
#[tauri::command]
pub fn offline_cache_list(app: AppHandle) -> Result<Vec<OfflineCacheEntry>, String>
```

Serving needs **zero protocol changes**: the handler at
`plugins/tauri-plugin-game-packs/src/lib.rs:45-114` treats the first path segment as a
directory name under the pack root and `safe_join` only rejects `..` — so
`corpan-pack://localhost/.offline-cache/img/<hash>.png` (and the
`http://corpan-pack.localhost/…` form) already serves with the right `Content-Type`.
The one required guard is the `RESERVED_PACK_DIRS` rejection inside `validate_pack_id`
so no catalog entry can ever claim `.offline-cache` as its pack id and write into the
cache dir (`content_packs_install_from_url` / `install_module` both route ids through
`validate_pack_id`). Rust computes `served_url` via the existing `pack_url_base()`
(`content_packs.rs:113-118`) so JS never branches on platform.

JS wrappers in `src/lib/offlineCache/native.ts` mirror `contentPacks/native.ts` style
(`invoke("offline_cache_put", { url, maxBytes })`, …). Outside Tauri
(`isTauriRuntime()` false — `install.ts:71-79`), `imageCache.ts` skips the native path
entirely and passes remote URLs through (dev browser relies on the normal HTTP cache;
`npm run dev` behavior is unchanged).

CSP is `null` (`tauri.conf.json` app.security) — no `img-src` change needed. If a CSP
ever ships, `corpan-pack:` must join `img-src` (note this in the config PR).

---

## 6. Migration plan (order is the point)

**Phase 1 — Home covers (the named bug). Ships first, alone.**
- `offlineCache` image half + Rust commands + `<OfflineImage>` + `useCachedImage`.
- Swap the four call sites (§4). `prefetchImages` wired to the existing catalog store
  update (subscribe to `useCatalogStore` — phase 1 does NOT touch the JSON stores).
- Changelog: `corpan-app/CHANGELOG.md` `[Unreleased]` — "Catalog cover art now renders
  offline (cached on device after first sight)".
- Acceptance: airplane-mode cold start shows Home with covers (§8 T1).

**Phase 2 — Catalogs move onto `cachedFetch`.**
- `store/catalog.ts`, `store/phrasePackCatalog.ts`, `store/wordPackCatalog.ts`: their
  `fetchCatalog` bodies delegate to `cachedFetch` + `subscribeJson`; per-store
  ETag/lastFetched/persisted-catalog fields move to the cache layer (zustand
  `version` bump + `migrate` seeds the cache from the legacy persisted record so no
  device refetches cold — house pattern per D5).
- v3 raw-body caching + read-time `filterCatalogForApp` (§3.2 note).
- `App.tsx:242-274` inline effect replaced by `installTriggers()`.
- `util/remoteQuotaConfig.ts` keeps its sync-boot localStorage fast path but its
  background refresh becomes a registered resource.
- Store public APIs (`useCatalogStore.getCatalog()` etc.) unchanged — zero component
  churn beyond App.tsx.

**Phase 3 — Journey consumes it natively.**
- `contentPacks/journeyPackCatalog.ts` (D6) is written as a thin
  `JsonResource<JourneyPackIndex>` + `visibleJourneyPacks(appVersion, devMode)` filter
  (clone the `wordPackCatalog.ts` parser conventions, but no bespoke store fetch
  machinery). Course-pack cover art (if any) goes straight through `<OfflineImage>`.

**Phase 4 — hostApi exposure + Library covers.**
- Additive optional member (see below), `__CORPAN_HOST_CAPS.offlineCache = true` in
  `main.tsx:18`, SDK mirror in `packs/sdk/index.d.ts`.
- `packs/shared/catalog` reader surfaces (`narratorDetail.ts:453-455`,
  `appShell.ts:679`, `bookDetail.ts`, `catalogBrowser.ts`) resolve `coverImageUrl`
  through `hostApi.offlineCache?.imageSrc(url)` when present, remote URL otherwise
  (feature detection — the codebase's real compatibility convention, D2).

```ts
// contentPacks/types.ts (append to HostApi, types.ts:590-738 block)
/** Offline-first cache seam (D12). Additive + optional — feature-detect. */
offlineCache?: HostOfflineCacheApi

export type HostOfflineCacheApi = {
  /** Resolve a display URL for a remote image: local cached copy when
   *  available, the remote URL when online-and-uncached (caching kicks off
   *  in the background), undefined when offline with no cached copy. */
  imageSrc: (url: string) => Promise<string | undefined>
  /** Cache-first JSON GET for pack-owned remote indexes. Keys are namespaced
   *  `pack:<packId>:<key>` by the host. Returns undefined on a true miss. */
  fetchJson: (
    url: string,
    opts?: { key?: string; ttlMs?: number },
  ) => Promise<unknown>
}
```

Implementation lives in `createHostApi(packId)` (`hostApi.ts:182`): `imageSrc` =
`cachedImageSrc` directly (images are immutable-by-URL, shared across packs —
dedupe is a feature); `fetchJson` wraps `cachedFetch` with key
`pack:${packId ?? "anon"}:${opts?.key ?? sha256(url)}`, default `ttlMs` 300_000,
`parse` = identity-on-object.

---

## 7. Offline UX rules (binding for every consumer)

1. **Never blank; stale beats empty.** Any surface with a persisted record renders it
   immediately — including cold-start offline. Empty states are reserved for true
   never-fetched misses, and then show `OfflineNotice`, not a spinner.
2. **Images never break.** `<OfflineImage>` renders cached pixels, remote pixels, or the
   caller's glyph fallback — a broken-image icon or empty box is a bug.
3. **Background revalidation is silent.** Failures log (loudly, per house rule) but never
   toast/banner; the UI simply keeps the stale data. Only an explicit pull may surface
   an inline failure state.
4. **Subtle freshness affordances.** Explicit pull shows the existing spinner
   (`isFetching`). Optional microcopy on catalog surfaces: `t("cache.updatedJustNow")` /
   nothing at all — no timestamps, no nagging. New keys ship to all ~54 locales
   (build gate `check:i18n`).
5. **No absolutes in copy** (`feedback_no_absolutes_in_marketing`): "Works offline" for
   installed content is fine; never "always available", "100% offline", "never needs
   internet". Freshness copy: "Updates when you're online", not "always up to date".
6. **Actions that truly need bytes** (install, update, purchase) keep failing fast with
   `OfflineNotice` guidance — the cache layer never fakes an install.

---

## 8. Test plan

**Unit — `node --test` (house runner: `npm test`, pattern per
`contentPacks/catalogFetch.test.ts`).** Storage + invoke get tiny injectable seams
(the storage harness at `util/storage/__harness__` already exists).

- `jsonCache.test.ts`: fresh-within-TTL serves cache with zero network calls; stale +
  online returns stale immediately and notifies subscriber after background 200; 304
  refreshes `fetchedAt` without data churn; network error / parse-null never deletes the
  record; `force` bypasses TTL and validators; schema bump reads as miss; offline true
  miss returns `undefined`.
- `singleflight.test.ts`: N concurrent `cachedFetch` for one key → exactly one `run`;
  rejection releases the slot; distinct keys don't serialize.
- `imageCache.test.ts`: non-http passthrough; miss+offline → undefined; miss+online →
  remote URL now + one native put; hit → servedUrl + `lastUsedAt` touched; LRU eviction
  drops oldest-used until under budget and calls `offline_cache_delete` with exactly
  those relPaths; orphan sweep deletes fs-only files; `repairImage` drops the row.
- `OfflineImage` states: covered via `useCachedImage` state-machine tests (resolve
  order, error fallbacks) — no DOM required.

**Rust — `cargo test` in `src-tauri`:**
- `validate_pack_id` rejects `.offline-cache` (and keeps accepting `journey_en`).
- put: tmp+rename leaves no partial file at a servable path on simulated failure;
  idempotent re-put skips network; size ceiling enforced; extension inference.
- delete/list: containment (a `..` relPath errors), missing file is not an error.

**Manual device matrix — iOS + Android (protocol URL form differs by platform), via
the dev loop (`DEV_LOOP.md`, `npm run dev:tail`):**

1. **Airplane-mode cold start (the acceptance test for the named bug):** fresh install →
   online session, open Home, see covers → force-quit → enable airplane mode → cold
   launch. PASS = Home renders the full catalog **with cover art** from cache, no broken
   images, no wedged spinners, within normal launch time.
2. **Offline-first-run:** fresh install, airplane mode from the start. PASS = default
   catalog + glyph fallbacks everywhere, `OfflineNotice` on install surfaces, zero
   broken-image icons.
3. **Connectivity regained:** airplane off mid-session → exactly one coalesced
   revalidation burst (watch logs), catalog + covers update in place, no flicker.
4. **Foreground revalidate:** background the app past TTL, publish a catalog change,
   resume → change appears without relaunch.
5. **Eviction drill (dev):** temporarily set budget to 1 MiB via a `devDebug.ts` hook →
   browse many covers → verify LRU deletions in logs, UI self-heals by re-fetching.
6. **Corruption drill (dev):** delete one cached blob file on disk → render its cover →
   verify `onError → repair → re-download` path; clear the IDB index → verify orphan
   sweep reclaims files.
7. **Pack seam (phase 4):** Library open offline shows cached book covers.

**Regression gates:** `npm run tsc`, `npm test`, `npm run build` (i18n gate),
`cargo check` + `cargo clippy` in `src-tauri` and the plugin.

---

## 9. Explicitly out of scope

- Caching pack ZIP/audio content (installs are already the durable cache).
- Analytics/entitlement write paths (D13's analytics store spec covers events).
- A service-worker strategy of any kind (§1.3 — not available in these WebViews).
- Changing catalog wire formats, URLs, or CDN cache headers.

## 10. Open items (operator)

- Image budget default 64 MiB / 512 entries — revisit when imagepan (D10 §6) ships its
  own pack (imagepan content does NOT ride this cache; it's an installed pack).
- Whether the freshness microcopy ships at all in v1 or surfaces stay silent.
