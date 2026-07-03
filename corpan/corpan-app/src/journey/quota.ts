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
// 60 placeholder, softNagEvery 0, unitLabel "cards") is W10's seam — until
// it lands, createJourneyQuota degrades to an unlimited port with a console
// note so the surface stays playable in integration builds.

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
 * Best-effort production gate. Tries the shared monetization registry; the
 * `journey_daily` row is W10's, so absence is expected pre-integration.
 */
export async function createJourneyQuota(opts: {
  isSubscribed: () => boolean
}): Promise<JourneyQuotaPort> {
  if (opts.isSubscribed()) return unlimitedQuota()
  try {
    const mod = (await import("@shared/monetization")) as {
      createDailyQuota?: (surface: string, o: { isSubscribed: () => boolean }) => GateLike
    }
    if (mod.createDailyQuota) {
      return quotaPortFromGate(mod.createDailyQuota(JOURNEY_QUOTA_SURFACE, opts))
    }
  } catch (err) {
    console.info("[journey] quota registry row not available yet (W10 seam)", err)
  }
  return unlimitedQuota()
}
