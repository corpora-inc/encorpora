import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"
import type { InstalledNarration, CatalogNarrationEntry } from "./types"
import type { SegmentsData } from "../../core/types"

type LibraryState = {
  narrations: Record<string, InstalledNarration>
}

// Migrate from old single-key format (one-time, on module load)
function readLegacy(): Record<string, InstalledNarration> {
  try {
    const raw = localStorage.getItem("reader-catalog-library")
    if (raw) {
      localStorage.removeItem("reader-catalog-library")
      return JSON.parse(raw)
    }
  } catch {}
  return {}
}

export const libraryStore = createStore<LibraryState>()(
  persist(
    () => ({ narrations: readLegacy() }),
    { name: "corpan-library" }
  )
)

/**
 * Add a narration to the installed library.
 *
 * `full` records which ZIP actually landed on disk (Corpán Plus two-ZIP model):
 *   true  — the full ZIP was installed (subscriber path / single-ZIP entry)
 *   false — the truncated preview ZIP was installed (non-subscriber path)
 *   undefined — caller doesn't know (left absent; the JIT classifier backfills)
 * installManager passes this so the upgrade layers can find previews without
 * re-reading segments.json from disk on the happy path.
 */
export function addInstalled(entry: CatalogNarrationEntry, full?: boolean): void {
  libraryStore.setState((s) => ({
    narrations: {
      ...s.narrations,
      [entry.id]: {
        narrationId: entry.id,
        bookId: entry.bookId,
        bookTitle: entry.bookTitle,
        language: entry.language,
        languageName: entry.languageName,
        voiceId: entry.voiceId,
        voiceName: entry.voiceName,
        version: entry.version,
        sizeMb: entry.sizeMb,
        series: entry.series,
        volume: entry.volume,
        installedAt: Date.now(),
        ...(full === undefined ? {} : { full }),
      },
    },
  }))
}

/** Patch the recorded fullness flag for an already-installed narration.
 *  No-op if the narration isn't installed. */
export function setNarrationFullness(narrationId: string, full: boolean): void {
  libraryStore.setState((s) => {
    const existing = s.narrations[narrationId]
    if (!existing) return s
    if (existing.full === full) return s
    return {
      narrations: { ...s.narrations, [narrationId]: { ...existing, full } },
    }
  })
}

/** Remove a narration from the installed library */
export function removeInstalled(narrationId: string): void {
  libraryStore.setState((s) => {
    const { [narrationId]: _, ...rest } = s.narrations
    return { narrations: rest }
  })
}

/** Check if a narration is installed */
export function isInstalled(narrationId: string): boolean {
  return narrationId in libraryStore.getState().narrations
}

/** Get a specific installed narration */
export function getInstalled(narrationId: string): InstalledNarration | null {
  return libraryStore.getState().narrations[narrationId] ?? null
}

/** List all installed narrations */
export function listInstalled(): InstalledNarration[] {
  return Object.values(libraryStore.getState().narrations).sort(
    (a, b) => b.installedAt - a.installedAt
  )
}

/** List installed narrations for a specific book */
export function listInstalledForBook(bookId: string): InstalledNarration[] {
  return listInstalled().filter((n) => n.bookId === bookId)
}

/** Get total installed size in MB */
export function totalInstalledSizeMb(): number {
  return listInstalled().reduce((sum, n) => sum + n.sizeMb, 0)
}

/** The corpan-pack:// data root for an installed narration. Kept in sync with
 *  installManager.getPackUrl; inlined here to avoid an import cycle. */
function packDataUrl(narrationId: string): string {
  return `corpan-pack://localhost/${narrationId}/`
}

/**
 * Decide whether an installed narration is currently a truncated PREVIEW.
 *
 * Source of truth precedence:
 *   1. The recorded `full` flag (fast path, no disk read) — `false` ⇒ preview,
 *      `true` ⇒ full.
 *   2. Legacy records (flag absent): read the installed `segments.json` from
 *      disk — `is_preview === true` OR `segments.length < total_segments` ⇒
 *      preview. On a successful read we BACKFILL the flag so we never re-read.
 *
 * Returns `"unknown"` when the flag is absent AND segments.json can't be read
 * (no Tauri runtime, corrupt pack, etc.) — callers must treat unknown as
 * "don't act now" (the JIT layer will retry on next open).
 *
 * `loadSegmentsForId` is injectable for tests; defaults to packFetchJson.
 */
export async function isPreviewInstalled(
  narrationId: string,
  loadSegmentsForId: (id: string) => Promise<SegmentsData> = async (id) => {
    // Lazy import so this module stays loadable in non-bundler contexts (unit
    // tests always inject a loader, so this path runs only in production).
    const { packFetchJson } = await import("../../data/packFetch")
    return packFetchJson(`${packDataUrl(id)}segments.json`) as Promise<SegmentsData>
  }
): Promise<boolean | "unknown"> {
  const rec = getInstalled(narrationId)
  if (!rec) return "unknown"
  if (rec.full === true) return false
  if (rec.full === false) return true

  // Legacy record — classify from disk, then backfill the flag.
  try {
    const seg = await loadSegmentsForId(narrationId)
    const isPreview =
      seg.is_preview === true ||
      (typeof seg.total_segments === "number" &&
        Array.isArray(seg.segments) &&
        seg.segments.length < seg.total_segments)
    setNarrationFullness(narrationId, !isPreview)
    return isPreview
  } catch {
    return "unknown"
  }
}

/** Installed narration IDs that are known previews via the recorded flag.
 *  Legacy records with an ABSENT flag are NOT included here (their fullness is
 *  unknown without a disk read) — `runUpgradeSweep` classifies those via
 *  `isPreviewInstalled` and the JIT layer covers anything it misses. */
export function listPreviewNarrationIds(): string[] {
  return listInstalled()
    .filter((n) => n.full === false)
    .map((n) => n.narrationId)
}
