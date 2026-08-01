// NO GLYPH IS CUT IN HALF.
//
// The founder, on an Android phone at 1080×2340: the LEVEL 2 panel is up and
// every upgrade row is sliced through the middle of its capitals. `PULL`,
// `QUICKENING` and `SPLINTER` show their top halves and nothing else, and what
// is left of each label is overlapped by the row beneath it.
//
// Measured in Chromium at that screen's CSS size, before the fix: every card
// reported `height: 20, scrollHeight: 95`. Twenty is one border, two paddings
// and NO content — `flex: 1 1 0` down a column axis with `overflow: hidden` to
// zero the minimum that would have pushed back. `cards.ts` has the full
// autopsy.
//
// This file is the guarantee. It works out where every line of text lands, in
// pixels, at every screen the game supports, and fails if any of them crosses
// the edge of the row it is in. It also parses `style.css`, because a metric
// the stylesheet has stopped reading is a metric about nothing — this repo has
// twice shipped a CSS change that never reached a screen behind an assertion
// that was really a substring search.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { hitsHostChrome, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { CARD_TITLES, LONGEST_TITLE } from "../game/loadout.ts"
import {
  CHARS, CHAR_EM, EDGE, HEAD_LINE, HEAD_ROW, INK, LINE, MIN_FONT, ORB_MIN_FONT,
  band, labelBoxes, metrics, rowBoxes,
} from "./cards.ts"
import { declared, parse, rulesFor, stripComments } from "./css.ts"

const CSS = readFileSync(fileURLToPath(new URL("../style.css", import.meta.url)), "utf8")
const RULES = parse(CSS)
const PORTRAIT = "@media (max-aspect-ratio: 4/5)"

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const NOTCH_PORTRAIT: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const NOTCH_LANDSCAPE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

/** Every screen this game claims to run on, and the founder's own phone. */
const VIEWPORTS: Array<[string, number, number]> = [
  ["the smallest phone we support", 320, 568],
  ["phone portrait", 390, 844],
  ["the founder's phone, 1080×2340 at its CSS size", 360, 780],
  ["tablet portrait", 768, 1024],
  ["that phone on its side", 780, 360],
  ["the smallest phone on its side", 568, 320],
  ["phone landscape", 844, 390],
  ["tablet landscape", 1024, 768],
]

/** Three upgrades, and the every-third-level panel with the sealed cache. */
const DEALS: Array<[number, boolean]> = [[3, false], [4, true]]

const each = (
  fn: (name: string, w: number, h: number, insets: Insets, n: number, sealed: boolean) => void,
) => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const insets of [NONE, w > h ? NOTCH_LANDSCAPE : NOTCH_PORTRAIT]) {
      for (const [n, sealed] of DEALS) fn(name, w, h, insets, n, sealed)
    }
  }
}

const where = (name: string, w: number, h: number, i: Insets, n: number, s: boolean) =>
  `${name} (${w}×${h}, insets ${i.top}/${i.bottom}, ${n} cards${s ? " with the cache" : ""})`

/* ------------------------------------------------------------ the clipping */

test("no line of text crosses the edge of the card it is in", () => {
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    for (const row of rowBoxes(m, n, sealed)) {
      for (const label of labelBoxes(m, row)) {
        // A line box is ascender to descender. Inside the padding, with the
        // padding itself as the margin the founder's rows did not have.
        assert.ok(
          label.top >= row.top + m.pad,
          `${where(name, w, h, insets, n, sealed)}: the ${label.name} starts at ` +
            `${label.top.toFixed(1)}, above its card's padded top ${(row.top + m.pad).toFixed(1)}`,
        )
        assert.ok(
          label.bottom <= row.bottom - m.pad + 0.01,
          `${where(name, w, h, insets, n, sealed)}: the ${label.name} runs to ` +
            `${label.bottom.toFixed(1)} and the card's padded bottom is ` +
            `${(row.bottom - m.pad).toFixed(1)} — ` +
            `${(label.bottom - (row.bottom - m.pad)).toFixed(1)}px of glyph is cut off`,
        )
      }
    }
  })
})

