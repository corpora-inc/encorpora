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
 * Install a narration pack via Tauri IPC.
 * In browser dev mode (no Tauri), logs a message and does nothing.
 */
export async function installNarration(entry: CatalogNarrationEntry): Promise<boolean> {
  const invoke = getTauriInvoke()
  if (!invoke) {
    console.log("[reader-catalog] No Tauri runtime — skipping install for", entry.id)
    return false
  }

  try {
    await invoke("content_packs_install_from_url", {
      packId: entry.id,
      downloadUrl: entry.downloadUrl,
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
 *
 * Note: The Rust backend doesn't have a delete command yet.
 * This removes the library store entry; full filesystem delete
 * will be handled when the Rust command is added.
 */
export async function deleteNarration(narrationId: string): Promise<boolean> {
  const invoke = getTauriInvoke()

  if (invoke) {
    try {
      // Try the delete command if it exists
      await invoke("content_packs_delete", { packId: narrationId })
    } catch {
      // Command may not exist yet — that's OK, we still clean up the library store
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
