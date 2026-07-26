// The renderer. One canvas, no DOM, no layout thrash.
//
// Draw order is fixed and cheap: cold background, the furnace column, the
// workbench, then every additive pass together at the end so the compositing
// mode is switched twice per frame rather than two hundred times.

import { MICRO, compact, rateText, readout, superscript } from "../core/bigmath.ts"
import {
  DOUBLE_EVERY,
  QUENCH_FLOOR,
  TIERS,
  canBuy,
  doublings,
  heatBonus,
  isRevealed,
  sparksPerSecond,
  tierCount,
  tierOutputPerSecond,
} from "../core/economy.ts"
import { offerLabel, resultingCount } from "../game/marks.ts"
import type { Rect } from "../game/layout.ts"
import type { Game } from "../game/types.ts"
import {
  GLOW_COLD,
  GLOW_GOLD,
  GLOW_HOT,
  GLOW_WHITE,
  PAL,
  chamferRect,
  glow,
  measure,
  pips,
  plate,
  text,
} from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"

function fitSize(
  ctx: CanvasRenderingContext2D,
  str: string,
  maxW: number,
  start: number,
  mono: boolean,
  tracking = 0,
): number {
  let s = start
  while (s > 8 && measure(ctx, str, s, mono, tracking) > maxW) s -= 1
  return s
}

function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string): void {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.lineTo(x + s * 0.85, y)
  ctx.lineTo(x, y + s)
  ctx.closePath()
  ctx.fillStyle = c
  ctx.fill()
}

/**
 * A chain across a sealed row. Links alternate between edge-on and flat, which
 * is the only thing that makes a row of ovals read as a chain rather than as a
 * decorative border. Shape, not colour, says "locked".
 */
