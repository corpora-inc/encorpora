// DEV-only debugging surface for the connected-device test loop. Exposes the
// monetization stores + actions on `window.__corpanDebug` so we can inspect and
// drive entitlement / paywall / rating / streak state live over CDP.
//
// Imported ONLY under `import.meta.env.DEV` in main.tsx, so it is tree-shaken
// out of production builds entirely.

import {
  useEntitlementStore,
  type SubscriptionPlan,
} from "@/store/entitlements"
import { usePaywallStore, type PaywallSurface } from "@/store/paywall"
import { useRatingStore } from "@/store/rating"
import { getPackStreak } from "@shared/streak"
import type { GateRegistry } from "@shared/monetization"

/** Local-day stamp matching the gate's `localDay()` (YYYY-MM-DD, local tz). */
function localDay(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** The live-gate registry every `createPaywallGate` registers itself on. */
function gateRegistry(): GateRegistry {
  return ((globalThis as { __corpanGates?: GateRegistry }).__corpanGates ??= {})
}

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
    /** Drop the subscription so the paywall / daily wall engage again. Forgets
     *  the durable offline snapshot too, else it'd re-seed Plus on next reload. */
    clearSub: () => useEntitlementStore.getState().forgetSubscription(),
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

    // --- live quota control (works for ANY registered pack gate, no reload) ---
    // Setting a quota via raw localStorage didn't reflect live because the gate's
    // readState takes max(stored, memory) — downward writes are ignored until
    // the gate is reconstructed. These helpers drive the LIVE gate object via the
    // `globalThis.__corpanGates` registry, so both directions take effect at once.
    quota: {
      /** Every registered gate + its live remaining()/isBlocked(). */
      list: () =>
        Object.fromEntries(
          Object.entries(gateRegistry()).map(([key, { packId, surface, gate }]) => [
            key,
            {
              packId,
              surface,
              remaining: gate.remaining(),
              blocked: gate.isBlocked(),
              resetAt: gate.resetAt(),
            },
          ]),
        ),
      /**
       * Set a surface's used count EXACTLY (both directions, no reload). Finds the
       * live gate, reset()s it (clears the max(stored,memory) floor), then writes
       * the standard key `corpan:gate:<packId>:<surface>` = { day: today, count }
       * so the next read reflects `used`. The pack's chip updates on the next
       * interaction (or call `__corpanDebug.quota.poke()` below if it listens).
       */
      set: (surface: string, used: number) => {
        const reg = gateRegistry()
        const entry = Object.values(reg).find((g) => g.surface === surface)
        if (!entry) {
          // eslint-disable-next-line no-console
          console.warn(`[corpanDebug] quota.set: no live gate for surface "${surface}"`)
          return false
        }
        entry.gate.reset()
        const key = `corpan:gate:${entry.packId}:${entry.surface}`
        try {
          localStorage.setItem(
            key,
            JSON.stringify({ day: localDay(), count: Math.max(0, used), lastFireAt: 0 }),
          )
        } catch {
          /* storage full — the reset() above still cleared the in-memory floor */
        }
        return true
      },
      /** Reset a surface's gate (clear today's count). */
      reset: (surface: string) => {
        const entry = Object.values(gateRegistry()).find((g) => g.surface === surface)
        if (!entry) return false
        entry.gate.reset()
        return true
      },
      /** Reset every registered gate. */
      clearAll: () => {
        Object.values(gateRegistry()).forEach((g) => g.gate.reset())
      },
    },
  })

  // eslint-disable-next-line no-console
  console.info(
    "[corpanDebug] monetization helpers: summary() entitlement() paywall() rating() " +
      "streak() gateKeys() setSub() clearSub() openPaywall(surface) showRating() resetGate() " +
      "quota.list() quota.set(surface,used) quota.reset(surface) quota.clearAll()",
  )
}
