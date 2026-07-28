// THE SKY — the coordinate plane, the stars falling through it, and the lamps
// on the horizon.
//
// The lattice is ruled ONES across and TENS up, ten by ten, with the figures
// engraved along the two axes. It is the mathematics, drawn as the world:
// nothing here is a chart laid over a game, the chart *is* the game.
//
// **A star is never drawn at its station.** It falls down a lane the game drew
// from its own generator, and where it is says nothing whatever about what it
// is worth. The only moment a star and a station meet is the snap, after the
// child has already named it — and that snap is the whole reveal.

import { alpha, BRASS, BRASS_DEEP, BRASS_DIM, BRASS_LIT, FIGURE_FONT, LAMP_LIT, LAMP_OUT, LAPIS, LAPIS_DIM, LAPIS_LIT, NIGHT, NIGHT_HIGH, OXIDE, PLATE_FONT, sized, STARLIGHT, STARLIGHT_CORE, STONE, STONE_EDGE } from "./palette.ts"

export type Rect = { x: number; y: number; w: number; h: number }

export type Layout = {
  w: number
  h: number
  /** 1 rpx = shortEdge / 1080. Every spatial magnitude in the game is in these. */
  rpx: number
  /** True when the instrument sits beside the sky rather than under it. */
  landscape: boolean
  /** The whole night column: everything above the horizon. */
  sky: Rect
  /** The ruled plane, inside it. */
  plane: Rect
  /** Spacing between lattice points. */
  cell: number
  /** Where the stars are released from, and where they land. */
  ceiling: number
  horizon: number
  /** The astrolabe. */
  dial: { cx: number; cy: number; r: number }
}

const LATTICE = 10

/**
 * How far past `dial.r` the instrument actually reaches: the plate, the chain
 * fan on the rim and the sightings column beside it. Everything that budgets
 * space for the astrolabe budgets this, not the radius, which is how the dial
 * came to sit on top of the horizon the first time it was drawn.
 */
const DIAL_EXTENT = 1.34

/**
 * The layout, and it is two layouts.
 *
 * A tablet held wide and a phone held tall are not the same room. In landscape
 * the astrolabe stands beside the sky, in portrait it stands under it, and in
 * both the sky gets everything the instrument does not need. Tablet and desktop
 * are first-class here; neither is a stretched phone.
 */
export function layoutFor(w: number, h: number): Layout {
  const rpx = Math.min(w, h) / 1080
  const landscape = w >= h * 1.12
  const gutter = Math.max(10, Math.min(w, h) * 0.022)
  // The sky is the game and the instrument is the hand: the astrolabe takes as
  // little of the room as it can and still be turned with a thumb.
  const dialR = landscape
    ? Math.min(h * 0.27, w * 0.17)
    : Math.min(w * 0.3, h * 0.19, 230 * Math.max(1, rpx * 1.5))
  const reach = dialR * DIAL_EXTENT

  const dial = landscape
    ? { cx: w - reach - gutter, cy: h / 2, r: dialR }
    : { cx: w / 2, cy: h - reach - gutter, r: dialR }
  const sky: Rect = landscape
    ? { x: gutter, y: gutter, w: Math.max(60, dial.cx - reach - gutter * 2), h: h - gutter * 2 }
    : { x: gutter, y: gutter, w: w - gutter * 2, h: Math.max(60, dial.cy - reach - gutter * 2) }

  const ceiling = sky.y
  const horizon = sky.y + sky.h

  // Room under the plane for the lamps to burn in, and room around it for the
  // axis figures. A lattice drawn over the lamps is a lattice nobody can read,
  // and the figures are part of the lattice — reserving for the ticks and not
  // for the numerals under them is exactly how they came to collide.
  const lampBand = lampRadius(sky.w, rpx) * 3.6
  const axisPad = Math.max(18, Math.min(sky.w, sky.h) * 0.06)

  const availW = Math.max(30, sky.w - axisPad * 1.5)
  // The 9/10.2 is the figures' own row: nine gaps of lattice plus a little over
  // one more cell of numerals underneath, solved for the cell rather than
  // guessed at, so the reserve is right at every viewport instead of at one.
  const availH = Math.max(30, (sky.h - lampBand - axisPad * 0.9) * (9 / 10.2))
  const cell = Math.max(5, Math.min(availW, availH) / (LATTICE - 1))
  const span = cell * (LATTICE - 1)

  const plane: Rect = {
    x: sky.x + axisPad + (availW - span) / 2,
    y: ceiling + axisPad * 0.9 + (availH - span) / 2,
    w: span,
    h: span,
  }

  return { w, h, rpx, landscape, sky, plane, cell, ceiling, horizon, dial }
}

/** Where the lattice point (x ones, y tens) is on the glass. Tens climb. */
export function stationPoint(l: Layout, x: number, y: number): { px: number; py: number } {
  return { px: l.plane.x + x * l.cell, py: l.plane.y + l.plane.h - y * l.cell }
}

