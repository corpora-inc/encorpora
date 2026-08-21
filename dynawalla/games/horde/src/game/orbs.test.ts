// AN ANSWER IS A PLACE.
//
// From a founder playtest: "when the 3 answers show up, you can't swim into
// them, they stay equidistant from you so you can never get them."
//
// They did. `questTick` recomputed every orb's position from the player's
// CURRENT position on every frame, so an orb was an offset bolted to the
// diver's hip rather than a point in the world. Measured against the shipped
// code, driving the diver straight at an orb with a perfect stick: 172.0 px at
// t = 0, 159.8 px at t = 0.5 s, and 159.8 px at every sample thereafter — the
// 12.3 px of velocity lead, and nothing else, forever. Closing the last 132 px
// on lead alone needs 2200 px/s; the diver's base speed is 205 and the best
// build in the game adds 18 per CURRENT card.
//
// So DEEPSWARM could not be answered at the CORE at all. Every core it opened
// timed out. These tests drive the real integrator from `core/motion.ts` and
// the real geometry from `orbs.ts`.

import assert from "node:assert/strict"
import { test } from "node:test"

import { type Diver, drive, integrate } from "../core/motion.ts"
import { BASE_THINKING_SECONDS } from "./curriculum.ts"
import { ORB_HIT, ORB_RADIUS, type Orb, advance, distanceTo, place, reached } from "./orbs.ts"

const SPEED = 205 // loadout.ts, the base diver — no cards taken
const DT = 1 / 60
/** `step()`: the diver keeps most of its own clock while the world crawls. */
const BULLET_TIME = 0.15
const PDT = DT * (0.62 + 0.38 * BULLET_TIME)

function openCore(cx = 0, cy = 0): Orb[] {
  return place(cx, cy, ["12", "7", "19"], "7", 0.3)
}

/**
 * A child swimming at an orb: aim the stick at it, hold, and step the game.
 *
 * The stick is in screen space, so the world direction is converted through
 * `drive` — which is its own inverse — exactly as a thumb would produce it.
 */
function chase(orbs: Orb[], target: Orb, seconds: number): {
  diver: Diver
  samples: { t: number; d: number }[]
  struck: number | null
} {
  const diver: Diver = { x: 0, y: 0, vx: 0, vy: 0 }
  const samples: { t: number; d: number }[] = []
  let struck: number | null = null
  const frames = Math.round(seconds / DT)
  for (let f = 0; f <= frames; f++) {
    if (f % 30 === 0) samples.push({ t: f * DT, d: distanceTo(target, diver.x, diver.y) })
    if (struck === null && reached(target, diver.x, diver.y, diver.vx, diver.vy)) struck = f * DT
    const dx = target.x - diver.x
    const dy = target.y - diver.y
    const m = Math.hypot(dx, dy) || 1
    const stick = drive(dx / m, dy / m)
    integrate(diver, stick.x, stick.y, SPEED, PDT)
    advance(orbs, DT)
  }
  return { diver, samples, struck }
}

test("the distance to an answer CLOSES when the child swims at it", () => {
  const orbs = openCore()
  const { samples, struck } = chase(orbs, orbs[0] as Orb, 4)

  const first = samples[0] as { t: number; d: number }
  assert.ok(
    Math.abs(first.d - ORB_RADIUS) < 1,
    `the ring must open at ${ORB_RADIUS}px, not ${first.d.toFixed(1)}px`,
  )

  // The shipped bug in one assertion: after a second of perfect swimming the
  // orb was 159.8px away, having started 172px away. It has to actually close.
  const oneSecond = samples.find((s) => Math.abs(s.t - 1) < 1e-9)
  assert.ok(oneSecond, "expected a sample at t=1s")
  assert.ok(
    oneSecond.d < first.d - 100,
    `after 1s of swimming the answer was still ${oneSecond.d.toFixed(1)}px away ` +
      `(it started ${first.d.toFixed(1)}px away) — the child cannot reach it`,
  )

  assert.notEqual(struck, null, "the child never reached the answer in four seconds")
  assert.ok(
    (struck as number) < 2,
    `it took ${(struck as number).toFixed(2)}s to reach an answer; a CORE is not a marathon`,
  )
})

test("the distance never stalls — it falls on every sample until the strike", () => {
  const orbs = openCore()
  const { samples, struck } = chase(orbs, orbs[1] as Orb, 4)
  const upTo = samples.filter((s) => s.t <= (struck as number))
  assert.ok(upTo.length >= 2, "not enough samples before the strike to say anything")
  for (let i = 1; i < upTo.length; i++) {
    const prev = upTo[i - 1] as { t: number; d: number }
    const now = upTo[i] as { t: number; d: number }
    assert.ok(
      now.d < prev.d,
      `distance stalled at ${now.d.toFixed(1)}px between t=${prev.t.toFixed(2)} and ` +
        `t=${now.t.toFixed(2)} — an orb that keeps its distance is unanswerable`,
    )
  }
})

