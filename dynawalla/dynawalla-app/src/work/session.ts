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
//                    contradiction, and this session has not already drawn it
//                    for that misconception. The contrast pair, then one repair
//                    item at the same rung — the follow-up that isolates the
//                    misunderstanding rather than repeating the card.
//   Stage 3          not built. Repeated failure routes to Stage 1 again in M2,
//                    and that is also the floor under the repair loop: the same
//                    board is never served twice in one session, because a child
//                    who did not read it the first time is not helped by a third.
//
// The contrast pair is served as the **very next card**, which is a distance of
// one — well inside the three the exit criterion allows.
//
// Stage 2 is not reachable by a rule that merely *claims* LOCATE capability:
// `judge.contrastFor` requires this bundle to have the representation, and
// `countingBoard` returns `null` for every shape whose two plates cannot be drawn
// as one honest comparison. Both fall back to Stage 1. A LOCATE card that shows
// no contradiction — or shows a second, invented one — is worse than a quiet
// strike mark.

import { columnOpFamily, createRng, skillId } from "./curriculum.ts"
import type { AnswerValue, Exercise, MalRuleId, RepId } from "./curriculum.ts"
import { paramsFor } from "./catalog.ts"
import { countingBoard, type CountingBoard } from "./contrast.ts"
import { entryModelFor, type EntryKey, type EntryState } from "./entry.ts"
import { judge, type Judgement } from "./judge.ts"
import { LADDER_FORMS, RUN_LENGTH, SKILL_SUBTRACT_ACROSS_ZERO } from "./ladder.ts"
import { measure } from "./metrics.ts"
import { adaptivePlanner, type LearnerState, type Planner, type PlannedCard, type SessionContext } from "./plan.ts"
import { BATCH_SIZE, FOLLOW_UP_DRAWS, sessionFatigue, withCursor, withFatigue } from "../../../engine/src/index.ts"
import { writtenAnswer } from "./problem.ts"

/**
 * How the card got here.
 *
 * `ladder` is now "the scheduler chose it" — the name is kept because it is what
 * the reaction layer and the character read, and because a card the child was
 * *given* and a card they were *sent back to* are still the distinction that
 * matters to them.
 */
export type CardRole = "ladder" | "retry" | "repair"

export type Card =
  | {
      readonly kind: "problem"
      readonly exercise: Exercise
      readonly plan: PlannedCard
      readonly role: CardRole
    }
  | {
      readonly kind: "locate"
      readonly board: CountingBoard
      readonly misconception: MalRuleId
      readonly representation: RepId
      readonly plan: PlannedCard
    }

export type Feedback =
  | { readonly kind: "seated" }
  /** `answer` is the correct one, written plainly. The misconception is never shown. */
  | { readonly kind: "struck"; readonly answer: string; readonly stage: "verify" | "locate" }

type Plan =
  | { readonly kind: "none" }
  | { readonly kind: "retry"; readonly card: PlannedCard }
  | {
      readonly kind: "locate"
      readonly board: CountingBoard
      readonly misconception: MalRuleId
      readonly representation: RepId
      readonly card: PlannedCard
    }

/** What happened, in card ordinals, so "within N cards" is a measurable claim. */
export type LogEntry =
  | { readonly kind: "diagnosed"; readonly at: number; readonly misconception: MalRuleId }
  | { readonly kind: "contrast"; readonly at: number; readonly misconception: MalRuleId; readonly representation: RepId }

export interface SessionState {
  readonly profileId: string
  /** The persisted learner model. Every answer moves it; nothing else does. */
  readonly learner: LearnerState
  /** This session's working memory: recent items, benched skills, fatigue. */
  readonly context: SessionContext
  /** Pools of the cards actually served, for the repair-density cap (`A-12`). */
  readonly servedPools: readonly string[]
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
  /**
   * The unserved tail of the batch the engine planned, in **slot order**.
   *
   * Held, not re-planned. The batch is the unit the engine allocates in: its slot
   * order is where the pool quota lives — the debut, the capped repair, the
   * fluency burst, the review card — and all of it sits behind the leading
   * FRONTIER slots. A loop that re-planned whenever the deck dropped below two
   * therefore served slots 0–1 of a fresh plan for ever, and the child received a
   * FRONTIER card every time. `DECK_DEPTH` is the generation lookahead; this is
   * the planning horizon, and they are not the same number.
   */
  readonly batch: readonly PlannedCard[]
  readonly log: readonly LogEntry[]
  /** A designed stopping point is on offer. Never a wall — both ways out are equal. */
  readonly stopping: boolean
  /** Times `advance` had to generate inline because the deck was empty. */
  readonly starved: number
}

