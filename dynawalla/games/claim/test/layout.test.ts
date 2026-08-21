// THE FRAME.
//
// `claim.test.ts` proves the arithmetic: that a flood fills the right cells,
// that a fraction reduces, that a band is exact in cells. Not one of its
// assertions can see WHERE anything is drawn, which is why CLAIM shipped with
// `LVL 4` underneath the host's exit control, the score and the three lives
// underneath the how-to-play control, the arena centred into the home
// indicator, and the mute button at `bottom: 10px` where the system takes the
// gesture.
//
// A CSS-only fix would be just as invisible. So the numbers live in
// `src/game/layout.ts`, the stylesheet consumes them as custom properties, and
// this file asserts them.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  HOST_CONTROL,
  hitsHostChrome,
  type Insets,
} from "../../../packs/shared/game-chrome/index.ts"
import { arenaRect, hudFrame, muteRect } from "../src/game/layout.ts"

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Phones both ways, tablets both ways, and the smallest phone that ships. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
  ["laptop", 1440, 900],
]

/** The same devices with the insets a real notch and home indicator produce. */
const NOTCHED: Array<[string, number, number, Insets]> = [
  ["phone portrait, notch + home indicator", 390, 844, { top: 59, right: 0, bottom: 34, left: 0 }],
  ["phone landscape, notch on the left", 844, 390, { top: 0, right: 59, bottom: 21, left: 59 }],
  ["small phone", 320, 568, { top: 44, right: 0, bottom: 34, left: 0 }],
]

const ALL: Array<[string, number, number, Insets]> = [
  ...VIEWPORTS.map(([n, w, h]) => [n, w, h, NONE] as [string, number, number, Insets]),
  ...NOTCHED,
]

for (const [name, w, h, insets] of ALL) {
  test(`nothing a child must read sits under the host's corners — ${name} (${w}×${h})`, () => {
    const f = hudFrame(w, h, insets)

    // `LVL 4`. Read every level.
    assert.equal(hitsHostChrome(f.left, w, insets), false, `${name}: the level counter is covered`)

    // The score and the LIVES. A child who cannot see three pink squares go to
    // two does not know the run is ending.
    assert.equal(
      hitsHostChrome(f.right, w, insets),
      false,
      `${name}: the score and lives are covered`,
    )

    // The fraction bar. It IS the pedagogy — cut into the goal's denominator —
    // and it spans the full width, so it cannot dodge the corners sideways. It
    // has to sit below them, and BOTH of its ends have to be visible.
    assert.equal(hitsHostChrome(f.meter, w, insets), false, `${name}: the fraction bar is covered`)

    // The two clusters must not have been pushed into each other, which is the
    // failure mode of "just add padding until the test goes green".
    assert.ok(
      f.left.x + f.left.w <= f.right.x + 0.5,
      `${name}: the level counter and the score overlap`,
    )
    // And the goal fraction, which sits between them, must keep real room.
    assert.ok(
      f.right.x - (f.left.x + f.left.w) >= 40,
      `${name}: only ${(f.right.x - f.left.x - f.left.w).toFixed(0)}px left for the goal fraction`,
    )
  })

  test(`the HUD stays inside the safe area — ${name} (${w}×${h})`, () => {
    const f = hudFrame(w, h, insets)
    assert.ok(f.left.x >= insets.left, `${name}: the level counter is under the left inset`)
    assert.ok(
      f.right.x + f.right.w <= w - insets.right + 0.5,
      `${name}: the score is under the right inset`,
    )
    assert.ok(f.meter.x >= insets.left, `${name}: the fraction bar starts under the left inset`)
    assert.ok(
      f.meter.x + f.meter.w <= w - insets.right + 0.5,
      `${name}: the fraction bar runs under the right inset`,
    )
    assert.ok(f.padTop >= insets.top, `${name}: the HUD starts above the safe area`)
  })

  test(`the mute button is a real, reachable target — ${name} (${w}×${h})`, () => {
    const m = muteRect(w, h, insets)
    assert.equal(m.w, HOST_CONTROL, "the mute button is under the platform touch floor")
    assert.equal(m.h, HOST_CONTROL, "the mute button is under the platform touch floor")
    assert.ok(
      m.y + m.h <= h - insets.bottom + 0.5,
      `${name}: the mute button is inside the home indicator`,
    )
    assert.ok(
      m.x + m.w <= w - insets.right + 0.5,
      `${name}: the mute button is under the right inset`,
    )
    assert.equal(hitsHostChrome(m, w, insets), false, `${name}: the mute button is under chrome`)
  })
}

// The arena is measured in stage-local pixels, and the stage is flush to the
// frame's left, right and bottom edges. Its height here is the frame height
// minus a plausible HUD; the assertion does not depend on the exact value.
for (const [name, w, h, insets] of NOTCHED) {
  test(`the arena keeps its ground out of the unsafe edges — ${name}`, () => {
    const stageH = Math.max(120, h - 130)
    const a = arenaRect(w, stageH, insets)

    assert.ok(a.x >= insets.left, `${name}: the arena starts under the left inset`)
    assert.ok(
      a.x + a.w <= w - insets.right + 0.5,
      `${name}: the arena runs under the right inset`,
    )
    assert.ok(
      a.y + a.h <= stageH - insets.bottom + 0.5,
      `${name}: the bottom rows of cells are under the home indicator`,
    )
    // And it did not collapse to nothing doing it.
    assert.ok(a.w > w * 0.6, `${name}: the arena lost ${(100 - (a.w * 100) / w).toFixed(0)}% width`)
    assert.ok(a.h > stageH * 0.7, `${name}: the arena lost too much height`)
  })
}

test("with no insets the arena is the whole stage, exactly as it was", () => {
  // The safe-area work must be a no-op on a device with nothing to avoid, or it
  // is a regression dressed as a fix.
  const a = arenaRect(1024, 600, NONE)
  assert.deepEqual(a, { x: 0, y: 0, w: 1024, h: 600 })
})
