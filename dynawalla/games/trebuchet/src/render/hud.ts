/**
 * The HUD is numerals and glyphs — no words at all. Two reasons: a word costs five
 * translations and a child reading a label is a child not watching the arc. The
 * whole interface is: the equation you were handed, the number you are dialling,
 * and the wind trying to spoil it.
 *
 * **Everything here is laid out from the SAFE rectangle, never from `w`/`h`.**
 * The pack declares `viewport-fit=cover`, which opts the document into the notch,
 * the home indicator and the rounded corners — and this HUD is drawn on canvas,
 * where `env()` cannot be reached. So the safe rect arrives as a REQUIRED argument
 * to `hudLayout`: a caller that forgets it does not compile, instead of shipping a
 * fire button under the home indicator and finding out on a device.
 *
 * The sky, the ground, the keeps, the craters and the smoke keep bleeding to the
 * glass edges — that is what `cover` is FOR. Only what a child must read or touch
 * comes inside the rect.
 *
 * **The host's two corners.** The host paints an exit control top-left and a
 * how-to-play control top-right, 44px each, floating OVER the game; it reserves no
 * band. The equation plaque is centred and as wide as the question makes it, so at
 * 320px it reaches both of them — and the equation IS the question; a child who
 * cannot read it cannot play. Where there is width to spare between the corners
 * the plaque fits between them and the pinned stack stays where it was drawn;
 * where there is not, the whole stack starts underneath them instead. See `roomy`
 * in `hudLayout`.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Rect,
} from '../../../../packs/shared/game-chrome/index.ts'
import { clamp, clamp01, easeOutBack, easeOutCubic, easeOutExpo } from '../core/ease.ts'
import { C, font, roundRect } from './theme.ts'

export type Btn = { x: number; y: number; w: number; h: number; id: string }

/**
 * Every fixed measurement the HUD has, derived once per resize.
 *
 * One value, computed in one place, used by the renderer AND the hit test, so a
 * tap can never land somewhere the eye disagrees with — and asserted in
 * `layout.test.ts` at every viewport the fleet has.
 */
export type HudLayout = {
  w: number
  h: number
  /** css pixels of the shortest sensible touch target */
  unit: number
  /** the rect inside the notch and the home indicator */
  area: Rect
  /** the first y a full-width readout may use: clear of the host's 44px corners */
  topClear: number
  /** the widest the equation plaque may ever be, at the y it sits at */
  plaqueMax: Rect
  /** top edge of the ammunition rack row */
  rackTop: number
  /** height of one rack slot */
  rackH: number
  /** centre line of the wind chip */
  windY: number
  /** middle of the wave counter and the score */
  readoutY: number
  /** the wave counter, with its pips */
  wave: Rect
  /** the score, with room for the combo line under it */
  score: Rect
  /** the bottom of the pinned top stack — the camera frames the field under it */
  stackBottom: number
  /** how far the stack had to drop to clear the corners; the camera pays it back */
  stackShift: number
  buttons: Btn[]
}

/** The HUD's scale unit. The game's camera pads itself with this too. */
export function hudUnit(w: number, h: number): number {
  return clamp(Math.min(w, h) * 0.115, 42, 82)
}

const eqSizeFor = (unit: number, area: Rect): number =>
  Math.round(Math.min(unit * 1.15, area.w * 0.09))

/**
 * The whole HUD, measured from the safe rect.
 *
 * `area` is required on purpose — see the file header.
 */
