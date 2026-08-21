import assert from "node:assert/strict"
import test from "node:test"

import type { Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { breaksNeeded, coilOf, valueOf } from "./place.ts"
import { claimOf, isExact, roundFrom, stockFor } from "./round.ts"

const SEED = 0x0c011960
const MINUS = "−"

function q(prompt: string, answer: string): Question {
  return { id: "q1", prompt, answer, distractors: [], domain: "add", difficulty: 0 }
}

test("a subtraction makes the coil the minuend and the demand the subtrahend", () => {
  const good = roundFrom(q(`72 ${MINUS} 25`, "47"))
  assert.notEqual(good, null)
  assert.equal(good?.mode, "take")
  assert.equal(good?.coil, 72)
  assert.equal(good?.demand, 25)
  assert.equal(good?.ingot, 0)
  assert.equal(good?.answer, 47)
})

test("an ASCII hyphen and an en dash read as subtraction too", () => {
  for (const glyph of ["-", "–", MINUS]) {
    const round = roundFrom(q(`93 ${glyph} 47`, "46"))
    assert.equal(round?.mode, "take", glyph)
    assert.equal(round?.coil, 93)
    assert.equal(round?.demand, 47)
  }
})

test("an addition puts the first addend in the cradle and shears the second", () => {
  const round = roundFrom(q("47 + 25", "72"))
  assert.equal(round?.mode, "fill")
  assert.equal(round?.demand, 25)
  assert.equal(round?.ingot, 47)
  assert.equal(round?.answer, 72)
  assert.ok((round?.coil ?? 0) >= 25, "the stock covers the demand")
})

test("the stock coil is ninety-six of the right order, and it always covers", () => {
  assert.equal(stockFor(1), 96)
  assert.equal(stockFor(96), 96)
  assert.equal(stockFor(97), 960)
  assert.equal(stockFor(960), 960)
  assert.equal(stockFor(961), 9_600)
  const rng = new Rng(SEED ^ 0x55)
  for (let i = 0; i < 300; i++) {
    const demand = rng.int(1, 500_000)
    const stock = stockFor(demand)
    assert.ok(stock >= demand)
    assert.equal(String(stock).replace(/0+$/, ""), "96")
    assert.ok(breaksNeeded(coilOf(stock), demand) >= 0, "the demand is cuttable from stock")
  }
})

test("an item this game cannot cut is refused rather than approximated", () => {
  assert.equal(roundFrom(q("1/2 + 1/4", "3/4")), null)
  assert.equal(roundFrom(q("2.5 + 1.5", "4.0")), null)
  assert.equal(roundFrom(q("", "0")), null)
  assert.equal(roundFrom(q("nine", "0")), null)
})

test("a demand equal to the whole coil is a legal cut, not a refusal", () => {
  // `allowZeroResult` is false on every active row, so the host does not serve
  // this — but the shear can sever the whole chain at joint zero, so there is
  // nothing to refuse.
  const round = roundFrom(q(`5 ${MINUS} 5`, "0"))
  assert.equal(round?.mode, "take")
  assert.equal(round?.coil, 5)
  assert.equal(round?.demand, 5)
  assert.equal(claimOf(round as NonNullable<typeof round>, 5), 0)
})

test("an unparseable prompt with a whole answer still plays, as a fill", () => {
  const round = roundFrom(q("what is nine and nine", "18"))
  assert.equal(round?.mode, "fill")
  assert.equal(round?.demand, 18)
  assert.equal(round?.ingot, 0)
  assert.equal(round?.coil, 96)
})

test("an inconsistent prompt falls back rather than trusting the operands", () => {
  // The prompt says one thing and the canonical answer says another. The answer
  // is the host's, so it wins, and the round becomes a plain fill: shear the
  // answer itself off the stock coil. A pack must never quietly play a
  // different problem from the one the curriculum served.
  for (const [prompt, answer, demand] of [
    ["40 + 40", "99", 99],
    [`72 ${MINUS} 25`, "72", 72],
  ] as [string, string, number][]) {
    const round = roundFrom(q(prompt, answer))
    assert.equal(round?.mode, "fill", prompt)
    assert.equal(round?.demand, demand, prompt)
    assert.equal(round?.ingot, 0, prompt)
    assert.equal(round?.answer, Number(answer), prompt)
  }
})

test("the claim is the canonical answer exactly when the cut is exact", () => {
  const rng = new Rng(SEED ^ 0x66)
  for (let i = 0; i < 500; i++) {
    const add = rng.chance(0.5)
    const a = rng.int(10, 9_999)
    const b = rng.int(1, add ? 999 : Math.max(1, a - 1))
    const answer = add ? a + b : a - b
    const round = roundFrom(q(`${String(a)} ${add ? "+" : MINUS} ${String(b)}`, String(answer)))
    assert.notEqual(round, null)
    if (!round) continue

    assert.equal(claimOf(round, round.demand), round.answer)
    assert.equal(isExact(round, round.demand), true)

    // Every other cut claims something else. That is what makes the cut the
    // answer: there is no way to be wrong and land on the right number.
    const off = rng.int(1, 40)
    const wrong = Math.max(0, round.demand - off)
    if (wrong !== round.demand) {
      assert.notEqual(claimOf(round, wrong), round.answer)
      assert.equal(isExact(round, wrong), false)
    }
  }
})

test("a claim is always a whole number, on any cut the shear can make", () => {
  const round = roundFrom(q(`403 ${MINUS} 87`, "316"))
  assert.notEqual(round, null)
  if (!round) return
  const links = coilOf(round.coil)
  for (let cut = 0; cut <= links.length; cut++) {
    const claimed = claimOf(round, valueOf(links.slice(cut)))
    assert.ok(Number.isSafeInteger(claimed), `cut ${String(cut)} claims an integer`)
    assert.ok(claimed >= 0)
  }
})

test("a wrong cut produces the number that cut is worth, not noise", () => {
  const round = roundFrom(q(`72 ${MINUS} 25`, "47"))
  assert.notEqual(round, null)
  if (!round) return
  // Shearing two tens and the two loose ones — the greedy take that skips the
  // borrow — leaves fifty. That is the smaller-from-larger family of error,
  // performed rather than typed.
  assert.equal(claimOf(round, 22), 50)
  assert.equal(isExact(round, 22), false)
})
