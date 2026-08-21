// The adapter every arcade pack mounts against: a synchronous `Host` on the
// outside, the asynchronous pack SDK on the inside.
//
// **Why an adapter and not a rewrite.** FUSE and SIEGE both want a question the
// instant a tile spawns or a slab lands — inside a `requestAnimationFrame`
// loop, where there is no `await`. The SDK is a `MessagePort`, so every method
// on it is a promise. Bridging that in each game would mean two copies of a
// prefetch buffer written by two people at two times, and the game code would
// grow a loading state in its hot path.
//
// So this keeps a stocked pool, filled ahead of demand and topped up in the
// background, and hands it out synchronously. The games' own `Host` type is
// untouched, which is the point: the swap from the stub host to the real one is
// a change of two lines in an entry file and nothing in the game.
//
// **Why `items.reveal` is declared.** Both games have to *place the answer*
// before the child reaches it — SIEGE puts it on one of three slabs, FUSE makes
// a chip's face an expression worth exactly that chip's value. That is the
// sanctioned use of the capability, and it changes nothing about who judges: an
// attempt is still reported through `items.answer`, still recorded before the
// canonical value comes back, and the host's verdict is the one that counts.
// This module never compares a response to an answer.
//
// **Reporting is once per item.** An id that has already been reported, or that
// this module did not serve, is dropped. A pack that double-reports a chip
// would otherwise inflate a child's record, and the record only ever rises.
//
// **A question can also be closed unanswered.** `skip` is the other ending, and
// it is not a quiet synonym for a wrong answer — see the method for what it
// costs and what it deliberately does not touch.
//
// ── The difficulty wire ──────────────────────────────────────────────────────
//
// This module used to be a one-way pipe. `next()` took no arguments, so the ten
// games that had been passing `{ difficulty }` for months were passing it into
// a function that ignored it; `Question.difficulty` was `item.level / 8`, a
// read-back of a number that is not a difficulty; and `report` ended in a
// literal `void correct`, throwing away the one signal twenty-five of the
// twenty-seven games already have. Nothing a game knew about the child could
// reach the thing that chose the next question.
//
// It now carries a request in both directions, and there are three parts to
// making that actually change what a child sees:
//
//   1. `next({ difficulty })` reaches `items.next` as a 0..1 position on the
//      host's whole ladder, and the item that comes back reports the position
//      it was really drawn from — so a clamped request is visible rather than
//      silent.
//   2. The prefetch pool is *searched* rather than shifted, so a request is
//      answered from whatever is already stocked.
//   3. The pool is *flushed* when the request moves, because a pool of
//      thirty-two to sixty-four questions is otherwise a thirty-two question
//      delay between a decision and its effect. Measured: 34 questions without,
//      2 with. (The 34 was also half caused by the batched refill described
//      below; with the pool topped up one question at a time the *search* alone
//      lands a change in two, and the flush's remaining job is to stop the pool
//      accumulating sixty-four questions the child will never be served.)
//
// ── The pool also goes stale when the HOST moves, not only when the game asks ──
//
// Part 3 above was written for a game that drives its own difficulty, and it
// checked `target === null` and returned. Every game that does *not* drive one —
// TRUE DRAW calls `host.next()` with no arguments at all — therefore had no
// flush of any kind, and the delay was the full depth of the pool, permanently.
//
// What that cost, measured on the shipped code: `warm()` awaits `POOL_FLOOR`
// questions before the first frame and the first `take()` tops the pool up to
// `POOL_TARGET`, so **the first sixty-four questions of a session are all drawn
// from wherever the host's ladder stood before the child answered anything** —
// rung zero. The founder's report is both halves of this one bug:
//
//   "I've gotten 10 correct in a row fast and I still get 2+0=1 ... 25 in a row
//    max speed and I get 2+0=1"          — the queue in front of him was 64 deep
//   "it's way too quick to go from 0+1 to 1269/9"
//                        — and when it finally turned over, it turned over whole
//
// So the aim the pool is stocked and searched against is now `target ?? fresh`,
// where `fresh` is the ordinate of the most recent item the host actually handed
// over. A game that drives difficulty is unaffected — its own request still wins
// — and a game that drives nothing now discards a pool the ladder has walked
// away from instead of feeding a child their own past.
//
// What this module does NOT do is decide anything. It does not read the
// outcomes it records, it has no opinion about whether a child is struggling,
// and it never chooses a difficulty of its own. That is a controller, it lives
// in `packs/shared/game-pacing/`, and it is somebody else's file. This is the
// wire it will drive.
//
// ── The other axis: what KIND of maths, not how hard ─────────────────────────
//
// Difficulty was only half the request. Every pack declares `covers.skills` in
// its `pack.json`, the SDK's `ItemRequest` has carried a `skillId` since it was
// written, and the host's `items.next` reads one — and this module never sent
// it. A pack could not restrict the *kind* of maths it was served at all, which
// is why TREBUCHET — a declared add/subtract game that stands a keep at the
// answer in metres on a 122-metre field — was handed
// `dw.mul.scale.times-power-of-ten` and asked a child to wind the arm to
// 4,510,000 metres. It had grown a whole search phase looking for a rung it
// could place, sweeping an axis that cannot express the thing it needed: the
// division rungs return single-digit quotients and sit *above* placeable
// multiplication rungs, so "how hard" and "what kind" are genuinely
// independent orderings and no amount of `maxDifficulty` separates them.
//
// **The restriction is a DOMAIN, not a skill set, and that is measured.** The
// wire names one skill, and one skill is always narrower than what a pack
// covers, so the granularity had to be chosen against the shipped curriculum
// (66 rungs over 20 skills) and the 27 shipped `pack.json` files:
//
//   * *Exactly the declared skills*: 21 of the 27 packs declare only column and
//     regrouping skills, whose easiest rung is at ordinate 0.28 — so honouring
//     the literal declaration would deny a six-year-old in a game that
//     advertises grade 1 every single-digit fact the curriculum has. Four packs
//     (arena, balance, claim, pulse) declare *nothing* the shipped ladder can
//     generate and would be starved outright.
//   * *The domain* — the first two segments, `dw.add` — keeps all 36 add and
//     subtract rungs including the whole bottom of the ladder, and excludes the
//     multiplication and division rungs the add packs never asked for. Five
//     packs (guilty, horde, merge-idle, mosaic, serpent) declare all three
//     domains the ladder has and are therefore unaffected, bit for bit.
//
// So the domain it is: `covers.skills` is treated as evidence of which domains a
// pack works in, which is what it is honest about, and not as a whitelist of
// rungs, which it demonstrably is not.
//
// **Nothing is ever refused into starvation.** A question the pack does not
// declare is not dropped; it is held, and the host is asked *once* for a
// declared skill instead. If that trade cannot be made — the declared skill is
// not in this host's curriculum, or pinning it would break a ceiling the game
// set — the held question is served anyway and the reason is said out loud. And
// because a pack whose whole declaration is missing from the curriculum would
// otherwise pay for that trade on every question forever, the restriction
// SURRENDERS after `SURRENDER_AFTER` consecutive failures: it turns itself off
// for the rest of the session, loudly, and the pack behaves exactly as it did
// before this paragraph existed.
//
// **Pinning a skill is a blunt instrument and is used as little as possible.**
// Measured against the shipped `items.ts`: a request naming a `skillId` returns
// the *first* rung of that skill on the ladder and ignores `difficulty`
// entirely (asking for 0.9 with a skill named returns 0.28), and it ignores
// `maxDifficulty` too — a pin can be served *above* a stated ceiling, which
// four shipped packs rely on being impossible. That is why the pin is a rescue
// and not the request: an in-domain question is accepted exactly as it arrives,
// with the host's own spread and its own idea of where the child is, and only a
// question from a domain the pack does not work in is traded for one.

import type {
  Capability,
  HostClient,
  Item,
  ItemRequest,
  TransitionKind,
} from "../../sdk/src/index.ts"
import { setHostInsets } from "../game-chrome/insets.ts"
import { setHostSound } from "../game-audio/index.ts"
import { setHostSoundscape } from "../game-soundscape/index.ts"
import { MAX_REQUESTS_PER_SECOND, connect } from "../../sdk/src/index.ts"

/** The shape both games declare locally. Kept structurally identical. */
export type Question = {
  id: string
  /** "15 − 8" */
  prompt: string
  /** "7" — exact, canonical, and never computed here. */
  answer: string
  distractors: string[]
  domain: string
  /**
   * Where this question sits on the host's whole ladder: 0 is the easiest
   * content the host has and 1 the hardest.
   *
   * This used to be `item.level / 8`, which was not that. `level` is the level
   * *within a skill* — 0..3 on the shipped graph — so the hardest question in
   * the product read 0.375 and the easiest read 0, and a game branching on the
   * value (colossus, siege) could not tell the top of the ladder from the
   * middle of it. The host now sends the ladder ordinate itself.
   */
  difficulty: number
}

