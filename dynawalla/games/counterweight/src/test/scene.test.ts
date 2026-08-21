// **NOTHING ON THE SCREEN COUNTS DOWN.**
//
// The founder's report on this game was "the action is rushed by the timer going
// down", against a press window that was already generous, item-derived and
// measured on this package's own solver bot. So the finding is not about the
// length: a visible draining countdown is an anxiety cue however much time it
// grants. `games/claim` deleted its draining gate ring for exactly this reason
// and wrote the rule down — **a clock may never take anything away from a child**
// — and this file is the same fence around the same decision.
//
// The strongest form of the claim is not "the bar is gone" but **"the screen
// cannot tell how long you have been thinking"**, so that is what is asserted:
// the frame drawn two seconds into a round and the frame drawn forty seconds into
// the same round, with everything else held equal, have to be the same frame,
// call for call.
//
// `guard.test.ts` holds the other half — that nothing in `render/` can even reach
// the guard's accessors.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Bout, TIMING_REDUCED } from "../game/bout.ts"
import { splitPrompt } from "../game/column.ts"
import { planStrikes } from "../game/places.ts"
import type { Question } from "../contract.ts"
import { Scene, type SceneState } from "../render/scene.ts"
import { Beam, TUNING_REDUCED } from "../sim/beam.ts"

const W = 390
const H = 844

/** A four-digit borrow across a zero: the longest guard the pack can serve. */
const PROMPT = "5001 − 2798"
const ANSWER = 2203

function deal(): () => Question {
  let n = 0
  return () => ({
    id: `q${++n}`,
    prompt: PROMPT,
    answer: String(ANSWER),
    distractors: [],
    domain: "add",
    difficulty: 0.9,
  })
}

/**
 * A 2D context that writes down every call and every property set, in order.
 *
 * Not a call *count* — the shape of the frame. A countdown that shrank a bar by a
 * pixel a second would be invisible to a counter and unmissable here.
 */
function recorder(): { ctx: CanvasRenderingContext2D; trace: string[] } {
  const trace: string[] = []
  const store = new Map<string, unknown>()
  const ctx = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (store.has(prop)) return store.get(prop)
        return (...args: unknown[]) => {
          trace.push(`${prop}(${args.map((a) => String(a)).join(",")})`)
          return {
            addColorStop: (at: number, colour: string) => trace.push(`stop(${at},${colour})`),
          }
        }
      },
      set(_t, prop: string, value) {
        store.set(prop, value)
        trace.push(`${prop}=${String(value)}`)
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
  return { ctx, trace }
}

function fakeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }),
  } as unknown as HTMLCanvasElement
}

/** An open round, `pressMs` into it, with nobody having touched anything. */
function openRound(thinkingMs: number): Bout {
  const bout = new Bout(deal(), TIMING_REDUCED)
  bout.begin()
  bout.advance(TIMING_REDUCED.hangMs + 1)
  assert.equal(bout.phase, "press")
  if (thinkingMs > 0) bout.advance(thinkingMs)
  assert.equal(bout.phase, "press", `${thinkingMs} ms of thinking ended the round`)
  return bout
}

type Shot = { w?: number; h?: number; reduced?: boolean }

/**
 * One frame, drawn. `sceneMs` is the wall clock the scene has seen — held equal
 * across a comparison so the stamp's breath is at the same phase in both.
 *
 * `reduced` defaults to **false**: the shipping path, breath and all. A test that
 * only ever drew the calm branch would be measuring the wrong screen.
 */
function frame(bout: Bout, sceneMs: number, shot: Shot = {}): string[] {
  const w = shot.w ?? W
  const h = shot.h ?? H
  const reduced = shot.reduced ?? false
  const { ctx, trace } = recorder()
  const scene = new Scene(fakeCanvas(ctx, w, h))
  // Never integrated here: `settleTo` puts it at rest, so the tuning is moot.
  const beam = new Beam(TUNING_REDUCED)
  beam.settleTo(bout.margin)
  scene.advance(sceneMs, reduced)
  const state: SceneState = {
    bout,
    beam,
    reduced,
    best: { scales: 0, hold: 0 },
    pressed: new Set<string>(),
    stampHeld: false,
    paused: false,
    column: splitPrompt(PROMPT),
    promptRaw: PROMPT,
  }
  trace.length = 0
  scene.draw(state)
  return trace
}

test("the draining countdown bar is gone and may not come back", () => {
  // `drawGauge` drew a clock in its left 62% and the strain in its right 38%.
  // `drawStrain` replaced it and draws only the strain. The old name must not
  // exist, under any signature.
  const proto = Scene.prototype as unknown as Record<string, unknown>
  assert.equal(proto.drawGauge, undefined, "the draining countdown bar is back")
  assert.equal(typeof proto.drawStrain, "function", "the strain gauge stopped being drawn")
})

