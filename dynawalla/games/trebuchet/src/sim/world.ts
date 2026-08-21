/**
 * The siege field: what a wave is, what stands on it, and how it comes apart.
 *
 * The ground is exactly flat at y = 0 across the whole firing field. That is a
 * design decision, not laziness — the plain IS the number line, and a bumpy one
 * would put a float between the dial and the outcome.
 */

import type { Question } from '../contract.ts'
import { type Rng } from '../core/rng.ts'
import { heightAtX, LAUNCH_H, WIND_MAX, WIND_MIN } from './ballistics.ts'
import { shotFor } from './verdict.ts'

// The field geometry is declared next to the blast that gives it its meaning; it
// is re-exported here because this is the module the rest of the game asks about
// the field.
export { MIN_GAP, WIND_MAX, WIND_MIN } from './ballistics.ts'

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
    wall: i >= 5 && i % 3 !== 1,
    ram: i >= 7 && i % 2 === 1,
    banners: i < 8 ? true : i % 3 !== 0,
    volley: boss,
  }
}

/**
 * The one loft the machine throws at.
 *
 * There used to be five, on a lever that appeared at wave 4. It changed nothing
 * a child could be scored on: the shot is solved for the metre she names, so all
 * five landed on the same metre, and measured over 1,616 wall situations three of
 * the five settings were identical to this one and the two below it were blocked
 * by the wall 42.9% and 21.9% of the time. A lever whose every position is either
 * the default or worse than it is not a choice; it is a way to lose. It is gone.
 *
 * The alternative — making the loft the wind's multiplier, so a higher arc hangs
 * longer and drifts further — was considered and rejected. It would stack a
 * multiplication on top of the sum and the wind adjustment, three steps deep, on
 * a child who is here to practise `47 + 25`, and the founder's complaint is that
 * this game is confusing.
 */
export const LOFT_DEG = 46

/**
 * When the wind starts blowing, and how hard: a ladder indexed by what the child
 * has DEMONSTRATED, not by where the curriculum happens to be pointing.
 *
 * It used to be a position on the host's ladder (`WIND_FROM_D = 0.34`), on the
 * reasoning that the item's own difficulty is the host's judgement of where the
 * child is. The reasoning is sound and the measurement killed it: `game.ts` climbs
 * the difficulty it asks for by a notch a wave and SWEEPS, wrapping, whenever a
 * rung's answers will not fit on 122 metres, so the rung served oscillates and the
 * wind oscillated with it — on at wave 4, off at 8, back at 14, gone at 18. See
 * `sim/felled.ts` for the run.
 *
 * So it is bought instead, with keeps felled. Three steps, and the whole table is
 * here so that "monotone non-decreasing in what she has demonstrated" is something
 * you can read rather than something you have to trust:
 *
 *     felled  0..11   no wind        — the game the founder is not complaining about
 *     felled 12..23   ±4 or ±5       — two magnitudes: not one nudge to memorise
 *     felled 24+      ±4, ±5 or ±6   — the whole mechanic
 *
 * The first twelve are necessarily felled in still air, because there is no wind
 * below twelve, so step 1 is bought by fluency at the ONE-step game; the twelve
 * after it are felled in a wind, so step 2 is bought by fluency at the two-step
 * game. Twelve keeps is roughly the first four or five waves' worth of boulders,
 * which is where the old difficulty gate landed too — but now it lands there
 * because she has been putting boulders on the metre, and a child who has not is
 * simply still playing the one-step game. There is no clock in this and no wave
 * counter: a child can take six goes at a keep and the twelfth felled keep still
 * buys the wind.
 *
 * The steps stop at three because the geometry stops there. `WIND_MIN` is one
 * metre past the blast and `WIND_MAX` one metre inside the garrison's reach (see
 * `ballistics.ts`), so 4..6 is the entire honest range and there is nothing left to
 * stagger. A fourth step would have to invent headroom the field does not have.
 */
export const WIND_STEPS: ReadonlyArray<{ felled: number; cap: number }> = [
  { felled: 0, cap: 0 },
  { felled: 12, cap: WIND_MIN + 1 },
  { felled: 24, cap: WIND_MAX },
]

/**
 * How hard the wind may blow for a child who has felled this many keeps — the size
 * of the second arithmetic step, in metres.
 *
 * A pure function of the count and nothing else. It never opens below `WIND_MIN`,
 * so from the first wind she ever meets the adjustment is a real subtraction and
 * not a nudge of the dial she could learn by watching; and it never shrinks, so the
 * rule about what a right answer looks like changes exactly once.
 */
export function windCapFor(felled: number): number {
  if (!Number.isFinite(felled)) return 0
  let cap = 0
  for (const step of WIND_STEPS) if (felled >= step.felled) cap = step.cap
  return cap
}

