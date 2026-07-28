// The ring, the two wrestlers and the referee.
//
// Everything here is drawn from primitives — cast-iron posts, brass
// turnbuckles, a canvas mat, three sagging ropes, and figures built out of
// tapered limbs. No sprites, no atlas, no image decode on the answer path.
//
// The figures are *cast*, not cartooned: heavy silhouettes with a hot seam
// down them, as though they came out of a mould an hour ago and have not
// finished cooling. That is the one idea holding the art direction together and
// it is why nothing here has a face — a face makes it a mascot, and the hostile
// reference board bans mascots by name.

import type { Decals } from "./decals.ts"
import type { Layout } from "./layout.ts"
import {
  BRASS,
  BRASS_DARK,
  BRASS_HI,
  CANVAS,
  CANVAS_DARK,
  CANVAS_SHADOW,
  IRON,
  IRON_DARK,
  IRON_EDGE,
  REF_CLOTH,
  REF_STRIPE,
  heatColor,
  withAlpha,
} from "./palette.ts"

/** The mat, its decals, and the four posts behind it. Everything else sits on top. */
export function drawMat(g: CanvasRenderingContext2D, l: Layout, decals: Decals, glow: boolean): void {
  // Apron: the skirt below the ropes, in shadow.
  g.fillStyle = IRON_DARK
  g.beginPath()
  g.moveTo(l.matLeftBottom - 10, l.matBottom)
  g.lineTo(l.matRightBottom + 10, l.matBottom)
  g.lineTo(l.matRightBottom + 26, l.matBottom + 26)
  g.lineTo(l.matLeftBottom - 26, l.matBottom + 26)
  g.closePath()
  g.fill()

  const grad = g.createLinearGradient(0, l.matTop, 0, l.matBottom)
  grad.addColorStop(0, CANVAS_DARK)
  grad.addColorStop(0.45, CANVAS)
  grad.addColorStop(1, CANVAS_DARK)
  g.save()
  g.beginPath()
  g.moveTo(l.matLeftTop, l.matTop)
  g.lineTo(l.matRightTop, l.matTop)
  g.lineTo(l.matRightBottom, l.matBottom)
  g.lineTo(l.matLeftBottom, l.matBottom)
  g.closePath()
  g.fillStyle = grad
  g.fill()
  g.clip()

  decals.draw(g, glow)

  // Woven canvas: a coarse cross-hatch that gives the mat a scale. Cheap, and
  // it stops the biggest flat area on screen reading as a gradient panel.
  g.strokeStyle = withAlpha(CANVAS_SHADOW, 0.16)
  g.lineWidth = 1
  const rows = 14
  for (let i = 1; i < rows; i++) {
    const y = l.matTop + ((l.matBottom - l.matTop) * i) / rows
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(l.w, y)
    g.stroke()
  }
  const cols = 12
  for (let i = 1; i < cols; i++) {
    const t = i / cols
    g.beginPath()
    g.moveTo(l.matLeftTop + (l.matRightTop - l.matLeftTop) * t, l.matTop)
    g.lineTo(l.matLeftBottom + (l.matRightBottom - l.matLeftBottom) * t, l.matBottom)
    g.stroke()
  }
  g.restore()
}

