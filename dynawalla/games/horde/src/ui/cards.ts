/**
 * How big a level-up card is, and how big its lettering is. In numbers.
 *
 * ── The bug this file exists to end ─────────────────────────────────────────
 *
 * On a phone the three upgrade rows were cut through the middle of their
 * letters. `PULL`, `QUICKENING` and `SPLINTER` showed the top half of their
 * capitals and nothing else; the bottom of every glyph was sliced off by the
 * row's own lower edge, and what was left of each label was overlapped by the
 * row beneath it.
 *
 * The row was **twenty pixels tall and held ninety-five pixels of text**.
 * Measured in Chromium at 360×780 — the founder's 1080×2340 at its CSS size —
 * every card reported `height: 20, scrollHeight: 95`. Twenty is exactly
 * `border 1 + padding 9 + padding 9 + border 1`: the card had NO content height
 * at all.
 *
 * The cause is two ordinary lines of CSS that are only wrong together:
 *
 *     .hz-card  { flex: 1 1 0; overflow: hidden; }
 *     @media (max-aspect-ratio: 4/5) { .hz-cards { flex-direction: column; } }
 *
 * `flex: 1 1 0` sets the flex BASE SIZE to zero on the main axis. In landscape
 * the main axis is horizontal and that is exactly right — four cards, four
 * equal columns. Rotate to portrait and the same declaration means a base
 * HEIGHT of zero, to be grown out of the container's free space. There is no
 * free space: `.hz-cards` is itself a flex item of a `justify-content: center`
 * column, so its height is its CONTENT height, and its content is three cards
 * that just asked to be zero tall. Normally an item's automatic minimum size
 * would push back — but `overflow: hidden` sets that minimum to zero too, and
 * the same declaration then clips the text that fell out. Nothing in the
 * cascade was left to notice.
 *
 * ── What replaces it ────────────────────────────────────────────────────────
 *
 * The row's height is its text's height, and the text's height is cut to the
 * screen. One derives from the other, in that order:
 *
 *   1. `metrics()` is handed the frame, the safe insets and how many cards are
 *      being dealt. It works out the band the overlay may occupy — under the
 *      host's back chevron and how-to-play square, above the home indicator —
 *      and how tall the cards want to be at their design sizes.
 *   2. If they want more than there is, every font on the card is scaled by
 *      one factor until they fit. Nothing is ever clipped, and nothing is ever
 *      pushed off the bottom of the frame.
 *   3. `applyCardVars` writes the result onto the root as custom properties.
 *      `style.css` reads them through `var()` and sizes NOTHING on its own.
 *
 * Every line box is given an explicit `line-height`, so a card's height is a
 * number this file can compute rather than a property of whichever system font
 * the device happens to have — SF Pro Rounded on an iPad, Roboto on the
 * founder's Pixel. `LINE` is the reserve per em and it is larger than the
 * ascender-plus-descender of both.
 *
 * `cards.test.ts` parses `style.css` and fails if any of those rules stops
 * reading the variables, because a stylesheet that quietly keeps its own
 * `clamp()` would make every assertion in that file a fiction.
 */

import { CHROME_TOP } from "./layout.ts"
import { NO_INSETS, safeInsets, type Insets } from "../../../../packs/shared/game-chrome/index.ts"

/**
 * The line box every card label gets, per em, written into the stylesheet.
 *
 * Ascender-to-descender is 1.25 em in SF Pro Rounded and 1.17 em in Roboto, so
 * a 1.3 em box holds the whole glyph on both with room to spare. It is stated
 * rather than left at `normal` so that a card's height is arithmetic and not a
 * font's opinion.
 */
export const LINE = 1.3

/**
 * How tall the GLYPHS are, per em, independent of any line box we choose.
 *
 * This is the font's own content area — ascender, descender and line gap — and
 * it is the number a clipping test has to be about, because a line box narrower
 * than this does not shrink the letters, it just stops reserving room for them.
 * Measured in Chromium with the stylesheet's own family list: 1.332 em with SF
 * Pro Rounded, which is the tallest of the faces the stack can resolve to
 * (Roboto is 1.172). 1.34 is that, rounded up.
 *
 * `LINE` is deliberately just under it — a line box of 1.3 em with a 1.34 em
 * glyph puts 0.02 em past each edge of the box, and the card's padding is what
 * holds that. `cards.test.ts` asserts exactly this and would fail if `LINE`
 * were cut without the padding growing.
 */