/* ------------------------------------------------------------------ *
 * The field, the answers it can hold, and how far the dial reaches.
 * ------------------------------------------------------------------ */

/**
 * The window of answers this game can physically ask about.
 *
 * A keep stands at its own answer in METRES, on a field 122 metres long, and the
 * blast is wide enough that two keeps must be `MIN_GAP` (8 m) apart to be distinct
 * targets. So the answer to every question TREBUCHET poses has to be an integer
 * in this window — that is not a tuning choice, it is what "the range dial is the
 * answer" costs.
 *
 * Nothing about the question stream guarantees it. The host hands out rungs off a
 * single cross-domain ladder addressed by a 0..1 difficulty, and a pack cannot
 * see what arithmetic sits on a rung before it asks. Measured against the shipped
 * 66-rung ladder, the difficulties this game used to ask for returned:
 *
 *     wave 1  d=0.040  dw.add.facts.subtract-within-ten   answers 0-4     0/12 placeable
 *     wave 2  d=0.112  dw.add.facts.subtract-within-ten   answers 1-9     0/12
 *     wave 3  d=0.184  dw.add.facts.subtract-across-ten   answers 2-9     0/12
 *     wave 5  d=0.328  dw.mul.facts.tables-to-twelve      answers 8-81    9/12
 *     wave 6  d=0.400  dw.add.column.subtract-no-regroup  answers to 5400 0/12
 *     wave 7  d=0.472  dw.mul.scale.times-power-of-ten    answers in the millions
 *
 * Waves 1-3 and 6 upward could not put a single keep on the field, so the rack
 * came back empty, the equation plaque had nothing to draw and the fire button
 * had no boulder to throw. That is the whole of the bug this window exists to
 * make impossible: the game now FINDS a rung it can place instead of assuming it
 * was handed one.
 */
export const PLACEABLE_LO = 14
export const PLACEABLE_HI = FIELD_MAX - 4

/**
 * How far the dial winds — and it is WIDER than the field, on purpose.
 *
 * The dial is the range in still air, and in a wind the child aims off it: to put
 * a boulder on metre 14 with the wind pushing 6 metres downrange she has to dial 8,
 * and to put one on 118 against a 6-metre headwind she has to dial 124. If the dial
 * stopped at the field the compensation would be inexpressible at both ends — a
 * correct answer she is physically unable to enter, which is the same defect as a
 * correct answer scored wrong. So the dial carries `WIND_MAX` of slack past
 * `PLACEABLE_LO..PLACEABLE_HI` at both ends, and `windValues` can never ask for
 * more than that.
 *
 * Nothing lands out there: a shot dialled to 124 into a 6-metre headwind
 * decelerates the whole way and comes down at 118, and the drawn ground already
 * runs 40 metres past the field.
 */
export const DIAL_MIN = PLACEABLE_LO - WIND_MAX
export const DIAL_MAX = PLACEABLE_HI + WIND_MAX

/**
 * How far the dial may be wound IN THIS WIND, so that the metre she is claiming is
 * a metre that exists.
 *
 * The dial reaches past both ends of the field so that the compensation is always
 * expressible, and that slack used to have to be paid for at the other end: when
 * the wind reached 9, dialling 5 into a nine-metre headwind claimed metre −4, and a
 * boulder aimed at metre −4 arced forward, turned round in mid-air and came down
 * behind the trebuchet. Found by sweeping the dial rather than by reading the code,
 * which is the only way that kind of corner ever turns up.
 *
 * At `WIND_MAX = 6` the floor is 8 and `1 − wind` never exceeds 7, so the `1 −
 * wind` term can no longer bind and the corner is gone from the geometry rather
 * than merely guarded. The guard stays because it is the thing that has to remain
 * true if the field or the blast ever move, and it costs one `Math.max`.
 *
 * So the claim is held inside `1..DIAL_MAX` and the dial's own stops move with the
 * wind. **This can never bind on a child who is right**, and that is arithmetic and
 * not a hope: her dial is `answer − wind` with the answer in `PLACEABLE_LO..HI`, so
 * the tightest corner is `answer = PLACEABLE_LO` in the strongest tailwind, which
 * asks for exactly `PLACEABLE_LO − WIND_MAX = DIAL_MIN`, the floor itself. Asserted
 * over every wind and every answer in `verdict.test.ts`.
 */
export function dialRange(wind: number): { lo: number; hi: number } {
  return { lo: Math.max(DIAL_MIN, 1 - wind), hi: DIAL_MAX - Math.max(0, wind) }
}

