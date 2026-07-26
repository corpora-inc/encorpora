// The practice loop, as a pure state machine.
//
// Everything a card does — present, accept a key, judge, decide what comes next,
// prepare it — is a function from state to state with no clock, no storage, no
// DOM and no React in it. That is what lets the loop be tested at all: a React
// component is not testable under `node --experimental-strip-types --test`, and
// the behaviour worth testing is not "does a div render", it is "does answering
// 3203 on 5001 − 2798 produce the counting board and answering 3797 not".
//
// ## The concurrency rule, and how the types enforce it
//
// EXPERIENCE_DESIGN: *the work surface never waits for the world*. Commit to
// judgement is under a millisecond, synchronous and pure; the next problem is
// generated during idle, before it is needed.
//
// So `commit` **takes no generator**. Not "does not call one" — cannot. It is the
// only operation on the answer path and its signature is the proof it does no
// work there. Generation lives in `prepare`, which the store runs from
// `requestIdleCallback`, and in `advance`'s starvation fallback, which increments
// a counter a test asserts stays at zero.
//
// ## The three-stage corrective model (ADAPTIVE_LEARNING)
//
//   Stage 1 VERIFY   wrong, unexplained. A strike mark, the correct answer
//                    seated beside it, one retry a rung easier. No lecture.
//   Stage 2 LOCATE   wrong, and the answer *equals* a known buggy procedure's
//                    output, and this build can draw that procedure's
//                    contradiction. The contrast pair, then one repair item at
//                    the same rung — the follow-up that isolates the
//                    misunderstanding rather than repeating the card.
//   Stage 3          not built. Repeated failure routes to Stage 1 again in M2.
//
// The contrast pair is served as the **very next card**, which is a distance of
// one — well inside the three the exit criterion allows.
//
// Stage 2 is not reachable by a rule that merely *claims* LOCATE capability:
// `judge.contrastFor` requires this bundle to have the representation, and
// `countingBoard` returns `null` when the contradiction would not actually be
// visible. Both fall back to Stage 1. A LOCATE card that shows no contradiction
// is worse than a quiet strike mark.

import { columnOpFamily } from "./curriculum.ts"
import type { AnswerValue, Exercise, MalRuleId, RepId } from "./curriculum.ts"
import { countingBoard, type CountingBoard } from "./contrast.ts"
import { entryModelFor, type EntryKey, type EntryState } from "./entry.ts"
import { judge, type Judgement } from "./judge.ts"
import {
  advanceRung,
  easier,
  repairRung,
  rungAt,
  LADDER_FORMS,
  RUN_LENGTH,
  type Rung,
} from "./ladder.ts"
import { measure } from "./metrics.ts"
import { writtenAnswer } from "./problem.ts"

/** How the card got here. Only `ladder` cards can move the ladder position. */
export type CardRole = "ladder" | "retry" | "repair"

export type Card =
  | { readonly kind: "problem"; readonly exercise: Exercise; readonly rung: number; readonly role: CardRole }
  | {
      readonly kind: "locate"
      readonly board: CountingBoard
      readonly misconception: MalRuleId
      readonly representation: RepId
      readonly rung: number
    }

export type Feedback =
  | { readonly kind: "seated" }
  /** `answer` is the correct one, written plainly. The misconception is never shown. */
  | { readonly kind: "struck"; readonly answer: string; readonly stage: "verify" | "locate" }

type Plan =
  | { readonly kind: "none" }
  | { readonly kind: "retry"; readonly rung: number }
  | {
      readonly kind: "locate"
      readonly board: CountingBoard
      readonly misconception: MalRuleId
      readonly representation: RepId
      readonly rung: number
    }

/** What happened, in card ordinals, so "within N cards" is a measurable claim. */
export type LogEntry =
  | { readonly kind: "diagnosed"; readonly at: number; readonly misconception: MalRuleId }
  | { readonly kind: "contrast"; readonly at: number; readonly misconception: MalRuleId; readonly representation: RepId }

export interface SessionState {
  readonly profileId: string
  /** Ladder position. Monotone: nothing in this module ever lowers it. */
  readonly rung: number
  readonly rungCorrect: number
  readonly seedCursor: number
  /** Cards presented this session, 1-based on the card currently on screen. */
  readonly served: number
  readonly answered: number
  readonly correct: number
  readonly card: Card
  readonly entry: EntryState | null
  readonly feedback: Feedback | null
  readonly plan: Plan
  /** Forced follow-ups. Always taken before the deck. */
  readonly queued: readonly Card[]
  /** Pre-generated ladder cards. */
  readonly deck: readonly Card[]
  readonly log: readonly LogEntry[]
  /** A designed stopping point is on offer. Never a wall — both ways out are equal. */
  readonly stopping: boolean
  /** Times `advance` had to generate inline because the deck was empty. */
  readonly starved: number
}

export interface SessionDeps {
  readonly generate: (rung: Rung, seed: number) => Exercise
}

/** Cards kept on deck. Two, per EXPERIENCE_DESIGN's `N+1` and `N+2`. */
export const DECK_DEPTH = 2

/** How long a seated answer holds before the next card presents, in ms. */
export const SEAT_HOLD_MS = 420