function chains(ctx: CanvasRenderingContext2D, r: Rect, t: number): void {
  ctx.save()
  const link = Math.min(r.h * 0.6, r.w / 12)
  const n = Math.max(4, Math.round(r.w / (link * 0.72)))
  const cy = r.y + r.h / 2
  for (let i = 0; i < n; i++) {
    const x = r.x + ((i + 0.5) * r.w) / n
    const sag = Math.sin(t * 1.6 + i * 0.5) * r.h * 0.04
    const flat = i % 2 === 0
    ctx.lineWidth = Math.max(2.5, link * 0.17)
    ctx.strokeStyle = flat ? "rgba(178,190,208,0.85)" : "rgba(108,120,138,0.85)"
    ctx.beginPath()
    ctx.ellipse(x, cy + sag, flat ? link * 0.42 : link * 0.15, link * 0.3, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  ctx.save()
  ctx.translate(g.juice.shakeX, g.juice.shakeY)

  drawBackdrop(ctx, g)
  drawFurnace(ctx, g)
  drawChain(ctx, g)
  drawHeader(ctx, g)
  drawAnvil(ctx, g)

  g.particles.draw(ctx)
  drawFlyers(ctx, g)
  drawFloats(ctx, g)
  drawStamp(ctx, g)

  ctx.restore()

  if (g.mode !== "play") drawOverlay(ctx, g)

  if (g.juice.flash > 0.003) {
    ctx.fillStyle = `rgba(255,246,224,${g.juice.flash})`
    ctx.fillRect(0, 0, L.w, L.h)
  }

  if (g.showFps) {
    text(ctx, `${g.fps.toFixed(0)} fps · ${g.particles.count()}p`, 8, L.h - 8, {
      size: 12,
      mono: true,
      color: "rgba(255,255,255,0.45)",
    })
  }
}

// --- backdrop ---------------------------------------------------------------

function drawBackdrop(ctx: CanvasRenderingContext2D, g: Game): void {
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
function drawFurnace(ctx: CanvasRenderingContext2D, g: Game): void {
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

// --- the station column -----------------------------------------------------

function drawChain(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const e = g.economy
  const S = L.scale

  for (let i = 0; i < TIERS.length; i++) {
    if (!isRevealed(e, i)) continue
    const def = TIERS[i]
    const t = e.tiers[i]
    const r = L.rows[i]
    const anim = clamp01(g.rowIn[i])
    if (anim <= 0) continue

    // New stations SLAM in from above with an overshoot, then settle.
    const drop = (1 - ease.outBack(anim)) * -r.h * 2.2
    const y = r.y + drop
    const rr: Rect = { x: r.x, y, w: r.w, h: r.h }
    ctx.save()
    ctx.globalAlpha = Math.min(1, anim * 1.6)

    const afford = canBuy(e, i)
    const pulse = afford ? 0.5 + 0.5 * Math.sin(g.clock * 4.6) : 0
    const rowPulse = clamp01(g.rowPulse[i])
    const heatGlow = t.unlocked ? 0.12 + Math.min(0.5, Number(t.purchased) / 60) : 0

    plate(ctx, rr.x, y, rr.w, rr.h, {
      heat: heatGlow + rowPulse * 0.6,
      chamfer: 10 * S,
      sunken: !t.unlocked,
      ...(t.unlocked ? {} : { tint: "#161b22" }),
    })

    if (rowPulse > 0) {
      glow(ctx, rr.x + rr.w * 0.5, y + rr.h / 2, rr.h * 1.4, GLOW_HOT, rowPulse * 0.55)
    }

    const padL = 12 * S
    // Two row layouts. Landscape has the height for a name line and a figures
    // line with the doubling pips between them; portrait does not, so the
    // multiplier moves up beside the name and the pips become a hairline along
    // the bottom edge of the row. Nothing is dropped, nothing overlaps, and
    // neither layout is the other one squeezed.
    const bw = Math.min(rr.w * (L.portrait ? 0.3 : 0.34), 178 * S)
    const leftW = rr.w - bw - 20 * S
    const count = tierCount(t) / MICRO
    const countStr = compact(tierCount(t))
    const outRate = tierOutputPerSecond(e, i)
    const dbl = doublings(t)
    const filled = Number(t.purchased % DOUBLE_EVERY)

    if (L.portrait) {
      const nameSize = Math.round(12.5 * S)
      text(ctx, def.name, rr.x + padL, y + rr.h * 0.33, {
        size: nameSize,
        color: t.unlocked ? PAL.text : PAL.dim,
        tracking: 1.5 * S,
      })
      if (dbl > 0n) {
        text(ctx, `×${1n << dbl}`, rr.x + leftW, y + rr.h * 0.33, {
          size: Math.round(13 * S),
          mono: true,
          align: "right",
          color: PAL.bright,
        })
      }
      const countSize = Math.round(23 * S)
      const cs2 = fitSize(ctx, countStr, leftW * 0.52, countSize, true)
      text(ctx, countStr, rr.x + padL, y + rr.h * 0.82, {
        size: cs2,
        mono: true,
        color: count > 0n ? PAL.white : "rgba(230,225,215,0.35)",
        glowColor: count > 0n ? GLOW_HOT : undefined,
        glowRadius: cs2,
      })
      const rstr = `▾ ${rateText(outRate)} ${def.makes}/s`
      const rs = fitSize(ctx, rstr, leftW * 0.46, Math.round(11 * S), false, 0.4)
      text(ctx, rstr, rr.x + leftW, y + rr.h * 0.8, {
        size: rs,
        align: "right",
        color: outRate > 0n ? "rgba(255,178,90,0.92)" : "rgba(150,158,172,0.5)",
        tracking: 0.4,
      })
      if (t.unlocked && t.purchased > 0n) {
        const bx0 = rr.x + padL
        const bw0 = leftW - padL
        ctx.fillStyle = "rgba(255,255,255,0.09)"
        ctx.fillRect(bx0, y + rr.h - 6 * S, bw0, 3 * S)
        ctx.fillStyle = PAL.bright
        ctx.fillRect(bx0, y + rr.h - 6 * S, (bw0 * filled) / Number(DOUBLE_EVERY), 3 * S)
      }
    } else {
      const nameSize = Math.round(15 * S)
      text(ctx, def.name, rr.x + padL + 2 * S, y + rr.h * 0.36, {
        size: nameSize,
        color: t.unlocked ? PAL.text : PAL.dim,
        tracking: 1.7 * S,
      })
      const countSize = Math.round(30 * S)
      text(ctx, countStr, rr.x + padL + 2 * S, y + rr.h * 0.86, {
        size: countSize,
        mono: true,
        color: count > 0n ? PAL.white : "rgba(230,225,215,0.35)",
        glowColor: count > 0n ? GLOW_HOT : undefined,
        glowRadius: countSize * 1.1,
      })
      const rateStr = `▾ ${rateText(outRate)} ${def.makes}/s`
      const cw = measure(ctx, countStr, countSize, true)
      text(ctx, rateStr, rr.x + padL + cw + 12 * S, y + rr.h * 0.84, {
        size: Math.round(12.5 * S),
        color: outRate > 0n ? "rgba(255,178,90,0.92)" : "rgba(150,158,172,0.5)",
        tracking: 0.6,
      })
      const pipW = Math.min(118 * S, rr.w * 0.21)
      const pipX = rr.x + rr.w * 0.44
      if (t.unlocked && t.purchased > 0n) {
        if (dbl > 0n) {
          text(ctx, `×${1n << dbl}`, pipX, y + rr.h * 0.4, {
            size: Math.round(16 * S),
            mono: true,
            color: PAL.bright,
            glowColor: GLOW_GOLD,
            glowRadius: 22 * S,
          })
        }
        pips(ctx, pipX, y + rr.h * 0.56, pipW, 11 * S, filled, Number(DOUBLE_EVERY), PAL.bright)
      }
    }

    // The buy plate.
    const bx = rr.x + rr.w - bw - 8 * S
    const by = y + 7 * S
    const bh = rr.h - 14 * S
    if (!t.unlocked) {
      chains(ctx, rr, g.clock)
      plate(ctx, bx, by, bw, bh, { chamfer: 8 * S, tint: "#1b2129", rimColor: "rgba(120,200,255,0.5)" })
      text(ctx, "SEAL", bx + bw / 2, by + bh * 0.42, {
        size: Math.round(15 * S),
        align: "center",
        color: PAL.cold,
        tracking: 2.4 * S,
      })
      text(ctx, compact(BigInt(t.cost) * MICRO), bx + bw / 2, by + bh * 0.86, {
        size: Math.round(15 * S),
        mono: true,
        align: "center",
        color: "rgba(200,215,230,0.7)",
      })
    } else {
      const cost = t.cost
      const affordN = e.sparks >= cost * MICRO
      plate(ctx, bx, by, bw, bh, {
        chamfer: 8 * S,
        heat: affordN ? 0.55 + pulse * 0.45 : 0,
        tint: affordN ? undefined : "#1a1e25",
      })
      if (affordN) {
        glow(ctx, bx + bw / 2, by + bh / 2, bh * 1.5, GLOW_HOT, 0.18 + pulse * 0.22)
        chevron(ctx, bx + 11 * S, by + bh / 2, 7 * S, PAL.white)
      }
      const cs = fitSize(ctx, compact(cost * MICRO), bw - 30 * S, Math.round(22 * S), true)
      text(ctx, compact(cost * MICRO), bx + bw / 2 + 6 * S, by + bh * 0.64, {
        size: cs,
        mono: true,
        align: "center",
        color: affordN ? PAL.ink : "rgba(190,198,210,0.55)",
      })
      // Held: the plate fills as it repeats, so the acceleration is visible.
      if (g.heldRow === i && g.buyHeld > 0) {
        const fillW = (bw - 8 * S) * Math.min(1, g.buyHeld)
        ctx.save()
        ctx.globalCompositeOperation = "lighter"
        ctx.fillStyle = "rgba(255,220,150,0.28)"
        ctx.fillRect(bx + 4 * S, by + bh - 6 * S, fillW, 4 * S)
        ctx.restore()
      }
    }

    // Desktop keycap, drawn as a key. Never shown on touch.
    if (g.pointerFine && !L.portrait && t.unlocked) {
      const ks = 17 * S
      const kx = rr.x + rr.w - bw - 10 * S - ks
      const ky = y + 9 * S
      chamferRect(ctx, kx, ky, ks, ks, 3 * S)
      ctx.fillStyle = "rgba(255,255,255,0.06)"
      ctx.fill()
      ctx.strokeStyle = "rgba(255,255,255,0.16)"
      ctx.lineWidth = 1
      ctx.stroke()
      text(ctx, "ASDFGH"[i] as string, kx + ks / 2, ky + ks * 0.74, {
        size: Math.round(10 * S),
        color: "rgba(255,255,255,0.42)",
        align: "center",
      })
    }

    ctx.restore()
  }
}

// --- header -----------------------------------------------------------------

function drawHeader(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const e = g.economy
  const S = L.scale
  const H = L.header
  const R = readout(e.sparks)

  const labelY = H.y + 17 * S
  text(ctx, "SPARKS", H.x + 2, labelY, {
    size: Math.round(12 * S),
    color: "rgba(255,190,120,0.65)",
    tracking: 3.4 * S,
  })

  // The number. Everything about this is deliberate: monospaced so the digits
  // do not dance, truncated rather than rounded so it never shows what you do
  // not have, and split into mantissa and exponent the moment it passes a
  // million — because from there on the exponent is the score.
  const big = Math.round((L.portrait ? 50 : 66) * S)
  const my = labelY + big * 0.92
  const punch = 1 + ease.outQuint(clamp01(g.stamp)) * 0.14
  ctx.save()
  ctx.translate(H.x + 2, my)
  ctx.scale(punch, punch)
  if (R.plain) {
    const s2 = fitSize(ctx, R.mantissa, H.w - 20 * S, big, true)
    text(ctx, R.mantissa, 0, 0, { size: s2, mono: true, color: PAL.white, glowColor: GLOW_HOT })
  } else {
    const mw = measure(ctx, R.mantissa, big, true)
    text(ctx, R.mantissa, 0, 0, { size: big, mono: true, color: PAL.white, glowColor: GLOW_HOT })
    const ex = mw + 8 * S
    text(ctx, "×10", ex, 0, { size: Math.round(big * 0.5), color: "rgba(255,200,140,0.9)" })
    // The exponent is set in ordinary large figures raised on the baseline —
    // NOT in Unicode superscript glyphs, which are already raised inside their
    // em box and would be doubly lifted and half the size. This number is the
    // score once the game gets going; it gets to be big.
    const exw = measure(ctx, "×10", Math.round(big * 0.5))
    text(ctx, String(R.exponent), ex + exw + 3 * S, -big * 0.3, {
      size: Math.round(big * 0.52),
      mono: true,
      color: PAL.bright,
      glowColor: GLOW_GOLD,
      glowRadius: big * 0.7,
    })
  }
  ctx.restore()

  // Rate.
  const sps = sparksPerSecond(e)
  text(ctx, `+${rateText(sps)} /s`, H.x + 3, my + 27 * S, {
    size: Math.round(17 * S),
    mono: true,
    color: sps > 0n ? "rgba(255,176,84,0.95)" : "rgba(160,168,180,0.45)",
  })

  // Heat gauge, anchored to the bottom of the header. The multiplier is
  // printed, so the bar is a second channel and never the only one.
  const gh = 15 * S
  const gy = H.y + H.h - gh - 6 * S
  const gw = Math.min(H.w * (L.portrait ? 0.46 : 0.6), 300 * S)
  plate(ctx, H.x, gy, gw, gh, { chamfer: 4 * S, sunken: true, tint: "#141820" })
  const fill = clamp01(g.heatBar)
  if (fill > 0.002) {
    ctx.save()
    chamferRect(ctx, H.x + 2, gy + 2, Math.max(2, (gw - 4) * fill), gh - 4, 3 * S)
    ctx.clip()
    const hg = ctx.createLinearGradient(H.x, 0, H.x + gw, 0)
    hg.addColorStop(0, "#ff4a00")
    hg.addColorStop(0.6, "#ffa523")
    hg.addColorStop(1, "#fff0c0")
    ctx.fillStyle = hg
    ctx.fillRect(H.x, gy, gw, gh)
    ctx.restore()
    glow(ctx, H.x + gw * fill, gy + gh / 2, 26 * S, GLOW_HOT, 0.5)
  }
  // The SAME expression the economy multiplies production by. A displayed
  // multiplier that is not the applied multiplier is the one lie a maths game
  // cannot tell, and the two drifted apart the moment heat went square-root.
  const heatUnits = e.heat / MICRO
  const mulNum = 100n + heatBonus(e)
  const whole = mulNum / 100n
  const frac = (mulNum % 100n) / 10n
  const mulStr = `×${whole}.${frac}`
  const mulSize = Math.round(18 * S)
  text(ctx, mulStr, H.x + gw + 10 * S, gy + gh * 0.92, {
    size: mulSize,
    mono: true,
    color: heatUnits > 0n ? PAL.bright : PAL.dim,
  })
  text(ctx, "HEAT", H.x + 1, gy - 7 * S, {
    size: Math.round(10 * S),
    color: "rgba(255,190,120,0.5)",
    tracking: 2.6 * S,
  })

  // Permanent multipliers, only once they exist.
  let px = H.x + gw + 20 * S + measure(ctx, mulStr, mulSize, true)
  if (e.marks > 0n) {
    text(ctx, `◈${e.marks}`, px, gy + gh * 0.92, {
      size: Math.round(16 * S),
      mono: true,
      color: PAL.gold,
    })
    px += (L.portrait ? 38 : 44) * S
  }
  if (e.carbon > 0n) {
    text(ctx, `◆${e.carbon}`, px, gy + gh * 0.92, {
      size: Math.round(16 * S),
      mono: true,
      color: PAL.cold,
    })
  }

  // QUENCH. The only cold thing on the screen, and the only control that is
  // ever cyan — so the first time it appears you know something new exists
  // without a word being written.
  if (g.quenchReady) {
    const Q = L.quench
    const p = 0.5 + 0.5 * Math.sin(g.clock * 3.4)
    plate(ctx, Q.x, Q.y, Q.w, Q.h, {
      chamfer: 10 * S,
      tint: "#0f3441",
      rimColor: `rgba(99,224,255,${0.5 + p * 0.5})`,
      rimWidth: 2.4,
    })
    glow(ctx, Q.x + Q.w / 2, Q.y + Q.h / 2, Q.h * 1.5, GLOW_COLD, 0.16 + p * 0.24)
    text(ctx, "QUENCH", Q.x + Q.w / 2, Q.y + Q.h * 0.44, {
      size: Math.round(15 * S),
      align: "center",
      color: PAL.cold,
      tracking: 3.2 * S,
    })
    text(ctx, `◆ +${g.quenchPreview}`, Q.x + Q.w / 2, Q.y + Q.h * 0.84, {
      size: Math.round(16 * S),
      mono: true,
      align: "center",
      color: PAL.white,
    })
  }

  // Audio toggle: three bars that go flat when muted. No words.
  const a = L.audio
  ctx.save()
  ctx.strokeStyle = g.showFps ? PAL.bright : "rgba(190,198,210,0.55)"
  ctx.lineWidth = 2 * S
  for (let i = 0; i < 3; i++) {
    const bx = a.x + 4 + i * 8 * S
    const amp = g.audioOn ? (0.35 + 0.65 * Math.abs(Math.sin(g.clock * 3 + i))) * a.h * 0.5 : 1.5
    ctx.beginPath()
    ctx.moveTo(bx, a.y + a.h / 2 - amp)
    ctx.lineTo(bx, a.y + a.h / 2 + amp)
    ctx.strokeStyle = g.audioOn ? "rgba(255,190,120,0.8)" : "rgba(150,158,172,0.5)"
    ctx.stroke()
  }
  ctx.restore()
}

// --- the workbench ----------------------------------------------------------

function drawAnvil(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const B = L.billet
  const answered = g.struckAt >= 0

  // The shop wall the bench stands against. Without it the right-hand column
  // is a void with objects floating in it.
  const W = L.anvil
  plate(ctx, W.x - L.pad * 0.5, W.y - L.pad * 0.3, W.w + L.pad, W.h + L.pad * 0.9, {
    chamfer: 16 * S,
    tint: "#0d1015",
    sunken: true,
  })
  ctx.save()
  chamferRect(ctx, W.x - L.pad * 0.5, W.y - L.pad * 0.3, W.w + L.pad, W.h + L.pad * 0.9, 16 * S)
  ctx.clip()
  const floorY = L.anvilBody.y + L.anvilBody.h
  const fl = ctx.createLinearGradient(0, floorY - 90 * S, 0, floorY + 10 * S)
  fl.addColorStop(0, "rgba(255,120,20,0)")
  fl.addColorStop(1, "rgba(255,130,30,0.16)")
  ctx.fillStyle = fl
  ctx.fillRect(W.x - L.pad, floorY - 90 * S, W.w + L.pad * 2, 100 * S)
  ctx.strokeStyle = "rgba(150,162,180,0.16)"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(W.x - L.pad, floorY + 1)
  ctx.lineTo(W.x + W.w + L.pad, floorY + 1)
  ctx.stroke()

  // A tool rack on the wall above the bench. Three tongs on a rail: pure
  // set-dressing, four paths, and it is the difference between "a workshop"
  // and "some rectangles".
  const rackY = W.y + 26 * S
  if (B.y - rackY > 70 * S) {
    ctx.strokeStyle = "rgba(150,162,180,0.3)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W.x + W.w * 0.12, rackY)
    ctx.lineTo(W.x + W.w * 0.88, rackY)
    ctx.stroke()
    const toolH = Math.min(70 * S, (B.y - rackY) * 0.62)
    for (let i = 0; i < 3; i++) {
      const tx = W.x + W.w * (0.26 + i * 0.24)
      ctx.strokeStyle = "rgba(120,132,150,0.34)"
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(tx, rackY + 7 * S, 7 * S, Math.PI * 0.85, Math.PI * 2.15)
      ctx.stroke()
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(tx - 4 * S, rackY + 12 * S)
      ctx.lineTo(tx + 3 * S + i * S, rackY + toolH)
      ctx.moveTo(tx + 4 * S, rackY + 12 * S)
      ctx.lineTo(tx - 3 * S - i * S, rackY + toolH)
      ctx.stroke()
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(tx - 5 * S, rackY + toolH * 0.52)
      ctx.lineTo(tx + 5 * S, rackY + toolH * 0.52)
      ctx.stroke()
    }
  }
  ctx.restore()

  // The anvil. One integrated silhouette — face, horn, waist, splayed base —
  // because a rectangle would not tell you in a glance what this object is.
  const A = L.anvilBody
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(A.x + A.w * 0.06, A.y)
  ctx.lineTo(A.x + A.w, A.y)
  ctx.lineTo(A.x + A.w, A.y + A.h * 0.3)
  ctx.lineTo(A.x + A.w * 0.7, A.y + A.h * 0.38)
  ctx.lineTo(A.x + A.w * 0.68, A.y + A.h * 0.7)
  ctx.lineTo(A.x + A.w * 0.92, A.y + A.h)
  ctx.lineTo(A.x + A.w * 0.08, A.y + A.h)
  ctx.lineTo(A.x + A.w * 0.32, A.y + A.h * 0.7)
  ctx.lineTo(A.x + A.w * 0.3, A.y + A.h * 0.38)
  ctx.lineTo(A.x + A.w * 0.06, A.y + A.h * 0.3)
  ctx.lineTo(A.x - A.w * 0.13, A.y + A.h * 0.15)
  ctx.closePath()
  const ag = ctx.createLinearGradient(0, A.y, 0, A.y + A.h)
  ag.addColorStop(0, "#454d5a")
  ag.addColorStop(0.16, "#242a33")
  ag.addColorStop(1, "#0c0f13")
  ctx.fillStyle = ag
  ctx.fill()
  ctx.strokeStyle = "rgba(140,152,170,0.22)"
  ctx.lineWidth = 1.4
  ctx.stroke()
  // The face catches the light of whatever is lying on it.
  ctx.beginPath()
  ctx.moveTo(A.x + A.w * 0.06, A.y + 2)
  ctx.lineTo(A.x + A.w - 2, A.y + 2)
  ctx.strokeStyle = "rgba(255,176,90,0.55)"
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // The billet: slides in, gets struck, either compresses or shatters.
  const inT = ease.outQuint(clamp01(g.billetIn))
  const slide = -(1 - inT) * B.w * 0.55
  const shatterT = clamp01(g.shatter)
  const squash = answered && g.lastCorrect ? Math.max(0, 1 - (g.clock - g.struckAt) * 5) : 0
  const sx = 1 + squash * 0.14
  const sy = 1 - squash * 0.3

  if (shatterT < 0.999) {
    ctx.save()
    // Clipped to the shop wall: the bar comes IN from the fire and leaves the
    // frame at the panel edge rather than sliding over the furnace column.
    chamferRect(ctx, W.x - L.pad * 0.5, W.y - L.pad * 0.3, W.w + L.pad, W.h + L.pad * 0.9, 16 * S)
    ctx.clip()
    ctx.globalAlpha = inT * (1 - shatterT)
    ctx.translate(B.x + B.w / 2 + slide, B.y + B.h / 2)
    ctx.scale(sx, sy)
    const bw = B.w
    const bh = B.h
    chamferRect(ctx, -bw / 2, -bh / 2, bw, bh, 12 * S)
    const bg = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2)
    const hotness = g.lastCorrect && answered ? 1 : 0.72
    bg.addColorStop(0, `rgba(255,${190 + 50 * hotness},${120 + 90 * hotness},1)`)
    bg.addColorStop(0.45, "rgba(255,132,26,1)")
    bg.addColorStop(1, "rgba(178,38,4,1)")
    ctx.fillStyle = bg
    ctx.fill()
    ctx.lineWidth = 2 * S
    ctx.strokeStyle = "rgba(255,232,180,0.55)"
    ctx.stroke()

    const ps = fitSize(ctx, g.q.prompt, bw - 34 * S, Math.round(bh * 0.62), true, 1)
    text(ctx, g.q.prompt, 0, ps * 0.36, {
      size: ps,
      mono: true,
      align: "center",
      color: "#2a0d00",
      tracking: 1.2 * S,
    })
    ctx.restore()
    glow(ctx, B.x + B.w / 2 + slide, B.y + B.h / 2, B.h * 1.5, GLOW_HOT, 0.4 * inT * (1 - shatterT))
  }

  // The hammer. Rest above, fall on the strike, recoil through an overshoot.
  const hT = clamp01(g.hammer)
  let hy = L.hammerY - 26 * S
  let rot = -0.62
  if (hT > 0) {
    if (hT > 0.72) {
      const k = (1 - hT) / 0.28
      hy = L.hammerY - 26 * S + ease.inQuad(k) * 26 * S
      rot = -0.62 + ease.inQuad(k) * 0.62
    } else {
      const k = ease.outBack(1 - hT / 0.72)
      hy = L.hammerY - k * 26 * S
      rot = -k * 0.62
    }
  }
  const hx = B.x + B.w / 2
  ctx.save()
  chamferRect(ctx, W.x - L.pad * 0.5, W.y - L.pad * 0.3, W.w + L.pad, W.h + L.pad * 0.9, 16 * S)
  ctx.clip()
  ctx.translate(hx, hy)
  ctx.rotate(rot)
  const hw = 92 * S
  const hh = 38 * S
  // Handle first, so the head sits over it.
  ctx.beginPath()
  ctx.moveTo(-7 * S, -hh + 4 * S)
  ctx.lineTo(7 * S, -hh + 4 * S)
  ctx.lineTo(10 * S, -hh - 62 * S)
  ctx.lineTo(-10 * S, -hh - 62 * S)
  ctx.closePath()
  const hg = ctx.createLinearGradient(-11 * S, 0, 11 * S, 0)
  hg.addColorStop(0, "#3a2c1c")
  hg.addColorStop(0.4, "#6b5334")
  hg.addColorStop(1, "#2c2115")
  ctx.fillStyle = hg
  ctx.fill()
  // Head: a cross-peen, flat face on the right, wedge on the left.
  ctx.beginPath()
  ctx.moveTo(-hw * 0.5, -hh * 0.62)
  ctx.lineTo(-hw * 0.2, -hh)
  ctx.lineTo(hw * 0.5, -hh)
  ctx.lineTo(hw * 0.5, 0)
  ctx.lineTo(-hw * 0.2, 0)
  ctx.lineTo(-hw * 0.5, -hh * 0.38)
  ctx.closePath()
  const headG = ctx.createLinearGradient(0, -hh, 0, 0)
  headG.addColorStop(0, "#59616e")
  headG.addColorStop(0.35, "#333a45")
  headG.addColorStop(1, "#161a21")
  ctx.fillStyle = headG
  ctx.fill()
  ctx.strokeStyle = "rgba(200,212,230,0.35)"
  ctx.lineWidth = 1.4
  ctx.stroke()
  // The striking face, polished bright.
  ctx.fillStyle = "rgba(226,236,250,0.5)"
  ctx.fillRect(hw * 0.42, -hh * 0.92, hw * 0.08, hh * 0.86)
  ctx.restore()

  // Combo, big and next to the work. Duplicated as pips so it is not a number
  // alone, and it lives here rather than in the header because this is where
  // the player is looking when it changes.
  if (g.combo > 1) {
    const cx = L.portrait ? L.w - L.pad - 10 * S : B.x + B.w - 6 * S
    const cy = B.y - 14 * S
    const pop = 1 + Math.max(0, 1 - (g.clock - g.struckAt) * 4) * 0.5
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(pop, pop)
    text(ctx, `×${g.combo}`, 0, 0, {
      size: Math.round(26 * S),
      mono: true,
      align: "right",
      color: g.combo >= 8 ? PAL.white : PAL.bright,
      glowColor: g.combo >= 8 ? GLOW_WHITE : GLOW_GOLD,
    })
    ctx.restore()
  }

  if (g.mode === "play" || g.mode === "mark" || g.mode === "quench") {
    drawSlugs(ctx, g, L.slugs, g.slugs, Math.round(34 * S))
  }
}

export function drawSlugs(
  ctx: CanvasRenderingContext2D,
  g: Game,
  rects: Rect[],
  slugs: Game["slugs"],
  size: number,
): void {
  const S = g.layout.scale
  for (let i = 0; i < slugs.length && i < rects.length; i++) {
    const s = slugs[i]
    const r = rects[i]
    const hitT = clamp01(s.hit)
    const fadeT = clamp01(s.fade)
    if (fadeT >= 0.999) continue

    const bob = g.reduced ? 0 : Math.sin(g.clock * 2.1 + i * 1.7) * 2.2 * S
    const sq = ease.outElastic(1 - hitT)
    const kx = 1 + (1 - sq) * 0.18
    const ky = 1 - (1 - sq) * 0.18

    ctx.save()
    ctx.globalAlpha = 1 - fadeT
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + bob + fadeT * 30 * S)
    ctx.rotate(fadeT * 0.5)
    ctx.scale(kx, ky)

    // A cast ingot: iron body, hot underside where it came out of the mould,
    // and numerals cut through to the glow inside.
    const flare = hitT > 0 ? hitT : 0
    plate(ctx, -r.w / 2, -r.h / 2, r.w, r.h, {
      chamfer: 12 * S,
      heat: 0.62 + flare * 0.38,
      rimColor: flare > 0.2 ? "rgba(255,244,220,0.95)" : "rgba(255,150,60,0.55)",
      rimWidth: flare > 0.2 ? 3.5 : 1.8,
    })
    // The hot lip along the bottom edge.
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    const lip = ctx.createLinearGradient(0, r.h / 2, 0, r.h / 2 - r.h * 0.42)
    lip.addColorStop(0, `rgba(255,170,60,${0.55 + flare * 0.45})`)
    lip.addColorStop(1, "rgba(255,90,0,0)")
    ctx.fillStyle = lip
    ctx.fillRect(-r.w / 2 + 3, r.h / 2 - r.h * 0.42, r.w - 6, r.h * 0.42)
    ctx.restore()

    const ts = fitSize(ctx, s.label, r.w - 18 * S, size, true)
    text(ctx, s.label, 0, ts * 0.36, {
      size: ts,
      mono: true,
      align: "center",
      color: flare > 0.2 ? "#fffdf6" : "#fff1d4",
      glowColor: flare > 0.2 ? GLOW_WHITE : GLOW_HOT,
      glowRadius: ts * 1.35,
    })
    ctx.restore()

    if (flare > 0.02) {
      glow(ctx, r.x + r.w / 2, r.y + r.h / 2, r.h * 1.3, GLOW_WHITE, flare * 0.8)
    }
    if (g.pointerFine) {
      text(ctx, String(i + 1), r.x + 7 * S, r.y + 15 * S, {
        size: Math.round(11 * S),
        color: "rgba(255,255,255,0.3)",
      })
    }
  }
}

// --- ephemera ---------------------------------------------------------------

function drawFloats(ctx: CanvasRenderingContext2D, g: Game): void {
  for (const f of g.floats) {
    const t = f.life / f.max
    text(ctx, f.text, f.x, f.y, {
      size: f.size,
      mono: true,
      align: "center",
      color: f.color,
      alpha: t > 0.8 ? (1 - t) / 0.2 : Math.min(1, t * 1.6),
      glowColor: GLOW_HOT,
      glowRadius: f.size,
    })
  }
}

function drawFlyers(ctx: CanvasRenderingContext2D, g: Game): void {
  const prev = ctx.globalCompositeOperation
  ctx.globalCompositeOperation = "lighter"
  for (const f of g.flyers) {
    const t = clamp01(f.t / f.dur)
    const k = ease.inQuad(t)
    const x = f.x0 + (f.x1 - f.x0) * k
    // An arc, not a line: a lump of hot metal thrown across a room.
    const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(t * Math.PI) * 90 * g.layout.scale
    f.x = x
    f.y = y
    glow(ctx, x, y, f.size * (1 - t * 0.4), f.color, 0.9)
  }
  ctx.globalCompositeOperation = prev
}

function drawStamp(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.stamp <= 0) return
  const L = g.layout
  const t = 1 - clamp01(g.stamp)
  const k = ease.outBack(Math.min(1, t * 2.6))
  const alpha = t > 0.6 ? (1 - t) / 0.4 : 1
  // Centre of the whole screen, not over the readout it is about: a milestone
  // that covers the number it just changed is a milestone you cannot read.
  const cx = L.w / 2
  const cy = L.h * 0.43
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(2.6 - k * 1.6, 2.6 - k * 1.6)
  ctx.rotate((1 - k) * 0.3)
  text(ctx, g.stampText, 0, 0, {
    size: Math.round(52 * L.scale),
    align: "center",
    color: PAL.white,
    glowColor: GLOW_GOLD,
    glowRadius: 110 * L.scale,
    tracking: 2,
  })
  ctx.restore()
  // Shockwave ring.
  ctx.save()
  ctx.globalAlpha = alpha * 0.5
  ctx.strokeStyle = "rgba(255,214,120,0.9)"
  ctx.lineWidth = 4 * (1 - t)
  ctx.beginPath()
  ctx.arc(cx, cy, 40 + t * 320 * L.scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

// --- overlays ---------------------------------------------------------------

function scrim(ctx: CanvasRenderingContext2D, g: Game, k: number): void {
  ctx.fillStyle = `rgba(4,3,6,${0.9 * k})`
  ctx.fillRect(0, 0, g.layout.w, g.layout.h)
}

function drawOverlay(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.mode === "seal") drawSeal(ctx, g)
  else if (g.mode === "mark") drawMark(ctx, g)
  else if (g.mode === "quench") drawQuench(ctx, g)
  else if (g.mode === "haul") drawHaul(ctx, g)
}

/** Shared geometry for the two overlays that ask a question. */
export function overlayQuestionRects(g: Game): { panel: Rect; slugs: Rect[] } {
  const L = g.layout
  const S = L.scale
  const pw = Math.min(L.w - L.pad * 2, 720 * S)
  const ph = Math.min(L.h - L.pad * 2, 430 * S)
  const panel: Rect = { x: (L.w - pw) / 2, y: (L.h - ph) / 2, w: pw, h: ph }
  const gap = 10 * S
  const sw = (pw - 40 * S - gap * 3) / 4
  const sh = Math.min(110 * S, ph * 0.26)
  const sy = panel.y + ph - sh - 22 * S
  const slugs: Rect[] = []
  for (let i = 0; i < 4; i++) slugs.push({ x: panel.x + 20 * S + i * (sw + gap), y: sy, w: sw, h: sh })
  return { panel, slugs }
}

function drawSeal(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const k = ease.outQuint(clamp01(g.sealT))
  scrim(ctx, g, k)
  const { panel, slugs } = overlayQuestionRects(g)
  const def = TIERS[g.sealTier]

  ctx.save()
  ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2)
  ctx.scale(0.86 + k * 0.14, 0.86 + k * 0.14)
  ctx.globalAlpha = k
  ctx.translate(-panel.x - panel.w / 2, -panel.y - panel.h / 2)

  plate(ctx, panel.x, panel.y, panel.w, panel.h, {
    chamfer: 20 * S,
    tint: "#141a22",
    rimColor: "rgba(120,200,255,0.6)",
    rimWidth: 2.5,
  })
  chains(ctx, { x: panel.x + 6 * S, y: panel.y + 6 * S, w: panel.w - 12 * S, h: 34 * S }, g.clock)

  text(ctx, def.name, panel.x + panel.w / 2, panel.y + 78 * S, {
    size: Math.round(30 * S),
    align: "center",
    color: PAL.cold,
    tracking: 5 * S,
    glowColor: GLOW_COLD,
  })
  text(ctx, `−${compact(g.economy.tiers[g.sealTier].cost * MICRO)}`, panel.x + panel.w / 2, panel.y + 104 * S, {
    size: Math.round(17 * S),
    mono: true,
    align: "center",
    color: "rgba(255,180,110,0.75)",
  })

  // Two chain runs across the middle, and the question burning through them.
  const midY = panel.y + panel.h * 0.5
  ctx.save()
  ctx.translate(panel.x + panel.w / 2, midY)
  ctx.rotate(-0.12)
  chains(ctx, { x: -panel.w * 0.52, y: -34 * S, w: panel.w * 1.04, h: 30 * S }, g.clock)
  ctx.rotate(0.26)
  chains(ctx, { x: -panel.w * 0.52, y: 12 * S, w: panel.w * 1.04, h: 30 * S }, g.clock * 0.8)
  ctx.restore()
  const burn = ctx.createRadialGradient(
    panel.x + panel.w / 2,
    midY,
    0,
    panel.x + panel.w / 2,
    midY,
    panel.w * 0.34,
  )
  burn.addColorStop(0, "rgba(12,16,22,1)")
  burn.addColorStop(0.55, "rgba(12,16,22,0.92)")
  burn.addColorStop(1, "rgba(12,16,22,0)")
  ctx.fillStyle = burn
  ctx.fillRect(panel.x, midY - panel.h * 0.3, panel.w, panel.h * 0.6)

  const ps = fitSize(ctx, g.q.prompt, panel.w - 70 * S, Math.round(64 * S), true, 2)
  text(ctx, g.q.prompt, panel.x + panel.w / 2, midY + ps * 0.3, {
    size: ps,
    mono: true,
    align: "center",
    color: PAL.white,
    tracking: 2 * S,
    glowColor: GLOW_HOT,
    glowRadius: ps,
  })

  drawSlugs(ctx, g, slugs, g.slugs, Math.round(38 * S))
  ctx.restore()
}

function drawHaul(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const k = ease.outQuint(clamp01(g.sealT))
  scrim(ctx, g, k)
  const { panel, slugs } = overlayQuestionRects(g)

  ctx.save()
  ctx.globalAlpha = k
  plate(ctx, panel.x, panel.y, panel.w, panel.h, {
    chamfer: 20 * S,
    tint: "#1a1410",
    heat: 0.4,
    rimColor: "rgba(255,170,70,0.7)",
    rimWidth: 2.5,
  })

  const hrs = Math.floor(g.haulSeconds / 3600)
  const mins = Math.floor((g.haulSeconds % 3600) / 60)
  const when = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${Math.floor(g.haulSeconds % 60)}s`
  text(ctx, when, panel.x + panel.w / 2, panel.y + 52 * S, {
    size: Math.round(20 * S),
    align: "center",
    color: "rgba(255,190,120,0.8)",
    tracking: 4 * S,
    mono: true,
  })

  const R = readout(g.haul)
  const hs = Math.round(52 * S)
  const label = R.plain ? R.mantissa : `${R.mantissa}×10${superscript(R.exponent)}`
  const fs = fitSize(ctx, label, panel.w - 60 * S, hs, true)
  text(ctx, label, panel.x + panel.w / 2, panel.y + panel.h * 0.36, {
    size: fs,
    mono: true,
    align: "center",
    color: PAL.white,
    glowColor: GLOW_HOT,
    glowRadius: fs,
  })

  const ps = fitSize(ctx, g.q.prompt, panel.w - 80 * S, Math.round(40 * S), true, 2)
  text(ctx, g.q.prompt, panel.x + panel.w / 2, panel.y + panel.h * 0.56, {
    size: ps,
    mono: true,
    align: "center",
    color: PAL.bright,
    tracking: 2 * S,
  })

  drawSlugs(ctx, g, slugs, g.slugs, Math.round(34 * S))
  ctx.restore()
}

export function markRects(g: Game): { panel: Rect; a: Rect; b: Rect } {
  const L = g.layout
  const S = L.scale
  const pw = Math.min(L.w - L.pad * 2, 760 * S)
  const ph = Math.min(L.h - L.pad * 2, 396 * S)
  const panel: Rect = { x: (L.w - pw) / 2, y: (L.h - ph) / 2, w: pw, h: ph }
  const stacked = pw < 520 * S
  if (stacked) {
    const ih = (ph - 190 * S) / 2
    return {
      panel,
      a: { x: panel.x + 24 * S, y: panel.y + 150 * S, w: pw - 48 * S, h: ih - 10 * S },
      b: { x: panel.x + 24 * S, y: panel.y + 150 * S + ih + 6 * S, w: pw - 48 * S, h: ih - 10 * S },
    }
  }
  const iw = (pw - 72 * S) / 2
  const iy = panel.y + 150 * S
  const ih = ph - 190 * S
  return {
    panel,
    a: { x: panel.x + 24 * S, y: iy, w: iw, h: ih },
    b: { x: panel.x + 48 * S + iw, y: iy, w: iw, h: ih },
  }
}

function drawMark(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const m = g.mark
  if (!m) return
  const k = ease.outQuint(clamp01(g.markT))
  scrim(ctx, g, k)
  const { panel, a, b } = markRects(g)
  const rects = [a, b]

  ctx.save()
  ctx.globalAlpha = k
  plate(ctx, panel.x, panel.y, panel.w, panel.h, {
    chamfer: 20 * S,
    tint: "#181410",
    rimColor: "rgba(255,206,84,0.65)",
    rimWidth: 2.5,
  })

  text(ctx, "FORGE MARK", panel.x + panel.w / 2, panel.y + 48 * S, {
    size: Math.round(20 * S),
    align: "center",
    color: PAL.gold,
    tracking: 6 * S,
    glowColor: GLOW_GOLD,
  })

  // The one fact you need: how many you already have. Everything else on this
  // screen is the two expressions being compared.
  const have = `${TIERS[m.tier].name}  ${m.have}`
  text(ctx, have, panel.x + panel.w / 2, panel.y + 108 * S, {
    size: Math.round(34 * S),
    mono: true,
    align: "center",
    color: PAL.white,
    glowColor: GLOW_HOT,
    glowRadius: 60 * S,
  })

  for (let i = 0; i < 2; i++) {
    const r = rects[i]
    const picked = g.markPicked === i
    const other = g.markPicked >= 0 && !picked
    const good = picked && g.markGood
    const pop = picked ? 1 + Math.max(0, 1 - g.quenchT * 5) * 0.14 : 1
    ctx.save()
    ctx.globalAlpha = other ? 0.28 : 1
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2)
    ctx.scale(pop, pop)
    plate(ctx, -r.w / 2, -r.h / 2, r.w, r.h, {
      chamfer: 16 * S,
      heat: good ? 1 : 0.62,
      rimColor: good ? "rgba(255,220,120,1)" : "rgba(255,160,70,0.6)",
      rimWidth: good ? 3.5 : 1.8,
    })
    // The mark stamped into the face of the ingot. Fills the plate, and it is
    // the same glyph the header uses to count marks you have already won.
    ctx.save()
    ctx.globalAlpha = (other ? 0.28 : 1) * 0.14
    text(ctx, "◈", 0, r.h * 0.2, {
      size: Math.round(r.h * 0.8),
      align: "center",
      color: good ? PAL.gold : PAL.white,
    })
    ctx.restore()
    const label = offerLabel(m.offers[i])
    const fs = fitSize(ctx, label, r.w - 34 * S, Math.round(40 * S), true, 1)
    text(ctx, label, 0, fs * 0.34, {
      size: fs,
      mono: true,
      align: "center",
      color: PAL.white,
      glowColor: GLOW_HOT,
      glowRadius: fs,
    })
    // The consequence, small, under the offer: the number this becomes.
    const res = resultingCount(g.economy, m.offers[i]) / MICRO
    text(ctx, `→ ${res}`, 0, fs * 0.34 + 30 * S, {
      size: Math.round(17 * S),
      mono: true,
      align: "center",
      color: g.markPicked >= 0 ? PAL.bright : "rgba(255,200,140,0.0)",
    })
    ctx.restore()
    if (good) glow(ctx, r.x + r.w / 2, r.y + r.h / 2, r.h * 1.2, GLOW_GOLD, 0.7)
  }
  ctx.restore()
}

function drawQuench(ctx: CanvasRenderingContext2D, g: Game): void {
  const L = g.layout
  const S = L.scale
  const e = g.economy

  if (g.quenchPhase === "confirm") {
    const k = ease.outQuint(clamp01(g.quenchT))
    scrim(ctx, g, k)
    const pw = Math.min(L.w - L.pad * 2, 700 * S)
    const ph = Math.min(L.h - L.pad * 2, 470 * S)
    const panel: Rect = { x: (L.w - pw) / 2, y: (L.h - ph) / 2, w: pw, h: ph }
    ctx.save()
    ctx.globalAlpha = k
    plate(ctx, panel.x, panel.y, panel.w, panel.h, {
      chamfer: 20 * S,
      tint: "#0e1a22",
      rimColor: "rgba(99,224,255,0.7)",
      rimWidth: 2.5,
    })
    text(ctx, "QUENCH", panel.x + panel.w / 2, panel.y + 52 * S, {
      size: Math.round(22 * S),
      align: "center",
      color: PAL.cold,
      tracking: 7 * S,
      glowColor: GLOW_COLD,
    })

    // The prestige formula, shown as the radical it actually is. This is the
    // single most valuable frame in the game: the reward IS the square root,
    // and the player watches the inside of the radical grow all session.
    const R = readout(e.lifetime, 3)
    const inner = R.plain ? R.mantissa : `${R.mantissa}×10${superscript(R.exponent)}`
    const floorExp = QUENCH_FLOOR.toString().length - 1
    const expr = `√( ${inner} / 10${superscript(floorExp)} )`
    const fs = fitSize(ctx, expr, panel.w - 70 * S, Math.round(38 * S), true, 1)
    text(ctx, expr, panel.x + panel.w / 2, panel.y + panel.h * 0.36, {
      size: fs,
      mono: true,
      align: "center",
      color: "rgba(232,226,214,0.72)",
    })
    // The middle step, in figures. Three lines of pure arithmetic and not one
    // word of explanation: the child sees the big number shrink to a small one
    // and then sees the root of it. This is the best teaching moment in the
    // game, and it is also the reward screen.
    const under = e.lifetime / MICRO / QUENCH_FLOOR
    const mid = `√ ${compact(under * MICRO)}`
    const ms = fitSize(ctx, mid, panel.w - 90 * S, Math.round(44 * S), true, 1)
    text(ctx, mid, panel.x + panel.w / 2, panel.y + panel.h * 0.53, {
      size: ms,
      mono: true,
      align: "center",
      color: PAL.text,
    })
    // The result of the ROOT, not the gain. `sqrt(410) = 6` would be a false
    // equation, and this is a maths game: the line under a radical says what
    // the radical evaluates to. What the plunge is worth on top of the carbon
    // already banked is on the button, where it belongs.
    const total = e.carbon + g.quenchGain
    text(ctx, `= ${total}`, panel.x + panel.w / 2, panel.y + panel.h * 0.74, {
      size: Math.round(52 * S),
      mono: true,
      align: "center",
      color: PAL.cold,
      glowColor: GLOW_COLD,
      glowRadius: 90 * S,
    })
    text(ctx, "CARBON", panel.x + panel.w / 2, panel.y + panel.h * 0.82, {
      size: Math.round(14 * S),
      align: "center",
      color: "rgba(99,224,255,0.7)",
      tracking: 5 * S,
    })

    const bw = Math.min(300 * S, panel.w - 60 * S)
    const bx = panel.x + (panel.w - bw) / 2
    const by = panel.y + panel.h - 82 * S
    const pulse = 0.5 + 0.5 * Math.sin(g.clock * 4)
    plate(ctx, bx, by, bw, 58 * S, {
      chamfer: 12 * S,
      tint: "#12414f",
      rimColor: `rgba(99,224,255,${0.55 + pulse * 0.45})`,
      rimWidth: 2.5,
    })
    glow(ctx, bx + bw / 2, by + 29 * S, 60 * S, GLOW_COLD, 0.2 + pulse * 0.25)
    text(ctx, "PLUNGE", bx + bw * 0.42, by + 38 * S, {
      size: Math.round(24 * S),
      align: "center",
      color: PAL.white,
      tracking: 6 * S,
    })
    text(ctx, `◆ +${g.quenchGain}`, bx + bw - 16 * S, by + 38 * S, {
      size: Math.round(20 * S),
      mono: true,
      align: "right",
      color: PAL.cold,
    })
    ctx.restore()
    return
  }

  // Steam and reignition are full-screen effects; the particles carry them.
  const t = clamp01(g.quenchT)
  if (g.quenchPhase === "steam") {
    ctx.fillStyle = `rgba(200,230,255,${0.28 * (1 - t)})`
    ctx.fillRect(0, 0, L.w, L.h)
    text(ctx, `◆ ${e.carbon}`, L.w / 2, L.h / 2, {
      size: Math.round(78 * S),
      mono: true,
      align: "center",
      color: PAL.cold,
      alpha: clamp01(1 - Math.abs(t - 0.5) * 2.4),
      glowColor: GLOW_COLD,
      glowRadius: 150 * S,
    })
  } else {
    ctx.fillStyle = `rgba(255,120,20,${0.2 * (1 - t)})`
    ctx.fillRect(0, 0, L.w, L.h)
  }
}
