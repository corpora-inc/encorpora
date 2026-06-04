/**
 * itemArt — the shared procedural IconRenderer for World Plaza (SEAM 2).
 *
 * One renderer paints EVERY small icon the game shows: economy currency discs /
 * note-stacks / gems, badge medals with tier frames, and the ~50 inventory item
 * families. It is the literal "kill the emoji / no-placeholders" payoff: a
 * premium, seed-deterministic, paper-world icon system with ZERO binary assets.
 *
 * Consumers (economy / badges / inventory / HUD) code against the frozen
 * `IconRenderer` interface in `src/contracts/runtime.ts` and the documented stub
 * disc; the real pixels here swap in with no call-site change.
 *
 * Art language (shared with `world/cutoutArt.ts`): layered cut paper in a cozy
 * pop-up-book. A soft contact shadow, a cream torn-paper deckle rim, the colour
 * body, then small painted detail + a rarity frame. Warm-Antigua-friendly but
 * era/finish-flexible (metal coins, woven cloth, faceted gems all live here).
 *
 * Performance: canvas is sized at `devicePixelRatio` so it's crisp at any DPR,
 * and every painted icon is cached by a deterministic spec key (the same spec at
 * the same size returns the same canvas — currencies/badges re-render often).
 *
 * 3D upgrade seam: a Spark/glTF model swap lives behind `WorldLook` /
 * `createGroundedCutout` (see docs/WORLD_DIRECTION.md). This module stays the 2D
 * fallback; callers are unchanged when the 3D look slots in. (Noted, not built.)
 */

import type {
  IconSpec,
  IconRenderer,
  IconRenderTarget,
  IconFamily,
  IconFinish,
  IconRarity,
} from "../contracts/runtime"
import type { BadgeTier } from "@world-plaza/contracts"

/* ====================================================================== *
 * Deterministic RNG — same seed → same icon. We pull from CURATED,
 * art-directed shape/jitter bags (small, tasteful variety) rather than
 * unconstrained noise, so two icons are never confusable and none look
 * like static.
 * ====================================================================== */

function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — tiny, fast, good-enough deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ====================================================================== *
 * Colour helpers — warm paper palette math.
 * ====================================================================== */

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h || "888888", 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}
function shade(hex: string, amt: number): string {
  // amt < 0 darken, > 0 lighten toward white
  const [r, g, b] = hexToRgb(hex)
  const t = amt < 0 ? 0 : 255
  const k = Math.abs(amt)
  return rgb(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k)
}
function withAlpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}
/** rotate a hue to derive a harmonious accent when none was supplied. */
function harmonize(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex)
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  const l = (max + min) / 510
  let hh = 0
  const d = max - min
  if (d !== 0) {
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255
    const mx = Math.max(rn, gn, bn)
    if (mx === rn) hh = ((gn - bn) / (d / 255)) % 6
    else if (mx === gn) hh = (bn - rn) / (d / 255) + 2
    else hh = (rn - gn) / (d / 255) + 4
    hh *= 60
  }
  const s = d === 0 ? 0 : d / 255 / (1 - Math.abs(2 * l - 1) || 1)
  hh = (hh + deg + 360) % 360
  // hsl → rgb
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = l - c / 2
  let rr = 0,
    gg = 0,
    bb = 0
  if (hh < 60) [rr, gg, bb] = [c, x, 0]
  else if (hh < 120) [rr, gg, bb] = [x, c, 0]
  else if (hh < 180) [rr, gg, bb] = [0, c, x]
  else if (hh < 240) [rr, gg, bb] = [0, x, c]
  else if (hh < 300) [rr, gg, bb] = [x, 0, c]
  else [rr, gg, bb] = [c, 0, x]
  return rgb((rr + m) * 255, (gg + m) * 255, (bb + m) * 255)
}

/* ====================================================================== *
 * Metal palettes for coins / ingots / medals — beveled-metal stops.
 * ====================================================================== */

type MetalTone = "gold" | "silver" | "copper" | "bronze" | "patina"
interface MetalRamp {
  rim: string
  hi: string
  mid: string
  lo: string
  emblem: string
}
const METALS: Record<MetalTone, MetalRamp> = {
  gold: { rim: "#a9831f", hi: "#ffeeb0", mid: "#e8b73c", lo: "#b07d1d", emblem: "#6e4d10" },
  silver: { rim: "#9aa0a8", hi: "#ffffff", mid: "#d6dbe1", lo: "#9097a0", emblem: "#5a606a" },
  copper: { rim: "#9a5a2b", hi: "#ffce9e", mid: "#e08a47", lo: "#a35e2b", emblem: "#6a3818" },
  bronze: { rim: "#8a6a2c", hi: "#f3d79a", mid: "#c79a4a", lo: "#8a6526", emblem: "#5c4216" },
  patina: { rim: "#3f7a6c", hi: "#bfe9da", mid: "#6cae9c", lo: "#3d7567", emblem: "#27514a" },
}

/** Badge tier → the medal metal it wears. `locked` is a dim slate. */
const TIER_METAL: Record<Exclude<BadgeTier, "locked">, MetalTone> = {
  bronze: "bronze",
  silver: "silver",
  gold: "gold",
  platinum: "patina", // platinum = soft iridescent rim (NOT a loud rainbow); cool tone base
}

/* ====================================================================== *
 * Canvas / paper primitives (DPR-aware; mirror cutoutArt's deckle look).
 * ====================================================================== */

function makeCanvas(size: number, dpr: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.round(size * dpr))
  c.height = c.width
  c.style.width = `${size}px`
  c.style.height = `${size}px`
  const ctx = c.getContext("2d")!
  ctx.scale(dpr, dpr) // draw in CSS px, crisp on retina
  return { c, ctx }
}

/** A wobbly hand-cut blob path (the torn-paper rim), deterministic by seed. */
function tornPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  amp: number,
  jit: () => number,
) {
  const steps = 48
  const a = jit() * Math.PI * 2
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const wob = Math.sin(t * 7 + a) * Math.cos(t * 4 + a * 1.7) * amp
    const px = cx + Math.cos(t) * (rx + wob)
    const py = cy + Math.sin(t) * (ry + wob)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Soft contact shadow under whatever the next fill draws (paper floats). */
function withShadow(ctx: CanvasRenderingContext2D, blur: number, fn: () => void) {
  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.34)"
  ctx.shadowBlur = blur
  ctx.shadowOffsetY = blur * 0.5
  fn()
  ctx.restore()
}

/* ====================================================================== *
 * Finish — a thin material treatment painted over a body fill.
 *   matte  → flat, soft top sheen
 *   glazed → glossy specular streak
 *   metal  → strong bevel highlight
 *   woven  → cross-hatch thread texture
 * ====================================================================== */