export const INK = 1.34

/**
 * The big number's own line box. Tighter than `LINE` because a lone numeral
 * has no descender to speak of and the design wants it to sit close; the card
 * still RESERVES `LINE` for it, so the extra quarter-em is margin, not overflow.
 */
export const HEAD_LINE = 1.15

/**
 * What the card RESERVES for the big number's row, per em of it.
 *
 * The row is a baseline-aligned flex line holding a 900-weight numeral and a
 * small caption, and Chromium measures it at 1.332 em however tight the
 * `line-height` on it is. The reserve is stated as a `min-height` in the
 * stylesheet so the row is exactly this tall and not "whatever the font did",
 * which is the only way `metrics()` can be arithmetic about it.
 */
export const HEAD_ROW = 1.4

/** The modal's own margin from the frame, where nothing else claims the space. */
export const EDGE = 12

/**
 * Width of one character, in em, per kind of label.
 *
 * Measured in Chromium against the real stylesheet, at the real weights and
 * tracking, with the strings the game actually deals:
 *
 *     .hz-card-title   SPLINTER 0.850   QUICKENING 0.811   SEALED CACHE 0.800
 *     .hz-card-tag     +25% ALL DAMAGE 0.808   −2 DAMAGE TAKEN 0.792
 *     .hz-card-math    24 × 12 = 288 → … 0.568   a ring that shoves … 0.522
 *     .hz-seal-note    OPEN IT, OR IGNORE IT 0.761
 *     .hz-seal-prompt  144 ÷ 12 0.599
 *     .hz-orb          1000 0.807 at 24px, and 1.000 at 8px
 *
 * The numbers here are those rounded UP, because they are used to decide how
 * many lines a label takes and a low guess would under-budget the card. A face
 * wider than SF Pro Rounded costs a line of slack, never a clipped glyph.
 *
 * The answers are the reason two of these figures are quoted: a digit's advance
 * is rounded to whole pixels, so four tabular digits are 0.81 em each at 24px
 * and a full 1.0 em each at 8px. Budgeting the large-size figure put `1000`
 * 9px wider than its own button on the narrowest card the game deals — caught
 * in Chromium, not by the model, which is why `CHAR_EM.orb` is the small-size
 * number with a margin on top.
 */
export const CHAR_EM = {
  title: 0.90,
  tag: 0.90,
  math: 0.62,
  note: 0.85,
  prompt: 0.68,
  orb: 1.05,
} as const

/**
 * The longest string each label can be handed.
 *
 * `loadout.test.ts` deals thousands of real cards and fails if any of them is
 * longer than these, so they are a measurement of the game and not a hope.
 * The prompt comes from the HOST, whose questions this pack does not write;
 * 16 covers every shape the reference generator produces, `(−123) + (−45)`
 * included, and a longer one costs a second line rather than a clipped one.
 */
export const CHARS = {
  title: 12,
  tag: 16,
  math: 56,
  note: 21,
  prompt: 16,
  orb: 4,
} as const

/** Below this the lettering is too small for a child, however well it fits. */
export const MIN_FONT = 9

/**
 * The floor for a sealed-cache ANSWER, which is a numeral in a button.
 *
 * Lower than `MIN_FONT` because three of them share the width of one card and
 * the width is what has to give: four cards across a phone held sideways leave
 * about 33px per answer, and `1000` at 9px does not fit inside that. A digit is
 * legible smaller than a word is, and a clipped digit is not legible at all.
 */
export const ORB_MIN_FONT = 8

type Clamp = readonly [min: number, vw: number, max: number]

/** The design sizes, as the stylesheet used to state them. `vw` is per cent. */
const F = {
  title: [13, 2.6, 20] as Clamp,
  tag: [10, 2.0, 13] as Clamp,
  head: [26, 6.0, 46] as Clamp,
  sub: [8, 1.7, 11] as Clamp,
  math: [10, 1.9, 13] as Clamp,
  seal: [20, 5.0, 38] as Clamp,
  orb: [15, 3.4, 24] as Clamp,
  note: [8, 1.7, 11] as Clamp,
  heading: [13, 3.4, 19] as Clamp,
}