test("no glyph crosses the card's edge, and none touches the row below it", () => {
  // The one assertion in this file that is NOT about the model's own numbers:
  // a glyph is 1.34 em of ink whatever line box the metrics choose for it, and
  // half-leading centres it in that box. Cut the reserve and the letters do not
  // get smaller — they start overlapping each other and running out of the card.
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    for (const row of rowBoxes(m, n, sealed)) {
      const labels = labelBoxes(m, row)
      const ink = labels.map((l) => {
        const mid = (l.top + l.bottom) / 2
        return { ...l, inkTop: mid - (l.font * INK) / 2, inkBottom: mid + (l.font * INK) / 2 }
      })
      for (const l of ink) {
        assert.ok(
          l.inkTop >= row.top && l.inkBottom <= row.bottom,
          `${where(name, w, h, insets, n, sealed)}: the ${l.name}'s glyphs run ` +
            `${l.inkTop.toFixed(1)}–${l.inkBottom.toFixed(1)} and the card is ` +
            `${row.top.toFixed(1)}–${row.bottom.toFixed(1)} — \`overflow: hidden\` cuts the ` +
            `letters in half, which is what the founder photographed`,
        )
      }
      for (let i = 1; i < ink.length; i++) {
        const above = ink[i - 1] as { inkBottom: number; name: string }
        const below = ink[i] as { inkTop: number; name: string }
        assert.ok(
          below.inkTop >= above.inkBottom,
          `${where(name, w, h, insets, n, sealed)}: the ${above.name}'s descenders reach ` +
            `${above.inkBottom.toFixed(1)} and the ${below.name} starts at ` +
            `${below.inkTop.toFixed(1)} — they are written over each other`,
        )
      }
    }
  })
})

test("a card is taller than the text it holds, never the other way round", () => {
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    for (const [parts, kind, box] of [
      [m.parts, "an upgrade card", m.rowH],
      [m.sealParts, "the sealed cache", m.sealH],
    ] as const) {
      const content = parts.reduce((a, b) => a + b, 0) + 3 * m.inner
      assert.ok(
        box - content >= 2 * m.pad - 0.01,
        `${where(name, w, h, insets, n, sealed)}: ${kind} is ${box.toFixed(1)}px tall and ` +
          `holds ${content.toFixed(1)}px of text — the 95-in-20 bug, again`,
      )
    }
  })
})

test("the rows do not overlap each other", () => {
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    const rows = rowBoxes(m, n, sealed)
    if (!m.column) return // side by side: they share a top and a bottom by design
    for (let i = 1; i < rows.length; i++) {
      const above = rows[i - 1] as { bottom: number }
      const below = rows[i] as { top: number }
      assert.ok(
        below.top >= above.bottom + m.gap - 0.01,
        `${where(name, w, h, insets, n, sealed)}: row ${i} starts at ${below.top.toFixed(1)} ` +
          `and row ${i - 1} ends at ${above.bottom.toFixed(1)} — they are ` +
          `${(above.bottom - below.top).toFixed(1)}px into each other`,
      )
    }
  })
})

/* ------------------------------------------------------------- the framing */

test("the whole panel stays inside the frame", () => {
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    const rows = rowBoxes(m, n, sealed)
    const first = rows[0] as { top: number }
    const last = rows[rows.length - 1] as { bottom: number }
    const floor = h - Math.max(EDGE, insets.bottom)
    assert.ok(
      m.total <= m.avail + 0.01,
      `${where(name, w, h, insets, n, sealed)}: the panel wants ${m.total.toFixed(1)}px and ` +
        `the frame has ${m.avail.toFixed(1)}px for it`,
    )
    assert.ok(
      first.top >= m.top - 0.01,
      `${where(name, w, h, insets, n, sealed)}: the first card starts at ` +
        `${first.top.toFixed(1)}, above the band at ${m.top.toFixed(1)}`,
    )
    assert.ok(
      last.bottom <= floor + 0.01,
      `${where(name, w, h, insets, n, sealed)}: the last card ends at ` +
        `${last.bottom.toFixed(1)} and the frame ends at ${floor.toFixed(1)}`,
    )
  })
})

test("no card lands under the host's back chevron or its how-to-play button", () => {
  // The host floats both over the game rather than reserving a band for them,
  // so an overlay centred in the whole frame puts a card a child taps under a
  // control that is not the game's. The cards span the width; the block is one
  // rectangle for this purpose.
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    const rows = rowBoxes(m, n, sealed)
    const first = rows[0] as { top: number }
    const last = rows[rows.length - 1] as { bottom: number }
    const block = { x: insets.left, y: first.top, w: w - insets.left - insets.right, h: last.bottom - first.top }
    assert.equal(
      hitsHostChrome(block, w, insets),
      false,
      `${where(name, w, h, insets, n, sealed)}: the cards reach y=${first.top.toFixed(1)}, ` +
        `into a host control`,
    )
  })
})