/** Where a star is: its lane across, its fall down. Nothing to do with its worth. */
export function starPoint(l: Layout, lane: number, t: number): { px: number; py: number } {
  const inset = Math.min(l.cell * 0.55, l.sky.w * 0.07)
  // Room at the top for a ledger plate to be read before the star has moved.
  const top = l.ceiling + Math.min(l.cell * 1.1, l.sky.h * 0.1)
  const left = l.sky.x + inset
  const right = l.sky.x + l.sky.w - inset
  return { px: left + (right - left) * lane, py: top + (l.horizon - top) * t }
}

/**
 * A lamp's radius, from the width it has to stand in.
 *
 * Deliberately independent of *how many* lamps there are: the layout has to
 * reserve room for them before it knows anything about the rules, and a reserve
 * that depended on a game constant would be a circular one.
 */
function lampRadius(skyW: number, rpx: number): number {
  return Math.max(4, Math.min(skyW / 26, 16 * Math.max(1, rpx * 1.6)))
}

/**
 * Where the lamps stand: their radius, and the highest pixel any of them
 * reaches.
 *
 * Exported because it is a *constraint*, not a detail — the ruled plane has to
 * stop above it, and `src/test/layout.test.ts` checks that it does at every
 * viewport rather than at the one somebody happened to have open.
 */
export function lampGeometry(l: Layout): { r: number; top: number } {
  const r = lampRadius(l.sky.w, l.rpx)
  return { r, top: l.horizon - r * 3.4 }
}

/** How far the astrolabe actually reaches from its centre, plate and rim and all. */
export function dialReach(l: Layout): number {
  return l.dial.r * DIAL_EXTENT
}

// ── the ground ──────────────────────────────────────────────────────────────

export function drawNight(g: CanvasRenderingContext2D, l: Layout): void {
  g.fillStyle = NIGHT
  g.fillRect(0, 0, l.w, l.h)
  // The aperture: the night the observatory is actually looking through. A
  // hard-edged opening cut in stone, not a gradient wash.
  g.fillStyle = NIGHT_HIGH
  g.fillRect(l.sky.x, l.sky.y, l.sky.w, l.sky.h)
  g.strokeStyle = alpha(LAPIS_DIM, 0.9)
  g.lineWidth = Math.max(1, l.rpx * 2)
  g.strokeRect(l.sky.x, l.sky.y, l.sky.w, l.sky.h)
}

/**
 * The ruled plane, with the axis figures.
 *
 * `logged` are the stations this observatory has already written down; they
 * stay written for the whole sitting. Construction never regresses — the ledger
 * only ever fills in.
 */
export function drawLattice(
  g: CanvasRenderingContext2D,
  l: Layout,
  logged: ReadonlySet<number>,
  aim: { x: number; y: number },
  glow: number,
): void {
  const tick = Math.max(2, l.cell * 0.11)
  g.lineWidth = Math.max(1, l.rpx * 1.6)

  for (let y = 0; y < LATTICE; y++) {
    for (let x = 0; x < LATTICE; x++) {
      const { px, py } = stationPoint(l, x, y)
      const onAxis = x === aim.x || y === aim.y
      g.strokeStyle = onAxis ? alpha(LAPIS_LIT, 0.5) : alpha(LAPIS, 0.42)
      g.beginPath()
      g.moveTo(px - tick, py)
      g.lineTo(px + tick, py)
      g.moveTo(px, py - tick)
      g.lineTo(px, py + tick)
      g.stroke()

      if (logged.has(y * 10 + x)) {
        // A station the child has taken. Brass, filled, permanent.
        g.fillStyle = alpha(BRASS_DIM, 0.85)
        const s = Math.max(2, l.cell * 0.09)
        g.fillRect(px - s, py - s, s * 2, s * 2)
      }
    }
  }

  // The cross-hair the rings are standing at. This is the child's own reading
  // drawn on the sky — the one thing on the plane that answers to the dial.
  const { px, py } = stationPoint(l, aim.x, aim.y)
  g.strokeStyle = alpha(BRASS_LIT, 0.55 + 0.45 * glow)
  g.lineWidth = Math.max(1, l.rpx * 2.4)
  g.beginPath()
  g.moveTo(l.plane.x - l.cell * 0.5, py)
  g.lineTo(l.plane.x + l.plane.w + l.cell * 0.5, py)
  g.moveTo(px, l.plane.y - l.cell * 0.5)
  g.lineTo(px, l.plane.y + l.plane.h + l.cell * 0.5)
  g.stroke()

  const r = l.cell * (0.3 + 0.06 * glow)
  g.strokeStyle = alpha(BRASS_LIT, 0.9)
  g.beginPath()
  g.arc(px, py, r, 0, Math.PI * 2)
  g.stroke()

  // The figures. Ones along the foot, tens up the left edge.
  const size = Math.max(9, Math.min(l.cell * 0.34, 20 * Math.max(1, l.rpx * 1.4)))
  g.font = sized(FIGURE_FONT, size)
  g.textAlign = "center"
  g.textBaseline = "top"
  for (let x = 0; x < LATTICE; x++) {
    const p = stationPoint(l, x, 0)
    g.fillStyle = x === aim.x ? BRASS_LIT : alpha(BRASS_DIM, 0.85)
    g.fillText(String(x), p.px, l.plane.y + l.plane.h + l.cell * 0.28)
  }
  g.textAlign = "right"
  g.textBaseline = "middle"
  for (let y = 0; y < LATTICE; y++) {
    const p = stationPoint(l, 0, y)
    g.fillStyle = y === aim.y ? BRASS_LIT : alpha(BRASS_DIM, 0.85)
    g.fillText(String(y), l.plane.x - l.cell * 0.34, p.py)
  }

  // What the axes are. Engraved once, quietly, and never explained again.
  g.font = sized(FIGURE_FONT, size * 0.7)
  g.textAlign = "right"
  g.textBaseline = "top"
  g.fillStyle = alpha(LAPIS_LIT, 0.8)
  g.fillText("ONES", l.plane.x + l.plane.w, l.plane.y + l.plane.h + l.cell * 0.66)
  g.save()
  g.translate(l.plane.x - l.cell * 0.72, l.plane.y)
  g.rotate(-Math.PI / 2)
  g.textAlign = "left"
  g.fillText("TENS", 0, 0)
  g.restore()
}

