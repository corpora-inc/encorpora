// src/journey/celebration/particles.ts — canvas particle burst (feed-ux §1.5).
// ONE reused canvas element, no DOM node spam, ≤1s bursts. Callers gate on
// reduced-motion + intensity BEFORE calling (canvas ignores MotionConfig).

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  hue: number
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
    p.vy += 0.14 // gentler gravity — a slow, premium drift, not a firework
    p.vx *= 0.98
    p.life -= 1
    // Soft, monochrome-accent glow: lower saturation + a slower fade read as
    // refined rather than confetti-loud.
    g.globalAlpha = Math.max(0, Math.min(0.85, p.life / 40))
    g.fillStyle = `hsl(${p.hue}, 70%, 60%)`
    g.beginPath()
    g.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  raf = requestAnimationFrame(step)
}

/** Fire a burst at (x, y) in canvas coordinates, in the course hue. */
export function burst(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  opts: { count?: number; hue?: number } = {},
): void {
  activeCanvas = canvas
  // Premium confetti is barely confetti: sparse by default, and dense counts
  // (reserved by the caller for tier ≥2 milestones) still stay tasteful.
  const count = Math.min(opts.count ?? 14, 44)
  const hue = opts.hue ?? 262 // app purple fallback
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    // a soft upward puff, not a wide firework spray
    const speed = 1.4 + Math.random() * 3.2
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed * 0.8,
      vy: Math.sin(angle) * speed - 2.2,
      life: 30 + Math.random() * 24,
      size: 1.4 + Math.random() * 2.2, // smaller, finer motes
      hue: hue + (Math.random() * 24 - 12), // tight, near-monochrome accent
    })
  }
  if (!raf) raf = requestAnimationFrame(step)
}

export function clearParticles(): void {
  particles = []
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
