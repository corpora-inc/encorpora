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
    p.vy += 0.18 // gravity
    p.vx *= 0.985
    p.life -= 1
    g.globalAlpha = Math.max(0, Math.min(1, p.life / 30))
    g.fillStyle = `hsl(${p.hue}, 85%, 62%)`
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
  const count = Math.min(opts.count ?? 28, 80)
  const hue = opts.hue ?? 262 // app purple fallback
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 5
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2.5,
      life: 24 + Math.random() * 22,
      size: 2 + Math.random() * 3,
      hue: hue + (Math.random() * 40 - 20),
    })
  }
  if (!raf) raf = requestAnimationFrame(step)
}

export function clearParticles(): void {
  particles = []
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}
