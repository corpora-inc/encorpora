// The escalation ladder.
//
// Three dials move together and they are the whole difficulty curve:
//   1. the target fraction climbs (more of the plane, less room to work),
//   2. the band narrows (precision, in exact cells),
//   3. the hunt thickens (more of them, faster, and eventually charging),
// and a fourth quietly removes the training wheels: the numeric readout, then
// the meter's ghost marker, until all that is left is your own estimate.

import { partOf } from "./exact.ts"

export type HelpLevel = 0 | 1 | 2

export type Level = {
  index: number
  /** Fallback goal when the host's question isn't a usable cell count. */
  goal: { n: number; d: number }
  /** Half-width of the winning band, in cells. Exact integer, never a percent. */
  band: number
  drifters: number
  crawlers: number
  chargers: number
  /** Cells per second along the rail. */
  railSpeed: number
  /** Cells per second while cutting. */
  cutSpeed: number
  hunterSpeed: number
  /** Seconds of a stalled trail before the fuse starts eating it. */
  fuseGrace: number
  /**
   * 2 — ghost region, live numbers and a meter marker.
   * 1 — ghost region and a meter marker. No numbers.
   * 0 — ghost region only. Estimate it.
   */
  help: HelpLevel
  /** Seconds of no claim before the arena answers with another hunter. */
  pressure: number
  /**
   * The largest share of the plane this level may ask for, as a percentage.
   *
   * The host decides what mathematics comes next; the game decides what is a
   * fair amount of ground to take with one drifter and a full arena. A
   * curriculum that opens on 9/10 would make level one a twenty-minute slog,
   * so a question outside this window is spent on a revive gate instead of
   * being thrown away.
   */
  maxShare: number
}

const LADDER: Omit<Level, "index">[] = [
  { goal: { n: 1, d: 2 }, band: 432, drifters: 1, crawlers: 0, chargers: 0, railSpeed: 25, cutSpeed: 18, hunterSpeed: 13, fuseGrace: 1.8, help: 2, pressure: 22, maxShare: 55 },
  { goal: { n: 2, d: 3 }, band: 360, drifters: 1, crawlers: 1, chargers: 0, railSpeed: 26, cutSpeed: 19, hunterSpeed: 14, fuseGrace: 1.7, help: 2, pressure: 20, maxShare: 70 },
  { goal: { n: 3, d: 4 }, band: 288, drifters: 2, crawlers: 1, chargers: 0, railSpeed: 27, cutSpeed: 19, hunterSpeed: 15, fuseGrace: 1.6, help: 2, pressure: 19, maxShare: 78 },
  { goal: { n: 3, d: 5 }, band: 252, drifters: 2, crawlers: 1, chargers: 0, railSpeed: 28, cutSpeed: 20, hunterSpeed: 16, fuseGrace: 1.5, help: 1, pressure: 18, maxShare: 80 },
  { goal: { n: 5, d: 8 }, band: 216, drifters: 2, crawlers: 2, chargers: 0, railSpeed: 29, cutSpeed: 21, hunterSpeed: 17, fuseGrace: 1.4, help: 1, pressure: 17, maxShare: 82 },
  { goal: { n: 7, d: 10 }, band: 180, drifters: 3, crawlers: 1, chargers: 1, railSpeed: 30, cutSpeed: 21, hunterSpeed: 18, fuseGrace: 1.3, help: 1, pressure: 16, maxShare: 85 },
  { goal: { n: 5, d: 6 }, band: 144, drifters: 3, crawlers: 2, chargers: 1, railSpeed: 31, cutSpeed: 22, hunterSpeed: 19, fuseGrace: 1.2, help: 0, pressure: 15, maxShare: 88 },
  { goal: { n: 4, d: 5 }, band: 108, drifters: 3, crawlers: 2, chargers: 1, railSpeed: 32, cutSpeed: 23, hunterSpeed: 20, fuseGrace: 1.1, help: 0, pressure: 14, maxShare: 90 },
  { goal: { n: 7, d: 8 }, band: 90, drifters: 4, crawlers: 2, chargers: 1, railSpeed: 33, cutSpeed: 23, hunterSpeed: 21, fuseGrace: 1.0, help: 0, pressure: 13, maxShare: 92 },
]

