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
  LARGEST_MOTE_PRIME,
  MOTE_PRIMES,
  huskify,
  isPrime,
  multisetDifference,
  primeFactors,
  splitPair,
} from "./factor.ts"
import {
  freeStages,
  type HintState,
  itemOf,
  revealsAnswer,
  scheduledStage,
  shownAt,
  stageCount,
} from "./hint.ts"
import { CEILING, FLOOR, Ladder, rungOf } from "./ladder.ts"
import { markField, remainingOf, type Mark } from "./live.ts"
import { gather, openingAt, type Opening } from "./opening.ts"
import { factorTree, placeTree, type Placed } from "./tree.ts"
import {
  isAskable,
  isResonant,
  isSmooth,
  MIN_TARGET,
  MIN_WALL,
  resonate,
  tileCount,
} from "./resonance.ts"

/** The largest value a resonator will ask for. See `resonance.isAskable`. */
export const MAX_TARGET = 999

/**
 * How often a prime target — the wall — comes round.
 *
 * One resonator in five. The wall is the property the whole game stands on and
 * it must not be deleted, but a prime has no factor tree, so an unrationed
 * stream of them is a fifth of the session spent hunting one mote. See
 * `resonance.MIN_WALL`.
 */
const WALL_EVERY = 5

/**
 * How long the arena waits before trying to arm again after finding nothing.
 *
 * The old code had no retry at all: one barren draw set `stalled` and the arena
 * never asked again for the rest of the session, leaving the *previous*
 * resonator hanging with its id already spent — so a child could keep flying
 * into a ring that reported nothing, forever, and the only sign was one line on
 * a console nobody was reading.
 */
const REARM_MS = 2500

/** Radii in arena units. The arena is nominally about 1000 units wide. */
export const SHIP_R = 15
export const MOTE_R = 17
export const HUSK_R = 24
export const RESONATOR_R = 46
export const SHOT_R = 5

/**
 * The arena's own size, as a diagonal, at which one unit of "span per second"
 * is one arena unit per second.
 *
 * **This is the Android bug, and it is not tuning.** `render/scene.ts` says it
 * plainly: "the arena's coordinate space *is* CSS pixel space — `mount.ts`
 * resizes the arena to the element". There is no camera and no transform, so the
 * world is exactly as big as the viewport — and every speed in this file used to
 * be an absolute number of CSS pixels per second, chosen against a tablet. The
 * comment above even says so: "the arena is nominally about 1000 units wide".
 *
 * A phone is not. An Android phone in portrait is about 390×740 CSS pixels, a
 * diagonal of 836 against a tablet's 1437 — and the ship's measured top speed was
 * 597px/s on both, which is 0.71 of the phone's whole world a second against 0.42
 * of the tablet's. **The same ship covered 1.72× more screen per second on the
 * phone.** It was not misbehaving on Android; it was moving at tablet speed through
 * a world 58% the size. Nothing about that is fixable by lowering a constant,
 * because lowering it would then make the tablet sluggish.
 *
 * So the ship's dynamics are now stated as a fraction of the arena's own
 * diagonal per second, and the felt speed is the same on every screen. The
 * reference is the diagonal of a 1180×820 tablet, which is what the numbers were
 * tuned against, so a tablet keeps the size of number it had.
 */
const REFERENCE_SPAN = Math.hypot(1180, 820)

/**
 * The ship, in arena diagonals per second and per second squared.
 *
 * `SHIP_SPAN_PER_SEC` is the top speed and `SHIP_DRAG` is how hard it is held
 * to it. There is no acceleration constant: `step` solves `v' = k(V − v)` in
 * closed form, so the speed the stick asks for *is* the steady state and the
 * clamp only ever catches the kick from a jostle. Two numbers instead of three,
 * and no way for them to disagree.
 *
 * **What changed and why.** It was `SHIP_ACCEL 2600`, `SHIP_DRAG 4.2`,
 * `SHIP_MAX 620`, which measured as a 143px coast after the thumb comes off —
 * four and a half times the 32px reach the ship sweeps a mote at. A child could
 * not stop on a mote; they could only pass over one and come back. That is what
 * "moves around too wildly" is, mechanically. The drag is now 7.4, a time constant
 * of 135ms, and the measured coast is 58px on a tablet and 34px on a phone —
 * inside two sweeps of the thing you were aiming at, on both.
 */
const SHIP_SPAN_PER_SEC = 0.3
const SHIP_DRAG = 7.4

/** Everything else that is a speed or a length, on the same scale. */
const SHOT_SPAN_PER_SEC = 0.78
const DRIFT_MIN_SPAN = 0.021
const DRIFT_MAX_SPAN = 0.077
/** The shove a jostle gives the ship, and the one it gives the husk. */
const JOSTLE_SPAN = 0.18
const JOSTLE_HUSK_SPAN = 0.083
/** The shove a shot gives a prime, which is the reward for noticing it cannot split. */
const WALL_SHOVE_SPAN = 0.063

const SHOT_LIFE_MS = 1400
const FIRE_COOLDOWN_MS = 110

