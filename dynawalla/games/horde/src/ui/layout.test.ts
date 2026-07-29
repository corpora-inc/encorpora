// THE TWO CORNERS.
//
// The host floats a 44px back chevron over the top-LEFT of every game and the
// how-to-play button over the top-RIGHT. It reserves no band — reserving one
// costs a twelfth of a 568px phone to hold two buttons — so the promise a game
// makes instead is narrow and testable: nothing a child must READ or TOUCH
// lands in those two squares.
//
// DEEPSWARM broke it in three places at once. The sound and pause buttons were
// at top:10, right:10 — the host's how-to-play square exactly, a third button
// on the same pixels. The clock/level/kills row spanned the full width at
// top:14 and its two ends reached into both corners on a small phone. The
// debug fps readout was under the chevron.
//
// And the XP bar had no `env()` at all: `top:0; left:0; right:0`, so on a
// notched phone held sideways the first forty-seven pixels of fill were behind
// the sensor housing.
//
// The rects come from `hudRects`, and the same constants are written onto the
// root as custom properties at mount, so this cannot pass while the stylesheet
// says something else.

import assert from "node:assert/strict"
import { test } from "node:test"

import { hitsHostChrome, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { CHROME_TOP, ICON, hudRects } from "./layout.ts"

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
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
    test(`the HUD clears the host's corners at ${name} (${w}×${h}, ${insetName})`, () => {
      const r = hudRects(w, h, insets)

      assert.equal(
        hitsHostChrome(r.top, w, insets),
        false,
        `${w}×${h}: the clock and the kill count are under host chrome`,
      )
      assert.equal(
        hitsHostChrome(r.corner, w, insets),
        false,
        `${w}×${h}: the sound and pause buttons are under the host's how-to-play button`,
      )
      assert.equal(
        hitsHostChrome(r.fps, w, insets),
        false,
        `${w}×${h}: the fps readout is under the host's back chevron`,
      )
      // The XP bar is a 7px hairline flush under the host's own 3px hairline.
      // It is allowed to share the top edge with decoration; it is not allowed
      // to reach the 44px squares, which begin 13px down.
      assert.equal(
        hitsHostChrome(r.xpbar, w, insets),
        false,
        `${w}×${h}: the XP bar reaches into a host corner`,
      )
    })
  }
}

test("every HUD box stays inside the safe area on the edges it touches", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const insets = w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT
    const r = hudRects(w, h, insets)

    for (const [what, box] of [
      ["the XP bar", r.xpbar],
      ["the clock row", r.top],
      ["the sound and pause buttons", r.corner],
      ["the fps readout", r.fps],
    ] as const) {
      assert.ok(box.x >= insets.left, `${name}: ${what} runs into the left inset`)
      assert.ok(
        box.x + box.w <= w - insets.right + 0.5,
        `${name}: ${what} runs into the right inset`,
      )
      assert.ok(box.y >= insets.top, `${name}: ${what} runs under the notch`)
      assert.ok(
        box.y + box.h <= h - insets.bottom + 0.5,
        `${name}: ${what} runs under the home indicator`,
      )
    }
  }
})

test("the two buttons are still reachable, not merely legal", () => {
  // Clearing the corners by leaving the screen would satisfy every assert
  // above. They have to be somewhere a thumb goes.
  for (const [name, w, h] of VIEWPORTS) {
    const r = hudRects(w, h, NONE)
    assert.ok(r.corner.x > w * 0.5, `${name}: the buttons drifted off the right side`)
    assert.ok(r.corner.y > h * 0.5, `${name}: the buttons drifted off the bottom`)
    assert.equal(r.corner.h, ICON)
  }
})

test("the offset is the host's own number, not one somebody typed", () => {
  // 57 is the bottom of the host's corner squares: a 3px hairline, a 10px
  // margin and a 44px control. This is the inequality the file exists to hold.
  assert.ok(CHROME_TOP >= 57, `CHROME_TOP is ${CHROME_TOP} — the host's corners end at 57`)
})