function applyFinish(
  ctx: CanvasRenderingContext2D,
  finish: IconFinish | undefined,
  s: number,
  body: string,
) {
  const f = finish ?? "matte"
  if (f === "woven") {
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.strokeStyle = shade(body, -0.35)
    ctx.lineWidth = Math.max(0.6, s * 0.018)
    const gap = Math.max(3, s * 0.09)
    for (let i = -s; i < s * 2; i += gap) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + s, s)
      ctx.moveTo(i + s, 0)
      ctx.lineTo(i, s)
      ctx.stroke()
    }
    ctx.restore()
    return
  }
  const g = ctx.createLinearGradient(0, 0, 0, s)
  if (f === "metal") {
    g.addColorStop(0, "rgba(255,255,255,0.5)")
    g.addColorStop(0.4, "rgba(255,255,255,0.05)")
    g.addColorStop(1, "rgba(0,0,0,0.22)")
  } else if (f === "glazed") {
    g.addColorStop(0, "rgba(255,255,255,0.42)")
    g.addColorStop(0.5, "rgba(255,255,255,0)")
    g.addColorStop(1, "rgba(0,0,0,0.14)")
  } else {
    g.addColorStop(0, "rgba(255,255,255,0.18)")
    g.addColorStop(0.5, "rgba(255,255,255,0)")
    g.addColorStop(1, "rgba(0,0,0,0.12)")
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  if (f === "glazed") {
    // a single bright specular streak
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(s * 0.36, s * 0.3, s * 0.1, s * 0.26, -0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

/* ====================================================================== *
 * Rarity frame — a legible-at-a-glance corner/sheen treatment, NOT a
 * coloured-border hack. common→none, rare→cream deckle ring,
 * epic→gilt corner flourishes, seasonal→soft iridescent glow + stars.
 * ====================================================================== */

const RARITY_RING: Record<IconRarity, string | null> = {
  common: null,
  rare: "#f3e7c9",
  epic: "#e8c25a",
  seasonal: "#caa6f2",
}

function drawRarityFrame(ctx: CanvasRenderingContext2D, s: number, rarity: IconRarity | undefined) {
  const r = rarity ?? "common"
  if (r === "common") return
  const m = s * 0.5
  if (r === "rare") {
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = RARITY_RING.rare!
    ctx.lineWidth = Math.max(1, s * 0.035)
    roundRect(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.16)
    ctx.stroke()
    ctx.restore()
    return
  }
  if (r === "epic") {
    // gilt L-corner flourishes
    ctx.save()
    ctx.strokeStyle = RARITY_RING.epic!
    ctx.lineWidth = Math.max(1.2, s * 0.05)
    ctx.lineCap = "round"
    const k = s * 0.18
    const corners = [
      [s * 0.08, s * 0.08, 1, 1],
      [s * 0.92, s * 0.08, -1, 1],
      [s * 0.08, s * 0.92, 1, -1],
      [s * 0.92, s * 0.92, -1, -1],
    ]
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath()
      ctx.moveTo(x, y + dy * k)
      ctx.lineTo(x, y)
      ctx.lineTo(x + dx * k, y)
      ctx.stroke()
    }
    ctx.restore()
    return
  }
  // seasonal — iridescent glow ring + tiny sparkles
  ctx.save()
  const glow = ctx.createRadialGradient(m, m, s * 0.3, m, m, s * 0.52)
  glow.addColorStop(0, "rgba(202,166,242,0)")
  glow.addColorStop(1, withAlpha(RARITY_RING.seasonal!, 0.55))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, s, s)
  ctx.fillStyle = "#fff7e8"
  for (const [ax, ay, ar] of [
    [s * 0.16, s * 0.2, s * 0.035],
    [s * 0.84, s * 0.26, s * 0.05],
    [s * 0.8, s * 0.82, s * 0.03],
    [s * 0.2, s * 0.8, s * 0.045],
  ]) {
    star(ctx, ax, ay, ar)
  }
  ctx.restore()
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const rr = i % 2 === 0 ? r : r * 0.42
    const px = cx + Math.cos(a) * rr
    const py = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

/* ====================================================================== *
 * Emblems — a small curated motif drawn on a coin / medal / seal face.
 * Keyed by motif id (with graceful fallbacks). Drawn in a single colour
 * (the metal's emblem tone or a contrast ink) so it reads at 24px.
 * ====================================================================== */

type EmblemFn = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void

const EMBLEMS: Record<string, EmblemFn> = {
  castle: (ctx, cx, cy, r) => {
    const w = r * 1.4,
      h = r * 1.1
    ctx.beginPath()
    ctx.rect(cx - w / 2, cy - h * 0.1, w, h * 0.7)
    ctx.fill()
    // crenellations
    const n = 4
    const cw = w / (n * 2 - 1)
    for (let i = 0; i < n; i++) {
      ctx.fillRect(cx - w / 2 + i * cw * 2, cy - h * 0.32, cw, h * 0.26)
    }
    // door
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.rect(cx - r * 0.16, cy + h * 0.12, r * 0.32, h * 0.46)
    ctx.fill()
    ctx.restore()
  },
  quetzal: (ctx, cx, cy, r) => {
    // a stylized long-tailed bird
    ctx.beginPath()
    ctx.ellipse(cx, cy - r * 0.2, r * 0.42, r * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(cx + r * 0.1, cy + r * 0.1)
    ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.9, cx - r * 0.1, cy + r * 1.2)
    ctx.quadraticCurveTo(cx + r * 0.2, cy + r * 0.6, cx - r * 0.05, cy + r * 0.2)
    ctx.fill()
    // beak
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.4, cy - r * 0.3)
    ctx.lineTo(cx - r * 0.7, cy - r * 0.2)
    ctx.lineTo(cx - r * 0.38, cy - r * 0.12)
    ctx.fill()
  },
  eagle: (ctx, cx, cy, r) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 0.55)
    ctx.quadraticCurveTo(cx + r, cy - r * 0.4, cx + r * 0.5, cy + r * 0.5)
    ctx.quadraticCurveTo(cx, cy + r * 0.2, cx - r * 0.5, cy + r * 0.5)
    ctx.quadraticCurveTo(cx - r, cy - r * 0.4, cx, cy - r * 0.55)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy - r * 0.5, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  },
  chrysanthemum: (ctx, cx, cy, r) => {
    const n = 12
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.3, r * 0.14, a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2)
    ctx.fill()
  },
  sun: (ctx, cx, cy, r) => {
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = r * 0.16
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.lineCap = "round"
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66)
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95)
      ctx.stroke()
    }
  },
  wreath: (ctx, cx, cy, r) => {
    ctx.lineWidth = r * 0.16
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.7, Math.PI * 0.2, Math.PI * 0.8)
    ctx.arc(cx, cy, r * 0.7, Math.PI * 1.2, Math.PI * 1.8)
    ctx.stroke()
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 0.45 + (i / 5) * Math.PI * 0.6
        const bx = cx + Math.cos(a) * r * 0.7 * side
        const by = cy + Math.sin(a) * r * 0.7
        ctx.beginPath()
        ctx.ellipse(bx, by, r * 0.12, r * 0.05, a, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  },
  star: (ctx, cx, cy, r) => star(ctx, cx, cy, r * 0.7),
  book: (ctx, cx, cy, r) => {
    ctx.beginPath()
    ctx.rect(cx - r * 0.6, cy - r * 0.45, r * 0.55, r * 0.9)
    ctx.rect(cx + r * 0.05, cy - r * 0.45, r * 0.55, r * 0.9)
    ctx.fill()
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.lineWidth = r * 0.06
    ctx.strokeStyle = "#000"
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.5, cy + i * r * 0.16)
      ctx.lineTo(cx - r * 0.15, cy + i * r * 0.16)
      ctx.moveTo(cx + r * 0.15, cy + i * r * 0.16)
      ctx.lineTo(cx + r * 0.5, cy + i * r * 0.16)
      ctx.stroke()
    }
    ctx.restore()
  },
  ear: (ctx, cx, cy, r) => {
    // listening / sound waves
    ctx.lineWidth = r * 0.16
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.lineCap = "round"
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(cx - r * 0.5, cy, r * 0.3 * i, -Math.PI * 0.4, Math.PI * 0.4)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(cx - r * 0.5, cy, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  },
  speech: (ctx, cx, cy, r) => {
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.6, cy - r * 0.5)
    ctx.lineTo(cx + r * 0.6, cy - r * 0.5)
    ctx.quadraticCurveTo(cx + r * 0.8, cy - r * 0.5, cx + r * 0.8, cy)
    ctx.lineTo(cx + r * 0.8, cy + r * 0.2)
    ctx.quadraticCurveTo(cx + r * 0.8, cy + r * 0.4, cx + r * 0.5, cy + r * 0.4)
    ctx.lineTo(cx - r * 0.2, cy + r * 0.4)
    ctx.lineTo(cx - r * 0.45, cy + r * 0.75)
    ctx.lineTo(cx - r * 0.4, cy + r * 0.4)
    ctx.quadraticCurveTo(cx - r * 0.8, cy + r * 0.4, cx - r * 0.8, cy)
    ctx.quadraticCurveTo(cx - r * 0.8, cy - r * 0.5, cx - r * 0.6, cy - r * 0.5)
    ctx.fill()
  },
  greetings: (ctx, cx, cy, r) => EMBLEMS.speech(ctx, cx, cy, r),
  leaf: (ctx, cx, cy, r) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 0.7)
    ctx.quadraticCurveTo(cx + r * 0.6, cy, cx, cy + r * 0.7)
    ctx.quadraticCurveTo(cx - r * 0.6, cy, cx, cy - r * 0.7)
    ctx.fill()
  },
  gear: (ctx, cx, cy, r) => {
    const teeth = 8
    ctx.beginPath()
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2
      const rr = i % 2 === 0 ? r * 0.7 : r * 0.5
      const px = cx + Math.cos(a) * rr
      const py = cy + Math.sin(a) * rr
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.24, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },
  compass: (ctx, cx, cy, r) => {
    ctx.lineWidth = r * 0.1
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy - r * 0.5)
    ctx.lineTo(cx + r * 0.22, cy)
    ctx.lineTo(cx, cy + r * 0.5)
    ctx.lineTo(cx - r * 0.22, cy)
    ctx.closePath()
    ctx.fill()
  },
}