/**
 * What a game is asking for, when it asks for anything.
 *
 * Every field is optional and a game that passes nothing gets exactly the
 * stream it got before this type existed. That is not a courtesy: twenty-seven
 * packs ship against this contract and seventeen of them already *declare*
 * `next(opts?: { domain?: string; difficulty?: number })` locally, so the shape
 * here is the one their call sites already produce.
 */
export type DifficultyRequest = {
  /** Cosmetic label for this one question. Overrides the mount-wide domain. */
  readonly domain?: string
  /**
   * How hard the game wants the next question. See `toUnit` for the scale —
   * both of the ones already in the tree are read.
   */
  readonly difficulty?: number
  /**
   * A ceiling on the same scale. The stream never goes above it, and it stands
   * until the game names a different one.
   */
  readonly maxDifficulty?: number
  /**
   * A floor on the same scale. The stream never goes below it, and it stands
   * until the game names a different one.
   *
   * The other half of `maxDifficulty`. Absolute on the host's side — it is a
   * pack saying what it can physically draw, so it is honoured above the host's
   * own band as well as below it, which is exactly what `difficulty` is not.
   * See `setMinDifficulty` for when a game is entitled to one.
   */
  readonly minDifficulty?: number
}

/**
 * A game's difficulty number, on whichever of the two scales it speaks, as a
 * 0..1 position on the host's ladder.
 *
 * **Why there are two scales.** They are both already in production and neither
 * can be taken away. Six games (arena, horde, merge-idle, rhythm, slice, stack)
 * and beam send an integer ladder index where 1 is the easiest question the
 * game will ask for and 10 the hardest. polarity, trebuchet and siege send a
 * 0..1 fraction. runner sends an unrounded 0..12. A single field cannot be read
 * two ways by value alone, so the rule is stated here and tested rather than
 * left to whoever reads the call site next:
 *
 *     value < 1   →  a fraction, used as is
 *     value >= 1  →  a ladder index, `(value - 1) / 9`
 *
 * which makes exactly one value ambiguous — `1`, the bottom of one scale and
 * the top of the other. It is read as the *bottom*, because that is what five
 * of the six ladder games send on their opening question, and serving the
 * hardest content in the product to a child who has just started is the failure
 * this whole wire exists to prevent. A caller that needs to be exact at the top
 * should speak the ladder scale, where every 0..1 position has an unambiguous
 * spelling: `1 + unit * 9`.
 *
 * Out of range on either side is clamped, never rejected — but the clamp is
 * announced by the caller of this function, because a difficulty of 40 is a
 * bug in a game and a silent clamp is how it stays one. `null` means "that was
 * not a number", which is also announced.
 */
export function toUnit(value: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 1) return Math.max(0, value)
  return Math.min(1, (value - 1) / 9)
}

/**
 * One answered question, with both verdicts on it.
 *
 * `report` used to end in a literal `void correct`: the game handed over what
 * it believed and this module dropped it on the floor. Twenty-five of the
 * twenty-seven games know locally whether the child was right, and that is the
 * one signal an adaptive difficulty controller needs, so it is kept.
 *
 * Both verdicts, not one. `correct` is the host's — it is the record, it is
 * what a parent sees, and it is the only one that counts. `claimed` is the
 * game's, which is what a controller can act on *immediately*, before the round
 * trip that produces the other one has returned.
 */
export type Outcome = {
  readonly questionId: string
  /** The ladder position of the question that was answered, 0..1. */
  readonly difficulty: number
  /** The skill the host drew it from. */
  readonly skillId: string
  /** What the game believed at the moment the child answered. */
  readonly claimed: boolean
  /** What the host decided. The record. */
  readonly correct: boolean
  /**
   * False when the host could not be reached and `correct` is the game's own
   * belief standing in for a verdict that never came. A controller that wants
   * to weigh a judged outcome more heavily has the flag to do it with.
   */
  readonly judged: boolean
  readonly ms: number
}

export type HapticKind = "light" | "medium" | "heavy" | "success" | "failure"

export type GameHost = {
  /**
   * The next question, synchronously.
   *
   * With no argument this is what it always was: the front of the prefetch
   * pool. With a `difficulty` it is the pooled question closest to what was
   * asked for, and the host is asked to generate at that difficulty from here
   * on — see `flush` for what happens to the questions already in flight.
   */
  next(request?: DifficultyRequest): Question
  report(r: { questionId: string; correct: boolean; ms: number; answered: string }): void
  /**
   * The child did not answer this one. Close it and record nothing.
   *
   * **Why it has to be here.** `report` is the only other ending, and it
   * forwards `answered` to `items.answer` — so a timeout reported as
   * `{ correct: false, answered: "" }` is not filed as "unanswered", it is
   * filed as a MISS: the empty string does not parse, the learner model takes
   * a wrong attempt, and the ladder steps down. beam, rhythm, horde, pulse,
   * truedraw and trebuchet all did exactly that until this week. They now say
   * nothing instead, which is honest but leaves the item open at both ends.
   * This is the third option, and the only one that is both honest and closed.
   *
   * **What it does.** Drops the pack-side record of the question — which is
   * what stops a later `report` on the same id from reaching the host at all —
   * and calls the SDK's `items.skip`, which marks the item closed in the
   * host's ledger so that nothing arriving afterwards can be recorded against
   * it either.
   *
   * **What it deliberately does not do.** It does not produce an `Outcome`, so
   * a pacing controller reading `recentOutcomes` never sees a skip as a wrong
   * answer — it sees an absence, which is what it is. It does not advance the
   * session progress fraction, because that counts answered questions. It does
   * not move the difficulty, request one, or flush: a child who ran out of time
   * has told us nothing about what they know, and a module that guessed from
   * that would be deciding something, which this module does not do.
   *
   * **It does not put the question back.** A skipped question was already taken
   * out of the prefetch pool when it was handed over and is not returned to it,
   * so the next `next()` is a new question. Being handed the same sum again the
   * instant the timer runs out reads as nagging, and a child who was still
   * carrying the hundreds column does not need to be asked twice.
   *
   * Once per item, like `report`: an id that was never served, or that has
   * already been answered or skipped, is dropped. Skipping is final — an answer
   * reported after a skip is not recorded, and neither is a skip after an
   * answer.
   */
  skip(questionId: string): void
  haptic(kind: HapticKind): void
  prefersReducedMotion(): boolean
  /** Optional host extension FUSE feature-detects: bias the stream by value. */
  focus(spec: { key: number; wanted: number[] }): void
  /**
   * Throw away the prefetched questions that no longer match what the game is
   * asking for, and start refilling at the current difficulty.
   *
   * **Why this has to exist.** The pool holds up to sixty-four questions and
   * refills at thirty-two. A difficulty change with no flush therefore lands
   * thirty-two questions later — minutes of wall clock — which makes "fall fast
   * on a wrong answer" unachievable through this pipe no matter what the wire
   * carries. Measured on the fake host in `index.test.ts`: 33 questions without
   * a flush, 2 with one.
   *
   * **What it costs.** A refill stall, if it emptied the pool — and an empty
   * pool is not a pause, it is a question with no id, whose answer is dropped
   * because there is nothing to report it against. So it never empties: the
   * questions closest to the new difficulty are kept as a reserve and the rest
   * go. The reserve is what the game plays while the refill lands, which is why
   * the change takes two questions rather than one.
   *
   * A game does not normally need to call this. `next` flushes by itself when
   * the request moves far enough, which is what makes the eight games already
   * passing `{ difficulty }` adaptive without changing a line.
   */
  flush(): void
  /**
   * A standing difficulty, set without taking a question. trebuchet has been
   * feature-detecting this since it shipped.
   */
  setDifficulty(difficulty: number): void
  /**
   * The easiest question this game can physically put on the screen, as a
   * standing statement, or `null` to withdraw it.
   *
   * **Not a preference, and not `raiseFloor`.** `raiseFloor` is a game saying
   * "a wave I have reached justifies a floor under the maths" — it moves this
   * module's own `target`, which the host is free to clamp back into its band.
   * This one goes on the wire as `minDifficulty` and the host honours it
   * absolutely, because the alternative is handing a game a question it cannot
   * render. That is the same promise `maxDifficulty` already makes, and it was
   * only ever made in one direction: a pack whose renderable content sits BELOW
   * the child could say so and a pack whose content sits ABOVE the child could
   * not, so it was served the bottom of the ladder and dropped every question.
   * TREBUCHET — whose answer is a distance on a 122-metre field, so nothing
   * under 14 fits — showed a child an empty frame on an empty field for three
   * releases because of it.
   *
   * A game with no such constraint must not call this. It does not move the
   * child's ladder position, so a floor that is really a preference cannot be
   * corrected by the host's own evidence: it just parks a child above their
   * level for as long as the game keeps stating it.
   */
  setMinDifficulty(difficulty: number | null): void
  /**
   * Raise the floor under the stream and never lower it again. siege has been
   * feature-detecting this since it shipped: a wave that has been reached
   * justifies a floor under the maths, and a later easy wave must not undo it.
   */
  raiseFloor(difficulty: number): void
  /** The answered questions this pack has reported, oldest first. Bounded. */
  recentOutcomes(): readonly Outcome[]
  /**
   * A natural stopping point just happened: a level cleared, a run completed,
   * a boss down. Fire and forget — the game is told nothing back and must not
   * wait, branch or pause on it. If the host does anything, the game finds out
   * the ordinary way, through the `pause` it already handles.
   *
   * **Only ever after something the child finished.** Never after a defeat, a
   * failed run, a wrong answer or a timer — a purchase surface must never sit
   * next to a failure (ADR-0013), and this is the call that can put one there.
   *
   * Call it as often as the game naturally reaches one. The host acts on the
   * first per game per day and ignores the rest, so a game with short levels
   * does not have to ration them.
   */
  transition(kind: TransitionKind, label?: string): void
}

