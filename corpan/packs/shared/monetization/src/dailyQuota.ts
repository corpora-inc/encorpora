// createDailyQuota — the ONE construction pattern for a metered surface.
//
// Instead of hand-rolling a `createPaywallGate({ packId, surface, mode,
// dailyLimit, softNagEvery, unitLabel })` block (every pack copy-pasted the
// same shape with its own drifting constants), a pack writes:
//
//   const gate = createDailyQuota("hover_phrases", { isSubscribed })
//
// It reads `QUOTAS[surface]` from the central registry (the one place limits
// get tuned) and forwards the standard gate-v2 config to `createPaywallGate`.
// Behavior is identical to the old hand-rolled block — same key, limit, nag,
// unit, daily reset, soft-nags, hard lock.

import { createPaywallGate } from "./paywallGate"
import { getQuota, type QuotaSurface } from "./quotas"
import type { PaywallGate, StorageLike, DailyLockedDetail, PaywallRequestDetail } from "./types"

/** The thin per-pack overrides `createDailyQuota` accepts (everything else is registry-owned). */
export interface DailyQuotaOptions {
  /** Injected; default reads `__CORPAN_PLUS` / `__CORPAN_ENTITLEMENT`. */
  isSubscribed?: () => boolean
  /** Injected storage for tests. Default `localStorage` (guarded). */
  storage?: StorageLike
  /** Injected clock for tests. Default `Date.now`. */
  now?: () => number
  /** Injected; default dispatches the `corpan:request-unlock` window event. */
  requestPaywall?: (detail: PaywallRequestDetail) => void
  /** Injected; default dispatches the `corpan:daily-locked` window event. */
  requestDailyLock?: (detail: DailyLockedDetail) => void
  /** Optional analytics hook (never throws — the gate ignores any error). */
  onFire?: (detail: PaywallRequestDetail | DailyLockedDetail) => void
  /** Extra detail merged into every paywall/lock request (theme, language, …). */
  detail?: Record<string, unknown>
}

/**
 * Construct the standard daily-quota gate for a registered surface.
 *
 * Reads the surface's `{ packId, dailyLimit, softNagEvery, unitLabel }` from the
 * central `QUOTAS` registry and builds a `mode:"daily"` gate-v2 paywall gate.
 * The persisted key is `corpan:gate:<packId>:<surface>`; on first construct a
 * legacy `<packId>.quota` `{ day, count }` key (pre-gate builds) is imported
 * once into the standard key (see `createPaywallGate`'s legacy migration).
 */
export function createDailyQuota(
  surface: QuotaSurface,
  opts: DailyQuotaOptions = {},
): PaywallGate {
  const q = getQuota(surface)
  return createPaywallGate({
    packId: q.packId,
    surface: q.surface,
    mode: "daily",
    dailyLimit: q.dailyLimit,
    softNagEvery: q.softNagEvery,
    unitLabel: q.unitLabel,
    hardness: q.hardness,
    legacyKey: q.legacyKey,
    ...opts,
  })
}
