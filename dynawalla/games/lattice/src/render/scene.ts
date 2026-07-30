// The shell's drawing. Canvas 2D, one pass, no allocation in the hot loop
// beyond what the browser does for a path.
//
// The arena's coordinate space *is* CSS pixel space — `mount.ts` resizes the
// arena to the element — so there is no camera and no transform to get wrong.
// The device pixel ratio is applied once, to the context, at resize.
//
// What is drawn, back to front: the sheet, the resonator, the bodies, the
// shots, the ship, the sparks, and then the chrome — the factor tile bar, which
// is the whole passive layer made legible and is never allowed to be covered by
// anything.
//
// The world uses the whole canvas. The chrome uses `hudLayout`, which keeps it
// inside the safe area and clear of the host's two corner controls — see
// `hud.ts` for why those are different rectangles.

import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import type { Arena, Body, Resonator } from "../game/arena.ts"
import { HUSK_R, MOTE_R, RESONATOR_R, SHIP_R, SHOT_R } from "../game/arena.ts"
import type { Grid } from "../sim/grid.ts"
import { hudLayout, type HudLayout } from "./hud.ts"
import { Sparks } from "./particles.ts"
import {
  BRASS,
  BRASS_LIGHT,
  CELESTIAL,
  CELESTIAL_DIM,
  CELESTIAL_INK,
  INK,
  INK_DIM,
  LAPIS,
  LAPIS_LIGHT,
  OXIDE,
  STONE,
  STONE_EDGE,
  STONE_INK,
  STRUT,
  STRUT_HOT,
  STRUT_TORN,
  VOID,
  VOID_HI,
  chromeFont,
  numeralFont,
} from "./palette.ts"

export type Banner = { text: string; tint: string; age: number }

const BANNER_MS = 1400

export class Scene {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  cssWidth = 0
  cssHeight = 0
  readonly sparks: Sparks
  banner: Banner | null = null
  /** Screen shake, in pixels. Zero forever under reduced motion. */
  private shake = 0
  /**
   * Where the tile bar was last drawn. Tapping your own hold is how you let it
   * go, so the shell needs the rectangle and the bar is the only thing that
   * knows where it ended up.
   */
  private barRect = { x: 0, y: 0, w: 0, h: 0 }
  /**
   * Where the chrome may be drawn: inside the safe area and below the host's
   * two corner controls. Recomputed on every resize, because a rotation swaps
   * the insets over and Split View changes them without one.
   */
  private hud: HudLayout

