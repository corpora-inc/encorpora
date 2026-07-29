// The rules, on a fixed deal.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Question } from "../contract.ts"
import { Bout, GROUND, openingLoad, RERACK_SLACK, TIMING, type BoutEvent } from "../game/bout.ts"
import { planStrikes } from "../game/places.ts"

function question(answer: number, id = "q1"): Question {
  return {
    id,
    prompt: `${answer - 100} + 100`,
    answer: String(answer),
    distractors: [],
    domain: "add",
    difficulty: 0.4,
  }
}

/** A deal that hands out the same value forever, with fresh ids. */
function fixed(answer: number): () => Question {
  let n = 0
  return () => question(answer, `q${++n}`)
}

/** Advance to the open window and hand back the events on the way. */
function open(bout: Bout): BoutEvent[] {
  const events = bout.begin()
  events.push(...bout.advance(TIMING.hangMs + 1))
  assert.equal(bout.phase, "press")
  return events
}

/** Put the pan on `value` the way a player would: strike the plan. */
function loadTo(bout: Bout, value: number): void {
  for (const strike of planStrikes(value - bout.load)) {
    bout.strike(strike)
    bout.advance(300)
  }
  assert.equal(bout.load, value)
}

test("a round opens with a weight on his pan and a window on yours", () => {
  const bout = new Bout(fixed(641))
  const events = open(bout)
  const hang = events.find((e) => e.kind === "hang")
  assert.ok(hang && hang.kind === "hang")
  assert.equal(hang.question.answer, "641")
  assert.equal(bout.his, 641)
  // The delta the round is asking for: his value, one notch, less what is there.
  assert.equal(hang.delta, 641 + 1 - bout.load)
  assert.ok(events.some((e) => e.kind === "open"))
})

test("one notch ahead holds; nothing else does", () => {
  for (const [load, verdict] of [
    [642, "true"],
    [641, "short"],
    [640, "short"],
    [643, "over"],
    [741, "over"],
  ] as const) {
    const bout = new Bout(fixed(641))
    open(bout)
    loadTo(bout, load)
    const [event] = bout.seatNow()
    assert.ok(event && event.kind === "seat")
    assert.equal(event.seat.verdict, verdict, `a load of ${load} judged ${event.seat.verdict}`)
  }
})

test("what crosses to the host is the value the beam claimed his column was", () => {
  const bout = new Bout(fixed(641))
  open(bout)
  loadTo(bout, 632)
  const [event] = bout.seatNow()
  assert.ok(event && event.kind === "seat")
  // A child who dropped a ten claims 631, not "wrong". That is the diagnosis.
  assert.equal(event.seat.asserted, 631)
  assert.equal(event.seat.load, 632)
  assert.equal(event.seat.declared, true)
})

test("a held round takes ground and a missed one gives it back", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  loadTo(bout, 501)
  bout.seatNow()
  assert.equal(bout.match.arm, 1)
  assert.equal(bout.match.held, 1)
  bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  assert.equal(bout.phase, "press")
  loadTo(bout, 400)
  bout.seatNow()
  assert.equal(bout.match.arm, 0)
})

test("five held rounds put the Turk over, and only then", () => {
  const bout = new Bout(fixed(500))
  const events: BoutEvent[] = []
  open(bout)
  for (let i = 0; i < GROUND; i++) {
    loadTo(bout, 501)
    events.push(...bout.seatNow())
    events.push(...bout.advance(TIMING.settleMs + TIMING.hangMs + 4))
  }
  const won = events.filter((e) => e.kind === "won")
  assert.equal(won.length, 1, "the Turk went over the wrong number of times")
  assert.equal(bout.match.won, 1)
  assert.equal(bout.match.bout, 2)
  assert.equal(bout.match.arm, 0, "the arm did not go back to level for the next Turk")
})

test("being pinned costs the arm and nothing else — no Turk, no tally, no punishment", () => {
  const bout = new Bout(fixed(500))
  const events: BoutEvent[] = []
  open(bout)
  for (let i = 0; i < GROUND; i++) {
    events.push(...bout.seatNow())
    events.push(...bout.advance(TIMING.settleMs + TIMING.hangMs + 4))
  }
  const pinned = events.filter((e) => e.kind === "pinned")
  assert.equal(pinned.length, 1)
  assert.equal(bout.match.won, 0)
  // Stakes without loss: the same Turk squares back up, no harder than before.
  assert.equal(bout.match.bout, 1)
  assert.equal(bout.match.arm, 0)
  // And a pin is never a stopping point: nothing here is a `won` event.
  assert.equal(events.filter((e) => e.kind === "won").length, 0)
})

