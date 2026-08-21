// The bank, and the factor tile bar that draws it.
//
// The bar is the passive layer made visible: every prime the child has swept,
// laid out in ascending order with a running product on the end. `2·2·3 = 12`
// is on screen the whole time the child is holding those three motes, and it
// changes the instant a fourth arrives.
//
// One invariant, and `bank.test.ts` asserts it after every operation on every
// path: **the tile bar is always a true factorisation of the value it shows.**
// Every tile is prime, and the product of the tiles is exactly the value. There
// is no code path — not a spill, not a clear, not a refusal — that can leave
// the bar reading something that is not true of the number beside it.

import { ascending, isPrime, productOf } from "./factor.ts"

/**
 * The most motes a child may hold at once.
 *
 * Twelve, because the largest target a resonator will ask for is 999 and the
 * worst case under that is 512 = 2⁹ — nine tiles, with room over for a couple
 * of stray sweeps before the hold refuses.
 */
export const BANK_CAPACITY = 12

export class Bank {
  private held: number[] = []

  /**
   * Sweep a prime into the bank. Returns false when it was refused — not a
   * prime, or the hold is full — and the caller draws that as the mote bouncing
   * off rather than as anything the child did wrong.
   */
  take(prime: number): boolean {
    if (!isPrime(prime)) return false
    if (this.held.length >= BANK_CAPACITY) return false
    this.held.push(prime)
    this.held.sort((a, b) => a - b)
    return true
  }

  /**
   * Shake one mote loose — what a collision with a drifting husk costs. The
   * largest one goes, because losing the 13 out of `2·2·13` is a loss the child
   * can see, and because it keeps the bar from silently becoming a wrong shape.
   *
   * Returns the prime that fell out, or `null` when there was nothing to lose.
   */
  spill(): number | null {
    if (this.held.length === 0) return null
    return this.held.pop() ?? null
  }

  /** Everything back on the field. Returns what was let go. */
  release(): number[] {
    const out = this.held
    this.held = []
    return out
  }

  get tiles(): readonly number[] {
    return this.held
  }

  /** The running product. 1 for an empty hold — the multiplicative identity. */
  get value(): number {
    return productOf(this.held)
  }

  get size(): number {
    return this.held.length
  }

  get isFull(): boolean {
    return this.held.length >= BANK_CAPACITY
  }

  /** The tile bar, as drawn: `2·2·3`. Empty string for an empty hold. */
  get label(): string {
    return ascending(this.held).join("·")
  }
}
