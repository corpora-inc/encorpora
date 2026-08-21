// The anvil, the work bar, the hammer and the four cast ingots.

import type { Game } from "../game/types.ts"
import type { Rect } from "../game/layout.ts"
import { GLOW_GOLD, GLOW_HOT, GLOW_WHITE, PAL, chamferRect, glow, plate, text } from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"
import { fitSize } from "./common.ts"

// --- the workbench ----------------------------------------------------------

export function drawAnvil(ctx: CanvasRenderingContext2D, g: Game): void {
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
