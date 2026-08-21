// The room, the fire, and the machine the stations bolt onto.

import { MICRO } from "../core/bigmath.ts"
import { isRevealed } from "../core/economy.ts"
import type { Game } from "../game/types.ts"
import { GLOW_HOT, PAL, chamferRect, glow, plate } from "../render/gfx.ts"
import { clamp01 } from "../render/juice.ts"

// --- backdrop ---------------------------------------------------------------

export function drawBackdrop(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  ctx.fillStyle = PAL.void
  ctx.fillRect(-40, -40, L.w + 80, L.h + 80)

  const heat = clamp01(Number(g.economy.heat / MICRO) / 400)
  const c = L.crucible

  // The room lit by the fire. One radial, redrawn each frame because its
  // intensity tracks heat — cheap at this size, and it is the whole mood.
  const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 3.2)
  rg.addColorStop(0, `rgba(120,44,10,${0.5 + heat * 0.35})`)
  rg.addColorStop(0.35, `rgba(58,20,8,${0.28 + heat * 0.18})`)
  rg.addColorStop(1, "rgba(6,4,8,0)")
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, L.w, L.h)

  // The molten pool itself: layered, breathing, never a still ellipse.
  const pulse = 1 + Math.sin(g.clock * 1.7) * 0.03 + Math.sin(g.clock * 4.3) * 0.015
  const rr = c.r * 0.62 * pulse
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(c.x, c.y, rr, rr * 0.3, 0, 0, Math.PI * 2)
  const pg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, rr)
  pg.addColorStop(0, `rgba(255,250,220,${0.75 + heat * 0.25})`)
  pg.addColorStop(0.3, "rgba(255,168,40,0.8)")
  pg.addColorStop(0.7, "rgba(214,58,4,0.5)")
  pg.addColorStop(1, "rgba(90,16,2,0)")
  ctx.fillStyle = pg
  ctx.fill()
  ctx.restore()

  glow(ctx, c.x, c.y, c.r * (1.1 + heat * 0.5), GLOW_HOT, 0.5 + heat * 0.4)

  // Heat haze: a few translucent bands that wobble. Costs three fills, reads
  // as air above a furnace, and is the first thing reduced-motion turns off.
  if (!g.reduced) {
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    for (let i = 0; i < 3; i++) {
      const y = c.y - 60 - i * 46 * L.scale
      const amp = (6 + i * 4) * L.scale
      ctx.beginPath()
      ctx.moveTo(c.x - c.r, y)
      for (let x = -c.r; x <= c.r; x += 18) {
        ctx.lineTo(c.x + x, y + Math.sin(g.clock * 2.2 + x * 0.02 + i) * amp)
      }
      ctx.strokeStyle = `rgba(255,150,60,${0.05 - i * 0.012})`
      ctx.lineWidth = 22 * L.scale
      ctx.stroke()
    }
    ctx.restore()
  }

  // Vignette. Keeps the eye on the numbers.
  const vg = ctx.createRadialGradient(
    L.w / 2,
    L.h / 2,
    Math.min(L.w, L.h) * 0.32,
    L.w / 2,
    L.h / 2,
    Math.max(L.w, L.h) * 0.78,
  )
  vg.addColorStop(0, "rgba(0,0,0,0)")
  vg.addColorStop(1, "rgba(0,0,0,0.62)")
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, L.w, L.h)
}

// --- the furnace ------------------------------------------------------------

/**
 * The stack the stations bolt onto: a riveted iron chimney with a fire in its
 * mouth. It is drawn at FULL height from the first frame, so the column reads
 * as a machine with five empty mounting bays rather than as an empty screen —
 * and every station that lands later visibly fills one of them.
 */
