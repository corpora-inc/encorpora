// THE RESONANCE — the three properties the learning claim rests on.
//
// The passive layer of this game is absorption. This file is the part that is
// reasoning, and each test here is one of the things a child would have to be
// able to do for the claim "they factorised it" to be true.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Bank } from "../game/bank.ts"
import { isPrime, LARGEST_MOTE_PRIME, primeFactors, productOf } from "../game/factor.ts"
import {
  isAskable,
  isResonant,
  isSmooth,
  MIN_TARGET,
  MIN_TILES,
  MIN_WALL,
  opens,
  resonate,
  tileCount,
} from "../game/resonance.ts"

/** Every multiset of primes drawn from `alphabet` with at most `depth` tiles. */
function banksFrom(alphabet: readonly number[], depth: number): number[][] {
  const out: number[][] = []
  const walk = (start: number, held: number[]): void => {
    if (held.length > 0) out.push(held.slice())
    if (held.length === depth) return
    for (let i = start; i < alphabet.length; i++) {
      held.push(alphabet[i] as number)
      walk(i, held)
      held.pop()
    }
  }
  walk(0, [])
  return out
}

test("a target is cleared only by a genuine prime factorisation of it", () => {
  // Exhaustive: every multiset of small primes up to six tiles, against every
  // target from 2 to 200. A bank opens the resonator if and only if every tile
  // is prime and the product is exactly the target — which, by unique
  // factorisation, means the bank *is* the prime factorisation of the target.
  const alphabet = [2, 3, 5, 7, 11, 13]
  const banks = banksFrom(alphabet, 6)
  for (let target = 2; target <= 200; target++) {
    const wanted = primeFactors(target)
    for (const bank of banks) {
      const opened = opens(target, bank)
      const genuine =
        bank.every(isPrime) && productOf(bank) === target && bank.length === wanted.length
      assert.equal(
        opened,
        genuine,
        `target ${target} vs bank ${JSON.stringify(bank)}: opened=${opened}`,
      )
    }
  }
})

test("a composite tile never opens anything, even when the product is right", () => {
  // 4 is not a prime, so `[4, 3]` is a decomposition of 12 but not *the* prime
  // factorisation, and the resonator does not take it. This is the rule that
  // keeps "factorisation" from quietly meaning "any two numbers that multiply".
  assert.equal(opens(12, [4, 3]), false)
  assert.equal(opens(12, [12]), false)
  assert.equal(opens(12, [6, 2]), false)
  assert.equal(opens(12, [2, 2, 3]), true)
  assert.equal(opens(72, [8, 9]), false)
  assert.equal(opens(72, [2, 2, 2, 3, 3]), true)
})

test("a prime target is a wall: nothing smaller assembles it", () => {
  // The same property `foundry street` relies on, asserted the hard way. For
  // every prime target under 200, every multiset of *strictly smaller* primes —
  // exhaustively, to eight tiles — fails to reach it. The only bank that opens
  // a prime is the single mote carrying it, which has to be found on the field
  // rather than built.
  for (let target = 2; target <= 200; target++) {
    if (!isPrime(target)) continue
    const smaller: number[] = []
    for (let p = 2; p < target; p++) if (isPrime(p)) smaller.push(p)

    for (const bank of banksFrom(smaller.slice(0, 8), 4)) {
      assert.equal(
        opens(target, bank),
        false,
        `the prime ${target} was assembled from ${JSON.stringify(bank)}`,
      )
    }
    assert.equal(opens(target, [target]), true, `the mote ${target} did not open ${target}`)
    assert.deepEqual(primeFactors(target), [target])
  }
})

test("an empty hold asserts nothing — it is not a wrong answer", () => {
  const verdict = resonate(60, [])
  assert.equal(verdict.kind, "silent")
  // A child flying through a resonator with nothing in the hold is a child
  // moving through the arena, and the host must not hear an answer for it.
})

test("a genuine assertion that is not the target refuses, and says what was said", () => {
  const verdict = resonate(72, [2, 2, 3, 5])
  assert.equal(verdict.kind, "refuse")
  assert.equal(verdict.kind === "refuse" && verdict.asserted, 60)
})

test("overshoot and undershoot both refuse — the hold is exact, not 'close'", () => {
  assert.equal(opens(12, [2, 2, 3, 2]), false, "24 opened a resonator asking for 12")
  assert.equal(opens(12, [2, 3]), false, "6 opened a resonator asking for 12")
  assert.equal(opens(12, [2, 2, 3]), true)
})

