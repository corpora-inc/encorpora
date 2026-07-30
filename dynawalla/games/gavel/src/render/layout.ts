// Where everything sits, as numbers, with no canvas in the file.
//
// Split out from the renderer for one reason: every claim this game makes about
// being legible and reachable on a phone is a claim about these numbers, and a
// claim in a children's product should be assertable at every viewport rather
// than eyeballed on one device. `test/layout.test.ts` runs the whole thing at
// 320×420 through iPad landscape and checks four things:
//
//   1. Nothing a child must read or touch overlaps the host's two 44px corners.
//      The exit chevron and the how-to-play control live in the HOST document,
//      above this pack's iframe, so no z-index can rescue a collision — a pack
//      lays out clear of them or it loses the pixels.
//   2. Every key is at least 44px on its short side, at every viewport. That is
//      the platform minimum and about the smallest square a seven-year-old hits
//      on a moving bus.
//   3. A tablet's prompt never prints below `MIN_NUMERAL_PX`. COLOSSUS's own
//      pacing entry closes on the legibility spiral and SERPENT prints numerals
//      at four to seven CSS pixels on a phone; the whole game is reading numbers.
//   4. Nothing critical is drawn outside the safe rectangle.
//
// The insets come from the HOST, through `game-chrome`. A pack cannot read
// `env(safe-area-inset-*)` — it is a cross-origin child and resolves all four to
// zero — and twenty of the twenty-seven shipped games drew their HUDs under the
// notch believing otherwise.

