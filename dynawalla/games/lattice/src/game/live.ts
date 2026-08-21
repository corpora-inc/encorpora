// WHICH ONE GOES IN — divisibility, drawn on the field.
//
// The founder asked for it in one line: "maybe it even highlights/hints when it
// is blastable and why."
//
// The rule the whole game stands on is stated in `factor.ts`: **a prime cannot
// be split**, so primes are what the hold is made of, and a hold opens the ring
// when its product is exactly the target. Every child who plays this has to work
// out, mote by mote, whether the lit `3` drifting past is one of the pieces or
// one of the chaff. That question has an exact answer and it is one line of
// arithmetic — **does it divide what is left** — and until now nothing on the
// screen said so.
//
// So: take the target, take out what the hold already carries, and what remains
// is a number. A lit mote belongs in the hold **iff it divides that number**. A
// stone husk is worth shooting **iff it shares a factor with it** — crack it and
// at least one of the two pieces is a piece the hold needs.
//
// That is the whole of this file. It decides nothing about pacing and nothing
// about difficulty; it reads the field and says which numbers divide.
//
// ## This is not the factor tree
//
// `game/hint.ts` and `game/tree.ts` answer a different question, and the two
// must not be folded together. The tree says **how to factor the target** — it
// unfolds `112` into `2·2·2·2·7` a stage at a time, on a clock the child can
// outrun and a control they can tap, and it is about the arithmetic. This says
// **which of the numbers actually in front of you right now is live**, and it is
// about the field. A child can have the whole tree up and still not know whether
// the `13` drifting past is one of theirs; a child can have this and still not
// know what `642 − 530` is.
//
// They do share one thing, and it is shared rather than duplicated: an opening
// that is guided does not climb the arena's ladder, exactly as a tree that
// stated the answer does not. See `arena.enter`.
//
// ## A hint that lies is worse than no hint
//
// `hint.heldLeaves` says the same thing about the tree's collars, and it is the
// reason both are pure functions with their own tests rather than four lines
// inside the renderer. Mark one mote too many and a child sweeps it, flies into
// the ring, and is refused by a game that told them to. `live.test.ts` asserts
// the marking against an independent trial-division oracle over the whole band —
// exactly the divisors, no more and no fewer.

import { isPrime, productOf } from "./factor.ts"

/**
 * What is left of `target` once the hold is taken out of it.
 *
 * `null` when the hold does not divide the target at all — which is not an
 * error and not a scold: it is the honest reading of a hold that has already
 * gone past what the ring wants. Nothing on the field can complete it, so
 * nothing is marked, and the way out is one tap on the bar.
 *
 * `1` means the hold is exactly right and there is nothing left to find.
 */
export function remainingOf(target: number, tiles: readonly number[]): number | null {
  if (!Number.isInteger(target) || target < 1) return null
  for (const tile of tiles) {
    if (!Number.isInteger(tile) || tile < 1) return null
  }
  const held = productOf(tiles)
  if (!Number.isSafeInteger(held) || held < 1) return null
  if (target % held !== 0) return null
  return target / held
}

export type Mark =
  /** A prime that divides what is left. Go and get it. */
  | "needed"
  /** A composite that shares a factor with what is left. Shoot it. */
  | "carries"
  /** Neither. Not a mistake to touch, just not one of yours. */
  | "spare"

/**
 * What a number on the field is, against what is left.
 *
 * Primeness is derived here rather than taken as an argument, so there is no
 * way for a caller to hand this a wrong answer about the one property the game
 * stands on.
 */
export function markOf(remaining: number | null, value: number): Mark {
  if (remaining === null || remaining <= 1) return "spare"
  if (!Number.isInteger(value) || value < 2) return "spare"
  if (isPrime(value)) return remaining % value === 0 ? "needed" : "spare"
  return gcd(value, remaining) > 1 ? "carries" : "spare"
}

/** The whole field at once, by body id. */
export function markField(
  target: number,
  tiles: readonly number[],
  bodies: readonly { readonly id: number; readonly value: number }[],
): Map<number, Mark> {
  const remaining = remainingOf(target, tiles)
  const out = new Map<number, Mark>()
  for (const body of bodies) out.set(body.id, markOf(remaining, body.value))
  return out
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}
