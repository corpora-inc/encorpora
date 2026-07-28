// THE LATTICE — the rules.
//
// Everything a child can do to this game happens through a method on `Arena`,
// and every method returns the list of things that happened. Nothing in this
// file draws, measures a canvas, or reads a clock it was not handed; the shell
// in `mount.ts` owns all three. That split is why the rules are testable
// without a browser and why the tests in `src/test` are about the mathematics
// rather than about pixels.
//
// The loop, in one paragraph. Composite husks drift on the grid. A shot cracks
// one along a factor pair — 72 becomes 8 and 9, the 8 becomes 2 and 4, the 4
// becomes 2 and 2 — and a shot that hits a prime is refused, because a prime
// does not go. So the field grinds itself down into primes, and primes are what
// the ship sweeps. What is swept shows in the tile bar as a live factor tree:
// `2·2·3` under a running 12. In the middle of it all hangs a resonator with a
// problem on its face, and it opens for one thing only — a hold whose primes
// multiply to the answer.

import { Bank } from "./bank.ts"
import type { Host, Question } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import {
  MOTE_PRIMES,
  huskify,
  isPrime,
  multisetDifference,
  primeFactors,
  splitPair,
} from "./factor.ts"
import { isAskable, resonate } from "./resonance.ts"

/** The largest value a resonator will ask for. See `resonance.isAskable`. */
export const MAX_TARGET = 999

/** How many questions to draw looking for one a resonator can honestly ask. */
const DRAW_ATTEMPTS = 8

/** Radii in arena units. The arena is nominally about 1000 units wide. */
export const SHIP_R = 15
export const MOTE_R = 17
export const HUSK_R = 24
export const RESONATOR_R = 46
export const SHOT_R = 5

/** Speeds, in arena units per second. */
const SHIP_ACCEL = 2600
const SHIP_DRAG = 4.2
const SHIP_MAX = 620
const SHOT_SPEED = 1150
const SHOT_LIFE_MS = 1400
const FIRE_COOLDOWN_MS = 110
const DRIFT_MIN = 30
const DRIFT_MAX = 110

/** How long a refused resonator stays dim before it will listen again. */
const REFUSE_COOLDOWN_MS = 900

/** How long the ship is intangible after a jostle, so one bump is one cost. */
const JOSTLE_GRACE_MS = 700

/**
 * Where a released mote lands, and how long the ship cannot pick one up.
 *
 * Both exist for the same reason, and it is not cosmetic: a mote handed back at
 * the ship's own position is a mote the ship is already touching, so it is
 * swept again on the very next frame. Venting would then do nothing at all, a
 * refusal would hand the same wrong hold straight back, and a jostle would cost
 * nothing — three separate rules quietly cancelled by one geometry mistake.
 * So released motes are thrown clear on a ring, moving outward, and the ship's
 * sweep is deaf for long enough for them to get there.
 */
const RELEASE_RADIUS = 96
const RELEASE_GRACE_MS = 520

export type Vec = { x: number; y: number }

export type Body = {
  readonly id: number
  /** The integer on its face. Composite → a husk. Prime → a mote to sweep. */
  readonly value: number
  readonly prime: boolean
  x: number
  y: number
  vx: number
  vy: number
  /** Set the frame it was born, so the shell can pop it in. */
  age: number
}

export type Shot = { id: number; x: number; y: number; vx: number; vy: number; life: number }

export type Resonator = {
  readonly questionId: string
  readonly prompt: string
  readonly target: number
  x: number
  y: number
  vx: number
  vy: number
  /** Milliseconds of dim after a refusal. Counts down. */
  cooldown: number
  /** Once a resonator has been answered once, the id is spent. */
  reported: boolean
  age: number
}

