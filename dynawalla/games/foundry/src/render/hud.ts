// Everything with a number on it.
//
// There are exactly four: the board, the bar's running total, the two pedals,
// and the belt. That is the whole readable surface, and the constraint is
// deliberate — a child has three referee slaps to read all of it, so anything
// fifth would be something they had to learn to ignore.
//
// The one thing never shown is the answer. The board carries the sum and the
// bar carries what is on it; the number in between is the child's.

import type { Layout } from "./layout.ts"
import {
  BRASS,
  BRASS_DARK,
  BRASS_HI,
  CHALK,
  INK,
  IRON,
  IRON_DARK,
  IRON_EDGE,
  KICKOUT,
  OXIDE,
  heatColor,
  mix,
  stamp,
  withAlpha,
} from "./palette.ts"

/** Rounded rectangle path. Corners are small: this is cast metal, not a card. */
function plate(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + k, y)
  g.lineTo(x + w - k, y)
  g.arcTo(x + w, y, x + w, y + k, k)
  g.lineTo(x + w, y + h - k)
  g.arcTo(x + w, y + h, x + w - k, y + h, k)
  g.lineTo(x + k, y + h)
  g.arcTo(x, y + h, x, y + h - k, k)
  g.lineTo(x, y + k)
  g.arcTo(x, y, x + k, y, k)
  g.closePath()
}

/**
 * The hanging board. Slate in a brass frame, on two chains, carrying the sum
 * the referee is waiting on.
 *
 * `shake` is spent by the caller on a false finish — the board is what was
 * misread, so it is the board that takes the hit.
 */
export function drawBoard(
  g: CanvasRenderingContext2D,
  l: Layout,
  prompt: string,
  shake: number,
  urgency: number,
): void {
  const swingX = Math.sin(shake * 34) * shake * 9
  g.save()
  g.translate(swingX, 0)

  // Chains up into the dark.
  g.strokeStyle = withAlpha(BRASS_DARK, 0.8)
  g.lineWidth = Math.max(1.5, l.unit * 0.08)
  for (const cx of [l.boardX + l.boardW * 0.22, l.boardX + l.boardW * 0.78]) {
    g.beginPath()
    g.moveTo(cx - swingX * 0.6, 0)
    g.lineTo(cx, l.boardY)
    g.stroke()
  }

  g.fillStyle = IRON_DARK
  plate(g, l.boardX, l.boardY, l.boardW, l.boardH, 5)
  g.fill()
  g.strokeStyle = urgency > 0.66 ? mix(BRASS, heatColor(0.6), (urgency - 0.66) / 0.34) : BRASS_DARK
  g.lineWidth = Math.max(2, l.unit * 0.12)
  plate(g, l.boardX, l.boardY, l.boardW, l.boardH, 5)
  g.stroke()

  // The sum. Sized to the board rather than measured against it — the numerals
  // sit on a fixed grid so a four-digit prompt does not reflow after a
  // two-digit one, which is the budget rule in EXPERIENCE_DESIGN.md.
  const chars = Math.max(7, prompt.length)
  const px = Math.min(l.boardH * 0.62, (l.boardW * 1.55) / chars)
  g.font = stamp(px)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = withAlpha(INK, 0.75)
  g.fillText(prompt, l.boardX + l.boardW / 2 + 2, l.boardY + l.boardH / 2 + 2)
  g.fillStyle = CHALK
  g.fillText(prompt, l.boardX + l.boardW / 2, l.boardY + l.boardH / 2)
  g.restore()
}

/**
 * The running total on the bar.
 *
 * Deliberately present. Without it the fall is a memory test rather than a
 * decomposition, and the arithmetic being tested is not "can you keep a tally
 * while a stranger counts at you".
 */
export function drawLoad(
  g: CanvasRenderingContext2D,
  l: Layout,
  load: number,
  fraction: number,
  pulse: number,
): void {
  const u = l.unit
  const y = l.matTop + u * 1.05
  const px = u * (1.7 + pulse * 0.45)
  g.save()
  g.font = stamp(px)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = withAlpha(INK, 0.55)
  g.fillText(String(load), l.cx + 2, y + 3)
  g.fillStyle = fraction >= 1 ? KICKOUT : mix(CHALK, heatColor(Math.min(1, fraction)), fraction * 0.8)
  g.fillText(String(load), l.cx, y)
  g.font = stamp(u * 0.44, 700)
  g.fillStyle = withAlpha(CHALK, 0.42)
  g.fillText("ON THE BAR", l.cx, y + px * 0.72)
  g.restore()
}

export type PedalState = {
  value: number
  /** Seconds since it was last struck; drives the depression and the shine. */
  since: number
}

/**
 * The two pedals.
 *
 * Half the screen each, full width of their half, with a floor of 150px of
 * height in `layout.ts`. They are the only interactive object in the game and
 * the escape is timed, so they are enormous on purpose.
 */
