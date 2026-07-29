// Where the tower's numbers are allowed to be.
//
// COLOSSUS shipped with its geometry scattered through the renderer as
// literals: `fillText("TOWER 3", 18, 30)`, a pip strip anchored to `w - 18`, a
// camera band that began at a hardcoded `74`. Every one of those numbers is
// measured from the edge of the CANVAS, and the canvas is not the screen. The
// pack declares `viewport-fit=cover`, so on a notched phone the first 59 rows of
// that canvas are under the notch, and the host paints an exit control over the
// top-left corner and a how-to-play control over the top-right one. `TOWER 3`
// and `BEST 12` were under the exit control; the progress pips were under the
// help control. On a device, not in a test.
//
// So the geometry lives here instead, as one pure function of the viewport and
// the safe rectangle, and the test asserts it at every shape the fleet has.
//
// **`area` is required, not optional.** A game that forgets to pass it would
// otherwise compile and quietly draw under the notch, discoverable only by
// holding the device.
//
// **The corners are cleared horizontally, not by reserving a band.** Reserving
// the 67px top strip costs 12% of a 568px phone and broke a sibling game's own
// layout outright. Insetting between the two 44px corners costs no height at
// all: the HUD labels start inboard of the exit control and the pips end
// inboard of the help control, and the ~200px between them on the narrowest
// phone is more than both need.
//
// What still bleeds to the full canvas: the sky, the sun, the skyline, the
// ground, the dust. That is what `cover` is FOR. It is only what a child must
// read or touch that belongs inside `area`.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  safeInsets,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { MAX_KEYSTONES } from "../game/tower.ts"

/** World units. One floor of the colossus. */
export const FLOOR_H = 56
export const FLOOR_W = 300
export const KEY_H = 92
export const KEY_GAP = 22

/** Clear air between a host control and anything of ours standing beside it. */
const CORNER_GAP = 8

const HUD_FONT = 13
const PIP_W = 10
const PIP_H = 10
const PIP_GAP = 6

/** Enough for `TOWER 3` at 13px. Below this the pips stack instead. */
const MIN_LABEL_W = 58
/** Air between the ground line and the strike bar. */
const GROUND_GAP = 26
/** The bar gives height back to the world before it goes below this. */
const MIN_BAR_H = 64
/** What the building is owed before the strike bar may take its full height. */
const MIN_BAND = 150

export type { Rect }

export type Layout = {
  readonly w: number
  readonly h: number
  /** The rectangle the notch and the home indicator leave us. */
  readonly area: Rect
  /** Centre of the safe area — the building stands here, not at `w / 2`. */
  readonly cx: number
  readonly hudFont: number
  /** Left edge of `TOWER n` / `BEST n`, inboard of the host's exit control. */
  readonly hudX: number
  readonly towerY: number
  readonly bestY: number
  /** What those two labels occupy, at their widest. Asserted, not guessed. */
  readonly towerBox: Rect
  readonly bestBox: Rect
  readonly pipW: number
  readonly pipH: number
  readonly pipGap: number
  /** Right edge the pip strip hangs from, inboard of the help control. */
  readonly pipRight: number
  readonly pipY: number
  /** The whole strip at its widest — every shorter tower fits inside it. */
  readonly pips: Rect
  readonly strikeBarH: number
  readonly strike: Rect
  /** The camera band: world is fitted between these two, never above `hudTop`. */
  readonly hudTop: number
  readonly hudBottom: number
  readonly usableH: number
  readonly groundY: number
}

/**
 * The geometry of one frame.
 *
 * `area` is the safe rectangle. Pass `safeRect(w, h)` — or, in a test, the same
 * thing computed from a made-up inset profile.
 */
