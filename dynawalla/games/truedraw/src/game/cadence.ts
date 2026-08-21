// The child's time, taken from the repo's own numbers.
//
// `dynawalla/docs/EXPERIENCE_DESIGN.md` writes the law down twice:
//
//   > `T=0→C` COMPREHENSION — not budgeted. The child's time. Measured, never
//   > limited.
//
// and then gives the measurements it was made from — instrumented p50/p90, never
// shown to the child:
//
//   | class                     | p50    | p90    |
//   |---------------------------|--------|--------|
//   | single-digit fact         |  2.8 s |  6 s   |
//   | two-digit with regrouping |  6 s   | 14 s   |
//   | the `5,001 − 2,798` class | 16 s   | 40 s   |
//
// A game cannot literally not budget the window — the slate has to go down
// again — so the honest reading of "measured, never limited" is: **the window is
// derived from the measurement, and it is derived per item.**
//
// That gives one invariant the whole fleet has to hold:
//
//   **the comprehension window is MONOTONE NON-DECREASING in item difficulty.**
//
// A harder item may never get less time than an easier one. This game used to
// break it by construction — `max(1750, min(3600, 1300 + 215d))` — because the
// upper clamp bit long before the difficulty did, so the harder the item, the
// smaller the fraction of the child's own measured need it received. The ramp
// was inverted by the cap.
//
// The target here is **p90, not p50**. p50 is by definition the window half the
// children do not finish inside, and in this game not finishing inside the
// window costs one of only three shots. Sizing to p50 would spend a shot on half
// the class for having a normal amount of thinking to do.

/** The cadence table, verbatim, in milliseconds. */
export const CADENCE = {
  /** `7 + 8`. */
  fact: { p50: 2800, p90: 6000 },
  /** `47 + 25`, carry and all. */
  regroup: { p50: 6000, p90: 14000 },
  /** `5,001 − 2,798` — four columns, a borrow travelling through a zero. */
  wide: { p50: 16000, p90: 40000 },
} as const

/**
 * The anchors the load axis interpolates between. Load 1 is a fact, load 2 is
 * two-digit regrouping, load 3 is the widest class in the table.
 */
const ANCHORS = [CADENCE.fact, CADENCE.regroup, CADENCE.wide] as const

/**
 * How many digits are in the widest *operand*.
 *
 * The operands, not the whole statement: the columns a child has to work are the
 * ones in `47 + 25`, and the claimed value on the right of the `=` is a thing
 * they compare against, not a thing they compute. `"47 + 25 = 72"` is two.
 *
 * Text with no numeral in it at all — which only happens when the question pool
 * has run dry — reads as one, the cheapest class. It is never a real item.
 */
export function operandWidth(text: string): number {
  const left = text.split("=")[0] ?? text
  let width = 0
  let run = 0
  for (const ch of left) {
    if (ch >= "0" && ch <= "9") {
      run += 1
      if (run > width) width = run
    } else run = 0
  }
  return Math.max(1, width)
}

/**
 * Where an item of this operand width sits on the cadence table's axis, 1..3.
 *
 * Strictly non-decreasing in `width`, which is what makes every window derived
 * from it non-decreasing too. Three digits sits halfway between two-digit
 * regrouping and the four-column class because that is where the work sits: one
 * more column than the former, one fewer than the latter.
 */
export function comprehensionLoad(width: number): number {
  if (width <= 1) return 1
  if (width === 2) return 2
  if (width === 3) return 2.5
  return 3
}

function interpolate(load: number, key: "p50" | "p90"): number {
  const clamped = Math.max(1, Math.min(3, load))
  const lo = Math.min(1, Math.floor(clamped) - 1)
  const t = clamped - (lo + 1)
  const a = ANCHORS[lo] ?? CADENCE.fact
  const b = ANCHORS[lo + 1] ?? CADENCE.wide
  return Math.round(a[key] + (b[key] - a[key]) * t)
}

/** Half the children are done by here. Not a window — a beat. */
export function comprehensionP50Ms(load: number): number {
  return interpolate(load, "p50")
}

/** Nine in ten children are done by here. This is what a window has to be. */
export function comprehensionP90Ms(load: number): number {
  return interpolate(load, "p90")
}

/** The whole chain, for a piece of statement text. */
export function comprehensionMsFor(text: string): number {
  return comprehensionP90Ms(comprehensionLoad(operandWidth(text)))
}

/** The p50 beat for a piece of statement text. What "quick" is measured against. */
export function p50MsFor(text: string): number {
  return comprehensionP50Ms(comprehensionLoad(operandWidth(text)))
}

/**
 * The share of the child's own p50 that a call did NOT use, as 0..1 credit.
 *
 * ── why p50 and not the window ───────────────────────────────────────────────
 *
 * The window is p90, and p90 is nine-tenths of the class. Scoring speed against
 * it would hand almost every child almost full credit and measure nothing. p50
 * is the beat half the class beats, so it is the only number in the table that
 * discriminates.
 *
 * ── why it floors at zero and never goes negative ────────────────────────────
 *
 * The standing rule is measure and reward, never punish. A child who takes twice
 * their class's p50 and gets it right scores `COIN_BASE` — the whole of the
 * reward for being right, and not one coin less than a fast child's base. What
 * they do not get is the bonus. There is no branch anywhere that subtracts for
 * slowness, and `bag.test.ts` asserts that by exhaustion.
 *
 * ── the floor at QUICK_FLOOR ─────────────────────────────────────────────────
 *
 * Full credit at 35% of p50 rather than at zero. A curve that only paid out at
 * literally-instant would be a curve nobody is ever paid by, and it would reward
 * a child who had pre-loaded the gesture over one who read the slate and moved
 * decisively. 35% of a two-digit regroup's p50 is 2.1 s, which is a real child
 * reading a real sum and knowing.
 */
export const QUICK_FLOOR = 0.35

export function quicknessOf(reactionMs: number, p50Ms: number): number {
  if (!Number.isFinite(reactionMs) || !Number.isFinite(p50Ms) || p50Ms <= 0) return 0
  const ratio = Math.max(0, reactionMs) / p50Ms
  const credit = (1 - ratio) / (1 - QUICK_FLOOR)
  return Math.max(0, Math.min(1, credit))
}
