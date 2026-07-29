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

import type { Capability, HostClient, Item, TransitionKind } from "../../sdk/src/index.ts"
import { setHostInsets } from "../game-chrome/insets.ts"
import { setHostSound } from "../game-audio/index.ts"
import { connect } from "../../sdk/src/index.ts"

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
 * burst without the loop ever seeing an empty one. Two round trips per question
 * (`items.next` then `items.reveal`) at 120 requests per second is far more
 * headroom than 64 items need.
 */
export const POOL_TARGET = 64
export const POOL_FLOOR = 32

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
const FLUSH_KEEP = 8

/** Outcomes kept for a controller to read back. */
const OUTCOME_LIMIT = 64

/** Difficulty at or below which a request is asking for the very bottom. */
const FLOOR_REQUEST = 0.05

const EPS = 1e-9

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

function questionFrom(item: Item, canonical: string, domain: string): Question {
  const distractors = (item.choices ?? [])
    .map((choice) => choice.text)
    .filter((text) => text !== canonical)
  // The host's own ladder ordinate when it sends one. The `level / 8` fallback
  // is for a host older than this field and is the reading it always had.
  const ladder = item.difficulty ?? item.level / 8
  return {
    id: item.id,
    prompt: item.prompt,
    answer: canonical,
    distractors,
    domain,
    difficulty: Math.max(0, Math.min(1, ladder)),
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
  return attachGameHost(await connect(), options)
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
  const publish = (): void => {
    setHostInsets(client.settings.safeArea)
    setHostSound(client.settings.sound)
  }
  publish()
  client.on("settings", publish)
  const domain = options.domain ?? "arith"
  const autoFlush = options.autoFlush ?? true
  const granted = new Set<Capability>(client.granted)

  const pool: Pooled[] = []
  /** Questions this module has handed to the game and not yet reported on. */
  const served = new Map<string, { difficulty: number; skillId: string }>()
  const outcomes: Outcome[] = []
  let wanted: number[] = []
  let filling = false
  let disposed = false
  let lastServed: Question | null = null
  let lastAsk = Date.now()
  let reported = 0
  /** Whether a failed `items.skip` has already been said out loud. */
  let skipFailed = false

  /** The difficulty the game is asking for, 0..1, or null for "whatever". */
  let target: number | null = null
  /** A standing ceiling, 0..1, or null for none. */
  let ceiling: number | null = null
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
  let lastFlush = 0

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

  const askShape = (): { difficulty?: number; maxDifficulty?: number } => {
    const ask: { difficulty?: number; maxDifficulty?: number } = {}
    if (target !== null) ask.difficulty = target
    if (ceiling !== null) ask.maxDifficulty = ceiling
    return ask
  }

  const fill = () => {
    if (filling || disposed) return
    filling = true
    void (async () => {
      try {
        while (!disposed && pool.length < POOL_TARGET) {
          if (Date.now() - lastAsk > IDLE_MS) break
          // Read every time round the loop, not once: a difficulty change while
          // a refill is in flight has to reach the questions still to come.
          const item = await client.nextItem(askShape())
          if (item === null) break
          const canonical = canReveal ? await client.reveal(item.id) : ""
          if (canonical === "") {
            // No reveal grant means no placeable answer. Both games need one,
            // so this is loud rather than a silently duller game.
            console.error("[pack] items.reveal was not granted; questions cannot be placed")
            break
          }
          const question = questionFrom(item, canonical, domain)
          // The freshest reading of where the host stands, taken on arrival
          // rather than on hand-out: a question that is still in the pool has
          // already told us something, and waiting until a child sees it is
          // waiting the length of the pool.
          fresh = question.difficulty
          pool.push({ question, skillId: item.skillId })
        }
      } catch (error) {
        console.error("[pack] could not fill the question pool", error)
      } finally {
        filling = false
      }
    })()
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

  /** How wrong a pooled question is for what the game is asking for now. */
  const distance = (entry: Pooled): number => {
    const want = aim() ?? ceiling ?? entry.question.difficulty
    const over = ceiling !== null && entry.question.difficulty > ceiling + EPS
    // A question above a stated ceiling is never the answer while anything else
    // exists, and is still an answer when nothing else does.
    return Math.abs(entry.question.difficulty - want) + (over ? 1000 : 0)
  }

  const flushNow = () => {
    lastFlush = Date.now()
    filledFor = aim()
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
    if (moved < FLUSH_URGENT && Date.now() - lastFlush < FLUSH_COOLDOWN_MS) return
    flushNow()
  }

  /** Fold a game's request into the standing one. Returns nothing; sets state. */
  const applyRequest = (request: DifficultyRequest | undefined) => {
    if (request === undefined) return
    if (request.maxDifficulty !== undefined) {
      const unit = readScale(request.maxDifficulty, "maxDifficulty")
      if (unit !== null) ceiling = unit
    }
    if (request.difficulty !== undefined) {
      const unit = readScale(request.difficulty, "difficulty")
      if (unit !== null) target = Math.max(unit, floor)
    }
    if (target !== null && ceiling !== null) target = Math.min(target, ceiling)
    maybeFlush()
  }

  const take = (request?: DifficultyRequest): Question => {
    lastAsk = Date.now()
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
      void client.progress(fraction).catch(() => {})
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
      void client
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
      void client.skip(questionId).catch((error: unknown) => {
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
      void client.haptic(HAPTIC[kind]).catch(() => {
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
      void client.transition(kind, label).catch((error: unknown) => {
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
      for (let i = 0; i < POOL_FLOOR && !disposed; i++) {
        const item = await client.nextItem(askShape())
        if (item === null) break
        const canonical = canReveal ? await client.reveal(item.id) : ""
        if (canonical === "") break
        const question = questionFrom(item, canonical, domain)
        fresh = question.difficulty
        pool.push({ question, skillId: item.skillId })
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
