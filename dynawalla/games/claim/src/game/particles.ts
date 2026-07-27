// A fixed pool. Nothing is allocated after construction, nothing is garbage,
// and the count is hard-capped so a huge claim cannot blow the frame budget.

const MAX = 520

export class Particles {
  private x = new Float32Array(MAX)
  private y = new Float32Array(MAX)
  private vx = new Float32Array(MAX)
  private vy = new Float32Array(MAX)
  private life = new Float32Array(MAX)
  private maxLife = new Float32Array(MAX)
  private size = new Float32Array(MAX)
  private rot = new Float32Array(MAX)
  private spin = new Float32Array(MAX)
  private drag = new Float32Array(MAX)
  private grav = new Float32Array(MAX)
  private colour: string[] = new Array(MAX).fill("#fff")
  private square = new Uint8Array(MAX)
  private next = 0
  live = 0
  /** Scales every spawn count. 1 normally, 0.18 under reduced motion. */
  budget = 1

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    colour: string,
    opts?: { spin?: number; drag?: number; grav?: number; square?: boolean },
  ): void {
    // Oldest-first overwrite: a burst can never be starved by stale smoke.
    let i = this.next
    for (let tries = 0; tries < MAX; tries++) {
      if (this.life[i] <= 0) break
      i = (i + 1) % MAX
    }
    this.next = (i + 1) % MAX
    if (this.life[i] <= 0) this.live++
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = life
    this.maxLife[i] = life
    this.size[i] = size
    this.rot[i] = 0
    this.spin[i] = opts?.spin ?? 0
    this.drag[i] = opts?.drag ?? 2.2
    this.grav[i] = opts?.grav ?? 0
    this.colour[i] = colour
    this.square[i] = opts?.square === false ? 0 : 1
  }

  /** `count` is scaled by the budget; callers pass the maximalist number. */
  burst(
    x: number,
    y: number,
    count: number,
    speed: number,
    life: number,
    size: number,
    colour: string,
    rand: () => number,
    opts?: { spin?: number; drag?: number; grav?: number },
  ): void {
    const n = Math.max(1, Math.round(count * this.budget))
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2
      const s = speed * (0.35 + rand() * 0.9)
      this.spawn(
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        life * (0.6 + rand() * 0.7),
        size * (0.6 + rand() * 0.8),
        colour,
        { spin: (rand() - 0.5) * 14, ...opts },
      )
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      const l = this.life[i] as number
      if (l <= 0) continue
      const nl = l - dt
      if (nl <= 0) {
        this.life[i] = 0
        this.live--
        continue
      }
      this.life[i] = nl
      const d = 1 - (this.drag[i] as number) * dt
      this.vx[i] = (this.vx[i] as number) * d
      this.vy[i] = (this.vy[i] as number) * d + (this.grav[i] as number) * dt
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt
      this.rot[i] = (this.rot[i] as number) + (this.spin[i] as number) * dt
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX; i++) {
      const l = this.life[i] as number
      if (l <= 0) continue
      const t = l / (this.maxLife[i] as number)
      const s = (this.size[i] as number) * (0.25 + t * 0.75)
      ctx.globalAlpha = t > 0.75 ? 1 : t / 0.75
      ctx.fillStyle = this.colour[i] as string
      const r = this.rot[i] as number
      if (r === 0 || this.square[i] === 0) {
        ctx.fillRect((this.x[i] as number) - s / 2, (this.y[i] as number) - s / 2, s, s)
      } else {
        ctx.save()
        ctx.translate(this.x[i] as number, this.y[i] as number)
        ctx.rotate(r)
        ctx.fillRect(-s / 2, -s / 2, s, s)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
  }

  clear(): void {
    this.life.fill(0)
    this.live = 0
  }
}