export function hudLayout(w: number, h: number, area: Rect, loftUnlocked: boolean): HudLayout {
  const unit = hudUnit(w, h)
  const pad = Math.round(unit * 0.4)
  const right = area.x + area.w
  const bottom = area.y + area.h

  // Under the host's exit / how-to-play squares, plus a hair of daylight.
  const topClear =
    area.y + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + Math.round(unit * 0.16)

  const eqSize = eqSizeFor(unit, area)
  const ph = eqSize * 1.62
  // How much clear width there is BETWEEN the host's two corners.
  const corner = HOST_MARGIN + HOST_CONTROL
  const band = area.w - corner * 2
  // A tablet or a phone held sideways has width to spare: the equation fits
  // between the two corners with room around it, so the stack stays at the top
  // where it was designed to be and the camera keeps all its headroom. A phone
  // held upright does not — a sum on a 320px screen needs the whole width — so
  // there the stack starts under the corners instead. Either way the plaque is
  // clear of them; only the price differs, and this pays the cheaper one.
  const roomy = band >= eqSize * 9
  const restY = area.y + Math.round(unit * 0.32)
  const plaqueY = roomy ? restY : topClear
  const stackShift = plaqueY - restY
  const plaqueW = Math.max(0, roomy ? band - 8 : area.w - pad * 2)
  const plaqueMax: Rect = { x: area.x + (area.w - plaqueW) / 2, y: plaqueY, w: plaqueW, h: ph }

  const rackH = Math.round(unit * 0.5)
  const rowCentre = plaqueY + ph + rackH * 0.9
  const rackTop = rowCentre - rackH / 2
  const windY = rowCentre + rackH * 1.15
  const readoutY = plaqueY + Math.round(unit * 0.23)
  const stackBottom = windY + unit * 0.3

  // The wave counter and the score ride the top corners of the plaque's row, so
  // when the stack is at the top they have to step INSIDE the host's squares.
  const cs = Math.round(unit * 0.44)
  const edge = roomy ? corner + 6 : Math.round(unit * 0.42)
  const wave: Rect = {
    x: area.x + edge,
    y: readoutY - cs * 0.7,
    // twelve pips at 5px is the widest the counter ever gets
    w: Math.max(cs * 2.6, 64),
    h: cs * 1.9,
  }
  const scoreRight = area.x + area.w - (roomy ? corner + 6 : Math.round(unit * 0.5))
  const score: Rect = {
    x: scoreRight - cs * 3.4,
    y: readoutY - cs * 0.7,
    w: cs * 3.4,
    h: cs * 2.4,
  }

  // Controls. Fire and its steppers ride the bottom-right corner of the SAFE
  // rect; the loft lever the bottom-left. Mute used to sit top-right, directly
  // under the host's how-to-play button — it moves to the bottom-left, beside
  // the lever when there is one, where nothing floats over it.
  const fire = Math.round(unit * 1.6)
  const small = Math.round(unit * 0.72)
  const gap = Math.round(fire - small * 2)
  const by = bottom - pad - fire
  const bx = right - pad - fire
  const mute = Math.round(small * 0.8)
  const lw = Math.round(unit * 0.95)
  const lh = Math.round(unit * 2.6)
  // A full pad between the lever and mute: the lever is tall and a child
  // grabbing the bottom of it must not silence the game by accident.
  const muteX = area.x + pad + (loftUnlocked ? lw + pad : 0)
  const buttons: Btn[] = [
    { id: 'fire', x: bx, y: by, w: fire, h: fire },
    { id: 'plus', x: bx - Math.round(pad * 0.6) - small, y: by, w: small, h: small },
    { id: 'minus', x: bx - Math.round(pad * 0.6) - small, y: by + small + gap, w: small, h: small },
    { id: 'mute', x: muteX, y: bottom - pad - mute, w: mute, h: mute },
  ]
  if (loftUnlocked) buttons.push({ id: 'loft', x: area.x + pad, y: bottom - pad - lh, w: lw, h: lh })

  return {
    w,
    h,
    unit,
    area,
    topClear,
    plaqueMax,
    rackTop,
    rackH,
    windY,
    readoutY,
    wave,
    score,
    stackBottom,
    stackShift,
    buttons,
  }
}

/**
 * Where the dialled number is allowed to land on the glass.
 *
 * The numeral rides the aim marker out in the world, so the CAMERA decides where
 * it goes — and the camera knows nothing about the notch or the host's corners.
 * The world hands over an anchor; this decides where the numeral may actually sit.
 * It is the one number the whole game is about, so it is never allowed off the
 * safe rect and never allowed under the chrome, whatever the camera is doing.
 */
export function dialNumeralBox(
  anchorX: number,
  baselineY: number,
  s: number,
  digits: number,
  layout: HudLayout,
): { x: number; y: number; w: number; h: number; size: number; cx: number; baseline: number } {
  const { area } = layout
  const size = Math.max(20, Math.min(46, s * 3.4))
  // 0.62em per digit is the advance of a heavy sans numeral; 8px is the dark
  // stroke drawn around it.
  const bw = Math.min(area.w, size * 0.62 * Math.max(1, digits) + 8)
  const bh = size * 1.12
  const pad = Math.round(layout.unit * 0.2)
  const cx = clamp(anchorX, area.x + bw / 2, area.x + area.w - bw / 2)
  const floor = Math.min(layout.topClear + bh, area.y + area.h)
  const ceil = Math.max(floor, area.y + area.h - pad)
  const baseline = clamp(baselineY, floor, ceil)
  return { x: cx - bw / 2, y: baseline - bh, w: bw, h: bh, size, cx, baseline }
}

