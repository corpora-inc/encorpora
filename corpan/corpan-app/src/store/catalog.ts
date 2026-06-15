import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  fetchGameCatalogFresh,
  getDefaultCatalog,
  type CatalogGame,
} from "../contentPacks/catalog"
import { getNetworkStatus, listenToNetworkChanges } from "../utils/network"
import { getAppVersion } from "../lib/appVersion"
import { createLocalStorageShim } from "../util/storage"

type CatalogState = {
  catalog: CatalogGame[]
  lastFetched: number | null
  /** Last time we *checked* for freshness (even if the answer was 304 or an
   *  error). Distinct from `lastFetched`, which marks a successful refresh. */
  lastChecked: number | null
  /** HTTP validators persisted for conditional revalidation. An unchanged
   *  catalog then comes back as a 0-byte 304 instead of a full re-download. */
  etag: string | null
  lastModified: string | null
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

// Match the CDN freshness window. Packs are published continuously, so Home
// should see new/updated catalog entries during the same app session.
const CACHE_DURATION = 5 * 60 * 1000

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      catalog: [],
      lastFetched: null,
      lastChecked: null,
      etag: null,
      lastModified: null,
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
        const state = get()

        // Prevent concurrent fetches
        if (state.isFetching) {
          return
        }

        const now = Date.now()

        // Use cached catalog if fresh and not forcing refresh.
        if (
          !force &&
          state.lastFetched &&
          state.catalog.length > 0 &&
          now - state.lastFetched < CACHE_DURATION
        ) {
          return
        }

        // Only fetch if online
        if (!state.isOnline) {
          console.log("[catalog] Cannot fetch: offline")
          return
        }

        set({ isFetching: true })

        try {
          // Resolve app version once
          let { appVersion } = get()
          if (!appVersion) {
            appVersion = await getAppVersion()
            set({ appVersion })
          }

          const { devMode } = get()
          // Only send conditional validators when we actually have a cached
          // catalog to keep — otherwise a stray persisted ETag could yield a
          // 304 against an empty cache that then never repopulates. Also skip
          // them on a forced refresh so we re-apply version/host/devMode
          // filtering against a full body.
          const haveCache = get().catalog.length > 0
          const validators =
            force || !haveCache
              ? undefined
              : { etag: get().etag, lastModified: get().lastModified }
          const result = await fetchGameCatalogFresh(
            appVersion, devMode, validators)

          if (result.status === "unchanged") {
            // 304 — cached catalog is still current. Cheapest possible poll.
            set({ lastFetched: now, lastChecked: now })
          } else if (result.status === "ok") {
            set({
              catalog: result.catalog,
              etag: result.validators.etag ?? null,
              lastModified: result.validators.lastModified ?? null,
              lastFetched: now,
              lastChecked: now,
            })
          } else {
            // Couldn't fetch anything live. Keep whatever catalog we already
            // have rather than clobbering it with the tiny built-in default
            // set; only seed defaults if we're completely empty (first run,
            // no network). Don't stamp lastFetched, so we keep retrying.
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
          // ALWAYS clear the in-flight flag. The production "zombie" was a
          // hung fetch that never settled, so this flag stuck `true` and
          // blocked every retry. The timeout in fetchJsonFresh guarantees the
          // promise settles; this finally guarantees the flag follows.
          set({ isFetching: false })
        }
      },

      getCatalog: () => {
        const state = get()
        // Return cached catalog if available, otherwise fetch will provide defaults
        return state.catalog
      },

      setOnlineStatus: (online: boolean) => {
        set({ isOnline: online })

        // Fetch catalog when coming back online if cache is stale
        if (online) {
          const state = get()
          const now = Date.now()
          if (
            !state.lastFetched ||
            now - state.lastFetched >= CACHE_DURATION
          ) {
            get().fetchCatalog()
          }
        }
      },

      setDevMode: (enabled: boolean) => {
        set({ devMode: enabled })
        // Re-fetch to apply new filtering
        get().fetchCatalog(true)
      },

      clearCache: () => {
        set({
          catalog: [],
          lastFetched: null,
          lastChecked: null,
          etag: null,
          lastModified: null,
        })
        // Fetch fresh catalog immediately (force)
        get().fetchCatalog(true)
      },
    }),
    {
      name: "corpan-catalog-v2",
      // Persisted to the IndexedDB (LARGE) tier — see store/phrasePackCatalog.ts
      // for the rationale. The game/reader/narration catalog is another
      // growable blob that shouldn't sit in the shared localStorage budget.
      storage: createJSONStorage(() =>
        createLocalStorageShim("game-catalog", {
          tier: "large",
          volatile: true,
        })
      ),
      partialize: (state) => ({
        catalog: state.catalog,
        lastFetched: state.lastFetched,
        lastChecked: state.lastChecked,
        etag: state.etag,
        lastModified: state.lastModified,
      }),
    }
  )
)

// Initialize network status listener
if (typeof window !== "undefined") {
  listenToNetworkChanges((online) => {
    useCatalogStore.getState().setOnlineStatus(online)
  })
}