/** Named cues. The game says what happened; the host owns the waveform. */
const HAPTIC: Record<HapticKind, "tick" | "seat" | "settle" | "refuse"> = {
  light: "tick",
  medium: "seat",
  heavy: "settle",
  success: "settle",
  failure: "refuse",
}

/**
 * How many questions to keep ahead of the game.
 *
 * FUSE pumps ten at a time when a level turns over, so the pool has to absorb a
 * burst without the loop ever seeing an empty one.
 *
 * The arithmetic that used to be written here — "two round trips per question at
 * 120 requests per second is far more headroom than 64 items need" — was the
 * wrong way round, and it was wrong at every mount of every pack. A question
 * costs two calls, sixty-four of them cost a hundred and twenty-eight, and the
 * limit is a hundred and twenty in a SLIDING second, not a hundred and twenty
 * per question. Measured on the shipped code against a fake host that answers
 * immediately: **130 calls between `attach` and the first question, 10 of them
 * refused with `rate_limited`** — and 150 with 30 refused for a pack whose
 * declaration has it pinned, which is the shape the note on `parked` was
 * already worried about. See `PREFETCH_BUDGET` for what now paces it.
 */
export const POOL_TARGET = 64
export const POOL_FLOOR = 32

/**
 * The share of the host's request budget the PREFETCH is allowed to spend.
 *
 * `bridge.ts` allows `MAX_REQUESTS_PER_SECOND` calls from a pack in a sliding
 * second and refuses the rest with `rate_limited` — every method, prefetch and
 * answers and haptics alike, counted in one window. Stocking the pool is the
 * only thing in this module that ever asks for anything in bulk, and it is also
 * the only thing here that is not urgent: a prefetch is by definition a question
 * nobody is waiting for. So it gets a share rather than the whole budget, and
 * the rest is left for the calls a child IS waiting on — the answer they just
 * gave, the haptic under their thumb.
 *
 * Three quarters. Thirty calls a second is a question answered every second
 * with two dozen haptics under it and still room, and prefetch resumes the
 * instant the window drains, so the reserve costs nothing when nobody is using
 * it.
 *
 * **The ceiling this puts on sustained supply, since it is a real one.** A
 * question costs two calls, and the urgent traffic is charged to the same window,
 * so a pack can be fed `(PREFETCH_BUDGET − urgent) / 2` questions a second
 * indefinitely: 45 with nothing else going on, and about 40 for a game that
 * answers and buzzes on every one of them. Above that the pool drains, `take`
 * hands out `{ ...lastServed, id: "" }`, and 24 of the 27 games draw the previous
 * question again rather than checking for the empty id. Measured against the
 * shipped packs, nothing is near it — the deepest bulk consumer in the repo is
 * FUSE's 26-question pool (`games/merge/src/game.ts`) and every retry loop caps
 * at eight — and the code this replaces was worse at every rate a pack actually
 * reaches, because it was being refused outright. If a game ever does become a
 * bulk consumer, the fix is a hungry-pool tier (a pool under `POOL_FLOOR` is not
 * a prefetch — the child is about to arrive at it — so it should be allowed past
 * the share), not a bigger share.
 *
 * It is expressed against the SDK's own constant so the two cannot drift on the
 * DEFAULT: the pack does not get to have an opinion about what the host allows.
 * `bridge.ts` does take a `maxRequestsPerSecond` override, which today only its
 * own tests pass; a host that lowered it for a low-end device would put every
 * pack back over budget, and the honest fix for that is the limit arriving on
 * `Connect` rather than being assumed here.
 */
export const PREFETCH_BUDGET = Math.floor(MAX_REQUESTS_PER_SECOND * 0.75)

/**
 * The most calls one `acquire()` can spend.
 *
 * Worst case is the pinned path that falls through: a pin, the skip that closes
 * it, the host's own arrival, the swap, the skip that closes THAT, and a reveal.
 * The budget is checked with this much room left, because an `acquire` abandoned
 * half way through has already taken an item out of the host and would leave it
 * open.
 */
export const ACQUIRE_MAX_CALLS = 6

/** The window the host's limit is measured over. Its rule, not ours. */
export const RATE_WINDOW_MS = 1000

/** A pack that has not seen a question in this long has been left running. */
const IDLE_MS = 5 * 60 * 1000

/** Answered questions that count as one sitting, for the progress hairline. */
const SESSION_ITEMS = 40

/** Ladder distance the request has to move before `next` flushes by itself. */
const FLUSH_BAND = 0.1

/**
 * The same, when the thing that moved is the host's ladder rather than a request.
 *
 * Three hundredths, which on the sixty-six-rung ladder that ships is two rungs —
 * inside the width of the spread `items.ts` serves from, so a pool is refreshed
 * before the child can notice it has gone stale, and not so tight that it churns.
 * Only reached once per question (from `take`), never per frame, and still behind
 * `FLUSH_COOLDOWN_MS`.
 */
const HOST_FLUSH_BAND = 0.03

/**
 * The shortest gap between two automatic flushes.
 *
 * runner recomputes its difficulty continuously and asks on every gate; without
 * this it would discard the pool several times a second and spend the whole run
 * playing out of the reserve.
 */
const FLUSH_COOLDOWN_MS = 500

/**
 * A move this big is not drift and is not throttled.
 *
 * A quarter of the whole ladder in one step is a game saying something has
 * changed — a child has just missed three in a row, a run has restarted, a
 * revive has happened. Making that wait out a cooldown is the exact failure
 * this module is being fixed for, so it does not.
 */
const FLUSH_URGENT = 0.25

/** Pooled questions this close to the new difficulty survive a flush. */
const KEEP_BAND = 0.12

/**
 * The reserve a flush always leaves, so the pool is never empty.
 *
 * Eight, because that is roughly what FUSE draws in one level turnover, and an
 * empty pool is not a pause — it is a question with no id, whose answer is
 * dropped because there is nothing to report it against.
 */
export const FLUSH_KEEP = 8

/** Outcomes kept for a controller to read back. */
const OUTCOME_LIMIT = 64

/** Difficulty at or below which a request is asking for the very bottom. */
const FLOOR_REQUEST = 0.05

const EPS = 1e-9

/**
 * Consecutive failed rescues after which the declaration is abandoned.
 *
 * Three, because the first failure is evidence and the third is a pattern. Four
 * shipped packs (arena, balance, claim, pulse) declare only skills the current
 * curriculum cannot generate, so for them every rescue fails, and a pack that
 * paid for a second round trip on every question for the whole session would be
 * a performance bug shipped in the name of a declaration nobody can honour.
 * When it surrenders it says so — see `surrender`, which is the only place in
 * this module that raises its voice about a thing a child will not notice.
 */
const SURRENDER_AFTER = 3

/**
 * Pinned questions served before the host's own stream is read again.
 *
 * A child's ladder walks, and it walks *through* the domains: the shipped ladder
 * interleaves multiplication rungs between two bands of addition, so a pack that
 * had to start naming a skill at ordinate 0.45 must notice when the child
 * arrives at 0.6 and the host's own stream is something it covers again. Eight
 * questions is about a minute of play, and the alternative — never looking — is
 * a pack pinned to one rung for the rest of the session.
 */
const PEEK_EVERY = 8