export function drawFurnace(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const x = L.chain.x - L.pad * 0.75
  const w = L.chain.w + L.pad * 1.5
  const top = L.chain.y - L.pad * 0.6
  const bot = L.furnaceBottom
  const h = bot - top
  const heat = clamp01(g.heatBar)

  // Chimney above the stack, narrowing, with its own cap.
  const cw = w * 0.34
  const cx = x + w / 2
  const chTop = Math.max(2 * S, top - 34 * S)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - cw / 2, top + 4)
  ctx.lineTo(cx - cw / 2 + 6 * S, chTop + 8 * S)
  ctx.lineTo(cx + cw / 2 - 6 * S, chTop + 8 * S)
  ctx.lineTo(cx + cw / 2, top + 4)
  ctx.closePath()
  ctx.fillStyle = "#141920"
  ctx.fill()
  ctx.strokeStyle = "rgba(120,132,150,0.28)"
  ctx.lineWidth = 1.5
  ctx.stroke()
  plate(ctx, cx - cw / 2 - 5 * S, chTop, cw + 10 * S, 9 * S, { chamfer: 3 * S, tint: "#1b212a" })
  ctx.restore()

  // The body.
  plate(ctx, x, top, w, h, { chamfer: 16 * S, tint: "#10141a", sunken: true })

  // Fire seen through the grate, brightening toward the mouth.
  ctx.save()
  chamferRect(ctx, x, top, w, h, 16 * S)
  ctx.clip()
  const fg = ctx.createLinearGradient(0, bot, 0, top)
  fg.addColorStop(0, `rgba(255,110,10,${0.42 + heat * 0.34})`)
  fg.addColorStop(0.22, `rgba(190,52,4,${0.2 + heat * 0.2})`)
  fg.addColorStop(0.72, "rgba(60,16,4,0.12)")
  fg.addColorStop(1, "rgba(20,10,14,0)")
  ctx.fillStyle = fg
  ctx.fillRect(x, top, w, h)

  // Horizontal seams: one mounting bay per station, so the empty ones read as
  // "a slot waiting" rather than as nothing.
  ctx.strokeStyle = "rgba(0,0,0,0.5)"
  ctx.lineWidth = 2
  for (let i = 1; i < 6; i++) {
    const sy = Math.round(L.chain.y + L.chain.h - i * L.rowH) + 0.5
    if (sy < top + 6 || sy > bot - 6) continue
    ctx.beginPath()
    ctx.moveTo(x + 4, sy)
    ctx.lineTo(x + w - 4, sy)
    ctx.stroke()
  }
  ctx.restore()

  // Empty mounting bays: recessed panels with bolt holes. Absence should read
  // as capacity — five slots waiting — not as a screen that failed to draw.
  ctx.save()
  chamferRect(ctx, x, top, w, h, 16 * S)
  ctx.clip()
  for (let i = 0; i < 6; i++) {
    if (isRevealed(g.economy, i)) continue
    const by = L.chain.y + L.chain.h - (i + 1) * L.rowH
    if (by + L.rowH < top || by > bot) continue
    const bx = x + 18 * S
    const bw2 = w - 36 * S
    const bh2 = L.rowH - 16 * S
    chamferRect(ctx, bx, by + 8 * S, bw2, bh2, 8 * S)
    ctx.fillStyle = "rgba(0,0,0,0.34)"
    ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.045)"
    ctx.lineWidth = 1
    ctx.stroke()
    for (const hx of [bx + 16 * S, bx + bw2 - 16 * S]) {
      for (const hy2 of [by + 20 * S, by + 8 * S + bh2 - 12 * S]) {
        ctx.beginPath()
        ctx.arc(hx, hy2, 3 * S, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(0,0,0,0.6)"
        ctx.fill()
      }
    }
  }
  ctx.restore()

  // Rivets down both edges. Two circles each; cheap, and they carry the whole
  // "this is fabricated steel" read.
  const step = Math.max(22 * S, L.rowH / 3)
  ctx.save()
  for (let ry = top + step * 0.6; ry < bot - 6; ry += step) {
    for (const rx2 of [x + 7 * S, x + w - 7 * S]) {
      ctx.beginPath()
      ctx.arc(rx2, ry, 2.6 * S, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(150,162,180,0.32)"
      ctx.fill()
      ctx.beginPath()
      ctx.arc(rx2 - 0.7 * S, ry - 0.7 * S, 1.2 * S, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(230,238,250,0.3)"
      ctx.fill()
    }
  }
  ctx.restore()

  // The mouth: an arched door with fire behind it. Iron surround first, so it
  // reads as an opening in a machine rather than as a bright rectangle.
  const mw = w * 0.56
  const mh = Math.min(46 * S, h * 0.085)
  const my0 = bot - mh
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx - mw / 2 - 5 * S, bot)
  ctx.lineTo(cx - mw / 2 - 5 * S, my0)
  ctx.quadraticCurveTo(cx, my0 - mh * 0.85, cx + mw / 2 + 5 * S, my0)
  ctx.lineTo(cx + mw / 2 + 5 * S, bot)
  ctx.closePath()
  ctx.fillStyle = "#0b0e13"
  ctx.fill()
  ctx.strokeStyle = "rgba(150,162,180,0.3)"
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - mw / 2, bot)
  ctx.lineTo(cx - mw / 2, my0)
  ctx.quadraticCurveTo(cx, my0 - mh * 0.7, cx + mw / 2, my0)
  ctx.lineTo(cx + mw / 2, bot)
  ctx.closePath()
  ctx.clip()
  const mg = ctx.createLinearGradient(0, bot, 0, my0 - mh * 0.7)
  mg.addColorStop(0, `rgba(255,244,206,${0.72 + heat * 0.28})`)
  mg.addColorStop(0.35, "rgba(255,146,26,0.85)")
  mg.addColorStop(0.75, "rgba(180,40,2,0.55)")
  mg.addColorStop(1, "rgba(60,12,0,0.2)")
  ctx.fillStyle = mg
  ctx.fillRect(cx - mw / 2, my0 - mh, mw, mh * 2)
  // Flame licks: three sine tongues, cheap and alive.
  ctx.globalCompositeOperation = "lighter"
  for (let i = 0; i < 5; i++) {
    const fx = cx + (i - 2) * mw * 0.19
    const fh = mh * (0.45 + 0.4 * Math.abs(Math.sin(g.clock * (2.1 + i * 0.37) + i * 2.1)))
    ctx.beginPath()
    ctx.moveTo(fx - mw * 0.055, bot)
    ctx.quadraticCurveTo(fx, bot - fh * 1.8, fx + mw * 0.055, bot)
    ctx.fillStyle = "rgba(255,214,140,0.17)"
    ctx.fill()
  }
  ctx.restore()
  glow(ctx, cx, bot - mh * 0.45, mw * 0.85, GLOW_HOT, 0.55 + heat * 0.4)
}
