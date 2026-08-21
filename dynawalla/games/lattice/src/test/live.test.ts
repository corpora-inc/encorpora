// WHICH ONE GOES IN — checked against arithmetic, and checked at the glass.
//
// "A hint that lies is worse than no hint" is the whole reason this file is
// long. The marking says which of the numbers drifting in front of a child
// divides what is left of the target, and if it marks one mote too many the
// child sweeps it, flies into the ring, and is refused by a game that told them
// to.
//
// So it is checked three times over, at three different levels, because a
// sibling pack's hint tests all passed with the hint entirely unwired:
//
//   1. **The arithmetic**, against an independent oracle. Not `markOf`'s own
//      reasoning re-run — trial division, from scratch, over the whole band.
//   2. **The rules**, through the real `Arena`: a child who does exactly what
//      the marking says, and nothing else, opens the ring.
//   3. **The glass**, through the real `Scene.draw` against a context that
//      records instead of paints — because the arithmetic being right is worth
//      nothing if the renderer never asks for it, which is exactly the shape of
//      the bug this pack has been bitten by before.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena, MOTE_R } from "../game/arena.ts"
import { isPrime, primeFactors, productOf } from "../game/factor.ts"
import { markField, markOf, remainingOf } from "../game/live.ts"
import { CALM_OPENINGS } from "../game/opening.ts"
import { resonate } from "../game/resonance.ts"
import { Scene } from "../render/scene.ts"
import { CELESTIAL, BRASS } from "../render/palette.ts"
import { Grid } from "../sim/grid.ts"
import { createStubHost } from "../stubHost.ts"

// ── 1. the arithmetic ───────────────────────────────────────────────────────

/** Trial division, written out longhand. Nothing here imports the game's own. */
function divides(divisor: number, of: number): boolean {
  if (divisor < 2 || of < 1) return false
  let count = 0
  for (let k = divisor; k <= of; k += divisor) {
    if (k === of) count += 1
  }
  return count === 1
}

/** Primeness, longhand, so the oracle and the game share no code at all. */
function primeByHand(n: number): boolean {
  if (n < 2) return false
  for (let d = 2; d < n; d++) {
    if (n % d === 0) return false
  }
  return true
}

test("what is left is exact, and a hold that has gone past is not a number", () => {
  assert.equal(remainingOf(72, []), 72, "an empty hold does not leave the whole target")
  assert.equal(remainingOf(72, [2, 2]), 18)
  assert.equal(remainingOf(72, [2, 2, 2, 3, 3]), 1, "the finished hold does not leave 1")
  assert.equal(remainingOf(72, [5]), null, "a 5 in the hold of a 72 was not refused")
  assert.equal(remainingOf(72, [2, 2, 2, 2]), null, "a fourth 2 in a 72 was not refused")
  assert.equal(remainingOf(41, []), 41)
  assert.equal(remainingOf(41, [41]), 1)
  // Nothing that is not a number is a hold.
  assert.equal(remainingOf(Number.NaN, []), null)
  assert.equal(remainingOf(72, [Number.NaN]), null)
  assert.equal(remainingOf(72, [0]), null)
  assert.equal(remainingOf(0, []), null)
})

test("the marking is exactly the divisors — no more, and no fewer", () => {
  // Every target the resonator can put up, against every value that can be on
  // the field, at four different stages of a hold. Roughly a million triples.
  const rng = new Rng(0x11e)
  let needed = 0
  let carries = 0
  for (let target = 4; target <= 999; target++) {
    const wanted = primeFactors(target)
    const holds: number[][] = [[], wanted.slice(0, 1), wanted.slice(0, 2), [rng.pick([5, 7, 11])]]
    for (const hold of holds) {
      const remaining = remainingOf(target, hold)
      for (let value = 2; value <= 200; value++) {
        const mark = markOf(remaining, value)
        const prime = primeByHand(value)
        const truth =
          remaining === null || remaining <= 1
            ? "spare"
            : prime
              ? divides(value, remaining)
                ? "needed"
                : "spare"
              : sharesAFactor(value, remaining)
                ? "carries"
                : "spare"
        assert.equal(
          mark,
          truth,
          `target ${target} hold [${hold.join(",")}] value ${value}: marked ${mark}, is ${truth}`,
        )
        if (mark === "needed") needed += 1
        if (mark === "carries") carries += 1
      }
    }
  }
  // A marking that marked nothing at all would satisfy every assertion above.
  // Measured: 4,377 and 158,152 over the sweep.
  assert.ok(needed > 4_000, `only ${needed} motes were ever marked as wanted`)
  assert.ok(carries > 150_000, `only ${carries} stones were ever marked as worth shooting`)
})

