// THE STYLESHEET, EVALUATED.
//
// `layout.test.ts` proves `hudFrame` and `muteRect` clear the notch and the
// host's two corners. That is a proof about a MODEL. The screen is laid out by
// `style.css`, and the question this file exists to answer is whether the two
// are the same thing — because in three sibling packs they were not, and the
// suite was green the whole time.
//
// A pack runs in an iframe sandboxed `allow-scripts` with no
// `allow-same-origin`. `env(safe-area-inset-*)` belongs to the TOP-LEVEL
// browsing context, so a cross-origin child resolves all four to ZERO. SIEGE,
// STACK and POLARITY each read `env()` directly from their stylesheets and each
// shipped a HUD under the Android status bar while their own tests passed.
//
// CLAIM was built the other way round from the start: `layout.ts` owns the
// numbers, `Hud.layout` and `Claim.layout` publish them as custom properties,
// and the `env()`s in `style.css` sit behind those properties as fallbacks for a
// dev browser tab. This file is the evidence for that claim rather than a
// description of it: it parses the shipped stylesheet, runs the cascade, and
// evaluates every offset to a NUMBER with env() defined as zero.
//
// Nothing in this file changed the game. If it ever goes red, the game changed.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  HOST_CONTROL,
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../packs/shared/game-chrome/index.ts"
import {
  SHAPES,
  customPropsOf,
  lengthOf,
  paddingOf,
  parseCss,
  type Viewport,
} from "../../../packs/shared/game-chrome/cssSafeArea.ts"
import { hudFrame, muteRect } from "../src/game/layout.ts"

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")

const CSS = read("../src/style.css")
const RULES = parseCss(CSS)

/**
 * Exactly what the running game publishes, in the same order it publishes it.
 *
 * `Hud.layout` writes the seven HUD properties from `hudFrame`; `Claim.layout`
 * writes the three mute properties from `muteRect`. Both are called with the
 * FRAME's size — `.cl-root` is 100%×100% — and with `safeInsets()`.
 */
function published(w: number, h: number, insets: Insets, vp: Viewport): Map<string, string> {
  const vars = customPropsOf(RULES, ".cl-root", vp)
  const f = hudFrame(w, h, insets)
  vars.set("--cl-pt", `${f.padTop}px`)
  vars.set("--cl-pl", `${f.padLeft}px`)
  vars.set("--cl-pr", `${f.padRight}px`)
  vars.set("--cl-gl", `${f.gutterLeft}px`)
  vars.set("--cl-gr", `${f.gutterRight}px`)
  vars.set("--cl-toph", `${f.topMinH}px`)
  vars.set("--cl-cluster", `${f.clusterW}px`)
  const m = muteRect(w, h, insets)
  vars.set("--cl-mute-r", `${w - (m.x + m.w)}px`)
  vars.set("--cl-mute-b", `${h - (m.y + m.h)}px`)
  vars.set("--cl-mute-s", `${m.w}px`)
  // …and the raw insets, for the cards, which centre in the whole frame.
  for (const side of ["top", "right", "bottom", "left"] as const) {
    vars.set(`--cl-safe-${side}`, `${insets[side]}px`)
  }
  return vars
}

const css = (selector: string, prop: string, s: (typeof SHAPES)[number], pct = 0): number =>
  lengthOf(
    RULES,
    selector,
    prop,
    { w: s.w, h: s.h },
    published(s.w, s.h, s.insets, { w: s.w, h: s.h }),
    pct,
  )

const pad = (
  selector: string,
  s: (typeof SHAPES)[number],
): Record<"top" | "right" | "bottom" | "left", number> =>
  paddingOf(
    RULES,
    selector,
    { w: s.w, h: s.h },
    published(s.w, s.h, s.insets, { w: s.w, h: s.h }),
  )

