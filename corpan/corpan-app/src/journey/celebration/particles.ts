// src/journey/celebration/particles.ts — canvas particle burst (feed-ux §1.5).
// ONE reused canvas element, no DOM node spam, ≤1.2s bursts. Callers gate on
// reduced-motion + intensity BEFORE calling (canvas ignores MotionConfig).
//
// Two shapes share one engine: soft round motes (the calm default) and spinning
// rectangular confetti (the `colorful` upgrade the effect registry fires on a
// correct). Colorful mode fans the hue across the spectrum and gives each piece
// a spin, so a combo-scaled burst reads as a genuine celebration, not a puff.

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
  sat: number
  light: number
  /** confetti rectangles spin; dots leave this at 0. */
  rot: number
  spin: number
  shape: "dot" | "rect"
}

let particles: Particle[] = []
let raf = 0
let activeCanvas: HTMLCanvasElement | null = null

function step(): void {
  const canvas = activeCanvas
  if (!canvas) return
  const g = canvas.getContext("2d")
  if (!g) return
  g.clearRect(0, 0, canvas.width, canvas.height)
  particles = particles.filter((p) => p.life > 0)
  if (particles.length === 0) {
    raf = 0
    return
  }
  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.16 // gravity
    p.vx *= 0.985
    p.rot += p.spin
    p.life -= 1
    // Fade over the last third of life so pieces don't pop out.
    g.globalAlpha = Math.max(0, Math.min(0.9, (p.life / p.maxLife) * 1.4))
    g.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${p.light}%)`
    if (p.shape === "rect") {
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      // a thin confetti sliver — width > height, spinning as it falls
      g.fillRect(-p.size, -p.size * 0.42, p.size * 2, p.size * 0.84)
      g.restore()
    } else {
      g.beginPath()
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      g.fill()
    }
  }
  g.globalAlpha = 1
  raf = requestAnimationFrame(step)
}

export interface BurstOpts {
  count?: number
  /** Base hue for the monochrome (non-colorful) puff. */
  hue?: number
  /** Fan hues across the spectrum + use spinning rectangles = real confetti. */
  colorful?: boolean
  /** Launch energy multiplier (combo-scaled by the caller). Default 1. */
  power?: number
  /** Bias the spray upward (1 = balloon up, 0 = symmetric ring). Default 0.55. */
  upward?: number
}

/**
 * Fire a burst at (x, y) in canvas coordinates. Default = a sparse, near-
 * monochrome premium puff (back-compat). `colorful` upgrades it to combo-scaled
 * spinning confetti in a full-spectrum palette.
 */
export function burst(canvas: HTMLCanvasElement, x: number, y: number, opts: BurstOpts = {}): void {
  activeCanvas = canvas
  const colorful = opts.colorful ?? false
  const count = Math.min(opts.count ?? 14, 140)
  const hue = opts.hue ?? 262 // app purple fallback
  const power = opts.power ?? 1
  const upward = opts.upward ?? 0.55
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (colorful ? 2.2 : 1.4) + Math.random() * (colorful ? 5.5 : 3.2) * power
    const isRect = colorful && Math.random() < 0.72
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * 0.85,
      vy: Math.sin(angle) * speed - (2.2 + upward * 3) * power,
      life: (colorful ? 42 : 30) + Math.random() * (colorful ? 34 : 24),
      maxLife: 76,
      size: colorful ? 2.6 + Math.random() * 3.4 : 1.4 + Math.random() * 2.2,
      hue: colorful ? Math.floor(Math.random() * 360) : hue + (Math.random() * 24 - 12),
      sat: colorful ? 82 : 70,
      light: colorful ? 58 + Math.random() * 12 : 60,
      rot: Math.random() * Math.PI * 2,
      spin: isRect ? (Math.random() - 0.5) * 0.5 : 0,
      shape: isRect ? "rect" : "dot",
    })
  }
  if (!raf) raf = requestAnimationFrame(step)
}

export function clearParticles(): void {
  particles = []
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