export interface SessionDeps {
  readonly generate: (card: PlannedCard) => Exercise
  readonly planner: Planner
}

/** Cards kept on deck. Two, per EXPERIENCE_DESIGN's `N+1` and `N+2`. */
export const DECK_DEPTH = 2

/** How long a seated answer holds before the next card presents, in ms. */
export const SEAT_HOLD_MS = 420

export function generateProblem(card: PlannedCard): Exercise {
  return measure("generate", () =>
    columnOpFamily.generate({
      // The engine's ids are opaque strings — it does not import the curriculum
      // — so the brand is reapplied at the one boundary that needs it.
      skillId: skillId(card.skillId),
      level: card.level,
      seed: card.seed,
      params: paramsFor(skillId(card.skillId), card.level),
      forms: LADDER_FORMS,
    }),
  )
}

export const defaultDeps: SessionDeps = { generate: generateProblem, planner: adaptivePlanner }

function problemCard(plan: PlannedCard, role: CardRole, deps: SessionDeps): Card {
  const exercise = deps.generate(plan)
  // Belt and braces for the app side of CG-8: a schema with no entry model is a
  // card a child cannot answer. `ladder.test.ts` asserts it for every (skill,
  // level) the slice can serve, so if it happens here, something upstream
  // changed and a loud failure is the correct outcome.
  if (entryModelFor(exercise.schema) === undefined) {
    throw new RangeError(`session: no entry model for schema ${exercise.schema.kind}`)
  }
  return { kind: "problem", exercise, plan, role }
}

function freshEntry(card: Card): EntryState | null {
  if (card.kind !== "problem") return null
  const model = entryModelFor(card.exercise.schema)
  return model === undefined ? null : model.init(card.exercise.schema)
}

export interface SessionSeed {
  readonly profileId: string
  readonly learner: LearnerState
  readonly seedCursor: number
  /** Whole days since an arbitrary epoch. The engine never reads a clock. */
  readonly day: number
}

