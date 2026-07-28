// SKY LEDGER — the rules, with no canvas anywhere near them.
//
// The observatory stands on the horizon with seven lamps burning. Above it the
// sky is ruled into a ten-by-ten lattice: ONES across, TENS up, so the lattice
// point (x, y) is the number 10y + x and the whole sky is a hundred-square
// stood upright.
//
// Stars fall. Each carries a ledger line the host drew — `247 + 225` — and each
// belongs at a station: the ordered pair of its answer's tens and ones. The
// star is **not drawn at its station** and never approaches it. Where a star is
// on the screen says nothing at all about what it is.
//
// Three verbs:
//
//   * **SIGHT** a star. Chooses which ledger line you are working. Reveals
//     nothing whatever — not its station, not its order, not a hint.
//   * **TURN** a ring of the astrolabe, one detent at a time. Two rings: ones
//     and tens. This is the only way an ordered pair comes into existence in
//     this game, and it produces one, digit by digit, out of the child's head.
//   * **MARK.** The assertion. The observatory writes down
//     `order × 100 + tens × 10 + ones` for the sighted star and the host judges
//     it. Right: the star snaps across the sky to its true station and blooms
//     there — and every other falling star worth the same number goes with it.
//     Wrong: the sight goes wide and the chain is cut.
//
// **Why marking costs a sighting.** Without a cost, a hundred stations is a
// hundred marks and a determined child could brute-force one — which would put
// a hundred wrong answers on their record for a question they never worked.
// The cost is what makes the report honest. Being *right* costs nothing at all,
// and a wrong mark that lands on a mal-rule the host named costs nothing
// either: the register recognises the mistake and lets you re-measure. Only a
// wild guess spends anything, and sightings refill on a clock, so a child who
// spends them all waits a few seconds rather than losing anything.
//
// **There is no win state.** A star that reaches the horizon snuffs a lamp.
// When the last lamp is out the run ends and the observatory writes the watch
// down. Snuffed lamps are relit one per watch survived, so a bad watch is a
// setback and never a wall. Nothing about a landed star is reported — the child
// never asserted anything about it, and a silence is not a wrong answer.

import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Escalation, type Channels, type Release } from "./escalation.ts"
import {
  RINGS,
  answerOf,
  isUsable,
  namedSlips,
  orderOf,
  stationOf,
  turn,
  valueAt,
  type Station,
} from "./station.ts"

/** Lamps on the horizon. Missile Command had six cities; the observatory has seven. */
export const LAMPS = 7

/** Sightings the astrolabe holds, and how often one comes back. */
export const SIGHTINGS = 6
export const REFILL_MS = 1700

/** How many draws we will make to find one ledger line this sky can hold. */
const DRAW_ATTEMPTS = 8

/** Stars in the first watch, and how many more each watch adds. */
const WATCH_BASE = 4
const WATCH_STEP = 1
const WATCH_MAX = 10

/** Seconds of fall in the first watch, and the floor the descent tightens to. */
const FALL_BASE_MS = 21000
const FALL_STEP_MS = 1400
const FALL_FLOOR_MS = 9000

/** Stars are released into the watch this far apart. */
const RELEASE_GAP_MS = 2600

export type Star = {
  readonly id: number
  readonly item: Question
  /** The hundreds-and-above part, already ruled into the register. */
  readonly order: number
  /** Screen-space lane, 0..1 across the sky. Decorative. Says nothing. */
  readonly lane: number
  /** Which lamp it falls toward. */
  readonly lamp: number
  /** How long this star takes to reach the horizon. */
  readonly fallMs: number
  /**
   * When the watch lets this star go, in **world** milliseconds since the watch
   * opened — not wall clock.
   *
   * The two are not the same and the difference is a real bug: a frame delta is
   * clamped (a backgrounded tab hands back minutes) and the chain slows the
   * world down on purpose, so a wall-clock release would put four stars into a
   * sky that had barely moved.
   */
  releaseIn: number
  /** 0 at the top, 1 at the horizon. */
  t: number
  /** Wall-clock mark: when the child first took this ledger line on. */
  askedAt: number
  /** Set once the child has sighted it, so latency is thinking time. */
  taken: boolean
  state: "falling" | "caught" | "landed"
}

export type GameEvent =
  | { kind: "sight"; star: Star }
  | { kind: "turn"; ring: "ones" | "tens"; station: Station }
  | { kind: "refused"; reason: "dry" | "nothing-sighted" }
  | { kind: "bloom"; star: Star; station: Station; channels: Channels; link: number }
  | { kind: "wide"; star: Star; station: Station; value: number; recognised: boolean }
  | { kind: "release"; release: Release }
  | { kind: "land"; star: Star; lamp: number }
  | { kind: "watch"; watch: number; logged: number; relit: boolean }
  | { kind: "over"; ledger: Ledger }
  | { kind: "stalled" }