export function layout(w: number, h: number, area: Rect): Layout {
  const cornerTop = area.y + HOST_PROGRESS_H + HOST_MARGIN
  const cornerBottom = cornerTop + HOST_CONTROL

  // The centre strip: everything the host does not own.
  const left = area.x + HOST_MARGIN + HOST_CONTROL + CORNER_GAP
  const right = Math.max(left, area.x + area.w - HOST_MARGIN - HOST_CONTROL - CORNER_GAP)

  // Two lines of small caps, sitting level with the host's controls rather than
  // pushed below them. Nothing is lost to the notch that the notch did not take.
  const labelH = Math.ceil(HUD_FONT * 1.3)
  const towerY = cornerTop + 17
  const bestY = cornerTop + 37

  const pipStripW = MAX_KEYSTONES * (PIP_W + PIP_GAP) - PIP_GAP

  // The centre strip is everything the host's two corners leave. On a 320px
  // phone that is ~196px, and `TOWER 999` plus five pips needs about 160 — so
  // the two normally sit on one line, label left, pips right.
  const centreW = right - left
  const wantLabelW = HUD_FONT * 0.62 * 10
  const abreast = centreW >= MIN_LABEL_W + pipStripW + CORNER_GAP

  // When they will not fit abreast, the pips drop to their own line UNDER the
  // labels rather than either of them backing into a corner. That line is below
  // the 44px control squares, so it is clear of the chrome twice over.
  const labelW = Math.max(
    0,
    Math.min(wantLabelW, abreast ? centreW - pipStripW - CORNER_GAP : centreW),
  )
  const towerBox: Rect = { x: left, y: towerY - labelH / 2, w: labelW, h: labelH }
  const bestBox: Rect = { x: left, y: bestY - labelH / 2, w: labelW, h: labelH }

  const pipY = abreast ? cornerTop + 12 : bestBox.y + bestBox.h + 6
  const pips: Rect = { x: right - pipStripW, y: pipY, w: pipStripW, h: PIP_H }

  // The camera band begins below everything the top of the frame is spending:
  // the host's controls, our own labels, and the pips when they had to stack.
  const hudTop = Math.max(cornerBottom, bestBox.y + bestBox.h, pips.y + pips.h) + CORNER_GAP

  // The strike bar hangs off the bottom of the SAFE area, not the canvas: on a
  // 390px-tall landscape phone the home indicator eats 21px, and a pill anchored
  // to `h` puts the only button in the game under it.
  //
  // It also gives height back when there is not enough left for the building. A
  // fixed 96px bar under a 59px notch on a landscape phone left the world 108px
  // and the keystone climbed out of the frame; the bar yields first, because a
  // shorter bar is still a 58px button and a clipped keystone is unreadable.
  const bottom = area.y + area.h
  const headroom = bottom - hudTop - GROUND_GAP
  const wantBarH = Math.max(96, Math.min(132, area.h * 0.14))
  const strikeBarH = Math.max(MIN_BAR_H, Math.min(wantBarH, headroom - MIN_BAND))
  const pillH = Math.max(58, Math.min(78, strikeBarH * 0.62))
  const pillW = Math.max(0, Math.min(area.w - 40, 520))
  const strike: Rect = {
    x: area.x + (area.w - pillW) / 2,
    y: bottom - strikeBarH + (strikeBarH - pillH) / 2,
    w: pillW,
    h: pillH,
  }

  const groundY = bottom - strikeBarH - GROUND_GAP
  // No floor under this. A band that claims to be 120px when only 108 exist is
  // how the keystone ended up over the notch in the first place.
  const usableH = Math.max(24, groundY - hudTop)

  return {
    w,
    h,
    area,
    cx: area.x + area.w / 2,
    hudFont: HUD_FONT,
    hudX: left,
    towerY,
    bestY,
    towerBox,
    bestBox,
    pipW: PIP_W,
    pipH: PIP_H,
    pipGap: PIP_GAP,
    pipRight: right,
    pipY,
    pips,
    strikeBarH,
    strike,
    hudTop,
    hudBottom: h - groundY,
    usableH,
    groundY,
  }
}

/**
 * The one entry point the renderer uses.
 *
 * `Scene` obtains geometry through this and nothing else, which is what makes
 * the layout test worth having: it exercises the exact path a frame takes,
 * insets included, instead of a rectangle the test supplied itself.
 */
export function viewLayout(w: number, h: number, insets: Insets = safeInsets()): Layout {
  return layout(w, h, safeRect(w, h, insets))
}

/** Screen x of pip `i` of `total`, hung from the right of the strip. */
export function pipX(l: Layout, i: number, total: number): number {
  return l.pipRight - (total - i) * (l.pipW + l.pipGap) + l.pipGap
}

/**
 * The camera, for a tower `floors` high.
 *
 * One scale fits tower plus keystone into `usableH`, and everything is drawn
 * through it — which is the whole trick of this game: a tower that grew makes
 * the giant smaller, and nobody has to be told.
 *
 * `cap` is the safety half. The keystone carries the sum the child has to read;
 * capping the scale so its top edge — float included — can never rise past
 * `hudTop` means the notch and the host's corners cannot eat it, whatever a
 * wrong strike does to the height of the building. `cap` is separate from
 * `scale` because the renderer eases toward `scale` and would otherwise pass
 * through a too-large value on the way down after the tower grows.
 */
export function cameraFor(l: Layout, floors: number): {
  scale: number
  cap: number
  cx: number
  groundY: number
} {
  const n = Math.max(0, floors)
  const worldH = n * FLOOR_H + KEY_GAP + KEY_H + FLOOR_H * 0.6
  const byHeight = l.usableH / Math.max(worldH, FLOOR_H * 6)
  // A narrow frame gives the building less of the width, not more: the colossus
  // has to have somewhere to stand, and a phone in portrait is the only case
  // where the two are fighting over the same pixels.
  const byWidth = (l.area.w * (l.area.w < 640 ? 0.68 : 0.82)) / (FLOOR_W * 1.18)
  const byKeystone = l.usableH / (n * FLOOR_H + KEY_GAP + KEY_H + KEY_H * 0.06)
  const cap = Math.min(1.05, byWidth, byKeystone)
  return { scale: Math.min(cap, byHeight), cap, cx: l.cx, groundY: l.groundY }
}

/** Where the keystone plate lands on screen, float included. */
export function keystoneBox(l: Layout, floors: number, scale = cameraFor(l, floors).scale): Rect {
  const w = FLOOR_W * 1.16 * scale
  const h = KEY_H * scale
  const float = h * 0.05
  return {
    x: l.cx - w / 2,
    y: l.groundY - (floors * FLOOR_H + KEY_GAP + KEY_H) * scale - float,
    w,
    h: h + float * 2,
  }
}

/** Where floor `index` (0 = ground floor) lands on screen when it is at rest. */
export function floorBox(l: Layout, floors: number, index: number, scale = cameraFor(l, floors).scale): Rect {
  const w = FLOOR_W * scale
  return {
    x: l.cx - w / 2,
    y: l.groundY - (index + 1) * FLOOR_H * scale,
    w,
    h: FLOOR_H * scale,
  }
}
