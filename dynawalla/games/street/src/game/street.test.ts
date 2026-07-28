// The whole street, played with no canvas, no rAF and no host.
//
// The machine is driven by elapsed milliseconds, so a block that takes half a
// minute on a tablet takes half a millisecond here — and the pause guards,
// which are the thing this file exists for, can be checked against a clock that
// is not a real one.

import assert from "node:assert/strict"
import { test } from "node:test"

import { TIMING } from "../core/feel.ts"
import { Rng } from "../core/rng.ts"
import { bestSeam, crowdPool, isPrime, minimumTaps, seamsFor } from "./factor.ts"
import { PUSH_MAX } from "./push.ts"
import { rightRivet } from "./shutter.ts"
import { Street, type Phase, type StreetEvent } from "./street.ts"
import { WAVES_PER_BLOCK } from "./wave.ts"

/** A deterministic plate source. The numerals are exact integers, as ever. */
function dealer(): () => {
  id: string
  prompt: string
  answer: string
  distractors: string[]
} {
  let n = 0
  return () => {
    n++
    const a = 40 + n
    const b = 20 + n
    return {
      id: `q-${n}`,
      prompt: `${a} + ${b}`,
      answer: String(a + b),
      // A dropped carry, a doubled carry, the wrong operation. Mal-rules, not
      // `answer ± 1`.
      distractors: [String(a + b - 10), String(a + b + 10), String(Math.abs(a - b))],
    }
  }
}

function newStreet(seed = 0x57ee7): Street {
  const street = new Street({ deal: dealer(), rng: new Rng(seed) })
  street.setStreetWidth(720)
  return street
}

/** Advance in real-sized frames and collect everything that came out. */
function run(street: Street, ms: number): StreetEvent[] {
  const out: StreetEvent[] = []
  for (let t = 0; t < ms; t += 16) out.push(...street.advance(16))
  return out
}

/** Advance until the street reaches `phase`, or give up. */
function until(street: Street, phase: Phase, cap = 400): StreetEvent[] {
  const out: StreetEvent[] = []
  for (let i = 0; i < cap && street.phase !== phase; i++) out.push(...street.advance(16))
  assert.equal(street.phase, phase, `the street never reached ${phase}`)
  return out
}

/** Open the plate correctly and walk out to the mob. */
function throughPlate(street: Street): StreetEvent[] {
  const out = until(street, "shutter")
  const plate = street.shutter
  assert.ok(plate)
  out.push(...street.hitRivet(rightRivet(plate)))
  out.push(...until(street, "melee"))
  return out
}

/** Clear the mob in front of you the fast way. Returns the events. */
function clearWave(street: Street): StreetEvent[] {
  const out: StreetEvent[] = []
  let guard = 0
  while (street.phase !== "clear" && guard++ < 200) {
    if (street.phase !== "melee") {
      out.push(...street.advance(16))
      continue
    }
    const size = street.crowd.size
    out.push(...(isPrime(size) ? street.swing() : street.strikeStud(bestSeam(size))))
  }
  assert.equal(street.phase, "clear", "the wave never cleared")
  return out
}

// ------------------------------------------------------------ the shape --

test("the street opens with a plate, and the plate is readable before input counts", () => {
  const street = newStreet()
  street.begin()
  assert.equal(street.phase, "shutter-down")
  assert.equal(street.open, false, "input was live while the plate was still coming down")
  // A rivet struck at a plate that has not landed is not an answer.
  assert.deepEqual(street.hitRivet(0), [])

  const events = until(street, "shutter")
  assert.equal(events.filter((e) => e.kind === "shutter").length, 1)
  assert.equal(street.open, true)
})

