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
import { CHROME_TOP, ICON, LIFE_H, applySafeVars, hudRects } from "./layout.ts"

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
      ["the life bar", r.life],
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

/* ------------------------------------------------------- the safe area itself */

// THE INSETS WERE ZERO THE WHOLE TIME.
//
// Every assertion above is handed real insets. The browser was not. The
// stylesheet spelled the safe area `env(safe-area-inset-*)`, and a pack is a
// cross-origin iframe, where all four of those resolve to 0 — so on a notched
// phone the clock row that `hudRects` puts at y=110 was painted at y=63, inside
// the host's back chevron, while this file passed. The numbers were right and
// nothing carried them to the CSS.

/** Just enough of an element to record what was written onto it. */
function fakeRoot(): { el: HTMLElement; vars: Map<string, string> } {
  const vars = new Map<string, string>()
  const el = {
    style: { setProperty: (k: string, v: string) => void vars.set(k, v) },
  } as unknown as HTMLElement
  return { el, vars }
}

test("the safe area reaches the stylesheet as numbers, not as env()", () => {
  const { el, vars } = fakeRoot()
  applySafeVars(el, NOTCH_PORTRAIT)
  assert.equal(vars.get("--dw-safe-top"), "47px")
  assert.equal(vars.get("--dw-safe-bottom"), "34px")
  assert.equal(vars.get("--dw-safe-left"), "0px")
  assert.equal(vars.get("--dw-safe-right"), "0px")
})

test("a zero inset is written explicitly, never left to the env() fallback", () => {
  // `var(--x, fallback)` uses the fallback when the property is ABSENT. Inside
  // the app `env()` is the wrong answer even when the true inset is 0, so the
  // zero has to be stated.
  const { el, vars } = fakeRoot()
  applySafeVars(el, NONE)
  for (const k of ["--dw-safe-top", "--dw-safe-right", "--dw-safe-bottom", "--dw-safe-left"]) {
    assert.equal(vars.get(k), "0px", `${k} was left unset, so the CSS falls back to env()`)
  }
})

test("the offsets the CSS composes put the HUD where hudRects says it is", () => {
  // The composition the stylesheet performs, spelled out: every top offset is
  // `var(--dw-safe-top) + var(--hz-chrome-top)`. This is the arithmetic that
  // silently produced 63 instead of 110.
  const { el, vars } = fakeRoot()
  applySafeVars(el, NOTCH_PORTRAIT)
  const safeTop = Number.parseFloat(vars.get("--dw-safe-top") as string)
  const composed = safeTop + CHROME_TOP
  assert.equal(composed, hudRects(390, 844, NOTCH_PORTRAIT).top.y)
  assert.ok(
    composed > 57,
    `the clock row composes to y=${composed}; the host's corner squares end at 57`,
  )
})

/* ----------------------------------------------------------------- the life bar */

test("the life bar clears the home indicator, and is big enough to be a readout", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const insets = w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT
    const r = hudRects(w, h, insets)
    assert.ok(
      r.life.y + r.life.h <= h - insets.bottom,
      `${name}: the life bar runs under the home indicator`,
    )
    assert.equal(hitsHostChrome(r.life, w, insets), false, `${name}: the life bar is under chrome`)
  }
  // 12px was the shipped height and it read as decoration; a founder playtest
  // asked whether there was a health readout at all.
  assert.ok(LIFE_H >= 20, `the life bar is ${LIFE_H}px tall — that is a hairline, not a readout`)
})

test("the life bar does not collide with the sound and pause buttons", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const r = hudRects(w, h, NONE)
    const overlap =
      r.life.x < r.corner.x + r.corner.w &&
      r.corner.x < r.life.x + r.life.w &&
      r.life.y < r.corner.y + r.corner.h &&
      r.corner.y < r.life.y + r.life.h
    assert.equal(overlap, false, `${name}: the life bar is under the game's own two buttons`)
  }
})