test("an orb is anchored to the WORLD, not to the diver", () => {
  // The structural half of the same fact: `advance` is not given the player, so
  // it cannot follow one. This checks the consequence — swim 400px away and the
  // ring stays where the CORE was.
  const orbs = openCore(0, 0)
  const before = orbs.map((o) => ({ x: o.x, y: o.y }))
  const diver: Diver = { x: 0, y: 0, vx: 0, vy: 0 }
  for (let f = 0; f < 240; f++) {
    integrate(diver, 1, 0, SPEED, PDT)
    advance(orbs, 0) // no time passes; only the diver moves
  }
  assert.ok(Math.abs(diver.x) > 200, `the diver only travelled ${diver.x.toFixed(0)}px`)
  orbs.forEach((o, i) => {
    const was = before[i] as { x: number; y: number }
    assert.equal(o.x, was.x, `orb ${i} followed the diver on x`)
    assert.equal(o.y, was.y, `orb ${i} followed the diver on y`)
    assert.equal(o.ax, 0)
    assert.equal(o.ay, 0)
  })
})

test("the ring turns slowly enough to be caught, and stays a ring", () => {
  const orbs = openCore()
  for (let f = 0; f < 600; f++) advance(orbs, DT)
  for (const o of orbs) {
    assert.ok(
      Math.abs(Math.hypot(o.x - o.ax, o.y - o.ay) - ORB_RADIUS) < 1e-6,
      "an orb drifted off its ring",
    )
  }
  // Tangential drift must be well under the diver's own pace in bullet time,
  // or the ring is a carousel the child chases rather than one they swim into.
  const diverPace = SPEED * (0.62 + 0.38 * BULLET_TIME)
  const tangential = Math.hypot(
    (orbs[0] as Orb).x - (orbs[0] as Orb).ax,
    (orbs[0] as Orb).y - (orbs[0] as Orb).ay,
  ) * 0.22
  assert.ok(tangential < diverPace * 0.35, `the ring drifts at ${tangential.toFixed(0)}px/s`)
})

test("a CORE is answerable inside the time it gives the child", () => {
  const orbs = openCore()
  const { struck } = chase(orbs, orbs[2] as Orb, BASE_THINKING_SECONDS)
  assert.notEqual(struck, null)
  assert.ok(
    (struck as number) * 4 < BASE_THINKING_SECONDS,
    `reaching an answer eats ${(((struck as number) / BASE_THINKING_SECONDS) * 100).toFixed(0)}% ` +
      "of the thinking window — the window is for thinking, not for swimming",
  )
})

test("no orb is easier to reach than another, and none of them is the answer's", () => {
  // COUNTERPOISE shipped with the answer in a predictable place and a bot
  // scored 97.2% without doing arithmetic. `place` is handed an already-shuffled
  // list and lays it out on a circle by index, so position carries nothing.
  const orbs = openCore()
  const d = orbs.map((o) => distanceTo(o, 0, 0))
  for (const x of d) assert.ok(Math.abs(x - ORB_RADIUS) < 1e-9, `an orb opened at ${x}px`)

  const angles = orbs.map((o) => o.ang)
  const gap = (2 * Math.PI) / orbs.length
  for (let i = 1; i < angles.length; i++) {
    assert.ok(
      Math.abs((angles[i] as number) - (angles[i - 1] as number) - gap) < 1e-9,
      "the orbs are not evenly spaced",
    )
  }

  // Same texts, answer moved: the geometry does not budge.
  const a = place(0, 0, ["12", "7", "19"], "7", 0.3)
  const b = place(0, 0, ["12", "7", "19"], "19", 0.3)
  a.forEach((o, i) => {
    assert.equal(o.x, (b[i] as Orb).x)
    assert.equal(o.y, (b[i] as Orb).y)
  })
  assert.deepEqual(a.map((o) => o.correct), [false, true, false])
  assert.deepEqual(b.map((o) => o.correct), [false, false, true])
})

test("a struck orb stops moving and cannot be struck twice", () => {
  const orbs = openCore()
  const o = orbs[0] as Orb
  o.state = 2
  const at = { x: o.x, y: o.y }
  advance(orbs, 1)
  assert.equal(o.x, at.x, "a resolved orb kept orbiting")
  assert.ok(o.t > 0, "a resolved orb must age, so the game can time its flourish")
  assert.equal(reached(o, o.x, o.y, 0, 0), false, "a resolved orb answered again")
})

test("the strike radius is generous enough for a thumb, not a pixel hunt", () => {
  const o = (openCore()[0] as Orb)
  assert.ok(ORB_HIT >= 44, `the strike radius is ${ORB_HIT}px; 44 is the platform touch minimum`)
  assert.equal(reached(o, o.x, o.y - (ORB_HIT - 1), 0, 0), true)
  assert.equal(reached(o, o.x, o.y - (ORB_HIT + 1), 0, 0), false)
})
