/**
 * Corpán Plus narration upgrade manager.
 *
 * When a user subscribes to Corpán Plus, every preview narration they already
 * installed (the truncated two-ZIP preview) should become the full narration —
 * WITHOUT a manual uninstall/reinstall. installManager already does an ATOMIC
 * backup-swap install in place: re-running `installNarration(entry)` while the
 * user is entitled overwrites the preview with the full ZIP and keeps the
 * preview playable until the full version fully lands.
 *
 * Three coordinated layers, all funneling through `upgradeNarration`:
 *
 *   1. Active continuation — `upgradeActiveNarration(id)`: the book the user is
 *      reading at the end-of-preview paywall, upgraded the instant they pay, on
 *      ANY connection. (appShell reloads + resumes on `corpan:narration-upgraded`.)
 *   2. Background sweep — `runUpgradeSweep()`: every OTHER installed preview,
 *      best-effort, sequential, guarded against concurrent runs, GATED to
 *      online + CONFIRMED-unmetered (Wi-Fi). When the link type is UNKNOWN
 *      (Network Information API absent — notably iOS WKWebView) the sweep
 *      DEFERS; layers 1 + 3 still deliver full narrations, so we just don't
 *      pre-fetch in the background when we can't confirm Wi-Fi.
 *   3. JIT self-heal — `maybeUpgradeOnOpen(id)`: any preview opened while Plus is
 *      upgraded on access, guaranteeing eventual correctness regardless of (2).
 *
 * Everything here is idempotent and re-entrant safe: an already-full narration
 * is a no-op, a non-subscriber is a no-op, and a failed upgrade leaves the
 * working preview intact and retryable.
 */

import type { CatalogNarrationEntry, CatalogV2 } from "./types.ts"
import { fetchCatalog } from "./catalogFetch.ts"
import {
  installNarration,
  installNarrationPreview,
  isTwoZipEntry,
  type InstallResult,
} from "./installManager.ts"
import {
  getInstalled,
  isInstalled,
  isPreviewInstalled,
  listPreviewNarrationIds,
  listInstalled,
  setNarrationFullness,
} from "./libraryStore.ts"
import { isCurrentlySubscribed } from "./purchaseManager.ts"

const DEFAULT_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json"
const FALLBACK_CDN_URL = "https://d38iwc9748jekz.cloudfront.net/catalog.json"

/** Fired (on `window`) after a narration is upgraded preview → full. */
export const NARRATION_UPGRADED_EVENT = "corpan:narration-upgraded"
/** Fired (on `window`) by the app when Plus becomes active. The catalog layer
 *  listens for `{ plus: true }` to kick the active-book upgrade + sweep. */
export const ENTITLEMENTS_CHANGED_EVENT = "corpan:entitlements-changed"

// ---------------------------------------------------------------------------
// Catalog resolution — appShell registers its in-memory catalog so we don't
// double-fetch; otherwise we fetch the CDN catalog on demand.
// ---------------------------------------------------------------------------

let catalogProvider: (() => CatalogNarrationEntry[]) | null = null

/** Let the host (appShell) supply the already-loaded catalog so upgrades reuse
 *  it instead of re-fetching. Safe to call repeatedly; pass `null` to clear. */
export function setUpgradeCatalogProvider(
  provider: (() => CatalogNarrationEntry[]) | null
): void {
  catalogProvider = provider
}