/** Longhand: is there a number above 1 that goes into both? */
function sharesAFactor(a: number, b: number): boolean {
  const top = Math.min(a, b)
  for (let d = 2; d <= top; d++) {
    if (a % d === 0 && b % d === 0) return true
  }
  return false
}

test("a marked prime is one the hold can still take, at every stage of a hold", () => {
  // The property the child actually relies on: sweep a marked mote and the hold
  // still divides the target. Sweep an unmarked one and it does not.
  for (let target = 12; target <= 400; target++) {
    const wanted = primeFactors(target)
    if (wanted.length < 2) continue
    const hold: number[] = []
    for (const step of [0, 1]) {
      void step
      const remaining = remainingOf(target, hold)
      for (const value of [2, 3, 5, 7, 11, 13, 17, 19, 23]) {
        const after = remainingOf(target, [...hold, value])
        if (markOf(remaining, value) === "needed") {
          assert.notEqual(after, null, `target ${target}: a marked ${value} broke the hold`)
        } else if (isPrime(value)) {
          assert.equal(after, null, `target ${target}: an unmarked ${value} would have been fine`)
        }
      }
      hold.push(wanted[hold.length] as number)
    }
  }
})

// ── 2. the rules, through the real arena ────────────────────────────────────

test("a child who does exactly what the marking says opens the ring", () => {
  // The strongest statement available: follow the guidance and nothing else —
  // shoot what is collared brass, sweep what is collared celestial — and the
  // resonator opens. Driving `Arena.liveMarks` and `Arena.enter`, not the pure
  // functions, so a marking that is right but unreachable fails here.
  let opened = 0
  for (let seed = 1; seed <= 40; seed++) {
    const host = createStubHost({ seed, reducedMotion: true })
    const arena = new Arena(host, new Rng(seed ^ 0x51de), {
      width: 900,
      height: 700,
      experience: 2,
    })
    arena.begin(0)
    const res = arena.resonator
    if (!res) continue
    assert.ok(arena.liveMarks(), `seed ${seed}: the guided opening marked nothing`)

    for (let guard = 0; guard < 400; guard++) {
      const marks = arena.liveMarks()
      assert.ok(marks, `seed ${seed}: the marking went away mid-round`)
      const shoot = arena.bodies.find((b) => marks.get(b.id) === "carries")
      if (shoot) {
        arena.strike(shoot.id)
        continue
      }
      const sweep = arena.bodies.find((b) => marks.get(b.id) === "needed")
      if (!sweep) break
      const before = arena.bank.size
      arena.touch(sweep.id)
      assert.equal(arena.bank.size, before + 1, `seed ${seed}: a marked mote refused to be swept`)
    }

    // Nothing left is marked, which must mean the hold is finished rather than
    // that the guidance ran out of things to say.
    assert.equal(
      remainingOf(res.target, arena.bank.tiles),
      1,
      `seed ${seed}: following the marking left ${remainingOf(res.target, arena.bank.tiles)} to find`,
    )
    const verdict = resonate(res.target, arena.bank.tiles)
    assert.equal(verdict.kind, "open", `seed ${seed}: the ring refused a hold it had asked for`)
    arena.enter(1000)
    opened += 1
  }
  assert.ok(opened >= 30, `only ${opened} of 40 seeds ever armed a guided resonator`)
})

test("the marking goes quiet the moment the hold has gone wrong, and comes back", () => {
  const host = createStubHost({ seed: 0x9a17, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x9a17 ^ 0x51de), {
    width: 900,
    height: 700,
    experience: 2,
  })
  arena.begin(0)
  const res = arena.resonator
  assert.ok(res, "nothing was armed")
  // Put something in the hold that cannot be part of the answer.
  const stray = [43, 41, 37, 31].find((p) => res.target % p !== 0) as number
  arena.bank.take(stray)
  assert.equal(arena.remaining, null, "a hold that has gone past still left a number")
  const marks = arena.liveMarks()
  assert.ok(marks, "the marking disappeared entirely rather than going quiet")
  for (const [, mark] of marks) {
    assert.equal(mark, "spare", "something was still marked under a hold nothing can complete")
  }
  // One tap on the bar, and it is a game again.
  arena.vent()
  assert.equal(arena.remaining, res.target, "venting did not put the whole target back in front")
})

