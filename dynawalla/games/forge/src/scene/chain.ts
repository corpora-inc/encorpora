// The station column: six mounted plates, each showing what it makes and what
// the next one costs.

import { MICRO, compact, rateText } from "../core/bigmath.ts"
import { DOUBLE_EVERY, TIERS, canBuy, doublings, isRevealed, tierCount, tierOutputPerSecond } from "../core/economy.ts"
import type { Rect } from "../game/layout.ts"
import type { Game } from "../game/types.ts"
import { GLOW_GOLD, GLOW_HOT, PAL, chamferRect, glow, measure, pips, plate, text } from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"
import { chains, chevron, fitSize } from "./common.ts"

// --- the station column -----------------------------------------------------

export function drawChain(ctx: CanvasRenderingContext2D, g: Game): void {
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
