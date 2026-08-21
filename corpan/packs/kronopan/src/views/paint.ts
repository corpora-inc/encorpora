// Small canvas paint helpers shared by every view.

export type Pt = { x: number; y: number }

// 12 o'clock in canvas angle terms (canvas 0 is 3 o'clock, positive is
// clockwise because y grows downward).
export const TOP = -Math.PI / 2

export const polar = (cx: number, cy: number, radius: number, angle: number): Pt => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
})

// Whether the viewer asked to reduce motion. The ring damps its rotation under
// this, per the pack's motion rule; the playhead keeps moving because it is
// content, not decoration.
let reducedMQL: MediaQueryList | null = null
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false
  if (!reducedMQL) reducedMQL = window.matchMedia("(prefers-reduced-motion: reduce)")
  return reducedMQL.matches
}

// A fixed, faint starfield for the sparkly skins. Positions are generated once
// so the stars do not flicker between frames, and they are drawn behind the
// pattern at low alpha so they never touch readability.
const STARS = Array.from({ length: 70 }, () => ({
  fx: Math.random(),
  fy: Math.random(),
  r: Math.random() * 1.2 + 0.3,
  a: Math.random() * 0.4 + 0.12,
}))

export function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  for (const s of STARS) {
    ctx.globalAlpha = s.a
    ctx.beginPath()
    ctx.arc(s.fx * width, s.fy * height, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function roundedRect(
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

// Expand a #rrggbb color to rgba with the given alpha. Returns the input
// unchanged if it is not a 6-digit hex, so a non-hex token stays usable.
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
