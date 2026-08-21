// The rules, on a fixed deal.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Question } from "../contract.ts"
import { Bout, openingLoad, RERACK_SLACK, RUN, TIMING, type BoutEvent } from "../game/bout.ts"
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

/** Advance to the open round and hand back the events on the way. */
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

test("a round opens with a lot on the far pan and brass already on yours", () => {
  const bout = new Bout(fixed(641))
  const events = open(bout)
  const hang = events.find((e) => e.kind === "hang")
  assert.ok(hang && hang.kind === "hang")
  assert.equal(hang.question.answer, "641")
  assert.equal(bout.goods, 641)
  // The delta the round is asking for: the goods, one over, less the brass there.
  assert.equal(hang.delta, 641 + 1 - bout.load)
  assert.ok(events.some((e) => e.kind === "open"))
})

test("one over is a good weight; nothing else is", () => {
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
    const [event] = bout.stamp()
    assert.ok(event && event.kind === "stamp")
    assert.equal(event.docket.verdict, verdict, `${load} of brass judged ${event.docket.verdict}`)
  }
})

test("what crosses to the host is the weight the child wrote on the docket", () => {
  const bout = new Bout(fixed(641))
  open(bout)
  loadTo(bout, 632)
  const [event] = bout.stamp()
  assert.ok(event && event.kind === "stamp")
  // A child who dropped a ten writes 631, not "wrong". That is the diagnosis.
  assert.equal(event.docket.asserted, 631)
  assert.equal(event.docket.load, 632)
  assert.equal(event.docket.declared, true)
})

test("a good weight moves the day's run, and a refused docket moves it back", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  loadTo(bout, 501)
  bout.stamp()
  assert.equal(bout.day.run, 1)
  assert.equal(bout.day.held, 1)
  bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  assert.equal(bout.phase, "press")
  loadTo(bout, 400)
  bout.stamp()
  assert.equal(bout.day.run, 0)
})

test("five good weights clear the scale, and only then", () => {
  const bout = new Bout(fixed(500))
  const events: BoutEvent[] = []
  open(bout)
  for (let i = 0; i < RUN; i++) {
    loadTo(bout, 501)
    events.push(...bout.stamp())
    events.push(...bout.advance(TIMING.settleMs + TIMING.hangMs + 4))
  }
  const won = events.filter((e) => e.kind === "won")
  assert.equal(won.length, 1, "the scale was cleared the wrong number of times")
  assert.equal(bout.day.won, 1)
  assert.equal(bout.day.scale, 2)
  assert.equal(bout.day.run, 0, "the run did not go back to level for the next scale")
})

test("a barrow going back costs the run and nothing else — no tally, no punishment", () => {
  const bout = new Bout(fixed(500))
  const events: BoutEvent[] = []
  open(bout)
  for (let i = 0; i < RUN; i++) {
    events.push(...bout.stamp())
    events.push(...bout.advance(TIMING.settleMs + TIMING.hangMs + 4))
  }
  const back = events.filter((e) => e.kind === "sentBack")
  assert.equal(back.length, 1)
  assert.equal(bout.day.won, 0)
  // Stakes without loss: the same scale carries on, no harder than before.
  assert.equal(bout.day.scale, 1)
  assert.equal(bout.day.run, 0)
  // And it is never a stopping point: nothing here is a `won` event.
  assert.equal(events.filter((e) => e.kind === "won").length, 0)
})

// ---------------------------------------------------------------------------
// **THERE IS NO CLOCK ON THE ANSWER.**
//
// The founder's second report on this game was "the action is rushed by the timer
// going down", against a window that was already generous and measured. So the
// window went. What is left is an abandonment guard, and the four cases below are
// the difference between the two, stated as behaviour.
// ---------------------------------------------------------------------------

test("a round has no length: any hand on the rack buys the whole guard back", () => {
  // **The headline change.** A child who is working — striking a plate, checking
  // the column, striking another — can never be timed out, however long the round
  // takes in total. Fifteen times the guard goes by here.
  const bout = new Bout(fixed(500))
  open(bout)
  const guard = bout.guardMs
  for (let i = 0; i < 15; i++) {
    bout.advance(guard - 200)
    assert.equal(bout.phase, "press", `the round ended after ${i} refills`)
    bout.strike({ place: 1, dir: i % 2 === 0 ? 1 : -1 })
  }
  assert.ok(bout.elapsedMs > guard * 14, "the round was not actually long")
  assert.equal(bout.phase, "press")
  assert.equal(bout.day.run, 0, "a long round cost the child something")
})

test("even a blow a swinging pillar refuses buys the guard back", () => {
  // A child drumming on one plate is a child who is there. The refusal is about
  // the plate, not about the room, and it must never be read as an empty one.
  //
  // Asserted on `idle` directly rather than by playing a round out: an accepted
  // blow resets the guard too, so any sequence that reaches a refusal through one
  // would pass whether or not the refusal itself counted.
  const bout = new Bout(fixed(500))
  open(bout)
  bout.strike({ place: 10, dir: 1 })
  bout.advance(50)
  assert.ok(bout.idle > 0, "the guard was not running, so this proves nothing")
  assert.ok(bout.cooling(10), "the pillar had already swung back")

  const refused = bout.strike({ place: 10, dir: 1 })
  assert.deepEqual(refused, [{ kind: "refused", reason: "cooldown" }])
  assert.equal(bout.idle, 0, "a hand on the rack was read as an empty room")
})