/* ---------------------------------------------------------------- the text */

test("the longest headline the game can deal still fits on one line", () => {
  // Not the three in the screenshot: every title `loadout.ts` can produce.
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    for (const title of CARD_TITLES) {
      const width = title.length * CHAR_EM.title * m.title
      assert.ok(
        width <= m.textW + 0.01,
        `${where(name, w, h, insets, n, sealed)}: "${title}" is ${width.toFixed(1)}px wide at ` +
          `${m.title}px and the card gives it ${m.textW.toFixed(1)}px — it wraps, and a ` +
          `headline on two lines reads as two upgrades`,
      )
    }
  })
})

test("the lettering never falls below what a child can read", () => {
  each((name, w, h, insets, n, sealed) => {
    const m = metrics(w, h, insets, n, sealed)
    // 8px is the design's own smallest — the caption under the big number and
    // the sealed cache's footnote. Nothing else may go under MIN_FONT.
    for (const [what, size, floor] of [
      ["headline", m.title, MIN_FONT],
      ["offer", m.tag, MIN_FONT],
      ["big number", m.head, MIN_FONT],
      ["arithmetic", m.math, MIN_FONT],
      ["cache prompt", m.seal, MIN_FONT],
      // A digit in a button of its own is legible smaller than a word is,
      // and three of them share the width of one card. 8 is the design's
      // own smallest lettering.
      ["cache answer", m.orb, ORB_MIN_FONT],
      ["caption", m.sub, 8],
      ["footnote", m.note, 8],
      ["LEVEL n", m.heading, MIN_FONT],
    ] as const) {
      assert.ok(
        size >= floor,
        `${where(name, w, h, insets, n, sealed)}: the ${what} is ${size}px, under ${floor}px`,
      )
    }
  })
})

test("the panel only shrinks when it has to", () => {
  // A phone with room uses the design's own sizes. If this starts failing the
  // budget has quietly grown and every card got smaller for nothing.
  const roomy = metrics(390, 844, NOTCH_PORTRAIT, 4, true)
  assert.equal(roomy.scale, 1, `a 390×844 phone had to shrink the cards to ${roomy.scale}`)
  assert.equal(roomy.title, 13)
  assert.equal(roomy.head, 26)

  // And it does shrink where it must: the smallest phone we support, with a
  // notch, dealing four cards.
  const tight = metrics(320, 568, NOTCH_PORTRAIT, 4, true)
  assert.ok(tight.scale < 1, "320×568 with a notch and four cards did not need to shrink?")
  assert.ok(tight.total <= tight.avail, "…and did not fit even after shrinking")
})

test("the band the panel may use is the one the host leaves behind", () => {
  const b = band(844, NOTCH_PORTRAIT)
  // 47 of notch, then the host's hairline, margin and 44px control, then 6.
  assert.equal(b.top, 47 + 63)
  assert.equal(b.avail, 844 - 47 - 63 - 34)
  // With no insets at all the host's controls are still there.
  assert.equal(band(844, NONE).top, 63)
})

/* ------------------------------------------------------ the stylesheet ties */