const BOX = {
  headingGap: [8, 2.0, 18] as Clamp,
  gap: [7, 1.6, 16] as Clamp,
  pad: [9, 1.8, 20] as Clamp,
  padX: [8, 1.6, 18] as Clamp,
  inner: [3, 0.8, 8] as Clamp,
  orbPad: [7, 1.6, 13] as Clamp,
}

const BORDER = 1
/** `.hz-card-title` and its siblings are indented off the card's hue rail. */
const RAIL = 8
/** The gap and side padding of one sealed-cache answer, from `style.css`. */
const ORB_GAP = 6
const ORB_PAD_X = 2

const clamp = (c: Clamp, w: number): number =>
  Math.min(c[2], Math.max(c[0], (c[1] * w) / 100))

export type CardMetrics = {
  /** Portrait: one card per row. Mirrors `@media (max-aspect-ratio: 4/5)`. */
  column: boolean
  /** The single factor every font on the card is multiplied by. 1 when it fits. */
  scale: number
  title: number
  tag: number
  head: number
  sub: number
  math: number
  seal: number
  orb: number
  note: number
  heading: number
  headingGap: number
  gap: number
  pad: number
  padX: number
  inner: number
  orbPad: number
  /** The width one sealed-cache answer needs. Below it they wrap, on purpose. */
  orbMin: number
  /** How many rows the three answers take at this size. */
  orbRows: number
  /** The four line boxes of an ordinary card, top to bottom. */
  parts: number[]
  /** The four line boxes of the sealed cache, top to bottom. */
  sealParts: number[]
  /** An ordinary upgrade card, border box. */
  rowH: number
  /** The sealed cache, border box. Taller: a prompt and a row of answers. */
  sealH: number
  /** One card's width, border box. */
  cardW: number
  /** Room for the title on one line, inside the padding and off the rail. */
  textW: number
  /** Heading plus every card plus the gaps between them. */
  total: number
  /** What `total` may not exceed. */
  avail: number
  /** Top of the band the overlay may use: under the host's two squares. */
  top: number
}

/**
 * The band between the host's chrome and the bottom of the frame.
 *
 * The host does not reserve a strip for its back chevron and its how-to-play
 * button — it floats them over the game — so an overlay that centres itself in
 * the whole frame puts a tappable card under both. `CHROME_TOP` is where they
 * end; it is the host's own published geometry, not a number typed here.
 */
export function band(h: number, insets: Insets): { top: number; avail: number } {
  const top = Math.max(EDGE, insets.top + CHROME_TOP)
  const bottom = h - Math.max(EDGE, insets.bottom)
  return { top, avail: Math.max(0, bottom - top) }
}

/**
 * @param n how many cards are dealt, the sealed cache included
 * @param sealed whether the last of them is the sealed cache
 */
