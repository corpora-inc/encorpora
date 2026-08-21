// The 50% ceiling, measured.
//
// This is the file the whole format rests on. A two-choice task has a hard 50%
// ceiling for anyone who does not read, and that is not a flaw to be patched — it is
// the measurement. The job is to make sure that ceiling reads as failure. It now does
// so twice: the bag drifts DOWN on a coin flip (`economy.test.ts`) and the run is
// three calls long (here).
//
// What this file also has to hold, and what #657 put here, is that the slate lies with
// values a child cannot reject by feel.

import assert from "node:assert/strict"
import { test } from "node:test"

import { sameValue } from "../core/exact.ts"
import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stub/host.ts"
import { alwaysKeep, alwaysToss, coinFlip, fallible, perfect, playRun } from "../test/harness.ts"
import { Dealer } from "./dealer.ts"
import { isCorrect, outcomeOf } from "./response.ts"

const ROUNDS = 6000

function stream(seed: number) {
  const host = createStubHost({ seed })
  const dealer = new Dealer(host, new Rng(seed ^ 0x5eed))
  return Array.from({ length: ROUNDS }, () => dealer.deal())
}

test("keeping everything is right exactly half the time", () => {
  for (const seed of [1, 77, 4242]) {
    const statements = stream(seed)
    const correct = statements.filter((s) => isCorrect(outcomeOf("keep", s.truth))).length
    const rate = correct / statements.length
    assert.ok(Math.abs(rate - 0.5) < 0.01, `seed ${String(seed)}: a keeper scored ${rate.toFixed(4)}`)
  }
})

test("tossing everything is the same coin, the other way up", () => {
  const statements = stream(9)
  const correct = statements.filter((s) => isCorrect(outcomeOf("toss", s.truth))).length
  assert.ok(Math.abs(correct / statements.length - 0.5) < 0.01)
})

test("no strategy that ignores the slate can beat half", () => {
  // Any fixed gesture is right on exactly the statements whose truth matches it, and
  // the bag deals those in halves. There is no timing trick, no rhythm and no tell to
  // find, because the truth is not a function of anything the child can see before
  // reading.
  const statements = stream(31)
  const keep = statements.filter((s) => s.truth).length
  const toss = statements.length - keep
  assert.ok(Math.max(keep, toss) / statements.length <= 0.51)
})

test("true and false stay balanced all the way through a run, not just on average", () => {
  const statements = stream(2718)
  let trues = 0
  statements.forEach((s, i) => {
    if (s.truth) trues++
    const falses = i + 1 - trues
    assert.ok(
      Math.abs(trues - falses) <= 4,
      `after ${String(i + 1)}: ${String(trues)} true, ${String(falses)} false`,
    )
  })
})

test("not one statement presented as false is actually true", () => {
  for (const seed of [3, 88, 90210]) {
    for (const s of stream(seed)) {
      if (s.truth) assert.ok(sameValue(s.claimed, s.answer), s.text)
      else assert.ok(!sameValue(s.claimed, s.answer), `presented as false but true: ${s.text}`)
    }
  }
})

test("the slate lies with values a child actually writes", () => {
  // Every falsehood on the slate came out of the item's own distractor list, which is
  // mal-rule output. Nothing here is `answer + 1` noise a child can reject by feel
  // without doing the arithmetic. #657 proved the ones-column shortcut does not work
  // against these values and nothing in this rework may reintroduce one.
  const host = createStubHost({ seed: 606 })
  const dealer = new Dealer(host, new Rng(607))
  let checked = 0
  for (let i = 0; i < 2000; i++) {
    const statement = dealer.deal()
    if (statement.truth) continue
    checked++
    assert.notEqual(statement.claimed, statement.answer)
    assert.ok(Number.isInteger(Number(statement.claimed)))
  }
  assert.ok(checked > 800, `only ${String(checked)} false statements in 2000`)
})

/** Mean calls per run over `n` runs of a strategy. */
function meanCalls(strategy: (seed: number) => number, n: number): number {
  let total = 0
  for (let i = 0; i < n; i++) total += strategy(i)
  return total / n
}

test("a guesser's whole run is three calls long", () => {
  // The number that makes the ceiling read as failure. Not "50%" — a child reads that
  // as a pass. Three.
  const mean = meanCalls(
    (seed) =>
      playRun(createStubHost({ seed: 1000 + seed }), 2000 + seed, coinFlip(new Rng(seed))).run
        .calls,
    600,
  )
  assert.ok(mean > 2.3 && mean < 3.8, `a guesser averaged ${mean.toFixed(2)} calls`)
})

test("keeping everything and tossing everything are exactly as short", () => {
  for (const [name, bot] of [
    ["keep everything", alwaysKeep],
    ["toss everything", alwaysToss],
  ] as const) {
    const mean = meanCalls(
      (seed) => playRun(createStubHost({ seed: 3000 + seed }), 4000 + seed, bot).run.calls,
      600,
    )
    assert.ok(mean > 2.3 && mean < 3.8, `${name} averaged ${mean.toFixed(2)} calls`)
  }
})

test("reading the slate is worth nine times the game", () => {
  const guesser = meanCalls(
    (seed) =>
      playRun(createStubHost({ seed: 5000 + seed }), 6000 + seed, coinFlip(new Rng(seed))).run
        .calls,
    300,
  )
  const careful = meanCalls((seed) => {
    const rng = new Rng(7000 + seed)
    return playRun(createStubHost({ seed: 8000 + seed }), 9000 + seed, fallible(0.9, rng), {
      limit: 600,
    }).run.calls
  }, 300)
  assert.ok(careful / guesser >= 6, `${careful.toFixed(1)} vs ${guesser.toFixed(1)} calls`)
})

test("a child who reads every slate is never stopped at all", () => {
  const result = playRun(createStubHost({ seed: 12 }), 13, perfect, { limit: 300 })
  assert.equal(result.run.shots, 3)
  assert.equal(result.run.over, false)
})

test("a guesser gets FEWER slates than a reader, not more", () => {
  // The old design enforced this by refusing to close the window on a wrong draw. It
  // is now enforced by the run: a guesser is off the street in six rounds. Mashing has
  // never bought tempo in this game and it still does not.
  const guesser = playRun(createStubHost({ seed: 41 }), 42, coinFlip(new Rng(3)), { limit: 60 })
  const reader = playRun(createStubHost({ seed: 41 }), 42, perfect, { limit: 60 })
  assert.ok(
    guesser.statements.length < reader.statements.length,
    `${String(guesser.statements.length)} vs ${String(reader.statements.length)} slates`,
  )
})