/**
 * The domain a skill id belongs to: `dw.add` out of `dw.add.regroup.add-short`.
 *
 * Two segments, because that is where the curriculum's own naming puts the
 * boundary between "what kind of maths" (`add`, `mul`, `div`, `frac`, `alg`,
 * `ns`) and "which technique within it" (`facts`, `column`, `regroup`), and it
 * is the coarser of the two that a pack's `covers.skills` is actually honest
 * about — see the module note for the measurement.
 *
 * An id with fewer than three segments is its own domain rather than an error:
 * this reads ids off a wire, a host is free to name a skill whatever it likes,
 * and the only wrong answer here is one that quietly groups two unrelated
 * skills together.
 */
export function domainOf(skillId: string): string {
  const parts = skillId.split(".")
  if (parts.length < 3) return skillId
  return `${parts[0] ?? ""}.${parts[1] ?? ""}`
}

export type GameHostOptions = {
  /** Domain label the game shows or logs. Cosmetic; the host owns the skill. */
  readonly domain?: string
  /** Called with 0..1 whenever the game's own progress is known. */
  readonly onProgress?: (fraction: number) => void
  /**
   * Every answered question, with both verdicts, as soon as the host's one is
   * in. This is the seam a difficulty controller mounts on; nothing in this
   * module decides anything with it.
   */
  readonly onOutcome?: (outcome: Outcome) => void
  /**
   * Whether `next` may discard the prefetch when the request moves. Default
   * `true`, which is what makes an existing `next({ difficulty })` call site
   * adaptive without being edited. A game that wants to own its own flushing
   * turns it off and calls `flush` itself.
   */
  readonly autoFlush?: boolean
  /**
   * The skill ids this pack declares it covers — `covers.skills` from its own
   * `pack.json`, as built into `manifest.json`.
   *
   * `createGameHost` reads it off the pack's own manifest, so no game passes it
   * and no game has to be edited; it is an option because that is what makes
   * the behaviour testable without a `fetch`, and because a game that wants no
   * restriction at all can pass `[]` and say so in one place.
   *
   * What is honoured is the DOMAINS these ids belong to, not the ids
   * themselves, and only as far as the host can satisfy them — see the module
   * note for why that is the granularity and what happens when it cannot be
   * met. An empty list, or a list whose domains the host has no content in,
   * behaves exactly as this module did before the field existed.
   */
  readonly skills?: readonly string[]
  /**
   * The clock the request budget and the flush cooldown are measured on.
   *
   * Injectable for the same reason `bridge.ts` injects one: the host's limit is
   * a sliding SECOND, and a test that has to sleep through one to prove the
   * prefetch resumes is a test nobody runs. Defaults to `Date.now`.
   */
  readonly now?: () => number
}

export type MountedHost = {
  readonly host: GameHost
  readonly client: HostClient
  /** Awaited once before the game mounts, so `next()` is never empty. */
  warm(): Promise<void>
  dispose(): void
}

/** A pooled question, with the two facts about its origin the pool needs. */
type Pooled = {
  readonly question: Question
  readonly skillId: string
}

/**
 * Where an item sits on the host's whole ladder, 0..1.
 *
 * The `level / 8` fallback is for a host older than the `difficulty` field and is
 * the reading this module always had. Read through one function so that a
 * ceiling check, a pin measurement and a printed number cannot each pick a
 * different fallback — which they did, and one of them picked 0, i.e. "never
 * above any ceiling".
 */
function ordinateOf(item: Item): number {
  return item.difficulty ?? item.level / 8
}

function questionFrom(item: Item, canonical: string, domain: string): Question {
  const distractors = (item.choices ?? [])
    .map((choice) => choice.text)
    .filter((text) => text !== canonical)
  const ladder = ordinateOf(item)
  return {
    id: item.id,
    prompt: item.prompt,
    answer: canonical,
    distractors,
    domain,
    difficulty: Math.max(0, Math.min(1, ladder)),
  }
}

/** How long a manifest read may take before the game starts without it. */
const MANIFEST_TIMEOUT_MS = 3000

/**
 * Where this pack's own files live, given the document it is running in.
 *
 * A pack is served at `dynawalla-pack://localhost/<packId>/<file>` (or
 * `http://dynawalla-pack.localhost/<packId>/<file>` on Android and Windows), and
 * the entry document is somewhere inside that directory. Cut at the pack id
 * rather than taking the document's own directory, so an entry moved into a
 * subfolder does not silently start reading a manifest that is not there.
 *
 * `null` when the id does not appear in the URL at all, which is a pack being
 * served from somewhere this function was not told about — the caller treats
 * that as "no declaration" and says so, rather than guessing a path.
 */
export function packRootUrl(documentUrl: string, packId: string): string | null {
  if (packId === "") return null
  const marker = `/${packId}/`
  const at = documentUrl.lastIndexOf(marker)
  if (at < 0) return null
  return documentUrl.slice(0, at + marker.length)
}

/**
 * `covers.skills` out of the pack's own built manifest.
 *
 * **Why a fetch and not a build-time constant.** This module is compiled into
 * all 27 packs by 27 separate vite configs and has no path to any one pack's
 * `pack.json`; the host knows every manifest but the wire has no field for it
 * (`Connect` carries `packId`, `granted` and `settings`, and adding to it is a
 * protocol change through the app). What every pack *does* have is
 * `manifest.json` at its own root, written by `packs/build.mjs`, validated by
 * `dw-pack check`, and served by the same scheme handler that serves the game —
 * with `Access-Control-Allow-Origin: *` and the scheme in `connect-src`,
 * precisely so a pack can read its own data from an opaque origin.
 *
 * **It fails open, and it says so.** Everything here is best-effort: no
 * declaration is the state every pack was in until now, so a manifest that
 * cannot be read costs a warning and nothing else. It is a `warn` and not an
 * `error` because it is also the honest state of a pack opened outside a host.
 */
