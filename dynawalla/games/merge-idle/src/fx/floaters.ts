/**
 * Rising numbers. In a merge-and-idle game the ascending number *is* the juice,
 * so these get the same care as the particles: an overshooting pop-in, a slow
 * rise that decelerates, a shadow so they read over a bright reef, and a size
 * that scales with how much the number actually mattered.
 *
 * Drawn on the sharp layer, never the blurred glow layer — a number you cannot
 * read is a number that did not land.
 */

import { CHALK, rgba, type Rgb } from '../render/palette.ts'
import { FONT_STACK } from '../render/sprites.ts'
import { ease } from './shake.ts'

type Floater = {
  x: number
  y: number
  vy: number
  vx: number
  life: number
  max: number
  text: string
  size: number
  c: Rgb
  weight: number
}

export class Floaters {
  private pool: Floater[] = []

  constructor(cap = 48) {
    for (let i = 0; i < cap; i++) {
      this.pool.push({
        x: 0,
        y: 0,
        vy: 0,
        vx: 0,
        life: 0,
        max: 1,
        text: '',
        size: 20,
        c: CHALK,
        weight: 900,
      })
    }
  }

  clear(): void {
    for (const f of this.pool) f.life = 0
  }

  add(x: number, y: number, text: string, size: number, c: Rgb, dur = 1.15, weight = 900): void {
    let slot: Floater | undefined
    let oldest = this.pool[0]
    for (const f of this.pool) {
      if (f.life <= 0) {
        slot = f
        break
      }
      if (oldest && f.life < oldest.life) oldest = f
    }
    const f = slot ?? oldest
    if (!f) return
    f.x = x
    f.y = y
    f.vy = -46 - size * 1.15
    f.vx = 0
    f.life = dur
    f.max = dur
    f.text = text
    f.size = size
    f.c = c
    f.weight = weight
  }

  update(dt: number): void {
    for (const f of this.pool) {
      if (f.life <= 0) continue
      f.life = Math.max(0, f.life - dt)
      f.y += f.vy * dt
      f.x += f.vx * dt
      f.vy *= 1 - 2.1 * dt
    }
  }

  draw(g: CanvasRenderingContext2D, scale: number): void {
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const f of this.pool) {
      if (f.life <= 0) continue
      const t = 1 - f.life / f.max
      // pop in over the first 18% with an overshoot, then hold, then fade
      const grow = t < 0.18 ? ease.outBack(t / 0.18, 3.1) : 1
      const alpha = t > 0.62 ? 1 - (t - 0.62) / 0.38 : 1
      const px = f.size * grow * scale
      if (px < 1) continue
      g.font = `${f.weight} ${px}px ${FONT_STACK}`
      const x = f.x * scale
      const y = f.y * scale
      g.globalAlpha = alpha * 0.55
      g.fillStyle = 'rgba(0,0,0,1)'
      g.fillText(f.text, x, y + Math.max(1.5, px * 0.07))
      g.globalAlpha = alpha
      g.fillStyle = rgba(f.c, 1)
      g.fillText(f.text, x, y)
    }
    g.globalAlpha = 1
  }
}