function drawEmblem(ctx: CanvasRenderingContext2D, motif: string | undefined, cx: number, cy: number, r: number, ink: string) {
  const key = motif ?? ""
  const fn = EMBLEMS[key] ?? EMBLEMS[FALLBACK_EMBLEM[key] ?? ""] ?? null
  ctx.save()
  ctx.fillStyle = ink
  if (fn) fn(ctx, cx, cy, r)
  else {
    // generic crest: a clean ringed dot — never an emoji/placeholder, always "money-ish"
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.restore()
}

/** Map unknown motif ids to a sensible curated emblem. */
const FALLBACK_EMBLEM: Record<string, string> = {
  travel: "compass",
  social: "speech",
  numbers: "star",
  reading: "book",
  listening: "ear",
  grammar: "gear",
  food: "leaf",
  nature: "leaf",
  city: "castle",
}

/* ====================================================================== *
 * FAMILY PAINTERS — each draws one icon body into a CSS-px box of `s`.
 * ====================================================================== */

interface Ctx {
  ctx: CanvasRenderingContext2D
  s: number
  spec: IconSpec
  jit: () => number
  metal: MetalRamp
}

/** Beveled metal coin disc + emblem + milled edge. */
function paintCoin(p: Ctx, squareHole: boolean) {
  const { ctx, s, spec, jit, metal } = p
  const cx = s / 2,
    cy = s / 2
  const r = s * 0.42
  // contact shadow + cream deckle
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff8ec"
    tornPath(ctx, cx, cy, r + s * 0.05, r + s * 0.05, s * 0.02, jit)
    ctx.fill()
  })
  // metal body — radial bevel
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
  g.addColorStop(0, metal.hi)
  g.addColorStop(0.5, metal.mid)
  g.addColorStop(1, metal.lo)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  // milled edge ring
  ctx.lineWidth = s * 0.05
  ctx.strokeStyle = metal.rim
  ctx.beginPath()
  ctx.arc(cx, cy, r - s * 0.025, 0, Math.PI * 2)
  ctx.stroke()
  // milled ticks
  ctx.strokeStyle = withAlpha(metal.rim, 0.6)
  ctx.lineWidth = Math.max(0.5, s * 0.02)
  const ticks = 28
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * (r - s * 0.04), cy + Math.sin(a) * (r - s * 0.04))
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.stroke()
  }
  if (squareHole) {
    ctx.save()
    ctx.globalCompositeOperation = "destination-out"
    const hw = r * 0.42
    ctx.fillRect(cx - hw / 2, cy - hw / 2, hw, hw)
    ctx.restore()
    // re-stamp a faint ring of glyphs around the hole instead of a central emblem
    ctx.fillStyle = withAlpha(metal.emblem, 0.8)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, s * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    drawEmblem(ctx, spec.motif, cx, cy, r * 0.78, withAlpha(metal.emblem, 0.92))
  }
  // top glint
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.3, r * 0.16, -0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Angled metal ingot bar with a stamped weight. */
function paintIngot(p: Ctx) {
  const { ctx, s, spec, jit, metal } = p
  const cx = s / 2,
    cy = s / 2
  const w = s * 0.7,
    h = s * 0.42
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.12 + (jit() - 0.5) * 0.1)
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff8ec"
    roundRect(ctx, -w / 2 - s * 0.04, -h / 2 - s * 0.04, w + s * 0.08, h + s * 0.08, s * 0.06)
    ctx.fill()
  })
  // trapezoid top face for a 3D bar
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, metal.hi)
  g.addColorStop(0.45, metal.mid)
  g.addColorStop(1, metal.lo)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-w / 2 + s * 0.06, -h / 2)
  ctx.lineTo(w / 2 - s * 0.06, -h / 2)
  ctx.lineTo(w / 2, h / 2)
  ctx.lineTo(-w / 2, h / 2)
  ctx.closePath()
  ctx.fill()
  // stamped emblem/weight
  drawEmblem(ctx, spec.motif, 0, 0, h * 0.5, withAlpha(metal.emblem, 0.85))
  ctx.restore()
}