export type Ledger = {
  /** Stars logged this run. */
  logged: number
  /** Watches survived. */
  watches: number
  /** The longest chain of the run. */
  longest: number
  /** Marks that went wide. Recorded, never scolded. */
  wide: number
}

export class Game {
  private readonly host: Host
  private readonly rng: Rng
  private readonly chain: Escalation
  private nextId = 1

  private sky: Star[] = []
  private sightedId = -1
  private ring: Station = { x: 0, y: 0 }

  private lampsLit = LAMPS
  /** World time since this watch opened. Advances only when the sky does. */
  private world = 0
  private watchNo = 0
  private loggedThisWatch = 0
  private clock = 0

  private sightingsLeft = SIGHTINGS
  private refillAt = 0

  private paused = false
  private pausedAt = 0
  private over = false
  private stalledFlag = false

  readonly ledger: Ledger = { logged: 0, watches: 0, longest: 0, wide: 0 }

  constructor(host: Host, rng: Rng, now: number, reduced: boolean) {
    this.host = host
    this.rng = rng
    this.chain = new Escalation(reduced)
    this.clock = now
    this.refillAt = now + REFILL_MS
  }

  /** Open the first watch. Separate from the constructor so events can be seen. */
  begin(now: number): GameEvent[] {
    this.clock = now
    return this.openWatch(now)
  }

  // ── the read model ────────────────────────────────────────────────────────
  //
  // Everything the renderer is allowed to know. `station` is deliberately not
  // in it: a star's station is not a fact about the sky, it is the answer, and
  // a render layer that could read it is one refactor away from drawing it.

  get stars(): readonly Star[] {
    return this.sky
  }

  get sighted(): Star | null {
    return this.sky.find((s) => s.id === this.sightedId && s.state === "falling") ?? null
  }

  get station(): Station {
    return this.ring
  }

  /** What the observatory would write down if MARK were pressed now. */
  get reading(): number | null {
    const star = this.sighted
    return star ? valueAt(star.order, this.ring) : null
  }

  get lamps(): number {
    return this.lampsLit
  }

  get watch(): number {
    return this.watchNo
  }

  get sightings(): number {
    return this.sightingsLeft
  }

  get links(): number {
    return this.chain.links
  }

  /** 0..1, the chain's remaining window. Drives the astrolabe's draining rim. */
  fuse(now: number): number {
    return this.chain.fuse(now)
  }

