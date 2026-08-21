// src/journey/quota.ts — the journey daily gate wiring (feed-ux §7, R12).
//
// WHAT COUNTS (normative, R12): one note() per completed DEBUT card (the
// first-ever presentation of an item) and one per pack-anchor LAUNCH.
// Due-review, replay, repair, scroll-back review, audio replays, checkpoint
// cards, placement probes, abandoned cards, and rare-card reveals are NEVER
// metered — pay-to-not-forget is dead.
//
// runtime.ts is the ONE debit site (both rules live in its submitResult /
// launchPackActivity paths). This module only builds the gate.
//
// The quotas.ts registry row (`journey_daily`, packId corpan_app, dailyLimit
// 60 — a provisional default pending the operator's free-tier N call,
// remote-config overridable — softNagEvery 0, unitLabel "cards") landed with
// W10. The gate owns the `corpan:daily-locked` dispatch (gate-v2); the
// unlimited fallback below remains for hosts without the shared module.

import { unlimitedQuota, type JourneyQuotaPort } from "./types.ts"

export const JOURNEY_QUOTA_SURFACE = "journey_daily"

interface GateLike {
  note: () => void
  remaining: () => number
  limit?: () => number
  isLocked?: () => boolean
}

/**
 * Wrap any gate-v2-shaped object into the surface port. W10 wires the real
 * `createDailyQuota("journey_daily", { isSubscribed })` here (constructed
 * once per surface mount, StrictMode-safe — MainExperience.tsx precedent).
 */
export function quotaPortFromGate(gate: GateLike, fallbackLimit = 60): JourneyQuotaPort {
  return {
    note: () => gate.note(),
    remaining: () => gate.remaining(),
    limit: () => (gate.limit ? gate.limit() : fallbackLimit),
    locked: () => (gate.isLocked ? gate.isLocked() : gate.remaining() <= 0),
  }
}

/**
 * The production gate: `createDailyQuota("journey_daily", { isSubscribed })`
 * over the shared registry row (quotas.ts), wrapped into the surface port.
 * The gate dispatches `corpan:daily-locked` at the hard cap; the registry's
 * `getQuota` merges any remote-config override, so `limit()` reflects the
 * live (possibly overridden) dailyLimit. Falls back to an unlimited port
 * only when the shared module cannot load (never expected in-app).
 */
export async function createJourneyQuota(opts: {
  isSubscribed: () => boolean
}): Promise<JourneyQuotaPort> {
  if (opts.isSubscribed()) return unlimitedQuota()
  try {
    const mod = (await import("@shared/monetization")) as {
      createDailyQuota?: (surface: string, o: { isSubscribed: () => boolean }) => GateLike
      getQuota?: (surface: string) => { dailyLimit: number }
    }
    if (mod.createDailyQuota) {
      const limit = mod.getQuota?.(JOURNEY_QUOTA_SURFACE)?.dailyLimit ?? 60
      return quotaPortFromGate(mod.createDailyQuota(JOURNEY_QUOTA_SURFACE, opts), limit)
    }
  } catch (err) {
    console.info("[journey] shared monetization gate unavailable — quota unlimited", err)
  }
  return unlimitedQuota()
}