/** A note-stack: a banded "wad" — 2-3 fanned bills + a colored paper band. */
function paintNoteStack(p: Ctx, single: boolean) {
  const { ctx, s, spec, jit } = p
  const hue = spec.palette
  const band = spec.accent ?? harmonize(hue, 150)
  const cx = s / 2,
    cy = s / 2
  const w = s * 0.74,
    h = s * 0.46
  const layers = single ? 1 : 3
  for (let i = layers - 1; i >= 0; i--) {
    const off = i * s * 0.05
    const tilt = single ? 0 : (i - 1) * 0.06 + (jit() - 0.5) * 0.03
    ctx.save()
    ctx.translate(cx + off * 0.4, cy - off)
    ctx.rotate(tilt)
    withShadow(ctx, s * 0.06, () => {
      ctx.fillStyle = "#fffaf0"
      roundRect(ctx, -w / 2 - s * 0.025, -h / 2 - s * 0.025, w + s * 0.05, h + s * 0.05, s * 0.05)
      ctx.fill()
    })
    // bill paper
    const pg = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
    pg.addColorStop(0, shade(hue, 0.28))
    pg.addColorStop(1, shade(hue, 0.05))
    ctx.fillStyle = pg
    roundRect(ctx, -w / 2, -h / 2, w, h, s * 0.04)
    ctx.fill()
    // guilloche engraving — faint concentric ellipses + border
    ctx.save()
    roundRect(ctx, -w / 2, -h / 2, w, h, s * 0.04)
    ctx.clip()
    ctx.strokeStyle = withAlpha(shade(hue, -0.4), 0.5)
    ctx.lineWidth = Math.max(0.5, s * 0.012)
    ctx.strokeRect(-w / 2 + s * 0.04, -h / 2 + s * 0.04, w - s * 0.08, h - s * 0.08)
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath()
      ctx.ellipse(0, 0, s * 0.06 * k, s * 0.045 * k, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
    // portrait roundel emblem
    if (i === (single ? 0 : 1)) {
      drawEmblem(ctx, spec.motif, -w * 0.28, 0, h * 0.3, withAlpha(shade(hue, -0.45), 0.85))
    }
    ctx.restore()
  }
  if (!single) {
    // the paper band across the wad
    ctx.save()
    ctx.fillStyle = band
    roundRect(ctx, cx - s * 0.09, cy - h * 0.7, s * 0.18, h * 1.5, s * 0.02)
    ctx.fill()
    ctx.fillStyle = withAlpha("#000", 0.12)
    ctx.fillRect(cx - s * 0.09, cy + h * 0.2, s * 0.18, s * 0.04)
    ctx.restore()
  }
}

/** Scalloped shell-money form. */
function paintShell(p: Ctx) {
  const { ctx, s, spec, jit } = p
  const cx = s / 2,
    cy = s * 0.56
  const r = s * 0.4
  withShadow(ctx, s * 0.08, () => {
    ctx.fillStyle = "#fff7ec"
    ctx.beginPath()
    ctx.ellipse(cx, cy, r + s * 0.04, r * 0.92 + s * 0.04, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  const g = ctx.createRadialGradient(cx, cy - r * 0.5, r * 0.1, cx, cy, r)
  g.addColorStop(0, shade(spec.palette, 0.4))
  g.addColorStop(1, shade(spec.palette, -0.05))
  ctx.fillStyle = g
  // fan shape
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.7)
  ctx.arc(cx, cy + r * 0.7, r * 1.1, Math.PI * 1.15, Math.PI * 1.85)
  ctx.closePath()
  ctx.fill()
  // ribs
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.6)
  ctx.lineWidth = Math.max(0.6, s * 0.02)
  const ribs = 7
  for (let i = 0; i <= ribs; i++) {
    const a = Math.PI * 1.15 + (i / ribs) * Math.PI * 0.7
    ctx.beginPath()
    ctx.moveTo(cx, cy + r * 0.7)
    ctx.lineTo(cx + Math.cos(a) * r * 1.05, cy + r * 0.7 + Math.sin(a) * r * 1.05)
    ctx.stroke()
  }
  // scalloped lip
  ctx.fillStyle = shade(spec.palette, 0.5)
  for (let i = 0; i < ribs; i++) {
    const a = Math.PI * 1.2 + (i / (ribs - 1)) * Math.PI * 0.6
    void jit()
    dot(ctx, cx + Math.cos(a) * r, cy + r * 0.7 + Math.sin(a) * r, s * 0.025)
  }
}

/** Faceted gem with a specular glint. */
function paintGem(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s / 2
  const r = s * 0.4
  const base = spec.palette
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff8ec"
    poly(ctx, cx, cy, r + s * 0.045, 6, -Math.PI / 2)
    ctx.fill()
  })
  // facets: an upper crown + lower pavilion
  const facets = 6
  for (let i = 0; i < facets; i++) {
    const a0 = -Math.PI / 2 + (i / facets) * Math.PI * 2
    const a1 = -Math.PI / 2 + ((i + 1) / facets) * Math.PI * 2
    const mid = (a0 + a1) / 2
    const lit = Math.cos(mid + 0.6)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r)
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r)
    ctx.closePath()
    ctx.fillStyle = shade(base, 0.1 + lit * 0.3)
    ctx.fill()
    ctx.strokeStyle = withAlpha(shade(base, -0.3), 0.4)
    ctx.lineWidth = Math.max(0.5, s * 0.012)
    ctx.stroke()
  }
  // table facet
  ctx.beginPath()
  poly(ctx, cx, cy, r * 0.4, 6, -Math.PI / 2)
  ctx.fillStyle = shade(base, 0.5)
  ctx.fill()
  // glint
  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = "#fff"
  star(ctx, cx - r * 0.3, cy - r * 0.3, s * 0.06)
  ctx.restore()
}

function poly(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/** Drawstring coin pouch. */
function paintPouch(p: Ctx) {
  const { ctx, s, spec, jit } = p
  const cx = s / 2,
    cy = s * 0.58
  const r = s * 0.36
  const cloth = spec.palette
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff7ec"
    ctx.beginPath()
    ctx.ellipse(cx, cy + s * 0.03, r + s * 0.05, r + s * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  // body
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r * 1.2)
  g.addColorStop(0, shade(cloth, 0.28))
  g.addColorStop(1, shade(cloth, -0.18))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - r, cy - r * 0.3)
  ctx.quadraticCurveTo(cx - r * 1.2, cy + r, cx, cy + r * 1.1)
  ctx.quadraticCurveTo(cx + r * 1.2, cy + r, cx + r, cy - r * 0.3)
  ctx.quadraticCurveTo(cx, cy - r * 0.1, cx - r, cy - r * 0.3)
  ctx.fill()
  // gathered neck
  ctx.fillStyle = shade(cloth, -0.05)
  roundRect(ctx, cx - r * 0.55, cy - r * 0.75, r * 1.1, r * 0.55, r * 0.2)
  ctx.fill()
  // drawstring
  ctx.strokeStyle = spec.accent ?? "#8a5a2a"
  ctx.lineWidth = s * 0.03
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.5, cy - r * 0.6)
  ctx.quadraticCurveTo(cx, cy - r * 0.9, cx + r * 0.5, cy - r * 0.6)
  ctx.stroke()
  // a coin peeking + folds
  ctx.fillStyle = withAlpha(shade(cloth, -0.35), 0.5)
  for (let i = 0; i < 3; i++) {
    void jit()
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.5 + i * r * 0.5, cy - r * 0.1)
    ctx.quadraticCurveTo(cx - r * 0.4 + i * r * 0.5, cy + r * 0.6, cx - r * 0.5 + i * r * 0.5, cy + r * 0.9)
    ctx.lineWidth = s * 0.015
    ctx.strokeStyle = withAlpha(shade(cloth, -0.4), 0.4)
    ctx.stroke()
  }
}

