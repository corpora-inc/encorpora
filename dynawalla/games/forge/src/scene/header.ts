// The readout, the heat gauge, the permanent multipliers and the quench plate.

import { MICRO, rateText, readout } from "../core/bigmath.ts"
import { heatBonus, sparksPerSecond } from "../core/economy.ts"
import type { Game } from "../game/types.ts"
import { GLOW_COLD, GLOW_GOLD, GLOW_HOT, PAL, chamferRect, glow, measure, plate, text } from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"
import { fitSize } from "./common.ts"

// --- header -----------------------------------------------------------------

export function drawHeader(ctx: CanvasRenderingContext2D, g: Game): void {
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