test("the stylesheet reads every size from the metrics and computes none", () => {
  // Everything inside the level-up panel. `.hz-title` on its own belongs to
  // the rift as well and is deliberately sized by the design there.
  const cardRules = RULES.filter(
    (r) => /^\.hz-(card|seal|orb)/.test(r.selector) || r.selector === ".hz-picks .hz-title",
  )
  assert.ok(cardRules.length > 6, "the card rules vanished from style.css")
  for (const r of cardRules) {
    // The rarity chip is `position: absolute` — out of the flow, so it adds no
    // height to the card and is free to size itself. Everything IN the flow is
    // height, and height is this file's business.
    if (r.decls["position"] === "absolute") continue
    // `gap` is left out on purpose: on `.hz-card-head` and `.hz-seal-orbs` it
    // is the space BESIDE a thing, not under it. The two gaps that are height —
    // `.hz-cards` and `.hz-card` — are asserted by name below.
    for (const prop of ["font-size", "line-height", "padding", "min-height"]) {
      const v = r.decls[prop]
      if (v === undefined) continue
      if (/^0(px)?$/.test(v)) continue
      // `1em` inherits the row's own variable; it is not a size of its own.
      if (v === "1em" || v === "inherit") continue
      if (prop === "line-height" && /^[0-9.]+$/.test(v)) continue
      assert.match(
        v,
        /var\(--hz-c-/,
        `\`${r.selector} { ${prop}: ${v} }\` sizes itself. Every size on a card comes from ` +
          `cards.ts through a custom property, or the tests in this file are about a ` +
          `stylesheet nobody is using`,
      )
    }
  }
})

test("each label reads its own variable", () => {
  for (const [selector, prop, needle] of [
    [".hz-card-title", "font-size", "--hz-c-title"],
    [".hz-card-title", "line-height", "--hz-c-line"],
    [".hz-card-tag", "font-size", "--hz-c-tag"],
    [".hz-card-tag", "line-height", "--hz-c-line"],
    [".hz-card-math", "font-size", "--hz-c-math"],
    [".hz-card-math", "line-height", "--hz-c-line"],
    [".hz-card-head", "font-size", "--hz-c-head"],
    [".hz-card-head", "line-height", "--hz-c-head-line"],
    [".hz-card-head", "min-height", "--hz-c-head-row"],
    [".hz-card-head span", "font-size", "--hz-c-sub"],
    [".hz-seal-prompt", "font-size", "--hz-c-seal"],
    [".hz-orb", "font-size", "--hz-c-orb"],
    [".hz-picks .hz-title", "font-size", "--hz-c-heading"],
    [".hz-card", "padding", "--hz-c-pad"],
    [".hz-card", "gap", "--hz-c-inner"],
    [".hz-cards", "gap", "--hz-c-gap"],
  ] as const) {
    const v = declared(RULES, selector, prop)
    assert.ok(v !== undefined, `\`${selector}\` no longer declares ${prop}`)
    assert.ok(
      (v as string).includes(needle),
      `\`${selector} { ${prop}: ${v} }\` does not read ${needle}`,
    )
  }
})

test("a headline is one line because the stylesheet says so", () => {
  assert.equal(
    declared(RULES, ".hz-card-title", "white-space"),
    "nowrap",
    "the headline may wrap again — `metrics()` budgets it one line",
  )
})

test("a four-digit answer fits inside its own button", () => {
  // Caught in Chromium and not by the model: at 8px a tabular digit's advance
  // rounds up to a whole pixel, so `1000` was 32px wide inside a 22.8px button
  // — four digits lying across the button beside them. The answers wrap now,
  // and the rows they wrap onto are budgeted.
  each((name, w, h, insets, n, sealed) => {
    if (!sealed) return
    const m = metrics(w, h, insets, n, sealed)
    const row = m.textW + 8
    const perRow = Math.ceil(3 / m.orbRows)
    const button = Math.max(m.orbMin, (row - (perRow - 1) * 6) / perRow)
    const text = CHARS.orb * CHAR_EM.orb * m.orb
    assert.ok(
      text <= button - 2 * 2 - 2,
      `${where(name, w, h, insets, n, sealed)}: "1000" is ${text.toFixed(1)}px at ${m.orb}px ` +
        `and its button is ${button.toFixed(1)}px — the digits run onto the button beside it`,
    )
    assert.ok(
      perRow * m.orbMin + (perRow - 1) * 6 <= row + 0.01,
      `${where(name, w, h, insets, n, sealed)}: ${perRow} answers of ${m.orbMin}px do not ` +
        `fit across ${row.toFixed(1)}px, so they wrap onto a row the card did not budget`,
    )
  })
})

test("the answers wrap where the metrics say they wrap", () => {
  // Wrapping is fine — an unbudgeted row is not. `--hz-c-orbmin` is what makes
  // the browser break the row in the same place `metrics()` did.
  assert.equal(declared(RULES, ".hz-seal-orbs", "flex-wrap"), "wrap")
  assert.match(
    declared(RULES, ".hz-orb", "min-width") as string,
    /var\(--hz-c-orbmin/,
    "the answers wrap wherever the text happens to run out, not where the card budgeted",
  )
  // The model measures the button from these two, so they may not drift.
  assert.match(declared(RULES, ".hz-orb", "padding") as string, /\) 2px$/)
  assert.match(declared(RULES, ".hz-seal-orbs", "gap") as string, /^6px$/)
})

test("portrait cards take their height from their content, and that rule wins", () => {
  const portrait = RULES.filter((r) => r.selector === ".hz-card" && r.media === PORTRAIT)
  assert.equal(portrait.length, 1, "the portrait `.hz-card` override is gone")
  assert.equal(
    (portrait[0] as { decls: Record<string, string> }).decls["flex"],
    "0 0 auto",
    "portrait cards are back on a zero flex basis — the bug the founder photographed",
  )
  // A media query adds no specificity, so this is entirely a question of which
  // rule comes last in the file.
  const base = rulesFor(RULES, ".hz-card").filter((r) => r.media === "" && r.decls["flex"])
  assert.ok(base.length > 0, "`.hz-card` no longer sets `flex` at the top level")
  const lastBase = Math.max(...base.map((r) => r.index))
  assert.ok(
    (portrait[0] as { index: number }).index > lastBase,
    `the portrait override is at rule ${(portrait[0] as { index: number }).index} and the ` +
      `landscape \`flex: 1 1 0\` at ${lastBase} — the later one wins, so the override does ` +
      `nothing at all`,
  )
})

test("the card panel clears the host's controls before it centres anything", () => {
  const pad = declared(RULES, ".hz-picks", "padding-top")
  assert.ok(pad !== undefined, "`.hz-picks` no longer declares a top padding")
  assert.match(
    pad as string,
    /--hz-chrome-top/,
    "the panel is centred in the whole frame again, so its top card sits under the " +
      "host's back chevron",
  )
})

test("and the other three panels are NOT paid for that clearance", () => {
  // The rift, the title and the game-over screen are short and narrow and never
  // reached a corner. 63px of top padding on a phone held sideways pushed DIVE
  // AGAIN toward the bottom edge for nothing.
  const shared = declared(RULES, ".hz-modal", "padding")
  assert.ok(shared !== undefined, "`.hz-modal` no longer declares padding")
  assert.ok(
    !(shared as string).includes("--hz-chrome-top"),
    `every modal pays for the cards' clearance: .hz-modal { padding: ${shared} }`,
  )
  // And their heading keeps the design's size rather than the cards' computed
  // one — the rift has the whole frame and does not shrink with them.
  const title = declared(RULES, ".hz-title", "font-size")
  assert.ok(
    !(title as string).includes("--hz-c-"),
    `.hz-title { font-size: ${title} } — THE RIFT now shrinks with the upgrade cards`,
  )
})

test("the line height the stylesheet uses is the one the metrics assume", () => {
  // The whole model rests on a card's height being arithmetic rather than a
  // property of the device's font.
  assert.equal(LINE, 1.3)
  assert.equal(HEAD_LINE, 1.15)
  assert.equal(HEAD_ROW, 1.4)
  const head = declared(RULES, ".hz-card-head", "min-height")
  assert.equal(head, "calc(var(--hz-c-head, 26px) * var(--hz-c-head-row, 1.4))")
  // The fallbacks in the sheet are the same numbers, for a sheet loaded before
  // the root is mounted.
  assert.ok(stripComments(CSS).includes("var(--hz-c-line, 1.3)"))
})

/* --------------------------------------------------- the strings themselves */

test("the character widths are at or above what the browser actually renders", () => {
  // Measured in Chromium against this stylesheet, at the real weights and
  // tracking, with strings the game really deals — the widest per-character
  // figure found for each label. The budgets have to sit ON or ABOVE these, or
  // a label takes a line the card never reserved, and the reserve and the
  // measurement would both be coming from the same wrong number.
  //
  // The answers carry two figures because a tabular digit's advance is rounded
  // to a whole pixel: `1000` is 0.807 em per digit at 24px and a full 1.000 em
  // at 8px, which is where `1000` ended up 9px wider than its own button.
  const MEASURED = {
    title: 0.850, // SPLINTER at 13px
    tag: 0.808, // +25% ALL DAMAGE at 13px
    math: 0.568, // 24 × 12 = 288 → 26 × 12 = 312 at 13px
    note: 0.761, // OPEN IT, OR IGNORE IT at 11px
    prompt: 0.599, // 144 ÷ 12 at 38px
    orb: 1.000, // 1000 at 8px
  } as const
  for (const [label, em] of Object.entries(MEASURED)) {
    const budget = CHAR_EM[label as keyof typeof CHAR_EM]
    assert.ok(
      budget >= em,
      `CHAR_EM.${label} is ${budget} and Chromium renders ${em} em per character — the card ` +
        `budgets less room than the text takes`,
    )
  }
})

test("the character budgets cover every string the game can put on a card", () => {
  assert.equal(LONGEST_TITLE, CHARS.title, "a longer card title exists than cards.ts budgets")
  for (const t of CARD_TITLES) {
    assert.ok(t.length <= CHARS.title, `"${t}" is longer than the title budget`)
  }
  assert.equal(CHARS.note, "OPEN IT, OR IGNORE IT".length)
})