/** Posts, ropes and turnbuckles. Drawn after the figures so the near rope crosses them. */
export function drawFrame(
  g: CanvasRenderingContext2D,
  l: Layout,
  detail: number,
  heat: number,
  nearOnly: boolean,
): void {
  const posts: Array<[number, number, number]> = nearOnly
    ? [
        [l.matLeftBottom, l.matBottom, 1],
        [l.matRightBottom, l.matBottom, 1],
      ]
    : [
        [l.matLeftTop, l.matTop, 0.72],
        [l.matRightTop, l.matTop, 0.72],
      ]

  const postH = (l.matBottom - l.matTop) * 0.52
  for (const [px, py, scale] of posts) {
    const ph = postH * scale
    const pw = Math.max(7, l.unit * 0.42 * scale)
    g.fillStyle = IRON
    g.fillRect(px - pw / 2, py - ph, pw, ph)
    g.fillStyle = IRON_EDGE
    g.fillRect(px - pw / 2, py - ph, pw * 0.3, ph)
    // The turnbuckle cap: brass, and the one thing that catches the mat light.
    g.fillStyle = BRASS_DARK
    g.fillRect(px - pw * 0.85, py - ph - pw * 0.55, pw * 1.7, pw * 0.85)
    g.fillStyle = heat > 0.5 ? BRASS_HI : BRASS
    g.fillRect(px - pw * 0.85, py - ph - pw * 0.55, pw * 1.7, pw * 0.3)
  }

  // Three ropes with real sag, resolved at the tier's detail.
  const y0 = nearOnly ? l.matBottom : l.matTop
  const x0 = nearOnly ? l.matLeftBottom : l.matLeftTop
  const x1 = nearOnly ? l.matRightBottom : l.matRightTop
  const scale = nearOnly ? 1 : 0.72
  for (let r = 0; r < 3; r++) {
    const top = y0 - postH * scale * (0.34 + r * 0.24)
    const sag = (nearOnly ? 12 : 7) * (1 - r * 0.18)
    g.strokeStyle = r === 1 ? BRASS : withAlpha(BRASS, 0.86)
    g.lineWidth = Math.max(2, l.unit * 0.11 * scale)
    g.beginPath()
    for (let i = 0; i <= detail; i++) {
      const t = i / detail
      const x = x0 + (x1 - x0) * t
      const y = top + Math.sin(t * Math.PI) * sag
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
}

export type PinPose = {
  /** 0 → flat on the mat, 1 → fully up and out. */
  rise: number
  /** 0..1 how much the challenger is bearing down. */
  press: number
  /** Struggle wobble, in radians. */
  wobble: number
  /** 0..1 of the way through the count — drives the challenger's lean. */
  count: number
}

/** A tapered limb: a quad, not a stroked line, so it has mass. */
function limb(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  g.beginPath()
  g.moveTo(x0 + nx * w0, y0 + ny * w0)
  g.lineTo(x1 + nx * w1, y1 + ny * w1)
  g.lineTo(x1 - nx * w1, y1 - ny * w1)
  g.lineTo(x0 - nx * w0, y0 - ny * w0)
  g.closePath()
  g.fill()
}

/**
 * The two bodies.
 *
 * The player is underneath, on their back, with the leverage bar across their
 * chest — the bar *is* the load meter, so the thing the child is filling is a
 * physical object being pushed off them rather than a progress bar in a corner.
 * The challenger is on top, leaning further in as the count runs.
 */
export function drawGrapple(
  g: CanvasRenderingContext2D,
  l: Layout,
  pose: PinPose,
  loadFraction: number,
  seam: number,
): void {
  const u = l.unit
  const cx = l.cx
  const cy = l.cy + u * 0.5
  const rise = Math.max(0, Math.min(1, pose.rise))

  // ── the player, on their back ──────────────────────────────────────────
  g.save()
  g.translate(cx, cy)
  g.rotate(pose.wobble * 0.05)
  g.fillStyle = IRON
  // Torso lying along the mat, head to the left.
  limb(g, -u * 1.5, -rise * u * 0.9, u * 0.5, -rise * u * 0.35, u * 0.52, u * 0.62)
  // Legs, kicking harder the closer the bar is to lifting.
  const kick = Math.sin(pose.wobble * 6) * 0.3 * (0.4 + loadFraction)
  limb(g, u * 0.4, -rise * u * 0.3, u * 1.7, -rise * u * 0.2 + kick * u, u * 0.4, u * 0.24)
  limb(g, u * 0.4, -rise * u * 0.3, u * 1.8, -rise * u * 0.2 - kick * u, u * 0.4, u * 0.24)
  // Head.
  g.beginPath()
  g.arc(-u * 1.85, -rise * u * 1.05, u * 0.42, 0, Math.PI * 2)
  g.fill()
  // The hot seam: this body came out of a mould and has not cooled.
  g.strokeStyle = withAlpha(heatColor(0.35 + seam * 0.5), 0.5 + seam * 0.5)
  g.lineWidth = Math.max(1.4, u * 0.07)
  g.beginPath()
  g.moveTo(-u * 1.45, -rise * u * 0.9)
  g.lineTo(u * 0.45, -rise * u * 0.35)
  g.stroke()
  g.restore()

  // ── the leverage bar ───────────────────────────────────────────────────
  // It tips up as the load approaches the target: the child sees how close they
  // are as an angle, not as a number they have to read while being counted.
  const barLift = u * (0.35 + loadFraction * 1.5 + rise * 1.4)
  const barTilt = -loadFraction * 0.34 - rise * 0.5
  g.save()
  g.translate(cx - u * 0.4, cy - barLift)
  g.rotate(barTilt)
  const halfBar = u * 2.5
  g.fillStyle = IRON_EDGE
  g.fillRect(-halfBar, -u * 0.14, halfBar * 2, u * 0.28)
  g.fillStyle = withAlpha(heatColor(Math.min(1, loadFraction)), 0.35 + loadFraction * 0.6)
  g.fillRect(-halfBar, -u * 0.14, halfBar * 2 * Math.min(1, loadFraction), u * 0.28)
  // Collars at each end so it reads as a loaded bar and not as a meter.
  g.fillStyle = IRON
  g.fillRect(-halfBar - u * 0.16, -u * 0.3, u * 0.24, u * 0.6)
  g.fillRect(halfBar - u * 0.08, -u * 0.3, u * 0.24, u * 0.6)
  g.restore()

  // ── the challenger, bearing down ───────────────────────────────────────
  const lean = 0.2 + pose.press * 0.5 + pose.count * 0.28
  g.save()
  g.translate(cx + u * 0.6, cy - u * 0.2 - rise * u * 1.2)
  g.rotate(-lean * 0.22)
  g.fillStyle = IRON_DARK
  limb(g, -u * 1.4, -u * 1.6, u * 0.9, -u * 0.6, u * 0.62, u * 0.5)
  limb(g, -u * 1.2, -u * 1.3, -u * 1.6, u * 0.1, u * 0.3, u * 0.22)
  limb(g, -u * 0.7, -u * 1.2, -u * 0.5, u * 0.15, u * 0.3, u * 0.22)
  g.beginPath()
  g.arc(-u * 1.75, -u * 2.0, u * 0.46, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = withAlpha("#5a3a20", 0.7)
  g.lineWidth = Math.max(1.2, u * 0.06)
  g.beginPath()
  g.moveTo(-u * 1.3, -u * 1.55)
  g.lineTo(u * 0.8, -u * 0.65)
  g.stroke()
  g.restore()
}

/**
 * The referee's arm, mid-count.
 *
 * `swing` runs 0 → 1 across a single slap: the hand is up at 0, has hit the mat
 * at about 0.35, and is on its way back after that. It is drawn over the bodies
 * because it is the thing the child's eye must not lose.
 */
export function drawReferee(
  g: CanvasRenderingContext2D,
  l: Layout,
  swing: number,
  slaps: number,
): void {
  const u = l.unit
  const baseX = l.cx - u * 4.2
  const baseY = l.cy + u * 1.6
  const s = Math.max(0, Math.min(1, swing))
  // Fast down, slow up: the hand is only ever hurrying in one direction.
  const drop = s < 0.35 ? (s / 0.35) ** 0.6 : 1 - ((s - 0.35) / 0.65) ** 1.7
  const handX = baseX + u * (1.1 + drop * 1.5)
  const handY = baseY - u * (2.4 - drop * 2.35)

  g.save()
  g.fillStyle = REF_CLOTH
  // Body: a crouched official in stripes.
  limb(g, baseX - u * 0.5, baseY, baseX - u * 0.1, baseY - u * 2.1, u * 0.42, u * 0.4)
  g.beginPath()
  g.arc(baseX - u * 0.05, baseY - u * 2.6, u * 0.38, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = REF_STRIPE
  for (let i = 0; i < 3; i++) {
    g.fillRect(baseX - u * 0.5, baseY - u * (1.85 - i * 0.5), u * 0.85, u * 0.16)
  }
  g.fillStyle = REF_CLOTH
  limb(g, baseX - u * 0.1, baseY - u * 1.9, handX, handY, u * 0.24, u * 0.3)
  g.beginPath()
  g.arc(handX, handY, u * 0.3, 0, Math.PI * 2)
  g.fill()
  g.restore()

  // The count, held up in brass beside the referee. Three marks, filled.
  for (let i = 0; i < 3; i++) {
    const x = baseX - u * 1.5
    const y = baseY - u * 2.6 + i * u * 0.7
    g.fillStyle = i < slaps ? BRASS_HI : withAlpha(BRASS_DARK, 0.55)
    g.fillRect(x, y, u * 0.62, u * 0.16)
  }
}
