// THE TWO CORNERS AND THE NOTCH.
//
// FORGE draws everything on one canvas — the SPARKS readout, the heat gauge,
// the six station rows, the four ingots, the QUENCH plate. A canvas cannot read
// `env(safe-area-inset-*)`, because that is a CSS value, and this game declares
// `viewport-fit=cover`, which opts the document *into* the notch. So the
// readout was laid out from the raw viewport height and sat under the status
// bar, and the ingots sat on the home indicator.
//
// On top of that the host floats two 44px controls over the pack: exit at the
// top-left, how-to-play at the top-right. The header ran the full width, so the
// SPARKS label and the top of the number were under the exit control, and the
// QUENCH plate — a button — was under the help control. In landscape the
// station column reaches the very top of the screen, so the REACTOR row was
// under the exit control too.
//
// **What counts as critical here**, and it is a short list: the SPARKS readout
// and its rate (the score, and the number the whole game is about), the heat
// gauge and its printed multiplier, the six station rows (the buy targets), the
// four ingots (the answer targets), the QUENCH plate and the audio toggle.
//
// **What is deliberately NOT critical**, and must keep bleeding to the glass:
// the backdrop, the hammered-iron pattern, the furnace body, the crucible glow,
// the ambient embers, the full-screen flash. Those use the raw `w`/`h` on
// purpose — it is the entire reason `cover` is set — and a test below asserts
// they are untouched by the insets so nobody "fixes" this by letterboxing.
//
// The insets are passed explicitly rather than measured, because node has no
// notch and a test that measures zero proves nothing about a device.

import { strict as assert } from "node:assert"
import { test } from "node:test"

import { hitsHostChrome, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { computeLayout, type Rect } from "./layout.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
  // The small rotated phones matter more than the big one and were the gap
  // that let a regression through: with only 844×390 in this list, a landscape
  // change that halved the workbench's width still passed. 568×320 is a
  // rotated iPhone SE and 667×375 is a rotated iPhone 8.
  ["phone landscape, small", 568, 320],
  ["phone landscape, medium", 667, 375],
  ["desktop wide", 1920, 1080],
]

/** No insets — a laptop, an older tablet, a desktop browser. */
const FLAT: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** A notched phone held upright: status bar above, home indicator below. */
const NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
/** The same phone on its side. Both long edges lose room. */
const NOTCH_SIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const INSETS: Array<[string, Insets]> = [
  ["flat", FLAT],
  ["notched", NOTCH],
  ["notched, on its side", NOTCH_SIDE],
]

/**
 * The inset profiles a given frame can actually be handed.
 *
 * iOS reports room for the notch on the LONG edges: top and bottom when the
 * frame is taller than it is wide, left and right when it is wider. It never
 * reports both at once, so a tall frame with 47px side insets is a shape no
 * device produces. The containment test still probes every profile against
 * every viewport — containment must hold whatever it is handed — but the tests
 * about how much room is LEFT use this, because measuring a shape that cannot
 * exist only invents failures.
 */
const realProfiles = (w: number, h: number): Array<[string, Insets]> =>
  w > h ? INSETS : INSETS.filter(([n]) => n !== "notched, on its side")

const inside = (r: Rect, a: Rect): boolean =>
  r.x >= a.x - 0.5 &&
  r.y >= a.y - 0.5 &&
  r.x + r.w <= a.x + a.w + 0.5 &&
  r.y + r.h <= a.y + a.h + 0.5

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    test(`nothing readable or tappable is covered — ${vname} (${w}×${h}), ${iname}`, () => {
      const area = safeRect(w, h, insets)
      // Six revealed: a developed save is the worst case, because that is when
      // the station column is at its tallest and its top row reaches furthest
      // up the screen.
      const l = computeLayout(w, h, 6, area)

      const named: Array<[string, Rect]> = [
        ["the SPARKS readout", l.header],
        ["the QUENCH plate", l.quench],
        ["the audio toggle", l.audio],
        ["the station column", l.chain],
        ["the anvil", l.anvil],
        ["the work bar", l.billet],
      ]
      l.rows.forEach((r, i) => named.push([`station row ${i}`, r]))
      l.slugs.forEach((r, i) => named.push([`ingot ${i}`, r]))

      for (const [name, r] of named) {
        // 1. Inside the safe rectangle. If `computeLayout` ignored `area` these
        //    fail on the notched profiles — the device-only bug, caught here.
        assert.ok(inside(r, area), `${name} leaves the safe area: ${JSON.stringify(r)}`)

        // 2. Clear of the two host corners. The exit and help squares exist on
        //    every device, insets or not, so these hold at FLAT too — this gate
        //    fails on a laptop as well as on a phone, and cannot pass by
        //    accident the way a zero-inset-only assertion would.
        assert.equal(
          hitsHostChrome(r, w, insets),
          false,
          `${name} is under a host control: ${JSON.stringify(r)}`,
        )
      }
    })
  }
}