/* ---- BADGE MEDAL ---------------------------------------------------- */

function paintMedal(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s * 0.52
  const r = s * 0.34
  const tier = (spec.tier ?? "bronze") as BadgeTier
  const arc = Math.max(0, Math.min(1, spec.fillArc ?? 0))
  const locked = tier === "locked"
  const metal = locked ? null : METALS[TIER_METAL[tier as Exclude<BadgeTier, "locked">]]

  // ribbon behind
  const rib = spec.accent ?? "#9a3b3b"
  ctx.save()
  ctx.fillStyle = locked ? "#b9b2a6" : rib
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.7, cy - r * 0.2)
  ctx.lineTo(cx - r * 0.35, cy - r)
  ctx.lineTo(cx - r * 0.05, cy - r * 0.6)
  ctx.lineTo(cx - r * 0.4, cy + r * 0.1)
  ctx.closePath()
  ctx.moveTo(cx + r * 0.7, cy - r * 0.2)
  ctx.lineTo(cx + r * 0.35, cy - r)
  ctx.lineTo(cx + r * 0.05, cy - r * 0.6)
  ctx.lineTo(cx + r * 0.4, cy + r * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // disc deckle + body
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff8ec"
    ctx.beginPath()
    ctx.arc(cx, cy, r + s * 0.05, 0, Math.PI * 2)
    ctx.fill()
  })
  if (locked) {
    // embossed empty well
    const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r)
    g.addColorStop(0, "#cfc8ba")
    g.addColorStop(1, "#9c9486")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    drawEmblem(ctx, spec.motif, cx, cy, r * 0.7, "rgba(80,76,68,0.45)")
  } else {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
    g.addColorStop(0, metal!.hi)
    g.addColorStop(0.5, metal!.mid)
    g.addColorStop(1, metal!.lo)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    // fluted rim
    ctx.lineWidth = s * 0.05
    ctx.strokeStyle = metal!.rim
    ctx.beginPath()
    ctx.arc(cx, cy, r - s * 0.02, 0, Math.PI * 2)
    ctx.stroke()
    drawEmblem(ctx, spec.motif, cx, cy, r * 0.74, withAlpha(metal!.emblem, 0.92))
    // platinum: soft iridescent inner ring (not loud)
    if (tier === "platinum") {
      const ir = ctx.createConicGradient(0, cx, cy)
      ir.addColorStop(0, "rgba(180,230,255,0.0)")
      ir.addColorStop(0.3, "rgba(200,180,255,0.45)")
      ir.addColorStop(0.6, "rgba(180,255,230,0.4)")
      ir.addColorStop(1, "rgba(180,230,255,0.0)")
      ctx.strokeStyle = ir as unknown as string
      ctx.lineWidth = s * 0.03
      ctx.beginPath()
      ctx.arc(cx, cy, r - s * 0.08, 0, Math.PI * 2)
      ctx.stroke()
    }
    // glint
    ctx.save()
    ctx.globalAlpha = 0.4
    ctx.fillStyle = "#fff"
    ctx.beginPath()
    ctx.ellipse(cx - r * 0.32, cy - r * 0.4, r * 0.28, r * 0.14, -0.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // progress arc toward next tier (the "filling up")
  if (arc > 0 && !locked) {
    ctx.save()
    ctx.lineCap = "round"
    ctx.lineWidth = s * 0.055
    const ar = r + s * 0.1
    ctx.strokeStyle = withAlpha("#fff", 0.35)
    ctx.beginPath()
    ctx.arc(cx, cy, ar, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = metal ? metal.hi : "#fff"
    ctx.beginPath()
    ctx.arc(cx, cy, ar, -Math.PI / 2, -Math.PI / 2 + arc * Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

/* ---- ITEM FAMILIES -------------------------------------------------- */

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c?: string) {
  if (c) ctx.fillStyle = c
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** Generic paper-cutout body helper: deckle + fill + finish + emblem. */
function paperBody(
  p: Ctx,
  trace: (x: number, y: number, w: number, h: number) => void,
  box: { x: number; y: number; w: number; h: number },
  opts: { emblem?: boolean; emblemR?: number } = {},
) {
  const { ctx, s, spec } = p
  const { x, y, w, h } = box
  const d = s * 0.05
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    trace(x - d, y - d, w + d * 2, h + d * 2)
    ctx.fill()
  })
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, shade(spec.palette, 0.26))
  g.addColorStop(1, shade(spec.palette, -0.08))
  ctx.fillStyle = g
  trace(x, y, w, h)
  ctx.fill()
  ctx.save()
  trace(x, y, w, h)
  ctx.clip()
  applyFinish(ctx, spec.finish, s, spec.palette)
  ctx.restore()
  // thin contour so the silhouette holds at HUD size
  ctx.lineWidth = Math.max(0.8, s * 0.02)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.5), 0.5)
  trace(x, y, w, h)
  ctx.stroke()
  if (opts.emblem) {
    drawEmblem(ctx, spec.motif, x + w / 2, y + h / 2, opts.emblemR ?? Math.min(w, h) * 0.32, withAlpha(shade(spec.palette, -0.5), 0.8))
  }
}

/** Wax-sealed token / disc. */
function paintToken(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s / 2,
    r = s * 0.38
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    dot(ctx, cx, cy, r + s * 0.045)
  })
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
  g.addColorStop(0, shade(spec.palette, 0.3))
  g.addColorStop(1, shade(spec.palette, -0.12))
  ctx.fillStyle = g
  dot(ctx, cx, cy, r)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  applyFinish(ctx, spec.finish, s, spec.palette)
  ctx.restore()
  // notched rim
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.7)
  ctx.lineWidth = s * 0.025
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2)
  ctx.stroke()
  drawEmblem(ctx, spec.motif, cx, cy, r * 0.6, withAlpha(shade(spec.palette, -0.5), 0.85))
}

/** Wax seal — blob with an impressed crest. */
function paintSeal(p: Ctx) {
  const { ctx, s, spec, jit } = p
  const cx = s / 2,
    cy = s / 2,
    r = s * 0.36
  withShadow(ctx, s * 0.1, () => {
    ctx.fillStyle = "#fff8ec"
    tornPath(ctx, cx, cy, r + s * 0.06, r + s * 0.06, s * 0.05, jit)
    ctx.fill()
  })
  const wax = spec.palette
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
  g.addColorStop(0, shade(wax, 0.2))
  g.addColorStop(1, shade(wax, -0.2))
  ctx.fillStyle = g
  // dripping wax blob
  tornPath(ctx, cx, cy, r, r, s * 0.045, jit)
  ctx.fill()
  // impressed crest (darker, recessed)
  drawEmblem(ctx, spec.motif, cx, cy, r * 0.62, withAlpha(shade(wax, -0.4), 0.75))
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = "#fff"
  ctx.beginPath()
  ctx.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.25, r * 0.12, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Folded letter / document. */
function paintLetter(p: Ctx) {
  const { ctx, s, spec } = p
  const w = s * 0.66,
    h = s * 0.5
  const x = (s - w) / 2,
    y = (s - h) / 2
  paperBody(p, (xx, yy, ww, hh) => roundRect(ctx, xx, yy, ww, hh, s * 0.04), { x, y, w, h })
  // fold lines + envelope flap
  ctx.save()
  roundRect(ctx, x, y, w, h, s * 0.04)
  ctx.clip()
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.45)
  ctx.lineWidth = Math.max(0.6, s * 0.012)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w / 2, y + h * 0.5)
  ctx.lineTo(x + w, y)
  ctx.stroke()
  ctx.restore()
  // wax dot
  dot(ctx, x + w / 2, y + h * 0.5, s * 0.05, spec.accent ?? "#9a3b3b")
  drawEmblem(ctx, spec.motif, x + w / 2, y + h * 0.5, s * 0.035, "#fff")
}

