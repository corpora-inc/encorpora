// THE COLOUR HELPERS MUST COMPOSE.
//
// `withAlpha` and `mix` are handed each other's output all over `render/`, and
// `heatColor` *is* `mix`. That made the output form of `mix` load-bearing rather
// than cosmetic, and it was wrong: `mix` returned `rgb(...)` and `withAlpha`
// parsed hex, so `withAlpha(heatColor(t), a)` produced `rgba(NaN,11,37,0.3)`.
//
// The canvas silently ignores an unparseable `fillStyle`, so five of the six
// composition sites in this game just drew the wrong colour and nothing failed
// anywhere. The sixth — the scorch glow in `decals.ts` — hands the string to
// `CanvasGradient.addColorStop`, which throws, and the throw is inside `drawMat`.
// The first kick-out of a session killed every frame after it from the mat
// onwards: no wrestlers, no referee, no pedals, audio still playing.
//
// So this file asserts the property that was missing rather than the fix: every
// colour string these three functions can produce, including from each other, is
// one a canvas can parse.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BRASS,
  BRASS_DARK,
  BRASS_HI,
  CANVAS,
  CHALK,
  CROWD_LANTERN,
  HEAT_WHITE,
  INK,
  IRON,
  KICKOUT,
  NIGHT,
  OXIDE,
  heatColor,
  mix,
  withAlpha,
} from "../render/palette.ts"

/**
 * The colours a 2D canvas will take. Deliberately strict about digits: a check
 * that accepted anything shaped like `rgba(...)` would have accepted
 * `rgba(NaN,11,37,0.3)`, which is the string that blanked the ring.
 */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(\d+(\.\d+)?,\d+(\.\d+)?,\d+(\.\d+)?(,[\d.]+)?\)$/

function assertParseable(value: string, what: string): void {
  assert.ok(
    HEX.test(value) || RGB.test(value),
    `${what} produced ${JSON.stringify(value)}, which a canvas cannot parse`,
  )
}

const PALETTE = [
  NIGHT,
  IRON,
  BRASS,
  BRASS_HI,
  BRASS_DARK,
  CANVAS,
  HEAT_WHITE,
  KICKOUT,
  OXIDE,
  INK,
  CHALK,
  CROWD_LANTERN,
]

/** The whole heat ramp, both endpoints and both of its interior seams. */
const HEATS = [0, 0.001, 0.15, 0.39, 0.4, 0.41, 0.71, 0.72, 0.73, 0.99, 1]

test("heatColor is parseable across the whole ramp, and composes with withAlpha", () => {
  // This is the exact composition that blanked the ring, at every temperature a
  // cooling scorch passes through.
  for (const t of HEATS) {
    const c = heatColor(t)
    assertParseable(c, `heatColor(${t})`)
    for (const a of [0, 0.28, 0.3, 0.85, 1]) {
      assertParseable(withAlpha(c, a), `withAlpha(heatColor(${t}), ${a})`)
    }
    for (const base of PALETTE) {
      assertParseable(mix(base, c, 0.5), `mix(base, heatColor(${t}), 0.5)`)
      assertParseable(withAlpha(mix(base, c, 0.5), 0.4), "withAlpha(mix(…, heatColor(…)), 0.4)")
    }
  }
})

test("every colour in the palette survives withAlpha and mix, in any combination", () => {
  for (const from of PALETTE) {
    assertParseable(withAlpha(from, 0.5), `withAlpha(${from}, 0.5)`)
    for (const to of PALETTE) {
      for (const t of [0, 0.5, 1]) {
        const m = mix(from, to, t)
        assertParseable(m, `mix(${from}, ${to}, ${t})`)
        assertParseable(withAlpha(m, 0.33), `withAlpha(mix(${from}, ${to}, ${t}), 0.33)`)
        assertParseable(mix(m, from, 0.5), "mix(mix(…), …)")
      }
    }
  }
})

test("mix hands back something it can be handed again", () => {
  // The reason the output form is a rule and not a taste: `heatColor` is `mix`,
  // and six call sites feed it straight back into `withAlpha` or `mix`.
  const once = mix(NIGHT, HEAT_WHITE, 0.5)
  assert.match(once, HEX, `mix returned ${once}, which withAlpha cannot take back`)
  assertParseable(withAlpha(once, 0.5), "withAlpha(mix(…))")
})

test("mix is still a mix: the ends are the ends and the middle is between them", () => {
  // Rewriting the parser must not change what the colours look like.
  assert.equal(mix("#000000", "#ffffff", 0).toLowerCase(), "#000000")
  assert.equal(mix("#000000", "#ffffff", 1).toLowerCase(), "#ffffff")
  assert.equal(mix("#000000", "#ffffff", 0.5).toLowerCase(), "#808080")
  assert.equal(mix("#ff0000", "#0000ff", 0.5).toLowerCase(), "#800080")
  // Out of range is clamped rather than extrapolated.
  assert.equal(mix("#000000", "#ffffff", -3).toLowerCase(), "#000000")
  assert.equal(mix("#000000", "#ffffff", 4).toLowerCase(), "#ffffff")
})

test("withAlpha keeps the channels and clamps the alpha", () => {
  assert.equal(withAlpha("#2b2b33", 0.5), "rgba(43,43,51,0.5)")
  assert.equal(withAlpha("rgb(43,43,51)", 0.5), "rgba(43,43,51,0.5)")
  assert.equal(withAlpha("rgba(43,43,51,0.2)", 0.5), "rgba(43,43,51,0.5)")
  assert.equal(withAlpha("#f0f", 1), "rgba(255,0,255,1)")
  assert.equal(withAlpha("#2b2b33", -1), "rgba(43,43,51,0)")
  assert.equal(withAlpha("#2b2b33", 9), "rgba(43,43,51,1)")
})

test("a colour nobody can read is loud, visible, and never NaN", () => {
  // The last line of defence. A future author who invents a fourth colour form
  // must get a wrong colour and a line in the console, not a black screen in
  // front of a child — an unparseable gradient stop is a thrown exception inside
  // the frame loop.
  const said: unknown[] = []
  const real = console.error
  console.error = (...args: unknown[]): void => {
    said.push(args[0])
  }
  try {
    for (const bad of ["hsl(200 50% 50%)", "#xyz", "", "rgb(a,b,c)", "color(display-p3 1 0 0)"]) {
      const out = withAlpha(bad, 0.5)
      assertParseable(out, `withAlpha(${JSON.stringify(bad)}, 0.5)`)
      assertParseable(mix(bad, NIGHT, 0.5), `mix(${JSON.stringify(bad)}, …)`)
    }
  } finally {
    console.error = real
  }
  assert.ok(said.length > 0, "an unreadable colour was swallowed silently")
})

test("a non-finite alpha or mix position is not allowed to reach the canvas", () => {
  assertParseable(withAlpha(IRON, Number.NaN), "withAlpha(IRON, NaN)")
  assertParseable(withAlpha(IRON, Number.POSITIVE_INFINITY), "withAlpha(IRON, Infinity)")
  assertParseable(mix(IRON, CHALK, Number.NaN), "mix(IRON, CHALK, NaN)")
})
