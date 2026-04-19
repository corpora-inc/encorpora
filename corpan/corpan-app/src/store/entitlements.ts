import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type SubscriptionPlan = "monthly" | "annual"

export type SubscriptionState = {
  active: boolean
  plan: SubscriptionPlan | null
  expiresAt: string | null
  autoRenew: boolean
}

type EntitlementState = {
  /** Product IDs of individually purchased packs */
  purchasedProducts: string[]
  /** Active subscription info */
  subscription: SubscriptionState
  /** Timestamp of last entitlement refresh */
  lastRefreshed: number | null
  /** Detected platform — null until getPlatform() resolves */
  platform: string | null
  /** Whether IAP is available on this platform */
  iapAvailable: boolean

  // Actions
  addPurchasedProduct: (productId: string) => void
  setSubscription: (sub: SubscriptionState) => void
  setLastRefreshed: (ts: number) => void
  setPlatform: (platform: string) => void

  /** Check if user is entitled to a product (purchased or subscribed) */
  isEntitled: (productId: string) => boolean

  /** Clear all entitlements (for testing/debug) */
  clearEntitlements: () => void
}

const IAP_PLATFORMS = new Set(["ios", "android", "macos", "windows"])

const EMPTY_SUBSCRIPTION: SubscriptionState = {
  active: false,
  plan: null,
  expiresAt: null,
  autoRenew: false,
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set, get) => ({
      purchasedProducts: [],
      subscription: EMPTY_SUBSCRIPTION,
      lastRefreshed: null,
      platform: null,
      iapAvailable: false,

      setPlatform: (platform) => {
        set({ platform, iapAvailable: IAP_PLATFORMS.has(platform) })
      },

      addPurchasedProduct: (productId) => {
        set((state) => {
          if (state.purchasedProducts.includes(productId)) return state
          return {
            purchasedProducts: [...state.purchasedProducts, productId],
          }
        })
      },

      setSubscription: (sub) => {
        set({ subscription: sub })
      },

      setLastRefreshed: (ts) => {
        set({ lastRefreshed: ts })
      },

      isEntitled: (productId) => {
        const state = get()
        // Subscribers have access to everything
        if (state.subscription.active) return true
        // Check individual purchases
        return state.purchasedProducts.includes(productId)
      },

      clearEntitlements: () => {
        set({
          purchasedProducts: [],
          subscription: EMPTY_SUBSCRIPTION,
          lastRefreshed: null,
        })
      },
    }),
    {
      name: "corpan-entitlements-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        purchasedProducts: state.purchasedProducts,
        subscription: state.subscription,
        lastRefreshed: state.lastRefreshed,
        // Persisted so the reader pack (which only sees localStorage, not the
        // React store's in-memory state) can resolve iapAvailable/platform on
        // first paint. App.tsx still calls getPlatform() each launch and
        // overwrites these with fresh values.
        platform: state.platform,
        iapAvailable: state.iapAvailable,
      }),
    }
  )
)