// ── the stars ───────────────────────────────────────────────────────────────

export type StarView = {
  id: number
  lane: number
  t: number
  order: number
  prompt: string
  sighted: boolean
  visible: boolean
}

export function drawStar(g: CanvasRenderingContext2D, l: Layout, s: StarView, breath: number): void {
  if (!s.visible) return
  const { px, py } = starPoint(l, s.lane, s.t)
  const r = Math.max(3.5, l.cell * 0.13)

  // The trail: where it has been, thinning upward. Missile Command's whole
  // silhouette is the trail, not the warhead.
  const from = starPoint(l, s.lane, 0)
  g.strokeStyle = alpha(s.sighted ? STARLIGHT : LAPIS_LIT, s.sighted ? 0.5 : 0.28)
  g.lineWidth = Math.max(1, l.rpx * (s.sighted ? 2.6 : 1.7))
  g.beginPath()
  g.moveTo(from.px, from.py)
  g.lineTo(px, py)
  g.stroke()

  g.fillStyle = s.sighted ? STARLIGHT_CORE : STARLIGHT
  g.beginPath()
  g.arc(px, py, r * (s.sighted ? 1.15 + 0.08 * breath : 1), 0, Math.PI * 2)
  g.fill()

  // The ledger plate: the line the child has to work, and the great columns the
  // register has already ruled in.
  const size = Math.max(10, Math.min(l.cell * 0.32, 22 * Math.max(1, l.rpx * 1.3)))
  g.font = sized(PLATE_FONT, size)
  g.textBaseline = "middle"
  const flip = px > l.sky.x + l.sky.w * 0.62
  g.textAlign = flip ? "right" : "left"
  const tx = px + (flip ? -r * 2.4 : r * 2.4)
  // Staggered by identity, so two stars that happen to be at the same height
  // do not print their ledger lines on top of each other.
  const ty = py + ((s.id % 3) - 1) * size * 1.25

  g.fillStyle = s.sighted ? BRASS_LIT : alpha(BRASS, 0.7)
  g.fillText(s.prompt, tx, ty)

  if (s.order > 0) {
    // Pre-inked: the hundreds and above are already in the register, and they
    // are drawn as ink rather than as light so they read as *record*, not as
    // something the child is being told.
    g.font = sized(FIGURE_FONT, size * 0.86)
    g.fillStyle = alpha(BRASS_DIM, 0.9)
    g.fillText(`${s.order}▫▫`, tx, ty + size * 1.05)
  }

  if (s.sighted) {
    // The reticle. A surveyor's bracket, not a video-game crosshair.
    const b = r * 2.6
    g.strokeStyle = alpha(STARLIGHT, 0.85)
    g.lineWidth = Math.max(1, l.rpx * 2)
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      g.beginPath()
      g.moveTo(px + sx * b, py + sy * b * 0.55)
      g.lineTo(px + sx * b, py + sy * b)
      g.lineTo(px + sx * b * 0.55, py + sy * b)
      g.stroke()
    }
  }
}

// ── the horizon ─────────────────────────────────────────────────────────────