/**
 * Where the rival's outwork stands, and how tall.
 *
 * **A shot at the nearest keep can always be made.** The wall used to be placed
 * at `max(14, nearest × 0.46)`, which for a keep at 14–17 m is the keep's own
 * ground — every shot at it hit the wall. And it was sized off a still-air probe,
 * while a shot that beats a tailwind launches at `answer − wind` and flies lower,
 * so on windy waves a correctly aimed shot smashed into it. Height is taken from
 * the LOWEST the loft can ever be over that point — the strongest tailwind the
 * wave can produce — so a correct shot clears it in any wind.
 *
 * It no longer has a second job. The old upper bound existed to keep the wall
 * tall enough that the flattest loft could not clear it, so that the loft lever
 * had something to be for; the lever is gone and the bound went with it.
 */
export function wallFor(nearest: number, windCap: number): { x: number; h: number } {
  const x = Math.max(10, Math.min(Math.round(nearest * 0.46), Math.max(10, nearest - 6)))
  const lowest = heightAtX(shotFor(nearest - windCap, LOFT_DEG, windCap, LAUNCH_H), x)
  return { x, h: Math.max(4, lowest * 0.78) }
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

/**
 * The game loop's phases. They live here, next to the one piece of the sim that
 * has to ask about them, so that `ramAdvances` is checked against the real set
 * rather than against `string` — under which renaming a phase would silently
 * put the ram back on the child's thinking time with every test still green.
 */
export type Phase =
  /**
   * No boulder can be loaded yet, because nothing the question stream has
   * offered will fit on the field. The game is looking for a rung it can place —
   * see `stock()` — and it is emphatically NOT 'aim': a child cannot aim at a
   * question that is not there, and calling it 'aim' is what lit the fire button
   * over an empty rack.
   */
  | 'stocking'
  | 'intro'
  | 'aim'
  | 'windup'
  | 'flight'
  | 'impact'
  | 'settle'
  | 'clear'

/**
 * Does the ram roll during this phase?
 *
 * It does not roll while the child is reading the boulder and turning the dial.
 * EXPERIENCE_DESIGN.md: comprehension is "the child's time. Measured, never
 * limited" — and the how-to-play panel promises "there is no clock, nothing
 * happens until you fire". A ram that closed on the walls while she was working
 * out 47 + 25 made both of those false, and hurried exactly the child who was
 * thinking hardest. It advances on shots taken, not on seconds spent thinking:
 * every boulder she throws, it gets closer. It is also held still during the
 * hit-stop, where everything else is.
 */
export function ramAdvances(phase: Phase): boolean {
  return (
    phase !== 'stocking' && phase !== 'intro' && phase !== 'aim' && phase !== 'impact'
  )
}

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

/**
 * Pull up to `n` questions whose answers can all stand apart on the same field.
 *
 * **`seen` is not diagnostics — the game steers on it.** A keep stands at its own
 * answer in metres, so this game can only ask a question whose answer fits on a
 * 122-metre field: everything outside `lo..hi` is unplaceable and is dropped
 * here. When the question stream is aimed at the wrong rung, EVERY answer is
 * dropped and the rack comes back empty — which used to leave a child with a
 * blank plaque and a fire button that did nothing. So the answers that were
 * rejected are handed back with the ones that were kept, and `stock()` in
 * `game.ts` reads them to work out which way to move the difficulty it asks for.
 * A rejection nobody can see is a rejection nobody can correct.
 *
 * Each rejected answer is reported WITH the difficulty of the question it came
 * from. That pairing is what makes the search safe: the pool on the other side of
 * `next` is refilled asynchronously, so the first answers after a difficulty
 * change are still the old rung's, and a search that steered on them would read
 * "still too easy" about a request it had already made and stride straight past
 * the band. The caller compares the difficulty it asked for against the
 * difficulty it was served and only steers on evidence about the right rung.
 *
 * `maxPulls` bounds the draw. A stocking attempt that drained the pool dry would
 * spend hundreds of curriculum items to learn one bit about a rung; a small draw,
 * repeated on later frames, learns the same thing and lets the pool keep up.
 */
export function pullQuestions(
  next: () => Question,
  n: number,
  minGap: number,
  lo: number,
  hi: number,
  maxPulls = 200,
): {
  boulders: Boulder[]
  pools: number[][]
  seen: Array<{ answer: number; difficulty: number }>
} {
  const boulders: Boulder[] = []
  const pools: number[][] = []
  const seen: Array<{ answer: number; difficulty: number }> = []
  let guard = 0
  while (boulders.length < n && guard++ < maxPulls) {
    const q = next()
    const a = Number(q.answer)
    if (Number.isFinite(a)) seen.push({ answer: a, difficulty: q.difficulty })
    if (!Number.isInteger(a) || a < lo || a > hi) continue
    if (boulders.some((b) => Math.abs(b.answer - a) < minGap)) continue
    boulders.push({ q, answer: a, spent: false, hit: false })
    pools.push(q.distractors.map(Number).filter(Number.isInteger))
  }
  return { boulders, pools, seen }
}
