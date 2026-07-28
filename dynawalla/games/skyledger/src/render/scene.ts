// THE SCENE — everything that is drawn, and the only place trauma, bloom and
// chroma are turned into pixels.
//
// The sim hands this module `Channels` and it hands back a frame. It owns no
// rules: it cannot decide that a mark was right, it is not told where a star
// belongs until a bloom arrives carrying the station, and there is a test that
// reads these files and fails if any of them so much as mentions an answer.
//
// **Reduced motion is a branch.** Not a dimmer: a different set of drawings.
// Trauma is zero, chroma is zero, the snap is a cross-fade, the release is a
// held frame instead of a slow bloom — and the chain's link count moves onto
// the astrolabe's rim, where it is legible without a single moving pixel.

import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import { approach, unit } from "../core/feel.ts"
import { CHROMA_CAP_RPX } from "../game/escalation.ts"
import { Rng } from "../core/rng.ts"
import { drawAstrolabe, type DialView, type Ring } from "./astrolabe.ts"
import {
  alpha,
  BRASS,
  BRASS_DIM,
  BRASS_LIT,
  FIGURE_FONT,
  LAPIS_LIT,
  OXIDE,
  sized,
  STARLIGHT,
  STONE,
  VELLUM,
} from "./palette.ts"
import {
  drawBloom,
  drawHorizon,
  drawLattice,
  drawNight,
  drawStar,
  layoutFor,
  starPoint,
  stationPoint,
  type Bloom,
  type Layout,
  type StarView,
} from "./sky.ts"

/** Trauma decays this fast. Brass and stone, not glass: slow and heavy. */
const TRAUMA_DECAY = 1.9
const MAX_TRANSLATE_RPX = 22
const MAX_ROTATE_DEG = 1.6

const BLOOM_LIFE_MS = 620
const COLD_LIFE_MS = 420

/** The release ceremony. AWE: no shake, no freeze, a long slow breath out. */
const RELEASE_MS = 900