/** Rolled scroll with two rods. */
function paintScroll(p: Ctx) {
  const { ctx, s, spec } = p
  const w = s * 0.6,
    h = s * 0.56
  const x = (s - w) / 2,
    y = (s - h) / 2
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff6e6"
    roundRect(ctx, x - s * 0.04, y - s * 0.04, w + s * 0.08, h + s * 0.08, s * 0.05)
    ctx.fill()
  })
  // parchment
  const g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, shade(spec.palette, 0.16))
  g.addColorStop(0.5, shade(spec.palette, 0.34))
  g.addColorStop(1, shade(spec.palette, 0.16))
  ctx.fillStyle = g
  roundRect(ctx, x + s * 0.04, y, w - s * 0.08, h, s * 0.02)
  ctx.fill()
  ctx.lineWidth = Math.max(0.7, s * 0.016)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.45), 0.4)
  roundRect(ctx, x + s * 0.04, y, w - s * 0.08, h, s * 0.02)
  ctx.stroke()
  // text lines
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.5)
  ctx.lineWidth = Math.max(0.6, s * 0.014)
  for (let i = 0; i < 4; i++) {
    const ly = y + h * 0.26 + i * h * 0.16
    ctx.beginPath()
    ctx.moveTo(x + w * 0.22, ly)
    ctx.lineTo(x + w * 0.78 - (i % 2) * w * 0.12, ly)
    ctx.stroke()
  }
  // rods top & bottom
  const rod = spec.accent ?? "#8a5a2a"
  for (const ry of [y - s * 0.01, y + h - s * 0.05]) {
    const rg = ctx.createLinearGradient(0, ry, 0, ry + s * 0.07)
    rg.addColorStop(0, shade(rod, 0.3))
    rg.addColorStop(1, shade(rod, -0.2))
    ctx.fillStyle = rg
    roundRect(ctx, x - s * 0.02, ry, w + s * 0.04, s * 0.07, s * 0.035)
    ctx.fill()
  }
}

/** Garment (a folded tunic / shirt silhouette). */
function paintGarment(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s * 0.54
  const w = s * 0.6
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    garmentPath(ctx, cx, cy, w * 1.08, s * 0.52 * 1.08)
    ctx.fill()
  })
  const g = ctx.createLinearGradient(0, cy - s * 0.26, 0, cy + s * 0.26)
  g.addColorStop(0, shade(spec.palette, 0.24))
  g.addColorStop(1, shade(spec.palette, -0.1))
  ctx.fillStyle = g
  garmentPath(ctx, cx, cy, w, s * 0.52)
  ctx.save()
  garmentPath(ctx, cx, cy, w, s * 0.52)
  ctx.clip()
  applyFinish(ctx, spec.finish, s, spec.palette)
  // collar shade
  ctx.fillStyle = withAlpha(shade(spec.palette, -0.3), 0.5)
  ctx.beginPath()
  ctx.moveTo(cx - w * 0.16, cy - s * 0.26)
  ctx.lineTo(cx, cy - s * 0.12)
  ctx.lineTo(cx + w * 0.16, cy - s * 0.26)
  ctx.fill()
  ctx.restore()
  // contour for 24px legibility
  ctx.lineWidth = Math.max(0.8, s * 0.022)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.5), 0.5)
  garmentPath(ctx, cx, cy, w, s * 0.52)
  ctx.stroke()
}
function garmentPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  const hw = w / 2,
    hh = h / 2
  ctx.beginPath()
  ctx.moveTo(cx - hw * 0.45, cy - hh)
  ctx.lineTo(cx - hw, cy - hh * 0.4) // shoulder/sleeve
  ctx.lineTo(cx - hw * 0.62, cy - hh * 0.1)
  ctx.lineTo(cx - hw * 0.62, cy + hh)
  ctx.lineTo(cx + hw * 0.62, cy + hh)
  ctx.lineTo(cx + hw * 0.62, cy - hh * 0.1)
  ctx.lineTo(cx + hw, cy - hh * 0.4)
  ctx.lineTo(cx + hw * 0.45, cy - hh)
  ctx.quadraticCurveTo(cx, cy - hh * 0.6, cx - hw * 0.45, cy - hh)
  ctx.closePath()
}

/** Foodstuff (a round loaf / fruit with a leaf). */
function paintFoodstuff(p: Ctx) {
  const { ctx, s, spec, jit } = p
  const cx = s / 2,
    cy = s * 0.56,
    r = s * 0.34
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    ctx.beginPath()
    ctx.ellipse(cx, cy, r + s * 0.05, r * 0.92 + s * 0.05, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.2)
  g.addColorStop(0, shade(spec.palette, 0.34))
  g.addColorStop(1, shade(spec.palette, -0.12))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2)
  ctx.fill()
  // a small leaf/stem on top
  ctx.fillStyle = spec.accent ?? "#6a8a3a"
  ctx.save()
  ctx.translate(cx + r * 0.1, cy - r * 0.85)
  ctx.rotate(-0.4 + (jit() - 0.5) * 0.4)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(s * 0.1, -s * 0.06, s * 0.16, 0)
  ctx.quadraticCurveTo(s * 0.1, s * 0.05, 0, 0)
  ctx.fill()
  ctx.restore()
  // score marks
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.4)
  ctx.lineWidth = Math.max(0.6, s * 0.016)
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * r * 0.4, cy - r * 0.5)
    ctx.lineTo(cx + i * r * 0.4, cy + r * 0.5)
    ctx.stroke()
  }
  // highlight
  ctx.save()
  ctx.globalAlpha = 0.4
  ctx.fillStyle = "#fff"
  dot(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.18)
  ctx.restore()
}

