// Shared scaffolding for the rules tests: a recording host, and the players.
//
// Every test in this package is seeded from a literal. Nothing here reads
// `Math.random`, `Date.now` or `performance.now`, so a run that passes passes
// every time and a run that fails fails every time.
//
// **The players are the argument of this pack.** COUNTERPOISE shipped with its
// answer as the rightmost weight 97.2% of the time and a bot that always took the
// rightmost weight scored 97.2% without doing any arithmetic. So the bots here are
// written to be the strongest thing a child could do *without* working the room
// out, and `bots.test.ts` requires each of them to be beaten decisively.
//
// Every bot below is restricted to what is on the screen: the prompt strings, the
// broker's offer, and nothing else. `playPerfect` is the only player that is
// allowed to read `tablet.value`, because reading it is exactly the arithmetic
// being claimed.

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Auction } from "../game/auction.ts"
import { isTrap, type Room } from "../game/lot.ts"
import { createStubHost } from "../stubHost.ts"

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

export type Rig = {
  host: Host
  game: Auction
  reports: Report[]
  skips: string[]
  transitions: Array<{ kind: string; label?: string }>
  haptics: string[]
}

export function rig(seed = 0x9a7e1, opts: { difficulty?: number } = {}): Rig {
  const reports: Report[] = []
  const skips: string[] = []
  const transitions: Array<{ kind: string; label?: string }> = []
  const haptics: string[] = []
  const host = createStubHost({
    seed,
    reducedMotion: true,
    ...(opts.difficulty === undefined ? {} : { difficulty: opts.difficulty }),
    onReport: (r) => reports.push(r),
    onSkip: (id) => skips.push(id),
    onHaptic: (k) => haptics.push(k),
    onTransition: (kind, label) =>
      transitions.push(label === undefined ? { kind } : { kind, label }),
  })
  const game = new Auction(host, new Rng(seed ^ 0x1234), 0)
  game.begin(0)
  return { host, game, reports, skips, transitions, haptics }
}

/** A wall clock that ticks a fixed amount per call. No real time anywhere. */
export function stepClock(step = 4200): () => number {
  let t = 0
  return () => {
    t += step
    return t
  }
}

/** Put a number on the paddle, digit by digit, the way a child does. */
export function typeBid(game: Auction, bid: number): void {
  for (const ch of String(Math.max(0, Math.floor(bid)))) game.pressDigit(Number(ch))
}

/** Clear whatever is on the paddle. */
export function clearBid(game: Auction): void {
  while (game.digits !== "") game.backspace()
}

/** Take the room through the reveal and on to the next lot. */
export function settleOn(game: Auction, clock: () => number): void {
  game.nudge()
  game.advance(1, clock())
}

/** The largest number printed anywhere on a tablet's face. Surface only. */
export function largestVisible(prompt: string): number {
  let best = 0
  for (const token of prompt.match(/\d+/g) ?? []) best = Math.max(best, Number(token))
  return best
}

export type Player = {
  readonly name: string
  /** One decision on the room in front of you. Return nothing; act on the game. */
  act(game: Auction, room: Room, rng: Rng, now: number): void
}

/**
 * A child who works the room out: find the highest bid, mark it, bid one over —
 * and fold when the broker's offer is not above the room at all.
 */
export const PERFECT: Player = {
  name: "computes the room",
  act(game, room, _rng, now) {
    if (isTrap(room)) {
      game.fold()
      return
    }
    const at = room.tablets.findIndex((t) => t.value === room.highest)
    game.tapTablet(at)
    typeBid(game, room.highest + 1)
    game.hammer(now)
  },
}

/**
 * A child who works the room out and forgets the one: marks the highest tablet and
 * bids exactly what it says.
 *
 * The requirement it exists to prove is "a child who bids the max instead of max+1
 * should win nothing".
 */
export const BIDS_THE_MAX: Player = {
  name: "bids the highest, not one over",
  act(game, room, _rng, now) {
    const at = room.tablets.findIndex((t) => t.value === room.highest)
    game.tapTablet(at)
    typeBid(game, room.highest)
    game.hammer(now)
  },
}

/**
 * A child who works the room out and never looks at the broker's offer: marks the
 * highest tablet and pads the bid by five to be safe.
 *
 * The requirement it exists to prove is "a child who ignores the resale price
 * should lose money".
 */
