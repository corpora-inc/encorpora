/**
 * The siege field: what a wave is, what stands on it, and how it comes apart.
 *
 * The ground is exactly flat at y = 0 across the whole firing field. That is a
 * design decision, not laziness — the plain IS the number line, and a bumpy one
 * would put a float between the dial and the outcome.
 */

import type { Question } from '../contract.ts'
import { type Rng } from '../core/rng.ts'

/** World x of the launch point; ranges are measured from here. */
export const LAUNCH_X = 6
export const FIELD_MAX = 122
export const worldX = (rangeM: number): number => LAUNCH_X + rangeM

export type WaveConfig = {
  index: number
  difficulty: number
  /** boulders in the rack — one question each. When the rack empties, the wave ends. */
  ammo: number
  /** rival keeps beyond the ones your boulders are for */
  extraTowers: number
  /** magnitude cap of the crosswind, 0 for none */
  wind: number
  /** wind rerolls between shots */
  gusty: boolean
  /** the loft lever is available */
  loft: boolean
  wall: boolean
  ram: boolean
  /** keeps wear their number on a banner (the choice scaffold) */
  banners: boolean
  /** the boss wave: pick which boulder to load */
  volley: boolean
}

export function waveConfig(i: number): WaveConfig {
  const boss = i % 5 === 0
  const d = Math.min(0.95, 0.04 + (i - 1) * 0.072)
  return {
    index: i,
    difficulty: d,
    ammo: Math.min(5, 2 + Math.floor((i - 1) / 2)) + (boss ? 1 : 0),
    extraTowers: Math.min(3, 1 + Math.floor((i - 1) / 3)),
    wind: i < 3 ? 0 : Math.min(9, 2 + Math.floor((i - 3) / 1.6)),
    gusty: i >= 7,
    loft: i >= 4,
    wall: i >= 5 && i % 3 !== 1,
    ram: i >= 7 && i % 2 === 1,
    banners: i < 8 ? true : i % 3 !== 0,
    volley: boss,
  }
}

/* ------------------------------------------------------------------ */

export type Block = {
  /** offsets from the tower base while attached; world coords once loose */
  x: number
  y: number
  w: number
  h: number
  rot: number
  vx: number
  vy: number
  spin: number
  loose: boolean
  settled: boolean
  tone: number
}

export type Tower = {
  id: number
  /** integer metres from the launch point — and its printed value; they are the same number */
  range: number
  value: number
  alive: boolean
  /** 0..1 structural damage from grazes */
  damage: number
  lean: number
  leanV: number
  blocks: Block[]
  heightM: number
  widthM: number
  /** set when a boulder's answer names this keep */
  wanted: boolean
  /** banner reveal animation 0..1 */
  reveal: number
  /** hit flash 0..1 */
  flash: number
}

export function buildTower(id: number, range: number, rng: Rng, tall = false): Tower {
  const rows = tall ? rng.int(5, 6) : rng.int(3, 5)
  const w = 4.6
  const rowH = 1.95
  const blocks: Block[] = []
  for (let r = 0; r < rows; r++) {
    const inset = r >= rows - 1 ? 0.5 : 0
    const n = r >= rows - 1 ? 1 : 2
    for (let c = 0; c < n; c++) {
      const bw = (w - inset * 2) / n
      blocks.push({
        x: -w / 2 + inset + c * bw + bw / 2,
        y: r * rowH + rowH / 2,
        w: bw * 0.97,
        h: rowH * 0.94,
        rot: 0,
        vx: 0,
        vy: 0,
        spin: 0,
        loose: false,
        settled: false,
        tone: rng.int(0, 2),
      })
    }
  }
  // crenellations
  for (let k = 0; k < 3; k++) {
    blocks.push({
      x: -w / 2 + 0.9 + k * 1.4,
      y: rows * rowH + 0.55,
      w: 1.0,
      h: 1.1,
      rot: 0,
      vx: 0,
      vy: 0,
      spin: 0,
      loose: false,
      settled: false,
      tone: rng.int(0, 2),
    })
  }
  return {
    id,
    range,
    value: range,
    alive: true,
    damage: 0,
    lean: 0,
    leanV: 0,
    blocks,
    heightM: rows * rowH + 1.2,
    widthM: w,
    wanted: false,
    reveal: 0,
    flash: 0,
  }
}

/**
 * Knock a tower apart from an impulse origin.
 * `freeAll` is what a kill uses: a destroyed keep must not be left standing,
 * because a keep that is standing reads as a keep you did not destroy.
 */
