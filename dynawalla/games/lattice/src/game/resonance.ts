// THE RESONANCE — where the thinking is.
//
// The passive layer of this game is absorption: shooting a husk apart, watching
// 12 become 4 and 3 and then 2 and 2 and 3, sweeping the primes up, seeing the
// tile bar read `2·2·3` under a running 12. A child gets that hundreds of times
// a session with sound and colour attached, and it is worth having, but it is
// not reasoning. Nothing is chosen.
//
// The resonator is the choice. It hangs in the lattice carrying a problem the
// curriculum drew — `47 + 25` — and it opens for exactly one thing: a bank
// holding a set of primes whose product is the answer. To open it a child has
// to work out the answer, decide which primes on the field multiply to it,
// crack the husks that hold those primes and no others, and sweep them and
// **nothing else**, because the bank is exact. Sweeping a stray 5 on the way
// past is a real cost — it does not scold, but it does not resonate either.
//
// Three properties, each asserted in `resonance.test.ts`:
//
//   1. **A target opens only to a genuine prime factorisation of it.** Every
//      tile prime, product exactly the target. By unique factorisation the bank
//      is then *the* prime factorisation of the target, not merely one product
//      that happens to land.
//   2. **A prime target is a wall.** Nothing assembled out of smaller factors
//      reaches it; the only bank that opens a prime `p` is the single mote `p`,
//      which has to be found drifting on the field rather than built.
//   3. **The empty bank asserts nothing.** Flying through a resonator with an
//      empty hold is not a wrong answer and is not reported — it is a child
//      moving through the arena.

import { isPrime, LARGEST_MOTE_PRIME, largestPrimeFactor, primeFactors, productOf } from "./factor.ts"

export type Resonance =
  /** The bank was empty. Not an assertion, not a report, not a mistake. */
  | { readonly kind: "silent" }
  /** The bank's product is the target and every tile is prime. */
  | { readonly kind: "open"; readonly asserted: number }
  /** A genuine assertion that is not the target. Reported; the host judges. */
  | { readonly kind: "refuse"; readonly asserted: number }

/**
 * What a bank does when it is carried into a resonator asking for `target`.
 *
 * `bank` is the swept primes. The caller owns the invariant that they are
 * primes — `Bank` refuses anything else — but this checks it anyway, because
 * "every tile is prime" is half of what "a prime factorisation" means and a
 * rule that trusts its input is a rule that is not being enforced.
 */
export function resonate(target: number, bank: readonly number[]): Resonance {
  if (bank.length === 0) return { kind: "silent" }
  const asserted = productOf(bank)
  if (!bank.every(isPrime)) return { kind: "refuse", asserted }
  if (!Number.isInteger(target) || target < 2) return { kind: "refuse", asserted }
  return asserted === target ? { kind: "open", asserted } : { kind: "refuse", asserted }
}

/** Convenience for the tests and for the arena's scoring: did it open? */
export function opens(target: number, bank: readonly number[]): boolean {
  return resonate(target, bank).kind === "open"
}

/**
 * A value the resonator can honestly ask for.
 *
 * The curriculum serves column arithmetic and its answers include 0 and 1 and
 * the occasional four-digit sum. A resonator asking for 1 would open to an
 * empty hold, which is not a question; one asking for 10007 would need a mote
 * nobody can read. The arena draws again rather than bending the number.
 *
 * This is the *floor* of legality, and it is what the mal-rule filter uses. It
 * is deliberately weaker than `isResonant` — see below for why the resonator
 * itself needs more than legality.
 */
export function isAskable(target: number, max: number): boolean {
  return Number.isInteger(target) && target >= 2 && target <= max
}

/** How many motes a target's hold is: its prime factors, with multiplicity. */
export function tileCount(target: number): number {
  return primeFactors(target).length
}

/**
 * The smallest target with a factor tree in it, and the fewest tiles that makes
 * a tree rather than a fact.
 *
 * **This is the founder's report, stated as a predicate.** The arithmetic in
 * this game has two stages — work out the sum, then decompose the answer — and
 * at `2 + 0 = 2` *the second stage does not exist*. There is nothing to crack
 * and one mote to find, so ten minutes of it felt like nothing was happening:
 * he was playing a factor-collection game with no factors in it.
 *
 * So `MIN_TILES` is three, not two. At one tile there is no decomposition at
 * all. At two — `15 → 3·5` — there is exactly one crack and no choice about
 * which one, so the "decide which primes multiply to it" step is a formality.
 * Three is the first count at which the child chooses an order, the husk comes
 * apart twice, and the tile bar shows a tree instead of a fact.
 *
 * `MIN_TARGET` is twelve because below twelve the only value with three prime
 * factors is 8 = 2·2·2, and a hold of three identical twos is the same
 * absorption the passive layer gives away for free.
 */
export const MIN_TILES = 3
export const MIN_TARGET = 12

/**
 * The smallest prime a resonator will put up as a wall.
 *
 * A prime target has no factor tree by definition — the only hold that opens it
 * is the single mote carrying it, found drifting on the field. That is a real
 * beat and it is the property this whole game is built on, so it is kept. But
 * "find the 2" is the degenerate case the founder spent ten minutes in, and a
 * wall worth walking into has to be a number you have to *hunt*.
 */
export const MIN_WALL = 13

/**
 * A target this game can be *itself* on.
 *
 * Legality (`isAskable`) says the numeral fits on the resonator's face.
 * Resonance says there is a game in it: either a factor tree of at least
 * `MIN_TILES` motes, or — when the caller says a wall is due — a prime big
 * enough to be a hunt.
 *
 * `wall` is the caller's decision and not this function's, because how often a
 * wall should come round is pacing and pacing belongs to the arena. Rationing
 * it is the whole reason this parameter exists: unrationed, primes are about a
 * fifth of the band and every fifth resonator would be a hunt for one mote.
 */
export function isResonant(target: number, max: number, opts: { wall: boolean }): boolean {
  if (!isAskable(target, max)) return false
  if (target < MIN_TARGET) return false
  if (isPrime(target)) return opts.wall && target >= MIN_WALL
  if (tileCount(target) < MIN_TILES) return false
  return isSmooth(target)
}

/**
 * Whether every prime in `target` is one the game draws as a readable mote.
 *
 * `794` has three digits, is composite, and its factorisation is `2 · 397`. The
 * old bar took it: two tiles, both prime, product exact. But `MOTE_PRIMES` — the
 * list this game has always used to say which primes are "small enough to be
 * drawn as a drifting mote and read at speed" — stops at 47, so the child was
 * being sent to find a 397. Three-digit targets are 65% trees and only 37%
 * *readable* trees, so this is the difference between `804 = 2·2·3·67` and
 * `600 = 2·2·2·3·5·5`, which is the shape the founder actually asked for.
 *
 * A prime target is exempt, because a prime target is the wall and the whole
 * point of it is that the single mote carrying it is the only way in — a 991
 * drifting on its own is the most legible thing in the game.
 */
export function isSmooth(target: number): boolean {
  return largestPrimeFactor(target) <= LARGEST_MOTE_PRIME
}
