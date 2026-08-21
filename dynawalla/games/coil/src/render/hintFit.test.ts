// "HINTS DON'T FIT ON MOBILE."
//
// The shipped hint was one line of text — `2×10  5×1` — drawn into the gauge at
// `x + unit × 1.4` with a font size taken from the panel's height and its width
// never measured at all. This file measures it, at the founder's own handset and
// at the smallest phone the pack supports, and then measures what replaced it.
//
// The metric is a model rather than a real canvas, and it is deliberately a
// GENEROUS one — 0.55 em per character for a serif at a mixed run of digits and
// multiplication signs, which is on the narrow side of real. A layout test that
// models type as narrower than it is only ever passes for the wrong reason, and
// the overflow below is large enough that the model cannot be what produces it.

import assert from "node:assert/strict"
import test from "node:test"

import { coilOf, linkValue } from "../game/place.ts"
import { PORTRAIT_ANDROID, VIEWPORTS, profiles } from "./viewports.ts"
import { labelX, viewLayout } from "./layout.ts"

/** Advance per character per pixel of type size. Narrow side of real. */
const ADVANCE = 0.55
const measure = (text: string, size: number): number => text.length * size * ADVANCE

/** The founder's handset, and the Android chrome it reports. */
const FOUNDER: [number, number] = [393, 851]
const ANDROID = PORTRAIT_ANDROID

/** The line the shipped hint drew, for a demand. `tally`, joined with two spaces. */
function oldHintText(demand: number): string {
  const counts = new Map<number, number>()
  for (const place of coilOf(demand)) counts.set(place, (counts.get(place) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([place, n]) => `${String(n)}×${String(linkValue(place))}`)
    .join("  ")
}

test("the hint that shipped ran off the founder's phone, and off a 320px one", () => {
  // The defect, reconstructed from the code that was there: the panel was
  // `shear.x − (furnace.x + furnace.w) − 24` wide, the type was `h × 0.17`, and
  // the line started `min(h × 0.26, 15) × 1.4` inside it.
  for (const [name, w, h, insets] of [
    ["the founder's phone", FOUNDER[0], FOUNDER[1], ANDROID],
    ["a 320px phone", 320, 568, { top: 0, right: 0, bottom: 0, left: 0 }],
  ] as Array<[string, number, number, typeof ANDROID]>) {
    const l = viewLayout(w, h, insets)
    // The gauge is the same strip it always was; only the hint inside it moved.
    const panelW = l.gauge.w
    const size = Math.max(10, l.levers.h * 0.17)
    const start = Math.min(l.levers.h * 0.26, 15) * 1.4
    const ink = measure(oldHintText(375), size)
    assert.ok(
      start + ink > panelW,
      `${name}: the shipped hint was ${(start + ink).toFixed(0)}px of line in a ${panelW.toFixed(0)}px panel, which would have fitted`,
    )
  }
})

test("the ten-for-one label stays on the lane, wherever the link is", () => {
  // The new hint writes `10×100` under the link that has to be opened, and that
  // link can be the last one in a row. Centring it there would hang it off the
  // very edge the shipped hint hung off, so `labelX` clamps — and this is where
  // the clamp is measured rather than assumed.
  for (const [shape, w, h] of VIEWPORTS) {
    for (const [profile, insets] of profiles(w, h)) {
      const where = `${shape} ${String(w)}×${String(h)}, ${profile}`
      const l = viewLayout(w, h, insets)
      const lane = l.lane
      // The widest label the game can produce: the biggest place a coil of
      // ninety-six times a power of ten reaches, opened.
      const label = "10×1000"
      const size = Math.max(9, lane.unit * 0.78)
      const width = measure(label, size)
      for (let cell = 0; cell < lane.capacity; cell++) {
        const cx = lane.x + (lane.w * cell) / Math.max(1, lane.capacity - 1)
        const x = labelX(lane, cx, width)
        assert.ok(x >= lane.x - 0.5, `"${label}" starts left of the lane at ${where}`)
        assert.ok(
          x + width <= lane.x + lane.w + 0.5,
          `"${label}" ends ${(x + width - lane.x - lane.w).toFixed(1)}px past the lane at ${where}`,
        )
      }
    }
  }
})

test("the lane is wide enough for the label it has to carry", () => {
  // The counterpart, and the reason the clamp above is not the whole answer: a
  // clamp on a lane narrower than the label would silently pin every label to
  // the left edge and still overflow. This fails loudly instead.
  const label = "10×1000"
  for (const [shape, w, h] of VIEWPORTS) {
    for (const [profile, insets] of profiles(w, h)) {
      const l = viewLayout(w, h, insets)
      const size = Math.max(9, l.lane.unit * 0.78)
      assert.ok(
        measure(label, size) + 4 <= l.lane.w,
        `"${label}" is ${measure(label, size).toFixed(0)}px on a ${l.lane.w.toFixed(0)}px lane at ${shape} ${String(w)}×${String(h)}, ${profile}`,
      )
    }
  }
})

test("the gauge's own numerals fit the panel they are printed in", () => {
  // The last hint stage prints `holding / wanted` in the gauge. It is fitted at
  // draw time against the real metrics, and what is checked here is that the
  // panel is big enough for the fitting to leave something legible — a fit that
  // shrinks to 9px is a fit that has failed.
  for (const [shape, w, h] of VIEWPORTS) {
    for (const [profile, insets] of profiles(w, h)) {
      const l = viewLayout(w, h, insets)
      const line = "9600 / 9599"
      const nominal = Math.min(l.gauge.h * 0.3, 20)
      const room = l.gauge.w - 12
      const fitted = Math.min(nominal, (room / measure(line, nominal)) * nominal)
      assert.ok(
        fitted >= 11,
        `the gauge would print the worst reading at ${fitted.toFixed(1)}px at ${shape} ${String(w)}×${String(h)}, ${profile}`,
      )
    }
  }
})
