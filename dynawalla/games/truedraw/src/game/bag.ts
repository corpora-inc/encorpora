// THE BAG. The score, and the arithmetic that makes guessing lose.
//
//   > "your correct keeps build your bag (score), incorrect discard/keep
//   > diminishes your bag"
//
// Three numbers, and the relationships between them are the whole economy. Every
// one of them is asserted in `bag.test.ts` and every one of them is load-bearing.
//
// ── 1. a coin flip must LOSE, not merely fail to win ─────────────────────────
//
// The truth bag deals true and false in exact halves (`schedule.ts`), so a child
// who swipes at random without reading is right exactly 50% of the time. If a
// correct call paid as much as a wrong call cost, that child would break even and
// the bag would be a random walk with no drift — which is a bag that rewards
// mashing, because mashing is faster than reading and the walk is free.
//
// So:
//
//     COIN_WRONG > COIN_BASE + COIN_QUICK
//
// A wrong verdict costs strictly more than the most a right one can ever pay.
// That makes the drift of any strategy that does not read the slate strictly
// negative — at any speed, in any mixture of the two gestures, including the two
// degenerate ones (keep everything, toss everything), because the halves are
// exact. `economy.test.ts` plays that out with bots rather than asserting it.
//
// ── 2. being right is worth more than being fast ─────────────────────────────
//
//     COIN_BASE > COIN_QUICK
//
// The bonus for speed can never be more than the reward for being right. A child
// who is right and slow banks more than half of the maximum; a child who is fast
// and wrong banks nothing and loses twelve. Speed is a bonus on top of correct and
// is never a substitute for it.
//
// ── 3. slowness is measured and never punished ───────────────────────────────
//
// `EXPERIENCE_DESIGN.md`, and the founder's standing rule: measure and reward,
// never punish. There is no branch in this file that subtracts anything for a
// slow call. `coinsFor` on a correct outcome returns `COIN_BASE` at worst and
// `COIN_BASE + COIN_QUICK` at best, and `bag.test.ts` proves that by sweeping
// every reaction from 0 to ten times p50.
//
// ── 4. a lapse costs nothing ─────────────────────────────────────────────────
//
// A window that closed untouched is not a verdict, so it is not priced. Zero
// coins, zero shots.
//
// The obvious worry is the SLICE failure: an outcome that costs nothing might
// dominate one that can cost something, and then never answering is the optimal
// play. It does not dominate here, and the reason is arithmetic rather than
// taste. Waiting pays exactly 0. A verdict pays `p × (6..10) − (1 − p) × 12`,
// which is positive for every `p > 0.55`. So waiting beats answering only for a
// child who is guessing — which is the child we want to stop guessing — and a
// waiter's bag is a flat zero forever while a reader's grows without bound.
// `economy.test.ts` plays a bot that waits every single window out and asserts
// its bag ends at zero.
//
// ── 5. the bag floors at zero and never goes negative ────────────────────────
//
// A bag cannot hold minus four coins, and a number below zero on a child's screen
// is a debt. It floors. That does mean a bag already at zero cannot be diminished
// further — the run's three shots are what stop a child mashing from the floor,
// and they are unchanged.

import { isCorrect, type Outcome } from "./response.ts"

/** Every correct verdict pays this, at any speed. The reward for being right. */
export const COIN_BASE = 6

/** The most that speed can add on top. Strictly less than the base — see (2). */
export const COIN_QUICK = 4

/** What a wrong keep or a wrong toss takes. Strictly more than the best gain. */
export const COIN_WRONG = 12

/**
 * What an outcome is worth, in coins, given how quick the call was.
 *
 * `quickness` is 0..1 from `cadence.quicknessOf` — the share of the item's own
 * p50 the child did NOT use. Out-of-range values are clamped rather than
 * trusted: it arrives from a division by a table lookup, and a NaN reaching the
 * bag would make the score `NaN` for the rest of the run.
 */
export function coinsFor(outcome: Outcome, quickness: number): number {
  if (outcome === "lapse") return 0
  if (!isCorrect(outcome)) return -COIN_WRONG
  const credit = Number.isFinite(quickness) ? Math.max(0, Math.min(1, quickness)) : 0
  return COIN_BASE + Math.round(COIN_QUICK * credit)
}

/** Coins in, coins out, floored at nothing. */
export function addCoins(bag: number, coins: number): number {
  return Math.max(0, bag + coins)
}

/**
 * The most a single call can ever be worth. Exported because the guessing proof
 * is stated against it rather than against the two constants separately.
 */
export const COIN_MAX = COIN_BASE + COIN_QUICK