test("a fluent child is not walked through it", () => {
  const host = createStubHost({ seed: 0xf1, reducedMotion: true })
  const arena = new Arena(host, new Rng(0xf1 ^ 0x51de), {
    width: 900,
    height: 700,
    experience: CALM_OPENINGS,
  })
  arena.begin(0)
  assert.ok(arena.resonator, "nothing was armed")
  assert.equal(arena.liveMarks(), null, "the field was marked for a child who is past it")
})

test("with no question there is nothing to mark and nothing throws", () => {
  const host = createStubHost({ seed: 0xd0, reducedMotion: true })
  const arena = new Arena(host, new Rng(0xd0), { width: 900, height: 700, experience: 0 })
  assert.equal(arena.liveMarks(), null)
  assert.equal(arena.remaining, null)
  assert.deepEqual(markField(72, [], []), new Map())
})

// ── 3. the glass, through the real renderer ─────────────────────────────────

type Ring = { x: number; y: number; r: number; colour: string }

/**
 * A 2D context that answers everything and writes down the rings it was asked
 * to stroke and the strings it was asked to fill.
 *
 * Only the arcs that are actually stroked count, and each one carries the
 * `strokeStyle` that was live when `stroke` was called — which is what makes
 * "the celestial collar went round exactly these motes" a thing that can be
 * asserted rather than described.
 */
function recorder(): { ctx: CanvasRenderingContext2D; rings: Ring[]; text: string[] } {
  const rings: Ring[] = []
  const text: string[] = []
  const state: Record<string, unknown> = { strokeStyle: "#000", font: "16px sans" }
  let pending: Array<{ x: number; y: number; r: number }> = []
  const api: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 8 }),
    createRadialGradient: () => ({ addColorStop() {} }),
    beginPath: () => {
      pending = []
    },
    arc: (x: number, y: number, r: number) => {
      pending.push({ x, y, r })
    },
    stroke: () => {
      for (const arc of pending) rings.push({ ...arc, colour: String(state.strokeStyle) })
    },
    fillText: (s: string) => {
      text.push(s)
    },
  }
  return {
    ctx: new Proxy(
      {},
      {
        get: (_t, prop: string) =>
          prop in api ? api[prop] : prop in state ? state[prop] : () => undefined,
        set: (_t, prop: string, value) => {
          state[prop] = value
          return true
        },
      },
    ) as unknown as CanvasRenderingContext2D,
    rings,
    text,
  }
}

function fakeCanvas(w: number, h: number, ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: w, height: h, left: 0, top: 0 }),
    remove() {},
  } as unknown as HTMLCanvasElement
}

/** One real frame, and what came out of it. */
function frame(arena: Arena, w: number, h: number): { rings: Ring[]; text: string[] } {
  const { ctx, rings, text } = recorder()
  const scene = new Scene(fakeCanvas(w, h, ctx), true)
  const grid = new Grid({ cols: 6, rows: 6, width: w, height: h, reduced: true })
  scene.draw(arena, grid, { best: 0, paused: false, stalled: arena.stalled, hint: arena.hint() })
  return { rings, text }
}

