// Central quota registry — the ONE place daily limits get tuned.
//
// Every metered pack surface declares its config HERE, not as a hardcoded
// constant scattered through the pack. A pack constructs its gate with
// `createDailyQuota(surface, { isSubscribed })` (see ./dailyQuota.ts), which
// reads the row below and forwards it to `createPaywallGate`. To change a
// limit, edit this map — nothing else.
//
// REMOTE-CONFIG: these are the baked defaults. A remote-config fetch (owned by
// the HOST — see `corpan-app/src/util/remoteQuotaConfig.ts`) may deliver a
// partial `{ [surface]: { dailyLimit?, softNagEvery? } }` JSON and publish it on
// `globalThis.__corpanQuotaConfig`. `getQuota` is the single read seam where
// that override is merged OVER the baked values (only `dailyLimit` /
// `softNagEvery` — `packId` / `surface` / `unitLabel` always stay baked). This
// module stays PURE + SYNCHRONOUS: it only READS the global, never fetches.
// Absent / malformed config → the baked row is returned unchanged.

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
  // pronunciation-coach (Parlometron) — solo + multiplayer share this count.
  // Gated like phrase-flip: only acquiring a NEW phrase counts. Re-practicing
  // (scoring) any phrase already in history is unlimited and free, so a free
  // user can drill their on-device model all day. 10 new phrases/day, NO soft
  // nag (softNagEvery 0) — just the daily accomplishment-lock at the cap.
  parlometron_daily: {
    packId: "pronunciation_coach",
    surface: "parlometron_daily",
    dailyLimit: 10,
    softNagEvery: 0,
    unitLabel: "phrases",
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

/** Hard bounds for any remote-config override (defence-in-depth — the client
 *  validator clamps too, but `getQuota` must NEVER trust the global blindly). */
const MIN_DAILY_LIMIT = 1
const MAX_DAILY_LIMIT = 1000

/** The remote-override shape `getQuota` reads off `globalThis.__corpanQuotaConfig`.
 *  Intentionally narrow: ONLY the two tunable numbers per surface. */
interface QuotaOverrideEntry {
  dailyLimit?: number
  softNagEvery?: number
}
interface QuotaRemoteConfig {
  version?: number
  quotas?: Record<string, QuotaOverrideEntry | undefined>
}

/** A finite number within [min,max], else undefined (rejects NaN/Infinity/non-number). */
function clampInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const n = Math.round(value)
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Read a surface's quota config — the SINGLE read seam every pack hits at gate
 * construct time. Merges any host-published remote override
 * (`globalThis.__corpanQuotaConfig.quotas[surface]`) OVER the baked `QUOTAS` row,
 * accepting ONLY `dailyLimit` / `softNagEvery` and clamping both to sane ranges.
 * `packId` / `surface` / `unitLabel` / `legacyKey` / `hardness` always stay
 * baked. Pure + synchronous; FAIL-SAFE — any absent/malformed/out-of-range
 * override is dropped and the baked row is returned unchanged. Throws only on an
 * unknown surface (a typo'd key is a bug, not a silent free-for-all).
 */
export function getQuota(surface: QuotaSurface): QuotaConfig {
  const baked = QUOTAS[surface]
  if (!baked) {
    throw new Error(`[monetization] unknown quota surface: ${String(surface)}`)
  }

  // Everything below is best-effort: a bad global must degrade to `baked`.
  try {
    const cfg = (globalThis as { __corpanQuotaConfig?: QuotaRemoteConfig })
      .__corpanQuotaConfig
    const override = cfg?.quotas?.[surface]
    if (!override || typeof override !== "object") return baked

    let dailyLimit = baked.dailyLimit
    let softNagEvery = baked.softNagEvery

    const ol = clampInt(override.dailyLimit, MIN_DAILY_LIMIT, MAX_DAILY_LIMIT)
    if (ol !== undefined) dailyLimit = ol

    // softNagEvery is bounded by the (possibly overridden) dailyLimit so the
    // nag cadence can never exceed the cap.
    const on = clampInt(override.softNagEvery, 1, dailyLimit)
    if (on !== undefined) softNagEvery = on

    if (dailyLimit === baked.dailyLimit && softNagEvery === baked.softNagEvery) {
      return baked
    }
    return { ...baked, dailyLimit, softNagEvery }
  } catch {
    return baked
  }
}