test("nothing on your pan moves on its own, ever", () => {
  // **The sag, deleted.** It used to take a unit off any pan left alone for three
  // seconds after the first blow, then another every 1.6 s — which fired on
  // exactly the behaviour this game most wants, a child stopping halfway to check
  // their column, and made the arithmetic they had just done wrong without
  // telling them. A clock may not take anything away from a child, and brass on a
  // pan does not evaporate.
  const bout = new Bout(fixed(500))
  open(bout)
  const read = bout.load
  bout.advance(bout.guardMs - 50)
  assert.equal(bout.load, read, "the pan drained while the child was still reading")

  // And after the first blow, which is where the sag used to arm itself.
  bout.strike({ place: 100, dir: 1 })
  const struck = bout.load
  bout.advance(bout.guardMs - 50)
  assert.equal(bout.load, struck, "the pan drained under a child who had started")
  assert.equal(bout.phase, "press")
})

test("the guard fires only on silence, and takes nothing when it does", () => {
  // **A lapse is not a wrong answer.** No run moves, nothing is declared, and the
  // pan is not read as a claim — the child never stamped it.
  const bout = new Bout(fixed(500))
  open(bout)
  loadTo(bout, 480)
  const before = bout.day.run
  const events = bout.advance(bout.guardMs + 100)
  const stamped = events.find((e) => e.kind === "stamp")
  assert.ok(stamped && stamped.kind === "stamp")
  assert.equal(stamped.docket.verdict, "lapsed")
  assert.equal(stamped.docket.declared, false, "a lapse was recorded as a declaration")
  assert.equal(stamped.run, before, "a lapse moved the day's run")
  assert.equal(bout.day.run, before)
  assert.equal(bout.day.held, 0)
})

test("a lapse on a pan that happened to be right is still not a good weight", () => {
  // The child never stamped it, so nobody said it.
  const bout = new Bout(fixed(500))
  open(bout)
  loadTo(bout, 501)
  const events = bout.advance(bout.guardMs + 100)
  const stamped = events.find((e) => e.kind === "stamp")
  assert.ok(stamped && stamped.kind === "stamp")
  assert.equal(stamped.docket.verdict, "lapsed")
  assert.equal(bout.day.run, 0)
  assert.equal(bout.day.held, 0)
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
  bout.stamp()
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
  bout.stamp()
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

test("nothing can be struck while the lot is still coming on", () => {
  const bout = new Bout(fixed(500))
  bout.begin()
  assert.equal(bout.phase, "hang")
  assert.deepEqual(bout.strike({ place: 1, dir: 1 }), [{ kind: "refused", reason: "phase" }])
  assert.deepEqual(bout.stamp(), [{ kind: "refused", reason: "phase" }])
})

test("shearing the steel ends the round on the blow that broke it", () => {
  const bout = new Bout(fixed(500))
  open(bout)
  let events: BoutEvent[] = []
  for (let i = 0; i < 200 && bout.phase === "press"; i++) {
    events = bout.strike({ place: (i % 2 === 0 ? 1 : 10) as 1 | 10, dir: 1 })
    bout.advance(56)
  }
  const stamped = events.find((e) => e.kind === "stamp")
  assert.ok(stamped && stamped.kind === "stamp", "mashing never sheared the beam")
  assert.equal(stamped.docket.verdict, "shear")
  assert.equal(bout.day.run, -1)
})

test("the scale never tightens anything — the same lot gets the same patience forever", () => {
  // **The ratchet, and its absence.** `timingForBout` used to take 1.1 s off the
  // press window per opponent, down to a 7.6 s floor, while the same counter was
  // also what escalated the arithmetic. Nothing left in this file may do that:
  // put the same lot on at the ninth scale as at the first and every duration has
  // to come back identical.
  const bout = new Bout(fixed(500))
  open(bout)
  const first = { guard: bout.guardMs, ...bout.timings }
  for (let scale = 0; scale < 9; scale++) {
    for (let i = 0; i < RUN; i++) {
      loadTo(bout, 501)
      bout.stamp()
      bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
    }
  }
  assert.ok(bout.day.won >= 9, `only ${bout.day.won} scales were cleared`)
  assert.deepEqual({ guard: bout.guardMs, ...bout.timings }, first)
})

test("the first pan of a day starts a few strikes off, never on the answer", () => {
  for (const target of [45, 641, 1287, 9004]) {
    const load = openingLoad(target)
    assert.ok(Number.isInteger(load))
    assert.ok(load > 0, `an opening set of ${load} is an empty pan`)
    assert.notEqual(load, target + 1, "the opening set was the answer")
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
  bout.stamp()
  bout.advance(TIMING.settleMs + TIMING.hangMs + 4)
  assert.equal(bout.phase, "press")
  assert.equal(bout.load, 0, "the pan was quietly re-seeded")
})