export type ArenaEvent =
  | { kind: "split"; at: Vec; from: number; into: readonly [number, number] }
  | { kind: "wall"; at: Vec; value: number }
  | { kind: "sweep"; at: Vec; value: number; tiles: readonly number[]; total: number }
  | { kind: "full"; at: Vec }
  | { kind: "jostle"; at: Vec; lost: number | null }
  | { kind: "vent"; at: Vec; count: number }
  | { kind: "fire"; at: Vec }
  | { kind: "open"; at: Vec; target: number; tiles: readonly number[] }
  | { kind: "refuse"; at: Vec; asserted: number; target: number }
  | { kind: "arrive"; at: Vec; target: number; prompt: string }
  | { kind: "stalled" }

export type ArenaOptions = { width: number; height: number }

export class Arena {
  readonly bank = new Bank()
  ship: Vec & { vx: number; vy: number } = { x: 0, y: 0, vx: 0, vy: 0 }
  bodies: Body[] = []
  shots: Shot[] = []
  resonator: Resonator | null = null

  /** How many resonators the child has opened. The only number worth showing. */
  opened = 0
  /** Consecutive resonators opened without a refusal in between. */
  chain = 0
  stalled = false

  private width: number
  private height: number
  private nextId = 1
  private aim: Vec = { x: 1, y: 0 }
  private move: Vec = { x: 0, y: 0 }
  private cooldownMs = 0
  private graceMs = 0
  private sweepGraceMs = 0
  private paused = false
  private pausedAt = 0
  /** Wall-clock mark the current resonator was armed at, shifted over a pause. */
  private askedAt = 0

  private readonly host: Host
  private readonly rng: Rng

  constructor(host: Host, rng: Rng, options: ArenaOptions) {
    this.host = host
    this.rng = rng
    this.width = Math.max(320, options.width)
    this.height = Math.max(320, options.height)
    this.ship.x = this.width / 2
    this.ship.y = this.height * 0.72
  }

  // ── the frame ────────────────────────────────────────────────────────────

  begin(now: number): ArenaEvent[] {
    return this.arm(now)
  }

  resize(width: number, height: number): void {
    this.width = Math.max(320, width)
    this.height = Math.max(320, height)
    const clamp = (p: { x: number; y: number }, r: number): void => {
      p.x = Math.min(Math.max(r, p.x), this.width - r)
      p.y = Math.min(Math.max(r, p.y), this.height - r)
    }
    clamp(this.ship, SHIP_R)
    for (const b of this.bodies) clamp(b, b.prime ? MOTE_R : HUSK_R)
    if (this.resonator) clamp(this.resonator, RESONATOR_R)
  }

