// NOTHING A CHILD MUST READ OR TOUCH IS UNDER THE HOST'S CHROME, AT ANY VIEWPORT.
//
// The exit chevron (top-left) and the how-to-play control (top-right) live in the
// HOST document, above this pack's iframe. No z-index can rescue a collision: a pack
// lays out clear of those two 44px squares or it loses the pixels. Twenty of the
// twenty-seven shipped games declared `viewport-fit=cover` — which opts a document
// INTO the notch — and then never read the insets back.
//
// And the insets a pack measures for itself are zeros. `env(safe-area-inset-*)` is a
// property of the top-level browsing context and a pack is a cross-origin child, so
// the host measures them and sends them; every viewport below is run with real device
// insets as well as with none.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  safeRect,
  setHostInsets,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts"
import { MIN_TABLET_W, PROMPT_MAX_CHARS } from "../game/ladder.ts"
import { MIN_KEY, columnsFor, criticalRects, hitKey, hitTablet, layout, promptPx } from "../render/layout.ts"

type Case = { name: string; w: number; h: number; insets: Insets }

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const LANDSCAPE: Insets = { top: 0, right: 44, bottom: 21, left: 44 }

const CASES: readonly Case[] = [
  { name: "the shortest phone this game will meet", w: 320, h: 480, insets: NONE },
  { name: "iPhone SE", w: 320, h: 568, insets: NONE },
  { name: "iPhone 8", w: 375, h: 667, insets: NONE },
  { name: "iPhone 15, portrait, notched", w: 393, h: 852, insets: NOTCH },
  { name: "iPhone 15, landscape, notched", w: 852, h: 393, insets: LANDSCAPE },
  { name: "iPad, portrait", w: 768, h: 1024, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
  { name: "iPad, landscape", w: 1024, h: 768, insets: { top: 24, right: 0, bottom: 20, left: 0 } },
]

const COUNTS = [3, 4, 5]

test("no rect a child must read or touch overlaps the host's two corners", () => {
  for (const c of CASES) {
    for (const count of COUNTS) {
      const l = layout(c.w, c.h, count, c.insets)
      for (const rect of criticalRects(l)) {
        assert.equal(
          hitsHostChrome(rect, c.w, c.insets),
          false,
          `${c.name} with ${String(count)} tablets: a rect at ` +
            `(${rect.x.toFixed(0)}, ${rect.y.toFixed(0)}, ${rect.w.toFixed(0)}×${rect.h.toFixed(0)}) ` +
            "sits under the host's exit or help control",
        )
      }
    }
  }
})

test("every key is at least 44px on its short side, everywhere", () => {
  for (const c of CASES) {
    for (const count of COUNTS) {
      const l = layout(c.w, c.h, count, c.insets)
      for (const key of l.keys) {
        assert.ok(
          Math.min(key.rect.w, key.rect.h) >= MIN_KEY - 0.001,
          `${c.name}: the "${key.label}" key is ${key.rect.w.toFixed(0)}×${key.rect.h.toFixed(0)}`,
        )
      }
    }
  }
})

test("the keypad and the gallery are laid out side by side without overlapping", () => {
  for (const c of CASES) {
    for (const count of COUNTS) {
      const l = layout(c.w, c.h, count, c.insets)
      const all = [...l.tablets, ...l.keys.map((k) => k.rect), l.paddle]
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]
          const b = all[j]
          if (!a || !b) continue
          const over =
            a.x < b.x + b.w - 0.01 &&
            b.x < a.x + a.w - 0.01 &&
            a.y < b.y + b.h - 0.01 &&
            b.y < a.y + a.h - 0.01
          assert.equal(over, false, `${c.name}: two touchable rects overlap`)
        }
      }
    }
  }
})

test("everything is inside the frame, and inside the safe rectangle where there is room", () => {
  for (const c of CASES) {
    for (const count of COUNTS) {
      const l = layout(c.w, c.h, count, c.insets)
      const safe = safeRect(c.w, c.h, c.insets)
      for (const rect of criticalRects(l)) {
        assert.ok(rect.x >= -0.01 && rect.x + rect.w <= c.w + 0.01, `${c.name}: a rect runs off the side`)
        assert.ok(rect.y >= safe.y - 0.01, `${c.name}: a rect starts above the safe area`)
        assert.ok(rect.x >= safe.x - 0.01, `${c.name}: a rect starts left of the safe area`)
        assert.ok(rect.y + rect.h <= c.h + 0.01, `${c.name}: a rect runs off the bottom of the frame`)
      }
      // Every supported viewport clears the home indicator as well as the frame.
      if (c.h >= 480) {
        const lowest = Math.max(...criticalRects(l).map((r) => r.y + r.h))
        assert.ok(
          lowest <= safe.y + safe.h + 0.01,
          `${c.name}: the layout reaches ${lowest.toFixed(0)} past a safe bottom of ` +
            `${(safe.y + safe.h).toFixed(0)}`,
        )
      }
    }
  }
})