export const IGNORES_THE_OFFER: Player = {
  name: "pads the bid and ignores the offer",
  act(game, room, _rng, now) {
    const at = room.tablets.findIndex((t) => t.value === room.highest)
    game.tapTablet(at)
    typeBid(game, room.highest + 5)
    game.hammer(now)
  },
}

/**
 * A child who reads only the broker's offer and never a single sum: mark anything,
 * bid one under the offer.
 *
 * This is the strongest arithmetic-free strategy the game admits, and the reason
 * `KEEN_MULTIPLIER` exists: without the keen bonus this bot wins nearly every lot
 * and, wherever the margin is two, its blind bid is the perfect bid.
 */
export const READS_ONLY_THE_OFFER: Player = {
  name: "bids one under the offer",
  act(game, room, _rng, now) {
    game.tapTablet(0)
    typeBid(game, Math.max(1, room.offer - 1))
    game.hammer(now)
  },
}

/**
 * A child who sorts the room by eye: mark the tablet with the biggest number
 * printed on it, and bid one over that number.
 *
 * The heuristic COUNTERPOISE fell to, in this game's shape. On the founder's own
 * example room — `12 + 5`, `3 × 5`, `8 × 1`, `15 − 2` — it marks `15 − 2` and bids
 * 16, which is under the room and buys nothing.
 */
export const EYEBALLS_THE_ROOM: Player = {
  name: "marks the biggest printed number",
  act(game, room, _rng, now) {
    let at = 0
    let best = -1
    for (let i = 0; i < room.tablets.length; i++) {
      const seen = largestVisible(room.tablets[i]?.prompt ?? "")
      if (seen > best) {
        best = seen
        at = i
      }
    }
    game.tapTablet(at)
    typeBid(game, best + 1)
    game.hammer(now)
  },
}

/** A child who mashes: mark something, put some digits in, hit the hammer. */
export const MASHES: Player = {
  name: "mashes",
  act(game, room, rng, now) {
    game.tapTablet(rng.int(0, room.tablets.length - 1))
    typeBid(game, rng.int(1, room.offer + 4))
    game.hammer(now)
  },
}

/** A child who folds everything. Safe, and earns only the scout's fee. */
export const FOLDS: Player = {
  name: "folds everything",
  act(game) {
    game.fold()
  },
}

export type Sitting = {
  /** Coins earned by the player under test, after any warm-up is discounted. */
  readonly coins: number
  readonly decisions: number
  readonly reports: readonly Report[]
  readonly game: Auction
}

/**
 * Play `decisions` lots with one player and report what the strongbox holds.
 *
 * A *decision* is the budget, not a lot: a child's sitting is bounded by their
 * attention, and a strategy that keeps failing has to work through the lots it
 * generated with the same attention as everybody else. So a strategy that loses
 * lots does not get extra turns to make up for it, which is the honest comparison.
 *
 * `warm` plays that many lots perfectly first and then hands the room over. It
 * exists because the room's shape rides the run's intensity: a bot dropped into a
 * fresh session is always judged against wide broker margins and no traps, which is
 * the kindest possible board for a strategy that does no arithmetic. Coins banked
 * during the warm-up are discounted.
 */
export function play(
  player: Player,
  decisions: number,
  seed = 0x9a7e1,
  opts: { difficulty?: number; step?: number; warm?: number } = {},
): Sitting {
  const r = rig(seed, opts)
  const rng = new Rng(seed ^ 0x5151)
  const clock = stepClock(opts.step ?? 4200)
  for (let i = 0; i < (opts.warm ?? 0); i++) {
    const room = r.game.room
    if (!room || r.game.stalled) break
    PERFECT.act(r.game, room, rng, clock())
    settleOn(r.game, clock)
  }
  const banked = r.game.coins
  const before = r.reports.length
  let made = 0
  for (let i = 0; i < decisions; i++) {
    const room = r.game.room
    if (!room || r.game.stalled) break
    player.act(r.game, room, rng, clock())
    made++
    settleOn(r.game, clock)
  }
  return {
    coins: r.game.coins - banked,
    decisions: made,
    reports: r.reports.slice(before),
    game: r.game,
  }
}

export function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}