export function drawHorizon(
  g: CanvasRenderingContext2D,
  l: Layout,
  lamps: number,
  total: number,
  flicker: number,
): void {
  const y = l.horizon
  const { r } = lampGeometry(l)
  // A plinth, not a floor: the observatory's parapet, the width of the sky it
  // is watching. It must not run under the astrolabe, which stands on its own.
  const plinth = Math.max(6, l.rpx * 14)
  g.fillStyle = STONE
  g.fillRect(l.sky.x, y, l.sky.w, plinth)
  g.strokeStyle = STONE_EDGE
  g.lineWidth = Math.max(1, l.rpx * 2)
  g.beginPath()
  g.moveTo(l.sky.x, y)
  g.lineTo(l.sky.x + l.sky.w, y)
  g.stroke()

  const span = l.sky.w / (total + 1)
  for (let i = 0; i < total; i++) {
    const px = l.sky.x + span * (i + 1)
    const lit = i < lamps
    // The socket, always. A snuffed lamp is a dark socket, not an absence: the
    // observatory is not damaged, it is unlit, and it can be relit.
    g.strokeStyle = alpha(BRASS_DEEP, 0.9)
    g.lineWidth = Math.max(1, l.rpx * 2)
    g.beginPath()
    g.moveTo(px, y)
    g.lineTo(px, y - r * 1.9)
    g.stroke()

    g.fillStyle = lit ? LAMP_LIT : LAMP_OUT
    g.beginPath()
    g.arc(px, y - r * 2.4, r * (lit ? 1 + 0.05 * flicker : 0.8), 0, Math.PI * 2)
    g.fill()
    if (lit) {
      g.strokeStyle = alpha(LAMP_LIT, 0.28)
      g.lineWidth = Math.max(1, l.rpx * 3)
      g.beginPath()
      g.arc(px, y - r * 2.4, r * 1.9, 0, Math.PI * 2)
      g.stroke()
    }
  }
}

// ── blooms and snaps ────────────────────────────────────────────────────────

export type Bloom = {
  /** Where the star was when it was named. */
  fromX: number
  fromY: number
  /** The station it belongs to. */
  toX: number
  toY: number
  age: number
  life: number
  /** 0..1, how hard this link was pushed. */
  weight: number
  link: number
  cold: boolean
}

export function drawBloom(g: CanvasRenderingContext2D, l: Layout, b: Bloom, reduced: boolean): void {
  const t = Math.min(1, b.age / b.life)
  if (t >= 1) return
  const tint = b.cold ? OXIDE : STARLIGHT

  if (reduced) {
    // The branch: no travel, no expansion. The station cross-fades up and back
    // down, and the link is legible from the ring on the astrolabe.
    const a = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65
    g.fillStyle = alpha(tint, 0.55 * a)
    const s = l.cell * 0.34
    g.fillRect(b.toX - s, b.toY - s, s * 2, s * 2)
    return
  }

  // The snap: fast out, faster in, dead stop. The line is the measurement.
  const travel = Math.min(1, t / 0.22)
  const ease = travel * travel * (3 - 2 * travel)
  const hx = b.fromX + (b.toX - b.fromX) * ease
  const hy = b.fromY + (b.toY - b.fromY) * ease
  if (travel < 1 && !b.cold) {
    g.strokeStyle = alpha(tint, 0.8 * (1 - travel))
    g.lineWidth = Math.max(1, l.rpx * 3)
    g.beginPath()
    g.moveTo(b.fromX, b.fromY)
    g.lineTo(hx, hy)
    g.stroke()
    g.fillStyle = STARLIGHT_CORE
    g.beginPath()
    g.arc(hx, hy, Math.max(2, l.cell * 0.1), 0, Math.PI * 2)
    g.fill()
    return
  }

  const bloom = Math.min(1, (t - 0.22) / 0.78)
  const r = l.cell * (0.2 + (0.55 + 0.65 * b.weight) * (1 - Math.pow(1 - bloom, 3)))
  const fade = 1 - bloom
  g.strokeStyle = alpha(tint, (b.cold ? 0.35 : 0.9) * fade)
  g.lineWidth = Math.max(1, l.rpx * (b.cold ? 2 : 3 + 3 * b.weight))
  g.beginPath()
  g.arc(b.toX, b.toY, r, 0, Math.PI * 2)
  g.stroke()
  if (!b.cold) {
    g.fillStyle = alpha(tint, 0.3 * fade * fade)
    g.beginPath()
    g.arc(b.toX, b.toY, r * 0.72, 0, Math.PI * 2)
    g.fill()
    // The link number, once, in the middle of its own bloom.
    if (b.link > 1) {
      g.font = sized(FIGURE_FONT, Math.max(11, l.cell * 0.36))
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillStyle = alpha(BRASS_LIT, fade)
      g.fillText(`×${b.link}`, b.toX, b.toY - l.cell * 0.62)
    }
  }
}
