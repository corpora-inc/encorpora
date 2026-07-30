// The room: which tablets go up in front of a lot, and what the broker will pay
// for it.
//
// A tablet is a curriculum question with its answer used as a *price*. Nothing
// here invents a sum — every rival bid is drawn from the host — and the only
// judgement this file makes is which of the questions it drew belong on the same
// board together, and how far above them the broker's offer sits.
//
// **Why the board is a tight cluster.** COUNTERPOISE shipped with its answer as
// the rightmost weight 97.2% of the time, and a bot that always took the
// rightmost weight scored 97.2% without doing any arithmetic. The equivalent hole
// here is a board whose highest bid is *obvious* — `3 × 2` next to `48 + 37` can
// be sorted by eye, and eyeballing is not retrieval. So the assembler draws more
// questions than it needs and keeps the run of values that sit closest together.
// The founder's own example is exactly that shape: `12 + 5`, `3 × 5`, `8 × 1`,
// `15 − 2` — 17, 15, 8, 13.
//
// Measured, because the size of that surplus turned out to matter: with three spare
// questions a room's values spanned 73% of its own maximum and a bot that marked
// whichever tablet had the biggest numeral printed on it was right 46% of the time.
// With ten spare, the span is 54% and the same bot is right 25% of the time.
//
// **Why the surplus does not cost ten questions a lot.** Everything drawn and not used
// goes on a BENCH and is offered to the next room, so the assembler pays for a wide
// choice once rather than every lot. A benched question has not been shown to the child
// and has not been answered, so it can appear in a later room with nothing stale about
// it — and because a tablet that reaches a board is always either answered or skipped
// when that board settles, nothing on the bench can ever be reported twice.

import type { Question } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import {
  MAX_MARGIN,
  MAX_TABLETS,
  MIN_MARGIN,
  rungCannotDraw,
  tabletValue,
  trapChance,
} from "./ladder.ts"

export type Tablet = {
  /** The question this tablet is. `""` for a question the pool could not serve. */
  readonly id: string
  /** "12 + 5", as the child reads it. Never the total. */
  readonly prompt: string
  /** What the rival is bidding. The child has to work this out. */
  readonly value: number
  /** Where on the host's ladder it came from, 0..1. */
  readonly difficulty: number
}

export type Room = {
  readonly tablets: readonly Tablet[]
  /** The highest rival bid. The number the whole round turns on. */
  readonly highest: number
  /** What the broker will pay for the lot the moment you own it. */
  readonly offer: number
}

/** No bid can be flipped for a profit: the only right move is to fold. */
export function isTrap(room: Room): boolean {
  return room.offer <= room.highest + 1
}

/** The bid that earns the most coins, or null on a lot not worth buying. */
export function bestBid(room: Room): number | null {
  return isTrap(room) ? null : room.highest + 1
}

/** What a bid earns. Negative is never charged to the child; see `Auction`. */
export function profitOf(room: Room, bid: number): number {
  return room.offer - bid
}

/** How many spare questions to choose between. Measured; see the file header. */
export const POOL_EXTRA = 10

/** Draws we are willing to make before giving up on a board. */
const MAX_DRAWS = 2 * (MAX_TABLETS + POOL_EXTRA) + 8

export type Assembly = {
  /** Null when the host served nothing this game can stand a tablet up from. */
  readonly room: Room | null
  /**
   * Usable questions drawn and not put on this board. The caller holds them for the
   * next room rather than closing them — see the file header.
   */
  readonly bench: readonly Tablet[]
  /**
   * Questions this game can never use at all: an answer that is not a price, or a
   * prompt too wide for a tablet. The caller closes these.
   */
  readonly discarded: readonly Tablet[]
}

/**
 * Put a room together.
 *
 * `draw` is the caller's one-question closure, not the host: it is the caller
 * that owns what this run is asking for, and it re-reads that on every draw so a
 * ceiling discovered on the second tablet is already on the wire for the third.
 * Everything drawn and not used comes back in `unused` so the caller can close
 * it — a question handed to a pack and never answered has to be skipped, not
 * silently dropped, or it stays open in the host's ledger forever.
 *
 * `onUndrawable` is called with a question whose whole RUNG this game cannot
 * draw, once per such question. What to do about it is the caller's; see
 * `Auction.capBelow`.
 */
