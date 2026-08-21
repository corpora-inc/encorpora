// Two layouts, both designed rather than one adapted.
//
// PORTRAIT (a phone or a tablet held upright) stacks the furnace: readout on
// top, the station column in the middle, and the anvil in the bottom third
// where a thumb actually reaches. Every tap target clears 56 px.
//
// LANDSCAPE (a tablet on its side, or a desktop) puts the furnace column down
// the left and the workbench on the right, so the two things you alternate
// between are never more than one saccade apart and neither ever moves.
//
// **The frame is not the screen.** `computeLayout` takes the safe rectangle,
// and takes it as a REQUIRED argument. This game declares `viewport-fit=cover`
// and draws its entire HUD on a canvas; `env(safe-area-inset-*)` is a CSS value
// a canvas cannot read, so before this the SPARKS readout was laid out from the
// raw viewport and its top sat under the notch. An optional argument would mean
// a caller that forgets it still compiles and only fails on a device.
//
// **Two corners stay clear.** The host floats a 44px exit control over the
// top-left and the how-to-play control over the top-right. It does not reserve
// a band and this layout must not pretend it did — taking a strip off the top
// would come straight out of the station rows, which are already only 36px on a
// 320px phone. Instead the top of the frame is confined HORIZONTALLY to the
// channel between the two corners: `chanX`..`chanR`. The header sits in it in
// both orientations, and in landscape so does the station column, because there
// the top row reaches the very top of the screen.
//
// The backdrop, the furnace body, the glow and the particles all still use the
// full `w`/`h` and bleed under the notch, which is the point of `cover`.

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
} from "../../../../packs/shared/game-chrome/index.ts"

export type Rect = { x: number; y: number; w: number; h: number }

export function hit(r: Rect, x: number, y: number, slop = 0): boolean {
  return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop
}

/** Breathing room between a HUD edge and a host control. */
const CHROME_GAP = 8

/**
 * The narrowest channel the header is still worth squeezing into.
 *
 * Above this, the header narrows between the two corners and nothing else in
 * the frame moves — which is the cheap outcome, because the alternative costs
 * the station rows height they do not have. Below it, squeezing would leave a
 * readout too narrow to set the score in, so the header drops BENEATH the
 * corners instead and takes the full width back. That happens on a very narrow
 * Split View and on a tall frame with insets on both long edges.
 */
const MIN_CHANNEL = 180

export type Layout = {
  portrait: boolean
  w: number
  h: number
  /** The safe rectangle this layout was built from. */
  safe: Rect
  pad: number
  /** The station column, bottom-anchored: BELLOWS never moves. */
  chain: Rect
  rowH: number
  rows: Rect[]
  crucible: { x: number; y: number; r: number }
  /** Where the furnace body ends — the mouth sits just above it. */
  furnaceBottom: number
  header: Rect
  readoutY: number
  anvil: Rect
  billet: Rect
  /** The anvil silhouette, in the gap between the work bar and the ingots. */
  anvilBody: Rect
  hammerY: number
  slugs: Rect[]
  quench: Rect
  audio: Rect
  scale: number
}

const MAX_W = 1280

