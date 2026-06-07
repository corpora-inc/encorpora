/**
 * resultArt — the score-tiered MOOD + procedural crest for the challenge result
 * card. No emoji, no congratulating failure: the icon, headline, color and
 * confetti all tier WITH the score, so a 0% reads as a quiet "not this time"
 * and a 90% reads as a celebration. (Fixes the "0% shows a bicep-flex" bug.)
 *
 * The crest is painted on a DPR-aware canvas in the same warm-paper language as
 * `items/itemArt.ts` (a deckled disc + a single legible motif), so it sits in
 * the same icon family as the coins/XP/item glyphs the rows render. The small
 * row glyphs (XP / coins / item) come straight from the shared `iconRenderer`.
 */

import { iconRenderer } from "../economy/currencies"
import type { IconSpec } from "../contracts/runtime"

export type ResultTier = "fail" | "low" | "mid" | "high" | "perfect"

export interface ResultMood {
  tier: ResultTier
  /** headline tone copy (English source; localized by the i18n slice). */
  titleKey: "result.fail" | "result.low" | "result.mid" | "result.high" | "result.perfect"
  /** the warm-paper background gradient for the reward panel. */
  panelBg: string
  /** the amount/value ink color (muted on a miss, green-gold on a win). */
  amountColor: string
  /** headline ink. */
  titleColor: string
  /** whether to throw confetti (only an actual win earns it). */
  celebrate: boolean
}

/** Map a 0..1 score to its mood tier + palette. The tiers are non-celebratory
 *  below 0.5 — a miss is acknowledged with dignity, never a flex or confetti. */
export function moodForScore(score01: number): ResultMood {
  const s = Math.max(0, Math.min(1, score01))
  if (s >= 0.92)
    return {
      tier: "perfect",
      titleKey: "result.perfect",
      panelBg: "radial-gradient(120% 90% at 50% 26%, #fff8ea, #f6dca0)",
      amountColor: "#2f9e3f",
      titleColor: "#b6451f",
      celebrate: true,
    }
  if (s >= 0.75)
    return {
      tier: "high",
      titleKey: "result.high",
      panelBg: "radial-gradient(120% 90% at 50% 26%, #fff7e6, #f3d99a)",
      amountColor: "#2f9e3f",
      titleColor: "#b6451f",
      celebrate: true,
    }
  if (s >= 0.5)
    return {
      tier: "mid",
      titleKey: "result.mid",
      panelBg: "radial-gradient(120% 90% at 50% 26%, #fbf4e6, #ecdcc0)",
      amountColor: "#3f8f4a",
      titleColor: "#9a5a2c",
      celebrate: false,
    }
  if (s > 0)
    return {
      tier: "low",
      titleKey: "result.low",
      // cooler, calmer paper — no gold, no celebration
      panelBg: "radial-gradient(120% 90% at 50% 26%, #f5f1ea, #e2dccf)",
      amountColor: "#6a6258",
      titleColor: "#6b5a44",
      celebrate: false,
    }
  return {
    tier: "fail",
    titleKey: "result.fail",
    // the quietest, most neutral surface — a miss is acknowledged, not punished
    panelBg: "radial-gradient(120% 90% at 50% 26%, #f3f0ea, #ddd7cc)",
    amountColor: "#7a7268",
    titleColor: "#675c4c",
    celebrate: false,
  }
}

/**
 * Paint the big tiered result crest into a DPR-aware canvas:
 *   perfect/high → a radiant medal star (gold)
 *   mid          → a checked seal (warm)
 *   low          → a simple ring (calm)
 *   fail         → a quiet "retry" arrow loop on slate — NEVER celebratory
 */
