// The four full-screen moments: cracking a seal, claiming a haul, taking a
// forge mark, and plunging the forge.

import { MICRO, compact, readout, superscript } from "../core/bigmath.ts"
import { QUENCH_FLOOR, TIERS } from "../core/economy.ts"
import type { Rect } from "../game/layout.ts"
import { offerLabel, resultingCount } from "../game/marks.ts"
import type { Game } from "../game/types.ts"
import { GLOW_COLD, GLOW_GOLD, GLOW_HOT, PAL, glow, plate, text } from "../render/gfx.ts"
import { clamp01, ease } from "../render/juice.ts"
import { chains, fitSize } from "./common.ts"
import { drawSlugs } from "./workbench.ts"

// --- overlays ---------------------------------------------------------------

function scrim(ctx: CanvasRenderingContext2D, g: Game, k: number): void {
  ctx.fillStyle = `rgba(4,3,6,${0.9 * k})`
  ctx.fillRect(0, 0, g.layout.w, g.layout.h)
}

export function drawOverlay(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.mode === "seal") drawSeal(ctx, g)
  else if (g.mode === "mark") drawMark(ctx, g)
  else if (g.mode === "quench") drawQuench(ctx, g)
  else if (g.mode === "haul") drawHaul(ctx, g)
}

/** Shared geometry for the two overlays that ask a question. */
export function overlayQuestionRects(g: Game): { panel: Rect; slugs: Rect[] } {
  const L = g.layout
  const S = L.scale
  const pw = Math.min(L.safe.w - L.pad * 2, 720 * S)
  const ph = Math.min(L.safe.h - L.pad * 2, 430 * S)
  const panel: Rect = {
    x: L.safe.x + (L.safe.w - pw) / 2,
    y: L.safe.y + (L.safe.h - ph) / 2,
    w: pw,
    h: ph,
  }
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
  const pw = Math.min(L.safe.w - L.pad * 2, 760 * S)
  const ph = Math.min(L.safe.h - L.pad * 2, 396 * S)
  const panel: Rect = {
    x: L.safe.x + (L.safe.w - pw) / 2,
    y: L.safe.y + (L.safe.h - ph) / 2,
    w: pw,
    h: ph,
  }
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
    const pw = Math.min(L.safe.w - L.pad * 2, 700 * S)
    const ph = Math.min(L.safe.h - L.pad * 2, 470 * S)
    const panel: Rect = {
      x: L.safe.x + (L.safe.w - pw) / 2,
      y: L.safe.y + (L.safe.h - ph) / 2,
      w: pw,
      h: ph,
    }
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