test("a plate is reported once, and what is reported is the numeral struck", () => {
  const street = newStreet()
  street.begin()
  until(street, "shutter")
  const plate = street.shutter
  assert.ok(plate)
  const right = rightRivet(plate)
  const wrong = plate.rivets.findIndex((_, i) => i !== right)
  const wrongText = plate.rivets[wrong]?.text as string

  const first = street.hitRivet(wrong).filter((e) => e.kind === "report")
  assert.equal(first.length, 1)
  const report = first[0]
  assert.ok(report && report.kind === "report")
  assert.equal(report.answered, wrongText, "the game reported something other than what was struck")
  assert.equal(report.correct, false)
  assert.equal(report.questionId, plate.questionId)

  // The plate is still down and the rivet is out. Nothing more is reported: a
  // record only ever rises, and the same item answered twice would raise it
  // twice for one piece of work.
  until(street, "shutter")
  const second = street.hitRivet(rightRivet(street.shutter as NonNullable<typeof plate>))
  assert.equal(second.filter((e) => e.kind === "report").length, 0)
  assert.equal(street.phase, "shutter-up")
})

test("the mob that comes through is always one the bar can break", () => {
  const street = newStreet()
  street.begin()
  const pool = new Set(crowdPool())
  const sizes: number[] = []
  for (let wave = 0; wave < 24; wave++) {
    throughPlate(street)
    const size = street.crowd.size
    sizes.push(size)
    assert.ok(pool.has(size), `a mob of ${size} is outside the pool`)
    if (!isPrime(size)) assert.ok(seamsFor(size).length > 0)
    clearWave(street)
    until(street, "shutter")
  }
  // Never twice running, and not all one number either.
  for (let i = 1; i < sizes.length; i++) assert.notEqual(sizes[i], sizes[i - 1])
  assert.ok(new Set(sizes).size >= 5, "the street sends the same handful of mobs")
})

test("a wave cleared the fast way takes exactly the minimum, and is stamped clean", () => {
  const street = newStreet()
  street.begin()
  for (let wave = 0; wave < 8; wave++) {
    throughPlate(street)
    const size = street.crowd.size
    const events = clearWave(street)
    const cleared = events.find((e) => e.kind === "cleared")
    assert.ok(cleared && cleared.kind === "cleared")
    assert.equal(cleared.size, size)
    assert.equal(cleared.taps, minimumTaps(size), `a clean route on ${size} was not minimal`)
    assert.equal(cleared.clean, true)
    assert.equal(cleared.solid, isPrime(size))
    until(street, "shutter")
  }
})

test("a block is three waves, and a finished block is the only thing marked", () => {
  const street = newStreet()
  street.begin()
  const marks: number[] = []
  for (let wave = 0; wave < WAVES_PER_BLOCK * 2; wave++) {
    throughPlate(street)
    clearWave(street)
    for (const event of until(street, "shutter")) {
      if (event.kind === "block") marks.push(event.blocks)
    }
  }
  assert.deepEqual(marks, [1, 2], "a block did not tick over every three waves")
  assert.equal(street.blocks, 2)
})

// ----------------------------------------------------------- being wrong --

test("a refused seam holds the mob still and shows the remainder", () => {
  const street = newStreet()
  street.begin()
  throughPlate(street)
  // Walk to a mob that has a stud it refuses. Every crowd in the pool does.
  let refused = 0
  for (let wave = 0; wave < 12 && refused === 0; wave++) {
    const size = street.crowd.size
    const bad = [2, 3, 5, 7, 11].find((k) => k < size && size % k !== 0)
    if (bad === undefined) {
      clearWave(street)
      until(street, "shutter")
      throughPlate(street)
      continue
    }
    const events = street.strikeStud(bad)
    const ring = events.find((e) => e.kind === "ringoff")
    assert.ok(ring && ring.kind === "ringoff")
    assert.equal(ring.seam, bad)
    assert.equal(ring.remainder, size % bad)
    assert.equal(street.crowd.size, size, "a refused seam moved the mob")
    assert.equal(street.phase, "ringoff")
    refused++
  }
  assert.equal(refused, 1)
})

test("fists off a locked rank cost a mark and nothing else", () => {
  const street = newStreet()
  street.begin()
  throughPlate(street)
  while (isPrime(street.crowd.size)) {
    clearWave(street)
    until(street, "shutter")
    throughPlate(street)
  }
  const before = street.crowd
  const events = street.swing()
  assert.ok(events.some((e) => e.kind === "bounce"))
  assert.deepEqual(street.crowd, before)
  assert.equal(street.push.marks, 1)
})