test("the collar goes round exactly the numbers that divide what is left", () => {
  let checked = 0
  for (let seed = 1; seed <= 30; seed++) {
    const host = createStubHost({ seed, reducedMotion: true })
    const arena = new Arena(host, new Rng(seed ^ 0x51de), {
      width: 900,
      height: 700,
      experience: 3,
    })
    arena.begin(0)
    const res = arena.resonator
    if (!res) continue
    // Break the field open so there is a mix of stone and light to mark, then
    // let the pieces drift apart — two children of the same husk are born at the
    // same point, and a collar found by position would then be found on both.
    for (let guard = 0; guard < 6; guard++) {
      const composite = arena.bodies.find((b) => !b.prime)
      if (!composite) break
      arena.strike(composite.id)
    }
    for (let f = 0; f < 90; f++) arena.step(16.7)
    const marks = arena.liveMarks()
    assert.ok(marks, `seed ${seed}: nothing was marked`)

    const { rings, text } = frame(arena, 900, 700)
    // Only the rings that landed on something the child is looking at. The
    // resonator strokes brass too, and the ship and the tree stroke their own
    // shapes; none of them is at a body.
    const onBodies = rings.filter(
      (ring) =>
        (ring.colour === CELESTIAL || ring.colour === BRASS) &&
        arena.bodies.some((b) => Math.hypot(ring.x - b.x, ring.y - b.y) < 0.5),
    )
    let wanted = 0
    for (const body of arena.bodies) {
      const mark = marks.get(body.id)
      const at = onBodies.filter((ring) => Math.hypot(ring.x - body.x, ring.y - body.y) < 0.5)
      if (mark === "needed") {
        assert.ok(
          at.some((ring) => ring.colour === CELESTIAL && ring.r > MOTE_R),
          `seed ${seed}: the ${body.value} that goes in wears no collar`,
        )
        // And the reason, as arithmetic: `18÷3`, under the mote it is about.
        assert.ok(
          text.includes(`${arena.remaining}÷${body.value}`),
          `seed ${seed}: the ${body.value} says it goes in but not why`,
        )
        wanted += 1
        checked += 1
      } else if (mark === "carries") {
        assert.ok(
          at.some((ring) => ring.colour === BRASS),
          `seed ${seed}: the ${body.value} worth shooting wears no collar`,
        )
        wanted += 1
        checked += 1
      } else {
        assert.ok(
          !text.includes(`${arena.remaining}÷${body.value}`),
          `seed ${seed}: the ${body.value} was told it divides ${arena.remaining} and it does not`,
        )
      }
    }
    // **No more, and no fewer.** One collar per marked number and not one more,
    // so a renderer that collared the whole field fails here even though every
    // per-body assertion above would still pass.
    assert.equal(
      onBodies.length,
      wanted,
      `seed ${seed}: ${onBodies.length} collars on the field for ${wanted} marked numbers`,
    )
  }
  assert.ok(checked > 60, `only ${checked} collars were ever drawn`)
})

test("a fluent child's field is drawn with nothing on it", () => {
  const host = createStubHost({ seed: 0x5ea, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x5ea ^ 0x51de), {
    width: 900,
    height: 700,
    experience: CALM_OPENINGS,
  })
  arena.begin(0)
  assert.ok(arena.resonator, "nothing was armed")
  const { rings, text } = frame(arena, 900, 700)
  for (const body of arena.bodies) {
    const collar = rings.find(
      (ring) =>
        Math.hypot(ring.x - body.x, ring.y - body.y) < 0.5 &&
        (ring.colour === CELESTIAL || ring.colour === BRASS),
    )
    assert.equal(collar, undefined, `a ${body.value} was collared for a child who is past it`)
  }
  assert.ok(
    text.every((s) => !s.includes("÷")),
    "a division was spelled out for a child who is past it",
  )
})

test("the collar follows the hold: what is swept stops being asked for", () => {
  const host = createStubHost({ seed: 0x40d, reducedMotion: true })
  const arena = new Arena(host, new Rng(0x40d ^ 0x51de), {
    width: 900,
    height: 700,
    experience: 2,
  })
  arena.begin(0)
  const res = arena.resonator
  assert.ok(res, "nothing was armed")
  for (let guard = 0; guard < 400; guard++) {
    const composite = arena.bodies.find((b) => !b.prime)
    if (!composite) break
    arena.strike(composite.id)
  }
  const wanted = primeFactors(res.target)
  assert.ok(wanted.length >= 2, "the target has nothing to take apart")
  // The rarest prime in the answer, so the count is unambiguous.
  const rare = wanted[wanted.length - 1] as number
  const before = arena.liveMarks()
  assert.ok(before, "nothing was marked")
  const lit = arena.bodies.filter((b) => before.get(b.id) === "needed" && b.value === rare)
  assert.ok(lit.length > 0, `no ${rare} was marked on a field that needs one`)
  // Take every copy of it the answer wants, and it stops being asked for.
  let taken = 0
  const wants = wanted.filter((p) => p === rare).length
  for (const mote of lit) {
    if (taken >= wants) break
    arena.touch(mote.id)
    taken += 1
  }
  assert.equal(taken, wants, "the field could not supply the answer's own primes")
  const after = arena.liveMarks()
  assert.ok(after, "the marking disappeared")
  for (const body of arena.bodies) {
    if (body.value !== rare) continue
    assert.equal(
      after.get(body.id),
      "spare",
      `a ${rare} is still being asked for after the hold took all of them`,
    )
  }
  assert.equal(
    productOf(arena.bank.tiles) * (arena.remaining ?? 0),
    res.target,
    "what is left no longer multiplies back to the target",
  )
})