export function drawPedals(
  g: CanvasRenderingContext2D,
  l: Layout,
  light: PedalState,
  heavy: PedalState,
  live: boolean,
): void {
  const gap = Math.max(4, l.w * 0.008)
  const halves: Array<[PedalState, number, number, string]> = [
    [light, 0, l.w / 2 - gap / 2, "LIGHT"],
    [heavy, l.w / 2 + gap / 2, l.w / 2 - gap / 2, "HEAVY"],
  ]
  for (const [p, x, w, label] of halves) {
    const press = Math.max(0, 1 - p.since / 0.14)
    const drop = press * Math.min(9, l.padH * 0.05)
    const y = l.padTop + drop
    const h = l.padH - drop

    // The socket the pedal sits in.
    g.fillStyle = IRON_DARK
    g.fillRect(x, l.padTop, w, l.padH)

    const grad = g.createLinearGradient(0, y, 0, y + h)
    grad.addColorStop(0, live ? IRON_EDGE : "#26262e")
    grad.addColorStop(0.5, IRON)
    grad.addColorStop(1, IRON_DARK)
    g.fillStyle = grad
    plate(g, x + 3, y, w - 6, h - 6, 6)
    g.fill()

    // A brass wear-strip along the top edge, brighter the more recently struck.
    g.fillStyle = press > 0.05 ? mix(BRASS, BRASS_HI, press) : withAlpha(BRASS_DARK, live ? 0.85 : 0.4)
    g.fillRect(x + 3, y, w - 6, Math.max(3, l.unit * 0.16))

    const px = Math.min(h * 0.5, (w * 1.25) / Math.max(2, String(p.value).length))
    g.save()
    g.font = stamp(px)
    g.textAlign = "center"
    g.textBaseline = "middle"
    const cx = x + w / 2
    const cy = y + h * 0.46
    g.fillStyle = withAlpha(INK, 0.7)
    g.fillText(String(p.value), cx + 2, cy + 3)
    g.fillStyle = live ? mix(BRASS_HI, "#ffffff", press * 0.6) : withAlpha(BRASS_DARK, 0.7)
    g.fillText(String(p.value), cx, cy)
    g.font = stamp(Math.max(9, l.unit * 0.34), 700)
    g.fillStyle = withAlpha(CHALK, live ? 0.3 : 0.14)
    g.fillText(label, cx, y + h * 0.86)
    g.restore()
  }
}

/**
 * The belt.
 *
 * One plate cast onto it per escape, and nothing ever takes one off — the
 * child-safe version of loss aversion from `EXPERIENCE_DESIGN.md`. It is the
 * construction: the reason to come back is "my belt is nine plates long", never
 * "my streak is at risk".
 */
export function drawBelt(
  g: CanvasRenderingContext2D,
  l: Layout,
  plates: number,
  beaten: number,
  freshMs: number,
): void {
  const h = l.beltH
  const y = l.beltY
  const shown = Math.min(plates, Math.max(6, Math.floor(l.w / (h * 0.72))))
  const pw = h * 0.5
  const total = shown * (pw + 3)
  const x0 = l.cx - total / 2

  g.save()
  // The strap.
  g.fillStyle = withAlpha(IRON_DARK, 0.85)
  plate(g, x0 - 8, y + h * 0.22, total + 16, h * 0.56, 3)
  g.fill()

  for (let i = 0; i < shown; i++) {
    const x = x0 + i * (pw + 3)
    // The newest plate is still cooling.
    const fresh = i === shown - 1 ? Math.max(0, 1 - freshMs / 900) : 0
    g.fillStyle = fresh > 0 ? heatColor(fresh) : BRASS
    g.fillRect(x, y + h * 0.24, pw, h * 0.52)
    g.fillStyle = withAlpha(BRASS_HI, 0.5)
    g.fillRect(x, y + h * 0.24, pw, h * 0.12)
  }

  g.font = stamp(Math.max(10, h * 0.4), 700)
  g.textBaseline = "middle"
  g.textAlign = "left"
  g.fillStyle = withAlpha(CHALK, 0.5)
  g.fillText(`${plates}`, x0 + total + 14, y + h * 0.5)
  if (beaten > 0) {
    g.textAlign = "right"
    g.fillStyle = withAlpha(BRASS_HI, 0.72)
    g.fillText(`${beaten}★`, x0 - 16, y + h * 0.5)
  }
  g.restore()
}

/** A short, loud line over the ring. One at a time, never queued. */
export type Banner = {
  text: string
  sub: string
  life: number
  maxLife: number
  color: string
}

export function drawBanner(g: CanvasRenderingContext2D, l: Layout, b: Banner): void {
  const t = b.life / b.maxLife
  const rise = (1 - t) * l.unit * 0.9
  const a = Math.min(1, t * 2.6)
  g.save()
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.font = stamp(l.unit * 1.4)
  g.fillStyle = withAlpha(INK, a * 0.5)
  g.fillText(b.text, l.cx + 2, l.cy - l.unit * 2.4 - rise + 3)
  g.fillStyle = withAlpha(b.color, a)
  g.fillText(b.text, l.cx, l.cy - l.unit * 2.4 - rise)
  if (b.sub) {
    g.font = stamp(l.unit * 0.52, 700)
    g.fillStyle = withAlpha(CHALK, a * 0.6)
    g.fillText(b.sub, l.cx, l.cy - l.unit * 1.5 - rise)
  }
  g.restore()
}

/**
 * The count, as a bar of three segments across the top of the mat.
 *
 * Not a ring and not a shrinking wedge: three discrete slaps, because that is
 * what the referee is actually doing and a continuous drain would be a timer
 * pretending to be drama.
 */
export function drawCount(
  g: CanvasRenderingContext2D,
  l: Layout,
  fraction: number,
  slaps: number,
  live: boolean,
): void {
  const w = Math.min(l.w * 0.62, l.unit * 12)
  const x0 = l.cx - w / 2
  const y = l.matTop - Math.max(7, l.unit * 0.5)
  const h = Math.max(4, l.unit * 0.2)
  const seg = (w - 8) / 3
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * (seg + 4)
    g.fillStyle = withAlpha(IRON_DARK, 0.8)
    g.fillRect(x, y, seg, h)
    if (!live) continue
    const local = Math.max(0, Math.min(1, fraction * 3 - i))
    if (local <= 0) continue
    g.fillStyle = i < slaps ? OXIDE : mix(BRASS, OXIDE, local)
    g.fillRect(x, y, seg * local, h)
  }
}
