/**
 * The HUD is numerals and glyphs — no words at all. Two reasons: a word costs five
 * translations and a child reading a label is a child not watching the arc. The
 * whole interface is: the equation you were handed, the number you are dialling,
 * and the wind trying to spoil it.
 */

import { clamp01, easeOutBack, easeOutCubic, easeOutExpo } from '../core/ease.ts'
import { C, font, roundRect } from './theme.ts'

export type Btn = { x: number; y: number; w: number; h: number; id: string }

export type HudState = {
  w: number
  h: number
  /** css pixels of the shortest sensible touch target */
  unit: number
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

export function hudButtons(w: number, h: number, unit: number, loftUnlocked: boolean): Btn[] {
  const pad = Math.round(unit * 0.4)
  const fire = Math.round(unit * 1.6)
  const small = Math.round(unit * 0.72)
  const gap = Math.round(fire - small * 2)
  const by = h - pad - fire
  const bx = w - pad - fire
  const btns: Btn[] = [
    { id: 'fire', x: bx, y: by, w: fire, h: fire },
    { id: 'plus', x: bx - Math.round(pad * 0.6) - small, y: by, w: small, h: small },
    { id: 'minus', x: bx - Math.round(pad * 0.6) - small, y: by + small + gap, w: small, h: small },
    { id: 'mute', x: w - pad - small * 0.8, y: pad * 0.6, w: small * 0.8, h: small * 0.8 },
  ]
  if (loftUnlocked) {
    const lw = Math.round(unit * 0.95)
    const lh = Math.round(unit * 2.6)
    btns.push({ id: 'loft', x: pad, y: h - pad - lh, w: lw, h: lh })
  }
  return btns
}

export function drawHud(ctx: CanvasRenderingContext2D, st: HudState, btns: Btn[], time: number): void {
  const { w, h, unit } = st
  ctx.save()
  ctx.textBaseline = 'middle'

  /* ---- the equation: the most legible thing on the screen ---- */
  const eqSize = Math.round(Math.min(unit * 1.15, w * 0.09))
  const intro = easeOutExpo(clamp01(st.introT))
  const plaqueW = Math.max(ctx.measureText(st.equation).width, eqSize * 5.4)
  ctx.font = font(eqSize, 900)
  const mw = ctx.measureText(st.equation).width
  const pw = Math.max(mw + eqSize * 1.6, plaqueW)
  const ph = eqSize * 1.62
  const px = (w - pw) / 2
  const py = Math.round(unit * 0.32) + (1 - intro) * -60
  ctx.globalAlpha = intro
  roundRect(ctx, px, py, pw, ph, 6)
  ctx.fillStyle = 'rgba(6,8,18,0.62)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(242,233,213,0.16)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = C.bone
  ctx.textAlign = 'center'
  ctx.fillText(st.equation, w / 2, py + ph / 2 + 1)
  ctx.globalAlpha = 1

  /* ---- the rack: every boulder left, and what is written on it ---- */
  const slots = rackLayout(st)
  const rowH = slots.length ? slots[0].h : Math.round(unit * 0.5)
  const ry = py + ph + rowH * 0.9
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
    const wy = ry + rowH * 1.15
    const s = Math.round(unit * 0.5)
    ctx.font = font(s, 900)
    const txt = (st.wind > 0 ? '+' : '') + String(st.wind)
    const tw = ctx.measureText(txt).width
    const aw = s * 1.5
    const cx = w / 2
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
  ctx.font = font(cs, 800)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.boneDim
  ctx.fillText(String(st.wave), Math.round(unit * 0.42), Math.round(unit * 0.55))
  // wave pips
  for (let i = 0; i < Math.min(st.wave, 12); i++) {
    ctx.fillRect(Math.round(unit * 0.42) + i * 5, Math.round(unit * 0.55) + cs * 0.7, 3, 3)
  }
  ctx.textAlign = 'right'
  const pop = 1 + easeOutBack(clamp01(st.scorePop)) * (1 - clamp01(st.scorePop)) * 0.5
  ctx.save()
  const sx = w - Math.round(unit * 1.5)
  const sy = Math.round(unit * 0.55)
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
    const cw = Math.min(w * 0.5, unit * 4.4)
    const chh = unit * 1.9
    const cx = (w - cw) / 2
    const cy = h * 0.34 + (1 - k) * 40
    roundRect(ctx, cx, cy, cw, chh, 8)
    ctx.fillStyle = 'rgba(6,8,18,0.78)'
    ctx.fill()
    ctx.strokeStyle = st.clearHits === st.clearOf ? C.fire1 : 'rgba(242,233,213,0.2)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = st.clearHits === st.clearOf ? C.fire1 : C.bone
    ctx.font = font(Math.round(unit * 1.15), 900)
    ctx.fillText(`${st.clearHits}/${st.clearOf}`, w / 2, cy + chh * 0.5)
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
 */
export function rackLayout(st: HudState): Array<{ x: number; y: number; w: number; h: number }> {
  const { w, unit } = st
  const eqSize = Math.round(Math.min(unit * 1.15, w * 0.09))
  const ph = eqSize * 1.62
  const py = Math.round(unit * 0.32)
  const h = Math.round(unit * 0.5)
  const gap = Math.round(h * 0.28)
  const widths = st.rack.map((t) => Math.round(h * 0.9 + t.length * h * 0.27 + h * 0.35))
  const total = widths.reduce((a, b) => a + b, 0) + Math.max(0, st.rack.length - 1) * gap
  let x = (w - total) / 2
  const y = py + ph + h * 0.9 - h / 2
  return widths.map((wd) => {
    const slot = { x, y, w: wd, h }
    x += wd + gap
    return slot
  })
}

export function hitBtn(btns: Btn[], x: number, y: number, slop = 6): Btn | null {
  for (const b of btns) {
    if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop) return b
  }
  return null
}
