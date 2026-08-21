// The building, drawn.
//
// Nothing in here decides anything. The rules live in `game/game.ts` and this
// module is told what is standing; its whole job is to make a tower that is one
// floor taller *feel* one floor taller.
//
// Three things carry that:
//
//   1. **The camera pulls back with volume.** One scale factor fits tower plus
//      keystone into the frame, and everything — slabs, keystone, the colossus
//      itself — is drawn through it. A tower that grew makes the giant smaller.
//      Nobody has to be told the tower got bigger; they are further away.
//   2. **Floors fall.** A slab's height above the ground is simulated, not
//      tweened: blow a hole in the middle and everything above accelerates into
//      it and lands, with dust and a shake proportional to how far it fell.
//   3. **Rubble is indistinguishable from stone.** See `palette.ts`.
//
// Reduced motion takes a different branch, not a smaller one: the camera is
// still fitted, slabs still change height, and the impact still reports itself
// — but positions are set rather than travelled to, and the dust is a ring in
// place of a cloud. See `dust.ts`.

import { approach, easeOutCubic, unit } from "../core/feel.ts"
import { Rng } from "../core/rng.ts"
import type { Floor } from "../game/tower.ts"
import { Dust } from "./dust.ts"
import {
  cameraFor,
  pipX,
  viewLayout,
  FLOOR_H,
  FLOOR_W,
  KEY_GAP,
  KEY_H,
  type Layout,
} from "./layout.ts"
import * as C from "./palette.ts"

/** World units. The colossus itself; the building's are in `layout.ts`. */
const GIANT_H = 306

/** Gravity, world units per millisecond squared. Stone, not feathers. */
const G = 0.0042
const MAX_FALL = 2.4

export type Banner = { title: string; tint: string; age: number }

export type SceneState = {
  readonly floors: readonly Floor[]
  readonly isHeld: (id: number) => boolean
  readonly prompt: string
  readonly heldValues: readonly number[]
  readonly level: number
  readonly progress: { done: number; total: number }
  readonly best: number
  readonly paused: boolean
  readonly stalled: boolean
  readonly banner: Banner | null
}

type Slab = {
  /** Height of the slab's underside above the ground, in world units. */
  h: number
  v: number
  landed: boolean
}

type Debris = {
  value: number
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  angle: number
  age: number
  life: number
}

