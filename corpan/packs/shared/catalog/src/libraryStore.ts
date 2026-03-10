import type { InstalledNarration, CatalogNarrationEntry } from "./types"

const STORE_KEY = "reader-catalog-library"

type LibraryIndex = Record<string, InstalledNarration>

function readIndex(): LibraryIndex {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as LibraryIndex
  } catch {
    return {}
  }
}

function writeIndex(index: LibraryIndex): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(index))
  } catch {
    // ignore
  }
}

/** Add a narration to the installed library */
export function addInstalled(entry: CatalogNarrationEntry): void {
  const index = readIndex()
  index[entry.id] = {
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
  }
  writeIndex(index)
}

/** Remove a narration from the installed library */
export function removeInstalled(narrationId: string): void {
  const index = readIndex()
  delete index[narrationId]
  writeIndex(index)
}

/** Check if a narration is installed */
export function isInstalled(narrationId: string): boolean {
  return narrationId in readIndex()
}

/** Get a specific installed narration */
export function getInstalled(narrationId: string): InstalledNarration | null {
  return readIndex()[narrationId] ?? null
}

/** List all installed narrations */
export function listInstalled(): InstalledNarration[] {
  return Object.values(readIndex()).sort(
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