export function computeLayout(w: number, h: number, revealed: number, area: Rect): Layout {
  const portrait = area.h >= area.w * 0.98
  // One scale factor for every type size and inset, tied to the short edge, so
  // a 320 px phone and a 1280 px desktop look like the same game rather than
  // the same game with different amounts of empty space.
  const scale = Math.max(
    0.72,
    Math.min(1.55, Math.min(area.w, area.h) / (portrait ? 420 : 700)),
  )
  const pad = Math.round(14 * scale)
  const n = Math.max(1, revealed)

  // Centre the playfield on very wide screens instead of stretching it.
  const cw = Math.min(area.w, MAX_W)
  const ox = area.x + (area.w - cw) / 2

  // The channel between the host's two 44px corners, never narrower than the
  // centred playfield already was. On a 1920px desktop the playfield is already
  // inset 320px and the corners cost nothing; on a 320px phone this is what
  // moves the readout out from under the exit chevron.
  const rail = HOST_MARGIN + HOST_CONTROL + CHROME_GAP
  const chanX = Math.max(ox + pad, area.x + rail)
  const chanR = Math.min(ox + cw - pad, area.x + area.w - rail)

  if (portrait) {
    const headerH = Math.round(Math.min(area.h * 0.175, 152 * scale))
    const anvilH = Math.round(Math.min(area.h * 0.35, 318 * scale))
    // Only the header reaches into the host's band, so only the header narrows.
    // The station column below it keeps the full width it always had.
    const narrow = chanR - chanX < MIN_CHANNEL
    const header: Rect = narrow
      ? {
          x: ox + pad,
          y: area.y + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + CHROME_GAP,
          w: cw - pad * 2,
          h: headerH,
        }
      : { x: chanX, y: area.y + pad, w: chanR - chanX, h: headerH }
    // The anvil is bottom-anchored and the column fills what is left, so the
    // column absorbs a dropped header rather than running into the workbench.
    // Written as "the anvil, minus the mouth" so the relationship survives the
    // header moving; in the ordinary case it is the value it always was.
    const anvilTop = area.y + area.h - anvilH
    const chain: Rect = {
      x: ox + pad,
      y: header.y + header.h + pad * 0.5,
      w: cw - pad * 2,
      h: Math.max(
        60,
        anvilTop - (header.y + header.h + pad * 0.5) - pad * 0.1 - 46 * scale,
      ),
    }
    const rowH = Math.min(chain.h / 6, 86 * scale)
    const rows: Rect[] = []
    for (let i = 0; i < 6; i++) {
      rows.push({
        x: chain.x,
        y: chain.y + chain.h - (i + 1) * rowH + Math.max(0, (6 - n) * 0),
        w: chain.w,
        h: rowH - Math.round(5 * scale),
      })
    }
    // Bottom-anchored to the SAFE area, so the ingots a child taps sit above
    // the home indicator rather than under it.
    const anvil: Rect = { x: ox, y: anvilTop, w: cw, h: anvilH }
    const slugH = Math.min(anvilH * 0.42, 120 * scale)
    const slugY = area.y + area.h - slugH - pad
    const sgap = Math.round(9 * scale)
    const slugW = (cw - pad * 2 - sgap * 3) / 4
    const slugs: Rect[] = []
    for (let i = 0; i < 4; i++) {
      slugs.push({ x: ox + pad + i * (slugW + sgap), y: slugY, w: slugW, h: slugH })
    }
    const gap = Math.max(pad * 1.6, 34 * scale)
    const billetH = Math.min(96 * scale, Math.max(50 * scale, anvilH - slugH - pad - gap))
    const billetW = Math.min(cw - pad * 4.4, 460 * scale)
    const billet: Rect = {
      x: ox + (cw - billetW) / 2,
      y: slugY - billetH - gap,
      w: billetW,
      h: billetH,
    }
    return {
      portrait,
      w,
      h,
      safe: area,
      pad,
      chain,
      rowH,
      rows,
      crucible: { x: ox + cw / 2, y: chain.y + chain.h + 30 * scale, r: 150 * scale },
      furnaceBottom: chain.y + chain.h + 48 * scale,
      header,
      readoutY: header.y + header.h * 0.52,
      anvil,
      billet,
      anvilBody: {
        x: billet.x + billet.w * 0.29,
        y: billet.y + billet.h - 4 * scale,
        w: billet.w * 0.42,
        h: slugY - (billet.y + billet.h) + 2 * scale,
      },
      hammerY: billet.y - 4 * scale,
      slugs,
      quench: quenchRect(header, Math.min(132 * scale, header.w - 8), 46 * scale, 6),
      audio: { x: header.x + header.w - 34 * scale, y: header.y + header.h - 30 * scale, w: 30 * scale, h: 26 * scale },
      scale,
    }
  }

  // --- landscape -----------------------------------------------------------
  //
  // In landscape the station column reaches the very top of the frame, so its
  // REACTOR row sits under the exit control. The column therefore starts at the
  // channel — but it gives up that width on its own LEFT EDGE and keeps its
  // right edge exactly where it was.
  //
  // That distinction is the whole point. Sliding the column right would slide
  // the workbench right with it, and the workbench's four ingots are the answer
  // buttons: on a rotated phone (568×320) that took them from 62px wide to
  // 36px, and to 24px with insets on both long edges. Buying a station is a
  // wide row that can afford to be narrower; a 24px answer button cannot be
  // hit. So only the column pays, and it pays on the side the control is on.
  const colW = Math.min(cw * 0.46, 560 * scale)
  const colRight = ox + pad + colW
  const chain: Rect = {
    x: chanX,
    y: area.y + pad * 2.2,
    w: Math.max(120, colRight - chanX),
    h: area.h - pad * 3.2 - 104 * scale,
  }
  const rowH = Math.min(chain.h / 6, 100 * scale)
  const rows: Rect[] = []
  for (let i = 0; i < 6; i++) {
    rows.push({
      x: chain.x,
      y: chain.y + chain.h - (i + 1) * rowH,
      w: chain.w,
      h: rowH - Math.round(6 * scale),
    })
  }
  // The workbench keeps the full right column it always had: the anvil, the
  // work bar and the four ingots all live in the BOTTOM half of the frame,
  // nowhere near the host's controls. Only the header, which carries the QUENCH
  // plate in its top-right corner, is pulled in to the channel.
  const rx = colRight + pad * 1.6
  const rw = ox + cw - pad - rx
  const headerH = Math.min(area.h * 0.3, 190 * scale)
  const header: Rect = { x: rx, y: chain.y, w: Math.max(120, chanR - rx), h: headerH }
  const anvil: Rect = {
    x: rx,
    y: header.y + headerH + pad,
    w: rw,
    h: area.y + area.h - header.y - headerH - pad * 2.2,
  }
  const slugH = Math.min(anvil.h * 0.42, 132 * scale)
  const slugY = anvil.y + anvil.h - slugH
  const sgap = Math.round(10 * scale)
  const slugW = (rw - sgap * 3) / 4
  const slugs: Rect[] = []
  for (let i = 0; i < 4; i++) slugs.push({ x: rx + i * (slugW + sgap), y: slugY, w: slugW, h: slugH })
  const gap = Math.max(pad * 3.4, 66 * scale)
  const billetH = Math.min(112 * scale, Math.max(56 * scale, anvil.h - slugH - gap - pad))
  const billetW = Math.min(rw, 540 * scale)
  const billet: Rect = { x: rx + (rw - billetW) / 2, y: slugY - billetH - gap, w: billetW, h: billetH }

  return {
    portrait,
    w,
    h,
    safe: area,
    pad,
    chain,
    rowH,
    rows,
    crucible: { x: chain.x + chain.w / 2, y: area.y + area.h - 26 * scale, r: 170 * scale },
    furnaceBottom: area.y + area.h - 6 * scale,
    header,
    readoutY: header.y + headerH * 0.5,
    anvil,
    billet,
    anvilBody: {
      x: billet.x + billet.w * 0.3,
      y: billet.y + billet.h - 5 * scale,
      w: billet.w * 0.4,
      h: slugY - (billet.y + billet.h) + 3 * scale,
    },
    hammerY: billet.y - 5 * scale,
    slugs,
    quench: quenchRect(header, Math.min(150 * scale, header.w - 8), 50 * scale, 0),
    audio: { x: header.x + header.w - 34 * scale, y: header.y + headerH - 30 * scale, w: 30 * scale, h: 26 * scale },
    scale,
  }
}

/**
 * The QUENCH plate, right-anchored inside its header.
 *
 * Clamped to the header's own width, because the header is now the narrower of
 * the two halves in landscape: an unclamped 150px plate on a 68px header starts
 * 40px to the LEFT of the panel it belongs to and sits over the station column.
 */
function quenchRect(header: Rect, w: number, h: number, dy: number): Rect {
  const width = Math.max(64, w)
  return { x: header.x + header.w - width, y: header.y + dy, w: width, h }
}
