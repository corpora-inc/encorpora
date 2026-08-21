// NO SEAT IS THE ANSWER'S SEAT.
//
// A founder playtest: "the answer on the left for the rift appears highlighted
// (not always the answer but they should all appear the same with none
// highlighted)." He read it exactly right — it was the LEFTMOST button, chosen
// by position, because `showRift` called `.focus()` on the first one it built.
// That is fixed in `overlay.ts` and `style.css`.
//
// This file holds the other half: that the seat itself carries no information.
// COUNTERPOISE is the cautionary tale — the answer sat in a predictable place
// and a bot scored 97.2% with no arithmetic.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Question } from "../contract.ts"
import { shuffleWithAnswer } from "./shuffle.ts"

const Q: Question = {
  id: "q1",
  prompt: "47 + 38",
  answer: "85",
  distractors: ["75", "95", "84", "185"],
  domain: "add",
  difficulty: 0.4,
}

/** mulberry32, the same generator `stubHost.ts` uses. Seeded, so this is exact. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test("the answer lands in every seat about equally often", () => {
  const r = rng(0x5eed1e)
  const N = 40_000
  const counts = [0, 0, 0, 0]
  for (let i = 0; i < N; i++) {
    const seat = shuffleWithAnswer(Q, 4, r).indexOf(Q.answer)
    assert.notEqual(seat, -1, "the answer fell out of the shuffle")
    counts[seat] = (counts[seat] as number) + 1
  }
  const expected = N / 4
  counts.forEach((c, i) => {
    const drift = Math.abs(c - expected) / expected
    assert.ok(
      drift < 0.04,
      `the answer landed in seat ${i} ${((c / N) * 100).toFixed(1)}% of the time, not 25% ` +
        `— a bot could learn seat ${i}. Counts: ${counts.join(", ")}`,
    )
  })
})

test("a bot that always picks the leftmost seat does no better than guessing", () => {
  // The concrete version of the same fact, and the one the RIFT's focus ring
  // was quietly helping a child with.
  const r = rng(99)
  const N = 20_000
  let hits = 0
  for (let i = 0; i < N; i++) if ((shuffleWithAnswer(Q, 4, r)[0] as string) === Q.answer) hits++
  const rate = hits / N
  assert.ok(
    Math.abs(rate - 0.25) < 0.02,
    `always-leftmost scored ${(rate * 100).toFixed(1)}% — chance is 25%`,
  )
})

test("the CORE's three orbs are shuffled by the same rule", () => {
  const r = rng(7)
  const N = 30_000
  const counts = [0, 0, 0]
  for (let i = 0; i < N; i++) {
    const seat = shuffleWithAnswer(Q, 3, r).indexOf(Q.answer)
    counts[seat] = (counts[seat] as number) + 1
  }
  counts.forEach((c, i) => {
    assert.ok(
      Math.abs(c - N / 3) / (N / 3) < 0.04,
      `seat ${i} of three took the answer ${((c / N) * 100).toFixed(1)}% of the time`,
    )
  })
})

test("every candidate is a real candidate — the answer is present exactly once", () => {
  const r = rng(5)
  for (let i = 0; i < 500; i++) {
    const opts = shuffleWithAnswer(Q, 4, r)
    assert.equal(opts.length, 4)
    assert.equal(opts.filter((o) => o === Q.answer).length, 1)
    assert.equal(new Set(opts).size, 4, "a distractor was duplicated")
  }
})

test("a question with fewer distractors than seats still shuffles", () => {
  const thin: Question = { ...Q, distractors: ["75"] }
  const r = rng(3)
  const counts = [0, 0]
  for (let i = 0; i < 10_000; i++) {
    counts[shuffleWithAnswer(thin, 4, r).indexOf(thin.answer)] += 1
  }
  assert.ok(Math.abs((counts[0] as number) - 5000) < 300, `two seats went ${counts.join("/")}`)
})
