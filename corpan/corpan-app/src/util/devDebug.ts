// DEV-only debugging surface for the connected-device test loop. Exposes the
// monetization stores + actions on `window.__corpanDebug` so we can inspect and
// drive entitlement / paywall / rating / streak state live over CDP.
//
// Imported ONLY under `import.meta.env.DEV` in main.tsx, so it is tree-shaken
// out of production builds entirely.

import {
  useEntitlementStore,
  EMPTY_SUBSCRIPTION,
  type SubscriptionPlan,
} from "@/store/entitlements"
import { usePaywallStore, type PaywallSurface } from "@/store/paywall"
import { useRatingStore } from "@/store/rating"
import { getPackStreak } from "@shared/streak"

export function installDevDebug() {
  const w = globalThis as Record<string, unknown>
  const dbg = (w.__corpanDebug ||= {}) as Record<string, unknown>

  Object.assign(dbg, {
    // --- inspect ---
    /** One-line monetization snapshot. */
    summary: () => {
      const e = useEntitlementStore.getState()
      return {
        subscribed: e.subscription.active,
        plan: e.subscription.plan,
        iapAvailable: e.iapAvailable,
        platform: e.platform,
        hostCaps: (globalThis as { __CORPAN_HOST_CAPS?: unknown }).__CORPAN_HOST_CAPS,
        paywallOpen: usePaywallStore.getState().open,
        rated: useRatingStore.getState().hasRated,
      }
    },
    entitlement: () => useEntitlementStore.getState(),
    paywall: () => usePaywallStore.getState(),
    rating: () => useRatingStore.getState(),
    streak: (packId = "corpan_app") => getPackStreak(packId),
    /** Dump every gate/paywall localStorage key (the daily counters). */
    gateKeys: () =>
      Object.fromEntries(
        Object.keys(localStorage)
          .filter((k) => /gate|paywall|streak/i.test(k))
          .map((k) => [k, localStorage.getItem(k)]),
      ),

    // --- drive (testing) ---
    /** Pretend to be a subscriber (gate no-ops everywhere). */
    setSub: (active = true, plan: SubscriptionPlan = "annual") =>
      useEntitlementStore
        .getState()
        .setSubscription({ active, plan, expiresAt: null, autoRenew: true }),
    /** Drop the subscription so the paywall / daily wall engage again. */
    clearSub: () => useEntitlementStore.getState().setSubscription(EMPTY_SUBSCRIPTION),
    /** Force-open the universal paywall for a surface. */
    openPaywall: (surface: PaywallSurface = "phrase_flips") =>
      usePaywallStore.getState().openPaywall({ surface, packId: "corpan_app" }),
    /** Make the in-app "Enjoying Corpán?" rating card eligible to show again. */
    showRating: () =>
      useRatingStore.setState({
        hasRated: false,
        hasDismissed: false,
        remindMeLaterCount: 0,
        totalUtteranceCount: 9999,
        utterancesSinceLastPrompt: 9999,
      } as never),
    /** Clear a daily gate counter (re-test the cap without waiting a day). */
    resetGate: () => {
      Object.keys(localStorage)
        .filter((k) => /gate|paywall/i.test(k))
        .forEach((k) => localStorage.removeItem(k))
    },
  })

  // eslint-disable-next-line no-console
  console.info(
    "[corpanDebug] monetization helpers: summary() entitlement() paywall() rating() " +
      "streak() gateKeys() setSub() clearSub() openPaywall(surface) showRating() resetGate()",
  )
}
