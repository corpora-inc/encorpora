// Remote-config layer for the daily-quota caps.
//
// WHY: the baked daily limits live in `packs/shared/monetization/src/quotas.ts`
// (`QUOTAS`). This module lets ops A/B and re-tune those per-pack caps WITHOUT
// shipping an app build: it fetches a tiny JSON from the CDN at launch and
// publishes a validated override on `globalThis.__corpanQuotaConfig`. The
// monetization registry's `getQuota(surface)` merges that override OVER the
// baked row (only `dailyLimit` / `softNagEvery`) at gate-construct time.
//
// SAFETY POSTURE (mirrors src/util/analytics.ts):
//   - Anonymous GET only. NO query params carrying user data, NO identifiers,
//     NO PII — just a cache-bust integer. credentials: "omit".
//   - Best-effort: every path is wrapped in try/catch and can never throw. A
//     404 / network error / malformed body must degrade to the baked defaults;
//     it must NEVER block launch or crash the app.
//   - Stale-while-revalidate: the last-good config is read SYNCHRONOUSLY from
//     localStorage and applied immediately at launch (so a pack that mounts
//     early still gets the most recent known config), then a background refresh
//     updates the cache for the NEXT launch.
//
// TIMING / CACHING SEMANTICS (documented intentionally):
//   - `applyCachedQuotaConfig()` runs synchronously at the top of `main.tsx`,
//     before packs mount, so the override is live as early as possible.
//   - `refreshQuotaConfig()` kicks off a non-blocking background fetch. Its
//     result is cached to localStorage and applied to the global, but a LIVE
//     gate caches its config at construct time — so a config change that lands
//     mid-session takes effect on the NEXT gate construction (e.g. re-entering a
//     pack) and reliably on the NEXT app launch. That is fine and by design.

/** CDN URL ops uploads `quota-config.json` to. Lives next to catalog-v2.json /
 *  app-version.json on the same CloudFront distribution (s3://corpan-prod). An
 *  ABSENT file 404s and we fall back to baked defaults — harmless. To push a cap
 *  change without an app build: edit corpan/infra/quota-config.json → upload to
 *  s3://corpan-prod/quota-config.json → invalidate the CDN path. Takes effect on
 *  the next app launch. Overridable at build time via VITE_QUOTA_CONFIG_URL. */
const REMOTE_QUOTA_URL =
  (import.meta.env?.VITE_QUOTA_CONFIG_URL as string | undefined) ||
  "https://d38iwc9748jekz.cloudfront.net/quota-config.json"

/** localStorage key holding the last-good validated config (the SWR cache). */
const CACHE_KEY = "corpan:quota-config"

/** Refresh cadence: the cached copy is considered fresh for this long. We still
 *  ALWAYS apply the cache at launch; this only governs whether we re-fetch. */
const TTL_MS = 6 * 60 * 60 * 1000 // 6h

/** Hard bounds — kept in lockstep with `getQuota`'s defensive clamp. The client
 *  validates here too so we never even CACHE garbage. */
const MIN_DAILY_LIMIT = 1
const MAX_DAILY_LIMIT = 1000

/** Per-surface override: ONLY the two tunable numbers. */
export interface QuotaOverrideEntry {
  dailyLimit?: number
  softNagEvery?: number
}

/** The validated config we publish on the global + cache to localStorage. */
export interface ValidatedQuotaConfig {
  version: number
  quotas: Record<string, QuotaOverrideEntry>
}