export function generateProblem(rung: Rung, seed: number): Exercise {
  return measure("generate", () =>
    columnOpFamily.generate({
      skillId: rung.skillId,
      level: rung.level,
      seed,
      params: rung.params,
      forms: LADDER_FORMS,
    }),
  )
}

export const defaultDeps: SessionDeps = { generate: generateProblem }

function problemCard(rung: number, seed: number, role: CardRole, deps: SessionDeps): Card {
  const exercise = deps.generate(rungAt(rung), seed)
  // Belt and braces for the app side of CG-8: a schema with no entry model is a
  // card a child cannot answer. It cannot happen with the ladder as written —
  // `ladder.test.ts` asserts it for every rung — so if it happens, something
  // upstream changed and a loud failure is the correct outcome.
  if (entryModelFor(exercise.schema) === undefined) {
    throw new RangeError(`session: no entry model for schema ${exercise.schema.kind}`)
  }
  return { kind: "problem", exercise, rung, role }
}

function freshEntry(card: Card): EntryState | null {
  if (card.kind !== "problem") return null
  const model = entryModelFor(card.exercise.schema)
  return model === undefined ? null : model.init(card.exercise.schema)
}

export interface SessionSeed {
  readonly profileId: string
  readonly rung: number
  readonly rungCorrect: number
  readonly seedCursor: number
}

export function startSession(seed: SessionSeed, deps: SessionDeps = defaultDeps): SessionState {
  const card = problemCard(seed.rung, seed.seedCursor, "ladder", deps)
  return {
    profileId: seed.profileId,
    rung: seed.rung,
    rungCorrect: seed.rungCorrect,
    seedCursor: seed.seedCursor + 1,
    served: 1,
    answered: 0,
    correct: 0,
    card,
    entry: freshEntry(card),
    feedback: null,
    plan: { kind: "none" },
    queued: [],
    deck: [],
    log: [],
    stopping: false,
    starved: 0,
  }
}

/** A key from the keypad or the hardware keyboard. Ignored once a verdict is up. */
export function pressKey(state: SessionState, key: EntryKey): SessionState {
  if (state.feedback !== null || state.entry === null || state.card.kind !== "problem") return state
  const model = entryModelFor(state.card.exercise.schema)
  if (model === undefined) return state
  const entry = model.press(state.entry, key)
  return entry === state.entry ? state : { ...state, entry }
}

/** May this state be committed? Drives the commit control's disabled attribute. */
export function committable(state: SessionState): boolean {
  if (state.feedback !== null || state.entry === null || state.card.kind !== "problem") return false
  const model = entryModelFor(state.card.exercise.schema)
  return model !== undefined && model.complete(state.entry)
}

/** The exact value currently entered, or `null`. */
export function submitted(state: SessionState): AnswerValue | null {
  if (state.entry === null || state.card.kind !== "problem") return null
  const model = entryModelFor(state.card.exercise.schema)
  return model === undefined ? null : model.value(state.entry, state.card.exercise.schema)
}

/**
 * Judge the entered answer and decide what follows.
 *
 * No generator parameter, by design: this is the whole of the answer path and it
 * is arithmetic on values that already exist. Everything that costs anything
 * happens in `prepare`, after the verdict has painted.
 */
export function commit(state: SessionState): SessionState {
  if (!committable(state) || state.card.kind !== "problem") return state
  const value = submitted(state)
  if (value === null) return state

  const exercise = state.card.exercise
  const judgement: Judgement = judge(exercise, value)
  const answered = state.answered + 1

  if (judgement.kind === "seated") {
    const moved =
      state.card.role === "ladder"
        ? advanceRung(state.rung, state.rungCorrect)
        : { rung: state.rung, rungCorrect: state.rungCorrect }
    return {
      ...state,
      rung: moved.rung,
      rungCorrect: moved.rungCorrect,
      answered,
      correct: state.correct + 1,
      feedback: { kind: "seated" },
      plan: { kind: "none" },
      stopping: stopOffered(answered, state.queued.length),
    }
  }

  const answer = writtenAnswer(exercise) ?? ""
  const diagnosis = judgement.diagnosis
  const log = [...state.log]

  if (diagnosis !== null) {
    log.push({ kind: "diagnosed", at: state.served, misconception: diagnosis.misconception })
  }

  const board =
    diagnosis !== null && diagnosis.contrast !== null ? countingBoard(exercise, value) : null

  if (diagnosis !== null && diagnosis.contrast !== null && board !== null) {
    return {
      ...state,
      answered,
      feedback: { kind: "struck", answer, stage: "locate" },
      plan: {
        kind: "locate",
        board,
        misconception: diagnosis.misconception,
        representation: diagnosis.contrast,
        rung: state.card.rung,
      },
      log,
      // A repair sequence is not a place to offer a stopping point.
      stopping: false,
    }
  }

  return {
    ...state,
    answered,
    feedback: { kind: "struck", answer, stage: "verify" },
    plan: { kind: "retry", rung: easier(state.card.rung) },
    log,
    stopping: false,
  }
}