/** Vessel (a pot / jug / flask). */
function paintVessel(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s * 0.56,
    r = s * 0.3
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    vesselPath(ctx, cx, cy, r * 1.16)
    ctx.fill()
  })
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0)
  g.addColorStop(0, shade(spec.palette, -0.1))
  g.addColorStop(0.4, shade(spec.palette, 0.3))
  g.addColorStop(1, shade(spec.palette, -0.16))
  ctx.fillStyle = g
  vesselPath(ctx, cx, cy, r)
  ctx.save()
  vesselPath(ctx, cx, cy, r)
  ctx.clip()
  applyFinish(ctx, spec.finish, s, spec.palette)
  ctx.restore()
  ctx.lineWidth = Math.max(0.8, s * 0.022)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.5), 0.5)
  vesselPath(ctx, cx, cy, r)
  ctx.stroke()
  // neck band
  ctx.fillStyle = spec.accent ?? shade(spec.palette, -0.3)
  roundRect(ctx, cx - r * 0.5, cy - r * 1.3, r, s * 0.05, s * 0.02)
  ctx.fill()
}
function vesselPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.45, cy - r * 1.25)
  ctx.lineTo(cx + r * 0.45, cy - r * 1.25) // mouth
  ctx.lineTo(cx + r * 0.5, cy - r * 0.7)
  ctx.quadraticCurveTo(cx + r * 1.15, cy - r * 0.3, cx + r, cy + r * 0.4)
  ctx.quadraticCurveTo(cx + r * 0.9, cy + r * 1.1, cx, cy + r * 1.2)
  ctx.quadraticCurveTo(cx - r * 0.9, cy + r * 1.1, cx - r, cy + r * 0.4)
  ctx.quadraticCurveTo(cx - r * 1.15, cy - r * 0.3, cx - r * 0.5, cy - r * 0.7)
  ctx.closePath()
}

/** Tool — a bold handled implement (a mallet/hammer silhouette that reads at 24px). */
function paintTool(p: Ctx) {
  const { ctx, s, spec } = p
  const handle = spec.accent ?? "#8a5a2a"
  const cx = s / 2,
    cy = s / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.62)
  // deckle for the whole tool
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    roundRect(ctx, -s * 0.075, -s * 0.12, s * 0.15, s * 0.5, s * 0.06)
    ctx.fill()
    roundRect(ctx, -s * 0.27, -s * 0.36, s * 0.54, s * 0.26, s * 0.07)
    ctx.fill()
  })
  // handle (thick, contoured)
  const hg = ctx.createLinearGradient(-s * 0.05, 0, s * 0.05, 0)
  hg.addColorStop(0, shade(handle, 0.24))
  hg.addColorStop(0.5, shade(handle, 0.04))
  hg.addColorStop(1, shade(handle, -0.24))
  ctx.fillStyle = hg
  roundRect(ctx, -s * 0.055, -s * 0.06, s * 0.11, s * 0.42, s * 0.05)
  ctx.fill()
  ctx.lineWidth = Math.max(1, s * 0.022)
  ctx.strokeStyle = withAlpha(shade(handle, -0.45), 0.6)
  roundRect(ctx, -s * 0.055, -s * 0.06, s * 0.11, s * 0.42, s * 0.05)
  ctx.stroke()
  // head (a chunky block — the load-bearing silhouette)
  const g = ctx.createLinearGradient(0, -s * 0.34, 0, -s * 0.1)
  g.addColorStop(0, shade(spec.palette, 0.32))
  g.addColorStop(1, shade(spec.palette, -0.14))
  ctx.fillStyle = g
  roundRect(ctx, -s * 0.24, -s * 0.32, s * 0.48, s * 0.22, s * 0.06)
  ctx.fill()
  ctx.save()
  roundRect(ctx, -s * 0.24, -s * 0.32, s * 0.48, s * 0.22, s * 0.06)
  ctx.clip()
  applyFinish(ctx, spec.finish, s, spec.palette)
  ctx.restore()
  ctx.lineWidth = Math.max(1, s * 0.022)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.5), 0.55)
  roundRect(ctx, -s * 0.24, -s * 0.32, s * 0.48, s * 0.22, s * 0.06)
  ctx.stroke()
  ctx.restore()
}

/** Key. */
function paintKey(p: Ctx) {
  const { ctx, s, spec } = p
  const metalTone = METALS[(spec.metal as MetalTone) ?? "bronze"]
  ctx.save()
  ctx.translate(s / 2, s / 2)
  ctx.rotate(-0.6)
  withShadow(ctx, s * 0.08, () => {
    ctx.fillStyle = "#fff8ec"
    ctx.beginPath()
    ctx.arc(0, -s * 0.22, s * 0.16, 0, Math.PI * 2)
    ctx.fill()
    roundRect(ctx, -s * 0.045, -s * 0.1, s * 0.09, s * 0.42, s * 0.03)
    ctx.fill()
  })
  const g = ctx.createRadialGradient(-s * 0.06, -s * 0.3, s * 0.02, 0, -s * 0.24, s * 0.2)
  g.addColorStop(0, metalTone.hi)
  g.addColorStop(0.6, metalTone.mid)
  g.addColorStop(1, metalTone.lo)
  ctx.fillStyle = g
  // bow (head ring) — bigger so it reads at 24px
  ctx.beginPath()
  ctx.arc(0, -s * 0.24, s * 0.19, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(1, s * 0.022)
  ctx.strokeStyle = metalTone.rim
  ctx.beginPath()
  ctx.arc(0, -s * 0.24, s * 0.19, 0, Math.PI * 2)
  ctx.stroke()
  ctx.save()
  ctx.globalCompositeOperation = "destination-out"
  ctx.beginPath()
  ctx.arc(0, -s * 0.24, s * 0.085, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // shaft (thicker, contoured)
  ctx.fillStyle = metalTone.mid
  roundRect(ctx, -s * 0.05, -s * 0.07, s * 0.1, s * 0.42, s * 0.03)
  ctx.fill()
  ctx.lineWidth = Math.max(1, s * 0.02)
  ctx.strokeStyle = metalTone.rim
  roundRect(ctx, -s * 0.05, -s * 0.07, s * 0.1, s * 0.42, s * 0.03)
  ctx.stroke()
  // bit teeth (chunkier)
  ctx.fillStyle = metalTone.mid
  ctx.strokeStyle = metalTone.rim
  for (const [ty, tw] of [
    [s * 0.18, s * 0.13],
    [s * 0.28, s * 0.1],
  ]) {
    roundRect(ctx, s * 0.04, ty, tw, s * 0.07, s * 0.015)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}

/** Charm / amulet — a small ringed pendant with a stone. */
function paintCharm(p: Ctx) {
  const { ctx, s, spec } = p
  const cx = s / 2,
    cy = s * 0.56
  const r = s * 0.26
  // cord loop
  ctx.strokeStyle = spec.accent ?? "#6a4a2a"
  ctx.lineWidth = s * 0.03
  ctx.beginPath()
  ctx.arc(cx, cy - r * 1.3, r * 0.4, 0, Math.PI * 2)
  ctx.stroke()
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    poly(ctx, cx, cy, r + s * 0.05, 8, -Math.PI / 2)
    ctx.fill()
  })
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r)
  g.addColorStop(0, shade(spec.palette, 0.34))
  g.addColorStop(1, shade(spec.palette, -0.14))
  ctx.fillStyle = g
  poly(ctx, cx, cy, r, 8, -Math.PI / 2)
  ctx.fill()
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.4), 0.6)
  ctx.lineWidth = s * 0.02
  poly(ctx, cx, cy, r, 8, -Math.PI / 2)
  ctx.stroke()
  // central stone
  const stone = spec.metal ? METALS[spec.metal as MetalTone].mid : shade(spec.palette, 0.5)
  dot(ctx, cx, cy, r * 0.45, stone)
  drawEmblem(ctx, spec.motif, cx, cy, r * 0.5, withAlpha(shade(spec.palette, -0.5), 0.7))
}