async function resolveCatalogEntry(
  narrationId: string
): Promise<CatalogNarrationEntry | null> {
  const provided = catalogProvider?.()
  if (provided && provided.length) {
    const hit = provided.find((n) => n.id === narrationId)
    if (hit) return hit
  }
  // Fall back to a (cached) CDN fetch — covers JIT-on-open before the drawer's
  // catalog has loaded, or a fresh device.
  try {
    const catalog: CatalogV2 = await fetchCatalog(DEFAULT_CDN_URL, {
      fallbackUrl: FALLBACK_CDN_URL,
    })
    return catalog.narrations.find((n) => n.id === narrationId) ?? null
  } catch (err) {
    console.warn("[upgradeManager] catalog fetch failed:", err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Plus check
// ---------------------------------------------------------------------------

/** True only on a DEFINITIVE entitled answer. Inconclusive / not-entitled →
 *  false (we never upgrade — and never delete — on uncertainty). */
async function isPlus(): Promise<boolean> {
  try {
    const sub = await isCurrentlySubscribed()
    return sub.ok && sub.entitled
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Core upgrade — one narration, idempotent, never throws.
// ---------------------------------------------------------------------------

// Per-narration in-flight guard so two triggers (e.g. JIT + sweep, or two
// purchase events) can't download the same full ZIP twice.
const upgradesInFlight = new Set<string>()

function dispatchUpgraded(narrationId: string, language?: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(NARRATION_UPGRADED_EVENT, {
        detail: { narrationId, language },
      })
    )
  } catch (err) {
    console.warn("[upgradeManager] failed to dispatch upgraded event", err)
  }
}

/**
 * Upgrade ONE installed narration from preview → full, if all of:
 *   - it's installed
 *   - the user is Plus
 *   - it's a two-ZIP entry currently installed as a preview
 * Otherwise it's a no-op returning `false`. On a successful full install it
 * records fullness, fires `corpan:narration-upgraded`, and returns `true`.
 *
 * Never throws. A failed install leaves the working preview intact (atomic
 * swap) so the JIT layer / next sweep can retry.
 */
export async function upgradeNarration(narrationId: string): Promise<boolean> {
  if (!narrationId) return false
  if (!isInstalled(narrationId)) return false
  if (upgradesInFlight.has(narrationId)) return false

  upgradesInFlight.add(narrationId)
  try {
    if (!(await isPlus())) return false

    // Already full? (fast flag path, no disk read) → idempotent no-op.
    const preview = await isPreviewInstalled(narrationId)
    if (preview === false) return false
    if (preview === "unknown") {
      // Can't read the pack to confirm it's a preview. Don't act — the JIT
      // layer retries on the next open. (Acting blind risks a needless
      // re-download of an already-full pack whose flag we simply lost.)
      return false
    }

    const entry = await resolveCatalogEntry(narrationId)
    if (!entry) {
      console.warn("[upgradeManager] no catalog entry for", narrationId)
      return false
    }
    // Only two-ZIP entries have a full artifact to fetch. A legacy single-ZIP
    // entry is never a preview, so nothing to do.
    if (!isTwoZipEntry(entry)) {
      // Self-correct a mislabeled record so we stop re-checking it.
      setNarrationFullness(narrationId, true)
      return false
    }

    // installNarration re-requests a FRESH signed URL and installs the full ZIP
    // in place (atomic backup-swap). It records fullness=true via addInstalled.
    const result = await installNarration(entry)
    if (!result.ok) {
      console.warn(
        "[upgradeManager] upgrade install failed for",
        narrationId,
        result.code,
        result.detail
      )
      return false
    }

    const rec = getInstalled(narrationId)
    dispatchUpgraded(narrationId, rec?.language)
    console.info("[upgradeManager] upgraded narration", narrationId)
    return true
  } catch (err) {
    console.warn("[upgradeManager] upgradeNarration error (non-fatal):", err)
    return false
  } finally {
    upgradesInFlight.delete(narrationId)
  }
}

/**
 * Layer 1 — the high-priority active-book path. Same upgrade as
 * `upgradeNarration` but explicitly NOT gated on the network type: the user
 * just paid for THIS book, so we upgrade it on any connection.
 */
export async function upgradeActiveNarration(
  narrationId: string
): Promise<boolean> {
  return upgradeNarration(narrationId)
}

// ---------------------------------------------------------------------------
// Layer 2 — background sweep.
// ---------------------------------------------------------------------------

type NavigatorConnection = {
  saveData?: boolean
  type?: string
  effectiveType?: string
}

function readConnection(): NavigatorConnection | undefined {
  try {
    if (typeof navigator === "undefined") return undefined
    return (navigator as Navigator & { connection?: NavigatorConnection })
      .connection
  } catch {
    // Some embedded WebViews throw on property access — treat as unavailable.
    return undefined
  }
}

/**
 * Heuristic: is the current connection likely UNMETERED? OPTIMISTIC — returns
 * false only on a positive metered signal (Data Saver, cellular, 2g/3g) and
 * treats an UNKNOWN link (Network Information API absent) as likely unmetered.
 *
 * NOTE: this is NOT the sweep gate. The background sweep uses
 * `isConfirmedUnmetered()` (positive confirmation required); `isLikelyUnmetered`
 * is retained for any caller that wants the optimistic read.
 */
export function isLikelyUnmetered(): boolean {
  const conn = readConnection()
  if (!conn) return true // API unavailable — optimistic.
  if (conn.saveData === true) return false
  if (conn.type === "cellular") return false
  const eff = conn.effectiveType
  if (eff === "2g" || eff === "slow-2g" || eff === "3g") return false
  return true
}

/**
 * Strict, POSITIVE check used to gate the background sweep: true ONLY when the
 * Network Information API exists AND positively reports an unmetered link —
 * not Data Saver, not cellular, not effective 2g/3g. When the API is absent
 * (iOS WKWebView) or detection throws, the link type is UNKNOWN and we return
 * `false` (DEFER the sweep) rather than risk a background bulk download over
 * cellular. Layers 1 + 3 still deliver the full narrations.
 */
export function isConfirmedUnmetered(): boolean {
  const conn = readConnection()
  if (!conn) return false // Unknown link (e.g. iOS) — cannot confirm → defer.
  try {
    if (conn.saveData === true) return false
    if (conn.type === "cellular") return false
    const eff = conn.effectiveType
    if (eff === "2g" || eff === "slow-2g" || eff === "3g") return false
    return true
  } catch {
    return false // Anything thrown during detection → not confirmed → defer.
  }
}

/** True when we're online AND the link is POSITIVELY CONFIRMED unmetered.
 *  Unknown metering (no Network Info API) → false, so the sweep defers. */
export function canRunSweep(): boolean {
  const online = typeof navigator === "undefined" || navigator.onLine !== false
  return online && isConfirmedUnmetered()
}

// Module-level guard against concurrent / re-entrant sweeps.
let sweepInFlight = false

/**
 * Collect the installed narrations that are (or might be) previews. Records
 * flagged `false` are certain; legacy records (flag absent) are classified via
 * `isPreviewInstalled` (disk read + backfill). Records flagged `true` are
 * skipped.
 */
async function collectPreviewIds(): Promise<string[]> {
  const ids = new Set(listPreviewNarrationIds())
  // Classify legacy (flag-absent) records too.
  for (const rec of listInstalled()) {
    if (rec.full !== undefined) continue
    const preview = await isPreviewInstalled(rec.narrationId)
    if (preview === true) ids.add(rec.narrationId)
  }
  return [...ids]
}

/**
 * Layer 2 — upgrade ALL OTHER installed preview narrations after subscribing.
 * Best-effort, sequential (native installs can collide on shared temp/lock
 * state), low priority. GATED to online + CONFIRMED-unmetered; an unknown link
 * (no Network Info API, e.g. iOS) DEFERS too. When gated off it defers silently
 * (no error) — the JIT layer self-heals each on next open.
 * Re-entrant safe via a module-level in-flight flag.
 */
export async function runUpgradeSweep(): Promise<void> {
  if (sweepInFlight) {
    console.info("[upgradeManager] sweep skipped — already in flight")
    return
  }
  if (!(await isPlus())) return
  if (!canRunSweep()) {
    console.info(
      "[upgradeManager] sweep deferred — offline or not confirmed unmetered (JIT will self-heal)"
    )
    return
  }

  sweepInFlight = true
  try {
    const ids = await collectPreviewIds()
    if (ids.length === 0) return
    console.info("[upgradeManager] sweep upgrading", ids.length, "preview(s)")
    for (const id of ids) {
      // Re-check the gate before each download — connectivity can change mid
      // sweep. Stop (don't error); the JIT layer picks up the rest.
      if (!canRunSweep()) {
        console.info("[upgradeManager] sweep paused — gate closed mid-run")
        break
      }
      await upgradeNarration(id)
    }
  } finally {
    sweepInFlight = false
  }
}

// ---------------------------------------------------------------------------
// Layer 3 — JIT self-heal on open.
// ---------------------------------------------------------------------------

/**
 * Layer 3 — called when a narration is opened/switched. If the user is Plus and
 * this narration is a preview, upgrade it on access. Awaited so the caller
 * (appShell) can reload the now-full pack promptly; the `corpan:narration-
 * upgraded` event still fires for any other interested surface. Runs on ANY
 * connection (a single book the user just opened, not a bulk sweep). No-op +
 * `false` when not applicable. Never throws.
 */
export async function maybeUpgradeOnOpen(narrationId: string): Promise<boolean> {
  try {
    if (!isInstalled(narrationId)) return false
    if (!(await isPlus())) return false
    const preview = await isPreviewInstalled(narrationId)
    if (preview !== true) return false
    return await upgradeNarration(narrationId)
  } catch (err) {
    console.warn("[upgradeManager] maybeUpgradeOnOpen error (non-fatal):", err)
    return false
  }
}

// ---------------------------------------------------------------------------
// QA / DEV debug helpers.
//
// On a device with a REAL active subscription, every install fetches the FULL
// ZIP (installManager queries StoreKit/Play directly), so a preview can never
// be installed naturally and the JIT upgrade path has nothing to upgrade.
// These helpers let QA force the preview condition and then exercise the real
// on-device upgrade path (native in-place install + disk reclassification +
// reader reload/resume). They are capability-safe — `debugInstallPreview` only
// installs the PUBLIC preview ZIP, and the upgrade path still uses the device's
// REAL subscription to fetch the full ZIP, so nothing here grants unearned
// entitlement. appShell exposes them under `window.__corpanUpgradeDebug`.
// ---------------------------------------------------------------------------

/** QA: resolve the catalog entry then force-install its public preview ZIP
 *  (ignores subscription). Returns the install result, or `null` when no
 *  catalog entry resolves. */
export async function debugInstallPreview(
  narrationId: string
): Promise<InstallResult | null> {
  const entry = await resolveCatalogEntry(narrationId)
  if (!entry) {
    console.warn("[upgradeManager] debugInstallPreview: no catalog entry for", narrationId)
    return null
  }
  return installNarrationPreview(entry)
}

/** QA: classify an installed narration as a preview / full / unknown, or report
 *  it's not installed. Mirrors what the upgrade layers see. */
export async function debugInstallStatus(
  narrationId: string
): Promise<"preview" | "full" | "unknown" | "not-installed"> {
  if (!isInstalled(narrationId)) return "not-installed"
  const preview = await isPreviewInstalled(narrationId)
  if (preview === true) return "preview"
  if (preview === false) return "full"
  return "unknown"
}

// ---------------------------------------------------------------------------
// Test-only reset of module guards (so unit tests are isolated).
// ---------------------------------------------------------------------------

/** @internal — reset in-flight guards between tests. */
export function __resetUpgradeGuardsForTest(): void {
  upgradesInFlight.clear()
  sweepInFlight = false
}
