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

import { useCharacter } from "../character/store.ts"
import { fireReaction, resetReactions, seedReactions, settleReactions } from "../reactions/live.ts"
import { worldStore } from "../world/live.ts"
import { idleScheduler } from "./idle.ts"
import { FIRST_ACROSS_ZERO } from "./ladder.ts"
import { expose, measure, now, record } from "./metrics.ts"
import { DEFAULT_PROFILE_ID } from "../app/profile.ts"
import { createProgressStore } from "./progress.ts"
import { respond, type Response } from "./respond.ts"
import {
  advance,
  arrivesAcrossZero,
  commit,
  pressKey,
  prepare,
  sequenceFrom,
  startSession,
  type SessionState,
} from "./session.ts"
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
  /**
   * The reaction and the remark this verdict earned, waiting for the frame
   * after the one that paints it. Nothing on the answer path touches the world
   * except the placement itself, which is one integer and has to be synchronous
   * — the aperture appears *with* the verdict or it is not the same event.
   */
  pending: Response | null
  /** Has the ladder crossed into the across-zero rungs during this session? */
  arrived: boolean
  begin: () => void
  press: (key: EntryKey) => void
  commitAnswer: () => void
  /** The child moved on. Settles whatever is playing, because they acted. */
  next: () => void
  /**
   * The hold expired and the app moved on by itself.
   *
   * Deliberately **not** `next`. `next` settles the reaction, which is right
   * when a finger or a key caused it and wrong when a timer did: the hold is
   * 420 ms and the MECHANISM is 1800, so routing the auto-advance through
   * `next` cut every reaction above SEAT to about a quarter of its budget,
   * mid-motion. Measured in the real app at `placed = 20`: first ink 38 ms,
   * last ink 594 ms of an 1800 ms tier.
   *
   * EXPERIENCE_DESIGN already says what should happen — "the next problem
   * presents concurrently with the reaction tail" — and this is that. The card
   * changes on time, the reaction plays out over it, and the first thing the
   * child touches still settles it inside `Q-04`'s 90 ms.
   */
  autoAdvance: () => void
  react: () => void
  runIdle: () => void
  end: () => void
}

/**
 * Move to the next card. `settle` is what separates a finger from a timer.
 *
 * Factored out so the two entry points cannot drift: the arrival rule, the
 * persistence and the pending-reaction reset are written once.
 */
function present(
  get: () => PracticeState,
  set: (partial: Partial<PracticeState>) => void,
  settle: boolean,
): void {
  if (settle) settleReactions()
  const session = get().session
  if (session === null) return
  const advanced = advance(session)
  // "First time on these" is a fact about the *ladder* reaching the across-zero
  // rungs, so it is read off the card the ladder just served. It used to be
  // read off any rung increase between two cards, and the repair rung and the
  // first across-zero rung are the same index — so the line fired the first
  // time a child got one wrong three rungs lower and was handed the repair
  // item, then latched, so the real arrival was silent.
  const crossed = !get().arrived && arrivesAcrossZero(advanced.card)
  set({ session: advanced, feedbackAt: null, pending: null, arrived: get().arrived || crossed })
  if (crossed) {
    useCharacter.getState().observe({ kind: "arrived", apertures: null }, advanced.served)
  }
  savePosition(advanced)
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
  pending: null,
  arrived: false,

  begin: () => {
    if (get().session !== null) return
    const saved = progressStore.getState()
    const session = startSession({
      profileId: DEFAULT_PROFILE_ID,
      rung: saved.rung,
      rungCorrect: saved.rungCorrect,
      seedCursor: saved.seedCursor,
    })
    // A new session refills the once-a-session reaction budget and empties the
    // character's memory of what he has already said. Both are per session by
    // design; neither is persisted.
    resetReactions()
    useCharacter.getState().reset()
    // Which effect plays and which line he says are now a function of where the
    // session is, not of `Math.random`, so a replayed session replays them.
    const sequence = sequenceFrom(saved.seedCursor)
    seedReactions(sequence)
    useCharacter.getState().seed(sequence)
    // A child who resumes already above the line has not just arrived and is
    // not told they have.
    set({
      session,
      feedbackAt: null,
      pending: null,
      arrived: session.rung >= FIRST_ACROSS_ZERO,
    })
    savePosition(session)
  },

  press: (key) => {
    settleReactions()
    const session = get().session
    if (session === null) return
    const next = pressKey(session, key)
    if (next !== session) set({ session: next })
  },

  commitAnswer: () => {
    settleReactions()
    const session = get().session
    if (session === null) return
    const next = measure("commitToJudgement", () => commit(session))
    if (next === session) return

    // The world moves with the verdict, not after it: one integer, so the
    // aperture is in the same paint as the seated answer. Everything else the
    // response needs — the reaction, the character — waits for `react()`.
    const correct = next.feedback?.kind === "seated"
    const placed = correct ? worldStore.getState().placeOne() : worldStore.getState().placed
    set({
      session: next,
      feedbackAt: now(),
      pending: respond(session.card, correct, placed),
    })

    const progress = progressStore.getState()
    progress.recordAnswer(correct)
    const latest = next.log[next.log.length - 1]
    if (latest?.kind === "diagnosed") progress.countBug(latest.misconception)
    savePosition(next)
  },

  /**
   * Fire what the verdict earned. Called from the frame after the verdict
   * painted, so a reaction can never be in front of the thing it reacts to,
   * and never delays it.
   */
  react: () => {
    const { pending, session } = get()
    if (pending === null || session === null) return
    set({ pending: null })
    fireReaction(pending.outcome)
    if (pending.observation !== null) {
      useCharacter.getState().observe(pending.observation, session.served)
    }
  },

  next: () => {
    present(get, set, true)
  },

  autoAdvance: () => {
    present(get, set, false)
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

  end: () => {
    settleReactions()
    useCharacter.getState().hush()
    set({ session: null, feedbackAt: null, pending: null, arrived: false })
  },
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