test("a tablet is never narrower than the width the prompt budget was derived from", () => {
  for (const c of CASES) {
    for (const count of COUNTS) {
      const l = layout(c.w, c.h, count, c.insets)
      for (const rect of l.tablets) {
        assert.ok(
          rect.w >= MIN_TABLET_W - 0.5,
          `${c.name} with ${String(count)} tablets: a tablet is ${rect.w.toFixed(0)}px wide, under the ` +
            `${String(MIN_TABLET_W)}px the character budget assumes`,
        )
        // `promptPx` clamps at `MIN_NUMERAL_PX`, so asserting the floor here would pass
        // with the whole width calculation deleted. The claim worth making is that the
        // widest prompt a tablet will ACCEPT still FITS at the size it is given.
        const widest = "1".repeat(PROMPT_MAX_CHARS)
        const size = promptPx(widest, rect.w, rect.h)
        assert.ok(
          PROMPT_MAX_CHARS * size * 0.63 <= rect.w - 16 + 1,
          `${c.name}: the widest accepted prompt is ${String(size)}px and overflows a ` +
            `${rect.w.toFixed(0)}px tablet`,
        )
      }
    }
  }
})

test("the gallery wraps rather than squeezing, and the last row is centred", () => {
  assert.equal(columnsFor(300, 5), 2)
  assert.equal(columnsFor(1000, 5), 5)
  assert.equal(columnsFor(80, 5), 1)
  const narrow = layout(320, 568, 5, NONE)
  const rows = new Set(narrow.tablets.map((t) => t.y))
  assert.equal(rows.size, 3, "five tablets on a 320px phone should take three rows")
  // The odd tablet on the last row sits in the middle rather than in a corner, so a
  // gap never reads as a missing bidder.
  const last = narrow.tablets[4]
  assert.ok(last)
  assert.ok(Math.abs(last.x + last.w / 2 - 160) < 1, "the single tablet on the last row is off-centre")
})

test("a tap lands on the thing under it, and nowhere else", () => {
  const l = layout(375, 667, 4, NONE)
  const gavel = l.keys.find((k) => k.id === "gavel")
  assert.ok(gavel)
  assert.equal(hitKey(l, gavel.rect.x + 2, gavel.rect.y + 2)?.id, "gavel")
  assert.equal(hitKey(l, gavel.rect.x - 6, gavel.rect.y + 2), null)
  const first = l.tablets[0]
  assert.ok(first)
  assert.equal(hitTablet(l, first.x + first.w / 2, first.y + first.h / 2), 0)
  assert.equal(hitTablet(l, gavel.rect.x + 2, gavel.rect.y + 2), null)
})

test("the plaque moves below the host's corner band when it cannot fit between them", () => {
  // A device with big side insets in landscape leaves less than a plaque's width
  // between the two 44px corners. Both branches ship, so both are asserted.
  const roomy = layout(768, 1024, 3, NONE)
  assert.equal(roomy.plaqueBelowChrome, false)
  const cramped = layout(320, 568, 3, { top: 0, right: 60, bottom: 0, left: 60 })
  assert.equal(cramped.plaqueBelowChrome, true)
  assert.equal(hitsHostChrome(cramped.coins, 320, { top: 0, right: 60, bottom: 0, left: 60 }), false)
})

test("a 320px-tall frame keeps its 44px targets and runs off the bottom instead", () => {
  // **The stated floor of this layout is 400 CSS pixels of height**, which every phone
  // in portrait and every tablet in either orientation clears. A phone in LANDSCAPE on
  // an older 568×320 screen does not: the host's corner band takes 67 of those 320, and
  // a keypad, a paddle, a gallery and the block do not fit in the 243 that are left.
  //
  // The trade is stated here rather than discovered on a device. The keys keep their
  // 44px — the one number in `layout.ts` that is not a preference — and the layout runs
  // past the bottom edge, so the last row of controls is partly off screen rather than
  // present and unhittable. The proper fix is a side-by-side arrangement for short wide
  // frames, with the keypad beside the gallery instead of under it, and it is not in
  // this first cut.
  const l = layout(568, 320, 5, NONE)
  for (const key of l.keys) {
    assert.ok(Math.min(key.rect.w, key.rect.h) >= MIN_KEY - 0.001, "a target was shrunk instead")
  }
  const lowest = Math.max(...criticalRects(l).map((r) => r.y + r.h))
  assert.ok(lowest > 320, "this case now fits — delete the exception and add it to CASES")
  assert.ok(lowest < 400, `the overflow is ${lowest.toFixed(0)}px, which is more than one row`)
})

test("the insets the host sends are the ones the layout uses", () => {
  // Inside the app a pack that measured for itself would read zeros and draw its HUD
  // under the notch believing it was safe.
  try {
    setHostInsets(NOTCH)
    const l = layout(393, 852, 3)
    assert.equal(l.insets.top, NOTCH.top)
    assert.ok(l.coins.y >= NOTCH.top, "the strongbox plaque was drawn into the notch")
  } finally {
    setHostInsets(null)
  }
})
