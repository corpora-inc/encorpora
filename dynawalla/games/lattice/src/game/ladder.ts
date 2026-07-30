// WHAT THE LATTICE ASKS FOR — the game's one difficulty knob.
//
// The game used to ask the host for nothing at all:
//
//     const drawn = this.host.next({ domain: "add" })
//
// A domain, and never a difficulty. `domain` is documented as a cosmetic label,
// so that call is a shrug: the resonator carried whatever rung the host's own
// ladder happened to be standing on. The founder's report is both ends of what
// that costs, and they look like opposite complaints:
//
//   * **"It stays way too easy way too long … it's just stuck on 2+0 and 0+3."**
//     A session opens on rung 0 of the shipped sixty-six-rung ladder, which is
//     `dw.add.facts.add-within-ten` — answers of one to three. `2` has no factor
//     tree, so the game's second stage does not exist and the whole sitting is
//     "find a 2".
//   * **And the far end, which nobody has reported yet only because nobody got
//     there.** Above about rung 47 the host's answers are four and five digits.
//     Every one of them fails `isAskable`, so all eight draws fail, and the
//     arena *stalls*: no resonator at all. Measured over ten simulated minutes
//     of perfect play against a host modelling the shipped ladder, the arena
//     climbed out of its own usable band in about a hundred seconds and spent
//     the remaining eight minutes with nothing to answer.
//
// Both are the same bug. The game never said what it needed, so it was carried
// past it in one direction and left below it in the other.
//
// ## A floor, not a ceiling — and then a ceiling too
//
// `counterweight` had the mirror-image defect ("starts way too hard") and fixed
// it by pinning `difficulty` *and* `maxDifficulty` to the bottom rung. THE
// LATTICE cannot copy that, because the bottom rung is the thing that is broken
// here: an answer under twelve cannot carry a factor tree, so **the game must
// never ask for those items at all.** That is a floor, and it is a statement
// about what this game *is* rather than about what the child has earned.
//
// It is expressed by simply never asking below it. `host.raiseFloor` is
// deliberately not called: that primitive raises the floor under the stream
// permanently and is the right shape for an *achievement* (`siege`'s wave
// counter), and would be wrong here — the floor is a property of the pack, and a
// pack must not permanently rewrite a child's ladder for every other pack
// because of what this one can draw.
//
// The ceiling is the ordinary kind, and it exists for the ordinary reason: a
// resonator numeral is read at speed while the arena is moving, and
// `MAX_TARGET` is 999.
//
// ## And it moves on achievement
//
// Three rungs per resonator opened, four back on a refusal — the house shape,
// down faster than up. Nothing here reads a clock: a child who sits still is
// never dragged up the ladder for having stayed in the room.
//
// ## The constants are a hint, not a dependency
//
// `FLOOR` and `CEILING` are read off the shipped ladder (see the table below),
// and a ladder that grows will move them. So the game does not trust them: every
// arming walks a spread of offsets around its position and **snaps the position
// to whichever rung actually produced a resonant target**. If the usable band
// moves, the game finds it again inside one resonator and stays there.

/**
 * One rung, as a fraction of the host's ladder.
 *
 * The shipped ladder is sixty-six rungs, so a rung is 1/65 of the way up it. A
 * request is a 0..1 position (`toUnit` reads anything below 1 as a fraction),
 * and the host rounds it to the nearest rung.
 */
export const RUNGS = 66
export const RUNG = 1 / (RUNGS - 1)

/**
 * The band of the host's ladder THE LATTICE can be itself on.
 *
 * Measured by generating forty items from every rung of the shipped graph and
 * counting how many answers land in `MIN_TARGET..MAX_TARGET` with at least
 * `MIN_TILES` prime factors:
 *
 *     rung  0..13  0.00–0.20   add/subtract facts within ten     0–18% usable
 *     rung 14,15   0.22–0.23   dw.mul.facts.tables-within-five        0% usable
 *     rung 16      0.246       dw.mul.facts.tables-to-twelve        60% usable
 *     rung 18      0.277       dw.add.column.add-no-regroup         48% usable
 *     rung 30      0.462       dw.add.regroup.add-multidigit        53% usable  ← 47 + 25
 *     rung 46      0.708       dw.div.whole.divide-exact            57% usable
 *     rung 48+     0.738+      four- and five-digit answers          0% usable
 *
 * So the floor is rung 16, the first rung whose answers reach the twenties, and
 * the ceiling is rung 47, the last rung that still fits under 999.
 */
export const FLOOR = 16 * RUNG
export const CEILING = 47 * RUNG

/** Rungs a resonator opened is worth, and rungs a refusal costs. */
export const CLIMB = 3 * RUNG
export const FALL = 4 * RUNG

/**
 * Where in the band a session opens.
 *
 * The floor, and not a rung above it. The founder wants `47 + 25` "fairly
 * quickly" and not immediately: three rungs a resonator puts a child on rung 31
 * — two-digit addition with a carry, which is that question — after five of
 * them, and at the top of the band after ten.
 */
export const OPENING = FLOOR

/**
 * The offsets, in rungs, an arming tries before it gives up.
 *
 * A rung is a distribution of items and not a single question: about half the
 * answers on a usable rung are prime, or under twelve, or otherwise not
 * something a resonator can be a game about. So an arming draws more than once,
 * and drawing at the *same* rung every time is how a rung that happens to be
 * barren becomes a stalled arena. Walking outward finds the neighbour that is
 * not.
 *
 * Six rungs out at most, which is 0.09 of the ladder — inside the host's
 * `FLUSH_BAND` of 0.1, so walking the offsets does not churn the prefetch pool.
 */
export const OFFSETS: readonly number[] = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]