test("the window running out takes nothing — no verdict, no ground, no answer", () => {
  // **A timeout is not a wrong answer.** It used to be: the beam was judged
  // where it stood, which took a length of ground off a child who was still
  // carrying the hundreds column and filed a miss against them with the host.
  // Now the round is simply over.
  const bout = new Bout(fixed(500))
  open(bout)
  // Deliberately NOT on the notch — the point is that being caught mid-sum
  // costs nothing, not that a finished round is honoured.
  loadTo(bout, 480)
  const before = bout.match.arm
  const events = bout.advance(bout.pressMs + 100)
  const seat = events.find((e) => e.kind === "seat")
  assert.ok(seat && seat.kind === "seat")
  assert.equal(seat.seat.verdict, "expired")
  assert.equal(seat.seat.declared, false, "the whistle was recorded as a declaration")
  assert.equal(seat.arm, before, "the whistle moved the arm")
  assert.equal(bout.match.arm, before)
  assert.equal(bout.match.held, 0)
})

test("a whistle on a pan that happened to be right is still not a hold", () => {
  // The old rule honoured this one, and honouring it is what made the losing
  // case defensible. Both go: the child never said it.
  const bout = new Bout(fixed(500))
  open(bout)
  loadTo(bout, 501)
  const events = bout.advance(bout.pressMs + 100)
  const seat = events.find((e) => e.kind === "seat")
  assert.ok(seat && seat.kind === "seat")
  assert.equal(seat.seat.verdict, "expired")
  assert.equal(bout.match.arm, 0)
  assert.equal(bout.match.held, 0)
})

test("a pan nobody is tending settles, and a strike re-seats it", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  // The sag is armed by the first blow, so a round has to be *started* before
  // anything can be neglected. The case below is the one that matters.
  bout.strike({ place: 1, dir: 1 })
  const before = bout.load
  bout.advance(TIMING.sagGraceMs + TIMING.sagPeriodMs * 3 + 20)
  assert.equal(bout.load, before - 3, "the pan did not settle under a load left alone")

  const now = bout.load
  bout.strike({ place: 1, dir: 1 })
  bout.advance(TIMING.sagGraceMs - 10)
  assert.equal(bout.load, now + 1, "the sag did not start over after a strike")
})

test("the pan does not move while the child is reading his column", () => {
  // **The defect the founder felt as "sometimes the timing is sort of
  // impossible".** The sag used to run from the instant the window opened, at a
  // grace of 1.5 s and a period that fell to 0.75 s — so a child taking the
  // house table's own p90 for a two-digit regrouping (14 s) reached the rack
  // with a pan nine units below where they had read it, and the sum they had
  // just done in their head was wrong through no fault of theirs.
  const bout = new Bout(fixed(500))
  open(bout)
  const read = bout.load
  bout.advance(bout.pressMs - 50)
  assert.equal(bout.load, read, "the pan drained while the child was still reading")
})

test("the ladder moving out from under the pan re-racks it", () => {
  // The adaptation audit's one named defect in this pack: a pan sitting on a
  // four-digit load when the next weight is two digits costs a whole calm round
  // of unwinding before any arithmetic happens.
  let big = true
  const bout = new Bout(() => {
    const q = question(big ? 8000 : 47)
    big = false
    return q
  })
  open(bout)
  loadTo(bout, 8001)
  bout.seatNow()
  const events = bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  const rerack = events.find((e) => e.kind === "rerack")
  assert.ok(rerack && rerack.kind === "rerack", "the pan was left four digits out of position")
  assert.equal(bout.load, openingLoad(47))
  const hang = events.find((e) => e.kind === "hang")
  assert.ok(hang && hang.kind === "hang")
  assert.equal(hang.delta, 48 - bout.load, "the hang delta did not follow the re-rack")
})

