import type { CatalogNarrationEntry } from "./types"
import { addInstalled, removeInstalled } from "./libraryStore"

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

/**
 * Request a signed download URL for premium content from the backend.
 * Returns the signed URL on success, or null if verification fails.
 */
async function getSignedDownloadUrl(
  entry: CatalogNarrationEntry,
  transactionId: string,
  receipt: string,
  platform: string
): Promise<string | null> {
  const verifyUrl = (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_GAME_VERIFY_URL) as string | undefined

  if (!verifyUrl) {
    console.warn("[reader-catalog] No verify URL configured for premium content")
    return null
  }

  try {
    const res = await fetch(new URL("/verify-purchase", verifyUrl).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platform,
        productId: entry.purchase.productId,
        packId: entry.id,
        transactionId,
        ...(platform === "android" ? { purchaseToken: receipt } : { receipt }),
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as { status: string; signedUrl?: string }
    return data.status === "verified" ? (data.signedUrl ?? null) : null
  } catch (err) {
    console.error("[reader-catalog] Signed URL request failed:", err)
    return null
  }
}

/**
 * Install a narration pack via Tauri IPC.
 *
 * For premium packs: if purchaseInfo is provided, requests a signed download URL
 * from the backend before downloading. The signed URL replaces the catalog's
 * downloadUrl for the actual download.
 *
 * In browser dev mode (no Tauri), logs a message and does nothing.
 */
export async function installNarration(
  entry: CatalogNarrationEntry,
  purchaseInfo?: {
    transactionId: string
    receipt: string
    platform: string
  }
): Promise<boolean> {
  const invoke = getTauriInvoke()
  if (!invoke) {
    console.log("[reader-catalog] No Tauri runtime — skipping install for", entry.id)
    return false
  }

  let downloadUrl = entry.downloadUrl

  // Premium content requires a signed URL
  if (entry.tier === "premium" && entry.purchase.type === "iap") {
    if (!purchaseInfo) {
      console.error("[reader-catalog] Premium pack requires purchase info:", entry.id)
      return false
    }

    const signedUrl = await getSignedDownloadUrl(
      entry,
      purchaseInfo.transactionId,
      purchaseInfo.receipt,
      purchaseInfo.platform
    )

    if (!signedUrl) {
      console.error("[reader-catalog] Failed to get signed URL for premium pack:", entry.id)
      return false
    }

    downloadUrl = signedUrl
  }

  try {
    await invoke("content_packs_install_from_url", {
      packId: entry.id,
      downloadUrl,
      expectedSha256: entry.sha256 || null,
    })
    addInstalled(entry)
    return true
  } catch (err) {
    console.error("[reader-catalog] Install failed:", entry.id, err)
    return false
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