const close = (got: number, want: number, msg: string): void => {
  assert.ok(Math.abs(got - want) < 1e-9, `${msg}: the stylesheet says ${got}, layout.ts says ${want}`)
}

const inside = (r: Rect, safe: Rect, where: string, what: string): void => {
  assert.ok(r.x >= safe.x - 1e-9, `${where}: ${what} crosses the LEFT inset (${r.x} < ${safe.x})`)
  assert.ok(
    r.x + r.w <= safe.x + safe.w + 1e-9,
    `${where}: ${what} crosses the RIGHT inset (${r.x + r.w} > ${safe.x + safe.w})`,
  )
  assert.ok(r.y >= safe.y - 1e-9, `${where}: ${what} crosses the TOP inset (${r.y} < ${safe.y})`)
  assert.ok(
    r.y + r.h <= safe.y + safe.h + 1e-9,
    `${where}: ${what} crosses the BOTTOM inset (${r.y + r.h} > ${safe.y + safe.h})`,
  )
}

// ---------------------------------------------------------------------------
// The two dialects say the same thing
// ---------------------------------------------------------------------------

test("the HUD's padding is the padding hudFrame was tested against", () => {
  for (const s of SHAPES) {
    const f = hudFrame(s.w, s.h, s.insets)
    const p = pad(".cl-hud", s)
    close(p.top, f.padTop, `${s.name}: the HUD's top padding`)
    close(p.left, f.padLeft, `${s.name}: the HUD's left padding`)
    close(p.right, f.padRight, `${s.name}: the HUD's right padding`)
  }
})

test("the top row's gutters and height are the ones that walk the clusters past the host", () => {
  for (const s of SHAPES) {
    const f = hudFrame(s.w, s.h, s.insets)
    close(css(".cl-top", "padding-left", s), f.gutterLeft, `${s.name}: the left gutter`)
    close(css(".cl-top", "padding-right", s), f.gutterRight, `${s.name}: the right gutter`)
    close(css(".cl-top", "min-height", s), f.topMinH, `${s.name}: the top row's height`)
  }
})

test("the mute button is where muteRect puts it, at the size muteRect gives it", () => {
  for (const s of SHAPES) {
    const m = muteRect(s.w, s.h, s.insets)
    close(s.w - css(".cl-mute", "right", s) - m.w, m.x, `${s.name}: the mute button's left edge`)
    close(s.h - css(".cl-mute", "bottom", s) - m.h, m.y, `${s.name}: the mute button's top edge`)
    close(css(".cl-mute", "width", s), m.w, `${s.name}: the mute button's width`)
    close(css(".cl-mute", "height", s), m.h, `${s.name}: the mute button's height`)
  }
})

// ---------------------------------------------------------------------------
// …and what the CSS produces is inside the safe rectangle
// ---------------------------------------------------------------------------

test("every HUD surface the stylesheet places is inside the safe area", () => {
  for (const s of SHAPES) {
    const safe = safeRect(s.w, s.h, s.insets)
    const f = hudFrame(s.w, s.h, s.insets)
    const p = pad(".cl-hud", s)
    const gl = css(".cl-top", "padding-left", s)
    const gr = css(".cl-top", "padding-right", s)
    const toph = css(".cl-top", "min-height", s)

    // The level counter and the score/lives cluster, at the two ends of the top
    // row, built from the CSS numbers rather than from the model.
    const rowX = p.left + gl
    const rowW = s.w - p.left - p.right - gl - gr
    const cluster = css(".cl-lvl", "max-width", s, rowW)
    const left: Rect = { x: rowX, y: p.top, w: cluster, h: toph }
    const right: Rect = { x: rowX + rowW - cluster, y: p.top, w: cluster, h: toph }
    // The fraction bar spans the full inner width and is the pedagogy itself.
    const meter: Rect = {
      x: p.left,
      y: p.top + toph + 7,
      w: s.w - p.left - p.right,
      h: css(".cl-meter", "height", s),
    }
    const mute: Rect = {
      x: s.w - css(".cl-mute", "right", s) - HOST_CONTROL,
      y: s.h - css(".cl-mute", "bottom", s) - HOST_CONTROL,
      w: HOST_CONTROL,
      h: HOST_CONTROL,
    }

    for (const [what, box] of [
      ["the level counter", left],
      ["the score and lives", right],
      ["the fraction bar", meter],
      ["the mute button", mute],
    ] as const) {
      inside(box, safe, s.name, what)
      assert.equal(
        hitsHostChrome(box, s.w, s.insets),
        false,
        `${s.name}: ${what} is under the host's exit or how-to-play control`,
      )
    }
    // And the model agrees about the bar, which is the one that cannot dodge.
    close(meter.y, f.meter.y, `${s.name}: the fraction bar's top edge`)
  }
})

