// Central quota registry — the ONE place daily limits get tuned.
//
// Every metered pack surface declares its config HERE, not as a hardcoded
// constant scattered through the pack. A pack constructs its gate with
// `createDailyQuota(surface, { isSubscribed })` (see ./dailyQuota.ts), which
// reads the row below and forwards it to `createPaywallGate`. To change a
// limit, edit this map — nothing else.
//
// REMOTE-CONFIG READY: these are the baked defaults. A future remote-config
// fetch could deliver a partial `{ [surface]: { dailyLimit, softNagEvery } }`
// JSON and override the baked values at runtime — `getQuota` is the single
// read seam where such an override would be merged in. (Not built here; the
// fetch/cache belongs to the host, not this pure module.)

import type { Hardness } from "./types"

/** One metered surface's daily-quota config (the gate-v2 shape). */
export interface QuotaConfig {
  /** Pack identifier — namespaces the persisted key `corpan:gate:<packId>:<surface>`. */
  packId: string
  /** PaywallSurface string the host uses to route/skin the upsell. */
  surface: string
  /** Hard per-local-day cap (resets at local midnight — the DAU lever). */
  dailyLimit: number
  /** Dismissible soft-nag cadence before the cap ("soft, soft, hard"). */
  softNagEvery: number
  /** Human unit label for the lock copy ("phrases", "characters", "messages"). */
  unitLabel: string
  /** Optional legacy `<packId>.quota` key to import a count from once (pre-gate builds). */
  legacyKey?: string
  /** Default "soft" — the daily HARD cap blocks regardless; this is the legacy knob. */
  hardness?: Hardness
}

/** Every metered surface, keyed by its `surface` string. The single source of truth. */
export const QUOTAS = {
  // corpan-app phrase-flip (MainExperience.tsx)
  phrase_flips: {
    packId: "corpan_app",
    surface: "phrase_flips",
    dailyLimit: 20,
    softNagEvery: 5,
    unitLabel: "phrases",
  },
  // pronunciation-coach (Parlometron) — solo + multiplayer share this count
  parlometron_daily: {
    packId: "pronunciation_coach",
    surface: "parlometron_daily",
    dailyLimit: 15,
    softNagEvery: 5,
    unitLabel: "rounds",
  },
  // hover-runner
  hover_phrases: {
    packId: "hover-runner",
    surface: "hover_phrases",
    dailyLimit: 20,
    softNagEvery: 5,
    unitLabel: "phrases",
  },
  // juice-squeeze
  juice_phrases: {
    packId: "juice_squeeze",
    surface: "juice_phrases",
    dailyLimit: 20,
    softNagEvery: 5,
    unitLabel: "phrases",
  },
  // hanzipan
  hanzipan_chars: {
    packId: "hanzipan",
    surface: "hanzipan_chars",
    dailyLimit: 20,
    softNagEvery: 5,
    unitLabel: "characters",
  },
  // tutomaton — converted by the tutomaton agent (see QUOTA_STANDARD.md). Its
  // pre-gate builds wrote a `tutomaton.quota` { day, count } key; declare it
  // here so the one-time legacy import preserves the count on upgrade.
  tutomaton_daily: {
    packId: "tutomaton",
    surface: "tutomaton_daily",
    dailyLimit: 20,
    softNagEvery: 5,
    unitLabel: "messages",
    legacyKey: "tutomaton.quota",
  },
} satisfies Record<string, QuotaConfig>

/** Known metered-surface keys (literal union of `QUOTAS`). */
export type QuotaSurface = keyof typeof QUOTAS

/**
 * Read a surface's quota config. The single read seam — a future remote-config
 * override would be merged here. Throws on an unknown surface (a typo'd key is
 * a bug, not a silent free-for-all).
 */
export function getQuota(surface: QuotaSurface): QuotaConfig {
  const q = QUOTAS[surface]
  if (!q) {
    throw new Error(`[monetization] unknown quota surface: ${String(surface)}`)
  }
  return q
}
