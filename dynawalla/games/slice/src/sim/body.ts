// The things in the air, and the pieces they leave behind.
//
// Four classes, and they are told apart by **silhouette and motion first**,
// colour second — which is what keeps the game readable for a colour-blind
// child and at 0.45 seconds of glance time:
//
//   GOURD    a heavy round fruit with a numeral on it, full-gravity arc
//   MELON    large, seamed, NO glyph, a slower arc — you cannot see inside
//   MOTE     a lantern that *floats* — the bomb gate's answer row
//   BOMB     a small hard-edged iron sphere with a live fuse
//
// **A helpful gourd and a decoy gourd are the same object.** Same silhouette,
// same flesh, same motion, same size for the same number of digits. Telling them
// apart is arithmetic and nothing else — there is no colour tell and no size
// tell, and `radiusFor` scaling with digit count is a MAGNITUDE tell, which is
// desirable, and must never become a helpfulness tell. That is the game.
//
// A cut chunk keeps the *half of the numeral that was on it*: the polygon is
// used as a clip path over the same pre-rendered glyph, so a 48 cut down the
// middle visibly falls apart into two halves of a 48. That one detail is most
// of why the cut feels wet instead of like a despawn.

import { Rng } from "../core/rng.ts"
import { clipHalfPlane, centroid, regularPolygon } from "../core/geom.ts"

export const B_GOURD = 0
export const B_MELON = 1
export const B_MOTE = 2
export const B_BOMB = 3

export const MAX_POLY = 14

export class Body {
  kind = B_GOURD
  alive = false
  x = 0
  y = 0
  vx = 0
  vy = 0
  grav = 1500
  rot = 0
  spin = 0
  r = 40
  value = 0
  text = ""
  fleshIdx = 0
  /** MOTE only: is this the answer? */
  correct = false
  /** MOTE only: which gate question it belongs to. */
  qid = ""
  /** A GOURD carrying an ABSURD glyph — `π`, `−∞`, `½`. Never a whole number. */
  absurd = false
  /** Set on the two halves a melon opens into, so the split cannot cascade. */
  fromMelon = false
  /** Wall-clock ms the body was created; drives the spawn squash. */
  bornAt = 0
  poly = new Float32Array(MAX_POLY * 2)
  polyN = 0
  /** Set when a bomb's fuse audio last ticked. */
  nextFuseAt = 0
  /** Motes pulse; keeps each one out of phase with its siblings. */
  phase = 0
  /** MOTE only: the slot in the fan it springs to and then hovers at. */
  homeX = 0
  homeY = 0
  /** On-screen height of this body's numeral, so a chunk can draw its half. */
  glyphH = 0
  /**
   * Wall-clock ms before which this body ignores the blade.
   *
   * Without it, the stroke that opens a sigil keeps travelling through the same
   * `resolveCuts` pass and cuts the candidates it just spawned — the child
   * "answered" in 0ms, having read nothing. Same for a cascade: a split should
   * hand you a follow-up cut, not resolve the whole factor tree on one flick.
   */
  cuttableAt = 0
  /**
   * Id of the last favour shockwave that touched this body. A single wave must
   * cut a given gourd exactly once, and the wavefront has thickness, so "have I
   * already been hit by wave 7" is the only reliable test.
   */
  waveMark = 0

  reset(): void {
    this.alive = false
    this.text = ""
    this.qid = ""
    this.absurd = false
    this.fromMelon = false
    this.correct = false
    this.cuttableAt = 0
    this.waveMark = 0
  }
}

export class Chunk {
  alive = false
  /** Polygon in chunk-local space, centred on the centroid. */
  poly = new Float32Array((MAX_POLY + 2) * 2)
  polyN = 0
  x = 0
  y = 0
  vx = 0
  vy = 0
  rot = 0
  spin = 0
  life = 0
  maxLife = 1
  fleshIdx = 0
  /** Glyph offset from the centroid, in chunk-local space, before rotation. */
  gx = 0
  gy = 0
  /** On-screen height the glyph was drawn at on the parent body. */
  gh = 0
  text = ""
  /** Unit normal of the cut, in chunk-local space — the bright face. */
  cnx = 0
  cny = 0
  gold = false
}

export class World {
  bodies: Body[] = []
  chunks: Chunk[] = []
  private scratchA = new Float32Array((MAX_POLY + 2) * 2)
  private scratchB = new Float32Array((MAX_POLY + 2) * 2)
  private cen = new Float32Array(2)
  chunkLimit = 48

  constructor(bodyCap = 110, chunkCap = 96) {
    for (let i = 0; i < bodyCap; i++) this.bodies.push(new Body())
    for (let i = 0; i < chunkCap; i++) this.chunks.push(new Chunk())
  }