export function renderResultCrest(tier: ResultTier, size = 72): HTMLCanvasElement {
  const dpr = Math.max(1, Math.min(3, (globalThis.devicePixelRatio || 1)))
  const c = document.createElement("canvas")
  c.width = Math.round(size * dpr)
  c.height = Math.round(size * dpr)
  c.style.width = `${size}px`
  c.style.height = `${size}px`
  const ctx = c.getContext("2d")!
  ctx.scale(dpr, dpr)
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.4

  const palette: Record<ResultTier, { hi: string; mid: string; lo: string; ink: string }> = {
    perfect: { hi: "#ffeeb0", mid: "#e8b73c", lo: "#b07d1d", ink: "#6e4d10" },
    high: { hi: "#ffe9a6", mid: "#e3ad3c", lo: "#a8761d", ink: "#6e4d10" },
    mid: { hi: "#f3d79a", mid: "#c79a4a", lo: "#8a6526", ink: "#5c4216" },
    low: { hi: "#e6dfd2", mid: "#c8bda8", lo: "#9a8f7c", ink: "#5a5346" },
    fail: { hi: "#dcd6cc", mid: "#b6ab9c", lo: "#897f70", ink: "#544c40" },
  }
  const pal = palette[tier]

  // contact shadow + cream deckle (shared paper look)
  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.3)"
  ctx.shadowBlur = size * 0.12
  ctx.shadowOffsetY = size * 0.05
  ctx.fillStyle = "#fff8ec"
  ctx.beginPath()
  ctx.arc(cx, cy, r + size * 0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // disc body — radial bevel
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
  g.addColorStop(0, pal.hi)
  g.addColorStop(0.5, pal.mid)
  g.addColorStop(1, pal.lo)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = size * 0.045
  ctx.strokeStyle = pal.lo
  ctx.beginPath()
  ctx.arc(cx, cy, r - size * 0.02, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = pal.ink
  ctx.strokeStyle = pal.ink
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  if (tier === "perfect" || tier === "high") {
    // radiant star
    drawStar(ctx, cx, cy, r * 0.62, r * 0.26, tier === "perfect" ? 5 : 5)
    ctx.fill()
    if (tier === "perfect") {
      // a few rays
      ctx.lineWidth = size * 0.03
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7)
        ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92)
        ctx.stroke()
      }
    }
  } else if (tier === "mid") {
    // a checkmark — competent, modest
    ctx.lineWidth = size * 0.08
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.42, cy + r * 0.02)
    ctx.lineTo(cx - r * 0.08, cy + r * 0.38)
    ctx.lineTo(cx + r * 0.5, cy - r * 0.38)
    ctx.stroke()
  } else if (tier === "low") {
    // a calm centered ring — "cleared, just"
    ctx.lineWidth = size * 0.07
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    // fail — a quiet retry loop (counter-clockwise arc + arrowhead). NOT an X
    // (an X reads as punitive) and NEVER a flex.
    ctx.lineWidth = size * 0.07
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.46, Math.PI * 0.35, Math.PI * 1.75)
    ctx.stroke()
    // arrowhead at the arc start
    const a = Math.PI * 0.35
    const hx = cx + Math.cos(a) * r * 0.46
    const hy = cy + Math.sin(a) * r * 0.46
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx - r * 0.04, hy - r * 0.24)
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx + r * 0.22, hy - r * 0.08)
    ctx.stroke()
  }

  // top glint
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.3, r * 0.16, -0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  return c
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points: number,
) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2
    const rr = i % 2 === 0 ? outer : inner
    const px = cx + Math.cos(a) * rr
    const py = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/* ---- small reward-row glyphs (shared procedural renderer, never emoji) ---- */

/** XP — a small star token medal. */
export function renderXpIcon(size = 22): HTMLCanvasElement {
  const spec: IconSpec = {
    family: "medal",
    palette: "#e8b73c",
    motif: "star",
    tier: "gold",
    metal: "gold",
  }
  return iconRenderer().renderIcon(spec, { size })
}

/** Coins — a round gold coin disc. */
export function renderCoinIcon(size = 22): HTMLCanvasElement {
  const spec: IconSpec = {
    family: "coin-round",
    palette: "#e8b73c",
    metal: "gold",
    motif: "sun",
  }
  return iconRenderer().renderIcon(spec, { size })
}

/** Item chip glyph — a token (rare → a sealed/epic token). */
export function renderItemIcon(id: string, size = 22): HTMLCanvasElement {
  const rare = /rare|token|relic|gem/i.test(id)
  const spec: IconSpec = rare
    ? { family: "gem-faceted", palette: "#c9a4ff", rarity: "epic", motif: "star" }
    : { family: "token", palette: "#d9b06a", motif: "seal" }
  return iconRenderer().renderIcon(spec, { size })
}