/** SWR cache envelope (config + when we last fetched it). */
interface CacheEnvelope {
  fetchedAt: number
  config: ValidatedQuotaConfig
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

/** Finite number within [min,max] → rounded int, else undefined. Rejects
 *  NaN / Infinity / strings / null / objects. */
function clampInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const n = Math.round(value)
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Validate + coerce a raw fetched/cached body into a `ValidatedQuotaConfig`.
 * HARD validation: a malformed body → `null` (caller keeps baked defaults).
 * - `version` must be a finite number.
 * - `quotas` must be an object; each entry keeps ONLY clamped `dailyLimit`
 *   (1..1000) / `softNagEvery` (1..dailyLimit). Surfaces with no usable value
 *   are dropped. Unknown surfaces are kept verbatim (getQuota ignores any
 *   surface it doesn't bake — keeping them is harmless + forward-compatible).
 */
export function validateQuotaConfig(raw: unknown): ValidatedQuotaConfig | null {
  try {
    if (!raw || typeof raw !== "object") return null
    const obj = raw as Record<string, unknown>
    const version = clampInt(obj.version, 0, Number.MAX_SAFE_INTEGER)
    if (version === undefined) return null
    const rawQuotas = obj.quotas
    if (!rawQuotas || typeof rawQuotas !== "object") return null

    const quotas: Record<string, QuotaOverrideEntry> = {}
    for (const [surface, entryRaw] of Object.entries(
      rawQuotas as Record<string, unknown>,
    )) {
      if (!entryRaw || typeof entryRaw !== "object") continue
      const entry = entryRaw as Record<string, unknown>
      const out: QuotaOverrideEntry = {}
      const dl = clampInt(entry.dailyLimit, MIN_DAILY_LIMIT, MAX_DAILY_LIMIT)
      if (dl !== undefined) out.dailyLimit = dl
      // softNagEvery clamped to the overridden dailyLimit when present, else the
      // global max (registry's baked limit re-clamps it again in getQuota).
      const nagCeil = out.dailyLimit ?? MAX_DAILY_LIMIT
      const nag = clampInt(entry.softNagEvery, 1, nagCeil)
      if (nag !== undefined) out.softNagEvery = nag
      // Drop entries that carry no usable override at all.
      if (out.dailyLimit !== undefined || out.softNagEvery !== undefined) {
        quotas[surface] = out
      }
    }
    return { version, quotas }
  } catch {
    return null
  }
}

/** Publish a validated config on the global the monetization registry reads. */
function publish(config: ValidatedQuotaConfig): void {
  try {
    ;(globalThis as { __corpanQuotaConfig?: ValidatedQuotaConfig }).__corpanQuotaConfig =
      config
  } catch {
    /* unreachable; assigning a global can't throw */
  }
}

/** Read + validate the cached envelope, if any. */
function readCache(): CacheEnvelope | null {
  const ls = safeLocalStorage()
  if (!ls) return null
  try {
    const rawStr = ls.getItem(CACHE_KEY)
    if (!rawStr) return null
    const env = JSON.parse(rawStr) as Partial<CacheEnvelope>
    const config = validateQuotaConfig(env?.config)
    if (!config) return null
    const fetchedAt =
      typeof env?.fetchedAt === "number" && Number.isFinite(env.fetchedAt)
        ? env.fetchedAt
        : 0
    return { fetchedAt, config }
  } catch {
    return null
  }
}

function writeCache(config: ValidatedQuotaConfig): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    const env: CacheEnvelope = { fetchedAt: Date.now(), config }
    ls.setItem(CACHE_KEY, JSON.stringify(env))
  } catch {
    /* localStorage full / unavailable — non-fatal, we just won't persist */
  }
}

/**
 * SYNCHRONOUS: apply the last-good cached config to the global immediately, so
 * gates constructed early in launch see the most recent known override. Safe to
 * call before any network. No-op if there's no (valid) cache.
 */
export function applyCachedQuotaConfig(): void {
  try {
    const cached = readCache()
    if (cached) publish(cached.config)
  } catch {
    /* baked defaults remain in effect — fail-safe */
  }
}

/**
 * Background, best-effort refresh. Fetches the CDN JSON, validates HARD, and on
 * success caches + publishes it. On 404 / network error / malformed body it does
 * NOTHING (the cache + baked defaults stand). Never throws; never blocks.
 *
 * `force` skips the TTL freshness check (used by the dev hook).
 */
export async function refreshQuotaConfig(force = false): Promise<void> {
  try {
    const cached = readCache()
    if (!force && cached && Date.now() - cached.fetchedAt < TTL_MS) {
      // Cache is fresh — apply it (already applied at launch, but idempotent)
      // and skip the network.
      publish(cached.config)
      return
    }

    // Cache-bust per TTL window so the CDN edge can still cache the object but a
    // change propagates within ~the TTL. No user data in the URL — anonymous.
    const bust = Math.floor(Date.now() / TTL_MS)
    const res = await fetch(`${REMOTE_QUOTA_URL}?_=${bust}`, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
    })
    if (!res.ok) return // 404 (absent file) / 5xx → keep cache + baked defaults
    const body = (await res.json()) as unknown
    const config = validateQuotaConfig(body)
    if (!config) return // malformed → keep cache + baked defaults
    writeCache(config)
    publish(config)
  } catch {
    /* network / parse error → keep cache + baked defaults. Fail-safe. */
  }
}

/**
 * Launch entry point: apply the cache synchronously (immediate), then kick off a
 * non-blocking background refresh for next launch. Call once from `main.tsx`.
 */
export function initRemoteQuotaConfig(): void {
  applyCachedQuotaConfig()
  void refreshQuotaConfig()
}