export type SceneState = {
  stars: readonly StarView[]
  lamps: number
  lampsMax: number
  dial: DialView
  held: Ring | null
  /** The stations this observatory has written down this sitting. */
  logged: ReadonlySet<number>
  bloom: number
  chromaRpx: number
  over: { logged: number; watches: number; longest: number; wide: number; best: number } | null
  stalled: boolean
}

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly g: CanvasRenderingContext2D
  private readonly rng: Rng
  readonly reduced: boolean

  private layout: Layout
  private dpr = 1
  private trauma = 0
  private blooms: Bloom[] = []
  private glow = 0
  private breath = 0
  private flicker = 0
  private release: { age: number; weight: number; links: number } | null = null

  constructor(canvas: HTMLCanvasElement, reduced: boolean, seed: number) {
    this.canvas = canvas
    this.reduced = reduced
    this.rng = new Rng(seed ^ 0x5c3e)
    const g = canvas.getContext("2d", { alpha: false })
    if (!g) throw new Error("skyledger: no 2d context")
    this.g = g
    this.layout = layoutFor(1, 1, safeRect(1, 1))
    this.resize()
  }

  get l(): Layout {
    return this.layout
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    this.dpr = Math.min(2.5, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.layout = layoutFor(w, h, safeRect(w, h))
  }

  /**
   * A star was named and is going home.
   *
   * The station arrives with the event, from the rules. The scene is never told
   * where a star belongs before the child has said it.
   */
  addBloom(
    star: { lane: number; t: number },
    station: { x: number; y: number },
    weight: number,
    link: number,
  ): void {
    const from = starPoint(this.layout, star.lane, star.t)
    const to = stationPoint(this.layout, station.x, station.y)
    this.blooms.push({
      fromX: from.px,
      fromY: from.py,
      toX: to.px,
      toY: to.py,
      age: 0,
      life: BLOOM_LIFE_MS,
      weight: unit(weight),
      link,
      cold: false,
    })
    // Class 2 KNOCK climbing toward class 4 BREAK. Never past it, and never on
    // the release, which is awe and carries no impact at all.
    if (!this.reduced) this.trauma = Math.min(1, this.trauma + 0.16 + 0.2 * unit(weight))
  }

  /** A mark that went wide. Restraint: a cold ring at the named station, no shake. */
  addCold(station: { x: number; y: number }): void {
    const to = stationPoint(this.layout, station.x, station.y)
    this.blooms.push({
      fromX: to.px,
      fromY: to.py,
      toX: to.px,
      toY: to.py,
      age: 0,
      life: COLD_LIFE_MS,
      weight: 0,
      link: 0,
      cold: true,
    })
  }

  /**
   * The snap-back.
   *
   * The channels are already at rest by the time this is called — the chain
   * dropped them in one step. What plays here is the *consequence*: a held,
   * slow, silent breath out with the chain's length written in it. Class 8.
   * Trauma stays at zero for the whole event; this is awe, not impact, and the
   * distinction is the entire point.
   */
  addRelease(links: number, weight: number): void {
    // A single correct answer is a *seat*, not a ceremony. It already had its
    // bloom; giving it a wall of light as well would make ordinary success cost
    // a second of screen and would spend the release's meaning on nothing. The
    // ceremony starts at the second link, which is the first one that was a
    // chain at all.
    if (links < 2) return
    this.release = { age: 0, weight: unit(weight), links }
  }

  /** A star reached the horizon. A lamp goes out; the ground takes the hit. */
  addLanding(): void {
    if (!this.reduced) this.trauma = Math.min(1, this.trauma + 0.24)
    this.flicker = 1
  }

  advance(dt: number, state: SceneState): void {
    this.trauma = Math.max(0, this.trauma - (TRAUMA_DECAY * dt) / 1000)
    this.breath = (this.breath + dt / 900) % 1
    this.flicker = Math.max(0, this.flicker - dt / 700)
    this.glow = approach(this.glow, state.dial.press > 0 ? 1 : 0.25, 0.16, dt)
    for (const b of this.blooms) b.age += dt
    this.blooms = this.blooms.filter((b) => b.age < b.life)
    if (this.release) {
      this.release.age += dt
      if (this.release.age > RELEASE_MS) this.release = null
    }
  }

  draw(state: SceneState): void {
    const g = this.g
    const l = this.layout
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    drawNight(g, l)

    g.save()
    if (!this.reduced && this.trauma > 0) {
      // Eiserloh's trauma model: squared, so small hits stay subtle.
      const amount = this.trauma * this.trauma
      const t = this.breath * Math.PI * 2 * 24
      g.translate(
        Math.sin(t * 1.7) * MAX_TRANSLATE_RPX * l.rpx * amount,
        Math.cos(t * 1.3) * MAX_TRANSLATE_RPX * l.rpx * amount,
      )
      g.rotate((Math.sin(t * 0.9) * MAX_ROTATE_DEG * amount * Math.PI) / 180)
    }

    // The chain's bloom channel lifts the cross-hair the child is standing at:
    // the light in a chain lands on the thing they are aiming with.
    drawLattice(
      g,
      l,
      state.logged,
      { x: state.dial.ones, y: state.dial.tens },
      Math.max(this.glow, state.bloom),
    )
    for (const star of state.stars) drawStar(g, l, star, Math.sin(this.breath * Math.PI * 2))
    for (const b of this.blooms) drawBloom(g, l, b, this.reduced)
    this.drawRelease()
    drawHorizon(g, l, state.lamps, state.lampsMax, this.flicker)
    g.restore()

    // The chromatic split rides the plane's own edges rather than the whole
    // frame: a full-screen separation on a mid-range tablet costs a composite
    // per channel and buys nothing a child can name.
    if (!this.reduced && state.chromaRpx > 0.05) this.drawChroma(state.chromaRpx)

    drawAstrolabe(g, l, state.dial, state.held, this.reduced)

    if (state.stalled) this.drawStalled()
    if (state.over) this.drawLedgerPage(state.over)
  }

  private drawRelease(): void {
    const r = this.release
    if (!r) return
    const g = this.g
    const l = this.layout
    const t = unit(r.age / RELEASE_MS)

    if (this.reduced) {
      // A held frame, then gone. No travel, no expansion — the number is the
      // event and the number does not need to move to be read.
      const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
      g.font = sized(FIGURE_FONT, Math.max(22, l.cell * 0.9))
      g.textAlign = "center"
      g.textBaseline = "middle"
      g.fillStyle = alpha(BRASS_LIT, a)
      g.fillText(`${r.links}`, l.plane.x + l.plane.w / 2, l.plane.y + l.plane.h / 2)
      return
    }

    // A wall of light that does not shake. It pulls *outward* and dissolves
    // upward, and the ring is drawn from the plane's centre so the whole
    // coordinate plane reads as the thing that is glowing.
    const spread = 1 - Math.pow(1 - t, 2.4)
    const fade = 1 - t
    const cx = l.plane.x + l.plane.w / 2
    const cy = l.plane.y + l.plane.h / 2
    g.save()
    g.globalCompositeOperation = "lighter"
    for (let i = 0; i < 3; i++) {
      const rr = l.plane.w * (0.1 + 0.62 * spread) * (1 + i * 0.16)
      g.strokeStyle = alpha(STARLIGHT, 0.2 * fade * (1 - i * 0.28) * (0.5 + 0.5 * r.weight))
      g.lineWidth = Math.max(1, l.rpx * (8 - i * 2))
      g.beginPath()
      g.arc(cx, cy, rr, 0, Math.PI * 2)
      g.stroke()
    }
    // Motes drifting up, not out. Awe rises.
    const count = Math.round(24 + 90 * r.weight)
    const drift = this.rng.fork(r.links)
    for (let i = 0; i < count; i++) {
      const a = drift.range(0, Math.PI * 2)
      const rad = drift.range(0, l.plane.w * 0.5)
      const px = cx + Math.cos(a) * rad
      const py = cy + Math.sin(a) * rad - t * l.plane.h * 0.42
      g.fillStyle = alpha(i % 5 === 0 ? BRASS_LIT : STARLIGHT, 0.5 * fade)
      g.fillRect(px, py, Math.max(1, l.rpx * 2.2), Math.max(1, l.rpx * 2.2))
    }
    g.restore()

    g.font = sized(FIGURE_FONT, Math.max(20, l.cell * (0.55 + 0.5 * r.weight)))
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = alpha(BRASS_LIT, fade)
    g.fillText(`${r.links} LOGGED`, cx, cy)
  }

  /**
   * The chromatic split, on the aperture's own edge.
   *
   * Two things it must not be. It must not be *loud*: at one link it should be
   * a thing a child feels rather than sees, which means the strength rides the
   * channel rather than sitting at full alpha the moment the channel is
   * non-zero. And it must not be *magenta*: a lighter-composited violet and
   * orange over lapis reads as a browser bug, so the two fringes are the
   * palette's own cold and warm, and the whole effect tops out translucent.
   */
  private drawChroma(rpx: number): void {
    const g = this.g
    const l = this.layout
    const d = rpx * l.rpx
    const a = Math.min(0.3, (rpx / CHROMA_CAP_RPX) * 0.3)
    g.save()
    g.globalCompositeOperation = "lighter"
    g.lineWidth = Math.max(1, l.rpx * 2)
    for (const [dx, tint] of [
      [-d, `rgba(70, 120, 220, ${a})`],
      [d, `rgba(220, 150, 70, ${a})`],
    ] as const) {
      g.strokeStyle = tint
      g.strokeRect(l.sky.x + dx, l.sky.y, l.sky.w, l.sky.h)
    }
    g.restore()
  }

  private drawStalled(): void {
    const g = this.g
    const l = this.layout
    g.fillStyle = alpha(STONE, 0.92)
    g.fillRect(0, 0, l.w, l.h)
    g.font = sized(FIGURE_FONT, Math.max(13, l.rpx * 26))
    g.textAlign = "center"
    g.textBaseline = "middle"
    g.fillStyle = OXIDE
    g.fillText("THE REGISTER IS EMPTY", l.w / 2, l.h / 2)
  }

  /**
   * The page the observatory writes at the end of a run.
   *
   * Not a game-over screen. There is no win state in this game and there is no
   * loss state either — the watch ended, and what an observatory does when a
   * watch ends is write down what it saw. The numbers are facts, in ink, on
   * vellum, and the only thing offered is another night.
   */
  private drawLedgerPage(over: {
    logged: number
    watches: number
    longest: number
    wide: number
    best: number
  }): void {
    const g = this.g
    const l = this.layout
    g.fillStyle = "rgba(5, 8, 16, 0.86)"
    g.fillRect(0, 0, l.w, l.h)

    const pw = Math.min(l.w * 0.82, 460 * Math.max(1, l.rpx * 1.5))
    const ph = Math.min(l.h * 0.62, 420 * Math.max(1, l.rpx * 1.5))
    const px = (l.w - pw) / 2
    const py = (l.h - ph) / 2
    g.fillStyle = alpha(VELLUM, 0.07)
    g.fillRect(px, py, pw, ph)
    g.strokeStyle = alpha(BRASS, 0.85)
    g.lineWidth = Math.max(1, l.rpx * 2.5)
    g.strokeRect(px, py, pw, ph)

    const line = ph / 8
    g.textBaseline = "middle"
    g.font = sized(FIGURE_FONT, Math.max(12, line * 0.34))
    g.textAlign = "center"
    g.fillStyle = BRASS_LIT
    g.fillText("THE WATCH IS WRITTEN DOWN", l.w / 2, py + line * 0.85)

    const rows: Array<[string, string]> = [
      ["STARS LOGGED", String(over.logged)],
      ["WATCHES", String(over.watches)],
      ["LONGEST CHAIN", String(over.longest)],
      ["BEST CHAIN", String(over.best)],
      ["MARKS WIDE", String(over.wide)],
    ]
    const size = Math.max(11, line * 0.3)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const y = py + line * (2.1 + i)
      g.font = sized(FIGURE_FONT, size)
      g.textAlign = "left"
      g.fillStyle = alpha(BRASS_DIM, 0.95)
      g.fillText(row[0], px + pw * 0.11, y)
      g.textAlign = "right"
      g.fillStyle = row[0] === "LONGEST CHAIN" ? STARLIGHT : BRASS_LIT
      g.font = sized(FIGURE_FONT, size * 1.25)
      g.fillText(row[1], px + pw * 0.89, y)
      g.strokeStyle = alpha(LAPIS_LIT, 0.28)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(px + pw * 0.11, y + line * 0.34)
      g.lineTo(px + pw * 0.89, y + line * 0.34)
      g.stroke()
    }

    g.textAlign = "center"
    g.font = sized(FIGURE_FONT, size)
    g.fillStyle = BRASS_LIT
    g.fillText("TOUCH FOR ANOTHER NIGHT", l.w / 2, py + ph - line * 0.8)
  }
}