test("a target the arena will not ask for is refused rather than fudged", () => {
  assert.equal(isAskable(1, 999), false, "1 opens to an empty hold and is not a question")
  assert.equal(isAskable(0, 999), false)
  assert.equal(isAskable(-4, 999), false)
  assert.equal(isAskable(1000, 999), false)
  assert.equal(isAskable(2, 999), true)
  assert.equal(isAskable(999, 999), true)
  // And if one ever got through, the rule refuses rather than opening.
  assert.equal(opens(1, [2]), false)
  assert.equal(opens(0, [2]), false)
})

test("a target with nothing to decompose is not a target this game asks for", () => {
  // **The founder's report, as a predicate.** "I'm seeing 2+0 over and over
  // again, finding a 2" — every one of those answers is `isAskable` and none of
  // them is `isResonant`, because the game's second stage does not exist at one
  // tile and is a formality at two.
  const wall = { wall: false }
  for (const degenerate of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    assert.equal(
      isResonant(degenerate, 999, wall),
      false,
      `${degenerate} = ${primeFactors(degenerate).join("·")} was accepted as a resonator target`,
    )
  }
  // And the founder's own examples are.
  assert.equal(isResonant(12, 999, wall), true, "8 + 4 = 12 = 2·2·3 was refused")
  assert.equal(isResonant(72, 999, wall), true, "47 + 25 = 72 = 2·2·2·3·3 was refused")
  assert.equal(tileCount(72), 5)
  // A semiprime is legal and is not this game: one crack, and no choice about it.
  assert.equal(isResonant(15, 999, wall), false, "15 = 3·5 has one crack in it")
  assert.equal(isResonant(91, 999, wall), false, "91 = 7·13 has one crack in it")
  assert.equal(MIN_TILES, 3)
  assert.equal(MIN_TARGET, 12)
})

test("the wall is kept, rationed, and never a hunt for a 2", () => {
  // Primeness is the property the whole game stands on, so a filter that deleted
  // it would be worse than the defect. It survives — behind a flag the arena
  // owns, because how often a wall comes round is pacing.
  assert.equal(isResonant(41, 999, { wall: true }), true, "the wall was filtered out of the game")
  assert.equal(isResonant(41, 999, { wall: false }), false, "the wall is not rationed at all")
  assert.equal(isResonant(991, 999, { wall: true }), true)
  // But never the degenerate end of it, flag or no flag.
  for (const small of [2, 3, 5, 7, 11]) {
    assert.equal(
      isResonant(small, 999, { wall: true }),
      false,
      `a resonator would have asked a child to find a ${small}`,
    )
  }
  assert.equal(MIN_WALL, 13)
})

test("every prime in a target is one the game can draw as a readable mote", () => {
  // `794` is three digits, composite, and factorises as `2 · 397` — so the old bar
  // took it and sent the child to find a 397, while `MOTE_PRIMES` has always
  // stopped at 47. Three-digit answers are 65% trees and only 37% *readable*
  // trees, so this is the difference between 804 = 2·2·3·67 and 600 = 2·2·2·3·5·5.
  assert.equal(LARGEST_MOTE_PRIME, 47)
  assert.equal(isSmooth(600), true, `600 = ${primeFactors(600).join("·")}`)
  assert.equal(isSmooth(804), false, `804 = ${primeFactors(804).join("·")}`)
  assert.equal(isResonant(804, 999, { wall: false }), false, "804 needs a 67 mote")
  assert.equal(isResonant(794, 999, { wall: false }), false, "794 needs a 397 mote")
  assert.equal(isResonant(600, 999, { wall: false }), true)
  // A prime target is exempt: the single mote carrying it is the whole point, and
  // a 991 drifting on its own is the most legible thing in the game.
  assert.equal(isResonant(991, 999, { wall: true }), true, "a large prime wall was refused")
  // Exhaustively: nothing the game will ask for needs a mote it will not draw.
  for (let target = 2; target <= 999; target++) {
    if (!isResonant(target, 999, { wall: true })) continue
    if (isPrime(target)) continue
    assert.ok(
      Math.max(...primeFactors(target)) <= LARGEST_MOTE_PRIME,
      `${target} = ${primeFactors(target).join("·")} is a target with an unreadable mote in it`,
    )
  }
})

test("the bank's own invariant holds through the resonance rule", () => {
  const bank = new Bank()
  for (const p of [3, 2, 5, 2]) assert.ok(bank.take(p))
  assert.equal(bank.value, 60)
  assert.equal(opens(60, bank.tiles), true)
  assert.equal(opens(30, bank.tiles), false)
})