import { safeInsets, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { HOST_CONTROL, HOST_MARGIN, HOST_PROGRESS_H } from "../../../../packs/shared/game-chrome/index.ts"
import {
  DIGIT_ADVANCE_EM,
  MIN_NUMERAL_PX,
  MIN_TABLET_W,
  PROMPT_MAX_CHARS,
  TABLET_PAD,
} from "../game/ladder.ts"

export type Rect = { x: number; y: number; w: number; h: number }

export type KeyId =
  | "d0"
  | "d1"
  | "d2"
  | "d3"
  | "d4"
  | "d5"
  | "d6"
  | "d7"
  | "d8"
  | "d9"
  | "back"
  | "fold"
  | "gavel"

export type Key = { id: KeyId; rect: Rect; label: string; digit: number | null }

export type Layout = {
  readonly w: number
  readonly h: number
  readonly insets: Insets
  /** The strongbox plaque. Always clear of both host corners. */
  readonly coins: Rect
  /** The consignment strip: one pip per lot still owed. */
  readonly strip: Rect
  /** The block: the lot on it, and the broker's offer beside it. */
  readonly block: Rect
  readonly offer: Rect
  readonly gallery: Rect
  readonly tablets: readonly Rect[]
  readonly paddle: Rect
  readonly keys: readonly Key[]
  /** True when the plaque had to go below the host's corner band to clear it. */
  readonly plaqueBelowChrome: boolean
}

const PAD = 10
const GAP = 8

const MIN_COINS_H = 22
const MIN_STRIP_H = 10
const MIN_BLOCK_H = 44
const MIN_ROW_H = 42
const MIN_PADDLE_H = 46
export const MIN_KEY = 44

const MAX_COINS_H = 30
const MAX_BLOCK_H = 116
const MAX_ROW_H = 84
const MAX_PADDLE_H = 68
const MAX_KEY_H = 64

/** The narrowest gap between the host's corners a centred plaque will sit in. */
const PLAQUE_MIN_W = 120

/**
 * The widest the gallery, the block and the keypad are ever drawn.
 *
 * Without it, three tablets across a desktop are 455px billboards carrying `88 + 61`,
 * and the keypad is a metre of stone. A bazaar auction is a small room; the frame gets
 * wider, the room does not.
 */
const MAX_CONTENT_W = 780

/** Rows the keypad takes: two of five digits plus the controls, or one of ten. */
const KEY_ROWS_NARROW = 3
const KEY_ROWS_WIDE = 2

/** Width at which all ten digits fit across in one row at the 44px minimum. */
const WIDE_KEYPAD_W = 10 * MIN_KEY + 9 * GAP

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/**
 * The font size a prompt prints at inside a tablet of width `w`.
 *
 * Sized to the prompt that is actually there, so `12 + 5` is drawn large and
 * `5,001 − 2,798` is drawn small — but never smaller than `MIN_NUMERAL_PX`,
 * because below that a child is guessing for a reason that has nothing to do with
 * arithmetic. A prompt that cannot be drawn at the floor is refused upstream, by
 * `tabletValue`, and its whole rung is capped: see `Auction.capBelow`.
 */
export function promptPx(text: string, tabletW: number, tabletH: number): number {
  const chars = Math.max(1, text.trim().length)
  const byWidth = (tabletW - 2 * TABLET_PAD) / (chars * DIGIT_ADVANCE_EM)
  const byHeight = tabletH * 0.42
  return clamp(Math.floor(Math.min(byWidth, byHeight)), MIN_NUMERAL_PX, 30)
}

/** How many tablets fit across `w` before the gallery has to wrap. */
export function columnsFor(w: number, count: number): number {
  const fit = Math.floor((w + GAP) / (MIN_TABLET_W + GAP))
  return clamp(fit, 1, Math.max(1, count))
}

export function layout(
  w: number,
  h: number,
  tabletCount: number,
  insets: Insets = safeInsets(),
): Layout {
  const safe = safeRect(w, h, insets)
  const inner = Math.max(80, Math.min(safe.w - 2 * PAD, MAX_CONTENT_W))
  const x0 = safe.x + (safe.w - inner) / 2
  const top = safe.y + HOST_PROGRESS_H

  // **The band the host's two controls sit in is not reserved, it is used.** The first
  // version of `hostChrome.ts` reserved the whole 67px top strip and broke SKY LEDGER's
  // own layout invariants outright; taking a twelfth of a small screen to hold two
  // buttons is the wrong trade. So the strongbox plaque fills the band *between* the
  // two corners — the one thing in this game that is a single short line of large
  // numerals, which is exactly what fits there — and everything full-width starts
  // below it.
  //
  // When the corners are too close together for a plaque, which a phone in landscape
  // with side insets can be, it drops below the band at full width instead. Both
  // branches ship and `test/layout.test.ts` asserts both.
  const betweenCorners =
    w - 2 * Math.max(insets.left, insets.right) - 2 * (HOST_MARGIN + HOST_CONTROL) - 2 * GAP
  const plaqueBelowChrome = betweenCorners < PLAQUE_MIN_W
  const bandBottom = insets.top + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + HOST_MARGIN
  const coinsTop = plaqueBelowChrome ? bandBottom : top + HOST_MARGIN

  const count = Math.max(1, Math.floor(tabletCount))
  const cols = columnsFor(inner, count)
  const rows = Math.ceil(count / cols)

  // A wide frame puts the ten digits in one row instead of two, which is a whole 52px
  // of height back on a phone in landscape. It is not only a fit: `1 2 3 4 5 6 7 8 9 0`
  // in one line is the order a child counts in, and the two-row form only exists
  // because five keys is the most that fits across a 320px phone at 44px each.
  const keyCols = inner >= WIDE_KEYPAD_W ? 10 : 5
  const keyRows = keyCols === 10 ? KEY_ROWS_WIDE : KEY_ROWS_NARROW

  // Everything below the plaque, at its minimum. What is left over is spent in
  // fixed proportions, which is what keeps a tall iPad from drawing a phone layout
  // with a lake of empty stone under it.
  const coinsH0 = plaqueBelowChrome ? MIN_COINS_H : HOST_CONTROL
  const contentTop = plaqueBelowChrome ? bandBottom + coinsH0 + GAP : bandBottom
  const minBelow =
    MIN_STRIP_H +
    GAP +
    MIN_BLOCK_H +
    GAP +
    (rows * MIN_ROW_H + (rows - 1) * GAP) +
    GAP +
    MIN_PADDLE_H +
    GAP +
    (keyRows * MIN_KEY + (keyRows - 1) * GAP)
  const avail = Math.max(0, safe.y + safe.h - PAD - contentTop)
  const slack = Math.max(0, avail - minBelow)

  const coinsH = plaqueBelowChrome
    ? clamp(coinsH0 + slack * 0.02, MIN_COINS_H, MAX_COINS_H)
    : coinsH0
  const stripH = clamp(MIN_STRIP_H + slack * 0.03, MIN_STRIP_H, 18)
  const blockH = clamp(MIN_BLOCK_H + slack * 0.26, MIN_BLOCK_H, MAX_BLOCK_H)
  const rowH = clamp(MIN_ROW_H + (slack * 0.34) / rows, MIN_ROW_H, MAX_ROW_H)
  const paddleH = clamp(MIN_PADDLE_H + slack * 0.1, MIN_PADDLE_H, MAX_PADDLE_H)
  const keyH = clamp(MIN_KEY + (slack * 0.25) / keyRows, MIN_KEY, MAX_KEY_H)

  // A viewport too short for the minimums. The keys are the last thing to give —
  // a 44px target is the one number in this file that is not a preference — so the
  // squeeze comes out of the block and the gallery, and the game accepts drawing
  // slightly past the bottom inset before it accepts an unhittable button.
  const wanted =
    stripH +
    GAP +
    blockH +
    GAP +
    (rows * rowH + (rows - 1) * GAP) +
    GAP +
    paddleH +
    GAP +
    (keyRows * keyH + (keyRows - 1) * GAP)
  const over = Math.max(0, wanted - avail)
  const blockFinal = Math.max(MIN_BLOCK_H * 0.7, blockH - over * 0.45)
  const rowFinal = Math.max(MIN_ROW_H * 0.85, rowH - (over * 0.4) / rows)
  const paddleFinal = Math.max(40, paddleH - over * 0.15)

  const coinsW = plaqueBelowChrome ? Math.min(inner, 300) : Math.min(betweenCorners, 300)
  const coins: Rect = {
    x: Math.round(w / 2 - coinsW / 2),
    y: coinsTop,
    w: coinsW,
    h: coinsH,
  }

  // Centred vertically in whatever is left. On an iPad the caps above stop the room
  // growing to fill a tall frame, and top-aligning it then leaves a third of the screen
  // as empty stone under the keypad.
  const used =
    stripH +
    GAP +
    blockFinal +
    GAP +
    (rows * rowFinal + (rows - 1) * GAP) +
    GAP +
    paddleFinal +
    GAP +
    (keyRows * keyH + (keyRows - 1) * GAP)
  let y = contentTop + Math.max(0, (avail - used) / 2)
  const strip: Rect = { x: x0, y, w: inner, h: stripH }
  y += stripH + GAP

  const block: Rect = { x: x0, y, w: inner, h: blockFinal }
  // The offer is the second number the round turns on, so it gets its own plate on
  // the right of the block rather than a line of small print under the lot's name.
  const offerW = Math.min(Math.max(112, inner * 0.38), inner - 90)
  const offer: Rect = {
    x: block.x + block.w - offerW,
    y: block.y,
    w: offerW,
    h: block.h,
  }
  y += blockFinal + GAP

  const galleryH = rows * rowFinal + (rows - 1) * GAP
  const gallery: Rect = { x: x0, y, w: inner, h: galleryH }
  const tablets: Rect[] = []
  const tabletW = (inner - (cols - 1) * GAP) / cols
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    // The last row is centred, so four tablets on two columns do not leave a hole
    // in a corner that reads as a missing bidder.
    const inRow = Math.min(cols, count - row * cols)
    const rowW = inRow * tabletW + (inRow - 1) * GAP
    const rowX = x0 + (inner - rowW) / 2
    tablets.push({
      x: rowX + col * (tabletW + GAP),
      y: gallery.y + row * (rowFinal + GAP),
      w: tabletW,
      h: rowFinal,
    })
  }
  y += galleryH + GAP

  const paddle: Rect = { x: x0, y, w: inner, h: paddleFinal }
  y += paddleFinal + GAP

  // The digits, in counting order, then the controls on a row of their own. `⌫` is one
  // cell; FOLD and GAVEL split the rest, because they are the two decisions and a
  // decision should not be the same size as a digit.
  const keys: Key[] = []
  const keyW = (inner - (keyCols - 1) * GAP) / keyCols
  const span = (cells: number): number => cells * keyW + (cells - 1) * GAP
  const DIGITS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
  for (let i = 0; i < DIGITS.length; i++) {
    const digit = DIGITS[i] ?? 0
    keys.push({
      id: `d${String(digit)}` as KeyId,
      digit,
      label: String(digit),
      rect: {
        x: x0 + (i % keyCols) * (keyW + GAP),
        y: y + Math.floor(i / keyCols) * (keyH + GAP),
        w: keyW,
        h: keyH,
      },
    })
  }
  const controlY = y + (keyRows - 1) * (keyH + GAP)
  const backCells = keyCols === 10 ? 2 : 1
  const halfCells = (keyCols - backCells) / 2
  keys.push({
    id: "back",
    digit: null,
    label: "⌫",
    rect: { x: x0, y: controlY, w: span(backCells), h: keyH },
  })
  keys.push({
    id: "fold",
    digit: null,
    label: "FOLD",
    rect: { x: x0 + span(backCells) + GAP, y: controlY, w: span(halfCells), h: keyH },
  })
  keys.push({
    id: "gavel",
    digit: null,
    label: "GAVEL",
    rect: {
      x: x0 + span(backCells) + GAP + span(halfCells) + GAP,
      y: controlY,
      w: span(halfCells),
      h: keyH,
    },
  })

  return {
    w,
    h,
    insets,
    coins,
    strip,
    block,
    offer,
    gallery,
    tablets,
    paddle,
    keys,
    plaqueBelowChrome,
  }
}

const inside = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h

export function hitKey(l: Layout, x: number, y: number): Key | null {
  for (const key of l.keys) if (inside(key.rect, x, y)) return key
  return null
}

export function hitTablet(l: Layout, x: number, y: number): number | null {
  for (let i = 0; i < l.tablets.length; i++) {
    const rect = l.tablets[i]
    if (rect && inside(rect, x, y)) return i
  }
  return null
}

/** Everything a child must read or touch, for the host-chrome assertion. */
export function criticalRects(l: Layout): readonly Rect[] {
  return [l.coins, l.strip, l.block, l.offer, ...l.tablets, l.paddle, ...l.keys.map((k) => k.rect)]
}

export { PROMPT_MAX_CHARS, MIN_NUMERAL_PX, MIN_TABLET_W }
