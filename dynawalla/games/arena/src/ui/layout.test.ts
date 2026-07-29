// THE TWO CORNERS.
//
// The host paints a back chevron over the top-LEFT of every game and the
// how-to-play button over the top-RIGHT, 44px each. It does not reserve a band
// — reserving one costs a twelfth of a 568px phone to hold two buttons — so the
// promise a game makes instead is narrow and testable: nothing a child must
// READ or TOUCH lands in those two squares.
//
// ARENA broke that promise twice. The depth readout started at 14,14, directly
// under the chevron; the ladder was 14 from the right, directly under the
// question mark. Both are things a child reads. Neither was visible to any test
// in this suite, because every other test here is about the water.
//
// The rects come from `hudRects`, which is built from the same constants the
// stylesheet is built from, so this cannot pass while the CSS says otherwise.

import assert from "node:assert/strict"
import { test } from "node:test"

import { hitsHostChrome, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { BOARD_W, DEPTH_W, HUD_EDGE, HUD_TOP, RIBBON_H, hudRects, soundRect } from "./hud.ts"

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** A notched phone held tall, and the same phone turned on its side. */
const NOTCH_PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const NOTCH_LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const VIEWPORTS: Array<[string, number, number]> = [
  ["the smallest phone we support", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

for (const [name, w, h] of VIEWPORTS) {
  for (const [insetName, insets] of [
    ["no insets", NONE],
    ["a notch", w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT],
  ] as const) {
    test(`the readouts clear the host's corners at ${name} (${w}×${h}, ${insetName})`, () => {
      const r = hudRects(w, insets, h)

      assert.equal(
        hitsHostChrome(r.depth, w, insets),
        false,
        `${w}×${h}: the depth readout is under the host's back chevron`,
      )
      assert.equal(
        hitsHostChrome(r.board, w, insets),
        false,
        `${w}×${h}: the ladder is under the host's how-to-play button`,
      )
      // The Resonance question is the one frame in the game that asks a direct
      // question. It is the least affordable thing to put under a button.
      assert.equal(
        hitsHostChrome(r.question, w, insets),
        false,
        `${w}×${h}: the Resonance question is under host chrome`,
      )
      // The ribbon is the running equation — the single most read thing on the
      // screen in a maths game, and it is anchored to the opposite edge from
      // everything else here, so it needs its own assertion at every viewport.
      assert.equal(
        hitsHostChrome(r.ribbon, w, insets),
        false,
        `${w}×${h}: the equation ribbon is under host chrome`,
      )
    })
  }
}

test("the readouts stay inside the safe area on every edge they touch", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const insets = w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT
    const r = hudRects(w, insets, h)

    // Left, right and top. A HUD that pads only the top is correct in portrait
    // on one device and wrong the moment the child turns the tablet.
    assert.ok(r.depth.x >= insets.left, `${name}: the depth readout runs into the left inset`)
    assert.ok(r.depth.y >= insets.top, `${name}: the depth readout runs under the notch`)
    assert.ok(
      r.board.x + r.board.w <= w - insets.right,
      `${name}: the ladder runs into the right inset`,
    )
    assert.ok(r.board.y >= insets.top, `${name}: the ladder runs under the notch`)
    assert.ok(r.question.x >= insets.left, `${name}: the question runs into the left inset`)
    assert.ok(
      r.question.x + r.question.w <= w - insets.right,
      `${name}: the question runs into the right inset`,
    )
  }
})

test("the constants are the ones the host publishes, not numbers somebody typed", () => {
  // 57 is the bottom of the host's corner squares: 3px hairline + 10px margin
  // + a 44px control. Anything smaller and the readouts are under a button
  // again; this is the inequality the whole file exists to hold.
  assert.ok(HUD_TOP >= 57, `HUD_TOP is ${HUD_TOP} — the host's corners end at 57`)
  assert.ok(HUD_EDGE > 0 && BOARD_W > 0 && DEPTH_W > 0)
})

// THE RIBBON.
//
// It is anchored to the BOTTOM, which is the one edge nothing else in this file
// tested, and the bottom of an ARENA frame is already occupied: the sound
// button is a 44px square in the bottom-left and the perf readout sits in the
// bottom-right. A strip pinned to the bottom lands on both unless it is lifted
// clear, and "lifted clear" is arithmetic, not judgement.

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

for (const [name, w, h] of VIEWPORTS) {
  for (const [insetName, insets] of [
    ["no insets", NONE],
    ["a notch", w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT],
  ] as const) {
    test(`the equation ribbon is legible and unobstructed at ${name} (${w}×${h}, ${insetName})`, () => {
      const r = hudRects(w, insets, h).ribbon

      assert.equal(hitsHostChrome(r, w, insets), false, `${w}×${h}: the ribbon is under host chrome`)
      assert.ok(r.x >= insets.left, `${w}×${h}: the ribbon runs into the left inset`)
      assert.ok(r.x + r.w <= w - insets.right, `${w}×${h}: the ribbon runs into the right inset`)
      assert.ok(
        r.y + r.h <= h - insets.bottom,
        `${w}×${h}: the ribbon runs under the home indicator`,
      )
      assert.ok(r.y >= insets.top, `${w}×${h}: the ribbon runs under the notch`)
      assert.equal(
        overlaps(r, soundRect(h, insets)),
        false,
        `${w}×${h}: the ribbon sits on ARENA's own sound button`,
      )
      // It has to be wide enough to hold the longest line the game can print.
      // "1301388804 − 1301388804 = 0" is 26 characters; at the ribbon's smallest
      // clamp step of 15px that is roughly 250px of tabular digits.
      assert.ok(r.w >= 250, `${w}×${h}: the ribbon is only ${r.w}px wide — a long equation cannot fit`)
      assert.equal(r.h, RIBBON_H)
    })
  }
}

test("the ribbon is centred, and stays centred inside an asymmetric notch", () => {
  const w = 844
  const r = hudRects(w, NOTCH_LANDSCAPE, 390).ribbon
  const leftGap = r.x - NOTCH_LANDSCAPE.left
  const rightGap = w - NOTCH_LANDSCAPE.right - (r.x + r.w)
  assert.ok(Math.abs(leftGap - rightGap) < 1, `the ribbon is off-centre by ${Math.abs(leftGap - rightGap)}px`)
})