test("a pan a few strikes out of position is left exactly where it was", () => {
  // The good rule, and it has to keep holding: your load staying put is what
  // makes each round only the *difference*. The re-rack is for a collapse, not
  // for ordinary drift.
  let first = true
  const bout = new Bout(() => {
    const q = question(first ? 500 : 512)
    first = false
    return q
  })
  open(bout)
  loadTo(bout, 501)
  bout.seatNow()
  const events = bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  assert.equal(
    events.filter((e) => e.kind === "rerack").length,
    0,
    "the yard re-racked a pan that was a couple of strikes away",
  )
  assert.equal(bout.load, 501)
  assert.ok(RERACK_SLACK >= 2, "the slack has to leave room for ordinary drift")
})

test("a pillar still swinging back refuses the next blow", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  const first = bout.strike({ place: 10, dir: 1 })
  assert.equal(first[0]?.kind, "strike")
  const second = bout.strike({ place: 10, dir: 1 })
  assert.deepEqual(second, [{ kind: "refused", reason: "cooldown" }])
  // A different pillar is a different plate, and is free.
  assert.equal(bout.strike({ place: 100, dir: 1 })[0]?.kind, "strike")
})

test("nothing can be struck outside the window", () => {
  const bout = new Bout(fixed(500))
  bout.begin()
  assert.equal(bout.phase, "hang")
  assert.deepEqual(bout.strike({ place: 1, dir: 1 }), [{ kind: "refused", reason: "phase" }])
  assert.deepEqual(bout.seatNow(), [{ kind: "refused", reason: "phase" }])
})

test("shearing the steel ends the round on the blow that broke it", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  let events: BoutEvent[] = []
  for (let i = 0; i < 200 && bout.phase === "press"; i++) {
    events = bout.strike({ place: (i % 2 === 0 ? 1 : 10) as 1 | 10, dir: 1 })
    bout.advance(56)
  }
  const seat = events.find((e) => e.kind === "seat")
  assert.ok(seat && seat.kind === "seat", "mashing never sheared the beam")
  assert.equal(seat.seat.verdict, "shear")
  assert.equal(bout.match.arm, -1)
})

test("the Turk never tightens a clock — the same weight gets the same window forever", () => {
  // **The ratchet, and its absence.** `timingForBout` used to take 1.1 s off the
  // press window per Turk, down to a 7.6 s floor, while the bout counter it read
  // was also what escalated the arithmetic. Nothing left in this file may do
  // that: put the same weight up at the ninth Turk as at the first and every
  // duration has to come back identical.
  const bout = new Bout(fixed(500))
  open(bout)
  const first = { press: bout.pressMs, ...bout.timings }
  for (let turk = 0; turk < 9; turk++) {
    for (let i = 0; i < GROUND; i++) {
      loadTo(bout, 501)
      bout.seatNow()
      bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
    }
  }
  assert.ok(bout.match.won >= 9, `only ${bout.match.won} Turks went over`)
  assert.deepEqual({ press: bout.pressMs, ...bout.timings }, first)
})

test("the first pan of a session starts a few strikes off, never on the answer", () => {
  for (const target of [45, 641, 1287, 9004]) {
    const load = openingLoad(target)
    assert.ok(Number.isInteger(load))
    assert.ok(load > 0, `an opening load of ${load} is an empty pan`)
    assert.notEqual(load, target + 1, "the opening load was the answer")
    const strikes = planStrikes(target + 1 - load).length
    assert.ok(strikes >= 2 && strikes <= 20, `${target} opened ${strikes} strikes away`)
  }
})

test("a host that serves something unweighable is loud, and the round still runs", () => {
  const errors: unknown[] = []
  const original = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const bout = new Bout(() => ({ ...question(0), answer: "seven" }))
    open(bout)
    assert.ok(errors.length > 0, "a non-integer answer went by in silence")
    assert.equal(bout.phase, "press")
  } finally {
    console.error = original
  }
})

test("driving your own pan to nothing is not a way out of the round", () => {
  // The opening load is seeded once a session. Testing against a load of zero
  // instead would hand a free reset to anybody who struck the pan down to
  // nothing — a rule nobody was told about, and a way to dodge a round already
  // lost.
  const bout = new Bout(fixed(1500))
  open(bout)
  loadTo(bout, 0)
  assert.equal(bout.load, 0)
  bout.seatNow()
  bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  assert.equal(bout.phase, "press")
  assert.equal(bout.load, 0, "the pan was quietly re-seeded")
})