/**
 * The step the world is simulated at, however fast the frame arrives.
 *
 * A sibling pack (`games/balance`) had a spring integrator that was stable above
 * 31fps and reached −1.2×10²⁰⁴ at 20fps, and the fix was substepping rather than
 * clamping. This game's sheet (`sim/grid.ts`) was already substepped at 240Hz for
 * that reason. The arena was not, and it had the same *class* of defect in a
 * quieter form:
 *
 *   * **Shots tunnelled.** A shot travels 0.78 diagonals a second, which on a
 *     tablet is 1120 units — 56 units in one 50ms frame, against a hit window of
 *     `SHOT_R + HUSK_R` = 29 units either side, which is a 58px window against a
 *     56px step. At 60fps a shot cannot miss a husk it is aimed at; at 20fps,
 *     measured over sixty runs at three viewports, nine of every eighty stepped
 *     straight over it. "My shots don't hit" on a slow Android is not the aim.
 *   * **And the ship's own speed drifted with the frame rate**: 610px/s at 144fps
 *     against 556px/s at 20fps — a spread of 9.7% — and a coast of 143px against
 *     119px, because `v += a·dt` then `v *= e^(−k·dt)` is only exact in the limit.
 *     That half is fixed by solving the ship rather than stepping it; see `step`.
 *
 * Sixteen and two thirds of a millisecond, capped at eight substeps so a frame
 * that arrives after a minute is not a hundred and twenty of them.
 */
const SUBSTEP_MS = 1000 / 60
const MAX_SUBSTEPS = 8

/**
 * How fast the drawn nose turns toward where the guns are pointed, per second.
 *
 * The guns are instant — a shooter whose bullets lag the stick is a shooter that
 * lies — but the *hull* used to snap to the aim vector on the frame it changed,
 * which is a large part of what reads as wild. Eighteen per second is a 55ms
 * time constant: fast enough that the nose is never pointing anywhere the shots
 * are not, slow enough that a thumb sliding round the right stick turns the ship
 * instead of flicking it.
 */
const FACING_TURN_PER_SEC = 18

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
  /**
   * The rung that *served* this question, 0..1 — never the rung that was asked
   * for. See the note in `arm`: the two differ often and by a lot, and this is
   * the one the hint's quiet is computed from.
   */
  readonly difficulty: number
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
  /**
   * The hint unfolded by one stage — because the child asked, or because the
   * quiet ran out. `at` is the resonator, because that is where the help is
   * coming *from*: the ring is explaining itself. Never a banner and never a
   * word; the shell draws this as light and a warm note.
   */
  | { kind: "hint"; at: Vec; stage: number; stages: number }
  | { kind: "stalled" }