const ENDLESS_GOALS = [
  { n: 5, d: 6 },
  { n: 7, d: 9 },
  { n: 9, d: 10 },
  { n: 11, d: 12 },
  { n: 7, d: 8 },
  { n: 4, d: 5 },
]

/** Level `i`, 1-based. Past the hand-written ladder it keeps tightening. */
export function levelAt(i: number): Level {
  if (i <= LADDER.length) {
    return { index: i, ...(LADDER[i - 1] as Omit<Level, "index">) }
  }
  const over = i - LADDER.length
  const last = LADDER[LADDER.length - 1] as Omit<Level, "index">
  return {
    index: i,
    goal: ENDLESS_GOALS[(over - 1) % ENDLESS_GOALS.length] as { n: number; d: number },
    band: Math.max(72, last.band - over * 4),
    drifters: Math.min(6, last.drifters + Math.floor(over / 2)),
    crawlers: Math.min(4, last.crawlers + Math.floor(over / 3)),
    chargers: Math.min(3, last.chargers + Math.floor(over / 4)),
    railSpeed: Math.min(40, last.railSpeed + over),
    cutSpeed: Math.min(29, last.cutSpeed + over),
    hunterSpeed: Math.min(28, last.hunterSpeed + over),
    fuseGrace: Math.max(0.7, last.fuseGrace - over * 0.05),
    help: 0,
    pressure: Math.max(10, last.pressure - over),
    maxShare: 95,
  }
}

export type Goal = {
  /** Exact cell count to land on. */
  target: number
  /** Inclusive lower edge of the winning band, in cells. */
  lo: number
  /** Inclusive upper edge. One cell past this and the cut falls apart. */
  hi: number
  /** How the goal is written on the card. */
  n: number
  d: number
  /** The host's prompt, shown verbatim when there is one. */
  prompt: string
  /**
   * The question this goal was drawn from, or `null` when the ladder's own
   * fraction stood in.
   *
   * **The cut is never reported as this question's answer, and must not be.**
   * A level clears the moment `claimed` crosses `lo`, and `lo` is a whole band
   * below `target` — 432 cells of 7200 on level one. The host judges an answer
   * by exact value, so reporting the cell count a child stopped on would post a
   * wrong answer for a level they just won, and every clear would ratchet their
   * position down the ladder. The band is motor tolerance, not a tolerance on
   * the mathematics, and there is no way to say "within tolerance" over
   * `items.answer`.
   *
   * So the cut is not an answer here. The revive gate is: three plates, one of
   * them the canonical value, and the label the child drives into is reported
   * verbatim — exact in, exact out. This id is still what keeps a question that
   * *became* a goal from also being held back as the gate's spare.
   */
  questionId: string | null
}

/**
 * Turn the host's question into a goal, if it can be one.
 *
 * A host that hands back "15 − 8" is not describing an area, so the ladder's
 * own fraction stands and the question is spent on the revive gate instead.
 * The game must not depend on any particular curriculum being plugged in.
 */
export function goalFromQuestion(
  level: Level,
  total: number,
  q: { id: string; prompt: string; answer: string } | null,
): Goal {
  const raw = q ? Number(q.answer) : NaN
  const usable =
    Number.isInteger(raw) && raw > 0 && raw * 100 <= total * level.maxShare && raw >= total / 20
  const target = usable ? raw : partOf(total, level.goal.n, level.goal.d)
  const g = gcdInt(target, total)
  return {
    target,
    lo: Math.max(1, target - level.band),
    hi: Math.min(total, target + level.band),
    n: target / g,
    d: total / g,
    prompt: usable && q ? q.prompt : `${level.goal.n}/${level.goal.d} of ${total}`,
    questionId: usable && q ? q.id : null,
  }
}

function gcdInt(a: number, b: number): number {
  let x = a
  let y = b
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}
