import type { CatalogNarrationEntry, NarrationArtifact } from "./types"
import { addInstalled, removeInstalled } from "./libraryStore"
import {
  resolveReceiptForEntry,
  resolveSubscriptionReceipt,
  isCurrentlySubscribed,
} from "./purchaseManager"

/** True when the entry uses the Corpán Plus two-ZIP model (preview + full). */
export function isTwoZipEntry(
  entry: CatalogNarrationEntry
): entry is CatalogNarrationEntry & { preview: NarrationArtifact; full: NarrationArtifact } {
  return !!entry.preview && !!entry.full
}

type TauriInternals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals
}

function getTauriInvoke(): TauriInternals["invoke"] | null {
  const w = window as TauriWindow
  return w.__TAURI_INTERNALS__?.invoke ?? null
}

/** Outcome of an install attempt. Carries a human-readable error + technical
 * detail for the failure toast; `ok` callers don't need either. */
export type InstallResult =
  | { ok: true }
  | { ok: false; code: InstallErrorCode; message: string; detail?: string }

export type InstallErrorCode =
  | "NO_TAURI"
  | "NO_VERIFY_URL"
  | "NO_RECEIPT"
  | "VERIFY_HTTP"
  | "VERIFY_REJECTED"
  | "SIGNED_URL_MISSING"
  | "VERIFY_NETWORK"
  | "OFFLINE"
  | "DOWNLOAD_FAILED"

type SignedUrlResult =
  | { ok: true; url: string }
  | { ok: false; url: null; code: Exclude<InstallErrorCode, "NO_TAURI" | "NO_RECEIPT" | "DOWNLOAD_FAILED">; message: string; detail?: string }

/**
 * Production purchase-verify endpoint (AWS API Gateway → Lambda).
 *
 * Public URL — not a secret. The Lambda enforces auth via the platform
 * receipt, not by URL obscurity. Hardcoded as default so CI/GH-Pages builds
 * (which don't have access to per-machine .env files) ship a working bundle
 * without ceremony. Override via `VITE_GAME_VERIFY_URL` for local staging.
 */
const DEFAULT_VERIFY_URL = "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod"

/**
 * Request a signed download URL for premium content from the backend.
 * On success returns the URL. On failure returns a structured reason so the
 * caller can surface it to the user.
 */
/**
 * Generalized signed-URL request: signs an arbitrary premium download URL
 * for a given product + receipt. Used by both the legacy per-book path
 * (productId = corpan.book.*) and the Corpán Plus path (productId =
 * corpan.sub.* signing the `full` artifact).
 */
async function requestSignedUrl(
  downloadUrl: string,
  productId: string | undefined,
  packId: string,
  transactionId: string,
  receipt: string,
  platform: string
): Promise<SignedUrlResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      ok: false,
      url: null,
      code: "OFFLINE",
      message: "Subscription needs internet — reconnect and try again.",
      detail: "navigator.onLine is false",
    }
  }

  const verifyUrl =
    ((typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GAME_VERIFY_URL) as string | undefined) ||
    DEFAULT_VERIFY_URL

  try {
    const fullUrl = verifyUrl.replace(/\/+$/, "") + "/verify-purchase"
    let downloadPath: string | undefined
    try {
      downloadPath = new URL(downloadUrl).pathname.replace(/^\/+/, "")
    } catch {
      downloadPath = undefined
    }

    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform,
        productId,
        packId,
        transactionId,
        ...(downloadPath ? { downloadPath } : {}),
        ...(platform === "android" ? { purchaseToken: receipt } : { receipt }),
      }),
    })

    const bodyText = await res.text()
    if (!res.ok) {
      console.error("[reader-catalog] verify-purchase HTTP", res.status, bodyText)
      return {
        ok: false,
      url: null,
        code: "VERIFY_HTTP",
        message: "Backend couldn't verify your subscription",
        detail: `HTTP ${res.status}: ${truncate(bodyText, 300)}`,
      }
    }

    let data: { status?: string; signedUrl?: string; error?: string } = {}
    try {
      data = JSON.parse(bodyText)
    } catch {
      return {
        ok: false,
      url: null,
        code: "VERIFY_REJECTED",
        message: "Backend returned an unreadable response",
        detail: truncate(bodyText, 300),
      }
    }

    if (data.status !== "verified") {
      console.error("[reader-catalog] verify-purchase status", data.status, data.error)
      return {
        ok: false,
      url: null,
        code: "VERIFY_REJECTED",
        message: "Backend rejected this receipt",
        detail: data.error ?? `status: ${data.status ?? "(missing)"}`,
      }
    }

    if (!data.signedUrl) {
      console.error("[reader-catalog] verify-purchase verified but missing signedUrl")
      return {
        ok: false,
      url: null,
        code: "SIGNED_URL_MISSING",
        message: "Backend verified you but can't issue a download URL",
        detail: "signedUrl missing from verified response",
      }
    }

    return { ok: true, url: data.signedUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[reader-catalog] Signed URL request failed:", err)
    return {
      ok: false,
      url: null,
      code: "VERIFY_NETWORK",
      message: "Couldn't reach the purchase-verify backend",
      detail: msg,
    }
  }
}