test("six slips shove you back, and nothing built is taken", () => {
  const street = newStreet()
  street.begin()
  throughPlate(street)
  while (isPrime(street.crowd.size)) {
    clearWave(street)
    until(street, "shutter")
    throughPlate(street)
  }
  const size = street.crowd.size
  const blocks = street.blocks

  for (let i = 0; i < PUSH_MAX - 1; i++) {
    assert.equal(street.phase, "melee")
    street.swing() // locked arms: a slip, every time
    run(street, TIMING.bounce + 32)
  }
  assert.equal(street.push.marks, PUSH_MAX - 1)
  const shoved = street.swing()
  assert.ok(shoved.some((e) => e.kind === "shove"))
  assert.equal(street.phase, "shove")

  // The same mob comes back with the smallest prime that goes into it lit on
  // the bar, and the ledger is untouched.
  until(street, "melee")
  assert.equal(street.crowd.size, size)
  assert.equal(street.crowd.ranks, 1)
  assert.equal(street.blocks, blocks, "a shove-back took a finished block away")
  assert.equal(street.push.marks, 0)
  assert.ok(street.hintSeam >= 2)
  assert.equal(size % street.hintSeam, 0, "the hint is not a seam")
})

test("a wrong rivet does not also lean on the mob", () => {
  // The answer has already gone to the host, which is where a wrong answer
  // belongs. Charging for it twice would make a child working out `503 − 178`
  // worse off than one who guesses fast.
  const street = newStreet()
  street.begin()
  until(street, "shutter")
  const plate = street.shutter
  assert.ok(plate)
  const right = rightRivet(plate)
  street.hitRivet(plate.rivets.findIndex((_, i) => i !== right))
  assert.equal(street.push.marks, 0)
})

test("knockdowns chain, and a tap into an empty street costs nothing", () => {
  // Eight ranks going down has to feel like a combo, not a queue: a swing lands
  // during the fall of the rank before it. A strike deliberately does not
  // chain — re-cutting a mob mid-crack would mean never seeing the rectangle
  // you just made.
  const street = newStreet()
  street.begin()
  throughPlate(street)
  while (isPrime(street.crowd.size) || street.crowd.size < 6) {
    clearWave(street)
    until(street, "shutter")
    throughPlate(street)
  }
  const size = street.crowd.size
  street.strikeStud(bestSeam(size))
  until(street, "melee")
  const ranks = street.crowd.ranks
  assert.ok(ranks >= 2, `only ${ranks} ranks to chain through`)

  // Every punch after the first lands inside the previous rank's fall.
  street.swing()
  assert.equal(street.phase, "fall")
  for (let i = 1; i < ranks; i++) {
    const events = street.swing()
    assert.ok(
      events.some((e) => e.kind === "down"),
      `the ${i + 1}th punch of the chain did not land`,
    )
  }
  assert.equal(street.crowd.ranks, 0)

  // And the street is empty. More taps are not claims about anything, so they
  // are neither bounces nor marks.
  assert.deepEqual(street.swing(), [])
  assert.equal(street.push.marks, 0)
  assert.deepEqual(street.strikeStud(2), [], "a stud landed on nobody")
})

// ---------------------------------------------------------- the pause trap --

test("the clock stops dead behind a sheet", () => {
  // Guard one: `advance` returns immediately while paused. Remove that line and
  // this test fails — the plate lands, the wave starts, and a block the child
  // never watched ticks over behind the host's sheet.
  const street = newStreet()
  street.begin()
  until(street, "shutter")
  throughPlate(street)
  assert.equal(street.phase, "melee")
  street.strikeStud(street.crowd.size % 2 === 0 ? 2 : 3)
  const phase = street.phase

  street.pause()
  assert.equal(street.paused, true)
  const events = run(street, 30_000)
  assert.deepEqual(events, [], "the machine produced events behind the sheet")
  assert.equal(street.phase, phase, "the street advanced while paused")
  assert.equal(street.elapsedMs, 0, "the phase clock ran while paused")
  assert.equal(street.open, false, "the street said it was taking input while paused")

  street.resume()
  assert.equal(street.paused, false)
  until(street, "melee")
})