  clear(): void {
    for (const b of this.bodies) b.reset()
    for (const c of this.chunks) c.alive = false
  }

  spawnBody(): Body | null {
    for (const b of this.bodies) {
      if (!b.alive) {
        b.reset()
        b.alive = true
        return b
      }
    }
    return null
  }

  liveCount(kind?: number): number {
    let n = 0
    for (const b of this.bodies) {
      if (!b.alive) continue
      if (kind === undefined || b.kind === kind) n++
    }
    return n
  }

  private freeChunk(): Chunk | null {
    let live = 0
    let oldest: Chunk | null = null
    for (const c of this.chunks) {
      if (!c.alive) return c
      live++
      if (!oldest || c.life < oldest.life) oldest = c
    }
    // At the limit, recycle the one closest to death rather than dropping the
    // cut — a cut that produces no debris reads as a bug.
    return live >= this.chunkLimit ? oldest : null
  }

  /** Give a body a shape. Gourds wobble; melons are rounder and fatter; bombs are hard. */
  shape(b: Body, rng: Rng): void {
    const sides = b.kind === B_BOMB ? 12 : b.kind === B_MELON ? 13 : 11
    const wobble = b.kind === B_BOMB ? 0 : b.kind === B_MELON ? 0.04 : 0.11
    const seed = rng.next()
    b.polyN = regularPolygon(b.poly, sides, b.r, seed * Math.PI, wobble, (i) =>
      // A cheap deterministic per-vertex jitter — no allocation, no extra rng draw.
      ((Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1 + 1) % 1,
    )
  }

  /**
   * Cut a body with the world-space line through (px,py) with unit normal
   * (nx,ny). Produces up to two chunks. Returns false if the line misses.
   */
  cut(
    b: Body,
    px: number,
    py: number,
    nx: number,
    ny: number,
    impulse: number,
    gold: boolean,
  ): boolean {
    // Transform the cut into body-local space (rotate by -rot, translate).
    const cos = Math.cos(-b.rot)
    const sin = Math.sin(-b.rot)
    const dx = px - b.x
    const dy = py - b.y
    const lpx = dx * cos - dy * sin
    const lpy = dx * sin + dy * cos
    const lnx = nx * cos - ny * sin
    const lny = nx * sin + ny * cos

    let made = false
    for (const positive of [true, false]) {
      const n = clipHalfPlane(b.poly, b.polyN, lpx, lpy, lnx, lny, positive, this.scratchA)
      if (n < 3) continue
      const c = this.freeChunk()
      if (!c) continue
      const area = centroid(this.scratchA, n, this.cen)
      if (area < 4) continue
      const ccx = this.cen[0] as number
      const ccy = this.cen[1] as number

      // Re-centre the polygon on its own centroid so it spins about its mass.
      for (let i = 0; i < n; i++) {
        this.scratchB[i * 2] = (this.scratchA[i * 2] as number) - ccx
        this.scratchB[i * 2 + 1] = (this.scratchA[i * 2 + 1] as number) - ccy
      }
      c.poly.set(this.scratchB.subarray(0, n * 2))
      c.polyN = n

      // Back to world space.
      const wc = Math.cos(b.rot)
      const ws = Math.sin(b.rot)
      c.x = b.x + ccx * wc - ccy * ws
      c.y = b.y + ccx * ws + ccy * wc
      c.rot = b.rot
      // The glyph rides along, offset by exactly how far the centroid moved.
      c.gx = -ccx
      c.gy = -ccy
      c.text = b.text
      c.gh = b.glyphH
      c.fleshIdx = b.fleshIdx
      c.gold = gold
      c.cnx = positive ? -lnx : lnx
      c.cny = positive ? -lny : lny

      // Separation: each half is pushed *away* from the cut plane, and picks up
      // spin proportional to how far off-axis its centroid ended up. This is
      // the difference between "two halves fall" and "it was cut".
      const s = positive ? 1 : -1
      const sep = impulse * 0.42
      c.vx = b.vx + nx * s * sep
      c.vy = b.vy + ny * s * sep
      const lever = ccx * lnx + ccy * lny
      c.spin = b.spin + (lever / Math.max(8, b.r)) * s * impulse * 0.022
      c.maxLife = 1.5 + Math.random() * 0.55
      c.life = c.maxLife
      c.alive = true
      made = true
    }
    return made
  }

  updateChunks(dt: number, floorY: number): void {
    for (const c of this.chunks) {
      if (!c.alive) continue
      c.life -= dt
      if (c.life <= 0 || c.y > floorY + 260) {
        c.alive = false
        continue
      }
      c.vy += 1650 * dt
      c.vx *= Math.exp(-0.35 * dt)
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.rot += c.spin * dt
    }
  }
}