test("the safe area never clips the card that the frame was not already clipping", () => {
  // The level card and the game-over card are full-bleed and CENTRED, so their
  // flat 20px padding is not what keeps them off the notch — the centring is.
  // The card's height is modelled here from the stylesheet's own type scale, at
  // its tallest content: the big goal fraction over a percentage over a score.
  //
  // What this proves: wherever that stack fits inside the card's own padding
  // box, it also fits inside the SAFE rectangle. The bottom inset on the
  // founder's phone is 48px against a 20px padding, so if the card ever grew
  // into it this would say so.
  //
  // What it does NOT prove, and is deliberately out of this change's scope: on a
  // landscape phone the fraction's `clamp(64px, 21vw, 190px)` makes a 179px
  // numeral and the stack overflows the 393px FRAME on its own, insets or no
  // insets. That is a type-scale defect, it predates this file, and fixing it
  // means changing how the game looks.
  for (const s of SHAPES) {
    const vp = { w: s.w, h: s.h }
    const vars = published(s.w, s.h, s.insets, vp)
    const px = (sel: string, prop: string): number => lengthOf(RULES, sel, prop, vp, vars)
    const gap = px(".cl-card", "gap")
    const frac = px(".cl-card .cl-bigfrac", "font-size")
    const rule = px(".cl-card .cl-bigfrac i", "height") + 2 * 10
    // Two stacks: the level card (fraction over prompt) and the game-over card
    // (score over percentage over a line of type). The taller one is the test.
    const level = 2 * frac * 0.82 + rule + gap + px(".cl-card p", "font-size") * 1.2
    const over =
      px(".cl-card h1", "font-size") * 0.86 +
      gap +
      px(".cl-card h2", "font-size") * 1.2 +
      gap +
      px(".cl-card p", "font-size") * 1.2
    const contentH = Math.max(level, over)

    // Vertical only, and on purpose. The card centres its children on BOTH
    // axes, so a stack's horizontal extent is whatever its digits happen to
    // measure and is symmetric about the frame's centre line — not something
    // this stylesheet fixes and not something a parser can know. The things in
    // this game that are pinned to a side edge, and can therefore be proven
    // horizontally, are the level counter, the score, the fraction bar and the
    // mute button, and every one of them is asserted above.
    const p = pad(".cl-card", s)
    const top = s.h / 2 - contentH / 2
    const bottom = s.h / 2 + contentH / 2
    if (top < p.top - 1e-9 || bottom > s.h - p.bottom + 1e-9) continue
    const safe = safeRect(s.w, s.h, s.insets)
    assert.ok(
      top >= safe.y - 1e-9,
      `${s.name}: the card's tallest content starts at ${top.toFixed(1)}, above a safe top of ${safe.y}`,
    )
    assert.ok(
      bottom <= safe.y + safe.h + 1e-9,
      `${s.name}: the card's tallest content ends at ${bottom.toFixed(1)}, below a safe bottom of ${
        safe.y + safe.h
      }`,
    )
  }
})

// ---------------------------------------------------------------------------
// The seam
// ---------------------------------------------------------------------------

