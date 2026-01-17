import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import {
  fetchGameCatalog,
  type CatalogGame,
} from "../contentPacks/catalog"
import { getNetworkStatus, listenToNetworkChanges } from "../utils/network"

type CatalogState = {
  catalog: CatalogGame[]
  lastFetched: number | null
  isOnline: boolean
  isFetching: boolean

  fetchCatalog: (force?: boolean) => Promise<void>
  getCatalog: () => CatalogGame[]
  setOnlineStatus: (online: boolean) => void
  clearCache: () => void
}

const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      catalog: [],
      lastFetched: null,
      isOnline: getNetworkStatus(),
      isFetching: false,

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
          console.log("[catalog] Fetching from remote...")
          const catalog = await fetchGameCatalog()
          console.log("[catalog] Fetched catalog:", catalog)
          set({
            catalog,
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

      clearCache: () => {
        set({
          catalog: [],
          lastFetched: null,
        })
        // Fetch fresh catalog immediately (force)
        get().fetchCatalog(true)
      },
    }),
    {
      name: "corpan-catalog-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        catalog: state.catalog,
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
