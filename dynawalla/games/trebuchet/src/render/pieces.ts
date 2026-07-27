/**
 * Everything that stands on the ground, drawn as silhouette + one warm rim.
 * All of this runs inside the world transform (y up, units = metres), so line
 * widths are divided by `s` and text goes through `worldText`.
 */

import { clamp01, easeOutBack, easeOutCubic } from '../core/ease.ts'
import { worldX, type Crater, type Ghost, type Ram, type Tower } from '../sim/world.ts'
import { C, font, worldText } from './theme.ts'

export const PIVOT_X = 0.5
export const PIVOT_Y = 11
export const ARM_L = 7.5
export const CW_L = 2.6
export const RELEASE_DEG = 42
export const ARMED_DEG = 208

export const armTip = (deg: number): { x: number; y: number } => ({
  x: PIVOT_X + ARM_L * Math.cos((deg * Math.PI) / 180),
  y: PIVOT_Y + ARM_L * Math.sin((deg * Math.PI) / 180),
})

/* ---------------------------------------------------------------- ground */

export function drawGround(
  ctx: CanvasRenderingContext2D,
  s: number,
  fieldMax: number,
  craters: Crater[],
  scrub: Float32Array,
): void {
  const x0 = -40
  const x1 = worldX(fieldMax) + 40

  // the plain
  ctx.beginPath()
  ctx.moveTo(x0, -60)
  ctx.lineTo(x0, 0)
  ctx.lineTo(x1, 0)
  ctx.lineTo(x1, -60)
  ctx.closePath()
  ctx.fillStyle = C.ground
  ctx.fill()

  // strata: the earth is not a void, it is rock the siege stands on
  ctx.beginPath()
  for (let i = 1; i <= 5; i++) {
    const y = -i * i * 1.4
    ctx.moveTo(x0, y)
    for (let x = x0; x < x1; x += 14) {
      ctx.lineTo(x + 14, y + Math.sin(x * 0.06 + i) * 0.6)
    }
  }
  ctx.strokeStyle = C.groundLine
  ctx.globalAlpha = 0.055
  ctx.lineWidth = 1.4 / s
  ctx.stroke()
  ctx.globalAlpha = 1

  // craters cut into the lip
  for (const cr of craters) {
    const a = clamp01(1 - cr.age / 26)
    ctx.beginPath()
    ctx.ellipse(cr.x, 0, cr.r, cr.r * 0.42, 0, 0, Math.PI, false)
    ctx.fillStyle = C.groundDeep
    ctx.globalAlpha = 0.55 + a * 0.45
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // the rim of light along the horizon edge
  ctx.beginPath()
  ctx.moveTo(x0, 0)
  for (const cr of craters.slice().sort((p, q) => p.x - q.x)) {
    ctx.lineTo(cr.x - cr.r, 0)
    ctx.lineTo(cr.x, -cr.r * 0.34)
    ctx.lineTo(cr.x + cr.r, 0)
  }
  ctx.lineTo(x1, 0)
  ctx.strokeStyle = C.groundLine
  ctx.lineWidth = 1.6 / s
  ctx.globalAlpha = 0.75
  ctx.stroke()
  ctx.globalAlpha = 1

  // scrub tufts: pre-seeded, one path
  ctx.beginPath()
  for (let i = 0; i < scrub.length; i += 2) {
    const x = scrub[i]
    const hgt = scrub[i + 1]
    ctx.moveTo(x, 0)
    ctx.lineTo(x + hgt * 0.3, hgt)
    ctx.moveTo(x, 0)
    ctx.lineTo(x - hgt * 0.24, hgt * 0.8)
  }
  ctx.strokeStyle = C.scrub
  ctx.lineWidth = 1.4 / s
  ctx.stroke()
}

export function drawMilestones(
  ctx: CanvasRenderingContext2D,
  s: number,
  fieldMax: number,
  emphasis: number,
): void {
  for (let m = 10; m <= fieldMax; m += 10) {
    const x = worldX(m)
    const major = m % 50 === 0
    const h = major ? 2.6 : 1.6
    ctx.beginPath()
    ctx.moveTo(x, -h * 0.55)
    ctx.lineTo(x, h)
    ctx.strokeStyle = C.stoneRim
    ctx.globalAlpha = (major ? 0.7 : 0.4) * (0.45 + emphasis * 0.55)
    ctx.lineWidth = (major ? 2.6 : 1.8) / s
    ctx.stroke()
    ctx.globalAlpha = 1
    worldText(ctx, s, x, -h * 0.75, (c) => {
      c.font = font(major ? 15 : 13, 800)
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.fillStyle = C.bone
      c.globalAlpha = (major ? 0.7 : 0.46) * (0.4 + emphasis * 0.6)
      c.fillText(String(m), 0, 0)
      c.globalAlpha = 1
    })
  }
}

/* ------------------------------------------------------------ trebuchet */

/** A timber the beam is actually made of, not a line. */
function timber(
  ctx: CanvasRenderingContext2D,
  s: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  w2 = w1,
): void {
  const dx = x2 - x1
  const dy = y2 - y1
  const m = Math.hypot(dx, dy) || 1
  const nx = -dy / m
  const ny = dx / m
  ctx.beginPath()
  ctx.moveTo(x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5)
  ctx.lineTo(x2 + nx * w2 * 0.5, y2 + ny * w2 * 0.5)
  ctx.lineTo(x2 - nx * w2 * 0.5, y2 - ny * w2 * 0.5)
  ctx.lineTo(x1 - nx * w1 * 0.5, y1 - ny * w1 * 0.5)
  ctx.closePath()
  ctx.fillStyle = C.stoneLit
  ctx.fill()
  ctx.strokeStyle = C.stoneRim
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.7 / s
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function drawTrebuchet(
  ctx: CanvasRenderingContext2D,
  s: number,
  armDeg: number,
  recoil: number,
  damage: number,
  loaded: boolean,
  boulderR: number,
): void {
  // escarpment (does not recoil — only the machine does)
  ctx.beginPath()
  ctx.moveTo(-40, -40)
  ctx.lineTo(-40, 5.2)
  ctx.lineTo(-8, 5.4)
  ctx.lineTo(2, 5.1)
  ctx.lineTo(7.2, 4.6)
  ctx.lineTo(8.6, 2.2)
  ctx.lineTo(9.4, 0)
  ctx.lineTo(9.4, -40)
  ctx.closePath()
  ctx.fillStyle = C.ground
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-40, 5.2)
  ctx.lineTo(-8, 5.4)
  ctx.lineTo(2, 5.1)
  ctx.lineTo(7.2, 4.6)
  ctx.lineTo(8.6, 2.2)
  ctx.lineTo(9.4, 0)
  ctx.strokeStyle = C.groundLine
  ctx.lineWidth = 1.8 / s
  ctx.globalAlpha = 0.85
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.save()
  ctx.translate(-recoil * 0.7, 0)

  const th = (armDeg * Math.PI) / 180
  const tip = { x: PIVOT_X + ARM_L * Math.cos(th), y: PIVOT_Y + ARM_L * Math.sin(th) }
  const cw = { x: PIVOT_X - CW_L * Math.cos(th), y: PIVOT_Y - CW_L * Math.sin(th) }

  // sledge
  timber(ctx, s, -4.6, 5.3, 5.0, 5.0, 0.62)
  // A-frame + braces + rear stay
  timber(ctx, s, -3.4, 5.3, PIVOT_X, PIVOT_Y, 0.66, 0.42)
  timber(ctx, s, 4.2, 5.05, PIVOT_X, PIVOT_Y, 0.66, 0.42)
  timber(ctx, s, -2.1, 7.7, 2.9, 7.7, 0.34)
  timber(ctx, s, -4.4, 5.4, -1.4, 9.2, 0.3)
  // wheels
  for (const wx of [-3.4, 3.6]) {
    ctx.beginPath()
    ctx.arc(wx, 5.0, 0.8, 0, Math.PI * 2)
    ctx.fillStyle = C.stone
    ctx.fill()
    ctx.strokeStyle = C.stoneRim
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1.6 / s
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // the beam, tapering to the sling end
  timber(ctx, s, cw.x, cw.y, tip.x, tip.y, 0.62, 0.34)

  // counterweight: a slung crate, always hanging plumb
  const linkX = cw.x
  const linkY = cw.y
  timber(ctx, s, linkX, linkY, linkX, linkY - 1.0, 0.16)
  ctx.beginPath()
  ctx.rect(linkX - 1.35, linkY - 3.5, 2.7, 2.5)
  ctx.fillStyle = C.stoneLit
  ctx.fill()
  ctx.strokeStyle = C.stoneRim
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2 / s
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(linkX - 1.35, linkY - 2.3)
  ctx.lineTo(linkX + 1.35, linkY - 2.3)
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 1.4 / s
  ctx.stroke()
  ctx.globalAlpha = 1

  // pivot pin
  ctx.beginPath()
  ctx.arc(PIVOT_X, PIVOT_Y, 0.42, 0, Math.PI * 2)
  ctx.fillStyle = C.stoneRim
  ctx.globalAlpha = 0.8
  ctx.fill()
  ctx.globalAlpha = 1

  // sling + shot: the pouch hangs, and rests on the deck while armed
  if (loaded) {
    const sth = ((armDeg + 52) * Math.PI) / 180
    let bx = tip.x + Math.cos(sth) * 2.6
    let by = tip.y + Math.sin(sth) * 2.6
    if (by < 5.9) {
      by = 5.9
      bx = Math.min(bx, tip.x + 1.6)
    }
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(bx - 0.5, by + 0.3)
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(bx + 0.5, by + 0.3)
    ctx.strokeStyle = C.stoneRim
    ctx.globalAlpha = 0.55
    ctx.lineWidth = 1.6 / s
    ctx.stroke()
    ctx.globalAlpha = 1
    drawBoulder(ctx, bx, by, boulderR, 0.55)
  }

  // battle damage: chips out of the frame
  if (damage > 0.01) {
    ctx.globalAlpha = clamp01(damage)
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const x = -3 + i * 1.7
      ctx.moveTo(x, 5.2)
      ctx.lineTo(x + 0.5, 5.2 + 0.9 * ((i % 3) + 1) * 0.3)
    }
    ctx.strokeStyle = C.danger
    ctx.lineWidth = 2 / s
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

export function drawBoulder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  heat: number,
): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = heat > 0.85 ? C.fire2 : C.stoneLit
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - r * 0.18, y + r * 0.2, r * (heat > 0.85 ? 0.7 : 0.55), 0, Math.PI * 2)
  ctx.fillStyle = heat > 0.85 ? C.fire0 : heat > 0.6 ? C.fire1 : C.stoneRim
  ctx.globalAlpha = 0.25 + heat * 0.72
  ctx.fill()
  ctx.globalAlpha = 1
}