  get bounds(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  get isPaused(): boolean {
    return this.paused
  }

  /**
   * The host put a sheet over a frame that is still mounted and still running.
   * Three things stop dead, and each is real damage if it does not: input (a
   * touch behind the sheet is not something the child did), the resonator's
   * clock (time behind a sheet is not time spent thinking), and the world.
   */
  pause(now: number): void {
    if (this.paused) return
    this.paused = true
    this.pausedAt = now
  }

  resume(now: number): void {
    if (!this.paused) return
    this.paused = false
    // Shift the mark forward by exactly the sheet, so the latency reported is
    // still the time the child spent with the problem.
    this.askedAt += Math.max(0, now - this.pausedAt)
  }

  // ── input ────────────────────────────────────────────────────────────────

  setMove(x: number, y: number): void {
    if (this.paused) return
    const m = Math.hypot(x, y)
    this.move = m > 1 ? { x: x / m, y: y / m } : { x, y }
  }

  setAim(x: number, y: number): void {
    if (this.paused) return
    const m = Math.hypot(x, y)
    if (m > 1e-6) this.aim = { x: x / m, y: y / m }
  }

  get aiming(): Vec {
    return this.aim
  }

  fire(): ArenaEvent[] {
    if (this.paused || this.cooldownMs > 0) return []
    this.cooldownMs = FIRE_COOLDOWN_MS
    this.shots.push({
      id: this.nextId++,
      x: this.ship.x + this.aim.x * (SHIP_R + 4),
      y: this.ship.y + this.aim.y * (SHIP_R + 4),
      vx: this.aim.x * SHOT_SPEED + this.ship.vx * 0.3,
      vy: this.aim.y * SHOT_SPEED + this.ship.vy * 0.3,
      life: SHOT_LIFE_MS,
    })
    return [{ kind: "fire", at: { x: this.ship.x, y: this.ship.y } }]
  }

  /**
   * Everything in the hold goes back on the field as motes.
   *
   * The bank is exact, so a child who swept a stray 5 needs a way out that is
   * not "start again" and is not a penalty. Nothing is destroyed: the primes
   * come back and can be re-swept, which is also why this is honest — the
   * factorisation on the bar never becomes a lie about what is on the field.
   */
  vent(): ArenaEvent[] {
    if (this.paused) return []
    const let_go = this.bank.release()
    if (let_go.length === 0) return []
    this.scatter(let_go, this.ship.x, this.ship.y)
    return [{ kind: "vent", at: { x: this.ship.x, y: this.ship.y }, count: let_go.length }]
  }

  // ── the three mathematical acts ───────────────────────────────────────────

  /**
   * A shot lands on a body.
   *
   * A composite comes apart along a factor pair — exactly, with the product
   * conserved. A prime does not: that is the wall, and it has its own event and
   * its own sound rather than being a silent no-op.
   */
  strike(bodyId: number): ArenaEvent[] {
    if (this.paused) return []
    const index = this.bodies.findIndex((b) => b.id === bodyId)
    if (index < 0) return []
    const body = this.bodies[index] as Body
    const at = { x: body.x, y: body.y }

    if (body.prime) {
      // Not a miss and not a failure. The shot shoves the mote — a child who
      // works this out can herd a 13 across the arena with their gun, which is
      // the reward for noticing that primes do not go.
      const m = Math.hypot(body.vx, body.vy) || 1
      body.vx += (body.vx / m) * 90
      body.vy += (body.vy / m) * 90
      return [{ kind: "wall", at, value: body.value }]
    }

    const pair = splitPair(body.value, this.rng)
    if (!pair) {
      // Unreachable: `prime` is exactly `isPrime(value)` and everything else
      // above 3 has a divisor pair. Loud rather than silent if it ever is not.
      console.error("[lattice] a composite would not split", body.value)
      return []
    }
    this.bodies.splice(index, 1)
    const angle = this.rng.range(0, Math.PI * 2)
    const kick = this.rng.range(70, 150)
    this.spawnAt(pair[0], body.x, body.y, body.vx + Math.cos(angle) * kick, body.vy + Math.sin(angle) * kick)
    this.spawnAt(pair[1], body.x, body.y, body.vx - Math.cos(angle) * kick, body.vy - Math.sin(angle) * kick)
    return [{ kind: "split", at, from: body.value, into: pair }]
  }

  /**
   * The ship reaches a body.
   *
   * A prime is swept into the hold. A composite is not — it jostles the ship
   * and shakes one mote loose, which is a cost the child can see and recover
   * from rather than a loss. Nothing here ends a run.
   */
  touch(bodyId: number): ArenaEvent[] {
    if (this.paused) return []
    const index = this.bodies.findIndex((b) => b.id === bodyId)
    if (index < 0) return []
    const body = this.bodies[index] as Body
    const at = { x: body.x, y: body.y }

    if (!body.prime) {
      if (this.graceMs > 0) return []
      this.graceMs = JOSTLE_GRACE_MS
      const lost = this.bank.spill()
      if (lost !== null) this.scatter([lost], body.x, body.y)
      // Shove both apart so the ship is not held inside the husk.
      const dx = this.ship.x - body.x
      const dy = this.ship.y - body.y
      const m = Math.hypot(dx, dy) || 1
      this.ship.vx += (dx / m) * 260
      this.ship.vy += (dy / m) * 260
      body.vx -= (dx / m) * 120
      body.vy -= (dy / m) * 120
      return [{ kind: "jostle", at, lost }]
    }

    // A mote thrown clear a moment ago is still leaving; the ship is deaf to
    // it until it has, or a vent and a refusal would both undo themselves.
    if (this.sweepGraceMs > 0) return []

    if (!this.bank.take(body.value)) {
      // A full hold is not a failure and must not become a stuck note: the
      // ship sits inside the mote for as long as it likes, so the refusal is
      // announced once and then goes quiet.
      if (this.graceMs > 0) return []
      this.graceMs = JOSTLE_GRACE_MS
      return [{ kind: "full", at }]
    }
    this.bodies.splice(index, 1)
    return [
      {
        kind: "sweep",
        at,
        value: body.value,
        tiles: this.bank.tiles.slice(),
        total: this.bank.value,
      },
    ]
  }

  /**
   * The ship flies into the resonator, asserting the product of its hold.
   *
   * This is the only value that crosses to the host, and it is exact: the
   * product of a set of integers the child chose. The game does not decide
   * whether it was right — it says what was asserted and the host judges. An
   * empty hold asserts nothing at all and is not a mistake.
   */
  enter(now: number): ArenaEvent[] {
    if (this.paused) return []
    const res = this.resonator
    if (!res || res.cooldown > 0) return []
    const at = { x: res.x, y: res.y }

    const verdict = resonate(res.target, this.bank.tiles)
    if (verdict.kind === "silent") return []

    // Once per question. A refusal spends the id — the resonator stays as a
    // goal the child can still open, but the host hears one answer, which is
    // the only honest reading of "what did they say when they were asked".
    if (!res.reported) {
      res.reported = true
      this.host.report({
        questionId: res.questionId,
        correct: verdict.kind === "open",
        ms: Math.max(0, Math.round(now - this.askedAt)),
        answered: String(verdict.asserted),
      })
    }

    if (verdict.kind === "refuse") {
      res.cooldown = REFUSE_COOLDOWN_MS
      this.chain = 0
      // The hold comes back onto the field rather than evaporating. The child
      // keeps every mote they worked for; what they spend is the trip.
      const back = this.bank.release()
      this.scatter(back, res.x, res.y)
      this.host.haptic("light")
      return [{ kind: "refuse", at, asserted: verdict.asserted, target: res.target }]
    }

    const tiles = this.bank.release()
    this.opened += 1
    this.chain += 1
    this.host.haptic("success")
    const events: ArenaEvent[] = [{ kind: "open", at, target: res.target, tiles }]
    // Only ever after something the child finished. Never after a refusal.
    this.host.transition?.("level", "resonance")
    events.push(...this.arm(now))
    return events
  }

  // ── the world ────────────────────────────────────────────────────────────

  /**
   * Advance the world by `dtMs`, resolving collisions into rule calls.
   *
   * Behind a sheet nothing moves and nothing is decided — the shell still
   * draws, because a frozen pack under a translucent host sheet is what a
   * paused game looks like, but this returns immediately.
   */
  step(dtMs: number): ArenaEvent[] {
    if (this.paused) return []
    const dt = Math.min(120, Math.max(0, dtMs)) / 1000
    if (dt === 0) return []
    const events: ArenaEvent[] = []

    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs)
    this.graceMs = Math.max(0, this.graceMs - dtMs)
    this.sweepGraceMs = Math.max(0, this.sweepGraceMs - dtMs)
    if (this.resonator) {
      this.resonator.cooldown = Math.max(0, this.resonator.cooldown - dtMs)
      this.resonator.age += dtMs
    }

    // The ship.
    this.ship.vx += this.move.x * SHIP_ACCEL * dt
    this.ship.vy += this.move.y * SHIP_ACCEL * dt
    const drag = Math.exp(-SHIP_DRAG * dt)
    this.ship.vx *= drag
    this.ship.vy *= drag
    const speed = Math.hypot(this.ship.vx, this.ship.vy)
    if (speed > SHIP_MAX) {
      this.ship.vx = (this.ship.vx / speed) * SHIP_MAX
      this.ship.vy = (this.ship.vy / speed) * SHIP_MAX
    }
    this.ship.x += this.ship.vx * dt
    this.ship.y += this.ship.vy * dt
    this.bounce(this.ship, SHIP_R, 0.4)

    // Bodies.
    for (const body of this.bodies) {
      body.age += dtMs
      body.x += body.vx * dt
      body.y += body.vy * dt
      this.bounce(body, body.prime ? MOTE_R : HUSK_R, 1)
      // Drifting husks slow to a readable pace rather than pinballing forever.
      const s = Math.hypot(body.vx, body.vy)
      if (s > DRIFT_MAX) {
        const k = Math.exp(-2.2 * dt)
        body.vx *= k
        body.vy *= k
      } else if (s < DRIFT_MIN && s > 1e-6) {
        body.vx *= 1 + 1.5 * dt
        body.vy *= 1 + 1.5 * dt
      }
    }

    if (this.resonator) {
      this.resonator.x += this.resonator.vx * dt
      this.resonator.y += this.resonator.vy * dt
      this.bounce(this.resonator, RESONATOR_R, 1)
    }

    // Shots, and what they hit.
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i] as Shot
      shot.life -= dtMs
      shot.x += shot.vx * dt
      shot.y += shot.vy * dt
      if (
        shot.life <= 0 ||
        shot.x < -40 ||
        shot.y < -40 ||
        shot.x > this.width + 40 ||
        shot.y > this.height + 40
      ) {
        this.shots.splice(i, 1)
        continue
      }
      const hit = this.bodies.find(
        (b) => dist2(shot, b) < (SHOT_R + (b.prime ? MOTE_R : HUSK_R)) ** 2,
      )
      if (!hit) continue
      this.shots.splice(i, 1)
      events.push(...this.strike(hit.id))
    }

    // The ship, and what it reaches. A copy of the id list, because `touch`
    // mutates `bodies` and a live iteration would skip its neighbour.
    for (const id of this.bodies.map((b) => b.id)) {
      const body = this.bodies.find((b) => b.id === id)
      if (!body) continue
      const reach = (SHIP_R + (body.prime ? MOTE_R : HUSK_R)) ** 2
      if (dist2(this.ship, body) < reach) events.push(...this.touch(id))
    }

    return events
  }

  /** Milliseconds the child has had with the current resonator. */
  elapsed(now: number): number {
    return Math.max(0, now - this.askedAt)
  }

  // ── seeding ──────────────────────────────────────────────────────────────

  /**
   * Draw a question, hang a resonator on it, and stock the field with husks
   * that come apart into exactly the primes its answer needs — plus the primes
   * behind one of the host's mal-rule answers, so a child who drops a carry can
   * assemble their own mistake and the misconception routes back to the host.
   */
  private arm(now: number): ArenaEvent[] {
    this.askedAt = now
    let question: Question | null = null
    for (let i = 0; i < DRAW_ATTEMPTS; i++) {
      const drawn = this.host.next({ domain: "add" })
      const target = Number(drawn.answer)
      if (isAskable(target, MAX_TARGET)) {
        question = drawn
        break
      }
    }
    if (!question) {
      // Nothing the resonator could honestly ask for. The arena stays playable
      // — husks still crack, primes still sweep — and this is loud.
      this.stalled = true
      console.error("[lattice] no askable target in", DRAW_ATTEMPTS, "draws")
      return [{ kind: "stalled" }]
    }
    this.stalled = false

    const target = Number(question.answer)
    const wanted = primeFactors(target)
    const values = huskify(wanted, this.rng)

    // One reachable mal-rule: the primes it needs that the answer does not
    // already supply. Kept small, or the field becomes a haystack.
    const decoy = this.pickDecoy(question, wanted)
    if (decoy.length > 0) values.push(...huskify(decoy, this.rng))

    // A little chaff, so "sweep only what you need" is a decision rather than
    // a formality. Never more than three, and always small enough to read.
    const chaff = this.rng.int(1, 3)
    for (let i = 0; i < chaff; i++) values.push(this.rng.pick(MOTE_PRIMES.slice(0, 6)))

    this.bodies = []
    this.shots = []
    this.rng.shuffle(values)
    for (const value of values) {
      const edge = 70
      const x = this.rng.range(edge, this.width - edge)
      const y = this.rng.range(edge, this.height * 0.62)
      this.spawnAt(
        value,
        x,
        y,
        this.rng.range(-DRIFT_MAX, DRIFT_MAX),
        this.rng.range(-DRIFT_MAX, DRIFT_MAX),
      )
    }

    this.resonator = {
      questionId: question.id,
      prompt: question.prompt,
      target,
      x: this.width / 2,
      y: this.height * 0.26,
      vx: this.rng.range(-26, 26),
      vy: this.rng.range(-14, 14),
      cooldown: 0,
      reported: false,
      age: 0,
    }

    return [
      {
        kind: "arrive",
        at: { x: this.resonator.x, y: this.resonator.y },
        target,
        prompt: question.prompt,
      },
    ]
  }

  /**
   * The extra primes one of the host's mal-rule answers needs.
   *
   * `[]` when none of them is reachable without turning the field into a
   * haystack — which is a fine outcome: the child then simply cannot assemble
   * anything but the answer and whatever the chaff allows.
   */
  private pickDecoy(question: Question, wanted: readonly number[]): number[] {
    for (const raw of question.distractors) {
      const value = Number(raw)
      if (!isAskable(value, MAX_TARGET)) continue
      const extra = multisetDifference(primeFactors(value), wanted)
      if (extra.length === 0 || extra.length > 3) continue
      if (extra.some((p) => p > 47)) continue
      return extra
    }
    return []
  }

  /**
   * Throw a handful of motes clear of a point, and go deaf to sweeping while
   * they get there. Every path that hands primes back to the field uses this.
   */
  private scatter(values: readonly number[], x: number, y: number): void {
    this.sweepGraceMs = RELEASE_GRACE_MS
    const turn = this.rng.range(0, Math.PI * 2)
    for (let i = 0; i < values.length; i++) {
      const angle = turn + (i / Math.max(1, values.length)) * Math.PI * 2
      const px = Math.min(
        Math.max(MOTE_R, x + Math.cos(angle) * RELEASE_RADIUS),
        this.width - MOTE_R,
      )
      const py = Math.min(
        Math.max(MOTE_R, y + Math.sin(angle) * RELEASE_RADIUS),
        this.height - MOTE_R,
      )
      const speed = this.rng.range(DRIFT_MIN, DRIFT_MAX)
      this.spawnAt(values[i] as number, px, py, Math.cos(angle) * speed, Math.sin(angle) * speed)
    }
  }

  private spawnAt(value: number, x: number, y: number, vx: number, vy: number): void {
    this.bodies.push({
      id: this.nextId++,
      value,
      prime: isPrime(value),
      x,
      y,
      vx,
      vy,
      age: 0,
    })
  }

  private bounce(p: { x: number; y: number; vx: number; vy: number }, r: number, k: number): void {
    if (p.x < r) {
      p.x = r
      p.vx = Math.abs(p.vx) * k
    } else if (p.x > this.width - r) {
      p.x = this.width - r
      p.vx = -Math.abs(p.vx) * k
    }
    if (p.y < r) {
      p.y = r
      p.vy = Math.abs(p.vy) * k
    } else if (p.y > this.height - r) {
      p.y = this.height - r
      p.vy = -Math.abs(p.vy) * k
    }
  }
}

function dist2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}
