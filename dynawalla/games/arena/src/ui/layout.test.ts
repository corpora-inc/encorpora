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
import { BOARD_W, DEPTH_W, HUD_EDGE, HUD_TOP, hudRects } from "./hud.ts"

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
      const r = hudRects(w, insets)

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
    })
  }
}

test("the readouts stay inside the safe area on every edge they touch", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const insets = w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT
    const r = hudRects(w, insets)

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