test("no rule takes its answer from env() — it is zero where this game runs", () => {
  // The rule this pack already followed, now enforced: an `env(safe-area-inset-*)`
  // may only appear as the FALLBACK of a `--cl-*` custom property. Read directly
  // it is the number zero inside a pack frame, whatever the device.
  const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, "")
  const found = [...stripped.matchAll(/env\(safe-area-inset-(top|right|bottom|left)/g)]
  assert.ok(found.length > 0, "the dev-harness fallbacks are gone entirely")
  for (const m of found) {
    const before = stripped.slice(0, m.index)
    const open = before.lastIndexOf("var(--cl-")
    const close = before.lastIndexOf(")")
    assert.ok(
      open > close,
      `env(safe-area-inset-${m[1]}) at ${m.index} is read directly, not as the fallback of a ` +
        `--cl-* property — inside a pack frame that is the number zero`,
    )
  }
})

test("no surface uses a `padding:` shorthand that a breakpoint could reset", () => {
  // A shorthand resets all four longhands. `.cl-hud` may keep one because every
  // one of its four sides is a published property; the card's is built from the
  // raw insets and would lose three of them the first time a media query wanted
  // a tighter gutter.
  for (const rule of RULES) {
    if (!rule.selectors.includes(".cl-card")) continue
    assert.ok(
      !rule.decls.some((d) => d.prop === "padding"),
      "the card uses a `padding:` shorthand — a breakpoint can now erase its safe area",
    )
  }
})

test("every published property is written unconditionally, zeros included", () => {
  // The other half of the seam. `var(--cl-pt, …)` falls back to its `env()` only
  // when the property is ABSENT, so a publisher that skipped a zero would put
  // the game straight back on the env() path — indistinguishable from correct
  // until a child picks up a notched phone.
  const none: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
  const vars = published(393, 851, none, { w: 393, h: 851 })
  for (const name of [
    "--cl-pt",
    "--cl-pl",
    "--cl-pr",
    "--cl-gl",
    "--cl-gr",
    "--cl-toph",
    "--cl-cluster",
    "--cl-mute-r",
    "--cl-mute-b",
    "--cl-mute-s",
    "--cl-safe-top",
    "--cl-safe-right",
    "--cl-safe-bottom",
    "--cl-safe-left",
  ]) {
    const v = vars.get(name)
    assert.ok(v !== undefined, `${name} is not published at all on a device with no insets`)
    assert.match(v as string, /^-?\d+(\.\d+)?px$/, `${name} was published as "${v ?? ""}"`)
  }
})

test("the game publishes the frame at mount and again whenever the insets move", () => {
  // A wiring check, and only that: none of the arithmetic above can see whether
  // anything ever calls the publishers.
  const hud = read("../src/game/hud.ts")
  assert.ok(hud.includes('s.setProperty("--cl-pt"'), "the HUD never publishes its padding")
  const index = read("../src/game/index.ts")
  const at = index.indexOf("private layout()")
  assert.ok(at > 0, "layout() is gone")
  const body = index.slice(at, index.indexOf("\n  }", at))
  assert.ok(body.includes("safeInsets()"), "layout() never reads the safe area")
  assert.ok(body.includes("this.hud.layout("), "layout() never republishes the HUD's frame")
  assert.ok(body.includes("muteRect("), "layout() never republishes the mute button")
  assert.ok(
    body.includes('publishSafeVars(this.root, "--cl-safe-", insets)'),
    "layout() never publishes the raw insets — the cards fall back to an env() of zero",
  )
  assert.ok(index.includes("this.layout()"), "the frame is never published at all")
  assert.ok(
    index.includes("onInsetsChange(() => this.layout())"),
    "nothing listens for the insets changing — the HUD keeps the shape the pack opened in",
  )
  assert.ok(index.includes("this.stopInsets()"), "the inset listener outlives the pack")
})