/* ---------------------------------------------------------------- keeps */

export function drawTower(
  ctx: CanvasRenderingContext2D,
  s: number,
  t: Tower,
  showBanner: boolean,
  reveal: boolean,
  time: number,
): void {
  const bx = worldX(t.range)

  // attached blocks, leaning as one body
  ctx.save()
  ctx.translate(bx, 0)
  ctx.rotate(t.lean)
  ctx.beginPath()
  for (const b of t.blocks) {
    if (b.loose) continue
    ctx.rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)
  }
  ctx.fillStyle = C.stone
  ctx.fill()
  // warm rim on the lit (right) side and along every top edge
  ctx.strokeStyle = C.stoneRim
  ctx.lineWidth = 1.5 / s
  ctx.globalAlpha = 0.34 + t.flash * 0.6
  ctx.stroke()
  ctx.globalAlpha = 1

  if (t.damage > 0.02) {
    ctx.beginPath()
    const n = Math.ceil(t.damage * 6)
    for (let i = 0; i < n; i++) {
      const yy = ((i * 3.7) % t.heightM) * 0.9 + 0.6
      const xx = -t.widthM / 2 + ((i * 1.9) % t.widthM)
      ctx.moveTo(xx, yy)
      ctx.lineTo(xx + 0.7, yy + 1.1)
      ctx.lineTo(xx + 0.2, yy + 1.9)
    }
    ctx.strokeStyle = C.danger
    ctx.globalAlpha = 0.35 + t.damage * 0.4
    ctx.lineWidth = 1.6 / s
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  ctx.restore()

  // loose blocks in world space
  if (t.blocks.some((b) => b.loose)) {
    ctx.beginPath()
    for (const b of t.blocks) {
      if (!b.loose) continue
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h)
      ctx.restore()
    }
    ctx.fillStyle = C.stone
    ctx.fill()
    ctx.strokeStyle = C.stoneRim
    ctx.globalAlpha = 0.18
    ctx.lineWidth = 1 / s
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (!t.alive) return

  // banner
  if (showBanner || reveal) {
    const top = t.heightM + 3.4
    const rv = showBanner ? 1 : easeOutCubic(clamp01(t.reveal))
    const sway = Math.sin(time * 1.7 + t.range) * 0.16
    ctx.save()
    ctx.translate(bx, 0)
    ctx.rotate(t.lean)
    ctx.beginPath()
    ctx.moveTo(0, t.heightM - 0.4)
    ctx.lineTo(0, top)
    ctx.strokeStyle = C.stoneRim
    ctx.globalAlpha = 0.4 * rv
    ctx.lineWidth = 1.4 / s
    ctx.stroke()
    ctx.globalAlpha = 1

    const bw = 5.0
    const bh = 3.3
    ctx.beginPath()
    ctx.moveTo(-bw / 2, top)
    ctx.lineTo(bw / 2, top + sway * 0.5)
    ctx.lineTo(bw / 2 + sway, top - bh)
    ctx.lineTo(0, top - bh * 0.78)
    ctx.lineTo(-bw / 2 + sway * 0.4, top - bh)
    ctx.closePath()
    ctx.fillStyle = reveal && !showBanner ? C.bannerWanted : C.banner
    ctx.globalAlpha = 0.92 * rv
    ctx.fill()
    ctx.globalAlpha = 1
    worldText(ctx, s, 0, top - 0.7, (c) => {
      c.font = font(Math.max(13, Math.min(30, s * 2.3)), 900)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = C.bannerInk
      c.globalAlpha = rv
      c.fillText(String(t.value), 0, 0)
      c.globalAlpha = 1
    })
    ctx.restore()
  }
}