/** Folded cloth / textile bolt. */
function paintCloth(p: Ctx) {
  const { ctx, s, spec } = p
  const w = s * 0.66,
    h = s * 0.5
  const x = (s - w) / 2,
    y = (s - h) / 2
  withShadow(ctx, s * 0.09, () => {
    ctx.fillStyle = "#fff8ec"
    roundRect(ctx, x - s * 0.04, y - s * 0.04, w + s * 0.08, h + s * 0.08, s * 0.04)
    ctx.fill()
  })
  // stacked folds
  const folds = 4
  for (let i = folds - 1; i >= 0; i--) {
    const fy = y + (i * h) / folds
    const fh = h / folds + s * 0.02
    const g = ctx.createLinearGradient(0, fy, 0, fy + fh)
    g.addColorStop(0, shade(spec.palette, 0.28 - i * 0.04))
    g.addColorStop(1, shade(spec.palette, -0.02 - i * 0.04))
    ctx.fillStyle = g
    roundRect(ctx, x, fy, w, fh, s * 0.03)
    ctx.fill()
  }
  // weave texture
  ctx.save()
  roundRect(ctx, x, y, w, h, s * 0.04)
  ctx.clip()
  applyFinish(ctx, "woven", s, spec.palette)
  // a contrast stripe
  ctx.fillStyle = withAlpha(spec.accent ?? harmonize(spec.palette, 150), 0.7)
  ctx.fillRect(x, y + h * 0.42, w, h * 0.1)
  ctx.restore()
  // contour for 24px legibility
  ctx.lineWidth = Math.max(0.8, s * 0.022)
  ctx.strokeStyle = withAlpha(shade(spec.palette, -0.5), 0.5)
  roundRect(ctx, x, y, w, h, s * 0.04)
  ctx.stroke()
}

/* ====================================================================== *
 * Dispatch + the renderer + cache.
 * ====================================================================== */

const PAINTERS: Record<IconFamily, (p: Ctx) => void> = {
  "coin-round": (p) => paintCoin(p, false),
  "coin-square-hole": (p) => paintCoin(p, true),
  "ingot-bar": paintIngot,
  "bill-rect": (p) => paintNoteStack(p, true),
  "note-stack": (p) => paintNoteStack(p, false),
  shell: paintShell,
  "gem-faceted": paintGem,
  pouch: paintPouch,
  medal: paintMedal,
  token: paintToken,
  seal: paintSeal,
  letter: paintLetter,
  scroll: paintScroll,
  garment: paintGarment,
  foodstuff: paintFoodstuff,
  vessel: paintVessel,
  tool: paintTool,
  key: paintKey,
  charm: paintCharm,
  cloth: paintCloth,
}

/** Default palette per family so a bare spec is never ugly. */
const FAMILY_PALETTE: Partial<Record<IconFamily, string>> = {
  "coin-round": "#e8b73c",
  "coin-square-hole": "#d6dbe1",
  "ingot-bar": "#d6dbe1",
  "bill-rect": "#5a8f6a",
  "note-stack": "#5a8f6a",
  shell: "#e7c8a8",
  "gem-faceted": "#3aa0c8",
  pouch: "#9a6a3a",
  medal: "#c79a4a",
  token: "#b8894a",
  seal: "#9a3b3b",
  letter: "#efe4cf",
  scroll: "#e8d6a8",
  garment: "#5a7aa0",
  foodstuff: "#cf8a4a",
  vessel: "#b06a4a",
  tool: "#7a8a9a",
  key: "#c79a4a",
  charm: "#6a8aaa",
  cloth: "#a05a7a",
}

/** Resolve a default metal for coin/ingot/medal/key when the spec omits one. */
function resolveMetal(spec: IconSpec): MetalRamp {
  if (spec.metal) return METALS[spec.metal as MetalTone]
  if (spec.family === "coin-square-hole") return METALS.silver
  if (spec.family === "ingot-bar") return METALS.silver
  return METALS.gold
}

const DPR = (): number => (typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? Math.min(devicePixelRatio, 3) : 1)

/** Stable cache key — same spec + size → same painted canvas. */
function cacheKey(spec: IconSpec, size: number, dpr: number): string {
  return [
    spec.family,
    spec.palette,
    spec.finish ?? "",
    spec.rarity ?? "",
    spec.motif ?? "",
    spec.accent ?? "",
    spec.metal ?? "",
    spec.seed ?? "",
    spec.fillArc ?? "",
    spec.tier ?? "",
    size,
    dpr,
  ].join("|")
}

class ProceduralIconRenderer implements IconRenderer {
  private cache = new Map<string, HTMLCanvasElement>()
  private urlCache = new Map<string, string>()
  private maxEntries = 512

  renderIcon(spec: IconSpec, target?: IconRenderTarget): HTMLCanvasElement {
    const size = target?.size ?? 32
    const dpr = DPR()
    const key = cacheKey(spec, size, dpr)
    const hit = this.cache.get(key)
    if (hit) return hit
    const c = this.paint(spec, size, dpr)
    if (this.cache.size >= this.maxEntries) {
      // simple FIFO eviction — first inserted key
      const first = this.cache.keys().next().value
      if (first !== undefined) this.cache.delete(first)
    }
    this.cache.set(key, c)
    return c
  }

  iconDataUrl(spec: IconSpec, target?: IconRenderTarget): string {
    const size = target?.size ?? 32
    const key = cacheKey(spec, size, DPR())
    const hit = this.urlCache.get(key)
    if (hit) return hit
    const url = this.renderIcon(spec, target).toDataURL("image/png")
    if (this.urlCache.size >= this.maxEntries) {
      const first = this.urlCache.keys().next().value
      if (first !== undefined) this.urlCache.delete(first)
    }
    this.urlCache.set(key, url)
    return url
  }

  private paint(spec: IconSpec, size: number, dpr: number): HTMLCanvasElement {
    const { c, ctx } = makeCanvas(size, dpr)
    const palette = spec.palette || FAMILY_PALETTE[spec.family] || "#c79a4a"
    const resolved: IconSpec = { ...spec, palette }
    const seedSrc = `${resolved.family}:${palette}:${resolved.motif ?? ""}:${resolved.seed ?? 0}`
    const jit = rng(hashStr(seedSrc))
    const p: Ctx = { ctx, s: size, spec: resolved, jit, metal: resolveMetal(resolved) }
    const painter = PAINTERS[resolved.family]
    if (painter) painter(p)
    else paintToken(p) // never blank, never emoji — a sane fallback body
    // rarity frame on top (medals carry their own tier treatment; still allow seasonal sparkle)
    drawRarityFrame(ctx, size, resolved.rarity)
    return c
  }
}

/** The shared renderer instance every consumer imports. */
export const iconRenderer: IconRenderer = new ProceduralIconRenderer()

/** Factory (for tests / isolated instances with their own cache). */
export function createIconRenderer(): IconRenderer {
  return new ProceduralIconRenderer()
}

export type { IconSpec, IconRenderer, IconFamily, IconFinish, IconRarity }