test("the tap targets stay big enough for a child's thumb", () => {
  // Narrowing the header is only acceptable while nothing shrinks below the
  // platform's minimum touch target. The ingots are the answer buttons and the
  // rows are the buy buttons.
  //
  // This runs over EVERY inset profile, not just the top/bottom one. Landscape
  // insets sit on the long edges, so `NOTCH_SIDE` is the only profile in which
  // a landscape layout loses horizontal room — and it is the profile under
  // which the ingots first fell to 24px wide. Testing only `NOTCH` here made
  // the assertion unable to see the very case it was written for.
  for (const [[name, w, h], [iname, insets]] of VIEWPORTS.flatMap((v) =>
    realProfiles(v[1], v[2]).map((i) => [v, i] as const),
  )) {
    const l = computeLayout(w, h, 6, safeRect(w, h, insets))
    const label = `${name}, ${iname}`

    // 44px is the platform floor and about the smallest square a seven-year-old
    // hits reliably. The ingots are the answer buttons; this one is absolute.
    for (const s of l.slugs) {
      assert.ok(s.h >= 44, `${label}: an ingot is ${s.h.toFixed(1)}px tall`)
      assert.ok(s.w >= 44, `${label}: an ingot is ${s.w.toFixed(1)}px wide`)
    }
    assert.ok(l.quench.h >= 30, `${label}: the quench plate is ${l.quench.h.toFixed(1)}px tall`)
    // `header.ts` fits the mantissa into `header.w - 20 * scale`, so a header
    // squeezed to nothing prints an unreadable score rather than throwing. 150
    // is what the narrowest supported landscape leaves once the QUENCH corner
    // is cleared: a rotated iPhone SE with insets on both long edges.
    assert.ok(l.header.w >= 150, `${label}: the header is ${l.header.w.toFixed(1)}px wide`)

    // The QUENCH plate is right-anchored inside the header and must stay in it.
    assert.ok(l.quench.x >= l.header.x - 0.5, `${label}: the quench plate overhangs its header`)
  }
})

test("the station column gives up the notch and not a pixel more", () => {
  // The pitch cannot have an absolute floor: on a short landscape frame the
  // column is six rows in whatever is left after the crucible, and that is
  // small before any of this. What CAN be pinned is the thing a regression
  // would break — that honouring the safe area costs the column exactly the
  // height the inset took, shared out over its six rows, and nothing extra.
  //
  // This is the shape of the bug that shipped in landscape: the workbench was
  // slid sideways by a whole 62px rail it did not need, so the loss was far
  // larger than the inset. An absolute floor would not have caught it.
  for (const [name, w, h] of VIEWPORTS) {
    const flat = computeLayout(w, h, 6, safeRect(w, h, FLAT))
    for (const [iname, insets] of realProfiles(w, h)) {
      const area = safeRect(w, h, insets)
      const l = computeLayout(w, h, 6, area)
      const lostH = h - area.h
      assert.ok(
        flat.rowH - l.rowH <= lostH / 6 + 1,
        `${name}, ${iname}: the pitch fell ${(flat.rowH - l.rowH).toFixed(1)}px for a ${lostH}px inset`,
      )
      const lostW = w - area.w
      const widest = flat.slugs[0]
      const got = l.slugs[0]
      assert.ok(widest !== undefined && got !== undefined)
      assert.ok(
        widest.w - got.w <= lostW / 4 + 1,
        `${name}, ${iname}: an ingot lost ${(widest.w - got.w).toFixed(1)}px for a ${lostW}px inset`,
      )
    }
  }

  // And on the frame a device actually has, the pitch clears a thumb.
  for (const [name, w, h] of VIEWPORTS) {
    const l = computeLayout(w, h, 6, safeRect(w, h, FLAT))
    assert.ok(l.rowH >= 28, `${name}: the station pitch is ${l.rowH.toFixed(1)}px with no insets`)
  }
})

test("the world behind the HUD is not letterboxed by the insets", () => {
  // The counterpart assertion. `scene/backdrop.ts` fills `0,0,L.w,L.h` and
  // `draw.ts` flashes over the same rect; those must keep reaching the glass,
  // which is the whole point of `viewport-fit=cover`. A change that solved the
  // notch by shrinking the canvas would pass every assertion above and be
  // wrong, so it is pinned here.
  for (const [, w, h] of VIEWPORTS) {
    const notched = computeLayout(w, h, 6, safeRect(w, h, NOTCH))
    assert.equal(notched.w, w, "the layout narrowed the world")
    assert.equal(notched.h, h, "the layout shortened the world")
  }
})

test("the header moves for the notch and the corners, and only the header", () => {
  // Portrait: the station column keeps the full width it always had, because
  // its top is nowhere near the host's band. Only the header narrows. Reserving
  // a top strip instead would have come straight out of the station rows, which
  // are already down to 36px on a 320px phone.
  const flat = computeLayout(320, 568, 6, safeRect(320, 568, FLAT))
  const notched = computeLayout(320, 568, 6, safeRect(320, 568, NOTCH))

  assert.ok(flat.header.x > 54, "the header did not clear the exit control")
  assert.ok(flat.header.x + flat.header.w < 320 - 54, "the header did not clear the help control")
  assert.ok(flat.chain.w > flat.header.w, "the station column narrowed along with the header")
  assert.equal(flat.chain.x, 11, "the station column moved when it did not need to")

  assert.ok(notched.header.y > flat.header.y, "the header ignored the notch")
  assert.ok(notched.rowH < flat.rowH, "the rows did not give up the height the notch took")
})
