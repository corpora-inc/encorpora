// Two layouts, both designed rather than one adapted.
//
// PORTRAIT (a phone or a tablet held upright) stacks the furnace: readout on
// top, the station column in the middle, and the anvil in the bottom third
// where a thumb actually reaches. Every tap target clears 56 px.
//
// LANDSCAPE (a tablet on its side, or a desktop) puts the furnace column down
// the left and the workbench on the right, so the two things you alternate
// between are never more than one saccade apart and neither ever moves.

export type Rect = { x: number; y: number; w: number; h: number }

export function hit(r: Rect, x: number, y: number, slop = 0): boolean {
  return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop
}

export type Layout = {
  portrait: boolean
  w: number
  h: number
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

export function computeLayout(w: number, h: number, revealed: number): Layout {
  const portrait = h >= w * 0.98
  // One scale factor for every type size and inset, tied to the short edge, so
  // a 320 px phone and a 1280 px desktop look like the same game rather than
  // the same game with different amounts of empty space.
  const scale = Math.max(0.72, Math.min(1.55, Math.min(w, h) / (portrait ? 420 : 700)))
  const pad = Math.round(14 * scale)
  const n = Math.max(1, revealed)

  // Centre the playfield on very wide screens instead of stretching it.
  const cw = Math.min(w, MAX_W)
  const ox = (w - cw) / 2

  if (portrait) {
    const headerH = Math.round(Math.min(h * 0.175, 152 * scale))
    const anvilH = Math.round(Math.min(h * 0.35, 318 * scale))
    const header: Rect = { x: ox + pad, y: pad, w: cw - pad * 2, h: headerH }
    const chain: Rect = {
      x: ox + pad,
      y: header.y + header.h + pad * 0.5,
      w: cw - pad * 2,
      h: h - headerH - anvilH - pad * 1.6 - 46 * scale,
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
    const anvil: Rect = { x: ox, y: h - anvilH, w: cw, h: anvilH }
    const slugH = Math.min(anvilH * 0.42, 120 * scale)
    const slugY = h - slugH - pad
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
      quench: { x: header.x + header.w - 132 * scale, y: header.y + 6, w: 132 * scale, h: 46 * scale },
      audio: { x: header.x + header.w - 34 * scale, y: header.y + header.h - 30 * scale, w: 30 * scale, h: 26 * scale },
      scale,
    }
  }

  // --- landscape -----------------------------------------------------------
  const colW = Math.min(cw * 0.46, 560 * scale)
  const chain: Rect = { x: ox + pad, y: pad * 2.2, w: colW, h: h - pad * 3.2 - 104 * scale }
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
  const rx = chain.x + chain.w + pad * 1.6
  const rw = ox + cw - pad - rx
  const headerH = Math.min(h * 0.3, 190 * scale)
  const header: Rect = { x: rx, y: pad * 2.2, w: rw, h: headerH }
  const anvil: Rect = { x: rx, y: header.y + headerH + pad, w: rw, h: h - header.y - headerH - pad * 2.2 }
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
    pad,
    chain,
    rowH,
    rows,
    crucible: { x: chain.x + chain.w / 2, y: h - 26 * scale, r: 170 * scale },
    furnaceBottom: h - 6 * scale,
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
    quench: { x: header.x + header.w - 150 * scale, y: header.y, w: 150 * scale, h: 50 * scale },
    audio: { x: header.x + header.w - 34 * scale, y: header.y + headerH - 30 * scale, w: 30 * scale, h: 26 * scale },
    scale,
  }
}