export function startSession(seed: SessionSeed, deps: SessionDeps = defaultDeps): SessionState {
  const learner = { ...seed.learner, today: seed.day }
  const opened = deps.planner.session(seed.seedCursor, seed.day, learner)
  const planned = deps.planner.next(learner, opened)
  const first = planned.cards[0]
  if (first === undefined) throw new RangeError("session: the scheduler produced no first card")
  const card = problemCard(first, "ladder", deps)
  return {
    profileId: seed.profileId,
    learner,
    // The cursor the plan consumed, written back. Without it every card of a
    // class in this session is generated from the same seed — the same problem,
    // over and over, while the no-repeat window sees nothing wrong.
    context: withCursor(opened, planned.cursor),
    servedPools: [first.pool],
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
    // The rest of the batch, in the order the engine allocated it.
    batch: planned.cards.slice(1),
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
 * Judge the entered answer, move the learner model, and decide what follows.
 *
 * **No generator, by design**, and the learner-model update does not change that:
 * `applyResult` is arithmetic on values that already exist, budgeted by gate EG-4
 * at p99 under 1 ms, and it produces no exercise. Everything that costs anything
 * — planning the next batch, generating its items — still happens in `prepare`,
 * after the verdict has painted. What proves it is not the signature but
 * `session.test.ts`'s generator-call count, which is a measurement rather than a
 * shape; `deps` is taken here so a test can substitute the model as well as pin
 * the selection.
 *
 * `latencyMs` and `minutesElapsed` arrive from the caller rather than from a
 * clock in here: this function is pure, and the store owns the wall clock. The
 * second of them is what the fatigue detector needs and what it never had — it
 * was called from the simulation harness and nowhere else, so `context.fatigued`
 * was permanently false in the shipped loop and the halved evidence weight, the
 * frozen mastery level, the 0.90 hold and the suppression of NEW and REPAIR were
 * all dead.
 */
export function commit(
  state: SessionState,
  latencyMs = 0,
  minutesElapsed = 0,
  deps: SessionDeps = defaultDeps,
): SessionState {
  if (!committable(state) || state.card.kind !== "problem") return state
  const value = submitted(state)
  if (value === null) return state

  const exercise = state.card.exercise
  const judgement: Judgement = judge(exercise, value)
  const answered = state.answered + 1
  const correct = judgement.kind === "seated"
  const diagnosis = judgement.kind === "struck" ? judgement.diagnosis : null

  const applied = deps.planner.apply(
    state.learner,
    state.context,
    state.card.plan,
    {
      correct,
      latencyMs,
      // Revisions are not observable yet: the keypad has no undo, so an answer is
      // committed once. When it gains one, this is where the cleanest slip signal
      // there is arrives — `revisions > 0` then correct is a slip and never a bug.
      revisions: 0,
      ...(diagnosis === null ? {} : { misconception: diagnosis.misconception }),
    },
    // The whole unserved remainder — what is generated *and* what is still only
    // planned. `replanReasons` decides whether the tail may still be served, and
    // a tail that is invisible to it is a tail it cannot discard.
    [...state.deck.map((card) => card.plan), ...state.batch],
  )

  const replanned = applied.replan.length > 0
  const moved = {
    learner: applied.learner,
    // Fatigue is folded in here because this is where the outcome and the latency
    // both are. It is a fact about the session, so it rides on the context and
    // the *next* plan reads it: no NEW skill, no repair, half evidence weight.
    context: withFatigue(
      applied.context,
      sessionFatigue(applied.learner, applied.context, { latencyMs, minutesElapsed }),
    ),
    servedPools: state.servedPools,
    // The engine re-plans on an invariant trip rather than serving the batch to
    // completion: a correction that lands one batch late reads to the child as
    // the app randomly getting easy and then hard. Both the generated cards and
    // the planned tail go — leaving the tail is the same stale batch by another
    // name.
    deck: replanned ? [] : state.deck,
    batch: replanned ? [] : state.batch,
  }

  if (correct) {
    return {
      ...state,
      ...moved,
      answered,
      correct: state.correct + 1,
      feedback: { kind: "seated" },
      plan: { kind: "none" },
      stopping: stopOffered(answered, state.queued.length > 0),
    }
  }

  const answer = writtenAnswer(exercise) ?? ""
  const log = [...state.log]

  if (diagnosis !== null) {
    log.push({ kind: "diagnosed", at: state.served, misconception: diagnosis.misconception })
  }

  // The floor under the repair loop. The first cut served the identical board
  // again on every repeat, with the stopping point suppressed throughout, so the
  // way out was withheld from exactly the run that needed it. ADAPTIVE_LEARNING
  // routes repeated failure to Stage 3 RECONSTRUCT, which M2 has not built; its
  // stand-in is Stage 1. One contrast pair per misconception per session.
  const alreadyExplained =
    diagnosis !== null &&
    state.log.some(
      (entry) => entry.kind === "contrast" && entry.misconception === diagnosis.misconception,
    )

  const board =
    diagnosis !== null && diagnosis.contrast !== null && !alreadyExplained
      ? countingBoard(exercise, value)
      : null

  if (diagnosis !== null && diagnosis.contrast !== null && board !== null) {
    return {
      ...state,
      ...moved,
      answered,
      feedback: { kind: "struck", answer, stage: "locate" },
      plan: {
        kind: "locate",
        board,
        misconception: diagnosis.misconception,
        representation: diagnosis.contrast,
        card: state.card.plan,
      },
      log,
      // The one suppression: never between a diagnosis and the explanation it
      // earned. The contrast pair is the next card; putting "Done" in front of
      // it is the app abandoning its own answer.
      stopping: false,
    }
  }

  return {
    ...state,
    ...moved,
    answered,
    feedback: { kind: "struck", answer, stage: "verify" },
    plan: { kind: "retry", card: state.card.plan },
    log,
    stopping: stopOffered(answered, state.queued.length > 0),
  }
}

/**
 * Is a designed stopping point on offer? A function of cards **done**, not cards
 * done right. Computed only on the seated branch, answering card 12 wrong pushed
 * the offer to card 24 and a bad run suppressed it entirely — withheld from the
 * child who most needs it, which inverts ADR-0009. `blocked` is the mid-sequence
 * suppression: a follow-up in hand, or a contrast pair about to be served.
 */
function stopOffered(answered: number, blocked: boolean): boolean {
  return answered > 0 && answered % RUN_LENGTH === 0 && !blocked
}

/**
 * Idle work: materialise the follow-ups the verdict planned, and top the deck up.
 *
 * Runs after the verdict paints, never before it. Idempotent — calling it twice
 * generates nothing the second time — so the store can schedule it liberally.
 */
export function prepare(state: SessionState, deps: SessionDeps = defaultDeps): SessionState {
  if (state.plan.kind === "none" && state.deck.length >= DECK_DEPTH) return state

  let next = state
  let cursor = next.seedCursor
  let queued = next.queued
  let context = next.context

  if (next.plan.kind === "retry") {
    // `b = θ_s − 0.8` or the confidence intent's difficulty, whichever is easier.
    // The engine decides, because "one rung easier" is a statement about the
    // curriculum and this is a statement about this child.
    const retry = deps.planner.retry(next.learner, context, next.plan.card)
    if (retry !== null) {
      queued = [...queued, problemCard(retry, "retry", deps)]
      cursor += 1
      // The draw the retry consumed. Without it a second retry in the same
      // session is generated from the same seed and is the identical problem.
      context = withCursor(context, context.rngCursor + FOLLOW_UP_DRAWS)
    }
    next = { ...next, plan: { kind: "none" } }
  } else if (next.plan.kind === "locate") {
    const { board, misconception, representation, card } = next.plan
    // The repair comes from the level whose parameters *guarantee* the step, not
    // from wherever the child happened to be standing — and only while repair is
    // under its quarter-of-a-batch cap (`A-12`).
    const repair = deps.planner.repair(next.learner, context, card, misconception, next.servedPools)
    queued = [
      ...queued,
      { kind: "locate", board, misconception, representation, plan: card },
      ...(repair === null ? [] : [problemCard(repair, "repair", deps)]),
    ]
    if (repair !== null) {
      cursor += 1
      context = withCursor(context, context.rngCursor + FOLLOW_UP_DRAWS)
    }
    next = { ...next, plan: { kind: "none" } }
  }

  // Generate the next cards of the batch the engine planned, in slot order. A
  // new batch is planned only when the held one is exhausted — planning here, in
  // idle, never on the answer path.
  const deck = [...next.deck]
  let batch = next.batch
  let plans = 0
  while (deck.length < DECK_DEPTH) {
    if (batch.length === 0) {
      if (plans >= MAX_PLANS_PER_PASS) break
      plans += 1
      const planned = deps.planner.next(next.learner, context)
      if (planned.cards.length === 0) break
      context = withCursor(context, planned.cursor)
      batch = planned.cards
    }
    const head = batch[0]
    batch = batch.slice(1)
    if (head === undefined) break
    if (deck.some((card) => card.plan.itemKey === head.itemKey)) continue
    deck.push(problemCard(head, "ladder", deps))
    cursor += 1
  }

  return { ...next, context, queued, deck, batch, seedCursor: cursor }
}

/**
 * Batches planned in one idle pass, at most.
 *
 * The loop is bounded because it can otherwise spin: a batch every one of whose
 * cards is already on the deck leaves the deck short, and asking again produces
 * the same batch. A short deck is visible — `advance` counts the starve — and a
 * hang is not.
 */
const MAX_PLANS_PER_PASS = 2

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
  let batch = base.batch
  let context = base.context
  let cursor = base.seedCursor
  let starved = base.starved
  let card: Card

  const forced = queued[0]
  if (forced !== undefined) {
    card = forced
    queued = queued.slice(1)
  } else {
    // Drop any card the plan has outlived. A batch is eight cards old by the time
    // its tail is served and the sequence rules do not stop at a batch boundary,
    // so the engine is asked whether each card may still be served.
    while (deck.length > 0) {
      const head = deck[0]
      if (head === undefined) break
      if (deps.planner.admissible(base.learner, context, head.plan, base.servedPools)) break
      deck = deck.slice(1)
    }
    const ready = deck[0]
    if (ready !== undefined) {
      card = ready
      deck = deck.slice(1)
    } else {
      // Nothing servable on deck. Generate inline — correct behaviour, and
      // counted, because a starving deck means the idle pass is not running and
      // that is a latency bug worth failing a test over.
      //
      // From the **held batch** first. Planning a fresh one here would hand back
      // slot 0 of a new allocation, which is how the loop came to serve nothing
      // but the leading FRONTIER slots in the first place.
      starved += 1
      const taken = takeFromBatch(base, context, batch, deps)
      context = taken.context
      batch = taken.batch
      if (taken.card === null) {
        // The scheduler has nothing left to serve — every reachable skill is
        // benched, which after three failures each is a session that has gone
        // badly enough to stop. The designed stopping point is offered and the
        // card on screen stays where it is. Throwing here would end a bad session
        // with a crash, which is the worst possible reading of "no loss".
        return { ...base, context, batch, stopping: true }
      }
      card = problemCard(taken.card, "ladder", deps)
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
    context,
    queued,
    deck,
    batch,
    seedCursor: cursor,
    served,
    starved,
    log,
    // The pool of every card actually served, for the repair-density cap. A
    // contrast pair is not a card the model scheduled, so it does not count.
    servedPools:
      card.kind === "problem" ? [...base.servedPools, card.plan.pool].slice(-BATCH_SIZE) : base.servedPools,
    stopping: false,
  }
}

/**
 * The next servable card of the held batch, planning a fresh one only when it is
 * exhausted.
 *
 * Cards the sequence rules have outlived are preferred against here as they are
 * on the deck path: this is a serve-time decision and the plan is eight cards old
 * by its tail.
 *
 * **The first card skipped comes back as the fallback**, and that is deliberate.
 * The rules can conflict to the point of admitting nothing: the M2 slice has
 * three skills, a child who has just had a hard card has `lastPHat` under the
 * frustration floor, and every level of every skill they can reach predicts below
 * it too — so "never two consecutive items below `pTarget − 0.20`" excludes the
 * whole catalog. `select.ts` states the ordering for exactly this case: "serving
 * nothing costs them the session, and is worse than all three". Dropping the
 * fallback ended the session on a dead card and offered the way out, which reads
 * to a child as the app giving up on them.
 */
function takeFromBatch(
  state: SessionState,
  context: SessionContext,
  batch: readonly PlannedCard[],
  deps: SessionDeps,
): { card: PlannedCard | null; batch: readonly PlannedCard[]; context: SessionContext } {
  let held = batch
  let session = context
  let plans = 0
  let fallback: PlannedCard | null = null
  for (;;) {
    if (held.length === 0) {
      if (plans >= MAX_PLANS_PER_PASS) break
      plans += 1
      const planned = deps.planner.next(state.learner, session)
      if (planned.cards.length === 0) break
      session = withCursor(session, planned.cursor)
      held = planned.cards
    }
    const head = held[0]
    held = held.slice(1)
    if (head === undefined) break
    if (deps.planner.admissible(state.learner, session, head, state.servedPools)) {
      return { card: head, batch: held, context: session }
    }
    fallback ??= head
  }
  return { card: fallback, batch: held, context: session }
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

/**
 * Milliseconds to hold a seated answer before presenting the next card.
 *
 * One number for every tier, on purpose. The hold is how long the *work
 * surface* pauses, and EXPERIENCE_DESIGN is explicit that it does not wait for
 * the world: "the next problem presents concurrently with the reaction tail".
 * Scaling this to the reaction's budget would put a 1.8-second dead stop in the
 * loop at every twentieth answer, which is the same mistake as truncating the
 * reaction, made from the other end. What changes instead is that the
 * auto-advance no longer *settles* the reaction — see `store.ts`'s
 * `autoAdvance`.
 */
export function autoAdvanceMs(state: SessionState): number | null {
  if (state.feedback?.kind !== "seated" || state.stopping) return null
  return SEAT_HOLD_MS
}

/**
 * Is this card the child's first arrival at the across-zero skill?
 *
 * Only a scheduled card can be one. The repair item for `borrow-across-zero`
 * comes from that same skill by construction — it is the level whose parameters
 * guarantee the step — so a rule that watched the skill alone announced the
 * arrival the first time a child got one *wrong* somewhere easier and was handed
 * the repair item. They had not arrived at all.
 */
export function arrivesAcrossZero(card: Card): boolean {
  return card.kind === "problem" && card.role === "ladder" && card.plan.skillId === SKILL_SUBTRACT_ACROSS_ZERO
}

/**
 * The session's own stream of [0, 1) draws, for everything that is a choice
 * rather than a computation: which effect the stage plays, which phrasing the
 * Dynawalla reaches for.
 *
 * Seeded from the position the session resumes at, so a session replays its
 * reactions and its lines exactly — which is what the committed screenshot set
 * (`Q-06`, M6) needs and what `Math.random` at two call sites made impossible.
 * Offset off the exercise stream so the two do not move in step.
 */
export const SEQUENCE_OFFSET = 0x9e3779b9

export function sequenceFrom(cursor: number): () => number {
  const seed = (Math.max(0, Math.floor(cursor)) + SEQUENCE_OFFSET) >>> 0
  const rng = createRng(seed)
  return () => rng.nextUint32() / 0x1_0000_0000
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