test("forty seconds of thinking changes nothing on the screen", () => {
  // **The claim, in its strongest form.** Same item, same beam, same breath phase
  // — the only difference is how long the child has been looking at the column.
  // Every call and every style the frame makes has to be identical, because there
  // is nothing on this canvas that knows the answer to "how long have you had?".
  const quick = frame(openRound(2_000), 16)
  const slow = frame(openRound(40_000), 16)
  assert.ok(quick.length > 80, `a frame of only ${quick.length} calls is not a frame`)
  assert.deepEqual(slow, quick, "the screen can tell how long the child has been thinking")

  // And on the calm screen too, where the breath is pinned and there is even less
  // moving that a countdown could hide behind.
  assert.deepEqual(
    frame(openRound(40_000), 16, { reduced: true }),
    frame(openRound(2_000), 16, { reduced: true }),
    "the calm screen can tell how long the child has been thinking",
  )
})

test("and the frames really are sensitive enough to catch a change", () => {
  // The control. Without it the case above would also pass on a recorder that
  // recorded nothing, or on a scene that drew the same blank rectangle forever.
  const bout = openRound(2_000)
  const breathing = frame(bout, 16)
  // A quarter of a breath later (the period is 2π ⁄ 1.7 s ≈ 3.70 s) the stamp's
  // rim is at the other end of its pulse.
  const later = frame(bout, 16 + 924)
  assert.notDeepEqual(later, breathing, "the recorder cannot see the scene change at all")

  // And the one meter left in the gauge row does move — when the child moves it.
  const struck = openRound(2_000)
  struck.strike({ place: 1000, dir: 1 })
  assert.ok(struck.strain.load > 0)
  assert.notDeepEqual(frame(struck, 16), breathing, "a blow did not change the frame")

  // Asking for a calmer screen holds the breath still, and costs nothing else:
  // there is no information in a pulse, so nobody loses any by not having it.
  assert.deepEqual(
    frame(bout, 16, { reduced: true }),
    frame(bout, 16 + 924, { reduced: true }),
    "the calm screen still pulses",
  )
})

/**
 * A trace with the last of its precision taken off.
 *
 * Only for the periodicity cases below, where the comparison is between two
 * different wall clocks and the float noise in `sin` is not the point. The
 * thinking-time case above compares bit-for-bit, because there the inputs really
 * are identical and anything that differs is a real dependence on elapsed time.
 */
function blurred(trace: readonly string[]): string[] {
  return trace.map((call) => call.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(1)))
}

test("the breath is periodic, not a fraction of anything", () => {
  // A countdown is monotone; a breath comes back. One full period of the stamp's
  // pulse (2π ⁄ 1.7 s) apart, the frame is the same frame — which no draining
  // anything can be, however slowly it drains.
  const bout = openRound(2_000)
  const periodMs = ((2 * Math.PI) / 1.7) * 1000
  const at0 = blurred(frame(bout, 5_000))
  assert.notDeepEqual(
    at0,
    blurred(frame(bout, 5_000 + periodMs / 2)),
    "nothing on the screen breathes at all, so this proves nothing",
  )
  for (const periods of [1, 5, 20]) {
    assert.deepEqual(
      blurred(frame(bout, 5_000 + periodMs * periods)),
      at0,
      `the screen did not come back to itself after ${periods} breaths`,
    )
  }
})

/** Every string the frame drew, on a canvas of this size. */
function words(w: number, h: number): string {
  return frame(openRound(2_000), 16, { w, h })
    .filter((c) => c.startsWith("fillText("))
    .map((c) => c.slice("fillText(".length))
    .join(" | ")
}

test("a four-digit load is grouped with a thin space, not a full one", () => {
  // A full space at the pan's numeral size pushes `8 367` wider than the pan it is
  // centred in on a 320-point phone. The separator was a THIN SPACE and it went
  // missing once in a rewrite with nothing to catch it, so this catches it.
  const bout = openRound(2_000)
  // 1000 on the pan already; take it to 8367 the way a player would.
  for (const strike of planStrikes(8367 - bout.load)) {
    bout.strike(strike)
    bout.advance(300)
  }
  assert.equal(bout.load, 8367)
  // The string, not the whole call: the coordinates have digits in them too.
  const strings = frame(bout, 16)
    .filter((c) => c.startsWith("fillText("))
    .map((c) => c.slice("fillText(".length).split(",")[0] as string)
  const drawn = strings.find((t) => t.replace(/\D/g, "") === "8367")
  assert.ok(drawn, `the brass on the pan was never drawn: ${strings.join(" | ")}`)
  assert.equal(drawn, "8\u2009367", `the load was drawn as ${JSON.stringify(drawn)}`)
})

test("the screen says what the game now is, and nothing of what it was", () => {
  // The premise, on the glass — on a phone, where the labels shorten, and on a
  // tablet, where they do not. Nothing here may still be an arm-wrestle.
  const phone = words(390, 844)
  const tablet = words(834, 1194)
  for (const wanted of ["STAMP", "YOUR BRASS", "THE GOODS", "SCALE 1"]) {
    assert.ok(phone.includes(wanted), `a phone never says "${wanted}": ${phone}`)
  }
  assert.ok(tablet.includes("STAMP THE DOCKET"), `a tablet never says STAMP THE DOCKET: ${tablet}`)
  for (const banned of ["TURK", "SEAT", "YOUR LOAD", "HANGS", "GROUND"]) {
    assert.ok(!phone.includes(banned), `a phone still says "${banned}": ${phone}`)
    assert.ok(!tablet.includes(banned), `a tablet still says "${banned}": ${tablet}`)
  }
})