/* ------------------------------------------------------------ obstacles */

export function drawWall(ctx: CanvasRenderingContext2D, s: number, x: number, h: number): void {
  const w = 2.4
  ctx.beginPath()
  ctx.moveTo(x - w / 2, 0)
  ctx.lineTo(x - w / 2, h)
  for (let i = 0; i < 4; i++) {
    const xx = x - w / 2 + (i * w) / 4
    ctx.lineTo(xx, h + (i % 2 === 0 ? 0.9 : 0))
    ctx.lineTo(xx + w / 8, h + (i % 2 === 0 ? 0.9 : 0))
  }
  ctx.lineTo(x + w / 2, h)
  ctx.lineTo(x + w / 2, 0)
  ctx.closePath()
  ctx.fillStyle = C.stone
  ctx.fill()
  ctx.strokeStyle = C.stoneCold
  ctx.globalAlpha = 0.45
  ctx.lineWidth = 1.5 / s
  ctx.stroke()
  ctx.globalAlpha = 1
}

export function drawRam(ctx: CanvasRenderingContext2D, s: number, ram: Ram, time: number): void {
  const x = worldX(ram.range)
  const bob = Math.sin(time * 7) * 0.12
  ctx.save()
  ctx.translate(x, bob)
  // hoarding — a big armoured shed, readable at any zoom
  ctx.beginPath()
  ctx.moveTo(-4.6, 1.3)
  ctx.lineTo(-3.4, 6.2)
  ctx.lineTo(3.4, 6.2)
  ctx.lineTo(4.6, 1.3)
  ctx.closePath()
  ctx.fillStyle = C.stone
  ctx.fill()
  ctx.strokeStyle = C.danger
  ctx.globalAlpha = 0.75
  ctx.lineWidth = 2.4 / s
  ctx.stroke()
  ctx.globalAlpha = 1
  // brazier on the roof: the one hot thing on the field that is not yours
  const flicker = 0.7 + Math.sin(time * 13) * 0.3
  ctx.beginPath()
  ctx.arc(0, 6.9, 0.8 * flicker, 0, Math.PI * 2)
  ctx.fillStyle = C.fire1
  ctx.globalAlpha = 0.85
  ctx.fill()
  ctx.globalAlpha = 1
  // the ram head, swinging
  const swing = Math.sin(time * 3.1) * 0.5
  ctx.beginPath()
  ctx.moveTo(-4.2, 3.0 + swing)
  ctx.lineTo(-7.4, 3.0 + swing * 1.6)
  ctx.strokeStyle = C.stoneLit
  ctx.lineWidth = 0.9
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.strokeStyle = C.stoneRim
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 2 / s
  ctx.stroke()
  ctx.globalAlpha = 1
  // wheels
  for (const wx of [-2.6, 2.6]) {
    ctx.beginPath()
    ctx.arc(wx, 1.3, 1.3, 0, Math.PI * 2)
    ctx.fillStyle = C.stoneLit
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(wx, 1.3)
    ctx.lineTo(wx + Math.cos(ram.wheel) * 1.3, 1.3 + Math.sin(ram.wheel) * 1.3)
    ctx.moveTo(wx, 1.3)
    ctx.lineTo(wx - Math.cos(ram.wheel) * 1.3, 1.3 - Math.sin(ram.wheel) * 1.3)
    ctx.strokeStyle = C.danger
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 2 / s
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/* --------------------------------------------------------------- traces */

export function drawGhosts(ctx: CanvasRenderingContext2D, s: number, ghosts: Ghost[]): void {
  ctx.save()
  ctx.setLineDash([0.7 / 1, 1.5 / 1])
  for (const g of ghosts) {
    const a = clamp01(1 - g.age / 14) * 0.5
    if (a <= 0.01) continue
    ctx.beginPath()
    for (let i = 0; i < g.pts.length; i++) {
      const p = g.pts[i]
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    }
    ctx.strokeStyle = g.hit ? C.stoneRim : C.steel
    ctx.globalAlpha = a
    ctx.lineWidth = 1.3 / s
    ctx.stroke()
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

export function drawCraterLabels(ctx: CanvasRenderingContext2D, s: number, craters: Crater[]): void {
  for (const cr of craters) {
    const a = clamp01(1 - cr.age / 12)
    if (a <= 0.02) continue
    const pop = easeOutBack(clamp01(cr.age / 0.28))
    worldText(ctx, s, cr.x, -0.5, (c) => {
      c.font = font(Math.max(11, Math.min(20, s * 1.7)), 800)
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.globalAlpha = a * 0.85
      c.fillStyle = cr.correct ? C.stoneRim : C.steel
      c.save()
      c.scale(pop, pop)
      c.fillText(String(cr.label), 0, 0)
      c.restore()
      c.globalAlpha = 1
    })
  }
}
