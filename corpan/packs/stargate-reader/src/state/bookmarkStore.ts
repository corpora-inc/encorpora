const STORAGE_PREFIX = "stargate-reader"

export type Bookmark = {
  timeMs: number
  segmentIndex: number
  language: string
  savedAt: number
}

function key(bookId: string): string {
  return `${STORAGE_PREFIX}:${bookId}`
}

export function loadBookmark(bookId: string): Bookmark | null {
  try {
    const raw = localStorage.getItem(key(bookId))
    if (!raw) return null
    return JSON.parse(raw) as Bookmark
  } catch {
    return null
  }
}

export function saveBookmark(bookId: string, bookmark: Bookmark): void {
  try {
    localStorage.setItem(key(bookId), JSON.stringify(bookmark))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function clearBookmark(bookId: string): void {
  try {
    localStorage.removeItem(key(bookId))
  } catch {
    // Silently ignore
  }
}