export function shatter(
  t: Tower,
  originX: number,
  originY: number,
  power: number,
  rng: Rng,
  freeAll = false,
  maxFree = Infinity,
): number {
  const bx = worldX(t.range)
  let freed = 0
  // nearest masonry first, so a glancing blow chips the face rather than
  // teleporting the far side of the keep into the sky
  const order = t.blocks
    .map((b, i) => ({ b, i, d: Math.hypot(bx + b.x - originX, b.y - originY) }))
    .sort((p, q) => p.d - q.d)
  for (const { b } of order) {
    if (b.loose) continue
    if (freed >= maxFree) break
    const wx = bx + b.x
    const wy = b.y
    const dx = wx - originX
    const dy = wy - originY
    const dist = Math.max(1.2, Math.hypot(dx, dy))
    const f = Math.max(freeAll ? 3.2 : 0, (power * 26) / (dist * dist))
    if (!freeAll && f < 0.7 && rng.next() > 0.45) continue
    b.loose = true
    freed++
    const m = Math.hypot(dx, dy) || 1
    b.x = wx
    b.y = wy
    b.vx = (dx / m) * f * rng.range(0.7, 1.35) + rng.range(-1.5, 3.5)
    b.vy = (dy / m) * f * rng.range(0.8, 1.5) + rng.range(2, 9)
    b.spin = rng.range(-7, 7)
  }
  return freed
}

const BLOCK_G = 26

export function stepBlocks(t: Tower, dt: number): boolean {
  let moving = false
  for (const b of t.blocks) {
    if (!b.loose || b.settled) continue
    b.vy -= BLOCK_G * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.rot += b.spin * dt
    if (b.y - b.h * 0.5 <= 0) {
      b.y = b.h * 0.5
      if (Math.abs(b.vy) < 2.2) {
        b.vy = 0
        b.vx *= 0.55
        b.spin *= 0.5
        if (Math.abs(b.vx) < 0.5 && Math.abs(b.spin) < 0.6) {
          b.settled = true
          b.vx = 0
          b.spin = 0
          // lie flat where it fell
          b.rot = Math.round(b.rot / (Math.PI / 2)) * (Math.PI / 2)
        }
      } else {
        b.vy = -b.vy * 0.28
        b.vx *= 0.7
        b.spin *= 0.7
      }
    }
    moving = true
  }
  // the stump leans and rights itself
  if (t.lean !== 0 || t.leanV !== 0) {
    t.leanV += -t.lean * 24 * dt
    t.leanV *= Math.exp(-4.5 * dt)
    t.lean += t.leanV * dt
    if (Math.abs(t.lean) < 0.002 && Math.abs(t.leanV) < 0.01) {
      t.lean = 0
      t.leanV = 0
    } else moving = true
  }
  return moving
}

/* ------------------------------------------------------------------ */

export type Crater = { x: number; r: number; depth: number; age: number; label: number; correct: boolean }

export type Ghost = { pts: Array<{ x: number; y: number }>; landing: number; age: number; hit: boolean }

/** A battering ram: pure pressure. No number on it — read the ground to lead it. */
export type Ram = {
  /** metres from the launch point, decreasing */
  range: number
  speed: number
  alive: boolean
  wheel: number
  hp: number
  bob: number
}

/**
 * Lay out the keeps. Every value must be an integer, inside the field, and at
 * least `minGap` from every other, or two keeps would occupy the same ground.
 */
export function layoutTowerValues(
  answers: number[],
  pools: number[][],
  extra: number,
  minGap: number,
  lo: number,
  hi: number,
  rng: Rng,
): number[] {
  const chosen = answers.slice()
  const ok = (v: number): boolean =>
    Number.isInteger(v) && v >= lo && v <= hi && chosen.every((c) => Math.abs(v - c) >= minGap)
  const flat: number[] = []
  const maxLen = Math.max(0, ...pools.map((p) => p.length))
  for (let i = 0; i < maxLen; i++) for (const p of pools) if (i < p.length) flat.push(p[i])
  for (const v of flat) {
    if (chosen.length >= answers.length + extra) break
    if (ok(v)) chosen.push(v)
  }
  let guard = 0
  while (chosen.length < answers.length + extra && guard++ < 500) {
    const v = rng.int(lo, hi)
    if (ok(v)) chosen.push(v)
  }
  return chosen.sort((a, b) => a - b)
}

export type Boulder = { q: Question; answer: number; spent: boolean; hit: boolean }

/** Pull `n` questions whose answers can all stand apart on the same field. */
export function pullQuestions(
  next: () => Question,
  n: number,
  minGap: number,
  lo: number,
  hi: number,
): { boulders: Boulder[]; pools: number[][] } {
  const boulders: Boulder[] = []
  const pools: number[][] = []
  let guard = 0
  while (boulders.length < n && guard++ < 200) {
    const q = next()
    const a = Number(q.answer)
    if (!Number.isInteger(a) || a < lo || a > hi) continue
    if (boulders.some((b) => Math.abs(b.answer - a) < minGap)) continue
    boulders.push({ q, answer: a, spent: false, hit: false })
    pools.push(q.distractors.map(Number).filter(Number.isInteger))
  }
  return { boulders, pools }
}