export async function declaredSkills(deps: {
  readonly packId: string
  readonly documentUrl: string
  readonly fetch: typeof globalThis.fetch
  readonly timeoutMs?: number
}): Promise<readonly string[]> {
  const root = packRootUrl(deps.documentUrl, deps.packId)
  const url = root === null ? null : `${root}manifest.json`
  const giveUp = (why: string): readonly string[] => {
    console.warn(
      `[pack] the declared skills could not be read from ${url ?? "an unknown manifest URL"} ` +
        `(${why}); no skill restriction will be applied and questions from every domain the ` +
        `host has will be served`,
    )
    return []
  }
  if (url === null) return giveUp(`"${deps.packId}" is not in the document URL ${deps.documentUrl}`)
  const abort = new AbortController()
  const timer = setTimeout(() => {
    abort.abort()
  }, deps.timeoutMs ?? MANIFEST_TIMEOUT_MS)
  try {
    const response = await deps.fetch(url, { cache: "no-store", signal: abort.signal })
    if (!response.ok) return giveUp(`HTTP ${String(response.status)}`)
    const body: unknown = await response.json()
    const covers = (body as { covers?: unknown } | null)?.covers
    const skills = (covers as { skills?: unknown } | undefined)?.skills
    if (!Array.isArray(skills)) return giveUp("covers.skills is not an array")
    const ids = skills.filter((id): id is string => typeof id === "string" && id !== "")
    if (ids.length !== skills.length) return giveUp("covers.skills holds something that is not an id")
    return ids
  } catch (error) {
    return giveUp(error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Connect to the host and build a synchronous game host over it.
 *
 * Rejects when there is no host — a pack opened directly in a browser tab
 * should say so on its own surface rather than showing a frozen loading state
 * forever, and the games' entry files render that message.
 */
export async function createGameHost(options: GameHostOptions = {}): Promise<MountedHost> {
  return await attachDeclared(await connect(), options, {
    documentUrl: document.baseURI,
    fetch: globalThis.fetch.bind(globalThis),
  })
}

/**
 * `createGameHost` minus the connection: read the pack's own declaration, then
 * attach.
 *
 * Separate for the reason the whole module is separate — a `document` and a
 * `MessagePort` are the two things a test cannot have — and so the step between
 * `manifest.json` and the wire is one a test can walk end to end rather than a
 * line of glue nobody ever ran.
 *
 * The declaration is read BEFORE the game mounts, so the very first `warm()`
 * question is already restricted: trebuchet's opening wave is the one this
 * exists for, and a declaration that arrives a round trip late is a declaration
 * that does not cover it.
 */
export async function attachDeclared(
  client: HostClient,
  options: GameHostOptions,
  deps: { readonly documentUrl: string; readonly fetch: typeof globalThis.fetch },
): Promise<MountedHost> {
  const skills =
    options.skills ?? (await declaredSkills({ packId: client.packId, ...deps }))
  return attachGameHost(client, { ...options, skills })
}

/**
 * The same adapter, over a client somebody else obtained.
 *
 * `createGameHost` is `connect()` plus this. They are separate because the
 * connection is the one part of this module that needs a `window`, a parent
 * frame and a `MessagePort`, and everything interesting — which question comes
 * out next, and why — is the part that does not. Split, the interesting part is
 * testable in Node against a fake client, which is how the difficulty wire is
 * held to its promises.
 */
export function attachGameHost(client: HostClient, options: GameHostOptions = {}): MountedHost {
  // A pack cannot measure its own safe area: it is a cross-origin child, and
  // `env(safe-area-inset-*)` belongs to the top-level browsing context, so it
  // reads zeros. The host measures and sends them; publish them to game-chrome
  // here, once, so every pack gets it without each game remembering to.
  //
  // The app's Sound setting travels on the same object and had the same
  // problem, worse: nothing read it at all. A parent turned Sound off and all
  // 27 games kept playing, because each one owned a mute button and none of
  // them owned the setting. Published here it reaches every game's safety bus
  // at once, and no game has to be edited to obey it.
  //
  // Both are re-published on every `settings` event, not only at attach. The
  // host pushes one whenever the store changes, which is the whole point: a
  // switch that only takes effect at launch is a switch a parent flips while a
  // game is loud and watches do nothing.
  //
  // The soundscape joins them for the third time the same reason applies: it is
  // a slow-moving fact about the app that a pack cannot work out for itself. A
  // pack frame is opaque-origin and sees nothing of the pack the child was in a
  // minute ago, so if each one chose its own key the bazaar would change key at
  // every doorway. `game-soundscape` validates it and refuses anything
  // malformed; a host too old to send one publishes `undefined`, which means
  // "keep your own sounds" and not "go quiet".
  const publish = (): void => {
    setHostInsets(client.settings.safeArea)
    setHostSound(client.settings.sound)
    setHostSoundscape(client.settings.soundscape)
  }
  publish()
  client.on("settings", publish)
  const domain = options.domain ?? "arith"
  const autoFlush = options.autoFlush ?? true
  const granted = new Set<Capability>(client.granted)
  const now = options.now ?? ((): number => Date.now())

  // ── What this pack has spent of the host's request budget ──────────────────
  //
  // The same sliding window `bridge.ts` enforces, kept on this side of the wire
  // so the prefetch can stay inside it instead of discovering the limit by being
  // refused. Every call this module makes is charged here — not only the
  // prefetch — because the host counts them all in one window, and a prefetch
  // that ignored the answers and haptics a game is producing would be pacing
  // itself against a budget that is not the one it is spending.
  //
  // What is NOT here is any throttle on the calls a child is waiting for. An
  // answer, a skip and a haptic are sent the moment the game says so, and the
  // prefetch yields to them. Nor are the calls a game makes on `mounted.client`
  // itself — forge and merge-idle read a save at mount — which is another reason
  // the prefetch takes a share and not the lot: the reserve is what covers the
  // traffic this module cannot see.

  /** When each call this module made was made, oldest first. */
  const spend: number[] = []

  /** Calls inside the current window, with the expired ones dropped. */
  const spent = (): number => {
    const cutoff = now() - RATE_WINDOW_MS
    while (spend.length > 0 && (spend[0] ?? 0) <= cutoff) spend.shift()
    return spend.length
  }

  /**
   * Charge one call to the window.
   *
   * Expired timestamps are dropped HERE and not only where the budget is read,
   * because a game with a full pool reads it rarely and spends anyway: horde
   * asks for a haptic per hit, and a window pruned only by the prefetch would
   * hold every one of them for as long as the pack ran.
   */
  const charge = (): void => {
    spent()
    spend.push(now())
  }

  /** Whether the prefetch may start one more `acquire` without going over. */
  const affordsPrefetch = (): boolean => spent() + ACQUIRE_MAX_CALLS <= PREFETCH_BUDGET

  /**
   * The client, with every call charged against the window above.
   *
   * A wrapper rather than a `charge()` at each of the nine call sites, so a call
   * added later cannot quietly escape the budget: nothing below this line
   * touches `client` except `settings`, `on` and `dispose`, none of which cross
   * the wire.
   */
  const metered: Pick<
    HostClient,
    "nextItem" | "reveal" | "skip" | "answer" | "progress" | "haptic" | "transition"
  > = {
    nextItem: (ask) => {
      charge()
      return client.nextItem(ask)
    },
    reveal: (itemId) => {
      charge()
      return client.reveal(itemId)
    },
    skip: (itemId) => {
      charge()
      return client.skip(itemId)
    },
    answer: (input) => {
      charge()
      return client.answer(input)
    },
    progress: (fraction) => {
      charge()
      return client.progress(fraction)
    },
    haptic: (cue) => {
      charge()
      return client.haptic(cue)
    },
    transition: (kind, label) => {
      charge()
      return client.transition(kind, label)
    },
  }

  const pool: Pooled[] = []
  /** Questions this module has handed to the game and not yet reported on. */
  const served = new Map<string, { difficulty: number; skillId: string }>()
  const outcomes: Outcome[] = []
  let wanted: number[] = []
  let filling = false
  let disposed = false
  let lastServed: Question | null = null
  let lastAsk = now()
  let reported = 0
  /** Whether a failed `items.skip` has already been said out loud. */
  let skipFailed = false

  /** The difficulty the game is asking for, 0..1, or null for "whatever". */
  let target: number | null = null
  /** A standing ceiling, 0..1, or null for none. */
  let ceiling: number | null = null
  /**
   * A standing floor the host honours absolutely, 0..1, or null for none.
   *
   * Distinct from `floor` below, and the two must not be merged: that one is a
   * game's own preference and this one is a statement about what the game can
   * draw at all. See `setMinDifficulty`.
   */
  let renderFloor: number | null = null
  /** A floor that only ever rises. siege drives this. */
  let floor = 0
  /**
   * The ordinate of the most recent item the host handed over.
   *
   * The freshest reading available of where the host's own ladder is standing —
   * every refill fetches at the host's current position, so the last arrival is
   * at most one round trip old. It is what the pool is aimed at when the game
   * does not aim it itself; see the note at the top of this file for what it
   * cost to have no aim at all.
   */
  let fresh: number | null = null
  /** The difficulty the pool was last stocked for. */
  let filledFor: number | null = null
  /** `now()` and not 0: an injected clock starting near zero would otherwise
   * arm the flush cooldown at mount, which `Date.now()` never does. */
  let lastFlush = now()

  // ── What kind of maths this pack declared it does ──────────────────────────

  /** `covers.skills`, in declaration order. Empty means "no restriction". */
  const declared = (options.skills ?? []).filter((id) => id !== "")
  /** The domains those ids belong to. What is actually honoured. */
  const domains = new Set(declared.map(domainOf))
  /**
   * What a pin for each declared skill was observed to return.
   *
   * Learned rather than assumed, because a pack cannot see the host's ladder:
   * naming a skill returns one fixed rung, and where that rung sits is a fact
   * only the host knows. Recorded from the pinned request that discovered it,
   * which is why it is the ordinate a *future* pin for the same skill will get
   * and not a guess derived from some other arrival.
   */
  const pinOrdinate = new Map<string, number>()
  /** Declared skills this host demonstrably does not have. Never pinned twice. */
  const absentSkills = new Set<string>()
  /** Consecutive rescues that failed to produce a question the pack declares. */
  let rescuesFailed = 0
  /** Set once the declaration has been abandoned for the session. */
  let surrendered = false
  /**
   * Whether the host's own stream is currently outside what this pack covers.
   *
   * A budget, not a preference. Asking, refusing and asking again costs four
   * calls a question — two `items.next`, a `reveal` and a `skip` — and the host
   * allows 120 in a sliding second: `warm()` stocks 32 questions back to back, so
   * the refuse-and-retry shape crosses that window at mount and the pool comes up
   * short with a rate-limit error. Once the host is known to be parked somewhere
   * this pack cannot use, the declared skill is asked for directly and a question
   * costs exactly what it cost before this file learned about domains.
   */
  let parked = false
  /** Pinned questions served since the host's own position was last read. */
  let sincePeek = 0

  /**
   * Things said once per mount.
   *
   * Loud, because this repository has been bitten repeatedly by the opposite —
   * a renderer that skipped unlabelled orbs, a generator that discarded
   * out-of-range answers, both in silence. Once, because a warning a game
   * prints sixty times a second is a warning nobody reads.
   */
  const spoken = new Set<string>()
  const sayOnce = (key: string, message: string) => {
    if (spoken.has(key)) return
    spoken.add(key)
    console.warn(message)
  }
  /** The same, at the volume a thing that needs fixing in the repository gets. */
  const shoutOnce = (key: string, message: string) => {
    if (spoken.has(key)) return
    spoken.add(key)
    console.error(message)
  }

  const canReveal = granted.has("items.reveal")

  /** A game's number, announced if it is nonsense and read if it is not. */
  const readScale = (value: number, field: string): number | null => {
    const unit = toUnit(value)
    if (unit === null) {
      sayOnce(
        `nan:${field}`,
        `[pack] ${field} was ${String(value)}, which is not a difficulty; the request was ignored`,
      )
      return null
    }
    if (value === 1) {
      // The one value the two scales disagree about. Read as the bottom, for
      // the reason given on `toUnit` — but said out loud, because the game that
      // meant the other thing is the one that needs to know. polarity reaches
      // exactly 1 after fifteen strata (about seven and a half minutes) and
      // means "hardest"; six other games send it on their opening question and
      // mean "easiest". Whichever this game is, it can now find out.
      sayOnce(
        `ambiguous:${field}`,
        `[pack] ${field} of exactly 1 is the bottom of the 1..10 ladder and the top of the 0..1 ` +
          `fraction; it is read as the BOTTOM. Send 10 for the hardest content on the ladder.`,
      )
    }
    if (value < 0 || value > 10) {
      sayOnce(
        `range:${field}`,
        `[pack] ${field} ${String(value)} is outside both scales this host reads ` +
          `(0..1 as a fraction, 1..10 as a ladder index); clamped to ${unit.toFixed(2)}`,
      )
    }
    return unit
  }

  /**
   * What the pool should be stocked and searched against, or `null` for
   * "whatever is in it".
   *
   * The game's own request when it makes one, and otherwise where the host's
   * ladder actually is. A `null` here means neither is known, which happens only
   * before the first item has ever arrived.
   */
  const aim = (): number | null => target ?? fresh

  /**
   * The request, as one object, in one place.
   *
   * `pin` names a skill and is the rescue described in the module note, never
   * the standing request: a pinned request is served the first rung of that
   * skill whatever `difficulty` and `maxDifficulty` say, so sending one by
   * default would replace the host's model of where a child is with a pack's
   * guess at it. The difficulty fields travel with it anyway — the host reads
   * them to keep the child's ladder position moving even on a request whose
   * rung it will not choose with them.
   */
  const askShape = (pin?: string): ItemRequest => {
    const ask: {
      difficulty?: number
      maxDifficulty?: number
      minDifficulty?: number
      skillId?: string
    } = {}
    if (target !== null) ask.difficulty = target
    if (ceiling !== null) ask.maxDifficulty = ceiling
    if (renderFloor !== null) ask.minDifficulty = renderFloor
    if (pin !== undefined) ask.skillId = pin
    return ask
  }

  /** Whether the pack's declaration is being honoured at this moment. */
  const restricting = (): boolean => domains.size > 0 && !surrendered

  /** Whether a skill is one this pack works in. */
  const admits = (skillId: string): boolean => domains.has(domainOf(skillId))

  /** Whether an item is above a ceiling the game set. */
  const overCeiling = (item: Item): boolean =>
    ceiling !== null && ordinateOf(item) > ceiling + EPS

  /**
   * Close an item the pack asked for and is not going to use.
   *
   * The alternative is leaving it open in the host's ledger, which costs a child
   * nothing but does mean an unanswered item per rescue for a whole session.
   * Failure is the older-host case and is already said out loud by `skip`.
   */
  const close = (itemId: string) => {
    void metered.skip(itemId).catch(() => {
      // Deliberately quiet HERE: `host.skip` owns that message, says it once,
      // and states the consequence. Two copies of it is one too many.
    })
  }

  /**
   * The declared skill to ask for instead, or `null` when there is none left.
   *
   * Unmeasured candidates first, and that is the whole of the search: a pin
   * returns one fixed rung and nothing tells a pack where that rung is until it
   * has asked, so each declared skill is worth one exploratory request and
   * after that the set is known and the nearest one to what the game wants is
   * chosen from it. Bounded by the size of the declaration, which the manifest
   * schema caps at 512 and which no shipped pack takes past nine.
   *
   * A candidate known to sit above the game's own ceiling is never chosen while
   * another exists — a pinned request ignores `maxDifficulty`, so respecting it
   * is this side's job.
   */
  const rescueSkill = (): string | null => {
    const candidates = declared.filter((id) => !absentSkills.has(id))
    const unmeasured = candidates.filter((id) => !pinOrdinate.has(id))
    if (unmeasured.length > 0) return unmeasured[0] ?? null
    if (candidates.length === 0) return null
    const want = aim() ?? 0
    const score = (id: string): number => {
      const ordinate = pinOrdinate.get(id) ?? 0
      const over = ceiling !== null && ordinate > ceiling + EPS
      return Math.abs(ordinate - want) + (over ? 1000 : 0)
    }
    return [...candidates].sort((a, b) => score(a) - score(b))[0] ?? null
  }

  /** Give up on the declaration for the rest of the session, loudly. */
  const surrender = (why: string) => {
    surrendered = true
    shoutOnce(
      "surrender",
      `[pack] this pack's covers.skills names ${domains.size === 1 ? "the domain" : "the domains"} ` +
        `${[...domains].join(", ")} and this host cannot serve ${why} — the declaration is now ` +
        `IGNORED for the rest of this session and questions from any domain will be served, ` +
        `because a game with no questions is worse than a game with the wrong ones. Either the ` +
        `pack declares skills the curriculum does not have, or the curriculum has lost them.`,
    )
  }

  /** Reveal the answer and build the question, or `null` if it cannot be placed. */
  const draw = async (item: Item): Promise<Pooled | null> => {
    const canonical = canReveal ? await metered.reveal(item.id) : ""
    if (canonical === "") {
      // No reveal grant means no placeable answer. Both games need one,
      // so this is loud rather than a silently duller game.
      console.error("[pack] items.reveal was not granted; questions cannot be placed")
      return null
    }
    const question = questionFrom(item, canonical, domain)
    // The freshest reading of where the questions are coming from, taken on
    // arrival rather than on hand-out: a question that is still in the pool has
    // already told us something, and waiting until a child sees it is waiting the
    // length of the pool. Taken from whatever is actually pooled, including a
    // rung this module asked for by name — aiming the pool somewhere none of its
    // contents can be is what makes a flush discard a pool it just filled, and it
    // was measured costing a restricted pack a third of its requests again.
    fresh = question.difficulty
    return { question, skillId: item.skillId }
  }

  /**
   * One question from the host, in a domain this pack declared if that is
   * possible and with the reason said out loud when it is not.
   *
   * `null` is "stop asking for now" — the host has nothing, or the answer could
   * not be revealed — and is the same signal both call sites already broke on.
   */
  /** What a pin for `skill` turned out to return, or that the host lacks it. */
  const record = (skill: string, item: Item) => {
    if (item.skillId === skill) pinOrdinate.set(skill, ordinateOf(item))
    else absentSkills.add(skill)
  }

  const acquire = async (): Promise<Pooled | null> => {
    // While the host is parked outside what this pack covers, ask for a declared
    // skill directly rather than asking, refusing and asking again — see `parked`
    // for the request budget that makes this the difference between a stocked
    // pool and a rate-limited one. Every `PEEK_EVERY` questions it falls through
    // anyway, because the only way to find out that the child's ladder has walked
    // back into this pack's own domain is to let the host answer for itself.
    if (restricting() && parked && sincePeek < PEEK_EVERY) {
      const pin = rescueSkill()
      if (pin !== null) {
        sincePeek += 1
        const pinned = await metered.nextItem(askShape(pin))
        if (pinned !== null) {
          record(pin, pinned)
          if (admits(pinned.skillId) && !overCeiling(pinned)) return await draw(pinned)
          // The pin stopped working — the host lost the skill, or the game has
          // since set a ceiling below it. Fall through to the host's own stream,
          // which is where the accounting and the announcements live.
          close(pinned.id)
        }
      }
      parked = false
    }
    sincePeek = 0

    const arrival = await metered.nextItem(askShape())
    if (arrival === null) return null
    if (!restricting() || admits(arrival.skillId)) {
      // The host is serving something this pack covers, so it is not parked and
      // the next question is its own again — levels, spread and all.
      parked = false
      return await draw(arrival)
    }

    const pin = rescueSkill()
    if (pin === null) {
      surrender("any of them")
      return await draw(arrival)
    }
    const swap = await metered.nextItem(askShape(pin))
    if (swap === null) {
      // The host had one question and not two. Use the one it gave.
      return await draw(arrival)
    }
    record(pin, swap)

    if (overCeiling(swap)) {
      // A pinned request is served whatever rung the skill sits on, ceiling or
      // no ceiling — proved against the shipped host, which returns 0.28 for a
      // pin under a `maxDifficulty` of 0.1. A game that set a ceiling did so
      // because it cannot draw above it, and honouring one declaration by
      // breaking another is not a trade this module makes.
      sayOnce(
        "pin-ceiling",
        `[pack] "${pin}" is the nearest skill this pack declares and it sits at ` +
          `${ordinateOf(swap).toFixed(2)}, above the maxDifficulty of ` +
          `${(ceiling ?? 1).toFixed(2)} this game set — the ceiling wins, so a question from ` +
          `"${arrival.skillId}" is being served instead of one this pack declares`,
      )
      close(swap.id)
      rescuesFailed += 1
      if (rescuesFailed >= SURRENDER_AFTER) surrender("anything under the ceiling this game set")
      return await draw(arrival)
    }

    if (!admits(swap.skillId)) {
      close(swap.id)
      rescuesFailed += 1
      if (rescuesFailed >= SURRENDER_AFTER) surrender(`"${pin}" or the rest of them`)
      else {
        sayOnce(
          "pin-missing",
          `[pack] this pack declares "${pin}" and this host does not have it — it answered with ` +
            `"${swap.skillId}" instead, so a question outside ${[...domains].join(", ")} is being ` +
            `served`,
        )
      }
      return await draw(arrival)
    }

    rescuesFailed = 0
    // The host is somewhere this pack cannot use and the trade worked, so the
    // questions after this one ask for the declared skill directly.
    parked = true
    sayOnce(
      "rescued",
      `[pack] the host served "${arrival.skillId}" at ${ordinateOf(arrival).toFixed(2)}, ` +
        `which is outside the ${[...domains].join(", ")} this pack's covers.skills declares; it ` +
        `was asked again for "${pin}" and got "${swap.skillId}" at ` +
        `${ordinateOf(swap).toFixed(2)}. This costs one extra request per question for as ` +
        `long as the child's ladder position sits outside what this pack covers.`,
    )
    close(arrival.id)
    return await draw(swap)
  }

  const fill = () => {
    if (filling || disposed) return
    filling = true
    void (async () => {
      try {
        while (!disposed && pool.length < POOL_TARGET) {
          if (now() - lastAsk > IDLE_MS) break
          // The one place in this module that asks for anything in bulk, and so
          // the one place that has to look at what is left of the host's budget.
          // Stopping is safe and waiting is not: `fill` is called again on every
          // hand-out, on `focus` and on every flush, so the top-up resumes at the
          // next question the game asks for with the window a second emptier —
          // and the pool is `POOL_FLOOR` deep before the first frame either way.
          // Awaiting a timer here instead would put a sleep in front of a child
          // for questions nobody is waiting for.
          if (!affordsPrefetch()) break
          // Read every time round the loop, not once: a difficulty change while
          // a refill is in flight has to reach the questions still to come.
          const entry = await acquire()
          if (entry === null) break
          pool.push(entry)
        }
      } catch (error) {
        console.error("[pack] could not fill the question pool", error)
      } finally {
        filling = false
      }
    })()
  }

  /** How wrong a pooled question is for what the game is asking for now. */
  const distance = (entry: Pooled): number => {
    const want = aim() ?? ceiling ?? entry.question.difficulty
    const over = ceiling !== null && entry.question.difficulty > ceiling + EPS
    // A question below a stated floor is unrenderable for the same reason one
    // above the ceiling is, so it is ranked the same way: never while anything
    // else exists, and still an answer when nothing else does. Without this the
    // pool a game filled BEFORE it stated its floor keeps being served out of
    // preferentially, and the floor takes sixty-four questions to bite.
    const under = renderFloor !== null && entry.question.difficulty < renderFloor - EPS
    return Math.abs(entry.question.difficulty - want) + (over || under ? 1000 : 0)
  }

  const flushNow = () => {
    lastFlush = now()
    filledFor = aim()
    // The reserve below is chosen by `distance`, which already ranks a question
    // under a stated floor a thousand short of anything else — so a reserve is
    // made of renderable questions whenever any exist. Emptying the pool of the
    // under-floor ones outright was tried and reverted: it hands the game the
    // dry-pool sentinel, which is a question with no id whose answer cannot be
    // reported, and a game searching for a rung it can render would meet one on
    // every probe. Eight stale questions the game drops is the cheaper failure.
    if (aim() !== null && pool.length > FLUSH_KEEP) {
      // A focused value survives a flush whatever its difficulty. `focus`
      // outranks difficulty when a question is handed out — FUSE's chip has to
      // be able to say its own number — so a flush that threw those away would
      // quietly undo the call the game just made.
      const keep = pool.filter(
        (entry) =>
          distance(entry) <= KEEP_BAND || wanted.includes(Number(entry.question.answer)),
      )
      const kept =
        keep.length >= FLUSH_KEEP
          ? keep
          : [...pool].sort((a, b) => distance(a) - distance(b)).slice(0, FLUSH_KEEP)
      pool.length = 0
      pool.push(...kept)
    }
    fill()
  }

  const maybeFlush = () => {
    const want = aim()
    if (!autoFlush || want === null) return
    const moved = filledFor === null ? 1 : Math.abs(want - filledFor)
    // A game's request is a coarse intent that can jitter frame to frame, so it
    // has to move a tenth of the ladder to be worth discarding a pool for. The
    // host's own position is not an intent — it is where the child is — and it
    // moves in whole rungs, so it gets a tighter band. Without the tighter one a
    // sixty-six-rung ladder has to be walked almost seven rungs before the queue
    // in front of a child is refreshed, which is more than the whole width of the
    // spread the host serves from.
    const band = target === null ? HOST_FLUSH_BAND : FLUSH_BAND
    if (moved < band) return
    if (moved < FLUSH_URGENT && now() - lastFlush < FLUSH_COOLDOWN_MS) return
    flushNow()
  }

  /** Fold a game's request into the standing one. Returns nothing; sets state. */
  const applyRequest = (request: DifficultyRequest | undefined) => {
    if (request === undefined) return
    if (request.maxDifficulty !== undefined) {
      const unit = readScale(request.maxDifficulty, "maxDifficulty")
      if (unit !== null) ceiling = unit
    }
    if (request.minDifficulty !== undefined) {
      const unit = readScale(request.minDifficulty, "minDifficulty")
      if (unit !== null) renderFloor = unit
    }
    if (request.difficulty !== undefined) {
      const unit = readScale(request.difficulty, "difficulty")
      if (unit !== null) target = Math.max(unit, floor)
    }
    if (target !== null && ceiling !== null) target = Math.min(target, ceiling)
    // The floor is a capability and the ceiling is a capability, so between the
    // two of them there is nothing to choose here — the HOST resolves an empty
    // window and says so once. What is resolved here is only where this module
    // AIMS: a target under a stated floor would sort the pool toward questions
    // the game has just said it cannot draw.
    if (target !== null && renderFloor !== null) target = Math.max(target, renderFloor)
    maybeFlush()
  }

  const take = (request?: DifficultyRequest): Question => {
    lastAsk = now()
    applyRequest(request)
    // Once per question, whether or not the game said anything. `applyRequest`
    // returns early when there is no request, and that early return is exactly
    // what left a game driving no difficulty with no flush at all.
    maybeFlush()
    const label = request?.domain ?? domain

    const hand = (entry: Pooled): Question => {
      // Topped up on every hand-out rather than in batches of thirty-two when the
      // pool drains past `POOL_FLOOR`. Same number of fetches over a session, and
      // it is what makes `fresh` actually fresh: refilling in batches meant the
      // host was not asked anything at all for thirty-two questions at a time, so
      // there was no reading of where its ladder had got to and nothing for
      // `maybeFlush` to act on. `fill` is idempotent while one is in flight and
      // stops at `POOL_TARGET`, so this is one round trip per question.
      fill()
      const question = label === entry.question.domain
        ? entry.question
        : { ...entry.question, domain: label }
      lastServed = question
      served.set(question.id, { difficulty: question.difficulty, skillId: entry.skillId })
      if (
        target !== null &&
        target <= FLOOR_REQUEST &&
        question.difficulty <= FLOOR_REQUEST + EPS
      ) {
        // The request could not be satisfied downwards and was clamped to the
        // bottom of what exists. Said out loud, once, naming the rung it
        // stopped at, because "the curriculum has no easier content" is a fact
        // about the product and not about this game.
        sayOnce(
          "floor",
          `[pack] difficulty ${target.toFixed(2)} was requested and the easiest rung this host ` +
            `has is "${entry.skillId}" at ${question.difficulty.toFixed(2)} — the curriculum has ` +
            `nothing below it, so this is as easy as questions get today`,
        )
      }
      return question
    }

    // A value the game said it needs, if the pool happens to hold one: FUSE
    // asks for a chip worth exactly 7 and can then print an expression on it.
    // When nothing matches, the game gets the next question and draws a
    // numeral instead — which is what `focus` being optional means. This still
    // outranks difficulty: a chip that cannot say its own number is not a
    // slightly-too-hard chip, it is an unplayable one.
    if (wanted.length > 0) {
      const index = pool.findIndex((entry) => wanted.includes(Number(entry.question.answer)))
      if (index >= 0) {
        const [picked] = pool.splice(index, 1)
        if (picked) return hand(picked)
      }
    }

    // The question closest to what was asked for. Ties go to the front of the
    // pool, so with no difficulty request this is exactly the FIFO it was.
    //
    // Deliberately still `target` and not `aim()`: searching the pool against the
    // host's own position as well was tried, and it changes the order every one of
    // the twenty-seven games is served in while making no measurable difference to
    // the staleness it was meant to fix (2 questions either way — the flush and
    // the per-question top-up already do it). A behaviour change to shared code
    // that no test can distinguish is a behaviour change nobody asked for.
    if ((target !== null || ceiling !== null) && pool.length > 0) {
      let best = 0
      let score = distance(pool[0] as Pooled)
      for (let i = 1; i < pool.length; i++) {
        const candidate = distance(pool[i] as Pooled)
        if (candidate < score) {
          score = candidate
          best = i
        }
      }
      const [picked] = pool.splice(best, 1)
      if (picked) return hand(picked)
    }

    const next = pool.shift()
    if (next) return hand(next)
    if (pool.length < POOL_FLOOR) fill()
    // The pool ran dry. The game gets something drawable with no id, so the
    // report it produces is dropped rather than answering a served item twice.
    console.warn("[pack] the question pool ran dry")
    return lastServed
      ? { ...lastServed, id: "" }
      : { id: "", prompt: "", answer: "0", distractors: [], domain: label, difficulty: 0 }
  }

  const host: GameHost = {
    next: take,

    report: ({ questionId, correct, ms, answered }) => {
      const origin = served.get(questionId)
      if (questionId === "" || origin === undefined) return
      served.delete(questionId)
      // The host draws the progress and the pack does not, so what a pack owes
      // it is a fraction. "How far into this sitting" is the only one a game
      // with no ending can honestly report, and it is the one a parent glancing
      // at a tablet wants: forty answered questions is a session.
      reported += 1
      const fraction = Math.min(1, reported / SESSION_ITEMS)
      void metered.progress(fraction).catch(() => {})
      options.onProgress?.(fraction)

      const land = (verdict: boolean, judged: boolean) => {
        const outcome: Outcome = {
          questionId,
          difficulty: origin.difficulty,
          skillId: origin.skillId,
          claimed: correct,
          correct: verdict,
          judged,
          ms: Math.max(0, Math.round(ms)),
        }
        outcomes.push(outcome)
        while (outcomes.length > OUTCOME_LIMIT) outcomes.shift()
        options.onOutcome?.(outcome)
      }

      // The host judges, and its verdict is the record. The game's belief is
      // kept beside it rather than discarded: it is the only signal available
      // if this round trip never comes back, and it is available a round trip
      // sooner when it does.
      void metered
        .answer({ itemId: questionId, response: answered, latencyMs: Math.max(0, Math.round(ms)) })
        .then(
          (judgement) => {
            land(judgement.correct, true)
          },
          (error: unknown) => {
            console.error("[pack] an answer could not be reported", error)
            land(correct, false)
          },
        )
    },

    skip: (questionId) => {
      const origin = served.get(questionId)
      if (questionId === "" || origin === undefined) return
      // Deleted first, and this is the half of the fix that works even when the
      // host cannot be reached: with the entry gone, a `report` on this id can
      // no longer produce an `items.answer` call, so nothing about this
      // question can turn into a wrong attempt afterwards.
      served.delete(questionId)
      void metered.skip(questionId).catch((error: unknown) => {
        if (skipFailed) return
        skipFailed = true
        // Loud, once. The consequence is small and worth stating precisely: the
        // item stays open in the host's ledger until it is evicted, and an open
        // item costs a child nothing — it is never re-served, never recorded,
        // and never moves the ladder on its own.
        console.error(
          "[pack] an unanswered question could not be closed on the host; it is left open " +
            "rather than recorded, which costs the child nothing",
          error,
        )
      })
    },

    haptic: (kind) => {
      if (!granted.has("haptics")) return
      void metered.haptic(HAPTIC[kind]).catch(() => {
        // A device with no motor is not an error a child should hear about,
        // and the host has already logged anything that is.
      })
    },

    prefersReducedMotion: () => client.settings.reducedMotion,

    focus: ({ wanted: values }) => {
      wanted = values.slice(0, 32)
      if (pool.length < POOL_TARGET) fill()
    },

    flush: flushNow,

    setDifficulty: (difficulty) => {
      applyRequest({ difficulty })
    },

    setMinDifficulty: (difficulty) => {
      if (difficulty === null) {
        if (renderFloor === null) return
        renderFloor = null
        return
      }
      // `readScale` once and here, not again inside `applyRequest`: it is
      // idempotent on a value already in 0..1, but relying on that is how a
      // second scale conversion goes unnoticed until a game speaks the other
      // one. `applyRequest` is then handed the raw request, as everywhere else.
      if (readScale(difficulty, "minDifficulty") === renderFloor) return
      applyRequest({ minDifficulty: difficulty })
      // Unconditionally, and not through `maybeFlush`. A floor that rose past
      // the pool invalidates every question in it, and `maybeFlush` measures how
      // far the AIM moved — which is zero for a game that states a floor without
      // ever stating a difficulty. Sixty-four unrenderable questions is exactly
      // the stall this whole change exists to remove.
      flushNow()
    },

    raiseFloor: (difficulty) => {
      const unit = readScale(difficulty, "raiseFloor")
      if (unit === null || unit <= floor) return
      floor = unit
      if (target === null || target < floor) {
        target = ceiling === null ? floor : Math.min(floor, ceiling)
        maybeFlush()
      }
    },

    recentOutcomes: () => outcomes,

    transition: (kind, label) => {
      // Synchronous on the outside, because it is called from inside a game
      // loop where there is no `await`, and swallowed on the inside: a host
      // that could not take a stopping point must not take the game down.
      void metered.transition(kind, label).catch((error: unknown) => {
        console.error("[pack] a stopping point could not be reported", error)
      })
    },
  }

  return {
    host,
    client,
    warm: async () => {
      // Awaited so the first frame the child sees is already stocked. Filling
      // in the background and hoping is how a game shows a blank chip once.
      //
      // Through `acquire` like every other question, so the declaration covers
      // the opening wave too: trebuchet's first wave was the unplayable one, and
      // a restriction that starts working on question nine is a restriction that
      // misses the only part of the session a child might not come back from.
      //
      // Inside the budget like every other question too. `2 * POOL_FLOOR` is 64
      // and the prefetch share is 90, so on a fresh mount — an empty window, by
      // construction: the bridge is built with the pack — this loop runs all the
      // way and the first frame is stocked exactly as deep as it was. The check
      // is here for the shapes that cost more than two calls a question: a pinned
      // pack pays three, and a `PEEK_EVERY` fall-through pays five. Stocking
      // twenty-five questions and letting the pool finish filling as the child
      // plays is a game that works; stocking thirty-two and being refused for the
      // last of them is a game that logs `rate_limited` at every mount.
      for (let i = 0; i < POOL_FLOOR && !disposed && affordsPrefetch(); i++) {
        const entry = await acquire()
        if (entry === null) break
        pool.push(entry)
      }
      fill()
    },
    dispose: () => {
      disposed = true
      client.dispose()
    },
  }
}

/**
 * The message a pack draws when it is not inside a host.
 *
 * Every pack needs one and none of them should invent it: opening `index.html`
 * from a file manager, or leaving a stale tab open after the host is gone, are
 * both states a child can reach, and a frozen loading screen is the worst
 * possible answer to either.
 */
export function renderNoHost(root: HTMLElement, name: string): void {
  root.innerHTML = ""
  const panel = document.createElement("div")
  panel.setAttribute("role", "status")
  panel.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
    "padding:2rem;text-align:center;font:500 1rem/1.5 system-ui,sans-serif;color:#e8e2d6"
  panel.textContent = `${name} runs inside Dynawalla.`
  root.appendChild(panel)
}
