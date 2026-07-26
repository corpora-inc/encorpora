// The Dynawalla speaks: what he notices, and how rarely.
//
// ## Rarity is the register
//
// Twenty-one authored lines against a few hundred items per session is one line
// every ten or twenty problems, repeating from minute six, and the in-repo
// precedent for that architecture resolves to "Perfect / Nice / Brilliant" —
// the generic cheerleader this product exists in opposition to. Two fixes, both
// taken here.
//
// **He speaks three to five times in a session, at genuine milestones.** The
// budget is enforced in this file and there is no override. `QUIET_CARDS` keeps
// two remarks from landing on top of each other when a repair and a closing
// star coincide. Silence is the personality; most of the session he is present
// and says nothing.
//
// **A grammar, not a line list.** M2 has three observation types and four
// phrasings each — the twelve fragments PR-2.11 names — behind the interface
// M6 fills out to ~100 fragments over eight observation types with slotted
// skill and instrument nouns (`P-06`). The `{{apertures}}` slot is already
// live, so the call sites do not move when the grammar grows.
//
// ## What he is allowed to say
//
// Only true, specific things. He does not say "well done", he says what
// happened. He never names a misconception or a defect (`M-16`): the repair
// lines describe what the *mathematics* did — the borrowed ten was spent and
// did not stay behind — never what the child got wrong.

import { strings, fill } from "../app/strings.ts"

export type ObservationKind = keyof typeof strings.dynawalla

export interface Observation {
  readonly kind: ObservationKind
  /** Apertures in the thing that just closed. `null` when it is not that. */
  readonly apertures: number | null
}

/** Utterances per session. Three to five is the register; four is the cap. */
export const UTTERANCE_BUDGET = 4

/** Cards of silence after he speaks, so two remarks never stack. */
export const QUIET_CARDS = 3

export interface VoiceState {
  /** Fragment ids already used this session. He never repeats himself. */
  readonly said: readonly string[]
  /** The card ordinal he last spoke on. */
  readonly lastAt: number | null
}

export const SILENT: VoiceState = { said: [], lastAt: null }

export interface Utterance {
  readonly id: string
  readonly line: string
}

export interface Considered {
  readonly state: VoiceState
  /** `null` far more often than not, and that is the design. */
  readonly utterance: Utterance | null
}

/**
 * Offer him something that happened. He decides whether it is worth a word.
 *
 * Pure: `at` is the card ordinal and `draw` is a number in [0, 1), so the same
 * session replays identically in a test and in the screenshot harness.
 */
export function consider(
  state: VoiceState,
  observation: Observation,
  at: number,
  draw: number,
): Considered {
  if (state.said.length >= UTTERANCE_BUDGET) return { state, utterance: null }
  if (state.lastAt !== null && at - state.lastAt < QUIET_CARDS) return { state, utterance: null }

  const phrasings = strings.dynawalla[observation.kind]
  const unused: { id: string; template: string }[] = []
  for (let i = 0; i < phrasings.length; i++) {
    const id = `${observation.kind}:${String(i)}`
    const template = phrasings[i]
    if (template !== undefined && !state.said.includes(id)) unused.push({ id, template })
  }
  if (unused.length === 0) return { state, utterance: null }

  const index = Math.min(Math.floor(Math.max(draw, 0) * unused.length), unused.length - 1)
  const chosen = unused[index]
  if (chosen === undefined) return { state, utterance: null }

  return {
    state: { said: [...state.said, chosen.id], lastAt: at },
    utterance: {
      id: chosen.id,
      line: fill(chosen.template, { apertures: observation.apertures ?? 0 }),
    },
  }
}

/** Every line he can say, for the coverage test and for the locale gate. */
export function corpus(): string[] {
  return Object.values(strings.dynawalla).flatMap((phrasings) => [...phrasings])
}