export type HudState = {
  layout: HudLayout
  equation: string
  rack: string[]
  rackActive: number
  wave: number
  score: number
  scorePop: number
  combo: number
  wind: number
  showWind: boolean
  loftUnlocked: boolean
  loftIndex: number
  loftCount: number
  muted: boolean
  /** 0..1 intro banner progress */
  introT: number
  /** 0..1 wave-clear card progress, -1 when not showing */
  clearT: number
  clearHits: number
  clearOf: number
  /** the pop animation on the dial numeral */
  dialPop: number
  canFire: boolean
}

export function drawHud(ctx: CanvasRenderingContext2D, st: HudState, btns: Btn[], time: number): void {
  const { unit, area } = st.layout
  ctx.save()
  ctx.textBaseline = 'middle'

  /* ---- the equation: the most legible thing on the screen ---- */
  const intro = easeOutExpo(clamp01(st.introT))
  const maxW = st.layout.plaqueMax.w
  let eqSize = eqSizeFor(unit, area)
  ctx.font = font(eqSize, 900)
  let mw = ctx.measureText(st.equation).width
  // A long question used to run off both edges of a 320px phone. Shrink to fit
  // the safe width instead — the sum has to be readable more than it has to be big.
  if (mw + eqSize * 1.6 > maxW && mw > 0) {
    eqSize = Math.max(11, Math.floor((eqSize * maxW) / (mw + eqSize * 1.6)))
    ctx.font = font(eqSize, 900)
    mw = ctx.measureText(st.equation).width
  }
  const pw = Math.min(maxW, Math.max(mw + eqSize * 1.6, eqSize * 5.4))
  const ph = eqSize * 1.62
  const px = area.x + (area.w - pw) / 2
  const py = st.layout.plaqueMax.y + (1 - intro) * -60
  ctx.globalAlpha = intro
  roundRect(ctx, px, py, pw, ph, 6)
  ctx.fillStyle = 'rgba(6,8,18,0.62)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(242,233,213,0.16)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = C.bone
  ctx.textAlign = 'center'
  ctx.fillText(st.equation, area.x + area.w / 2, py + ph / 2 + 1)
  ctx.globalAlpha = 1

  /* ---- the rack: every boulder left, and what is written on it ---- */
  const slots = rackLayout(st)
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    const active = i === st.rackActive
    ctx.globalAlpha = intro * (active ? 1 : 0.62)
    roundRect(ctx, s.x, s.y, s.w, s.h, 5)
    ctx.fillStyle = active ? 'rgba(255,138,50,0.16)' : 'rgba(8,11,24,0.5)'
    ctx.fill()
    ctx.strokeStyle = active ? C.fire1 : 'rgba(242,233,213,0.18)'
    ctx.lineWidth = active ? 2 : 1
    ctx.stroke()
    // the stone itself, so the row reads as ammunition and not as a tab bar
    ctx.beginPath()
    ctx.arc(s.x + s.h * 0.5, s.y + s.h / 2, s.h * (active ? 0.26 : 0.2), 0, Math.PI * 2)
    ctx.fillStyle = active ? C.fire1 : C.boneDim
    ctx.fill()
    ctx.font = font(Math.round(s.h * 0.46), 800)
    ctx.textAlign = 'left'
    ctx.fillStyle = active ? C.bone : C.boneDim
    ctx.fillText(st.rack[i], s.x + s.h * 0.9, s.y + s.h / 2 + 1)
  }
  ctx.globalAlpha = 1
  void time

  /* ---- wind ---- */
  if (st.showWind) {
    const wy = st.layout.windY
    const s = Math.round(unit * 0.5)
    ctx.font = font(s, 900)
    const txt = (st.wind > 0 ? '+' : '') + String(st.wind)
    const tw = ctx.measureText(txt).width
    const aw = s * 1.5
    const cx = area.x + area.w / 2
    ctx.globalAlpha = intro
    // the arrow: direction is shape, not colour
    const dir = Math.sign(st.wind) || 1
    const ax = cx - (tw + aw) / 2
    ctx.beginPath()
    ctx.moveTo(ax, wy)
    ctx.lineTo(ax + aw * dir, wy)
    ctx.moveTo(ax + aw * dir, wy)
    ctx.lineTo(ax + (aw - s * 0.4) * dir, wy - s * 0.25)
    ctx.moveTo(ax + aw * dir, wy)
    ctx.lineTo(ax + (aw - s * 0.4) * dir, wy + s * 0.25)
    ctx.strokeStyle = C.windChip
    ctx.lineWidth = Math.max(2, s * 0.12)
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.fillStyle = C.windChip
    ctx.textAlign = 'left'
    ctx.fillText(txt, ax + aw + s * 0.35, wy)
    ctx.globalAlpha = 1
  }

  /* ---- wave + score, small, out of the way ---- */
  const cs = Math.round(unit * 0.44)
  const wx = st.layout.wave.x
  const ry2 = st.layout.readoutY
  ctx.font = font(cs, 800)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.boneDim
  ctx.fillText(String(st.wave), wx, ry2)
  // wave pips
  for (let i = 0; i < Math.min(st.wave, 12); i++) {
    ctx.fillRect(wx + i * 5, ry2 + cs * 0.7, 3, 3)
  }
  ctx.textAlign = 'right'
  const pop = 1 + easeOutBack(clamp01(st.scorePop)) * (1 - clamp01(st.scorePop)) * 0.5
  ctx.save()
  const sx = st.layout.score.x + st.layout.score.w
  const sy = ry2
  ctx.translate(sx, sy)
  ctx.scale(pop, pop)
  ctx.fillStyle = st.combo > 1 ? C.fire1 : C.boneDim
  ctx.font = font(cs, 900)
  ctx.fillText(String(st.score), 0, 0)
  ctx.restore()
  if (st.combo > 1) {
    ctx.font = font(cs * 0.8, 900)
    ctx.fillStyle = C.fire1
    ctx.fillText('×' + st.combo, sx, sy + cs * 1.1)
  }

  /* ---- controls ---- */
  for (const b of btns) {
    if (b.id === 'fire') drawFire(ctx, b, st.canFire, time)
    else if (b.id === 'minus') drawStep(ctx, b, '−')
    else if (b.id === 'plus') drawStep(ctx, b, '+')
    else if (b.id === 'mute') drawMute(ctx, b, st.muted)
    else if (b.id === 'loft') drawLoft(ctx, b, st.loftIndex, st.loftCount)
  }

  /* ---- wave clear card ---- */
  if (st.clearT >= 0) {
    const k = easeOutCubic(clamp01(st.clearT))
    const a = st.clearT > 0.75 ? 1 - (st.clearT - 0.75) / 0.25 : 1
    ctx.globalAlpha = clamp01(a)
    const cw = Math.min(area.w * 0.5, unit * 4.4)
    const chh = unit * 1.9
    const cx = area.x + (area.w - cw) / 2
    const cy = Math.max(st.layout.topClear, area.y + area.h * 0.34) + (1 - k) * 40
    roundRect(ctx, cx, cy, cw, chh, 8)
    ctx.fillStyle = 'rgba(6,8,18,0.78)'
    ctx.fill()
    ctx.strokeStyle = st.clearHits === st.clearOf ? C.fire1 : 'rgba(242,233,213,0.2)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = st.clearHits === st.clearOf ? C.fire1 : C.bone
    ctx.font = font(Math.round(unit * 1.15), 900)
    ctx.fillText(`${st.clearHits}/${st.clearOf}`, area.x + area.w / 2, cy + chh * 0.5)
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

function drawFire(ctx: CanvasRenderingContext2D, b: Btn, active: boolean, time: number): void {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const pulse = active ? 1 + Math.sin(time * 3.4) * 0.02 : 1
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(pulse, pulse)
  roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, b.w * 0.24)
  ctx.fillStyle = active ? 'rgba(255,95,24,0.20)' : 'rgba(120,120,140,0.10)'
  ctx.fill()
  ctx.strokeStyle = active ? C.fire2 : 'rgba(242,233,213,0.22)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  // a launch arc with an arrowhead — no word needed
  const r = b.w * 0.3
  ctx.beginPath()
  ctx.arc(0, r * 0.7, r, Math.PI * 1.06, Math.PI * 1.94)
  ctx.strokeStyle = active ? C.fire1 : 'rgba(242,233,213,0.3)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.stroke()
  const ex = Math.cos(Math.PI * 1.94) * r
  const ey = r * 0.7 + Math.sin(Math.PI * 1.94) * r
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - r * 0.36, ey - r * 0.1)
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - r * 0.1, ey + r * 0.36)
  ctx.stroke()
  ctx.restore()
}