async function getSignedDownloadUrl(
  entry: CatalogNarrationEntry,
  transactionId: string,
  receipt: string,
  platform: string
): Promise<SignedUrlResult> {
  // Short-circuit before hitting the verify endpoint when the device is
  // offline. The catalog's network errors then route to a calm offline
  // toast instead of an alarming "couldn't reach backend" message.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      ok: false,
      url: null,
      code: "OFFLINE",
      message: "Purchase needs internet — reconnect and try again.",
      detail: "navigator.onLine is false",
    }
  }

  const verifyUrl =
    ((typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_GAME_VERIFY_URL) as string | undefined) ||
    DEFAULT_VERIFY_URL

  try {
    // Concat instead of `new URL("/verify-purchase", base)` — the latter
    // STRIPS the stage path because absolute "/..." replaces the base path.
    // i.e. `new URL("/verify-purchase", "https://x.com/prod")` →
    // "https://x.com/verify-purchase" (no /prod). That hits a 404 with no
    // CORS headers, which WKWebView reports as "Load failed".
    const fullUrl = verifyUrl.replace(/\/+$/, "") + "/verify-purchase"

    // Send the actual catalog download path so the Lambda signs the file
    // that ACTUALLY exists in S3 — its packId-based fallback drops the
    // `-{version}.zip` suffix and 403s on a missing file. Defensive parse
    // in case downloadUrl is malformed for any reason.
    let downloadPath: string | undefined
    try {
      downloadPath = new URL(entry.downloadUrl).pathname.replace(/^\/+/, "")
    } catch {
      downloadPath = undefined
    }

    const res = await fetch(fullUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform,
        productId: entry.purchase.productId,
        packId: entry.id,
        transactionId,
        ...(downloadPath ? { downloadPath } : {}),
        ...(platform === "android" ? { purchaseToken: receipt } : { receipt }),
      }),
    })

    const bodyText = await res.text()
    if (!res.ok) {
      console.error("[reader-catalog] verify-purchase HTTP", res.status, bodyText)
      return {
        ok: false,
      url: null,
        code: "VERIFY_HTTP",
        message: "Backend couldn't verify your purchase",
        detail: `HTTP ${res.status}: ${truncate(bodyText, 300)}`,
      }
    }

    let data: { status?: string; signedUrl?: string; error?: string } = {}
    try {
      data = JSON.parse(bodyText)
    } catch {
      return {
        ok: false,
      url: null,
        code: "VERIFY_REJECTED",
        message: "Backend returned an unreadable response",
        detail: truncate(bodyText, 300),
      }
    }

    if (data.status !== "verified") {
      console.error("[reader-catalog] verify-purchase status", data.status, data.error)
      return {
        ok: false,
      url: null,
        code: "VERIFY_REJECTED",
        message: "Backend rejected this receipt",
        detail: data.error ?? `status: ${data.status ?? "(missing)"}`,
      }
    }

    if (!data.signedUrl) {
      console.error("[reader-catalog] verify-purchase verified but missing signedUrl")
      return {
        ok: false,
      url: null,
        code: "SIGNED_URL_MISSING",
        message: "Backend verified you but can't issue a download URL",
        detail: "signedUrl missing from verified response (likely CloudFront signing key not configured in Lambda)",
      }
    }

    return { ok: true, url: data.signedUrl }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[reader-catalog] Signed URL request failed:", err)
    return {
      ok: false,
      url: null,
      code: "VERIFY_NETWORK",
      message: "Couldn't reach the purchase-verify backend",
      detail: msg,
    }
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s
}

/**
 * Install a narration pack via Tauri IPC.
 *
 * For premium packs: if purchaseInfo is provided, requests a signed download URL
 * from the backend before downloading. The signed URL replaces the catalog's
 * downloadUrl for the actual download.
 *
 * In browser dev mode (no Tauri), logs a message and returns a NO_TAURI result.
 *
 * Returns a structured result so callers can surface the failure reason to
 * the user. Old `boolean` callers can check `.ok`.
 */