test("a tap behind a sheet is not a tap", () => {
  // Guard two, and it is a separate guard on purpose: a machine that stood
  // still but still took input would spend the child's seam — and, at the
  // plate, their one report — on a screen they could not see. This test fails
  // if the `this.stopped` check is removed from `strikeStud`, from `swing`, or
  // from `hitRivet`, independently of guard one.
  const street = newStreet()
  street.begin()
  until(street, "shutter")

  street.pause()
  const plate = street.shutter
  assert.ok(plate)
  assert.deepEqual(street.hitRivet(rightRivet(plate)), [], "a rivet was struck behind the sheet")
  assert.equal(street.shutter?.reported, false, "the plate was answered behind the sheet")
  assert.equal(street.phase, "shutter", "the plate opened behind the sheet")
  street.resume()

  throughPlate(street)
  const crowd = street.crowd
  const taps = street.taps
  street.pause()
  assert.deepEqual(street.strikeStud(bestSeam(crowd.size) || 2), [], "a stud landed behind the sheet")
  assert.deepEqual(street.swing(), [], "a swing landed behind the sheet")
  assert.deepEqual(street.crowd, crowd, "the mob changed behind the sheet")
  assert.equal(street.taps, taps)
  assert.equal(street.push.marks, 0, "a slip was recorded behind the sheet")
})

test("a sheet is not thinking time", () => {
  // Guard three, and the one with a number attached. The latency reported for a
  // plate is measured on the street's own clock, and that clock does not
  // accumulate while paused — so a thirty-second sheet is worth zero
  // milliseconds of the child's time. Without guard one this reports 30 seconds
  // of deliberation over a plate that was behind a sheet, and the host records
  // it against them.
  const street = newStreet()
  street.begin()
  until(street, "shutter")

  run(street, 1_200)
  street.pause()
  run(street, 30_000)
  street.resume()
  run(street, 800)

  const plate = street.shutter
  assert.ok(plate)
  const events = street.hitRivet(rightRivet(plate))
  const report = events.find((e) => e.kind === "report")
  assert.ok(report && report.kind === "report")
  assert.ok(report.ms >= 1_900, `reported ${report.ms} ms, which is less than the time spent`)
  assert.ok(report.ms <= 2_200, `reported ${report.ms} ms, so the sheet was charged to the child`)
})

test("a paused street still resumes into the same wave", () => {
  const street = newStreet()
  street.begin()
  throughPlate(street)
  const crowd = street.crowd
  street.pause()
  run(street, 5_000)
  street.resume()
  assert.deepEqual(street.crowd, crowd)
  clearWave(street)
})

// -------------------------------------------------------------- the clock --

test("a frame delta longer than a phase does not owe the child a beat", () => {
  const street = newStreet()
  street.begin()
  // One enormous step: the phases run through in order rather than one per
  // frame, and the machine lands somewhere that waits for the child.
  street.advance(20_000)
  assert.ok(street.phase === "shutter" || street.phase === "melee", `landed on ${street.phase}`)
  assert.equal(street.open, true)
})

test("the crack takes longer across a wider street, because it is a speed", () => {
  const wide = newStreet()
  wide.setStreetWidth(1200)
  const narrow = newStreet()
  narrow.setStreetWidth(320)
  for (const street of [wide, narrow]) {
    street.begin()
    throughPlate(street)
    while (isPrime(street.crowd.size)) {
      clearWave(street)
      until(street, "shutter")
      throughPlate(street)
    }
    street.strikeStud(bestSeam(street.crowd.size))
    assert.equal(street.phase, "crack")
  }
  assert.ok(
    wide.durationMs > narrow.durationMs,
    `a 1200 px crack (${wide.durationMs} ms) was not longer than a 320 px one (${narrow.durationMs} ms)`,
  )
  assert.equal(Math.round(wide.durationMs - narrow.durationMs), Math.round(((1200 - 320) / 2400) * 1000))
})