export type Metrics = {
  /** Screen-space y of the ground line. */
  groundY: number
  cx: number
  scale: number
  /** The strike pill, in screen space. */
  strike: { x: number; y: number; w: number; h: number }
}

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly dust: Dust
  private readonly rng: Rng
  private readonly reduced: boolean

  private w = 0
  private h = 0
  private dpr = 1

  /**
   * Every measurement in the frame, safe area and host chrome accounted for.
   *
   * This is the ONLY source of geometry in the renderer. Nothing below reaches
   * for `this.w`/`this.h` to decide where a number goes — those two are the
   * canvas, and the canvas runs under the notch on purpose.
   */
  private lay: Layout = viewLayout(1, 1)

  private slabs = new Map<number, Slab>()
  private debris: Debris[] = []

  private scale = 1
  private shake = 0
  private time = 0
  /** 1 the instant the fist lands, decaying to 0. Drives the arm, nothing else. */
  private punch = 0

  private metrics: Metrics = {
    groundY: 0,
    cx: 0,
    scale: 1,
    strike: { x: 0, y: 0, w: 0, h: 0 },
  }

  constructor(canvas: HTMLCanvasElement, reduced: boolean, seed: number) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("colossus: no 2d context")
    this.ctx = ctx
    this.reduced = reduced
    this.rng = new Rng(seed ^ 0xc0105505)
    this.dust = new Dust(this.rng.fork(7), reduced)
    this.resize()
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.dpr = Math.min(3, globalThis.devicePixelRatio || 1)
    this.w = Math.max(1, Math.round(rect.width))
    this.h = Math.max(1, Math.round(rect.height))
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    // Re-read the insets here rather than at mount: a rotation swaps top and
    // bottom for left and right, and iPadOS changes them again in Split View.
    this.lay = viewLayout(this.w, this.h)
  }

  get view(): Metrics {
    return this.metrics
  }

  /** Slabs blown out of the building fly; the hole they leave is real. */
  blowOut(removed: readonly Floor[], order: readonly Floor[]): void {
    const { groundY, cx, scale } = this.metrics
    for (const floor of removed) {
      const slab = this.slabs.get(floor.id)
      const h = slab ? slab.h : indexOfIn(order, floor.id) * FLOOR_H
      const y = groundY - (h + FLOOR_H * 0.5) * scale
      this.dust.burst(cx, y, FLOOR_W * scale)
      if (!this.reduced) {
        this.debris.push({
          value: floor.value,
          x: cx + this.rng.range(-30, 30),
          y,
          vx: this.rng.range(-0.62, 0.62),
          vy: -this.rng.range(0.18, 0.72),
          spin: this.rng.range(-0.004, 0.004),
          angle: 0,
          age: 0,
          life: 1500,
        })
      }
      this.slabs.delete(floor.id)
    }
    this.shake = Math.min(1, this.shake + 0.5 + removed.length * 0.1)
    this.punch = 1
  }

  /** New stone comes in from above the frame and lands on the top. */
  dropIn(added: readonly Floor[], baseIndex: number): void {
    added.forEach((floor, i) => {
      const target = (baseIndex + i) * FLOOR_H
      this.slabs.set(floor.id, {
        h: this.reduced ? target : target + 320 + i * 120,
        v: 0,
        landed: this.reduced,
      })
    })
    this.shake = Math.min(1, this.shake + 0.28)
    this.punch = 1
  }

  advance(dt: number, state: SceneState): void {
    this.time += dt
    const n = state.floors.length

    // The camera. Fit tower plus keystone plus a little sky — inside the band
    // `layout.ts` cleared for it, which begins below the notch and below the
    // host's two corners rather than at a hardcoded 74.
    const l = this.lay
    const cam = cameraFor(l, n)
    this.scale = this.reduced
      ? cam.scale
      : Math.min(cam.cap, approach(this.scale, cam.scale, 0.06, dt))

    const groundY = cam.groundY
    this.metrics = {
      groundY,
      cx: cam.cx,
      scale: this.scale,
      strike: l.strike,
    }

    // Slab physics. Anything above its resting height is falling.
    state.floors.forEach((floor, i) => {
      const target = i * FLOOR_H
      let slab = this.slabs.get(floor.id)
      if (!slab) {
        slab = { h: this.reduced ? target : target + 26, v: 0, landed: this.reduced }
        this.slabs.set(floor.id, slab)
      }
      if (this.reduced) {
        slab.h = target
        slab.landed = true
        return
      }
      if (slab.h > target) {
        slab.v = Math.min(MAX_FALL, slab.v + G * dt)
        slab.h -= slab.v * dt
        if (slab.h <= target) {
          const force = Math.min(1, slab.v / 1.4)
          slab.h = target
          slab.v = 0
          if (!slab.landed || force > 0.18) {
            this.dust.impact(
              this.metrics.cx,
              groundY - target * this.scale,
              FLOOR_W * this.scale,
              force,
            )
            this.shake = Math.min(1, this.shake + force * 0.42)
          }
          slab.landed = true
        }
      } else if (slab.h < target) {
        // Stone slotted in underneath: it rises to meet the building.
        slab.h = Math.min(target, slab.h + 0.9 * dt)
      }
    })

    // Forget slabs that are no longer standing.
    const live = new Set(state.floors.map((f) => f.id))
    for (const id of [...this.slabs.keys()]) if (!live.has(id)) this.slabs.delete(id)

    for (const d of this.debris) {
      d.age += dt
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 0.0022 * dt
      d.angle += d.spin * dt
    }
    this.debris = this.debris.filter((d) => d.age < d.life && d.y < this.h + 200)

    this.dust.advance(dt)
    this.shake = Math.max(0, this.shake - dt / 420)
    this.punch = Math.max(0, this.punch - dt / 320)
  }

  draw(state: SceneState): void {
    const ctx = this.ctx
    ctx.save()
    ctx.scale(this.dpr, this.dpr)

    this.sky()
    this.skyline()

    const shake = this.reduced ? 0 : this.shake * this.shake
    ctx.save()
    if (shake > 0) {
      ctx.translate(
        Math.sin(this.time * 0.09) * shake * 9,
        Math.cos(this.time * 0.13) * shake * 7,
      )
    }

    this.giant()
    this.ground()
    this.tower(state)
    this.keystone(state)
    for (const d of this.debris) this.debrisSlab(d)
    this.dust.draw(ctx)
    ctx.restore()

    this.hud(state)
    if (state.banner) this.banner(state.banner)
    if (state.stalled) this.stalled()
    ctx.restore()
  }

  // ── the world ─────────────────────────────────────────────────────────────

  private sky(): void {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, this.h)
    g.addColorStop(0, C.SKY_HIGH)
    g.addColorStop(0.52, C.SKY_MID)
    g.addColorStop(1, C.SKY_LOW)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)

    // The sun going down behind the bazaar, low and enormous.
    const gy = this.metrics.groundY
    const sun = ctx.createRadialGradient(this.w * 0.5, gy, 0, this.w * 0.5, gy, this.w * 0.72)
    sun.addColorStop(0, "rgba(255, 176, 96, 0.42)")
    sun.addColorStop(0.45, "rgba(224, 112, 58, 0.16)")
    sun.addColorStop(1, "rgba(224, 112, 58, 0)")
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, this.w, this.h)
  }

  /** Minarets, far off, so the tower has something to be taller than. */
  private skyline(): void {
    const ctx = this.ctx
    const gy = this.metrics.groundY
    ctx.save()
    ctx.fillStyle = "rgba(20, 12, 26, 0.66)"
    const rng = new Rng(0x51571e)
    let x = -20
    while (x < this.w + 40) {
      const w = rng.range(26, 62)
      const h = rng.range(24, 96)
      ctx.fillRect(x, gy - h, w, h + 4)
      if (rng.chance(0.34)) {
        // A minaret: a needle with a bulb.
        const mx = x + w * 0.5
        ctx.fillRect(mx - 4, gy - h - 46, 8, 46)
        ctx.beginPath()
        ctx.arc(mx, gy - h - 50, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      x += w + rng.range(6, 26)
    }
    ctx.restore()
  }

  private ground(): void {
    const ctx = this.ctx
    const gy = this.metrics.groundY
    ctx.fillStyle = C.GROUND
    ctx.fillRect(0, gy, this.w, this.h - gy)
    ctx.fillStyle = C.GROUND_EDGE
    ctx.fillRect(0, gy - 2, this.w, 3)
    ctx.fillStyle = C.HAZE
    ctx.fillRect(0, gy - 26, this.w, 26)
  }

  /**
   * The colossus. Drawn through the same camera as the tower, which is the
   * point: when the building grows, the giant is further away and smaller, and
   * a child reads "this got bigger than me" without a word of copy.
   *
   * A silhouette with one rim light off the sunset, and the rim is the same
   * silhouette drawn once more a few pixels toward the sun — so it can never
   * drift off the shape it belongs to, whatever the arm is doing.
   *
   * No face. A face would make it a character with an opinion about how the
   * child is doing, and the only thing here entitled to an opinion is the
   * building.
   */
  private giant(): void {
    const ctx = this.ctx
    const { groundY, cx, scale } = this.metrics
    const u = GIANT_H * scale
    // Beside the building where there is room, and behind it where there is
    // not. On a phone the tower takes the width and the fist goes behind the
    // stone — which is fine: the fist is a flourish, and a colossus whose helm
    // and shoulder rise past the edge of the frame reads as *more* enormous,
    // not less.
    const x = Math.max(u * 0.24, cx - FLOOR_W * 0.5 * scale - u * 0.8)
    const breathe = this.reduced ? 0 : Math.sin(this.time * 0.0016) * u * 0.008
    // The arm winds back and comes through on a strike. `punch` is spent in
    // `advance`, so a still frame is a giant standing still.
    const reach = u * (0.04 + easeOutCubic(this.punch) * 0.28)
    const rim = Math.max(1.2, u * 0.011)

    ctx.save()
    ctx.translate(x, groundY + breathe)
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    ctx.save()
    ctx.translate(rim, -rim * 0.5)
    this.giantBody(u, reach, C.GIANT_RIM)
    ctx.restore()
    this.giantBody(u, reach, C.GIANT)

    ctx.restore()
  }

  /** Every piece of the colossus, in one colour. Called twice; see `giant`. */
  private giantBody(u: number, reach: number, ink: string): void {
    const ctx = this.ctx
    ctx.fillStyle = ink
    ctx.strokeStyle = ink

    // Legs: heavy, planted, slightly apart.
    ctx.lineWidth = u * 0.16
    ctx.beginPath()
    ctx.moveTo(-u * 0.14, -u * 0.08)
    ctx.lineTo(-u * 0.09, -u * 0.34)
    ctx.moveTo(u * 0.12, -u * 0.08)
    ctx.lineTo(u * 0.07, -u * 0.34)
    ctx.stroke()

    // Torso: narrow at the hips, enormous across the shoulders.
    ctx.beginPath()
    ctx.moveTo(-u * 0.16, -u * 0.28)
    ctx.lineTo(u * 0.16, -u * 0.28)
    ctx.lineTo(u * 0.27, -u * 0.62)
    ctx.lineTo(u * 0.24, -u * 0.71)
    ctx.lineTo(-u * 0.24, -u * 0.71)
    ctx.lineTo(-u * 0.27, -u * 0.62)
    ctx.closePath()
    ctx.fill()

    // A squared helm with a short spire, so the silhouette belongs to the same
    // city as the minarets behind it. The spire sinks into the helm so the two
    // are one shape rather than two.
    ctx.beginPath()
    ctx.moveTo(-u * 0.035, -u * 0.86)
    ctx.lineTo(0, -u * 1.04)
    ctx.lineTo(u * 0.035, -u * 0.86)
    ctx.closePath()
    ctx.fill()
    roundRect(ctx, -u * 0.1, -u * 0.9, u * 0.2, u * 0.2, u * 0.05)
    ctx.fill()

    // The far arm hangs. The near arm is cocked, and the fist is the thing that
    // meets the building.
    ctx.lineWidth = u * 0.1
    ctx.beginPath()
    ctx.moveTo(-u * 0.22, -u * 0.66)
    ctx.lineTo(-u * 0.3, -u * 0.34)
    ctx.stroke()

    const fistX = u * 0.5 + reach
    const fistY = -u * 0.58
    ctx.lineWidth = u * 0.12
    ctx.beginPath()
    ctx.moveTo(u * 0.2, -u * 0.66)
    ctx.lineTo(u * 0.4 + reach * 0.5, -u * 0.7)
    ctx.lineTo(fistX, fistY)
    ctx.stroke()
    roundRect(ctx, fistX - u * 0.1, fistY - u * 0.1, u * 0.2, u * 0.2, u * 0.06)
    ctx.fill()
  }

  private tower(state: SceneState): void {
    const { groundY, cx, scale } = this.metrics
    const w = FLOOR_W * scale
    const fh = FLOOR_H * scale

    state.floors.forEach((floor, i) => {
      const slab = this.slabs.get(floor.id)
      const h = slab ? slab.h : i * FLOOR_H
      const y = groundY - (h + FLOOR_H) * scale
      this.slab(cx - w / 2, y, w, fh, floor.value, state.isHeld(floor.id))
    })
  }

  private slab(x: number, y: number, w: number, h: number, value: number, held: boolean): void {
    const ctx = this.ctx
    const inset = Math.max(1, h * 0.06)
    const face = held ? C.HELD_FACE : C.SLAB_FACE
    const top = held ? C.HELD_TOP : C.SLAB_TOP
    const side = held ? C.HELD_SIDE : C.SLAB_SIDE

    if (held) {
      ctx.save()
      ctx.shadowColor = C.HELD_GLOW
      ctx.shadowBlur = Math.max(10, h * 0.55)
    }

    ctx.fillStyle = side
    ctx.fillRect(x, y, w, h - inset)
    ctx.fillStyle = face
    ctx.fillRect(x + inset, y + inset, w - inset * 2, h - inset * 3)
    ctx.fillStyle = top
    ctx.fillRect(x + inset, y + inset, w - inset * 2, Math.max(1, inset * 0.9))

    if (held) ctx.restore()

    // Cut lines, so a slab reads as quarried stone rather than a rectangle.
    ctx.strokeStyle = C.SLAB_CRACK
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + w * 0.22, y + h * 0.18)
    ctx.lineTo(x + w * 0.22, y + h * 0.82)
    ctx.moveTo(x + w * 0.78, y + h * 0.18)
    ctx.lineTo(x + w * 0.78, y + h * 0.82)
    ctx.stroke()

    const label = String(value)
    const size = fit(label, w * 0.46, h * 0.62)
    ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = C.SLAB_TEXT
    ctx.fillText(label, x + w / 2, y + h * 0.47)
  }

  private debrisSlab(d: Debris): void {
    const ctx = this.ctx
    const t = unit(d.age / d.life)
    const s = this.metrics.scale
    ctx.save()
    ctx.globalAlpha = 1 - t * t
    ctx.translate(d.x, d.y)
    ctx.rotate(d.angle)
    const w = FLOOR_W * 0.34 * s
    const h = FLOOR_H * 0.7 * s
    ctx.fillStyle = C.SLAB_SIDE
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.fillStyle = C.SLAB_FACE
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 5)
    ctx.fillStyle = C.SLAB_TEXT
    const size = fit(String(d.value), w * 0.7, h * 0.6)
    ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(d.value), 0, 0)
    ctx.restore()
  }

  /** The keystone: the sum the whole building answers to, hung over the top. */
  private keystone(state: SceneState): void {
    const ctx = this.ctx
    const { groundY, cx, scale } = this.metrics
    const n = state.floors.length
    const w = FLOOR_W * 1.16 * scale
    const h = KEY_H * scale
    const y = groundY - (n * FLOOR_H + KEY_GAP + KEY_H) * scale
    const x = cx - w / 2
    const float = this.reduced ? 0 : Math.sin(this.time * 0.0018) * h * 0.05

    ctx.save()
    ctx.translate(0, float)

    // The chain of light that holds it over the building.
    const grad = ctx.createLinearGradient(cx, y + h, cx, groundY - n * FLOOR_H * scale)
    grad.addColorStop(0, "rgba(255, 200, 130, 0.5)")
    grad.addColorStop(1, "rgba(255, 200, 130, 0)")
    ctx.strokeStyle = grad
    ctx.lineWidth = Math.max(1.5, 4 * scale)
    ctx.beginPath()
    ctx.moveTo(cx, y + h)
    ctx.lineTo(cx, groundY - n * FLOOR_H * scale)
    ctx.stroke()

    ctx.fillStyle = C.KEYSTONE_FACE
    roundRect(ctx, x, y, w, h, Math.min(14, h * 0.18))
    ctx.fill()
    ctx.strokeStyle = C.KEYSTONE_EDGE
    ctx.lineWidth = Math.max(1.5, 2.5 * scale)
    ctx.stroke()

    const label = state.prompt || "—"
    const size = fit(label, w * 0.86, h * 0.5)
    ctx.font = `700 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = C.KEYSTONE_INK
    ctx.fillText(label, cx, y + h * 0.5)
    ctx.restore()
  }

  // ── the chrome ────────────────────────────────────────────────────────────

  private hud(state: SceneState): void {
    const ctx = this.ctx
    const l = this.lay

    // Left: which tower this is. Right: how many keystones are left in it, as
    // stones. No sentences: the pips are the progress.
    //
    // Both are pulled INBOARD of the host's two 44px corners rather than pushed
    // below them — the exit control sits top-left and the how-to-play control
    // top-right, and `TOWER 3` used to be underneath the first of them.
    ctx.font = `700 ${l.hudFont}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillStyle = C.HUD_DIM
    ctx.fillText(`TOWER ${state.level}`, l.hudX, l.towerY)

    const total = Math.max(1, state.progress.total)
    for (let i = 0; i < total; i++) {
      ctx.fillStyle = i < state.progress.done ? C.HUD_DIM : C.HUD_INK
      ctx.fillRect(pipX(l, i, total), l.pipY, l.pipW, l.pipH)
    }

    if (state.best > 0) {
      ctx.textAlign = "left"
      ctx.fillStyle = C.HUD_DIM
      ctx.fillText(`BEST ${state.best}`, l.hudX, l.bestY)
    }

    // The fist. It reads back the expression the child is holding — and never
    // its total. Multiplying it out is their half of the bargain.
    const r = this.metrics.strike
    const armed = state.heldValues.length > 0
    ctx.save()
    ctx.fillStyle = C.HUD_PLATE
    roundRect(ctx, r.x, r.y, r.w, r.h, r.h * 0.32)
    ctx.fill()
    ctx.strokeStyle = armed ? C.STRIKE_ON : C.HUD_EDGE
    ctx.lineWidth = armed ? 2.5 : 1.2
    ctx.stroke()

    if (armed) {
      const expr = state.heldValues.join(" × ")
      const size = fit(expr, r.w * 0.52, r.h * 0.52)
      ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      ctx.fillStyle = C.HUD_INK
      ctx.fillText(expr, r.x + r.h * 0.36, r.y + r.h * 0.5)

      ctx.font = `800 ${Math.round(r.h * 0.3)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
      ctx.textAlign = "right"
      ctx.fillStyle = C.STRIKE_ON
      ctx.fillText("STRIKE", r.x + r.w - r.h * 0.36, r.y + r.h * 0.5)
    } else {
      ctx.font = `700 ${Math.round(r.h * 0.26)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = C.STRIKE_OFF
      ctx.fillText("STRIKE", r.x + r.w / 2, r.y + r.h * 0.5)
    }
    ctx.restore()

    if (state.paused) {
      ctx.fillStyle = "rgba(10, 6, 12, 0.55)"
      ctx.fillRect(0, 0, this.w, this.h)
    }
  }

  private banner(b: Banner): void {
    const ctx = this.ctx
    const t = unit(b.age / 1500)
    const rise = easeOutCubic(unit(b.age / 420))
    ctx.save()
    ctx.globalAlpha = t > 0.75 ? (1 - t) * 4 : 1
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const { area } = this.lay
    const size = fit(b.title, area.w * 0.82, 56)
    ctx.font = `900 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.fillStyle = b.tint
    ctx.shadowColor = "rgba(0,0,0,0.6)"
    ctx.shadowBlur = 18
    const y = area.y + area.h * 0.34 + (1 - rise) * (this.reduced ? 0 : 28)
    ctx.fillText(b.title, this.lay.cx, y)
    ctx.restore()
  }

  private stalled(): void {
    const ctx = this.ctx
    ctx.fillStyle = "rgba(10, 6, 12, 0.86)"
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = C.HUD_INK
    ctx.font = `600 17px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    const { area } = this.lay
    ctx.fillText("Nothing to build with.", this.lay.cx, area.y + area.h / 2)
  }

  // ── hit testing ───────────────────────────────────────────────────────────

  /** The floor under a screen point, tested against where it is *drawn*. */
  floorAt(px: number, py: number, floors: readonly Floor[]): number | null {
    const { groundY, cx, scale } = this.metrics
    const w = FLOOR_W * scale
    if (Math.abs(px - cx) > w / 2 + 8) return null
    for (let i = floors.length - 1; i >= 0; i--) {
      const floor = floors[i]
      if (!floor) continue
      const slab = this.slabs.get(floor.id)
      const h = slab ? slab.h : i * FLOOR_H
      const top = groundY - (h + FLOOR_H) * scale
      const bottom = groundY - h * scale
      if (py >= top && py <= bottom) return floor.id
    }
    return null
  }

  hitsStrike(px: number, py: number): boolean {
    const r = this.metrics.strike
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
  }

  reset(): void {
    this.slabs.clear()
    this.debris = []
    this.dust.clear()
    this.shake = 0
    this.punch = 0
  }
}

function indexOfIn(order: readonly Floor[], id: number): number {
  const i = order.findIndex((f) => f.id === id)
  return i < 0 ? 0 : i
}

/** A font size that keeps `text` inside a box, without measuring in a loop. */
function fit(text: string, maxW: number, maxH: number): number {
  const perChar = maxW / Math.max(1, text.length * 0.62)
  return Math.max(9, Math.min(maxH, perChar))
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}
