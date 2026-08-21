// Shared model-pick logic — the ONE probe that decides which installed Whisper
// folder to use. Extracted from cap-pronounce's boot (index.ts) so the app's
// `store/stt.ts` single-source-of-truth store AND the capability's own fallback
// share a single implementation (WS-B / R5). Pure functions + one I/O probe;
// no app imports, no module-level state.
import type { CapabilitySttApi } from "@shared/capabilities/core"
import { allFolders, modelByFolder } from "./modelRegistry"

export interface InstalledProbe {
  /** Folders confirmed installed on disk, across EVERY known model folder. */
  installed: string[]
  /** The folder the native context currently has LOADED, if any. */
  loaded: string | null
}

/**
 * Probe EVERY known folder for on-disk installs plus the currently-loaded
 * model. Robust to hosts where `listInstalled` is missing or returns a
 * non-canonical shape (an older Android bridge answers `{ installed: [...] }`
 * rather than `{ models: [...] }`): in that case we fall back to per-folder
 * `validateModel`. Never throws — a bridge hiccup degrades to "nothing found".
 */
export const probeInstalledFolders = async (
  stt: CapabilitySttApi | undefined | null,
): Promise<InstalledProbe> => {
  if (!stt) return { installed: [], loaded: null }
  const folders = allFolders()

  // Prefer the currently-loaded model — reusing it skips a re-prepare.
  let loaded: string | null = null
  try {
    const status = await stt.getStatus?.()
    if (status?.model && folders.includes(status.model)) loaded = status.model
  } catch (err) {
    console.warn("[modelPick] getStatus probe failed:", err)
  }

  const usable = new Set<string>()
  if (loaded) usable.add(loaded)

  // Primary probe: listInstalled with the canonical `{ models: [{valid}] }`
  // shape. Guarded so a mis-shaped/absent response doesn't throw us out.
  if (stt.listInstalled) {
    try {
      const res = await stt.listInstalled({ models: folders })
      const models = Array.isArray(res?.models) ? res.models : []
      for (const m of models) {
        if (m?.valid && typeof m.model === "string") usable.add(m.model)
      }
    } catch (err) {
      console.warn("[modelPick] listInstalled probe failed:", err)
    }
  }

  // Fallback probe: if listInstalled told us nothing usable (missing on this
  // host, or the non-canonical shape), validate each folder directly.
  if (usable.size === 0 && stt.validateModel) {
    for (const folder of folders) {
      try {
        const v = await stt.validateModel({ model: folder })
        if (v?.valid) usable.add(folder)
      } catch (err) {
        console.warn(`[modelPick] validateModel(${folder}) failed:`, err)
      }
    }
  }

  return { installed: [...usable], loaded }
}

/**
 * Pure selection over a known install set (no I/O):
 *   preferred-if-installed → loaded-if-installed → largest installed → null.
 * A user who installed the big Whisper gets it, never the 75 MB Tiny.
 */
export const pickBestFolder = (
  installed: string[],
  loaded?: string | null,
  preferred?: string | null,
): string | null => {
  if (installed.length === 0) return null
  const has = (f?: string | null): f is string => !!f && installed.includes(f)
  if (has(preferred)) return preferred
  if (has(loaded)) return loaded
  let best: string | null = null
  let bestSize = -1
  for (const folder of installed) {
    const size = modelByFolder(folder)?.approxSizeMB ?? 0
    if (size > bestSize) {
      bestSize = size
      best = folder
    }
  }
  return best
}

/**
 * Probe + pick in one step — cap-pronounce's fallback when the host exposes no
 * `sttModel` seam. Prefers the currently-loaded model, else the largest
 * installed one. Returns null when nothing usable is installed anywhere.
 */
export const pickInstalledModelFolder = async (
  stt: CapabilitySttApi | undefined | null,
): Promise<string | null> => {
  const { installed, loaded } = await probeInstalledFolders(stt)
  return pickBestFolder(installed, loaded)
}
