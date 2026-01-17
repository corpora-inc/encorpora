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

  fetchCatalog: () => Promise<void>
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

      fetchCatalog: async () => {
        const state = get()
        const now = Date.now()

        // Use cached catalog if fresh (< 1 hour old)
        if (
          state.lastFetched &&
          state.catalog.length > 0 &&
          now - state.lastFetched < CACHE_DURATION
        ) {
          return
        }

        // Only fetch if online
        if (!state.isOnline) {
          return
        }

        try {
          const catalog = await fetchGameCatalog()
          set({
            catalog,
            lastFetched: now,
          })
        } catch (error) {
          console.error("Failed to fetch catalog:", error)
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
        // Fetch fresh catalog immediately
        get().fetchCatalog()
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