export async function installNarration(
  entry: CatalogNarrationEntry,
  purchaseInfo?: {
    transactionId: string
    receipt: string
    platform: string
  }
): Promise<InstallResult> {
  const invoke = getTauriInvoke()
  if (!invoke) {
    console.log("[reader-catalog] No Tauri runtime — skipping install for", entry.id)
    return {
      ok: false,
      code: "NO_TAURI",
      message: "Downloads aren't available in this environment",
    }
  }

  // ── Corpán Plus two-ZIP model ──
  // New-shape entries carry preview (public) + full (Plus-gated). The new
  // runtime reads ONLY these: subscribers get the full ZIP via signed URL;
  // everyone else gets the public preview ZIP. The legacy downloadUrl is
  // ignored here.
  if (isTwoZipEntry(entry)) {
    const sub = await isCurrentlySubscribed()
    const wantFull = sub.ok && sub.entitled

    if (wantFull) {
      const receipt = await resolveSubscriptionReceipt()
      if (!receipt) {
        return {
          ok: false,
          code: "NO_RECEIPT",
          message: "We couldn't find your Corpán Plus subscription",
          detail: "resolveSubscriptionReceipt returned nothing. Try Restore Purchases.",
        }
      }
      const signed = await requestSignedUrl(
        entry.full.url,
        "corpan.plus",
        entry.id,
        receipt.transactionId,
        receipt.receipt,
        receipt.platform
      )
      if (!signed.ok) {
        return { ok: false, code: signed.code, message: signed.message, detail: signed.detail }
      }
      try {
        await invoke("content_packs_install_from_url", {
          packId: entry.id,
          downloadUrl: signed.url,
          expectedSha256: entry.full.sha256 || null,
        })
        // Full ZIP landed — record fullness so the upgrade layers treat this
        // as complete (idempotent no-op) and never re-download it.
        addInstalled(entry, true)
        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("[reader-catalog] Full install failed:", entry.id, err)
        return { ok: false, code: "DOWNLOAD_FAILED", message: "Download or install failed", detail: msg }
      }
    }

    // Non-subscriber → public preview ZIP, no auth.
    try {
      await invoke("content_packs_install_from_url", {
        packId: entry.id,
        downloadUrl: entry.preview.url,
        expectedSha256: entry.preview.sha256 || null,
      })
      // Preview ZIP landed — mark it as a preview so the post-subscribe sweep /
      // JIT self-heal can find and upgrade it once the user goes Plus.
      addInstalled(entry, false)
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[reader-catalog] Preview install failed:", entry.id, err)
      return { ok: false, code: "DOWNLOAD_FAILED", message: "Download or install failed", detail: msg }
    }
  }

  let downloadUrl = entry.downloadUrl

  // Premium content requires a signed URL.
  // If the caller didn't supply purchaseInfo (the usual path for
  // subscribers and returning book-owners — nobody persists raw receipts),
  // fall back to restoring a receipt from StoreKit / Play Billing just in time.
  if (entry.tier === "premium" && entry.purchase.type === "iap") {
    let resolvedInfo = purchaseInfo
    if (!resolvedInfo) {
      const restored = await resolveReceiptForEntry(entry)
      if (!restored) {
        console.error("[reader-catalog] Premium pack requires purchase info:", entry.id)
        return {
          ok: false,
          code: "NO_RECEIPT",
          message: "We couldn't find your subscription or purchase receipt",
          detail: "plugin:iap|restore_purchases returned nothing usable for inapp or subs. Try Restore Purchases in the main app.",
        }
      }
      resolvedInfo = {
        transactionId: restored.transactionId,
        receipt: restored.receipt,
        platform: restored.platform,
      }
    }

    const signed = await getSignedDownloadUrl(
      entry,
      resolvedInfo.transactionId,
      resolvedInfo.receipt,
      resolvedInfo.platform
    )

    if (!signed.ok) {
      return { ok: false, code: signed.code, message: signed.message, detail: signed.detail }
    }

    downloadUrl = signed.url
  }

  try {
    await invoke("content_packs_install_from_url", {
      packId: entry.id,
      downloadUrl,
      expectedSha256: entry.sha256 || null,
    })
    // Legacy single-ZIP (or free) entry — always the complete narration, never
    // a truncated preview.
    addInstalled(entry, true)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[reader-catalog] Install failed:", entry.id, err)
    return {
      ok: false,
      code: "DOWNLOAD_FAILED",
      message: "Download or install failed",
      detail: msg,
    }
  }
}

/**
 * Delete an installed narration pack.
 * Removes the pack directory via Tauri IPC and updates the library store.
 */
export async function deleteNarration(narrationId: string): Promise<boolean> {
  const invoke = getTauriInvoke()

  if (invoke) {
    try {
      await invoke("content_packs_delete", { packId: narrationId })
    } catch {
      console.warn("[reader-catalog] content_packs_delete not available for", narrationId)
    }
  }

  removeInstalled(narrationId)
  return true
}

/** Check if Tauri runtime is available (true = can download, false = browser-only) */
export function isTauriAvailable(): boolean {
  return getTauriInvoke() !== null
}

/** Get the corpan-pack:// URL for a locally installed narration */
export function getPackUrl(narrationId: string): string {
  return `corpan-pack://localhost/${narrationId}/`
}