  get channels(): Channels {
    return this.chain.channels
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isOver(): boolean {
    return this.over
  }

  get stalled(): boolean {
    return this.stalledFlag
  }

  // ── the verbs ─────────────────────────────────────────────────────────────

  /**
   * Take a ledger line on.
   *
   * Free, reversible, reveals nothing and reports nothing — exploring which
   * star to work must cost a child exactly nothing. The rings are **not** reset
   * by sighting: a child who has already dialled 4 and 7 and then changes their
   * mind about which star those digits belong to keeps their work.
   */
  sight(id: number): GameEvent[] {
    if (!this.active()) return []
    const star = this.sky.find((s) => s.id === id && s.state === "falling" && s.t > 0)
    if (!star || star.id === this.sightedId) return []
    this.sightedId = id
    if (!star.taken) {
      star.taken = true
      star.askedAt = this.clock
    }
    return [{ kind: "sight", star }]
  }

  /**
   * Turn one ring of the astrolabe by one detent.
   *
   * The only route to an ordered pair in this game. Relative, wrapping, and one
   * step per call — there is no way to hand this method a number or a point on
   * the screen. See `src/test/produce.test.ts`.
   */
  dial(ring: "ones" | "tens", dir: number): GameEvent[] {
    if (!this.active()) return []
    this.ring = turn(this.ring, ring, dir)
    return [{ kind: "turn", ring, station: this.ring }]
  }

  /**
   * MARK — the assertion, and the only thing ever reported.
   *
   * Everything about the ordered pair came out of the child's head by way of
   * two rings. The observatory writes it down against the sighted star and the
   * host judges it; this method never compares it to anything.
   */
  mark(now: number): GameEvent[] {
    if (!this.active()) return []
    const star = this.sighted
    if (!star) return [{ kind: "refused", reason: "nothing-sighted" }]

    const value = valueAt(star.order, this.ring)
    const truth = answerOf(star.item)
    const right = truth !== null && value === truth
    const ms = Math.max(0, now - star.askedAt)

    // A mal-rule the host named is a mistake with a procedure behind it. It is
    // still wrong and still reported as wrong; it just does not cost the child
    // their next measurement.
    const recognised = !right && namedSlips(star.item.distractors).has(value)

    if (!right && !recognised) {
      if (this.sightingsLeft <= 0) return [{ kind: "refused", reason: "dry" }]
      this.sightingsLeft -= 1
    }

    this.host.report({ questionId: star.item.id, correct: right, ms, answered: String(value) })

    if (!right) {
      this.ledger.wide += 1
      const events: GameEvent[] = [
        { kind: "wide", star, station: this.ring, value, recognised },
      ]
      // The chain is cut *now*, not at its deadline. A wrong mark is the child
      // saying something untrue about the sky, and the light goes out on it.
      const release = this.chain.cut()
      if (release) events.push({ kind: "release", release })
      return events
    }

    return this.bloom(star, value, now)
  }

  /**
   * Advance the watch.
   *
   * `dt` is already scaled by the escalation's timescale and already zeroed for
   * hitstop by the caller — this method is given the time the *world* moved,
   * not the time the wall clock moved, so a chain at cap really does slow the
   * descent while the blooms play.
   */
  tick(dt: number, now: number): GameEvent[] {
    if (this.paused || this.over || this.stalledFlag) return []
    this.clock = now
    this.world += Math.max(0, dt)
    const events: GameEvent[] = []

    const expired = this.chain.expire(now)
    if (expired) events.push({ kind: "release", release: expired })

    if (this.sightingsLeft < SIGHTINGS && now >= this.refillAt) {
      this.sightingsLeft += 1
      this.refillAt = now + REFILL_MS
    } else if (this.sightingsLeft >= SIGHTINGS) {
      this.refillAt = now + REFILL_MS
    }

    for (const star of this.sky) {
      if (star.state !== "falling") continue
      if (this.world < star.releaseIn) continue
      star.t += dt / star.fallMs
      if (star.t < 1) continue
      star.t = 1
      star.state = "landed"
      if (star.id === this.sightedId) this.sightedId = -1
      this.lampsLit = Math.max(0, this.lampsLit - 1)
      events.push({ kind: "land", star, lamp: star.lamp })
    }

    if (this.lampsLit === 0) {
      // The run is over. Not a failure screen — a page in a register.
      this.over = true
      const cut = this.chain.cut()
      if (cut) events.push({ kind: "release", release: cut })
      events.push({ kind: "over", ledger: { ...this.ledger } })
      return events
    }

    if (this.sky.every((s) => s.state !== "falling")) {
      events.push(...this.closeWatch(now))
      return events
    }

    // Nothing under the sight — because a bloom took it, or the sky was still
    // empty when the last one went. Put the most urgent star under it. The
    // child never has to choose a target before they can begin working one.
    if (this.sighted === null) {
      const next = this.lowestFalling()
      if (next) {
        this.sightedId = next.id
        if (!next.taken) {
          next.taken = true
          next.askedAt = now
        }
        events.push({ kind: "sight", star: next })
      }
    }
    return events
  }

  /** The host put a sheet over us. Stop the clock; stop taking input. */
  pause(now: number): void {
    if (this.paused) return
    this.paused = true
    this.pausedAt = now
  }

  /**
   * The sheet came off. Shift every wall-clock mark forward by the span the
   * child was not here for: the ledger lines' latency marks, the chain's
   * deadline, the refill timer and each star's release. A thirty-second sheet
   * must not tell the host a child laboured over a question they had for two
   * seconds, and it must not eat a chain they were in the middle of.
   */
  resume(now: number): void {
    if (!this.paused) return
    this.paused = false
    const by = Math.max(0, now - this.pausedAt)
    this.clock = now
    // A star's release is on the world clock, which did not run behind the
    // sheet, so only the ledger lines' thinking-time marks move.
    for (const star of this.sky) star.askedAt += by
    this.chain.shift(by)
    this.refillAt += by
  }

  /** Start the next run after the ledger page. */
  restart(now: number): GameEvent[] {
    if (!this.over) return []
    this.over = false
    this.lampsLit = LAMPS
    this.watchNo = 0
    this.ledger.logged = 0
    this.ledger.watches = 0
    this.ledger.longest = 0
    this.ledger.wide = 0
    this.sightingsLeft = SIGHTINGS
    this.refillAt = now + REFILL_MS
    return this.openWatch(now)
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private active(): boolean {
    return !this.paused && !this.over && !this.stalledFlag
  }

  /**
   * A correct mark.
   *
   * The sighted star snaps to its station and blooms — and so does every other
   * falling star worth the same number, because the child's assertion was true
   * about all of them. That is the Missile Command multi-kill, and it is exact:
   * a star is only taken when its own canonical answer equals the value that
   * was asserted, and each one is reported on its own.
   */
  private bloom(sighted: Star, value: number, now: number): GameEvent[] {
    const events: GameEvent[] = []
    const taken = this.sky.filter(
      (s) => s.state === "falling" && s.t > 0 && answerOf(s.item) === value,
    )
    // The sighted star first, so the first link is the one the child worked.
    taken.sort((a, b) => (a.id === sighted.id ? -1 : b.id === sighted.id ? 1 : a.id - b.id))

    for (const star of taken) {
      if (star.id !== sighted.id) {
        // A star the child never sighted but did, in fact, name. Reported on
        // its own terms — with the time it had actually been in the sky, which
        // is honest, and never zero.
        this.host.report({
          questionId: star.item.id,
          correct: true,
          ms: Math.max(0, now - star.askedAt),
          answered: String(value),
        })
      }
      star.state = "caught"
      this.ledger.logged += 1
      this.loggedThisWatch += 1
      const channels = this.chain.link(now)
      this.ledger.longest = Math.max(this.ledger.longest, this.chain.links)
      events.push({
        kind: "bloom",
        star,
        station: stationOf(value),
        channels,
        link: this.chain.links,
      })
    }

    this.sightedId = -1
    // The next star the child is likeliest to want, already under the sight.
    const next = this.lowestFalling()
    if (next) {
      this.sightedId = next.id
      if (!next.taken) {
        next.taken = true
        next.askedAt = now
      }
      events.push({ kind: "sight", star: next })
    }
    return events
  }

  private lowestFalling(): Star | null {
    let best: Star | null = null
    for (const star of this.sky) {
      if (star.state !== "falling" || star.t <= 0) continue
      if (!best || star.t > best.t) best = star
    }
    return best
  }

  /**
   * Wrap the watch up and open the next one.
   *
   * A watch the child logged stars in is a stopping point they *reached*, so it
   * is where `transition` goes. A watch that ended with nothing logged is not a
   * failure in this game — there is no failure state — but it is not an
   * achievement either, and the host must not be invited to put a sheet on it.
   */
  private closeWatch(now: number): GameEvent[] {
    const logged = this.loggedThisWatch
    const relit = logged > 0 && this.lampsLit < LAMPS
    if (relit) this.lampsLit += 1
    this.ledger.watches += 1
    const events: GameEvent[] = [{ kind: "watch", watch: this.watchNo, logged, relit }]
    if (logged > 0) this.host.transition?.("level", `watch ${this.watchNo}`)
    events.push(...this.openWatch(now))
    return events
  }

  /** Release the next watch of stars. */
  private openWatch(now: number): GameEvent[] {
    this.watchNo += 1
    this.loggedThisWatch = 0
    this.world = 0
    this.sky = []
    this.sightedId = -1

    const count = Math.min(WATCH_MAX, WATCH_BASE + (this.watchNo - 1) * WATCH_STEP)
    const fallMs = Math.max(FALL_FLOOR_MS, FALL_BASE_MS - (this.watchNo - 1) * FALL_STEP_MS)

    for (let i = 0; i < count; i++) {
      const item = this.drawOne()
      if (!item) break
      const value = answerOf(item)
      if (value === null) break
      this.sky.push({
        id: this.nextId++,
        item,
        order: orderOf(value),
        // The lane is drawn from the rng, never from the answer. A star's place
        // in the sky must not be a function of what it is worth — that is the
        // one leak that would turn this back into a pointing game.
        lane: this.rng.range(0.08, 0.92),
        lamp: this.rng.int(0, LAMPS - 1),
        fallMs,
        releaseIn: i * RELEASE_GAP_MS,
        t: 0,
        askedAt: now,
        taken: false,
        state: "falling",
      })
    }

    if (this.sky.length === 0) {
      this.stalledFlag = true
      console.error("[skyledger] the host served nothing this sky can hold a station for")
      return [{ kind: "stalled" }]
    }

    const first = this.sky[0]
    if (first) {
      this.sightedId = first.id
      first.taken = true
      first.askedAt = now
    }
    return first ? [{ kind: "sight", star: first }] : []
  }

  /**
   * One ledger line this sky can hold: an exact whole-number answer of at most
   * four digits. A decimal has no station; rounding one would report a value
   * the child never asserted, so it is dropped rather than bent.
   */
  private drawOne(): Question | null {
    for (let i = 0; i < DRAW_ATTEMPTS; i++) {
      const item = this.host.next()
      if (isUsable(item)) return item
    }
    console.warn("[skyledger] the host served nothing stationable in eight draws")
    return null
  }
}

export { RINGS }
