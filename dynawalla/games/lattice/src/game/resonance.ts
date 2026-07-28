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

import { isPrime, productOf } from "./factor.ts"

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
 */
export function isAskable(target: number, max: number): boolean {
  return Number.isInteger(target) && target >= 2 && target <= max
}