  private readonly canvas: HTMLCanvasElement
  private reduced: boolean

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas
    this.reduced = reduced
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("lattice: no 2d context")
    this.ctx = ctx
    this.sparks = new Sparks(reduced)
    this.hud = hudLayout(320, { x: 0, y: 0, w: 320, h: 320 })
    this.resize()
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
    this.sparks.setReduced(reduced)
    if (reduced) this.shake = 0
  }

  resize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect()
    this.cssWidth = Math.max(320, Math.round(rect.width || 800))
    this.cssHeight = Math.max(320, Math.round(rect.height || 600))
    this.dpr = Math.min(2.5, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.round(this.cssWidth * this.dpr)
    this.canvas.height = Math.round(this.cssHeight * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // The world gets the whole canvas; the chrome gets the safe rectangle.
    this.hud = hudLayout(this.cssWidth, safeRect(this.cssWidth, this.cssHeight))
    return { width: this.cssWidth, height: this.cssHeight }
  }

  /** A knock felt through the frame. Under reduced motion it is not felt. */
  knock(amount: number): void {
    if (this.reduced) return
    this.shake = Math.min(14, this.shake + amount)
  }

  say(text: string, tint: string): void {
    this.banner = { text, tint, age: 0 }
  }

  advance(dtMs: number): void {
    this.sparks.step(dtMs)
    this.shake *= Math.exp(-0.009 * dtMs)
    if (this.shake < 0.15) this.shake = 0
    if (this.banner) {
      this.banner.age += dtMs
      if (this.banner.age > BANNER_MS) this.banner = null
    }
  }

  draw(arena: Arena, grid: Grid, state: { best: number; paused: boolean; stalled: boolean }): void {
    const ctx = this.ctx
    const w = this.cssWidth
    const h = this.cssHeight

    ctx.save()
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
    }

    // The void, with a cold wash where the resonator is listening.
    ctx.fillStyle = VOID
    ctx.fillRect(-20, -20, w + 40, h + 40)
    if (arena.resonator) {
      const g = ctx.createRadialGradient(
        arena.resonator.x,
        arena.resonator.y,
        0,
        arena.resonator.x,
        arena.resonator.y,
        Math.max(w, h) * 0.55,
      )
      g.addColorStop(0, VOID_HI)
      g.addColorStop(1, VOID)
      ctx.fillStyle = g
      ctx.fillRect(-20, -20, w + 40, h + 40)
    }

    this.drawGrid(grid)
    if (arena.resonator) this.drawResonator(arena.resonator, arena.ship)
    for (const body of arena.bodies) this.drawBody(body)

    ctx.fillStyle = BRASS_LIGHT
    for (const shot of arena.shots) {
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, SHOT_R, 0, Math.PI * 2)
      ctx.fill()
    }

    this.drawShip(arena)
    this.sparks.draw(ctx)
    ctx.restore()

    this.drawTileBar(arena)
    this.drawStatus(arena, state)
    if (state.paused) this.drawSheet()
  }

  // ── the sheet ────────────────────────────────────────────────────────────

  private drawGrid(grid: Grid): void {
    const ctx = this.ctx
    ctx.lineWidth = 1
    // Two passes so the torn struts sit on top of the intact ones and read as
    // a seam rather than as noise mixed through the weave.
    ctx.strokeStyle = STRUT
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      if ((grid.strutTorn[s] as number) > 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      const stretch = Math.abs(
        (Math.hypot(bx - ax, by - ay) - (grid.strutRest[s] as number)) /
          (grid.strutRest[s] as number),
      )
      if (stretch > 0.12) continue
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()

    // Struts under load light up: this is where the sheet is carrying the news.
    ctx.strokeStyle = STRUT_HOT
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      if ((grid.strutTorn[s] as number) > 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      const stretch = Math.abs(
        (Math.hypot(bx - ax, by - ay) - (grid.strutRest[s] as number)) /
          (grid.strutRest[s] as number),
      )
      if (stretch <= 0.12) continue
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()

    // The tear. Two stubs with nothing between them — the sheet is open here.
    ctx.strokeStyle = STRUT_TORN
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      const torn = grid.strutTorn[s] as number
      if (torn <= 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax + (bx - ax) * 0.3, ay + (by - ay) * 0.3)
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + (ax - bx) * 0.3, by + (ay - by) * 0.3)
    }
    ctx.stroke()
    ctx.lineWidth = 1
  }

  // ── the bodies ───────────────────────────────────────────────────────────

  private drawBody(body: Body): void {
    const ctx = this.ctx
    const pop = Math.min(1, body.age / 160)
    const r = (body.prime ? MOTE_R : HUSK_R) * (0.6 + 0.4 * pop)

    if (body.prime) {
      // A prime is the only thing in the arena that is its own light source.
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const x = body.x + Math.cos(a) * r
        const y = body.y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = CELESTIAL
      ctx.fill()
      ctx.strokeStyle = CELESTIAL_DIM
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = CELESTIAL_INK
      ctx.font = numeralFont(r * 1.05)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(body.value), body.x, body.y + 1)
      return
    }

    // A composite is carved stone: inert, and waiting to be opened.
    ctx.save()
    ctx.translate(body.x, body.y)
    ctx.beginPath()
    const k = r * 0.82
    ctx.rect(-k, -k, k * 2, k * 2)
    ctx.fillStyle = STONE
    ctx.fill()
    ctx.strokeStyle = STONE_EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = STONE_INK
    const digits = String(body.value).length
    ctx.font = numeralFont((k * 1.5) / Math.max(1, digits * 0.62))
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(body.value), 0, 1)
    ctx.restore()
  }

  private drawShip(arena: Arena): void {
    const ctx = this.ctx
    // The hull, not the guns. `facing` eases toward `aiming` over about 55ms, so
    // a thumb sliding round the right stick turns the ship rather than flicking
    // it — a large part of what read as "moves around too wildly". The shots
    // still leave along `aiming`, because a shooter whose bullets lag its stick
    // lies about where it is pointed.
    const aim = arena.facing
    const a = Math.atan2(aim.y, aim.x)
    ctx.save()
    ctx.translate(arena.ship.x, arena.ship.y)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(SHIP_R * 1.35, 0)
    ctx.lineTo(-SHIP_R * 0.85, SHIP_R * 0.85)
    ctx.lineTo(-SHIP_R * 0.35, 0)
    ctx.lineTo(-SHIP_R * 0.85, -SHIP_R * 0.85)
    ctx.closePath()
    ctx.fillStyle = BRASS
    ctx.fill()
    ctx.strokeStyle = BRASS_LIGHT
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  private drawResonator(res: Resonator, ship: { x: number; y: number }): void {
    const ctx = this.ctx
    const listening = res.cooldown <= 0
    const pulse = this.reduced ? 0 : Math.sin(res.age / 420) * 2.6
    const r = RESONATOR_R + pulse

    ctx.save()
    ctx.translate(res.x, res.y)

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = listening ? LAPIS : "#241f1a"
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = listening ? BRASS : OXIDE
    ctx.stroke()

    // A second ring that closes as the *ship* nears, not as the hold nears.
    //
    // This started out as a proximity ring on the value — it filled as the
    // hold's product approached the target and went gold when it matched. That
    // is the comparison the child is here to make. A ring that makes it for
    // them turns "work out 47 + 25, then work out which primes reach 72" into
    // "sweep until the light goes gold", and the whole reasoning layer is gone
    // with nothing failing anywhere. So the only instrument for comparing is
    // the child's own tile bar against the answer they worked out, and this
    // ring says nothing about arithmetic at all.
    if (listening) {
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(ship.x - res.x, ship.y - res.y) / 380))
      if (near > 0.01) {
        ctx.beginPath()
        ctx.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + near * Math.PI * 2)
        ctx.strokeStyle = LAPIS_LIGHT
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    ctx.fillStyle = listening ? INK : INK_DIM
    ctx.font = numeralFont(Math.min(26, (r * 1.7) / Math.max(3, res.prompt.length * 0.5)))
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(res.prompt, 0, 0)
    ctx.restore()
  }

  // ── the chrome ───────────────────────────────────────────────────────────

  /**
   * The factor tile bar. This is the passive layer and it is the reason the
   * game teaches anything at all when nobody is trying: `2·2·3` sitting under a
   * running 12, changing the instant a mote is swept.
   */
  private drawTileBar(arena: Arena): void {
    const ctx = this.ctx
    const tiles = arena.bank.tiles
    const { size, gap, dotW, y, cx } = this.hud.bar

    const total = tiles.length * size + Math.max(0, tiles.length - 1) * dotW
    const valueText = tiles.length === 0 ? "" : `= ${arena.bank.value}`
    ctx.font = chromeFont(size * 0.8, 600)
    const valueW = valueText === "" ? 0 : ctx.measureText(valueText).width + gap * 2
    const left = cx - (total + valueW) / 2
    let x = left
    // A 44px minimum hit zone around the bar, per the touch-target rule — the
    // bar is small type and the tap that drops a hold must not be fiddly.
    this.barRect =
      tiles.length === 0
        ? { x: 0, y: 0, w: 0, h: 0 }
        : {
            x: left - 12,
            y: y - Math.max(22, size),
            w: total + valueW + 24,
            h: Math.max(44, size * 2),
          }

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (let i = 0; i < tiles.length; i++) {
      const value = tiles[i] as number
      ctx.beginPath()
      ctx.rect(x, y - size / 2, size, size)
      ctx.fillStyle = CELESTIAL
      ctx.fill()
      ctx.strokeStyle = CELESTIAL_DIM
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = CELESTIAL_INK
      ctx.font = numeralFont(size * 0.62)
      ctx.fillText(String(value), x + size / 2, y + 1)
      x += size
      if (i < tiles.length - 1) {
        ctx.fillStyle = INK_DIM
        ctx.font = chromeFont(size * 0.7, 700)
        ctx.fillText("·", x + dotW / 2, y)
        x += dotW
      }
    }
    if (valueText !== "") {
      ctx.fillStyle = BRASS_LIGHT
      ctx.font = chromeFont(size * 0.8, 600)
      ctx.textAlign = "left"
      ctx.fillText(valueText, x + gap, y)
    } else {
      // Shown only until the first resonator has been opened. After that the
      // child knows, and a line of standing instructions on every empty hold
      // for the rest of the session is copy nobody reads and everybody pays to
      // translate.
      if (arena.opened === 0) {
        ctx.fillStyle = INK_DIM
        ctx.font = chromeFont(size * 0.52, 500)
        ctx.textAlign = "center"
        ctx.fillText("SWEEP THE LIT ONES", cx, y)
      }
    }
  }

  private drawStatus(
    arena: Arena,
    state: { best: number; paused: boolean; stalled: boolean },
  ): void {
    const ctx = this.ctx
    const { size, top, lineH, left, right, cx } = this.hud.status
    ctx.font = chromeFont(size, 600)
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = INK_DIM
    ctx.fillText(`OPENED ${arena.opened}`, left, top)
    ctx.fillStyle = arena.chain > 0 ? BRASS_LIGHT : INK_DIM
    ctx.fillText(`CHAIN ${arena.chain}`, left, top + lineH)
    ctx.textAlign = "right"
    ctx.fillStyle = INK_DIM
    ctx.fillText(`BEST ${state.best}`, right, top)

    if (state.stalled) {
      // On its own row. Centred at the counters' height it would be shouldered
      // by BEST on a phone, and one row lower it would sit on CHAIN.
      ctx.textAlign = "center"
      ctx.fillStyle = OXIDE
      ctx.fillText("NO RESONATOR — SWEEP ON", cx, top + lineH * 2)
    }

    if (this.banner) {
      const t = Math.min(1, this.banner.age / 180)
      ctx.globalAlpha = Math.min(1, (BANNER_MS - this.banner.age) / 360) * t
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = this.banner.tint
      ctx.font = chromeFont(Math.max(20, Math.min(38, this.cssWidth / 20)), 700)
      ctx.fillText(this.banner.text, this.hud.banner.cx, this.hud.banner.cy)
      ctx.globalAlpha = 1
    }
  }

  /** What the pack looks like under the host's sheet: still, and honest. */
  private drawSheet(): void {
    const ctx = this.ctx
    ctx.fillStyle = "rgba(5,8,16,0.55)"
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)
    ctx.fillStyle = INK_DIM
    ctx.font = chromeFont(Math.max(14, Math.min(20, this.cssWidth / 40)), 600)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("PAUSED", this.hud.sheet.cx, this.hud.sheet.cy)
  }

  /** Did a press land on the tile bar? That gesture drops the hold. */
  hitsTileBar(x: number, y: number): boolean {
    const r = this.barRect
    return r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  /** Ceremony for a resonator opening. Colour and light, never confetti. */
  celebrate(x: number, y: number, tiles: readonly number[]): void {
    this.sparks.burst(x, y, 14 + tiles.length * 5, 420, BRASS_LIGHT, 3)
    this.sparks.burst(x, y, 10 + tiles.length * 3, 260, CELESTIAL, 2)
    this.knock(6)
    this.say("RESONANCE", BRASS_LIGHT)
  }

  refusal(x: number, y: number): void {
    this.sparks.burst(x, y, 8, 160, OXIDE, 2)
  }

  split(x: number, y: number): void {
    this.sparks.burst(x, y, 12, 300, STONE_INK, 2.2)
    this.knock(1.6)
  }

  wall(x: number, y: number): void {
    this.sparks.burst(x, y, 5, 130, CELESTIAL, 1.8)
  }

  sweep(x: number, y: number): void {
    this.sparks.burst(x, y, 6, 180, CELESTIAL, 1.6)
  }

  jostle(x: number, y: number): void {
    this.sparks.burst(x, y, 9, 220, OXIDE, 2)
    this.knock(3)
  }

  dispose(): void {
    this.canvas.remove()
  }
}
