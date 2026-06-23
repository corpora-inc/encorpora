/**
 * Per-book metadata cache, keyed by bookId. Persists facts about the
 * book that don't change across language switches but that we don't
 * know until segments load — e.g. whether the book has chapters.
 *
 * The transport bar needs `hasChapters` synchronously at mount time
 * (to reserve a line of vertical space so the chapter title doesn't
 * jerk the layout when it arrives async). The bookmark store can't
 * carry this because bookmarks aren't written until the user starts
 * playing, but a returning reader has a cached meta after their first
 * read of the book.
 *
 * First-ever read of a brand-new book: no cache → no reservation →
 * one small layout shift when the first chapter title resolves. Every
 * subsequent mount (including language switches) hits the cache and
 * the layout is stable from frame one.
 */

export type BookMeta = {
  hasChapters?: boolean
}

export type BookMetaStore = {
  load: (bookId: string) => BookMeta | null
  save: (bookId: string, meta: BookMeta) => void
}

export function createBookMetaStore(prefix: string): BookMetaStore {
  function key(bookId: string): string {
    return `${prefix}:bookMeta:${bookId}`
  }

  return {
    load(bookId: string): BookMeta | null {
      try {
        const raw = localStorage.getItem(key(bookId))
        if (!raw) return null
        return JSON.parse(raw) as BookMeta
      } catch {
        return null
      }
    },

    save(bookId: string, meta: BookMeta): void {
      try {
        localStorage.setItem(key(bookId), JSON.stringify(meta))
      } catch {
        // Storage full or unavailable — silently ignore
      }
    },
  }
}
