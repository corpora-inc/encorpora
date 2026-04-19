import { createStore } from "zustand/vanilla"
import { persist } from "zustand/middleware"

/**
 * Tracks the most-recently-used narrations across reader sessions so the
 * narration switcher (top-left widget + in-drawer pill row) can surface
 * 1-tap toggles between the languages the user actually drills.
 *
 * Most-recent-first, deduped, capped at 16. Stored in localStorage as
 * `corpan-narration-history`.
 */

const MAX_RECENT = 16

type NarrationHistoryState = {
  recent: string[]
}

export const narrationHistoryStore = createStore<NarrationHistoryState>()(
  persist(
    () => ({ recent: [] as string[] }),
    { name: "corpan-narration-history" }
  )
)

/** Move a narration to the front of the recent list. Called from switchToNarration. */
export function recordNarrationUse(narrationId: string): void {
  if (!narrationId) return
  narrationHistoryStore.setState((s) => {
    const filtered = s.recent.filter((id) => id !== narrationId)
    filtered.unshift(narrationId)
    return { recent: filtered.slice(0, MAX_RECENT) }
  })
}

/** Read the current recent list (most-recent first). */
export function getRecentNarrations(): string[] {
  return narrationHistoryStore.getState().recent
}

/** Forget any recent IDs that no longer exist (e.g. uninstalled). */
export function pruneRecentNarrations(validIds: Set<string>): void {
  narrationHistoryStore.setState((s) => {
    const filtered = s.recent.filter((id) => validIds.has(id))
    if (filtered.length === s.recent.length) return s
    return { recent: filtered }
  })
}