/**
 * How many of them one arming may actually spend.
 *
 * **Not `OFFSETS.length`, and the reason is the host's pool rather than taste.**
 * `next` is synchronous and the refill is not, so every draw an arming makes comes
 * out of whatever is already stocked. A request that moves the ladder far enough
 * flushes the pool down to `FLUSH_KEEP` — eight — and refills asynchronously, so
 * an arming that fired all thirteen offsets in one frame ran the pool dry: the
 * host logged "the question pool ran dry" five times and started handing back
 * clones of the last question *with an empty id*, whose answers it then drops. A
 * child solving a resonator nothing can be reported against is the worst failure
 * available here, and it is silent.
 *
 * Six leaves the reserve intact. An arming that misses all six stalls for
 * `REARM_MS` and tries again — by which time the pool has refilled at the
 * difficulty being asked for, and the barren tally knows six rungs more than it
 * did. The walk is a thing that happens across armings, not inside one, because
 * that is how the pipe underneath it actually works.
 */
export const MAX_DRAWS = 6

/**
 * The smoothed yield below which a rung is treated as barren and tried last.
 *
 * Ten of the thirty-two rungs in the band produce *nothing* a resonator can be a
 * game about, measured over two hundred items each from the shipped graph:
 *
 *     rung 22, 28  dw.div.facts.division-facts     quotients of 0..9
 *     rung 25      dw.add.column.add-no-regroup L2 four-digit sums
 *     rung 29,31,35 dw.mul.scale.times-power-of-ten  1050 … 921,700,000
 *     rung 38      dw.add.regroup.add-short-addend L0 four-digit sums
 *     rung 40,41,45 four- and five-digit answers
 *
 * The band's mean yield is 25%, so an arming that walks blindly spends four items
 * to find one question. Remembering which rungs never pay halves that, and the
 * item it does not spend is an item the host's prefetch pool does not have to
 * refill — a pool that empties is not a pause, it is a question with no id.
 */
export const BARREN = 0.15

/** A request, on the fraction scale — unambiguous in `toUnit` for any value < 1. */
export type Request = {
  readonly domain: string
  readonly difficulty: number
  readonly maxDifficulty: number
}

export function clampToBand(position: number): number {
  if (!Number.isFinite(position)) return OPENING
  return Math.max(FLOOR, Math.min(CEILING, position))
}

/** The rung index a request lands on, the way the host rounds it. */
export function rungOf(difficulty: number): number {
  return Math.max(0, Math.min(RUNGS - 1, Math.round(difficulty * (RUNGS - 1))))
}

/**
 * Where the game is standing on the host's ladder, and how it got there.
 *
 * Pure: it holds a number, it is moved by two things the child did, and it
 * hands out requests. It never touches a host and never reads a clock.
 */
export class Ladder {
  private position = OPENING
  /** What each rung has actually produced. See `BARREN`. */
  private readonly tally = new Map<number, { draws: number; hits: number }>()

  /** The request the game is currently making, before any offset. */
  get at(): number {
    return this.position
  }

  get rung(): number {
    return rungOf(this.position)
  }

  /**
   * A rung's observed yield, Laplace-smoothed so a rung nobody has tried is
   * optimistic rather than suspect.
   *
   * One hit out of one is 0.75 and not 1, and nought out of one is 0.25 and not
   * 0 — so a single unlucky draw never writes a rung off, and three do.
   */
  yieldOf(rung: number): number {
    const seen = this.tally.get(rung)
    if (!seen) return 1
    return (seen.hits + 0.5) / (seen.draws + 1)
  }

  /** One draw at `rung`, and whether it produced something to play. */
  drew(rung: number, hit: boolean): void {
    const seen = this.tally.get(rung) ?? { draws: 0, hits: 0 }
    seen.draws += 1
    if (hit) seen.hits += 1
    this.tally.set(rung, seen)
  }

  /**
   * The requests to try, in order, for one arming.
   *
   * Nearest first, deduplicated by rung — at the floor, offsets of 0 and −2 are
   * the same rung once clamped, and drawing the same rung twice in a row is a
   * wasted item — and then a *stable partition* that moves the rungs known to
   * produce nothing to the back.
   *
   * A stable partition and not a sort by yield. Sorting would make the game hop
   * to whichever rung in the band happens to be most fertile, which would quietly
   * replace "how hard the game thinks this child is working" with "which
   * curriculum row generates the roundest numbers". Nearness still decides the
   * order among rungs that pay; the only thing memory does is stop paying for the
   * ones that never do.
   */
  requests(domain: string): readonly Request[] {
    const live: Request[] = []
    const barren: Request[] = []
    const seen = new Set<number>()
    for (const offset of OFFSETS) {
      const difficulty = clampToBand(this.position + offset * RUNG)
      const rung = rungOf(difficulty)
      if (seen.has(rung)) continue
      seen.add(rung)
      const request = { domain, difficulty, maxDifficulty: CEILING }
      if (this.yieldOf(rung) < BARREN) barren.push(request)
      else live.push(request)
    }
    return [...live, ...barren].slice(0, MAX_DRAWS)
  }

  /**
   * An arming succeeded at `difficulty`. The position moves there.
   *
   * This is what makes `FLOOR` and `CEILING` a hint rather than a dependency: a
   * position sitting on a barren rung is corrected by the first arming that
   * finds a live one, and it stays corrected.
   */
  landed(difficulty: number): void {
    this.position = clampToBand(difficulty)
  }

  /** A resonator opened. Achievement, never a clock. */
  opened(): void {
    this.position = clampToBand(this.position + CLIMB)
  }

  /** A refusal. Down further than up, so a struggling child is met quickly. */
  refused(): void {
    this.position = clampToBand(this.position - FALL)
  }
}