export function assembleRoom(
  draw: () => Question,
  want: number,
  intensity: number,
  rng: Rng,
  onUndrawable: (q: Question) => void,
  bench: readonly Tablet[] = [],
): Assembly {
  const pool: Tablet[] = [...bench]
  const discarded: Tablet[] = []
  const seen = new Set<number>(pool.map((t) => t.value))

  for (let attempt = 0; attempt < MAX_DRAWS && pool.length < want + POOL_EXTRA; attempt++) {
    const q = draw()
    const value = tabletValue(q)
    if (value === null) {
      // Loud, every time, because a room that quietly shrinks is the failure this
      // whole file is written against.
      console.error(
        `[gavel] declined a question no tablet can carry: ${q.prompt} = ${JSON.stringify(q.answer)}`,
      )
      if (rungCannotDraw(q)) onUndrawable(q)
      discarded.push(tabletOf(q, 0))
      continue
    }
    if (seen.has(value)) {
      // Two rivals bidding the same amount has no highest, so one of them has to
      // go — and there is no board or bench it could ever join, because the value is
      // already there. This is a fact about a PAIR of questions and never about a
      // rung: a collision must not cap the stream, which is the bug that pinned
      // POLARITY to the easiest rung in the product for a whole session.
      discarded.push(tabletOf(q, value))
      continue
    }
    seen.add(value)
    pool.push(tabletOf(q, value))
  }

  if (pool.length < 2) {
    // One tablet is not a comparison, and the highest bid in a room of one is
    // whatever is in front of you. Better to say so than to ask nothing.
    console.error(
      `[gavel] the host served only ${String(pool.length)} usable question(s) in ${String(MAX_DRAWS)} draws`,
    )
    return { room: null, bench: [], discarded: [...discarded, ...pool] }
  }

  const take = Math.min(want, pool.length)
  const { kept, dropped } = tightest(pool, take)

  const highest = kept.reduce((best, t) => Math.max(best, t.value), 0)
  const offer = highest + marginFor(intensity, rng)

  // Shuffled last. The highest bid must be as likely to be in any position as any
  // other, or the position becomes the answer.
  const tablets = rng.shuffle([...kept])

  return { room: { tablets, highest, offer }, bench: dropped, discarded }
}

function tabletOf(q: Question, value: number): Tablet {
  return {
    id: q.id,
    prompt: q.prompt,
    value,
    difficulty: Number.isFinite(q.difficulty) ? Math.min(1, Math.max(0, q.difficulty)) : 0,
  }
}

/**
 * The `take` tablets whose values sit closest together, and the rest.
 *
 * Sorted by value, then the window of `take` consecutive entries with the
 * smallest span. Ties go to the lowest window, which keeps the room's prices
 * nearer the bottom of what the rung offers and costs nothing.
 */
export function tightest(
  pool: readonly Tablet[],
  take: number,
): { kept: Tablet[]; dropped: Tablet[] } {
  const sorted = [...pool].sort((a, b) => a.value - b.value)
  const n = Math.min(Math.max(1, take), sorted.length)
  let bestAt = 0
  let bestSpan = Number.POSITIVE_INFINITY
  for (let i = 0; i + n <= sorted.length; i++) {
    const lo = sorted[i]
    const hi = sorted[i + n - 1]
    if (!lo || !hi) continue
    const span = hi.value - lo.value
    if (span < bestSpan) {
      bestSpan = span
      bestAt = i
    }
  }
  const kept = sorted.slice(bestAt, bestAt + n)
  const dropped = [...sorted.slice(0, bestAt), ...sorted.slice(bestAt + n)]
  return { kept, dropped }
}

/**
 * How far the broker's offer sits above the highest rival bid.
 *
 * Zero or one is a lot nobody can profit from — see `isTrap`, and `trapChance` for
 * how often that happens. Everything else is headroom the child has to stay inside,
 * drawn from a band that deliberately does not narrow as the run climbs; the reason
 * is on `MIN_MARGIN` and it was measured.
 */
export function marginFor(intensity: number, rng: Rng): number {
  if (rng.chance(trapChance(intensity))) return rng.int(0, 1)
  return rng.int(MIN_MARGIN, MAX_MARGIN)
}

/**
 * The things that come up on the block.
 *
 * Named objects rather than "LOT 4", because a child bidding on an astrolabe is
 * doing something and a child bidding on a numbered abstraction is doing a
 * worksheet. Drawn from al-Jazari's and the Banū Mūsā's machines, which is where
 * this product's art direction is sourced.
 */
export const LOTS: readonly string[] = [
  "BRASS ASTROLABE",
  "WATER CLOCK",
  "SINGING EWER",
  "LAPIS ORRERY",
  "PEACOCK BASIN",
  "CANDLE CLOCK",
  "SIPHON CUP",
  "MECHANICAL SCRIBE",
  "GLASS ALEMBIC",
  "SILVER SEXTANT",
  "REED FLUTE ORGAN",
  "TRICK LOCK",
  "SAND GLASS",
  "STAR MAP",
  "COPPER DRUM",
  "SUN DIAL RING",
]
