// Whether he is speaking, and what he said.
//
// Session-scoped and deliberately not persisted: the budget is per session, and
// a line that survived a relaunch would be a line said about something the
// child no longer remembers doing.
//
// The utterance lingers rather than flashing. A remark that appears for the 420
// ms a seated answer holds is a remark nobody reads, and the alternative — the
// loop waiting on the character — is banned outright. So it stays in the band
// while the child carries on working, and goes when it goes. The band is a
// fixed height whether he is speaking or not, so nothing on the work surface
// ever moves because of him.

import { create } from "zustand"

import { consider, SILENT, type Observation, type Utterance, type VoiceState } from "./voice.ts"

/** How long a line stays in the band. Long enough to be read while working. */
export const DWELL_MS = 9000

interface CharacterState {
  readonly voice: VoiceState
  readonly utterance: Utterance | null
  /** Offer him something that happened on card `at`. */
  observe: (observation: Observation, at: number) => void
  /** Clear the line. Called by the dwell timer and when a session begins. */
  hush: () => void
  /** New session: the budget refills, the room is quiet again. */
  reset: () => void
  /**
   * Which phrasing he reaches for, as an injectable sequence.
   *
   * `consider` is pure and takes the draw as an argument precisely so this is
   * seedable; the first cut then handed it `Math.random` here and threw that
   * away. Which line he says is one of the two things that most change a
   * screenshot, so the session seeds it from its own cursor.
   */
  seed: (sequence: () => number) => void
}

let dwell: ReturnType<typeof setTimeout> | null = null
let draw: () => number = Math.random

function schedule(hush: () => void): void {
  if (dwell !== null) clearTimeout(dwell)
  dwell = setTimeout(hush, DWELL_MS)
}

export const useCharacter = create<CharacterState>()((set, get) => ({
  voice: SILENT,
  utterance: null,

  observe: (observation, at) => {
    const { state, utterance } = consider(get().voice, observation, at, draw())
    if (utterance === null) {
      // Still record nothing: `consider` returns the state unchanged when he
      // stays quiet, so there is no bookkeeping to do and no way for a silent
      // observation to spend budget.
      return
    }
    set({ voice: state, utterance })
    schedule(get().hush)
  },

  hush: () => {
    if (dwell !== null) clearTimeout(dwell)
    dwell = null
    set({ utterance: null })
  },

  reset: () => {
    if (dwell !== null) clearTimeout(dwell)
    dwell = null
    set({ voice: SILENT, utterance: null })
  },

  seed: (sequence) => {
    draw = sequence
  },
}))
