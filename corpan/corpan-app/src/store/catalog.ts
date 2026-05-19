import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  fetchCatalogV3,
  fetchGameCatalog,
  type CatalogGame,
  type CatalogV3,
} from "../contentPacks/catalog"
import { getNetworkStatus, listenToNetworkChanges } from "../utils/network"
import { getAppVersion } from "../lib/appVersion"

type CatalogState = {
  /** Lossy projection — games / readers / narrations as `CatalogGame`s
   *  for the existing UI. Keep until everything reads `rawCatalog`. */
  catalog: CatalogGame[]
  /** Source-of-truth v3 catalog used by the phrase-pack UI surfaces, which
   *  need fields the `CatalogGame` projection drops (entry count, language
   *  count, level range, category/topic, tags, and top-level groupings
   *  + `onboardingStarterPackIds`). */
  rawCatalog: CatalogV3 | null
  lastFetched: number | null
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

const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      catalog: [],
      rawCatalog: null,
      lastFetched: null,
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

        // Use cached catalog if fresh (< 1 hour old) and not forcing refresh
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
          console.log("[catalog] Fetching from remote... appVersion:", appVersion, "devMode:", devMode)
          // Two fetches share a hot CloudFront cache so this is cheap.
          // The v3 raw fetch is what the phrase-pack UI reads. The legacy
          // `fetchGameCatalog` projection stays in place so existing
          // game/reader/narration UI keeps working unchanged.
          const [catalog, rawCatalog] = await Promise.all([
            fetchGameCatalog(appVersion, devMode),
            fetchCatalogV3(),
          ])
          console.log("[catalog] Fetched catalog:", catalog,
            "raw v3 packs:", rawCatalog?.packs.length ?? "n/a")
          set({
            catalog,
            rawCatalog,
            lastFetched: now,
            isFetching: false,
          })
        } catch (error) {
          console.error("[catalog] Failed to fetch:", error)
          set({ isFetching: false })
          // Keep existing cached catalog on error
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
          rawCatalog: null,
          lastFetched: null,
        })
        // Fetch fresh catalog immediately (force)
        get().fetchCatalog(true)
      },
    }),
    {
      name: "corpan-catalog-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        catalog: state.catalog,
        rawCatalog: state.rawCatalog,
        lastFetched: state.lastFetched,
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
