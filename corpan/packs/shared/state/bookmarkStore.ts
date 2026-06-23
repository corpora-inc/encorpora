export type Bookmark = {
  timeMs: number
  segmentIndex: number
  language: string
  savedAt: number
}

export type BookmarkStore = {
  load: (bookId: string) => Bookmark | null
  save: (bookId: string, bookmark: Bookmark) => void
  clear: (bookId: string) => void
}

export function createBookmarkStore(prefix: string): BookmarkStore {
  function key(bookId: string): string {
    return `${prefix}:${bookId}`
  }

  return {
    load(bookId: string): Bookmark | null {
      try {
        const raw = localStorage.getItem(key(bookId))
        if (!raw) return null
        return JSON.parse(raw) as Bookmark
      } catch {
        return null
      }
    },

    save(bookId: string, bookmark: Bookmark): void {
      try {
        localStorage.setItem(key(bookId), JSON.stringify(bookmark))
      } catch {
        // Storage full or unavailable — silently ignore
      }
    },

    clear(bookId: string): void {
      try {
        localStorage.removeItem(key(bookId))
      } catch {
        // Silently ignore
      }
    },
  }
}
