import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"
import type { InstalledNarration, CatalogNarrationEntry } from "./types"

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

/** Add a narration to the installed library */
export function addInstalled(entry: CatalogNarrationEntry): void {
  libraryStore.setState((s) => ({
    narrations: {
      ...s.narrations,
      [entry.id]: {
        narrationId: entry.id,
        bookId: entry.bookId,
        bookTitle: entry.bookTitle,
        language: entry.language,
        voiceId: entry.voiceId,
        voiceName: entry.voiceName,
        version: entry.version,
        sizeMb: entry.sizeMb,
        series: entry.series,
        volume: entry.volume,
        installedAt: Date.now(),
      },
    },
  }))
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
