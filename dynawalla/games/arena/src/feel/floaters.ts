/**
 * Floating value pops. A fixed pool, drawn through the numeral layer so they
 * inherit the same halo treatment and can never be washed out by the bloom.
 */
export type Floater = {
  v: number
  x: number
  y: number
  vx: number
  vy: number
  t: number
  life: number
  size: number
  r: number
  g: number
  b: number
}

const CAP = 32

export class Floaters {
  readonly items: Floater[] = Array.from({ length: CAP }, () => ({
    v: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    t: 0,
    life: 0,
    size: 0,
    r: 1,
    g: 1,
    b: 1,
  }))
  private cursor = 0

  push(v: number, x: number, y: number, size: number, r: number, g: number, b: number, life = 0.85): void {
    const f = this.items[this.cursor] as Floater
    this.cursor = (this.cursor + 1) % CAP
    f.v = v
    f.x = x
    f.y = y
    f.vx = (Math.random() - 0.5) * 40
    f.vy = 90 + Math.random() * 50
    f.t = 0
    f.life = life
    f.size = size
    f.r = r
    f.g = g
    f.b = b
  }

  step(dt: number): void {
    for (let i = 0; i < CAP; i++) {
      const f = this.items[i] as Floater
      if (f.life <= 0) continue
      f.t += dt
      if (f.t >= f.life) {
        f.life = 0
        continue
      }
      const decay = Math.exp(-dt * 2.2)
      f.vx *= decay
      f.vy *= decay
      f.x += f.vx * dt
      f.y += f.vy * dt
    }
  }
}
