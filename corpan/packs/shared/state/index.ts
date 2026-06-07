export type { Bookmark, BookmarkStore } from "./bookmarkStore"
export { createBookmarkStore } from "./bookmarkStore"

export type { BookMeta, BookMetaStore } from "./bookMetaStore"
export { createBookMetaStore } from "./bookMetaStore"

export type { PrefsStore } from "./prefsStore"
export { createPrefsStore } from "./prefsStore"

export type { DrawerState } from "./drawerStore"
export { drawerStore } from "./drawerStore"

export {
  narrationHistoryStore,
  recordNarrationUse,
  getRecentNarrations,
  pruneRecentNarrations,
} from "./narrationHistoryStore"

// Quota-safe shared storage for packs (IndexedDB LARGE tier + guarded
// localStorage TINY tier). Prefer this over raw `localStorage.setItem` for
// anything that can grow — it shares the app's storage substrate + eviction
// and NEVER throws a QuotaExceededError to the caller.
export type {
  PackStore,
  PackStoreOptions,
  SetOpts as PackSetOpts,
  GetOpts as PackGetOpts,
} from "./safeStorage"
export { createPackStore } from "./safeStorage"
