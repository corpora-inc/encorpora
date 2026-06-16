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
   * Live subscription info for THIS session. Seeded optimistically from
   * `lastKnownSubscription` on launch (see `merge` below), then reconciled by
   * `refreshEntitlements()` against the platform's local receipt cache.
   */
  subscription: SubscriptionState
  /**
   * Durable "last verified Plus" snapshot — PERSISTED. This is the offline
   * lifeline: a subscriber in the jungle with no signal must never be blocked
   * just because we can't live-check. When a platform query CONFIRMS an active
   * sub we stamp it here; on the next launch we seed `subscription` from it so
   * the user is treated as Plus immediately, before any (possibly failing)
   * refresh. Only a DEFINITIVE, ONLINE "not owned" from the OS clears it (see
   * `forgetSubscription` + `refreshEntitlements`). We deliberately prefer to let
   * a fraudulent client keep a stale Plus flag over ever blocking a real
   * offline subscriber — the app is open source anyway.
   */
  lastKnownSubscription: SubscriptionState | null
  /** Epoch ms of the last CONFIRMED Plus verification. PERSISTED (a hint). */
  lastVerifiedAt: number | null
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
  /**
   * Forget BOTH the live and the durable snapshot — a real, confirmed
   * downgrade (the OS says "not owned" while we're online). Distinct from
   * `clearSubscription`, which only drops the live session state and leaves the
   * offline lifeline intact.
   */
  forgetSubscription: () => void
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
      lastKnownSubscription: null,
      lastVerifiedAt: null,
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
        // Setting an ACTIVE sub is itself a confirmation — stamp the durable
        // offline lifeline so the next (possibly offline) launch trusts it.
        // Setting an inactive sub only touches live state (a real downgrade
        // goes through `forgetSubscription`).
        if (sub.active) {
          set({
            subscription: sub,
            lastKnownSubscription: sub,
            lastVerifiedAt: Date.now(),
          })
        } else {
          set({ subscription: sub })
        }
      },

      clearSubscription: () => {
        // Live-only: drop this session's state but KEEP the durable snapshot so
        // an offline / inconclusive refresh can't lock out a real subscriber.
        set({ subscription: EMPTY_SUBSCRIPTION })
      },

      forgetSubscription: () => {
        // Confirmed downgrade (OS says "not owned" while online) — forget both.
        set({
          subscription: EMPTY_SUBSCRIPTION,
          lastKnownSubscription: null,
          lastVerifiedAt: null,
        })
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
          lastKnownSubscription: null,
          lastVerifiedAt: null,
          lastRefreshed: null,
          entitlementToken: null,
        })
      },
    }),
    {
      name: "corpan-entitlements-v1",
      storage: createJSONStorage(() => localStorage),
      // Persist device-derived facts AND the durable "last verified Plus"
      // snapshot — the offline lifeline. The LIVE `subscription` is still NOT
      // persisted directly (every launch reconciles against the platform); it's
      // re-seeded from `lastKnownSubscription` in `merge` below.
      partialize: (state) => ({
        platform: state.platform,
        iapAvailable: state.iapAvailable,
        subjectId: state.subjectId,
        lastKnownSubscription: state.lastKnownSubscription,
        lastVerifiedAt: state.lastVerifiedAt,
      }),
      // Seed the live session OPTIMISTICALLY from the durable snapshot: if we
      // ever confirmed Plus, treat the user as Plus from the very first frame —
      // before `refreshEntitlements()` runs (and even if it never can, offline).
      // `refreshEntitlements` only downgrades on a definitive ONLINE "not owned".
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<EntitlementState>
        const lastKnown = p.lastKnownSubscription ?? null
        return {
          ...current,
          ...p,
          // A persisted active snapshot becomes this session's live sub.
          subscription:
            lastKnown && lastKnown.active ? lastKnown : current.subscription,
        }
      },
    }
  )
)
