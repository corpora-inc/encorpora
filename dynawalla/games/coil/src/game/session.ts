// The run: rounds, the wall that gets built, and the one report per item.
//
// Deliberately DOM-free and clock-free — every dependency is injected — so the
// whole rule set is tested in Node with no canvas, no host and no frame.
//
// **The wall never regresses.** A wrong cut costs slag, which the lane clears
// again; it never takes a brick back out. That is the child-safe form of loss
// aversion the programme is built on: the pull to come back is "my wall is
// unfinished", not "my streak is at risk".

import type { Question } from "../contract.ts"
import { coilOf, valueOf } from "./place.ts"
import {
  type Board,
  type Shear,
  aim,
  breakAtCut,
  createBoard,
  reload,
  settle,
  shear,
  stoke,
} from "./board.ts"
import { type Mode, type Round, claimOf, isExact, roundFrom } from "./round.ts"

/** Exact cuts that finish a course of the wall. */
export const COURSE = 8

/** Questions refused in a row before the run gives up asking. */
const REFUSAL_LIMIT = 24

export type Brick = {
  /**
   * The number the child made, not the piece they cut.
   *
   * The wall is a record of answers produced — in a take that is the coil that
   * crawled on, in a fill it is the ingot's new total — because "what I made"
   * is the thing worth looking back at, and the piece was only ever the means.
   */
  readonly value: number
  readonly mode: Mode
  /** The course this brick sits in, from zero. */
  readonly course: number
}

export type Outcome = {
  readonly round: Round
  readonly severed: number
  readonly claimed: number
  readonly exact: boolean
  readonly piece: readonly number[]
  readonly rest: readonly number[]
  readonly ms: number
}

export type Report = {
  questionId: string
  correct: boolean
  ms: number
  answered: string
}

export type SessionDeps = {
  /** The next question, or `null` when the host has nothing. */
  readonly nextQuestion: () => Question | null
  readonly report: (r: Report) => void
  /** Milliseconds. Injected so a test does not race a real clock. */
  readonly now: () => number
  /** Cells the lane offers. Re-set when the viewport changes. */
  capacity: number
  /** A natural stopping point was reached. Never called after a miss. */
  readonly transition?: (kind: "level" | "run" | "boss", label?: string) => void
}

export type Session = ReturnType<typeof createSession>

export function createSession(deps: SessionDeps) {
  let round: Round | null = null
  let board: Board = createBoard(coilOf(96), deps.capacity)
  let startedAt = deps.now()
  let answered = 0
  let exactCuts = 0
  const wall: Brick[] = []
  /** Ids already reported, so a double lever-pull cannot inflate a record. */
  const spent = new Set<string>()

  const load = (): boolean => {
    for (let attempt = 0; attempt < REFUSAL_LIMIT; attempt++) {
      const question = deps.nextQuestion()
      if (question === null) break
      const next = roundFrom(question)
      // An item this game cannot cut — a fraction, an empty pool, a family with
      // no prompt renderer — is skipped rather than approximated, and the host
      // is asked again. It is never reported, so nothing is recorded against a
      // child for a question the pack declined to draw.
      if (next === null) continue
      round = next
      board.capacity = deps.capacity
      reload(board, coilOf(next.coil))
      startedAt = deps.now()
      return true
    }
    round = null
    return false
  }

  load()

  return {
    get round(): Round | null {
      return round
    },
    get board(): Board {
      return board
    },
    get wall(): readonly Brick[] {
      return wall
    },
    get answered(): number {
      return answered
    },
    get exactCuts(): number {
      return exactCuts
    },
    /** 0..1 across the current course. Drawn as a course being laid. */
    get courseProgress(): number {
      return (exactCuts % COURSE) / COURSE
    },

    /** The lane geometry changed. Keeps the shear where the child left it. */
    resize(capacity: number): void {
      deps.capacity = capacity
      board.capacity = capacity
      aim(board, board.cut)
    },

    aim(cut: number): void {
      aim(board, cut)
    },

    /** The borrow. Returns false when the shear is on a link worth one. */
    crack(): boolean {
      return breakAtCut(board)
    },

    /** What the lever would take right now, without taking it. */
    preview(): Shear {
      return shear(board)
    },

    /**
     * Pull the lever.
     *
     * One report per item, and the report carries the number the machine is
     * left holding — not the game's opinion of it. `correct` is what the game
     * believes so the host can see the disagreement; the host is the judge.
     */
    commit(): Outcome | null {
      if (!round) return null
      const result = shear(board)
      const exact = isExact(round, result.severed)
      const claimed = claimOf(round, result.severed)
      const ms = Math.max(0, Math.round(deps.now() - startedAt))

      if (!spent.has(round.questionId) && round.questionId !== "") {
        spent.add(round.questionId)
        deps.report({
          questionId: round.questionId,
          correct: exact,
          ms,
          answered: String(claimed),
        })
      }

      answered += 1
      settle(board, exact)
      // The piece is gone from the lane the instant the jaws close, so the coil
      // the child is looking at is always the coil they are holding. What flies
      // to the wall is drawn by the renderer, not by the board.
      reload(board, result.rest)
      if (exact) {
        exactCuts += 1
        wall.push({
          value: claimed,
          mode: round.mode,
          course: Math.floor((exactCuts - 1) / COURSE),
        })
        // A course laid is a stopping point the child *reached*. Never fired on
        // a miss: a purchase surface must not sit next to a failure.
        if (exactCuts % COURSE === 0) {
          deps.transition?.("level", `course ${String(exactCuts / COURSE)}`)
        }
      }

      return {
        round,
        severed: result.severed,
        claimed,
        exact,
        piece: result.piece,
        rest: result.rest,
        ms,
      }
    },

    /** The next coil enters. Slag stays; that is the point of slag. */
    advance(): boolean {
      return load()
    },

    /**
     * Feed the coil to the furnace and melt every lump.
     *
     * Nothing is reported: the child did not answer, and an unanswered item is
     * one the host simply never hears about. It is the only way out of a lane
     * choked badly enough that the links worth borrowing from are buried, and
     * it costs a coil rather than a record.
     */
    stoke(): boolean {
      stoke(board)
      return load()
    },

    /** Diagnostic only. Never drawn: this is the answer. */
    debugCoilValue(): number {
      return valueOf(board.links)
    },
  }
}