function stopOffered(answered: number, queuedLength: number): boolean {
  return answered > 0 && answered % RUN_LENGTH === 0 && queuedLength === 0
}

/**
 * Idle work: materialise the follow-ups the verdict planned, and top the deck up.
 *
 * Runs after the verdict paints, never before it. Idempotent — calling it twice
 * generates nothing the second time — so the store can schedule it liberally.
 */
export function prepare(state: SessionState, deps: SessionDeps = defaultDeps): SessionState {
  const deckReady = state.deck.length >= DECK_DEPTH && state.deck.every((card) => card.rung === state.rung)
  if (state.plan.kind === "none" && deckReady) return state

  let next = state
  let cursor = next.seedCursor
  let queued = next.queued

  if (next.plan.kind === "retry") {
    queued = [...queued, problemCard(next.plan.rung, cursor, "retry", deps)]
    cursor += 1
    next = { ...next, plan: { kind: "none" } }
  } else if (next.plan.kind === "locate") {
    const { board, misconception, representation, rung } = next.plan
    queued = [
      ...queued,
      { kind: "locate", board, misconception, representation, rung },
      // The repair comes from the rung whose parameters *guarantee* the step,
      // not from wherever the child happened to be standing.
      problemCard(repairRung(misconception, rung), cursor, "repair", deps),
    ]
    cursor += 1
    next = { ...next, plan: { kind: "none" } }
  }

  // A correct answer can move the ladder, which strands whatever was on deck for
  // the rung below. Drop it here, during idle, so `advance` still finds a card in
  // hand rather than generating one at present-time.
  const deck = next.deck.filter((card) => card.rung === next.rung)
  while (deck.length < DECK_DEPTH) {
    deck.push(problemCard(next.rung, cursor, "ladder", deps))
    cursor += 1
  }

  return { ...next, queued, deck, seedCursor: cursor }
}

/**
 * Present the next card.
 *
 * Forced follow-ups first, then the deck. If both are empty the deck starved and
 * this generates inline — correct behaviour, and counted, because a starving deck
 * means the idle pass is not running and that is a latency bug worth failing a
 * test over.
 */
export function advance(state: SessionState, deps: SessionDeps = defaultDeps): SessionState {
  // A child who taps through before the idle pass ran must still get the
  // contrast pair. Materialising a pending plan here is what makes "within N
  // cards" a property of the machine rather than of how fast the browser felt
  // like being idle.
  const base = state.plan.kind === "none" ? state : prepare(state, deps)

  let queued = base.queued
  let deck = base.deck
  let cursor = base.seedCursor
  let starved = base.starved
  let card: Card

  const forced = queued[0]
  if (forced !== undefined) {
    card = forced
    queued = queued.slice(1)
  } else {
    const ready = deck[0]
    if (ready !== undefined && ready.rung === base.rung) {
      card = ready
      deck = deck.slice(1)
    } else {
      // Either nothing on deck, or what is on deck was generated for a rung the
      // ladder has since left. Both are inline generation; only the first is a
      // latency fault, and a rung change discards at most `DECK_DEPTH` cards.
      if (ready === undefined) starved += 1
      else deck = []
      card = problemCard(base.rung, cursor, "ladder", deps)
      cursor += 1
    }
  }

  const served = base.served + 1
  const log =
    card.kind === "locate"
      ? [
          ...base.log,
          {
            kind: "contrast" as const,
            at: served,
            misconception: card.misconception,
            representation: card.representation,
          },
        ]
      : base.log

  return {
    ...base,
    card,
    entry: freshEntry(card),
    feedback: null,
    queued,
    deck,
    seedCursor: cursor,
    served,
    starved,
    log,
    stopping: false,
  }
}

/**
 * What Enter does on the card currently on screen.
 *
 * A decision, not a rendering detail, so it lives here where it can be tested.
 * Getting it wrong is invisible to every other test in this file and to the type
 * checker: the first version committed on every card, which on the contrast pair
 * meant committing an entry that does not exist — Enter silently did nothing and
 * the card could only be left by pointing at it. Found by driving the real
 * screen, which is the only place it was ever going to show up.
 */
export function enterAction(state: SessionState): "commit" | "next" {
  return state.feedback === null && state.card.kind === "problem" ? "commit" : "next"
}

/** Milliseconds to hold a seated answer before presenting the next card. */
export function autoAdvanceMs(state: SessionState): number | null {
  if (state.feedback?.kind !== "seated" || state.stopping) return null
  return SEAT_HOLD_MS
}

/**
 * Cards between a diagnosis and the contrast pair that answered it.
 *
 * The exit criterion is a number, so it is computed from the log rather than
 * asserted from the code's shape. `null` means the diagnosis was never answered
 * with a contrast — which is the correct outcome for a misconception this build
 * has no representation for.
 */
export function contrastDistance(log: readonly LogEntry[], misconception: MalRuleId): number | null {
  const diagnosed = log.find((entry) => entry.kind === "diagnosed" && entry.misconception === misconception)
  const shown = log.find((entry) => entry.kind === "contrast" && entry.misconception === misconception)
  if (diagnosed === undefined || shown === undefined) return null
  return shown.at - diagnosed.at
}
