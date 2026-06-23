import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * Per-book reading progress — the on-device substrate for the Library
 * "Continue" shelf, streaks, and "X segments to your Plus moment" hints.
 *
 * Privacy: localStorage only. Never sent to a server. Readers report progress
 * via the `corpan:segment-progress` window event; App.tsx writes it here.
 */
export type BookProgress = {
  /** Deepest segment index reached (0-based). */
  segmentsReached: number
  /** Total segments in the (full) book, if the reader knows it. */
  totalSegments?: number
  /** ISO timestamp of the most recent open. */
  lastOpenedAt: string
}

type ProgressKey = string // `${bookId}::${lang}`

const keyOf = (bookId: string, lang: string): ProgressKey => `${bookId}::${lang}`

type ProgressState = {
  byKey: Record<ProgressKey, BookProgress>
  reportProgress: (p: {
    bookId: string
    language: string
    segmentsReached: number
    totalSegments?: number
  }) => void
  bookProgress: (bookId: string, lang: string) => BookProgress | undefined
  /** Books touched, most-recently-opened first. */
  booksInFlight: () => Array<{ bookId: string; language: string; progress: BookProgress }>
  /** Count of books whose progress reached totalSegments. */
  booksFinished: () => number
  /** Consecutive-day streak ending today (local time), from lastOpenedAt dates. */
  streakDays: () => number
  /** Segments reported today (local date). */
  segmentsToday: () => number
}

const localDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      byKey: {},

      reportProgress: ({ bookId, language, segmentsReached, totalSegments }) => {
        if (!bookId || !language) return
        const k = keyOf(bookId, language)
        set((state) => {
          const prev = state.byKey[k]
          // Monotonic: deepest reached only moves forward.
          const reached = Math.max(prev?.segmentsReached ?? 0, segmentsReached)
          return {
            byKey: {
              ...state.byKey,
              [k]: {
                segmentsReached: reached,
                totalSegments: totalSegments ?? prev?.totalSegments,
                lastOpenedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      bookProgress: (bookId, lang) => get().byKey[keyOf(bookId, lang)],

      booksInFlight: () =>
        Object.entries(get().byKey)
          .map(([k, progress]) => {
            const [bookId, language] = k.split("::")
            return { bookId, language, progress }
          })
          .sort(
            (a, b) =>
              new Date(b.progress.lastOpenedAt).getTime() -
              new Date(a.progress.lastOpenedAt).getTime()
          ),

      booksFinished: () =>
        Object.values(get().byKey).filter(
          (p) => p.totalSegments != null && p.segmentsReached >= p.totalSegments
        ).length,

      streakDays: () => {
        const days = new Set(
          Object.values(get().byKey).map((p) => localDate(p.lastOpenedAt))
        )
        if (days.size === 0) return 0
        let streak = 0
        const cursor = new Date()
        // Walk backwards from today; allow today OR yesterday to seed it so a
        // streak isn't "lost" before the user opens the app on a new day.
        const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
        if (!days.has(todayKey)) {
          cursor.setDate(cursor.getDate() - 1)
          const yKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
          if (!days.has(yKey)) return 0
        }
        // Count consecutive days ending at cursor.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
          if (days.has(key)) {
            streak++
            cursor.setDate(cursor.getDate() - 1)
          } else {
            break
          }
        }
        return streak
      },

      segmentsToday: () => {
        // Approximate: we don't store per-day deltas, only deepest reached +
        // last-open day. "Segments today" = sum of segmentsReached for books
        // last opened today. Good enough for a dignified daily-goal chip.
        const today = localDate(new Date().toISOString())
        return Object.values(get().byKey)
          .filter((p) => localDate(p.lastOpenedAt) === today)
          .reduce((sum, p) => sum + p.segmentsReached, 0)
      },
    }),
    {
      name: "corpan-progress-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ byKey: state.byKey }),
    }
  )
)
