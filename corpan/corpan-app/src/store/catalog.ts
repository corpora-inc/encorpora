// src/store/catalog.ts
//
// Game/reader catalog store — phase 2 of the D12 offline-cache migration
// (docs/journey/specs/offline-cache.md §6): the fetch body delegates to
// `cachedFetch(catalogV3Resource)` + `subscribeJson`, so persistence,
// TTL, conditional 304 revalidation, singleflight and the never-clobber
// contract all live in ONE place (src/lib/offlineCache). The cache stores
// the RAW CatalogV3 body; `visibleCatalog()` (filterCatalogForApp) runs at
// READ time here — a devMode toggle or app upgrade re-filters instantly
// from the cached body with ZERO network (the old force-on-devMode refetch
// dance is gone).
//
// Public API is unchanged: `catalog`, `getCatalog()`, `fetchCatalog()`,
// `lastFetched`/`lastChecked`, `isOnline`/`setOnlineStatus`, `isFetching`,
// `appVersion`, `devMode`/`setDevMode`, `clearCache`. Consumers untouched.
//
// Upgrade path: zustand `version: 2` + `migrate` seeds the offline-cache
// record from the legacy persisted catalog (lib/offlineCache/legacySeed.ts)
// so no device cold-refetches — or renders blank offline — after upgrade.

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  getDefaultCatalog,
  withDevReaders,
  type CatalogGame,
  type CatalogV3,
  type HostPlatform,
} from "../contentPacks/catalog"
import { isTauriRuntime } from "../contentPacks/install"
import { getNetworkStatus, listenToNetworkChanges } from "../utils/network"
import { getAppVersion } from "../lib/appVersion"
import { createLocalStorageShim } from "../util/storage"
import { cachedFetch, subscribeJson } from "../lib/offlineCache/jsonCache"
import { catalogV3Resource, visibleCatalog } from "../lib/offlineCache/resources"
import { seedGameCatalogFromLegacy } from "../lib/offlineCache/legacySeed"

type CatalogState = {
  catalog: CatalogGame[]
  /** Epoch ms of the last successful network confirmation (mirrors the
   *  cache record's fetchedAt; also set when rendering from cache). */
  lastFetched: number | null
  /** Last time we *checked* for freshness (even if the answer was 304 or an
   *  error). Distinct from `lastFetched`, which marks confirmed data. */
  lastChecked: number | null
  isOnline: boolean
  isFetching: boolean
  appVersion: string | null
  devMode: boolean

  fetchCatalog: (force?: boolean) => Promise<void>
  getCatalog: () => CatalogGame[]
  setOnlineStatus: (online: boolean) => void
  setDevMode: (enabled: boolean) => void
  clearCache: () => void
}

/** The RAW CatalogV3 body currently rendered from. In-memory only — the
 *  offline-cache layer owns persistence; keeping it here lets a devMode
 *  toggle re-filter synchronously without touching IndexedDB. */
let rawCatalog: CatalogV3 | null = null

/** Best-effort host detection (platform + OS version) for read-time
 *  filtering — same probe fetchGameCatalogFresh uses, cached per session.
 *  Outside Tauri resolves {} so platform/minOSVersion gates are no-ops. */
let hostPromise: Promise<{ platform?: HostPlatform; osVersion?: string }> | null = null
function detectHostOnce(): Promise<{ platform?: HostPlatform; osVersion?: string }> {
  if (!hostPromise) {
    hostPromise = (async () => {
      if (typeof window === "undefined" || !isTauriRuntime()) return {}
      try {
        const { type, version } = await import("@tauri-apps/plugin-os")
        const t = type()
        const allowed: HostPlatform[] = ["ios", "android", "macos", "windows", "linux"]
        const platform = (allowed as readonly string[]).includes(t)
          ? (t as HostPlatform)
          : undefined
        return { platform, osVersion: version() || undefined }
      } catch {
        return {}
      }
    })()
  }
  return hostPromise
}

/** Wait for the persist middleware to finish (re)hydration — the `migrate`
 *  seeding runs inside it, so the first fetch must not race past it on an
 *  upgraded device. Resolves immediately once hydrated. */
