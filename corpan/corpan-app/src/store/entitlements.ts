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
  /**
   * Product IDs of individually purchased packs — IN-MEMORY ONLY this
   * session. NOT persisted. Refreshed every time the paywall queries the
   * platform (no localStorage fallback).
   */
  purchasedProducts: string[]
  /**
   * Active subscription info — IN-MEMORY ONLY. Same rationale.
   */
  subscription: SubscriptionState
  /** Timestamp of last entitlement refresh (in-memory hint) */
  lastRefreshed: number | null
  /** Detected platform — null until getPlatform() resolves. PERSISTED. */
  platform: string | null
  /** Whether IAP is available on this platform. PERSISTED. */
  iapAvailable: boolean
  /** Anonymous per-install subject used for server-side IAP attribution. */
  subjectId: string | null
  /** Short-lived first-party entitlement token. IN-MEMORY ONLY. */
  entitlementToken: string | null

  // Actions
  addPurchasedProduct: (productId: string) => void
  setSubscription: (sub: SubscriptionState) => void
  clearSubscription: () => void
  setLastRefreshed: (ts: number) => void
  setPlatform: (platform: string) => void
  setSubjectId: (subjectId: string) => void
  setEntitlementToken: (token: string | null) => void

  /** Clear all entitlements (for testing/debug) */
  clearEntitlements: () => void
}

const IAP_PLATFORMS = new Set(["ios", "android", "macos", "windows"])

export const EMPTY_SUBSCRIPTION: SubscriptionState = {
  active: false,
  plan: null,
  expiresAt: null,
  autoRenew: false,
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set) => ({
      purchasedProducts: [],
      subscription: EMPTY_SUBSCRIPTION,
      lastRefreshed: null,
      platform: null,
      iapAvailable: false,
      subjectId: null,
      entitlementToken: null,

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

      clearSubscription: () => {
        set({ subscription: EMPTY_SUBSCRIPTION })
      },

      setLastRefreshed: (ts) => {
        set({ lastRefreshed: ts })
      },

      setSubjectId: (subjectId) => {
        set({ subjectId })
      },

      setEntitlementToken: (token) => {
        set({ entitlementToken: token })
      },

      clearEntitlements: () => {
        set({
          purchasedProducts: [],
          subscription: EMPTY_SUBSCRIPTION,
          lastRefreshed: null,
          entitlementToken: null,
        })
      },
    }),
    {
      name: "corpan-entitlements-v1",
      storage: createJSONStorage(() => localStorage),
      // Only persist device-derived facts — NOT entitlement state. The
      // entitlement state is in-memory only this session; every paywall
      // render queries the platform fresh.
      partialize: (state) => ({
        platform: state.platform,
        iapAvailable: state.iapAvailable,
        subjectId: state.subjectId,
      }),
    }
  )
)