export function metrics(
  w: number,
  h: number,
  insets: Insets = NO_INSETS,
  n = 3,
  sealed = false,
): CardMetrics {
  const column = w / h <= 0.8
  const { top, avail } = band(h, insets)

  const gap = clamp(BOX.gap, w)
  const pad = clamp(BOX.pad, w)
  const padX = clamp(BOX.padX, w)
  const inner = clamp(BOX.inner, w)
  const orbPad = clamp(BOX.orbPad, w)
  const headingGap = clamp(BOX.headingGap, w)

  const cardW = column
    ? Math.min(520, w * 0.96)
    : (Math.min(1080, w * 0.96) - (n - 1) * gap) / Math.max(1, n)
  const textW = Math.max(1, cardW - 2 * padX - 2 * BORDER - RAIL)

  const ordinaryFixed = 3 * inner + 2 * pad + 2 * BORDER
  const sealedFixed = ordinaryFixed
  const ordinaries = sealed ? n - 1 : n

  // The title is cut to the card's WIDTH as well: it is the one label that may
  // not wrap, because a headline broken across two lines reads as two upgrades.
  // A cap, not a scale — a narrow card shortens its headline, it does not shrink
  // its big number too.
  const titleCap = Math.max(MIN_FONT, textW / (CHARS.title * CHAR_EM.title))

  /**
   * The width one answer needs, and how many rows the three of them take.
   *
   * They are buttons with a widest-case number in them, so the width is what it
   * is; what gives is the number of rows, and the rows are budgeted. Three
   * across a card four-across in landscape do not fit at any size a child can
   * read, and a fourth answer half off the side of its own button is the same
   * defect as a clipped headline.
   */
  const orbMin = (font: number) =>
    Math.ceil(CHARS.orb * CHAR_EM.orb * font) + 2 * ORB_PAD_X + 2 * BORDER
  const orbRows = (font: number) => {
    const room = textW + RAIL + ORB_GAP
    const perRow = Math.max(1, Math.min(3, Math.floor(room / (orbMin(font) + ORB_GAP))))
    return Math.ceil(3 / perRow)
  }

  /** How many lines a label of this size takes in a card this wide. */
  const lines = (font: number, chars: number, em: number, width = textW): number =>
    Math.max(1, Math.ceil((chars * em * font) / width))

  /** Every font on the card at scale `s`, floored where a child stops reading. */
  const sizesAt = (s: number) => {
    const one = (c: Clamp) => {
      const floor = Math.min(c[0], MIN_FONT)
      return Math.max(floor, Math.floor(clamp(c, w) * s * 10) / 10)
    }
    return {
      title: Math.min(one(F.title), Math.floor(titleCap * 10) / 10),
      tag: one(F.tag),
      head: one(F.head),
      sub: one(F.sub),
      math: one(F.math),
      seal: one(F.seal),
      orb: one(F.orb),
      note: one(F.note),
      heading: one(F.heading),
    }
  }

  /**
   * The four line boxes of one card, top to bottom, at scale `s`.
   *
   * Only the title is held to a single line. The tag and the arithmetic wrap
   * as they please and are BUDGETED for it: a new-weapon card reads
   * `a ring that shoves the swarm off you → 1 × 14 = 14`, which is three lines
   * on a card four-across in landscape, and a card that budgeted one would put
   * two of them through its own lower border.
   */
  const partsAt = (s: number) => {
    const z = sizesAt(s)
    const ordinary = [
      z.title * LINE,
      z.tag * LINE * lines(z.tag, CHARS.tag, CHAR_EM.tag),
      Math.max(z.head * HEAD_ROW, z.sub * LINE),
      z.math * LINE * lines(z.math, CHARS.math, CHAR_EM.math),
    ]
    const cache = [
      z.title * LINE,
      z.seal * LINE * lines(z.seal, CHARS.prompt, CHAR_EM.prompt, textW + RAIL),
      // The answers: buttons, with their own padding and border, on as many
      // rows as they need.
      orbRows(z.orb) * (z.orb * LINE + 2 * orbPad + 2 * BORDER) +
        (orbRows(z.orb) - 1) * ORB_GAP,
      z.note * LINE * lines(z.note, CHARS.note, CHAR_EM.note, textW + RAIL),
    ]
    return { z, ordinary, cache }
  }

  const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)

  const heightAt = (s: number) => {
    const { z, ordinary, cache } = partsAt(s)
    const row = sum(ordinary) + ordinaryFixed
    const seal = sum(cache) + sealedFixed
    const heading = LINE * z.heading + headingGap
    const stack = column
      ? ordinaries * row + (sealed ? seal : 0) + (n - 1) * gap
      : Math.max(row, sealed ? seal : 0)
    return { row, seal, total: stack + heading }
  }

  // Height is monotone in the scale and the floors make it a step function, so
  // it is bisected rather than inverted. Thirty halvings of [0,1] land inside a
  // billionth of the true root; the fonts are rounded to a tenth of a pixel
  // long before that matters.
  let scale = 1
  if (heightAt(1).total > avail) {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (heightAt(mid).total <= avail) lo = mid
      else hi = mid
      }
    scale = lo
  }

  const { z: m, ordinary: parts, cache: sealParts } = partsAt(scale)
  const { row: rowH, seal: sealH, total } = heightAt(scale)

  return {
    column, scale, ...m,
    headingGap, gap, pad, padX, inner, orbPad,
    orbMin: orbMin(m.orb), orbRows: orbRows(m.orb),
    parts, sealParts,
    rowH, sealH, cardW, textW, total, avail, top,
  }
}

