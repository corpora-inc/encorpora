// The live session, held where every component reads it directly.
//
// Session state is not component state. The slate, the keypad, the verdict and
// the counting board all need the same card, and threading it through props (or
// worse, mirroring it into `useState`) is how a surface ends up with two answers
// to "what is on screen". One store, read at the point of use.
//
// The split is: `session.ts` decides, this file schedules. Every transition here
// is a call into a pure function plus the two things a pure function cannot do —
// write to storage, and ask the platform for idle time. Both happen *after* the
// verdict is in the store, which is after the frame that paints it is scheduled.

import { create } from "zustand"

import { idleScheduler } from "./idle.ts"
import { expose, measure, now, record } from "./metrics.ts"
import { DEFAULT_PROFILE_ID } from "./profile.ts"
import { createProgressStore } from "./progress.ts"
import { advance, commit, pressKey, prepare, startSession, type SessionState } from "./session.ts"
import type { EntryKey } from "./entry.ts"

export const progressStore = createProgressStore(DEFAULT_PROFILE_ID)

// The latency rings, reachable from a console or a driver script — in dev only.
// Vite substitutes `false` here in a production build, so the branch and
// everything it reaches are eliminated: `rg __dwMetrics dist/` finds nothing.
// Traces do not ship (A-18).
if (import.meta.env.DEV) expose()

interface PracticeState {
  session: SessionState | null
  /** When the current verdict landed, for the feedback→next-ready span. */
  feedbackAt: number | null
  begin: () => void
  press: (key: EntryKey) => void
  commitAnswer: () => void
  next: () => void
  runIdle: () => void
  end: () => void
}

function savePosition(session: SessionState): void {
  progressStore.getState().savePosition({
    rung: session.rung,
    rungCorrect: session.rungCorrect,
    seedCursor: session.seedCursor,
  })
}

export const usePractice = create<PracticeState>()((set, get) => ({
  session: null,
  feedbackAt: null,

  begin: () => {
    if (get().session !== null) return
    const saved = progressStore.getState()
    const session = startSession({
      profileId: DEFAULT_PROFILE_ID,
      rung: saved.rung,
      rungCorrect: saved.rungCorrect,
      seedCursor: saved.seedCursor,
    })
    set({ session, feedbackAt: null })
    savePosition(session)
  },

  press: (key) => {
    const session = get().session
    if (session === null) return
    const next = pressKey(session, key)
    if (next !== session) set({ session: next })
  },

  commitAnswer: () => {
    const session = get().session
    if (session === null) return
    const next = measure("commitToJudgement", () => commit(session))
    if (next === session) return
    set({ session: next, feedbackAt: now() })

    const progress = progressStore.getState()
    progress.recordAnswer(next.feedback?.kind === "seated")
    const latest = next.log[next.log.length - 1]
    if (latest?.kind === "diagnosed") progress.countBug(latest.misconception)
    savePosition(next)
  },

  next: () => {
    const session = get().session
    if (session === null) return
    const advanced = advance(session)
    set({ session: advanced, feedbackAt: null })
    savePosition(advanced)
  },

  runIdle: () => {
    const { session, feedbackAt } = get()
    if (session === null) return
    const next = prepare(session)
    if (next !== session) {
      set({ session: next })
      savePosition(next)
    }
    if (feedbackAt !== null) {
      record("feedbackToReady", now() - feedbackAt)
      set({ feedbackAt: null })
    }
  },

  end: () => set({ session: null, feedbackAt: null }),
}))

/**
 * Ask the platform for idle time and top the deck up in it.
 *
 * Returns its own canceller. Called from an effect on every state change the
 * screen renders, which is more often than strictly needed and costs nothing:
 * `prepare` is idempotent and returns the same object when there is no work.
 */
export function scheduleDeckFill(): () => void {
  return idleScheduler()(() => {
    usePractice.getState().runIdle()
  })
}