function whenHydrated(): Promise<void> {
  return new Promise((resolve) => {
    const api = useCatalogStore.persist
    if (!api || api.hasHydrated()) {
      resolve()
      return
    }
    const unsub = api.onFinishHydration(() => {
      unsub()
      resolve()
    })
  })
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => {
      /** Read-time filter: raw body → what THIS install may see, with the
       *  DEV local-reader override. Never clobbers a good catalog with an
       *  empty filter result (parity with the old store's error branch). */
      const applyRaw = async (raw: CatalogV3, fetchedAt: number | null): Promise<void> => {
        rawCatalog = raw
        let { appVersion } = get()
        if (!appVersion) {
          appVersion = await getAppVersion()
          set({ appVersion })
        }
        const host = await detectHostOnce()
        const { devMode } = get()
        const visible = withDevReaders(visibleCatalog(raw, appVersion, devMode, host))
        if (visible.length === 0 && raw.packs.length > 0) {
          console.warn(
            "[catalog] raw catalog filtered to empty for app",
            appVersion,
            "— keeping previous catalog",
          )
          set((s) => ({
            catalog: s.catalog.length > 0 ? s.catalog : getDefaultCatalog(),
            ...(fetchedAt != null ? { lastFetched: fetchedAt } : {}),
          }))
          return
        }
        set({
          catalog: visible,
          ...(fetchedAt != null ? { lastFetched: fetchedAt } : {}),
        })
      }

      return {
        catalog: [],
        lastFetched: null,
        lastChecked: null,
        isOnline: getNetworkStatus(),
        isFetching: false,
        appVersion: null,
        devMode: (() => {
          try {
            return localStorage.getItem("corpan:dev-packs") === "true"
          } catch {
            return false
          }
        })(),

        fetchCatalog: async (force = false) => {
          // UI re-entrancy flag only — network dedup is the cache layer's
          // singleflight. Kept so spinners behave exactly as before.
          if (get().isFetching) return
          set({ isFetching: true })
          try {
            // The upgrade migration seeds the cache record inside persist
            // rehydration — never race the first read past it.
            await whenHydrated()
            const result = await cachedFetch(catalogV3Resource, { force })
            const now = Date.now()
            if (result) {
              await applyRaw(result.data, result.fetchedAt)
              set({ lastChecked: now })
            } else {
              // Nothing live and nothing cached. Keep whatever catalog we
              // already have rather than clobbering it; only seed the tiny
              // built-in default set when completely empty (first run, no
              // network). Don't stamp lastFetched, so we keep retrying.
              set((s) =>
                s.catalog.length === 0
                  ? { catalog: getDefaultCatalog(), lastChecked: now }
                  : { lastChecked: now },
              )
            }
          } catch (error) {
            console.error("[catalog] Failed to fetch:", error)
            // Keep existing cached catalog on error.
          } finally {
            // ALWAYS clear the in-flight flag (the historical "zombie"
            // guard — a hung fetch must never wedge refreshes).
            set({ isFetching: false })
          }
        },

        getCatalog: () => {
          return get().catalog
        },

        setOnlineStatus: (online: boolean) => {
          set({ isOnline: online })
          // Coming back online: kick a cache-first read. The offline-cache
          // triggers (installTriggers) revalidate registered resources on
          // the same signal; both paths coalesce in the singleflight map.
          if (online) {
            void get().fetchCatalog()
          }
        },

        setDevMode: (enabled: boolean) => {
          set({ devMode: enabled })
          // Read-time re-filter from the cached raw body — NO refetch.
          if (rawCatalog) {
            void applyRaw(rawCatalog, null)
          } else {
            void get().fetchCatalog()
          }
        },

        clearCache: () => {
          rawCatalog = null
          set({ catalog: [], lastFetched: null, lastChecked: null })
          // Forced refresh replaces the cache-layer record on success.
          void get().fetchCatalog(true)
        },
      }
    },
    {
      name: "corpan-catalog-v2",
      // v2 = phase-2 offline-cache migration: the catalog body (+ ETag /
      // Last-Modified validators) moved to the offline-cache-json layer.
      // `migrate` seeds that record from the legacy persisted catalog so an
      // upgraded device renders offline cold-start WITHOUT a refetch.
      version: 2,
      migrate: async (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === "object") {
          const legacy = persisted as {
            catalog?: unknown
            lastFetched?: unknown
            lastChecked?: unknown
            etag?: unknown
            lastModified?: unknown
          }
          await seedGameCatalogFromLegacy(legacy)
          return {
            lastFetched:
              typeof legacy.lastFetched === "number" ? legacy.lastFetched : null,
            lastChecked:
              typeof legacy.lastChecked === "number" ? legacy.lastChecked : null,
          }
        }
        return persisted as Partial<CatalogState>
      },
      // Persisted to the IndexedDB (LARGE) tier — see store/phrasePackCatalog.ts
      // for the rationale. Only the tiny freshness stamps persist here now;
      // the catalog body lives in the offline-cache layer (same IDB tier).
      storage: createJSONStorage(() =>
        createLocalStorageShim("game-catalog", {
          tier: "large",
          volatile: true,
        })
      ),
      partialize: (state) => ({
        lastFetched: state.lastFetched,
        lastChecked: state.lastChecked,
      }),
    }
  )
)

// Background revalidations (offline-cache triggers / other callers of
// cachedFetch on this key) land here — including the migrate seeding if the
// first fetch somehow raced it.
subscribeJson<CatalogV3>(catalogV3Resource.key, (value) => {
  const applyFromSubscription = async () => {
    rawCatalog = value.data
    let { appVersion, devMode } = useCatalogStore.getState()
    if (!appVersion) {
      appVersion = await getAppVersion()
      useCatalogStore.setState({ appVersion })
    }
    const host = await detectHostOnce()
    const visible = withDevReaders(visibleCatalog(value.data, appVersion, devMode, host))
    if (visible.length === 0 && value.data.packs.length > 0) return
    useCatalogStore.setState({
      catalog: visible,
      lastFetched: value.fetchedAt,
      lastChecked: Date.now(),
    })
  }
  applyFromSubscription().catch((err) =>
    console.warn("[catalog] cache subscription apply failed:", err),
  )
})

// Initialize network status listener
if (typeof window !== "undefined") {
  listenToNetworkChanges((online) => {
    useCatalogStore.getState().setOnlineStatus(online)
  })
}