/** The heights of the cards as they are stacked, top to bottom, in the band. */
export function rowBoxes(
  m: CardMetrics,
  n: number,
  sealed: boolean,
): Array<{ top: number; bottom: number; sealed: boolean }> {
  const block = m.total
  const start = m.top + Math.max(0, (m.avail - block) / 2) + LINE * m.heading + m.headingGap
  const out: Array<{ top: number; bottom: number; sealed: boolean }> = []
  let y = start
  for (let i = 0; i < n; i++) {
    const isSeal = sealed && i === n - 1
    const height = m.column ? (isSeal ? m.sealH : m.rowH) : Math.max(m.rowH, sealed ? m.sealH : 0)
    if (m.column) {
      out.push({ top: y, bottom: y + height, sealed: isSeal })
      y += height + m.gap
    } else {
      out.push({ top: start, bottom: start + height, sealed: isSeal })
    }
  }
  return out
}

/**
 * The line boxes inside one card, in frame coordinates, in painting order.
 *
 * This is what the clipping assertion is about: every one of these must lie
 * inside its card, because `overflow: hidden` will cut in half anything that
 * does not.
 */
export function labelBoxes(
  m: CardMetrics,
  row: { top: number; bottom: number; sealed: boolean },
): Array<{ name: string; font: number; top: number; bottom: number }> {
  const names = row.sealed
    ? (["title", "prompt", "orbs", "note"] as const)
    : (["title", "tag", "head", "math"] as const)
  const fonts = row.sealed
    ? [m.title, m.seal, m.orb, m.note]
    : [m.title, m.tag, Math.max(m.head, m.sub), m.math]
  const heights = row.sealed ? m.sealParts : m.parts
  const out: Array<{ name: string; font: number; top: number; bottom: number }> = []
  let y = row.top + BORDER + m.pad
  for (let i = 0; i < names.length; i++) {
    const height = heights[i] as number
    out.push({ name: names[i] as string, font: fonts[i] as number, top: y, bottom: y + height })
    y += height + m.inner
  }
  return out
}

/**
 * Hand the stylesheet the numbers above.
 *
 * Called every time the cards are dealt and again on a rotation, because the
 * band a phone has in portrait is not the band it has on its side.
 */
export function applyCardVars(
  root: HTMLElement,
  n: number,
  sealed: boolean,
  // The same fallback `Game.resize` uses: before the first layout a root
  // reports 0×0, and a panel measured against nothing comes out at the floor.
  w = Math.max(200, root.clientWidth || window.innerWidth),
  h = Math.max(200, root.clientHeight || window.innerHeight),
  insets: Insets = safeInsets(),
): CardMetrics {
  const m = metrics(w, h, insets, n, sealed)
  const px = (v: number) => `${v}px`
  root.style.setProperty("--hz-c-title", px(m.title))
  root.style.setProperty("--hz-c-tag", px(m.tag))
  root.style.setProperty("--hz-c-head", px(m.head))
  root.style.setProperty("--hz-c-sub", px(m.sub))
  root.style.setProperty("--hz-c-math", px(m.math))
  root.style.setProperty("--hz-c-seal", px(m.seal))
  root.style.setProperty("--hz-c-orb", px(m.orb))
  root.style.setProperty("--hz-c-note", px(m.note))
  root.style.setProperty("--hz-c-heading", px(m.heading))
  root.style.setProperty("--hz-c-heading-gap", px(m.headingGap))
  root.style.setProperty("--hz-c-gap", px(m.gap))
  root.style.setProperty("--hz-c-pad", px(m.pad))
  root.style.setProperty("--hz-c-padx", px(m.padX))
  root.style.setProperty("--hz-c-inner", px(m.inner))
  root.style.setProperty("--hz-c-orbpad", px(m.orbPad))
  root.style.setProperty("--hz-c-orbmin", px(m.orbMin))
  root.style.setProperty("--hz-c-line", String(LINE))
  root.style.setProperty("--hz-c-head-line", String(HEAD_LINE))
  root.style.setProperty("--hz-c-head-row", String(HEAD_ROW))
  return m
}