export type ArenaOptions = {
  width: number
  height: number
  domain?: string
  /**
   * How many resonators this child has opened **before this sitting**.
   *
   * REQUIRED, and deliberately not defaulted. The whole of `game/opening.ts`
   * hangs off it, and a default would mean a shell that never wired it still
   * compiled and quietly shipped either the chaotic opening the founder
   * reported or the calm one to a child who has played for a month — with
   * nothing failing anywhere and no way to notice from inside the canvas.
   * `render/scene.ts` makes the same argument about its `hint` argument.
   */
  experience: number
}

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

  /** Where the game is standing on the host's ladder. See `ladder.ts`. */
  readonly ladder = new Ladder()

  private width: number
  private height: number
  private nextId = 1
  private aim: Vec = { x: 1, y: 0 }
  /**
   * The drawn nose, as an angle, easing toward `aim`. The guns never wait for it.
   *
   * An angle rather than a vector, and that is not a style choice: easing a
   * *vector* toward its own negation walks it into the origin and back out
   * pointing the way it came, so a ship told to turn round would freeze facing
   * forward. A thumb sweeping across the right stick passes through exactly that
   * every time it crosses the far side.
   */
  private faceAngle = 0
  private move: Vec = { x: 0, y: 0 }
  private cooldownMs = 0
  private graceMs = 0
  private sweepGraceMs = 0
  private paused = false
  private pausedAt = 0
  /** Wall-clock mark the current resonator was armed at, shifted over a pause. */
  private askedAt = 0
  /** Resonators armed since the last wall, so a prime target is rationed. */
  private sinceWall = 0
  /** Counts down after a barren arming, then the arena tries again. */
  private rearmMs = 0
  /**
   * The current resonator's factor tree, and how far it has been unfolded.
   *
   * The tree is built once, when the resonator is armed, off a *fork* of the
   * arena's generator — so it is deterministic for a given target and seed and
   * it does not disturb the stream the husks and the drift come out of. What
   * moves is only how much of it carries a numeral. See `game/hint.ts`.
   */
  private hintTree: Placed | null = null
  /** How many times the child has asked. Never shown to anybody, ever. */
  private hintTaps = 0
  /** The last stage the shell was told about, so `unfold` fires once per step. */
  private hintSeen = 0
  /** What `firstHintMs` is allowed to read: the item, and nothing else. */
  private hintItem = { difficulty: 0, tiles: 0 }
  /**
   * How much of this question the child has actually **played**, in ms.
   *
   * Not the wall clock, and that is the whole point. `step` adds to this and
   * `step` returns early behind a host sheet or the how-to-play panel, so those
   * cost nothing — but it also covers the case a pack is never told about at
   * all: a backgrounded webview hands back a delta of minutes, `step` clamps it
   * to 120ms like every other physical quantity, and three minutes in the app
   * switcher advances this by about a frame instead of by three whole stages of
   * tree the child was not in the room for.
   *
   * Wall-clock time with a pause guard bolted on covered the first case and not
   * the second, and the second is the one that happens on a phone.
   */
  private hintAgeMs = 0
  /** The last stage the clock may reach on its own. See `hint.freeStages`. */
  private hintFree = 0
  /** The last `HintState` handed out, so a redraw is not a fresh allocation. */
  private hintCache: { stage: number; state: HintState } | null = null
  /** The domain label the resonator's questions are drawn under. */
  private readonly domain: string
  /** Resonators opened before this sitting. See `ArenaOptions.experience`. */
  private readonly experience: number
  /**
   * The drift band this field was seeded with, as a fraction of the ordinary
   * one. Latched at `arm` rather than read per frame, so the field keeps its
   * character for the whole of the question it was stocked for.
   *
   * It is applied to the band in `step` as well as to the velocities at spawn,
   * and that second half is the one that is easy to miss: `step` *accelerates*
   * anything drifting below `DRIFT_MIN_SPAN`, so a husk seeded at three tenths
   * of the pace would have been wound back up to full speed inside a second and
   * the calm opening would have been calm for exactly one frame.
   */
  private driftScale = 1
  /**
   * Does the field, as seeded, hand the answer over?
   *
   * True at the very start of a child's first sitting, where the whole
   * factorisation is gathered into one husk and the numeral on that stone IS
   * the target. That is the point of the first screen — it teaches the
   * mechanic, not the arithmetic — and it is treated exactly as `hint.ts`
   * treats a tree that stated the answer: the host still hears the outcome, so
   * the progress bar still moves, and the arena does not climb its own ladder.
   */
  private givenByField = false

  private readonly host: Host
  private readonly rng: Rng

  constructor(host: Host, rng: Rng, options: ArenaOptions) {
    this.host = host
    this.rng = rng
    this.domain = options.domain ?? "add"
    this.experience = Number.isFinite(options.experience)
      ? Math.max(0, Math.floor(options.experience))
      : 0
    this.width = Math.max(320, Number.isFinite(options.width) ? options.width : 320)
    this.height = Math.max(320, Number.isFinite(options.height) ? options.height : 320)
    this.ship.x = this.width / 2
    this.ship.y = this.height * 0.72
  }

  /**
   * The arena's own diagonal, which every speed in this file is a fraction of.
   *
   * See `REFERENCE_SPAN`: the world is exactly as big as the viewport, so a
   * speed that is not measured against it is a different speed on every device.
   */
  private get span(): number {
    return Math.hypot(this.width, this.height) / REFERENCE_SPAN
  }

  /** Top speed, in arena units per second, on this screen. */
  get shipMax(): number {
    return SHIP_SPAN_PER_SEC * REFERENCE_SPAN * this.span
  }

  /** How far the ship carries after the thumb comes off, in arena units. */
  get shipCoast(): number {
    return this.shipMax / SHIP_DRAG
  }

  // ── the opening ──────────────────────────────────────────────────────────

  /**
   * Where this child stands on the calm ramp: everything they have ever opened,
   * plus everything they have opened this sitting.
   */
  get openingStep(): number {
    return this.experience + this.opened
  }

  /** The opening this field was stocked under. See `game/opening.ts`. */
  get opening(): Opening {
    return openingAt(this.openingStep)
  }

  /**
   * What is left of the target once the hold is taken out. `null` when there is
   * no question, or when the hold has already gone past what the ring wants.
   */
  get remaining(): number | null {
    const res = this.resonator
    if (!res) return null
    return remainingOf(res.target, this.bank.tiles)
  }

  /**
   * Which numbers on the field divide what is left, for the renderer.
   *
   * `null` — not an empty map — once the child is past the guided opening, so
   * there is exactly one place the guidance is switched off and the renderer
   * cannot draw a stale marking by forgetting to ask.
   */
  liveMarks(): Map<number, Mark> | null {
    const res = this.resonator
    if (!res || !this.opening.guided) return null
    return markField(res.target, this.bank.tiles, this.bodies)
  }

  // ── the frame ────────────────────────────────────────────────────────────

  begin(now: number): ArenaEvent[] {
    return this.arm(now)
  }

  resize(width: number, height: number): void {
    // A non-finite box would make every speed in the arena `NaN` on the next
    // frame and every collision test false for the rest of the session. A
    // `ResizeObserver` on a detached element is the shape that produces one.
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      console.error("[lattice] resize to a box that is not a box", width, height)
      return
    }
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

  /**
   * The left stick. Magnitude 0..1; anything longer is normalised.
   *
   * A non-finite component is refused loudly rather than stored. This is the one
   * input on the ship that had no guard, and it is not hypothetical bookkeeping:
   * `move` is multiplied into the ship's velocity every substep, so a single
   * `NaN` reaching here puts the ship's position beyond recovery for the rest of
   * the session — `dist2` then returns `NaN`, every `<` against it is false, and
   * nothing can be swept or struck again. Silent, total, and unreported.
   */
  setMove(x: number, y: number): void {
    if (this.paused) return
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.error("[lattice] setMove was given something that is not a direction", x, y)
      return
    }
    const m = Math.hypot(x, y)
    this.move = m > 1 ? { x: x / m, y: y / m } : { x, y }
  }

  setAim(x: number, y: number): void {
    if (this.paused) return
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.error("[lattice] setAim was given something that is not a direction", x, y)
      return
    }
    const m = Math.hypot(x, y)
    if (m > 1e-6) this.aim = { x: x / m, y: y / m }
  }

  /** Where the guns point. Instant, because a shooter that lags its stick lies. */
  get aiming(): Vec {
    return this.aim
  }

  /** Where the hull points. Eases toward `aiming`; only the renderer reads it. */
  get facing(): Vec {
    return { x: Math.cos(this.faceAngle), y: Math.sin(this.faceAngle) }
  }

  fire(): ArenaEvent[] {
    if (this.paused || this.cooldownMs > 0) return []
    this.cooldownMs = FIRE_COOLDOWN_MS
    const shotSpeed = SHOT_SPAN_PER_SEC * REFERENCE_SPAN * this.span
    this.shots.push({
      id: this.nextId++,
      x: this.ship.x + this.aim.x * (SHIP_R + 4),
      y: this.ship.y + this.aim.y * (SHIP_R + 4),
      vx: this.aim.x * shotSpeed + this.ship.vx * 0.3,
      vy: this.aim.y * shotSpeed + this.ship.vy * 0.3,
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
      const shove = WALL_SHOVE_SPAN * REFERENCE_SPAN * this.span
      body.vx += (body.vx / m) * shove
      body.vy += (body.vy / m) * shove
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
      const kick = JOSTLE_SPAN * REFERENCE_SPAN * this.span
      // The husk's half of a bump is the FIELD's motion, so it is scaled with
      // the field's pace; the ship's half is the ship's and is not. Measured,
      // unscaled: a lone husk drifting into a ship nobody was flying bumped it
      // once a second and wound itself up to 6.1% of the arena's diagonal a
      // second — three times the calm opening's whole drift band, off one
      // untouched screen. The ship's kick is `SHIP_*` territory; see #716.
      const shove = JOSTLE_HUSK_SPAN * REFERENCE_SPAN * this.span * this.driftScale
      this.ship.vx += (dx / m) * kick
      this.ship.vy += (dy / m) * kick
      body.vx -= (dx / m) * shove
      body.vy -= (dy / m) * shove
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

    // **Did the game give this one away?**
    //
    // Not "was a hint shown" — a blank silhouette and a single lit prime are
    // both hints and neither of them says what `642 − 530` is. The line is
    // `revealsAnswer`: are there numerals on the screen whose product is the
    // target. It is computed from the picture rather than from a stage number,
    // because which stage crosses it depends on the tree's shape — see
    // `hint.freeStages`.
    //
    // It is only ever true because the child **asked**: the clock stops at
    // `hintFree`, one stage short of the line, so nothing that happens to a
    // child who is sitting still can reach here.
    //
    // Two more things count as the game having given it away, and both are
    // read BEFORE the counters move, because `opening` is a function of
    // `opened` and this method is about to increment it:
    //
    //   * the field itself stated the answer — the calm opening's one husk
    //     carries the target and its numeral is on the stone;
    //   * the opening was **guided**, so `live.ts` marked which primes divide
    //     what was left and the hold was assembled with that in front of them.
    //
    // Neither is a penalty and neither is reported differently. What they do is
    // hold the arena's own ladder still, exactly as a tree that stated the
    // answer does, so nothing here walks a child up into harder arithmetic on
    // the strength of a round the game helped them through.
    const given = this.hint()?.given === true || this.givenByField || this.opening.guided

    // Once per question. A refusal spends the id — the resonator stays as a
    // goal the child can still open, but the host hears one answer, which is
    // the only honest reading of "what did they say when they were asked".
    //
    // **Reported whether or not the tree was up**, and the first version of this
    // was not. It closed a hinted question with `host.skip` instead, on the
    // reasoning that a `correct` after the game printed the answer is a claim
    // about the child that is not true. That is true and it is not the whole
    // truth: `skip` is documented as not advancing the session progress
    // fraction, and the host paints that fraction as a hairline across the top
    // of every pack. Measured, five hinted rounds in a row: five ceremonies,
    // `OPENED 5`, and a progress bar still on nought. The child who leans on the
    // hint is the one this feature is for, and theirs was the bar that never
    // moved. A hint may not cost anything, and that cost was three pixels above
    // a canvas that was congratulating them.
    const first = !res.reported
    if (first) {
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
      // Down further than up — and only on the answer the host actually heard.
      //
      // The second wrong hold carried into the same ring is a real thing the child
      // did, but it is not a second wrong *answer*: the id was spent on the first
      // one and nothing after it is reported. Moving the position on every one of
      // them would let a bump-loop walk the whole band down in about seven
      // seconds, with the game's idea of where the child is drifting away from the
      // host's for questions the host never received.
      if (first) this.ladder.refused()
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
    // The ladder does not climb on an answer the game handed over.
    //
    // This is not a penalty — it is the absence of one, and it is the ONE thing
    // this file still does differently for a hinted round. `opened()` is three
    // rungs harder next time, and pushing a child who had just asked to be shown
    // the answer into harder arithmetic is the one way a hint could still cost
    // them something. So the game holds its position and asks again at the level
    // they are actually working at. It is invisible, it is reachable only by a
    // deliberate tap, and a refusal still falls, because falling is the
    // direction that makes the next one kinder.
    if (!given) this.ladder.opened()
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
    if (!Number.isFinite(dtMs)) {
      // `Math.min(120, Math.max(0, NaN))` is `NaN`, and `NaN !== 0`, so the old
      // guard let one through — and one is enough: every position in the arena
      // becomes `NaN` and stays that way, with nothing thrown and nothing drawn
      // in the right place again.
      console.error("[lattice] step was handed a delta that is not a number", dtMs)
      return []
    }
    const clamped = Math.min(120, Math.max(0, dtMs))
    if (clamped === 0) return []
    const events: ArenaEvent[] = []

    // Timers advance on the *unclamped* delta and the world on the clamped one,
    // and that difference is deliberate: a sheet held for a minute should have
    // burned a refusal's 900ms of dim, but must not teleport a husk across the
    // arena. `pause`/`resume` cover a sheet the host raised; this covers a
    // backgrounded tab, which the pack is never told about.
    this.cooldownMs = Math.max(0, this.cooldownMs - dtMs)
    this.graceMs = Math.max(0, this.graceMs - dtMs)
    this.sweepGraceMs = Math.max(0, this.sweepGraceMs - dtMs)
    if (this.resonator) {
      this.resonator.cooldown = Math.max(0, this.resonator.cooldown - dtMs)
      this.resonator.age += dtMs
    }
    if (this.rearmMs > 0) this.rearmMs = Math.max(0, this.rearmMs - dtMs)
    // The hint's clock, and it is the CLAMPED delta rather than the raw one —
    // the opposite of every timer above. Those are things that should burn while
    // a tab is backgrounded (a refusal's 900ms of dim ought to be over when the
    // child comes back). Thinking time is not: three minutes in the app switcher
    // is three minutes the child was not looking at the question, and charging
    // them for it would unfold the whole tree behind their back.
    this.hintAgeMs += clamped

    // One 60Hz world, however fast the frame arrives. See `SUBSTEP_MS`.
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(clamped / SUBSTEP_MS)))
    const h = clamped / steps / 1000
    const shipMax = this.shipMax
    const driftMin = DRIFT_MIN_SPAN * REFERENCE_SPAN * this.span * this.driftScale
    const driftMax = DRIFT_MAX_SPAN * REFERENCE_SPAN * this.span * this.driftScale
    const decay = Math.exp(-SHIP_DRAG * h)
    const turn = 1 - Math.exp(-FACING_TURN_PER_SEC * h)

    for (let n = 0; n < steps; n++) {
      // The ship, solved rather than stepped.
      //
      // `v' = k(V − v)` where `V` is the speed the stick is asking for has a
      // closed form, and using it makes the ship *exactly* frame-rate independent
      // rather than nearly so. Substepping alone is not: `ceil(dt / 16.67)` gives
      // a substep of exactly 1/60s at 60, 30 and 20fps — the three rates anybody
      // measures — and 1/90s at 45fps, so an iterated integrator that agreed
      // perfectly at those three still ran 2% fast at 45 and 4% fast on a 144Hz
      // screen. Every current flagship is a 120 or 144Hz screen. The substepping
      // stays, because it is what stops a shot stepping over a husk; this is what
      // stops the ship's speed depending on the panel.
      const wantX = this.move.x * shipMax
      const wantY = this.move.y * shipMax
      const wasX = this.ship.vx - wantX
      const wasY = this.ship.vy - wantY
      this.ship.x += wantX * h + (wasX * (1 - decay)) / SHIP_DRAG
      this.ship.y += wantY * h + (wasY * (1 - decay)) / SHIP_DRAG
      this.ship.vx = wantX + wasX * decay
      this.ship.vy = wantY + wasY * decay
      // The clamp cannot fire from flying — the steady state *is* `shipMax` now,
      // exactly — so this only ever catches the kick from a jostle.
      const speed = Math.hypot(this.ship.vx, this.ship.vy)
      if (speed > shipMax) {
        this.ship.vx = (this.ship.vx / speed) * shipMax
        this.ship.vy = (this.ship.vy / speed) * shipMax
      }
      this.bounce(this.ship, SHIP_R, 0.4)

      // The drawn nose, easing toward the guns. Never the guns themselves, and
      // never through the origin — see `faceAngle`.
      const want = Math.atan2(this.aim.y, this.aim.x)
      let delta = want - this.faceAngle
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      this.faceAngle += delta * turn

      // Bodies.
      for (const body of this.bodies) {
        body.age += h * 1000
        body.x += body.vx * h
        body.y += body.vy * h
        this.bounce(body, body.prime ? MOTE_R : HUSK_R, 1)
        // Drifting husks slow to a readable pace rather than pinballing forever.
        const s = Math.hypot(body.vx, body.vy)
        if (s > driftMax) {
          const k = Math.exp(-2.2 * h)
          body.vx *= k
          body.vy *= k
        } else if (s < driftMin && s > 1e-6) {
          body.vx *= 1 + 1.5 * h
          body.vy *= 1 + 1.5 * h
        }
      }

      if (this.resonator) {
        this.resonator.x += this.resonator.vx * h
        this.resonator.y += this.resonator.vy * h
        this.bounce(this.resonator, RESONATOR_R, 1)
      }

      // Shots, and what they hit.
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const shot = this.shots[i] as Shot
        shot.life -= h * 1000
        shot.x += shot.vx * h
        shot.y += shot.vy * h
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

      // The ship, and what it reaches.
      //
      // Backwards, and that is load-bearing rather than a habit: `touch` splices
      // the body it swept out of this array and `scatter` can push new ones onto
      // the end, so a forward loop would skip the neighbour of anything it took
      // and revisit a mote it had just handed back. Going down, a removal is
      // always at the index we are on and everything below it is untouched — and
      // unlike the id-snapshot this replaces, it allocates nothing, which matters
      // now that the loop runs up to eight times a frame.
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        const body = this.bodies[i] as Body
        const reach = (SHIP_R + (body.prime ? MOTE_R : HUSK_R)) ** 2
        if (dist2(this.ship, body) < reach) events.push(...this.touch(body.id))
      }
    }

    return events
  }

  /**
   * Milliseconds the child has had with the current resonator.
   *
   * Frozen behind a sheet: `resume` shifts `askedAt` forward by exactly the
   * sheet, so this was already right *after* one, and now it is right during one
   * too. That is a latency number and nothing else reads it — the hint keeps its
   * own played-time clock, because a wall clock with a pause guard on it still
   * runs while the whole webview is in the app switcher.
   */
  elapsed(now: number): number {
    return Math.max(0, (this.paused ? this.pausedAt : now) - this.askedAt)
  }

  // ── the hint ─────────────────────────────────────────────────────────────

  /**
   * Which stage the hint stands at right now.
   *
   * The maximum of what the quiet has reached and what the child has asked for,
   * and that `max` is the entire state machine: a tap runs ahead of the schedule
   * and the schedule catches up silently behind it, so a tap can never be
   * followed a second later by an automatic stage landing on top of it, and
   * there is no timer to cancel, restart or leak.
   *
   * `elapsed` is measured from `askedAt`, which `resume` already shifts by
   * exactly the length of a host sheet — so time spent behind a paywall card, a
   * parent gate or the how-to-play panel does not spend a child's thinking
   * quiet. That was free; it is worth saying out loud because it is the kind of
   * thing that is only ever noticed when it is wrong.
   */
  private hintStage(): number {
    const tree = this.hintTree
    if (!tree || !this.resonator) return 0
    const cap = stageCount(tree)
    // The clock is capped at `hintFree` — the last picture that does not state
    // the answer — so nothing that happens to a child who is merely sitting
    // there can reach a stage that holds this pack's ladder still. Past that
    // line the tree only moves under a thumb.
    const byClock = Math.min(this.hintFree, scheduledStage(this.hintAgeMs, this.hintItem))
    return Math.min(cap, Math.max(byClock, this.hintTaps))
  }

  /**
   * The hint as it stands, for the renderer. `null` when there is nothing to
   * hint about or when the tree has not been offered yet.
   *
   * Memoised on the stage. The shell calls this every frame and the stage
   * changes a handful of times a question, so without the cache every frame
   * allocated a `Set` and re-walked the tree for a picture that had not moved.
   */
  hint(): HintState | null {
    const tree = this.hintTree
    if (!tree) return null
    const stage = this.hintStage()
    if (stage <= 0) return null
    const cached = this.hintCache
    if (cached && cached.stage === stage) return cached.state
    const shown = shownAt(tree, stage)
    const state: HintState = {
      placed: tree,
      stage,
      stages: stageCount(tree),
      shown,
      given: revealsAnswer(tree, shown),
    }
    this.hintCache = { stage, state }
    return state
  }

  /**
   * The child asked. Unfold one more stage, right now.
   *
   * Always allowed, always free, and it never runs out in a way that reads as
   * refusal: at the last stage this is simply a no-op and the tree is already
   * everything it has. Nothing is counted, nothing is spent, and no other rule
   * in this file reads `hintTaps`.
   */
  askHint(): ArenaEvent[] {
    if (this.paused) return []
    const tree = this.hintTree
    const res = this.resonator
    if (!tree || !res) return []
    const cap = stageCount(tree)
    const at = this.hintStage()
    if (at >= cap) return []
    this.hintTaps = at + 1
    return this.unfold()
  }

  /**
   * Has the hint moved on its own? Called by the shell every frame.
   *
   * A derived stage needs an edge detector somewhere for the sound and the
   * ripple to fire once rather than every frame, and this is it. It decides
   * nothing: `hint()` would return the same thing whether or not this is ever
   * called.
   */
  unfold(): ArenaEvent[] {
    if (this.paused) return []
    const res = this.resonator
    if (!res || !this.hintTree) return []
    const stage = this.hintStage()
    if (stage === this.hintSeen) return []
    this.hintSeen = stage
    if (stage <= 0) return []
    return [
      {
        kind: "hint",
        at: { x: res.x, y: res.y },
        stage,
        stages: stageCount(this.hintTree),
      },
    ]
  }

  // ── seeding ──────────────────────────────────────────────────────────────

  /**
   * The arena is without a question and the wait is up. Try again.
   *
   * The shell calls this every frame; it is a no-op unless there is nothing to
   * answer. The clock comes from the shell, like every other clock in this file.
   */
  rearm(now: number): ArenaEvent[] {
    if (this.paused || this.resonator !== null || this.rearmMs > 0) return []
    return this.arm(now)
  }

  /**
   * Draw a question, hang a resonator on it, and stock the field with husks
   * that come apart into exactly the primes its answer needs — plus the primes
   * behind one of the host's mal-rule answers, so a child who drops a carry can
   * assemble their own mistake and the misconception routes back to the host.
   *
   * **This is where the game says what it needs.** It used to be one line:
   *
   *     const drawn = this.host.next({ domain: "add" })
   *
   * A cosmetic label and never a difficulty, so the resonator carried whatever
   * rung the host's ladder was standing on — rung 0 at the start of a session,
   * which is `2 + 0`. See `ladder.ts` for the whole argument and the measured
   * band. Three things happen here now:
   *
   *   1. **Every draw names a difficulty and a ceiling**, walking outward from
   *      the game's position until one lands.
   *   2. **The bar is `isResonant` and not `isAskable`** — a target with a factor
   *      tree in it, because a target without one is not this game.
   *   3. **A draw that is not used is skipped, not abandoned.** `host.skip` is
   *      feature-detected; without it, a discarded question would sit open in the
   *      host's ledger forever and the child's record would fill with items
   *      nobody was ever shown.
   */
  private arm(now: number): ArenaEvent[] {
    this.askedAt = now
    // A new question starts in silence, however much of the last one's tree was
    // on the screen a moment ago.
    this.hintTree = null
    this.hintTaps = 0
    this.hintSeen = 0
    this.hintAgeMs = 0
    this.hintFree = 0
    this.hintCache = null
    const wall = this.sinceWall >= WALL_EVERY - 1
    let question: Question | null = null
    let landedAt = this.ladder.at
    const drawn: Array<{ question: Question; difficulty: number }> = []
    for (const request of this.ladder.requests(this.domain)) {
      const q = this.host.next(request)
      // **The rung that answered, not the rung that was asked for.**
      //
      // `host.next` serves the pooled question *closest* to the request, and the
      // pool was stocked for whatever came before it — so the two differ, often
      // and by a lot. Measured against the real adapter over one session: 104 of
      // 175 draws came from a rung other than the one named, by as much as
      // nineteen. Learning from the request would therefore write live rungs off
      // as barren and snap `landed()` onto a rung the child never saw, which is
      // the whole mechanism that makes `FLOOR` a hint rather than a dependency.
      //
      // `items.ts` puts this number on the question for exactly this reason:
      // "so the pack is told what it got and not what it asked for."
      const served = Number.isFinite(q.difficulty) ? q.difficulty : request.difficulty
      drawn.push({ question: q, difficulty: served })
      // A question with no id is not a question. The host hands one back when its
      // prefetch pool has run dry — a clone of the last one, with the id blanked —
      // and its `report` is then dropped on the floor at the far end. `MAX_DRAWS`
      // exists so an arming cannot empty the pool in the first place, and this is
      // the belt for that brace: a child who solves a resonator nothing can be
      // recorded against is the worst outcome available here, and it is silent.
      if (q.id === "") continue
      const hit = isResonant(Number(q.answer), MAX_TARGET, { wall })
      // Remembered either way: ten of the thirty-two rungs in the band produce
      // nothing this game can use. See `ladder.BARREN`.
      this.ladder.drew(rungOf(served), hit)
      if (hit) {
        question = q
        landedAt = served
        break
      }
    }

    // Nothing in the band was what the game wants. Rather than stall, take the
    // best of what was already drawn — no extra item is spent on this. A rung is
    // a distribution, and asking eight times for a factor tree and getting eight
    // primes is unlucky rather than broken; a wall early, or a two-tile hold, is
    // a worse round than the game aims for and a far better one than no round.
    if (!question) {
      const best = this.bestOf(drawn.map((d) => d.question))
      if (best) {
        question = best
        landedAt = drawn.find((d) => d.question.id === best.id)?.difficulty ?? landedAt
      }
    }

    // Whatever was drawn and not used is closed rather than left hanging. A skip
    // records nothing, moves no ladder and produces no outcome, which is exactly
    // what "the child was never shown this" should look like in the ledger.
    for (const entry of drawn) {
      if (entry.question.id !== question?.id) this.host.skip?.(entry.question.id)
    }

    if (!question) {
      // Nothing in the whole band the resonator could be a game about. The arena
      // stays playable — husks still crack, primes still sweep — and it tries
      // again in a few seconds rather than never asking for anything ever again,
      // which is what it used to do.
      this.stalled = true
      this.rearmMs = REARM_MS
      this.resonator = null
      // And the field is stocked if it is bare, which is the difference between
      // "the arena stays playable" being true and being a comment.
      //
      // The case that made this necessary is the one that matters most: a brand
      // new profile. The host warms its pool at *its* position, which for a fresh
      // profile is rung 0 — answers of one to three — and the first request this
      // game makes flushes that pool down to a reserve of eight of them. Every
      // draw of the first arming is then a `2 + 0`, nothing is resonant, and the
      // arena stalls on the very first frame of the very first session, before
      // `arm` has reached the line that puts anything on the screen. Without this
      // the child's first two and a half seconds of THE LATTICE is an empty grid.
      if (this.bodies.length === 0) this.stockPassiveField()
      console.error(
        "[lattice] no resonant target anywhere in the band; retrying in",
        REARM_MS,
        "ms",
      )
      return [{ kind: "stalled" }]
    }
    this.stalled = false
    this.rearmMs = 0
    this.ladder.landed(landedAt)

    const target = Number(question.answer)
    this.sinceWall = isPrime(target) ? 0 : this.sinceWall + 1
    const wanted = primeFactors(target)

    // The tree the hint will be drawn from, built now and never rebuilt.
    //
    // Off a *fork* of the generator rather than the generator itself: the tree
    // must be a deterministic function of the target and the seed, and it must
    // not shift the husk layout, the drift or the chaff by one draw — otherwise
    // adding a hint system would silently re-roll every seeded field in the
    // suite and in every child's session.
    this.hintTree = placeTree(factorTree(target, this.rng.fork(target)))
    this.hintItem = itemOf(target, landedAt)
    // Computed once, here, rather than per frame: it is a walk of the whole tree
    // at every stage and the shell asks for the hint sixty times a second.
    this.hintFree = freeStages(this.hintTree)

    // How busy this field is allowed to be. See `game/opening.ts` — at the very
    // start it is one husk, no decoy, no chaff, drifting at three tenths of the
    // pace, and it walks out to the shipped field over five openings.
    const plan = this.opening
    this.driftScale = plan.drift
    const values = Number.isFinite(plan.husks)
      ? gather(wanted, plan.husks)
      : huskify(wanted, this.rng)

    // One reachable mal-rule: the primes it needs that the answer does not
    // already supply. Kept small, or the field becomes a haystack.
    const decoy = plan.decoy ? this.pickDecoy(question, wanted) : []
    if (decoy.length > 0) values.push(...huskify(decoy, this.rng))

    // A little chaff, so "sweep only what you need" is a decision rather than
    // a formality — and more of it higher up the band.
    //
    // The band has a ceiling (`MAX_TARGET` is 999), so a child who reaches the
    // top of it would otherwise find the game stops getting harder. The
    // arithmetic cannot go further; the *sweep* can. Two extra decoy motes at the
    // top of the band is a field where getting the hold exactly right is work.
    const reach = (this.ladder.at - FLOOR) / Math.max(1e-6, CEILING - FLOOR)
    const chaff = Number.isFinite(plan.chaff)
      ? plan.chaff
      : this.rng.int(1, 3 + Math.round(2 * Math.max(0, Math.min(1, reach))))
    for (let i = 0; i < chaff; i++) values.push(this.rng.pick(MOTE_PRIMES.slice(0, 6)))

    // **Does the field, as it now stands, state the answer?**
    //
    // Asked here rather than off `plan.husks`, and after the decoy and the chaff
    // have gone in, because it is a question about the picture and not about the
    // plan. One stone, alone, carrying the target: the numeral on it IS the
    // answer and there is nothing else it could be. That is true of the first
    // two openings and of nothing else — a prime target puts the target on the
    // field as a mote at every step of the ramp, but from step 2 on there is
    // chaff drifting beside it and knowing *which* mote is the one is the round.
    this.givenByField = values.length === 1 && values[0] === target

    const driftMax = DRIFT_MAX_SPAN * REFERENCE_SPAN * this.span * this.driftScale
    this.bodies = []
    this.shots = []
    this.rng.shuffle(values)
    for (const value of values) {
      const edge = 70
      const x = this.rng.range(edge, Math.max(edge + 1, this.width - edge))
      const y = this.rng.range(edge, Math.max(edge + 1, this.height * 0.62))
      this.spawnAt(value, x, y, this.rng.range(-driftMax, driftMax), this.rng.range(-driftMax, driftMax))
    }

    this.resonator = {
      questionId: question.id,
      prompt: question.prompt,
      target,
      difficulty: landedAt,
      x: this.width / 2,
      y: this.height * 0.26,
      vx: this.rng.range(-26, 26) * this.span * this.driftScale,
      vy: this.rng.range(-14, 14) * this.span * this.driftScale,
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
   * Husks to crack and primes to sweep, with no resonator over them.
   *
   * The passive layer on its own. Not a question and not reported — the tile bar
   * still reads `2·2·3` under a running 12, which is the absorption this game
   * gives away for free, and the child has something to shoot at while the arena
   * waits for a target it can be a game about. Drawn from `MOTE_PRIMES` through
   * the same `huskify` every armed field uses, off the same seeded generator, so
   * nothing here is a hardcoded problem.
   */
  private stockPassiveField(): void {
    const plan = this.opening
    this.driftScale = plan.drift
    this.givenByField = false
    const primes: number[] = []
    const many = this.rng.int(5, 8)
    for (let i = 0; i < many; i++) primes.push(this.rng.pick(MOTE_PRIMES.slice(0, 8)))
    const driftMax = DRIFT_MAX_SPAN * REFERENCE_SPAN * this.span * this.driftScale
    const values = Number.isFinite(plan.husks)
      ? gather(primes, plan.husks)
      : huskify(primes, this.rng)
    for (const value of values) {
      const edge = 70
      this.spawnAt(
        value,
        this.rng.range(edge, Math.max(edge + 1, this.width - edge)),
        this.rng.range(edge, Math.max(edge + 1, this.height * 0.62)),
        this.rng.range(-driftMax, driftMax),
        this.rng.range(-driftMax, driftMax),
      )
    }
  }

  /**
   * The least bad of a handful of drawn questions, or `null` if none will do.
   *
   * The fallback bar, and it is deliberately weaker than `isResonant` in exactly
   * two ways and no others: a two-tile target is allowed (one crack instead of
   * two), and a wall may come round early. Ranked by tiles, so the best round
   * available is the one that gets played.
   *
   * What it does **not** give up is either of the two things the founder actually
   * reported. A target under `MIN_TARGET` is still refused, and so is a prime too
   * small to be a hunt — that is "finding a 2", and no shortage of alternatives
   * makes it a round worth playing. And readability is not negotiable either: a
   * composite whose factorisation needs a mote larger than the game draws is
   * refused outright rather than ranked below the others, because `2 · 397` is not
   * a worse round of this game, it is a different one. When every draw in the band
   * is one of those, the arena would rather have nothing for four seconds.
   */
  private bestOf(drawn: readonly Question[]): Question | null {
    let best: Question | null = null
    let bestTiles = 0
    for (const q of drawn) {
      if (q.id === "") continue
      const target = Number(q.answer)
      if (!isAskable(target, MAX_TARGET) || target < MIN_TARGET) continue
      const tiles = tileCount(target)
      if (isPrime(target) ? target < MIN_WALL : tiles < 2 || !isSmooth(target)) continue
      if (tiles > bestTiles) {
        bestTiles = tiles
        best = q
      }
    }
    return best
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
      if (extra.some((p) => p > LARGEST_MOTE_PRIME)) continue
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
      const speed =
        this.rng.range(DRIFT_MIN_SPAN, DRIFT_MAX_SPAN) *
        REFERENCE_SPAN *
        this.span *
        this.driftScale
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