function drawStep(ctx: CanvasRenderingContext2D, b: Btn, glyph: string): void {
  roundRect(ctx, b.x, b.y, b.w, b.h, b.w * 0.26)
  ctx.fillStyle = 'rgba(10,14,28,0.5)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(143,227,255,0.3)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = C.steel
  ctx.font = font(Math.round(b.h * 0.52), 900)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, b.x + b.w / 2, b.y + b.h / 2 + 1)
}

function drawMute(ctx: CanvasRenderingContext2D, b: Btn, muted: boolean): void {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const r = b.w * 0.22
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = C.bone
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx - r, cy - r * 0.45)
  ctx.lineTo(cx - r * 0.4, cy - r * 0.45)
  ctx.lineTo(cx + r * 0.2, cy - r)
  ctx.lineTo(cx + r * 0.2, cy + r)
  ctx.lineTo(cx - r * 0.4, cy + r * 0.45)
  ctx.lineTo(cx - r, cy + r * 0.45)
  ctx.closePath()
  ctx.stroke()
  if (muted) {
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.5, cy - r * 0.6)
    ctx.lineTo(cx + r * 1.2, cy + r * 0.6)
    ctx.moveTo(cx + r * 1.2, cy - r * 0.6)
    ctx.lineTo(cx + r * 0.5, cy + r * 0.6)
    ctx.stroke()
  } else {
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath()
      ctx.arc(cx + r * 0.3, cy, r * (0.5 + i * 0.4), -0.9, 0.9)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawLoft(ctx: CanvasRenderingContext2D, b: Btn, idx: number, count: number): void {
  roundRect(ctx, b.x, b.y, b.w, b.h, b.w * 0.24)
  ctx.fillStyle = 'rgba(10,14,28,0.42)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(143,227,255,0.22)'
  ctx.lineWidth = 2
  ctx.stroke()
  const n = count
  const cell = b.h / n
  for (let i = 0; i < n; i++) {
    // bottom = flat, top = lofted; the notch shape says which is which
    const y = b.y + b.h - (i + 0.5) * cell
    const on = i === idx
    const wdt = b.w * (0.22 + (i / (n - 1)) * 0.42)
    ctx.beginPath()
    ctx.moveTo(b.x + b.w / 2 - wdt / 2, y)
    ctx.lineTo(b.x + b.w / 2 + wdt / 2, y)
    ctx.strokeStyle = on ? C.steel : 'rgba(143,227,255,0.28)'
    ctx.lineWidth = on ? 4 : 2
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  const y = b.y + b.h - (idx + 0.5) * cell
  ctx.beginPath()
  ctx.arc(b.x + b.w / 2, y, b.w * 0.16, 0, Math.PI * 2)
  ctx.fillStyle = C.steel
  ctx.fill()
}

/**
 * Where each boulder in the rack sits. One function, used by both the renderer and
 * the hit test, so a tap can never land somewhere the eye disagrees with.
 *
 * The row is sized from the slot height, and if five multi-digit sums do not fit
 * the safe width — five is a normal wave, and `347 + 268` is a normal question —
 * the whole row scales down until they do. A stone half off the glass is one a
 * child can neither read nor load.
 */
export function rackLayout(st: HudState): Array<{ x: number; y: number; w: number; h: number }> {
  const { area } = st.layout
  const pad = Math.round(st.layout.unit * 0.4)
  const room = Math.max(1, area.w - pad * 2)
  const row = (h: number): { widths: number[]; gap: number; total: number } => {
    const gap = Math.round(h * 0.28)
    const widths = st.rack.map((t) => Math.round(h * 0.9 + t.length * h * 0.27 + h * 0.35))
    const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, st.rack.length - 1) * gap
    return { widths, gap, total }
  }
  let h = st.layout.rackH
  let laid = row(h)
  if (laid.total > room) {
    h = Math.max(10, Math.floor(h * (room / laid.total)))
    laid = row(h)
  }
  // The row keeps its centre line whatever height it ended up at.
  const y = st.layout.rackTop + (st.layout.rackH - h) / 2
  let x = area.x + (area.w - laid.total) / 2
  return laid.widths.map((wd) => {
    const slot = { x, y, w: wd, h }
    x += wd + laid.gap
    return slot
  })
}

export function hitBtn(btns: Btn[], x: number, y: number, slop = 6): Btn | null {
  for (const b of btns) {
    if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return b
  }
  return null
}
