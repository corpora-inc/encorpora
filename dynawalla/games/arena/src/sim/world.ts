import { Rng } from "../core/rng.ts"
import { Grid } from "../core/grid.ts"
import { tidyValue } from "../core/digits.ts"
import { bandForMass, DEPTHS, depthFor, overdrive, type Depth } from "./depths.ts"
import type { TierSpec } from "../core/tier.ts"
import type { Host, Question } from "../contract.ts"

/*
 * ARENA — the simulation.
 *
 * One rule, stated by the picture rather than by a sentence: radius is
 * sqrt(value) for absolutely everything on screen, so "smaller than me" is
 * something you see before you read it, and the printed number is only there
 * to settle the near-ties. That is the whole tutorial and it takes three
 * seconds.
 *
 * Everything below is structure-of-arrays over typed arrays. After construction
 * this file allocates nothing per frame: no object literals in `step`, no
 * closures created in a loop, no array growth. Events are handed out of a
 * preallocated ring.
 */

// ---------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------

/** radius = R_K * sqrt(value). One law for motes, rivals and the player. */
export const R_K = 9
export const MOTE_MIN_R = 16
export const START_MASS = 10
/** Mass below which you cannot fall. You always have something to play with. */
export const FLOOR_MASS = 6

const MAX_MOTES = 360

/**
 * Broad-phase resolution. The cell COUNT is fixed here; the cell SIZE is set
 * per frame from `gridSpan`, so the grid costs the same 62×62 whether the
 * player is at mass 10 or mass 350,000.
 */
const GRID_COLS = 62

/**
 * Food value scales as `FOOD_A * mass^FOOD_B`, not as a fraction of mass.
 * A fraction compounds, and compounding turns a twenty-minute climb into a
 * ninety-second explosion followed by nothing. These two numbers are the
 * whole difficulty curve and they were fitted by simulating full runs.
 */
const FOOD_A = 0.62
const FOOD_B = 0.60

/**
 * How much of a mote actually becomes you.
 *
 * A mote's printed number is a SIZE — the thing you compare against your own
 * size, which is the entire mathematics of this game and is exact. It is not
 * an addend: a fish that swallows a fish nearly its own size does not double.
 * Absorption saturates, and the cap `mass / (1 + ABSORB_K)` means no single
 * mote can ever be worth more than a seventh of you.
 *
 * Without this, the sliver of the near-tie band that sits just below your mass
 * is a free doubling, a child finds it in ninety seconds, and a twenty-minute
 * climb becomes an exponential explosion. Measured: it did, every run.
 */
const ABSORB_K = 6

/**
 * …and the mass at which that saturation itself starts to tighten.
 *
 * A constant K makes every near-tie worth a FIXED FRACTION of you, and a fixed
 * fraction repeated is an exponential. Measured with a bot that simply always
 * chased the largest thing it could still swallow — which is the obvious
 * strategy in this genre and a child will find it — mass went 273 → 3,330,895
 * → 1,301,388,804 across three hundred seconds. That is not a balance problem
 * so much as a *legibility* problem: the entire premise of the game is telling
 * 3,418 from 3,481, and it cannot survive the player's own core reading
 * 1,301,388,804.
 *
 * So K grows as sqrt(mass) past this point, which turns dM/dt ∝ M into
 * dM/dt ∝ sqrt(M): polynomial, not exponential, and a twenty-minute run of the
 * strongest possible play now finishes in five or six digits instead of ten.
 * Below SOFT it is within a hair of the old curve, so the first two minutes —
 * the part that has to feel like an explosion — are untouched.
 */
const ABSORB_SOFT = 900

export function absorbGain(value: number, mass: number): number {
  if (value <= 0) return 0
  const k = ABSORB_K * Math.sqrt(1 + Math.max(0, mass) / ABSORB_SOFT)
  return Math.max(1, Math.round(value / (1 + (k * value) / Math.max(1, mass))))
}

/**
 * Swallowing a rival is the payoff moment of the whole genre, so it saturates
 * far more generously: taking down something your own size is worth about a
 * third of you, at every size, forever. It still saturates, because uncapped it
 * is a doubling, and a doubling that repeats is the same explosion by another
 * route — measured at 216 kills and eight orders of magnitude in a twenty-
 * minute run.
 *
 * It deliberately does NOT get the sqrt(mass) tightening ABSORB_SOFT applies,
 * and the asymmetry is the point. The near-tie *mote* is an exploit because the
 * game manufactures a continuous supply of them: about one mote in seven is
 * drawn from a band straddling your own mass, on purpose, because that is where
 * the place-value comparison lives. A *rival* is not a supply. There are at most
 * MAX_RIVALS of them, they respawn on a timer, and one is only edible below
 * `mass / 1.06`, so kills are rate-limited by the world rather than by the
 * curve. Measured with a bot that hunts nothing but the largest legally edible
 * rival for twenty minutes: flat K peaks at 34,456 and a tightened K at 11,442
 * — both five digits, neither an explosion. The tightening bought no safety and
 * cost the genre its payoff moment, so it is not taken.
 */
const DEVOUR_K = 2.6

export function devourGain(rivalMass: number, mass: number): number {
  if (rivalMass <= 0) return 0
  return Math.max(1, Math.round(rivalMass / (1 + (DEVOUR_K * rivalMass) / Math.max(1, mass))))
}
const MAX_RIVALS = 26
const MAX_EVENTS = 96

/** World units of view across the smaller screen dimension. */
export function viewSpanFor(mass: number): number {
  return R_K * Math.sqrt(mass) * 11 + 150
}

export function radiusForValue(v: number): number {
  return Math.max(MOTE_MIN_R, R_K * Math.sqrt(Math.abs(v)))
}

export function arenaRadiusFor(mass: number): number {
  // The membrane must always sit well outside the frame. Tied to a constant it
  // fell *inside* the view once you were large, and the picture became a lit
  // disc floating in a black void with the player pinned to the edge.
  return Math.max(2600, viewSpanFor(mass) * 3.4)
}

// Mote kinds.
export const MK_FOOD = 0
export const MK_VOID = 1
export const MK_SHED = 2
export const MK_ANSWER = 3

// Rival behaviour states.
export const RS_FEED = 0
export const RS_FLEE = 1
export const RS_HUNT = 2

// ---------------------------------------------------------------------------
// Events — the presentation layer's only input
// ---------------------------------------------------------------------------

export type EventKind =
  | "absorb"
  | "sting"
  | "rupture"
  | "kill"
  | "flip"
  | "depth"
  | "held"
  | "resonance-open"
  | "resonance-hit"
  | "resonance-miss"
  | "resonance-fade"
  | "shockwave"
  | "rival-death"

export type GameEvent = {
  kind: EventKind
  x: number
  y: number
  /** Magnitude — mass gained, mass lost, radius of a wave. */
  a: number
  /** Secondary — combo, value, depth index. */
  b: number
  r: number
  g: number
  bl: number
}

function blankEvent(): GameEvent {
  return { kind: "absorb", x: 0, y: 0, a: 0, b: 0, r: 1, g: 1, bl: 1 }
}

// ---------------------------------------------------------------------------
// Resonance — the curriculum beat
// ---------------------------------------------------------------------------

export type Resonance = {
  active: boolean
  /** 0 = closed, 1 = opening, 2 = live, 3 = resolving. */
  phase: number
  t: number
  duration: number
  question: Question | null
  /** Indices into the mote arrays for the four spheres. */
  spheres: Int32Array
  /**
   * The option string the Host handed us, per sphere, kept verbatim.
   *
   * The sphere's *drawn* label goes through `mval`, an Int32Array, because the
   * renderer needs it as a number. What gets reported back to the Host must not
   * take that round trip: `answered` is the child's answer and it is the Host's
   * own string, byte for byte, never a value that has been through a typed
   * array's range. The judgement itself is slot identity — `slot ===
   * correctSlot` — so no arithmetic, exact or otherwise, decides whether a
   * child was right.
   */
  labels: string[]
  /** Which sphere index holds the answer. */
  correctSlot: number
  openedAt: number
  /**
   * Milliseconds from opening to the answer being registered, frozen at the
   * moment of the answer. The harness used to recompute this from `openedAt`
   * on every frame of the 0.9 s resolve, so the metric it reported was the
   * answer latency plus however much of the celebration had played.
   */
  answerMs: number
  /** Radius of the sphere ring — also sets the player's traversal speed. */
  ringR: number
  /** Set for the resolve animation. */
  chosen: number
  wasCorrect: boolean
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export class World {
  readonly rng: Rng
  private readonly host: Host

  // -- player -------------------------------------------------------------
  px = 0
  py = 0
  pvx = 0
  pvy = 0
  mass = START_MASS
  /** Smoothed mass used for radius/camera so absorbs read as growth, not a jump. */
  massVis = START_MASS
  invuln = 0
  /** Short flinch after a sting, so a cluster costs one mistake, not five. */
  stingGrace = 0
  surging = false
  combo = 0
  bestMass = START_MASS
  deepest = 0
  ruptures = 0
  absorbed = 0
  /** Set by input each frame, in world space. */
  aimX = 0
  aimY = 120
  /** Set by the renderer so spawns can land just outside the actual frame. */
  viewAspect = 1.6

  // -- motes (SoA) --------------------------------------------------------
  readonly mx = new Float32Array(MAX_MOTES)
  readonly my = new Float32Array(MAX_MOTES)
  readonly mvx = new Float32Array(MAX_MOTES)
  readonly mvy = new Float32Array(MAX_MOTES)
  readonly mval = new Int32Array(MAX_MOTES)
  readonly mr = new Float32Array(MAX_MOTES)
  readonly mkind = new Uint8Array(MAX_MOTES)
  readonly malive = new Uint8Array(MAX_MOTES)
  readonly mphase = new Float32Array(MAX_MOTES)
  /** 0 = threat, 1 = edible. Animated, so the flip is a visible event. */
  readonly mflip = new Float32Array(MAX_MOTES)
  readonly mborn = new Float32Array(MAX_MOTES)
  moteCount = 0

  // -- rivals (SoA) -------------------------------------------------------
  readonly rx = new Float32Array(MAX_RIVALS)
  readonly ry = new Float32Array(MAX_RIVALS)
  readonly rvx = new Float32Array(MAX_RIVALS)
  readonly rvy = new Float32Array(MAX_RIVALS)
  readonly rmass = new Float32Array(MAX_RIVALS)
  readonly rMassVis = new Float32Array(MAX_RIVALS)
  readonly ralive = new Uint8Array(MAX_RIVALS)
  readonly rstate = new Uint8Array(MAX_RIVALS)
  readonly rhunter = new Uint8Array(MAX_RIVALS)
  readonly rleviathan = new Uint8Array(MAX_RIVALS)
  readonly rsurge = new Float32Array(MAX_RIVALS)
  readonly rhue = new Float32Array(MAX_RIVALS)
  readonly rwander = new Float32Array(MAX_RIVALS)
  readonly rrespawn = new Float32Array(MAX_RIVALS)
  readonly rname = new Int32Array(MAX_RIVALS)
  readonly rdanger = new Float32Array(MAX_RIVALS)
  /**
   * Where this rival has decided to go. Perception runs on a six-frame
   * stagger, so the decision has to outlive the frame that made it.
   */
  readonly rtx = new Float32Array(MAX_RIVALS)
  readonly rty = new Float32Array(MAX_RIVALS)
  rivalCount = 0

  // -- environment --------------------------------------------------------
  time = 0
  arenaR = arenaRadiusFor(START_MASS)
  depth: Depth = DEPTHS[0] as Depth
  depthNext: Depth = (DEPTHS[1] ?? DEPTHS[0]) as Depth
  depthT = 0
  over = 0
  spec: TierSpec

  resonance: Resonance = {
    active: false,
    phase: 0,
    t: 0,
    duration: 0,
    question: null,
    spheres: new Int32Array(4).fill(-1),
    labels: ["", "", "", ""],
    correctSlot: 0,
    openedAt: 0,
    answerMs: 0,
    ringR: 0,
    chosen: -1,
    wasCorrect: false,
  }
  private nextResonanceAt = 16
  private resonanceCount = 0

  // -- events -------------------------------------------------------------
  private readonly eventPool: GameEvent[] = Array.from({ length: MAX_EVENTS }, blankEvent)
  private eventCount = 0

  private readonly grid: Grid

  constructor(host: Host, spec: TierSpec, seed: number) {
    this.host = host
    this.spec = spec
    this.rng = new Rng(seed)
    // The grid is PLAYER-RELATIVE: `build()` is handed the player's position
    // as the origin each frame. Tied to world coordinates it covered ±9,300
    // while `arenaRadiusFor` passes that at mass ~680 — from THE CHURN onward
    // every mote outside the box clamped into one edge cell and the broad
    // phase quietly became the O(n²) scan it exists to avoid, at exactly the
    // depths with the most in the water.
    this.grid = new Grid(GRID_COLS, MAX_MOTES)
    this.reset()
  }

  /**
   * The square the live mote field occupies, centred on the player.
   *
   * `maintain` culls anything past 1.65 view spans, so the field is a disc of
   * that radius: 3.3 spans across, plus a margin for the frame's motion.
   */
  private get gridSpan(): number {
    return viewSpanFor(this.mass) * 3.6
  }

  get events(): readonly GameEvent[] {
    return this.eventPool
  }

  get eventLen(): number {
    return this.eventCount
  }

  private emit(
    kind: EventKind,
    x: number,
    y: number,
    a = 0,
    b = 0,
    r = 1,
    g = 1,
    bl = 1,
  ): void {
    if (this.eventCount >= MAX_EVENTS) return
    const e = this.eventPool[this.eventCount++] as GameEvent
    e.kind = kind
    e.x = x
    e.y = y
    e.a = a
    e.b = b
    e.r = r
    e.g = g
    e.bl = bl
  }

  get playerR(): number {
    return R_K * Math.sqrt(this.massVis)
  }

  get playerRTrue(): number {
    return R_K * Math.sqrt(this.mass)
  }

  /**
   * The checkpoint: mass you can no longer be taken below.
   *
   * This is the single change that turns ARENA from a treadmill into a climb.
   * Measured before it existed, a five-minute soak went 154 → 65 → 332 → 122 →
   * 152 and finished where it started — a child plays for five minutes and gets
   * nowhere, which is the exact opposite of what a growth game is for. Now the
   * high-water mark never decays and you can never be taken more than a bit
   * over a third below it. A bad patch is still a real, painful setback; it is
   * simply no longer able to delete the run.
   *
   * It is a fraction of your own peak rather than of a depth threshold on
   * purpose: the clock hands out depths, and anything the clock can hand out is
   * something the checkpoint must not be allowed to print.
   */
  get checkpoint(): number {
    return Math.max(FLOOR_MASS, this.bestMass * 0.58)
  }

  /**
   * Take mass away. Never, ever hands mass back: the floor is clamped to the
   * mass you already had, because a high water mark that *pays* for being hit
   * is the bug that once produced six orders of magnitude of free mass.
   */
  private damage(loss: number): number {
    const before = this.mass
    const floor = Math.min(before, this.checkpoint)
    const raw = before - loss
    this.mass = Math.max(floor, raw)
    // The floor HELD. This is the one rule in the game a child cannot see, so
    // the moment it saves them is the moment it gets shown: a gold pulse
    // exactly where the hit landed, no words, no number, no modal. Rate-limited
    // so a cluster of stings against the floor is one statement and not twelve.
    if (raw < floor - 1e-6 && this.heldCool <= 0) {
      this.heldCool = 1.1
      this.emit("held", this.px, this.py, floor, before - this.mass)
    }
    return before - this.mass
  }
  private heldCool = 0

  // -------------------------------------------------------------------------

  reset(): void {
    this.px = 0
    this.py = 0
    this.pvx = 0
    this.pvy = 0
    this.mass = START_MASS
    this.massVis = START_MASS
    this.invuln = 1.4
    this.combo = 0
    this.time = 0
    this.moteCount = 0
    this.rivalCount = 0
    this.malive.fill(0)
    this.ralive.fill(0)
    this.resonance.active = false
    this.resonance.phase = 0
    this.nextResonanceAt = 16
    this.resonanceCount = 0
    this.bestMass = START_MASS
    this.deepest = 0
    this.depth = DEPTHS[0] as Depth
    this.refreshDepth()
    for (let i = 0; i < this.spec.motes; i++) this.spawnMote(true)
    for (let i = 0; i < this.spec.rivals; i++) this.spawnRival(true)
  }

  applySpec(spec: TierSpec): void {
    this.spec = spec
    while (this.moteCount > spec.motes) {
      // Retire the mote furthest from the player rather than a random one.
      let worst = -1
      let worstD = -1
      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.malive[i] || this.mkind[i] === MK_ANSWER) continue
        const dx = (this.mx[i] as number) - this.px
        const dy = (this.my[i] as number) - this.py
        const d = dx * dx + dy * dy
        if (d > worstD) {
          worstD = d
          worst = i
        }
      }
      if (worst < 0) break
      this.malive[worst] = 0
      this.moteCount--
    }
    // Retire rivals down to the new budget. The unconditional `break` that used
    // to sit at the bottom of this loop meant an ultra→low demotion (24 → 12)
    // removed exactly one, and the tier the governor had just decided the
    // machine could not afford stayed on screen.
    while (this.rivalCount > spec.rivals) {
      let victim = -1
      for (let i = MAX_RIVALS - 1; i >= 0; i--) {
        if (this.ralive[i] && !this.rleviathan[i]) {
          victim = i
          break
        }
      }
      if (victim < 0) break
      this.ralive[victim] = 0
      this.rrespawn[victim] = 0
      this.rivalCount--
    }
  }

  private refreshDepth(): void {
    const prev = this.depth.index
    // bestMass, not mass, and floored by the band we are already in: the water
    // is a record of how deep this run has been, never a readout of how the
    // last ten seconds went.
    const d = depthFor(this.bestMass, this.time, this.depth.index)
    this.depth = d.depth
    this.depthNext = d.next
    this.depthT = d.t
    this.over = overdrive(this.bestMass, this.time)
    this.arenaR = arenaRadiusFor(this.mass)
    if (this.depth.index > this.deepest) this.deepest = this.depth.index
    if (this.depth.index !== prev) {
      // Did the run BUY this band, or did the clock simply deliver it? Same
      // rung either way, but the presentation is not the same, and a child
      // should be able to hear the difference.
      const bought = bandForMass(this.bestMass) >= this.depth.index ? 1 : 0
      this.emit("depth", this.px, this.py, this.depth.index, bought)
    }
  }

  // -- mote lifecycle -------------------------------------------------------

  private freeMote(): number {
    for (let i = 0; i < MAX_MOTES; i++) if (!this.malive[i]) return i
    return -1
  }

  /**
   * Value policy — this is where the mathematics actually lives.
   *
   * Nearly half of every field is deliberately drawn from a narrow band around
   * the player's own mass. A mote at M-3 is a prize; a mote at M+3 is a
   * mistake; and telling 3,418 from 3,481 at speed is the exact place-value
   * comparison a worksheet asks for eighty times and gets answered nine times.
   * The wide bands exist so the field still reads instantly at a glance.
   */
  /**
   * Mote values.
   *
   * The band fractions are a legibility budget as much as a difficulty one.
   * A near-tie or big-threat mote has a radius proportional to your own, so it
   * covers a *fixed* fraction of the screen however large you get — twenty per
   * cent of a 340-mote field turned APEX into forty overlapping five-digit
   * numbers, which is not tension, it is noise. Ten per cent reads.
   */
  private rollValue(): { v: number; kind: number } {
    const M = this.mass
    const r = this.rng
    if (r.chance(this.depth.voidRate)) {
      const mag = Math.max(2, tidyValue(FOOD_A * Math.pow(M, FOOD_B) * r.range(1.0, 3.0)))
      return { v: -mag, kind: MK_VOID }
    }
    const scale = Math.max(2, FOOD_A * Math.pow(M, FOOD_B))
    const roll = r.f()
    if (roll < 0.62) {
      // Crumbs — where almost all of your food comes from. Their value grows
      // with the square-ish root of your mass, so a crumb is a fifth of you at
      // the start and a rounding error when you are enormous. That single
      // choice is what makes the climb last.
      return { v: tidyValue(r.int(1, Math.max(2, Math.round(scale)))), kind: MK_FOOD }
    }
    if (roll < 0.86) {
      const lo = Math.max(1, Math.round(scale * 0.8))
      const hi = Math.max(lo + 1, Math.round(scale * 2.6))
      return { v: tidyValue(r.int(lo, Math.min(hi, Math.max(2, Math.round(M * 0.55))))), kind: MK_FOOD }
    }
    if (roll < 0.94) {
      // The near-tie band, deliberately skewed *above* you. Most of it is a
      // wall; the sliver below your mass is worth nearly doubling, and taking
      // it is the bravest thing in the game. It has to be rare or it is the
      // only thing anyone does.
      const lo = Math.max(1, Math.round(M * 0.95))
      const hi = Math.max(lo + 2, Math.round(M * 1.32))
      return { v: tidyValue(r.int(lo, hi)), kind: MK_FOOD }
    }
    const lo = Math.max(2, Math.round(M * 1.5))
    const hi = Math.max(lo + 2, Math.round(M * 3.1))
    return { v: tidyValue(r.int(lo, hi)), kind: MK_FOOD }
  }

  private spawnMote(anywhere: boolean): number {
    const i = this.freeMote()
    if (i < 0) return -1
    const r = this.rng
    const { v, kind } = this.rollValue()
    let x: number
    let y: number
    if (anywhere) {
      const a = r.range(0, Math.PI * 2)
      const d = Math.sqrt(r.f()) * this.arenaR * 0.96
      x = Math.cos(a) * d
      y = Math.sin(a) * d
    } else {
      // Uniform over the disc the player can reach, minus whatever is on
      // screen right now. Uniform keeps the density even wherever you swim;
      // the rejection keeps every mote's arrival off-camera, so nothing ever
      // blinks into existence in front of a child's eyes.
      const span = viewSpanFor(this.mass)
      const halfH = span * 0.53
      const halfW = halfH * this.viewAspect
      const R = span * 1.5
      let dx = 0
      let dy = 0
      for (let tries = 0; tries < 8; tries++) {
        const a = r.range(0, Math.PI * 2)
        const d = R * Math.sqrt(r.f())
        dx = Math.cos(a) * d
        dy = Math.sin(a) * d
        if (Math.abs(dx) > halfW || Math.abs(dy) > halfH) break
        if (tries === 7) {
          const s2 = (halfW + halfH) / (Math.hypot(dx, dy) || 1)
          dx *= s2
          dy *= s2
        }
      }
      x = this.px + dx
      y = this.py + dy
      const rad = Math.hypot(x, y)
      if (rad > this.arenaR * 0.98) {
        const s = (this.arenaR * 0.9) / rad
        x *= s
        y *= s
      }
    }
    this.mx[i] = x
    this.my[i] = y
    const drift = 16 + this.depth.temper * 30
    this.mvx[i] = r.sym(drift)
    this.mvy[i] = r.sym(drift)
    this.mval[i] = v
    this.mr[i] = radiusForValue(v)
    this.mkind[i] = kind
    this.malive[i] = 1
    this.mphase[i] = r.range(0, Math.PI * 2)
    this.mflip[i] = kind === MK_VOID ? 0 : Math.abs(v) < this.mass ? 1 : 0
    this.mborn[i] = this.time
    this.moteCount++
    return i
  }

  /** Scatter mass as motes — used by rupture, by rival death and by shedding. */
  private scatter(x: number, y: number, total: number, chunks: number, speed: number, kind: number): void {
    if (total < 1) return
    const per = Math.max(1, Math.round(total / chunks))
    for (let k = 0; k < chunks; k++) {
      const i = this.freeMote()
      if (i < 0) return
      const a = this.rng.range(0, Math.PI * 2)
      const sp = speed * this.rng.range(0.5, 1.35)
      this.mx[i] = x + Math.cos(a) * 6
      this.my[i] = y + Math.sin(a) * 6
      this.mvx[i] = Math.cos(a) * sp
      this.mvy[i] = Math.sin(a) * sp
      this.mval[i] = per
      this.mr[i] = radiusForValue(per)
      this.mkind[i] = kind
      this.malive[i] = 1
      this.mphase[i] = this.rng.range(0, Math.PI * 2)
      this.mflip[i] = per < this.mass ? 1 : 0
      this.mborn[i] = this.time
      this.moteCount++
    }
  }

  // -- rival lifecycle ------------------------------------------------------

  private freeRival(): number {
    for (let i = 0; i < MAX_RIVALS; i++) if (!this.ralive[i] && (this.rrespawn[i] as number) <= 0) return i
    return -1
  }

  private spawnRival(anywhere: boolean): number {
    const i = this.freeRival()
    if (i < 0) return -1
    const r = this.rng
    // Sized around the player so the field is always a live ladder: some you
    // can eat right now, some you cannot, and a couple you must grow into.
    const roll = r.f()
    let m: number
    // The plankton tier matters twice over. It is the fantasy — once you are
    // the board, most of the board is beneath your notice — and it is the brake
    // on the kill economy, because absorption saturates and something a
    // twentieth your size is worth a twentieth of you however many you eat.
    if (roll < 0.26) m = Math.max(4, this.mass * r.range(0.03, 0.20))
    else if (roll < 0.48) m = Math.max(4, this.mass * r.range(0.30, 0.70))
    else if (roll < 0.78) m = this.mass * r.range(0.80, 1.18)
    else if (roll < 0.95) m = this.mass * r.range(1.3, 1.95)
    else m = this.mass * r.range(1.95, 2.25)
    m = Math.max(4, Math.round(m))

    let x: number
    let y: number
    if (anywhere) {
      const a = r.range(0, Math.PI * 2)
      const d = Math.sqrt(r.f()) * this.arenaR * 0.9
      x = Math.cos(a) * d
      y = Math.sin(a) * d
    } else {
      const a = r.range(0, Math.PI * 2)
      const d = viewSpanFor(this.mass) * r.range(1.15, 1.9)
      x = this.px + Math.cos(a) * d
      y = this.py + Math.sin(a) * d
      const rad = Math.hypot(x, y)
      if (rad > this.arenaR) {
        const s = (this.arenaR * 0.88) / rad
        x *= s
        y *= s
      }
    }
    this.rx[i] = x
    this.ry[i] = y
    this.rvx[i] = r.sym(30)
    this.rvy[i] = r.sym(30)
    this.rmass[i] = m
    this.rMassVis[i] = m
    this.ralive[i] = 1
    this.rstate[i] = RS_FEED
    this.rsurge[i] = 0
    this.rhue[i] = r.f()
    this.rwander[i] = r.range(0, Math.PI * 2)
    this.rname[i] = r.int(0, 63)
    this.rdanger[i] = 0
    // Decide immediately rather than drifting for up to six frames with a
    // target left over from whoever last occupied this slot.
    this.decide(i, x, y, m, R_K * Math.sqrt(m))

    const hunterBudget = this.depth.hunters
    let hunters = 0
    for (let k = 0; k < MAX_RIVALS; k++) if (this.ralive[k] && this.rhunter[k]) hunters++
    this.rhunter[i] = hunters < hunterBudget && r.chance(0.5) ? 1 : 0
    this.rleviathan[i] = 0
    this.rivalCount++
    return i
  }

  private spawnLeviathan(): void {
    const i = this.freeRival()
    if (i < 0) return
    const r = this.rng
    const a = r.range(0, Math.PI * 2)
    const d = viewSpanFor(this.mass) * 2.4
    this.rx[i] = this.px + Math.cos(a) * d
    this.ry[i] = this.py + Math.sin(a) * d
    const m = Math.round(this.mass * r.range(3.4, 5.2))
    this.rmass[i] = m
    this.rMassVis[i] = m
    this.ralive[i] = 1
    this.rstate[i] = RS_HUNT
    this.rsurge[i] = 0
    this.rhue[i] = 0.06
    this.rwander[i] = 0
    this.rname[i] = -1
    this.rhunter[i] = 1
    this.rleviathan[i] = 1
    this.rdanger[i] = 0
    this.rivalCount++
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number): void {
    this.eventCount = 0
    this.time += dt
    this.invuln = Math.max(0, this.invuln - dt)
    this.stingGrace = Math.max(0, this.stingGrace - dt)
    this.heldCool = Math.max(0, this.heldCool - dt)

    this.stepPlayer(dt)
    this.stepMotes(dt)
    this.stepRivals(dt)
    this.collide(dt)
    this.stepResonance(dt)
    this.maintain(dt)

    // Visual mass lags the true mass so growth is a swell, not a step.
    const k = 1 - Math.exp(-dt * 9)
    this.massVis += (this.mass - this.massVis) * k
    for (let i = 0; i < MAX_RIVALS; i++) {
      if (!this.ralive[i]) continue
      this.rMassVis[i] = (this.rMassVis[i] as number) + ((this.rmass[i] as number) - (this.rMassVis[i] as number)) * k
    }
    if (this.mass > this.bestMass) this.bestMass = this.mass
    this.refreshDepth()
  }

  private stepPlayer(dt: number): void {
    const r = this.playerRTrue
    // Agar's law: mass costs agility. Without this, growth has no downside and
    // the whole genre collapses into a farming sim.
    // Size buys momentum, not top speed denial: a leviathan crosses the water
    // quickly and turns like a barge. Making size cost *agility* rather than
    // *speed* is what keeps the twelfth minute from becoming a slow crawl
    // across an empty screen, while still letting a minnow dance out of reach.
    const base = 520
    let speed = base * Math.pow(Math.max(18, r) / 28, 0.30)
    // Inside a Resonance the arena is a fixed-size room however large you are.
    // Distance to a sphere grows with your radius while ordinary speed only
    // grows as r^0.30, so past a certain size the answer becomes physically
    // unreachable inside the window — measured: nine of forty-eight questions
    // answered in a twenty-minute run, and every miss was a timeout, not a
    // mistake. The curriculum beat must never be the thing that gets outrun.
    if (this.resonance.active && this.resonance.phase >= 1) {
      speed = Math.max(speed, this.resonance.ringR / 1.35)
    }
    const surgeOn = this.surging && this.mass > FLOOR_MASS + 2 && !this.resonance.active
    const mult = surgeOn ? 1.92 : 1

    let tx = this.aimX
    let ty = this.aimY
    let dx = tx - this.px
    let dy = ty - this.py
    let d = Math.hypot(dx, dy)
    if (d < 0.001) {
      dx = 0
      dy = 0
      d = 1
    }
    // Inside a small dead-zone the core eases to a stop rather than jittering.
    const grip = Math.min(1, d / Math.max(30, r * 0.55))
    const desiredX = (dx / d) * speed * mult * grip
    const desiredY = (dy / d) * speed * mult * grip

    // Heavier cores turn slower. This is where "majestic" comes from.
    const agility = 8.0 * Math.pow(30 / Math.max(24, r), 0.45)
    const kk = 1 - Math.exp(-dt * agility)
    this.pvx += (desiredX - this.pvx) * kk
    this.pvy += (desiredY - this.pvy) * kk

    this.px += this.pvx * dt
    this.py += this.pvy * dt

    if (surgeOn) {
      // Surge is paid for in mass, sprayed out behind you as real, edible
      // motes. The cost is visible, it is on the field, and a rival will
      // absolutely come and eat your exhaust.
      const burn = Math.max(0.9, this.mass * 0.11) * dt
      // Surge is paid for down to the checkpoint and no further, so a child is
      // never trapped without an escape — but the exhaust is real mass, so it
      // stops being shed the moment there is nothing left to pay with. Without
      // that guard a floored player is a free mote printer.
      const paid = this.damage(burn) > burn * 0.5
      const sp = Math.hypot(this.pvx, this.pvy)
      if (paid && sp > 1 && this.rng.chance(Math.min(1, dt * 26))) {
        const i = this.freeMote()
        if (i >= 0) {
          const v = Math.max(1, Math.round(this.mass * 0.035))
          this.mx[i] = this.px - (this.pvx / sp) * r
          this.my[i] = this.py - (this.pvy / sp) * r
          this.mvx[i] = -(this.pvx / sp) * 150 + this.rng.sym(60)
          this.mvy[i] = -(this.pvy / sp) * 150 + this.rng.sym(60)
          this.mval[i] = v
          this.mr[i] = radiusForValue(v)
          this.mkind[i] = MK_SHED
          this.malive[i] = 1
          this.mphase[i] = this.rng.range(0, 6.28)
          this.mflip[i] = 1
          this.mborn[i] = this.time
          this.moteCount++
        }
      }
    }

    // The membrane. A luminous wall that pushes, never a wall that kills.
    const rad = Math.hypot(this.px, this.py)
    const lim = this.arenaR - r
    if (rad > lim) {
      const push = (rad - lim) * 9
      this.pvx -= (this.px / rad) * push * dt * 8
      this.pvy -= (this.py / rad) * push * dt * 8
      const s = lim / rad
      this.px += (this.px * s - this.px) * Math.min(1, dt * 10)
      this.py += (this.py * s - this.py) * Math.min(1, dt * 10)
    }
  }

  private stepMotes(dt: number): void {
    const drag = Math.exp(-dt * 1.05)
    const M = this.mass
    const pr = this.playerRTrue
    // A large core drags the water with it. Once you are the board, the board
    // comes to you — the single most satisfying thing about being enormous.
    const pullR = pr * 3.4
    const pullK = Math.min(1, Math.max(0, (M - 60) / 900)) * 260

    for (let i = 0; i < MAX_MOTES; i++) {
      if (!this.malive[i]) continue
      let vx = this.mvx[i] as number
      let vy = this.mvy[i] as number
      vx *= drag
      vy *= drag

      const x = this.mx[i] as number
      const y = this.my[i] as number

      if (pullK > 0 && this.mkind[i] !== MK_ANSWER) {
        const dx = this.px - x
        const dy = this.py - y
        const d2 = dx * dx + dy * dy
        if (d2 < pullR * pullR && d2 > 1) {
          const d = Math.sqrt(d2)
          const f = (1 - d / pullR) * pullK
          vx += (dx / d) * f * dt
          vy += (dy / d) * f * dt
        }
      }

      this.mvx[i] = vx
      this.mvy[i] = vy
      this.mx[i] = x + vx * dt
      this.my[i] = y + vy * dt
      this.mphase[i] = (this.mphase[i] as number) + dt * 1.6

      // Keep them inside the membrane.
      const rad = Math.hypot(this.mx[i] as number, this.my[i] as number)
      if (rad > this.arenaR) {
        const s = this.arenaR / rad
        this.mx[i] = (this.mx[i] as number) * s
        this.my[i] = (this.my[i] as number) * s
        this.mvx[i] = -vx * 0.4
        this.mvy[i] = -vy * 0.4
      }

      // The flip. When you grow past a mote it stops being a threat, and that
      // conversion is animated rather than swapped, because watching the world
      // turn into food is the reward the whole genre is built on.
      if (this.mkind[i] !== MK_VOID && this.mkind[i] !== MK_ANSWER) {
        const want = Math.abs(this.mval[i] as number) < M ? 1 : 0
        const cur = this.mflip[i] as number
        if (want === 1 && cur < 0.5) {
          this.emit("flip", this.mx[i] as number, this.my[i] as number, this.mr[i] as number, this.mval[i] as number)
        }
        this.mflip[i] = cur + (want - cur) * Math.min(1, dt * 7)
      }
    }
  }

  private stepRivals(dt: number): void {
    const frame = (this.time * 60) | 0
    for (let i = 0; i < MAX_RIVALS; i++) {
      if ((this.rrespawn[i] as number) > 0) {
        this.rrespawn[i] = (this.rrespawn[i] as number) - dt
        if ((this.rrespawn[i] as number) <= 0) {
          this.rrespawn[i] = 0
          if (this.rivalCount < this.spec.rivals) this.spawnRival(false)
        }
        continue
      }
      if (!this.ralive[i]) continue

      const m = this.rmass[i] as number
      const rr = R_K * Math.sqrt(m)
      const x = this.rx[i] as number
      const y = this.ry[i] as number

      // Perception runs on a stagger — a rival re-decides five times a second,
      // which is also why they read as deliberate rather than twitchy.
      if ((frame + i) % 6 === 0) this.decide(i, x, y, m, rr)

      const st = this.rstate[i] as number
      const tx = this.rtx[i] as number
      const ty = this.rty[i] as number

      // Wander keeps a feeding rival from looking like a homing missile.
      this.rwander[i] = (this.rwander[i] as number) + this.rng.sym(dt * 5)
      const wob = (this.rwander[i] as number)

      let dx = tx - x
      let dy = ty - y
      const d = Math.hypot(dx, dy) || 1
      dx /= d
      dy /= d
      dx += Math.cos(wob) * 0.22
      dy += Math.sin(wob) * 0.22

      const temper = this.depth.temper + this.over * 0.2
      const lev = this.rleviathan[i] === 1
      const base = lev ? 330 : 470 + temper * 120
      let speed = base * Math.pow(Math.max(18, rr) / 28, lev ? 0.22 : 0.30)

      // Surging costs a rival mass exactly as it costs the player, so a long
      // chase genuinely wears the hunter down and the leaderboard churns.
      const wantSurge =
        !lev && (st === RS_FLEE ? this.rdanger[i]! > 0.55 : st === RS_HUNT ? this.rdanger[i]! > 0.4 : false)
      if (wantSurge && m > 8) {
        speed *= 1.8
        const burn = Math.max(0.35, m * 0.085) * dt
        this.rmass[i] = Math.max(4, m - burn)
        this.rsurge[i] = Math.min(1, (this.rsurge[i] as number) + dt * 5)
      } else {
        this.rsurge[i] = Math.max(0, (this.rsurge[i] as number) - dt * 3)
      }

      const nl = Math.hypot(dx, dy) || 1
      const agility = (lev ? 2.2 : 6.4) * Math.pow(30 / Math.max(24, rr), 0.45)
      const kk = 1 - Math.exp(-dt * agility)
      this.rvx[i] = (this.rvx[i] as number) + ((dx / nl) * speed - (this.rvx[i] as number)) * kk
      this.rvy[i] = (this.rvy[i] as number) + ((dy / nl) * speed - (this.rvy[i] as number)) * kk
      this.rx[i] = x + (this.rvx[i] as number) * dt
      this.ry[i] = y + (this.rvy[i] as number) * dt

      const rad = Math.hypot(this.rx[i] as number, this.ry[i] as number)
      const lim = this.arenaR - rr
      if (rad > lim) {
        const s = lim / rad
        this.rx[i] = (this.rx[i] as number) * s
        this.ry[i] = (this.ry[i] as number) * s
        this.rvx[i] = -(this.rvx[i] as number) * 0.5
        this.rvy[i] = -(this.rvy[i] as number) * 0.5
      }
    }
  }

  /**
   * Rival decision. Writes the chosen target into `rtx[i]`/`rty[i]`, which is
   * how the AI returns a vector without allocating one two hundred times a
   * second.
   *
   * It used to write into three SHARED scratch fields with the comment "which
   * the caller reads immediately". The caller does read immediately — but
   * `decide` only runs for one rival in six per frame (`(frame + i) % 6`), and
   * on the other five frames the guard `scratchI !== i` fired and the rival
   * steered at ITSELF: zero direction vector, pure wander at full speed. Flee,
   * juke, hunt, prey selection and the whole `depth.hunters` budget were
   * diluted six to one, and THE CHURN's "hunters that lock on" barely locked
   * on. A decision has to persist between the frames that make it.
   */
  private decide(i: number, x: number, y: number, m: number, rr: number): void {
    const lev = this.rleviathan[i] === 1
    const perception = rr * (lev ? 22 : 13) + 700 + R_K * Math.sqrt(this.mass) * 3

    // 1. Is anything here big enough to eat me?
    let fleeX = 0
    let fleeY = 0
    let fleeW = 0
    let danger = 0

    if (!lev) {
      // The player counts as a rival in every calculation. Being feared is the
      // point of getting big.
      const pm = this.mass
      const dxp = x - this.px
      const dyp = y - this.py
      const dp = Math.hypot(dxp, dyp)
      if (pm > m * 1.06 && dp < perception && this.invuln <= 0) {
        // You are seen from a distance proportional to how frightening you
        // are. Being enormous should empty the water ahead of you.
        const w = (1 - dp / perception) * (pm / m)
        fleeX += (dxp / (dp || 1)) * w
        fleeY += (dyp / (dp || 1)) * w
        fleeW += w
        danger = Math.max(danger, 1 - dp / Math.max(1, rr * 6 + 260))
      }
      for (let k = 0; k < MAX_RIVALS; k++) {
        if (k === i || !this.ralive[k]) continue
        const om = this.rmass[k] as number
        if (om <= m * 1.06) continue
        const dx = x - (this.rx[k] as number)
        const dy = y - (this.ry[k] as number)
        const d = Math.hypot(dx, dy)
        if (d > perception) continue
        const w = (1 - d / perception) * (om / m)
        fleeX += (dx / (d || 1)) * w
        fleeY += (dy / (d || 1)) * w
        fleeW += w
        danger = Math.max(danger, 1 - d / Math.max(1, rr * 6 + 260))
      }
    }

    this.rdanger[i] = danger

    if (fleeW > 0.35) {
      this.rstate[i] = RS_FLEE
      const n = Math.hypot(fleeX, fleeY) || 1
      let fxn = fleeX / n
      let fyn = fleeY / n
      // Juke. Running in a straight line from something faster than you is
      // just a slower death; weaving is what a small nimble thing actually
      // does, and it is why chasing one is a skill rather than a formality.
      const juke = Math.sin(this.time * 4.2 + i * 1.7) * 0.75
      const px2 = -fyn
      const py2 = fxn
      fxn += px2 * juke
      fyn += py2 * juke
      const n2 = Math.hypot(fxn, fyn) || 1
      this.rtx[i] = x + (fxn / n2) * 900
      this.rty[i] = y + (fyn / n2) * 900
      return
    }

    // 2. Is there prey worth chasing? Hunters and leviathans prefer the player.
    let bestPrey = -1
    let bestPreyScore = -1
    const aggro = this.depth.temper + this.over * 0.25
    const wantsPlayer = (this.rhunter[i] === 1 || lev) && this.mass < m * 0.94 && this.invuln <= 0
    if (wantsPlayer) {
      const d = Math.hypot(x - this.px, y - this.py)
      if (d < perception * 1.6) {
        this.rstate[i] = RS_HUNT
        this.rtx[i] = this.px + this.pvx * 0.35
        this.rty[i] = this.py + this.pvy * 0.35
        this.rdanger[i] = Math.max(danger, 1 - d / Math.max(1, rr * 8 + 400))
        return
      }
    }
    if (!lev && aggro > 0.2) {
      if (this.mass < m * 0.9 && this.invuln <= 0) {
        const d = Math.hypot(x - this.px, y - this.py)
        if (d < perception) {
          const s = (aggro * (m / Math.max(1, this.mass))) / (d + 60)
          if (s > bestPreyScore) {
            bestPreyScore = s
            bestPrey = -2
          }
        }
      }
      for (let k = 0; k < MAX_RIVALS; k++) {
        if (k === i || !this.ralive[k]) continue
        const om = this.rmass[k] as number
        if (om > m * 0.9) continue
        const d = Math.hypot(x - (this.rx[k] as number), y - (this.ry[k] as number))
        if (d > perception) continue
        const s = (aggro * om) / (d + 60)
        if (s > bestPreyScore) {
          bestPreyScore = s
          bestPrey = k
        }
      }
    }

    // 3. Otherwise feed. Rivals obey exactly the rule the player obeys, and a
    //    smart one will not swim into a number bigger than itself.
    let bestMote = -1
    let bestMoteScore = -1
    for (let k = 0; k < MAX_MOTES; k++) {
      if (!this.malive[k]) continue
      const v = this.mval[k] as number
      if (v < 0) continue
      if (v >= m) continue
      const dx = x - (this.mx[k] as number)
      const dy = y - (this.my[k] as number)
      const d2 = dx * dx + dy * dy
      if (d2 > perception * perception) continue
      const s = v / (Math.sqrt(d2) + 40)
      if (s > bestMoteScore) {
        bestMoteScore = s
        bestMote = k
      }
    }

    if (bestPrey !== -1 && bestPreyScore > bestMoteScore * 0.9) {
      this.rstate[i] = RS_HUNT
      if (bestPrey === -2) {
        this.rtx[i] = this.px + this.pvx * 0.3
        this.rty[i] = this.py + this.pvy * 0.3
      } else {
        this.rtx[i] = (this.rx[bestPrey] as number) + (this.rvx[bestPrey] as number) * 0.3
        this.rty[i] = (this.ry[bestPrey] as number) + (this.rvy[bestPrey] as number) * 0.3
      }
      return
    }

    this.rstate[i] = RS_FEED
    if (bestMote >= 0) {
      this.rtx[i] = this.mx[bestMote] as number
      this.rty[i] = this.my[bestMote] as number
    } else {
      const a = this.rwander[i] as number
      this.rtx[i] = x + Math.cos(a) * 600
      this.rty[i] = y + Math.sin(a) * 600
    }
  }

  // -------------------------------------------------------------------------

  private collide(dt: number): void {
    void dt
    this.grid.build(this.mx, this.my, this.malive, MAX_MOTES, this.px, this.py, this.gridSpan)

    const pr = this.playerRTrue
    const res = this.resonance

    // --- player vs motes ---------------------------------------------------
    this.grid.query(this.px, this.py, pr + 90, (i) => {
      if (!this.malive[i]) return
      const v = this.mval[i] as number
      const mr = this.mr[i] as number
      const dx = (this.mx[i] as number) - this.px
      const dy = (this.my[i] as number) - this.py
      const d = Math.hypot(dx, dy)

      if (this.mkind[i] === MK_ANSWER) {
        if (d > pr + mr * 0.45) return
        this.resolveResonance(i)
        return
      }
      // During a Resonance the ordinary field is inert — the arena is holding
      // its breath, and nothing but the four spheres can touch you.
      if (res.active && res.phase >= 1) return

      if (v < 0) {
        if (d > pr + mr * 0.2) return
        if (this.stingGrace > 0) return
        const loss = this.damage(Math.min(this.mass * 0.11, Math.abs(v)))
        this.combo = 0
        this.malive[i] = 0
        this.moteCount--
        this.pvx -= (dx / (d || 1)) * 260
        this.pvy -= (dy / (d || 1)) * 260
        this.stingGrace = 0.30
        this.emit("sting", this.mx[i] as number, this.my[i] as number, loss, v)
        this.host.haptic("failure")
        return
      }

      if (v < this.mass) {
        // Absorb once the mote is meaningfully inside you — the little bit of
        // required overlap is what makes a near-miss feel like a near-miss.
        if (d > pr - mr * 0.35) return
        const gain = absorbGain(v, this.mass)
        this.mass += gain
        this.absorbed++
        this.combo++
        this.malive[i] = 0
        this.moteCount--
        this.emit("absorb", this.mx[i] as number, this.my[i] as number, gain, this.combo)
        if (this.combo % 10 === 0) this.host.haptic("light")
      } else if (this.stingGrace <= 0) {
        // A number too big to swallow. It stings and it takes your combo, and
        // the cost scales with how badly you misread it: brushing something a
        // hair above you is a nick, ploughing into something three times your
        // size is a wound. You are never killed by the field — only by a
        // rival — but a dense field at a flat 19% ground a run to the floor
        // without a single rupture, which read as the game cheating.
        if (d > pr * 0.55 + mr * 0.45) return
        const over = v / Math.max(1, this.mass) - 1
        const rate = Math.min(0.13, 0.035 + over * 0.09)
        const loss = this.damage(Math.min(this.mass * rate, Math.max(1, v * 0.34)))
        this.combo = 0
        this.malive[i] = 0
        this.moteCount--
        this.pvx -= (dx / (d || 1)) * 340
        this.pvy -= (dy / (d || 1)) * 340
        // A brief flinch, so drifting into a cluster costs one mistake and not
        // five in the same tenth of a second.
        this.stingGrace = 0.30
        this.emit("sting", this.mx[i] as number, this.my[i] as number, loss, v)
        this.host.haptic("medium")
      }
    })

    // --- rivals vs motes ---------------------------------------------------
    for (let k = 0; k < MAX_RIVALS; k++) {
      if (!this.ralive[k]) continue
      const m = this.rmass[k] as number
      const rr = R_K * Math.sqrt(m)
      const rxk = this.rx[k] as number
      const ryk = this.ry[k] as number
      this.grid.query(rxk, ryk, rr + 40, (i) => {
        if (!this.malive[i]) return
        if (this.mkind[i] === MK_ANSWER) return
        const v = this.mval[i] as number
        if (v < 0 || v >= m) return
        const dx = (this.mx[i] as number) - rxk
        const dy = (this.my[i] as number) - ryk
        if (Math.hypot(dx, dy) > rr - (this.mr[i] as number) * 0.35) return
        this.rmass[k] = m + absorbGain(v, m)
        this.malive[i] = 0
        this.moteCount--
      })
    }

    // --- cores vs cores ----------------------------------------------------
    if (!(res.active && res.phase >= 1)) {
      for (let k = 0; k < MAX_RIVALS; k++) {
        if (!this.ralive[k]) continue
        const m = this.rmass[k] as number
        const rr = R_K * Math.sqrt(m)
        const dx = (this.rx[k] as number) - this.px
        const dy = (this.ry[k] as number) - this.py
        const d = Math.hypot(dx, dy)

        if (d < Math.max(rr, pr) && this.invuln <= 0) {
          if (this.mass > m * 1.06 && d < pr - rr * 0.5) {
            // You ate a rival. This is the payoff moment of the genre.
            this.mass += devourGain(m, this.mass)
            this.combo++
            this.killRival(k, false)
            this.emit("kill", this.rx[k] as number, this.ry[k] as number, m, this.combo)
            this.emit("shockwave", this.px, this.py, pr * 3.2, 1)
            this.host.haptic("success")
          } else if (m > this.mass * 1.16 && d < rr - pr * 0.8) {
            this.rupture(m)
          }
        }

        // rival vs rival — the world eats itself whether you watch or not
        for (let j = k + 1; j < MAX_RIVALS; j++) {
          if (!this.ralive[j]) continue
          const m2 = this.rmass[j] as number
          const rr2 = R_K * Math.sqrt(m2)
          const ddx = (this.rx[j] as number) - (this.rx[k] as number)
          const ddy = (this.ry[j] as number) - (this.ry[k] as number)
          const dd = Math.hypot(ddx, ddy)
          if (dd > Math.max(rr, rr2)) continue
          if (m > m2 * 1.06 && dd < rr - rr2 * 0.72) {
            this.rmass[k] = m + devourGain(m2, m)
            this.killRival(j, true)
          } else if (m2 > m * 1.06 && dd < rr2 - rr * 0.72) {
            this.rmass[j] = m2 + devourGain(m, m2)
            this.killRival(k, true)
            break
          }
        }
      }
    }
  }

  private killRival(k: number, scatterSome: boolean): void {
    const m = this.rmass[k] as number
    this.emit("rival-death", this.rx[k] as number, this.ry[k] as number, m, this.rleviathan[k] as number)
    if (scatterSome) {
      this.scatter(this.rx[k] as number, this.ry[k] as number, m * 0.22, 5, 150, MK_SHED)
    }
    this.ralive[k] = 0
    this.rleviathan[k] = 0
    this.rhunter[k] = 0
    this.rivalCount--
    this.rrespawn[k] = this.rng.range(1.6, 4.2)
  }

  /**
   * You did not lose. You burst, you scattered most of what you were across
   * the water where anyone can take it, and you re-formed on the spot. There
   * is no modal, no score screen and no menu — the only thing that stops a run
   * is the child putting the tablet down.
   */
  private rupture(byMass: number): void {
    // Growth in this game is the thing you own. A run that can be wiped to
    // nothing by two unlucky seconds is a run a child stops trusting, and the
    // measured failure mode was a death spiral: rupture, respawn next to the
    // same predator, rupture again, and arrive back at the floor with twelve
    // minutes of climbing gone. So the fall is deep but bounded, and the
    // ceiling itself erodes a little each time so repeated carelessness still
    // costs something real.
    // `min(mass, ...)` is load-bearing: without it a high-water mark above your
    // current mass makes a rupture *pay you*, which measured once as 136
    // ruptures and six orders of magnitude of free mass in a single run.
    const hard = Math.min(this.mass, this.checkpoint)
    let target = Math.min(Math.max(hard, this.mass * 0.54), this.mass * 0.92)
    target = Math.max(target, hard)
    const lost = Math.max(0, this.mass - target)
    this.mass = target
    this.ruptures++
    this.combo = 0
    this.invuln = 4.2
    this.scatter(this.px, this.py, lost * 0.7, 9, 260, MK_SHED)
    // Re-forming throws you clear at speed, so the first thing you do after
    // bursting is move, not sit still watching a predator turn around.
    const a = this.rng.range(0, Math.PI * 2)
    this.pvx = Math.cos(a) * 900
    this.pvy = Math.sin(a) * 900
    // Blow the neighbourhood clear. Without this the rival that ate you is
    // still sitting on top of you when the invulnerability ends, and the run
    // dies in a cascade a child can do nothing about.
    for (let k = 0; k < MAX_RIVALS; k++) {
      if (!this.ralive[k]) continue
      const dx = (this.rx[k] as number) - this.px
      const dy = (this.ry[k] as number) - this.py
      const d = Math.hypot(dx, dy) || 1
      const reach = this.playerRTrue * 9 + 500
      if (d > reach) continue
      this.rvx[k] = (dx / d) * 1100
      this.rvy[k] = (dy / d) * 1100
      this.rx[k] = this.px + (dx / d) * Math.max(d, reach * 0.55)
      this.ry[k] = this.py + (dy / d) * Math.max(d, reach * 0.55)
      this.rstate[k] = RS_FLEE
      this.rdanger[k] = 0
    }
    this.emit("rupture", this.px, this.py, lost, byMass)
    this.emit("shockwave", this.px, this.py, this.playerRTrue * 6, 0)
    this.host.haptic("failure")
    if (this.resonance.active) this.closeResonance()
  }

  // -------------------------------------------------------------------------
  // Resonance
  // -------------------------------------------------------------------------

  private stepResonance(dt: number): void {
    const res = this.resonance
    if (!res.active) {
      if (this.time > this.nextResonanceAt && this.invuln <= 0.4) this.openResonance()
      return
    }
    res.t += dt
    if (res.phase === 1 && res.t > 0.55) res.phase = 2
    if (res.phase === 2 && res.t > res.duration) {
      this.emit("resonance-fade", this.px, this.py, 0, 0)
      this.closeResonance()
      return
    }
    if (res.phase === 3 && res.t > res.duration + 0.9) {
      this.closeResonance()
      return
    }

    // The four spheres drift outward and orbit, so a hesitant answer costs
    // distance and the decision has a clock without a countdown bar.
    for (let s = 0; s < 4; s++) {
      const i = res.spheres[s] as number
      if (i < 0 || !this.malive[i]) continue
      const dx = (this.mx[i] as number) - this.px
      const dy = (this.my[i] as number) - this.py
      const d = Math.hypot(dx, dy) || 1
      const drift = res.phase === 2 ? 22 : 0
      const tangent = 0.32
      this.mvx[i] = (dx / d) * drift - (dy / d) * drift * tangent
      this.mvy[i] = (dy / d) * drift + (dx / d) * drift * tangent
      this.mx[i] = (this.mx[i] as number) + (this.mvx[i] as number) * dt
      this.my[i] = (this.my[i] as number) + (this.mvy[i] as number) * dt
      this.mphase[i] = (this.mphase[i] as number) + dt * 2.4
    }
  }

  private openResonance(): void {
    const res = this.resonance
    const diff = Math.max(1, Math.min(10, Math.round(this.depth.difficulty + this.over * 2)))
    let q: Question
    try {
      q = this.host.next({ difficulty: diff })
    } catch (err) {
      console.error("[arena] host.next failed", err)
      this.nextResonanceAt = this.time + 20
      return
    }
    // Four spheres, and the Host is not contractually obliged to supply three
    // distractors. The padding used to be `answer + 1/2/3`, which is not a
    // distractor: for a predicate prompt — "less than 1000", "a factor of 48",
    // "a multiple of 5" — `answer + 1` is frequently ALSO a correct answer, so
    // the game would fly a child into a right answer, call it wrong, and take a
    // quarter of their mass for it. It could also duplicate a real distractor
    // and put the same number on two spheres. A Resonance we cannot pose
    // honestly is one we do not pose: the beat is skipped and comes back in
    // twenty seconds.
    const options = [q.answer]
    for (const d of q.distractors) {
      if (options.length >= 4) break
      if (d !== q.answer && !options.includes(d)) options.push(d)
    }
    if (options.length < 4) {
      this.nextResonanceAt = this.time + 20
      return
    }
    // Claim all four spheres BEFORE committing to the beat.
    //
    // This used to allocate inside the placement loop and `continue` past a
    // failed one — and the `if (slot === 0) res.correctSlot = s` assignment sat
    // at the bottom of that same loop. So if the sphere carrying the answer was
    // the one that could not be allocated, `correctSlot` silently kept the
    // value from the PREVIOUS Resonance and a distractor was judged correct.
    // With MAX_MOTES at 360 and a full field at 259 plus shed motes, rupture
    // scatter and rival-death scatter, an exhausted pool is reachable.
    for (let s = 0; s < 4; s++) {
      const i = this.freeMote()
      if (i < 0) {
        for (let k = 0; k < s; k++) {
          this.malive[res.spheres[k] as number] = 0
          this.moteCount--
        }
        res.spheres.fill(-1)
        this.nextResonanceAt = this.time + 20
        return
      }
      // Claim it now so the next `freeMote()` cannot hand back the same slot.
      this.malive[i] = 1
      this.moteCount++
      res.spheres[s] = i
    }

    const order = this.rng.shuffle([0, 1, 2, 3])

    res.active = true
    res.phase = 1
    res.t = 0
    res.duration = Math.max(6.5, 10.5 - this.resonanceCount * 0.16)
    res.question = q
    res.chosen = -1
    res.openedAt = performance.now()
    this.resonanceCount++

    const ringR = Math.max(viewSpanFor(this.mass) * 0.30, this.playerRTrue * 3.4)
    res.ringR = ringR
    const base = this.rng.range(0, Math.PI * 2)
    res.correctSlot = -1
    for (let s = 0; s < 4; s++) {
      const i = res.spheres[s] as number
      const a = base + (s / 4) * Math.PI * 2
      this.mx[i] = this.px + Math.cos(a) * ringR
      this.my[i] = this.py + Math.sin(a) * ringR
      this.mvx[i] = 0
      this.mvy[i] = 0
      const slot = order[s] as number
      const text = options[slot] as string
      res.labels[s] = text
      // Drawn as a number, reported as `text`. Anything the renderer cannot
      // draw as an int32 is drawn as 0 rather than silently wrapping to a
      // different number, which is the one thing this game must never do.
      const label = Number(text)
      this.mval[i] = Number.isSafeInteger(label) && Math.abs(label) <= 2147483647 ? label : 0
      // Spheres are all the same size — during a Resonance the size cue is
      // deliberately switched off so the answer is the only thing that decides.
      this.mr[i] = Math.max(this.playerRTrue * 0.82, 54)
      this.mkind[i] = MK_ANSWER
      this.mflip[i] = 1
      this.mphase[i] = a
      this.mborn[i] = this.time
      if (slot === 0) res.correctSlot = s
    }
    this.emit("resonance-open", this.px, this.py, ringR, diff)
    this.host.haptic("medium")
  }

  private resolveResonance(moteIndex: number): void {
    const res = this.resonance
    if (!res.active || res.phase !== 2 || !res.question) return
    let slot = -1
    for (let s = 0; s < 4; s++) if (res.spheres[s] === moteIndex) slot = s
    if (slot < 0) return

    const correct = slot === res.correctSlot
    res.phase = 3
    res.t = res.duration
    res.chosen = slot
    res.wasCorrect = correct
    const ms = Math.round(performance.now() - res.openedAt)
    res.answerMs = ms

    try {
      this.host.report({
        questionId: res.question.id,
        correct,
        ms,
        answered: res.labels[slot] ?? "",
      })
    } catch (err) {
      console.error("[arena] host.report failed", err)
    }

    if (correct) {
      this.combo++
      const streak = Math.min(6, this.combo)
      // Capped on purpose. The wave still clears the screen and throws every
      // rival off you — it looks like the biggest thing in the game, because
      // it is — but a right answer may never more than half-again your mass,
      // or the twenty-minute curve collapses into one lucky question.
      const before = this.mass
      // Capped against the same sub-linear ceiling as everything else, or the
      // curriculum beat quietly becomes the exponential the rest of the economy
      // just stopped being.
      const cap = Math.min(before * (0.30 + streak * 0.045), 26 * Math.sqrt(before) + 12)
      let gained = cap * 0.55
      const wave = this.playerRTrue * 7.5
      for (let i = 0; i < MAX_MOTES; i++) {
        if (!this.malive[i] || this.mkind[i] === MK_ANSWER) continue
        const dx = (this.mx[i] as number) - this.px
        const dy = (this.my[i] as number) - this.py
        if (dx * dx + dy * dy > wave * wave) continue
        const v = this.mval[i] as number
        if (v > 0) gained = Math.min(cap, gained + v)
        this.malive[i] = 0
        this.moteCount--
      }
      const gain = gained
      this.mass += gain
      for (let k = 0; k < MAX_RIVALS; k++) {
        if (!this.ralive[k]) continue
        const dx = (this.rx[k] as number) - this.px
        const dy = (this.ry[k] as number) - this.py
        const d = Math.hypot(dx, dy) || 1
        if (d > wave * 1.4) continue
        this.rvx[k] = (dx / d) * 900
        this.rvy[k] = (dy / d) * 900
        this.rstate[k] = RS_FLEE
      }
      this.emit("resonance-hit", this.px, this.py, gain, this.combo)
      this.emit("shockwave", this.px, this.py, wave, 2)
      this.host.haptic("success")
    } else {
      const loss = this.damage(this.mass * 0.24)
      this.combo = 0
      this.emit("resonance-miss", this.mx[moteIndex] as number, this.my[moteIndex] as number, loss, res.correctSlot)
      this.host.haptic("failure")
    }

    // Retire the three unchosen spheres immediately; the correct one lingers
    // for a beat so a child who got it wrong SEES which it was, without ever
    // being told off.
    for (let s = 0; s < 4; s++) {
      const i = res.spheres[s] as number
      if (i < 0) continue
      if (s === res.correctSlot && !correct) continue
      if (s === slot) {
        this.malive[i] = 0
        this.moteCount--
        res.spheres[s] = -1
        continue
      }
      this.malive[i] = 0
      this.moteCount--
      res.spheres[s] = -1
    }
    this.nextResonanceAt = this.time + this.rng.range(21, 29)
  }

  private closeResonance(): void {
    const res = this.resonance
    for (let s = 0; s < 4; s++) {
      const i = res.spheres[s] as number
      if (i >= 0 && this.malive[i]) {
        this.malive[i] = 0
        this.moteCount--
      }
      res.spheres[s] = -1
    }
    res.active = false
    res.phase = 0
    res.question = null
    if (this.nextResonanceAt <= this.time) this.nextResonanceAt = this.time + this.rng.range(21, 29)
  }

  // -------------------------------------------------------------------------

  private maintain(dt: number): void {
    void dt
    const span = viewSpanFor(this.mass)
    const cullR = span * 1.65

    // Retire motes that have fallen far behind, and only then top up, so the
    // population is stable and the field around the player is always fresh.
    for (let i = 0; i < MAX_MOTES; i++) {
      if (!this.malive[i] || this.mkind[i] === MK_ANSWER) continue
      const dx = (this.mx[i] as number) - this.px
      const dy = (this.my[i] as number) - this.py
      if (dx * dx + dy * dy > cullR * cullR) {
        this.malive[i] = 0
        this.moteCount--
        continue
      }
      // A shed mote is a temporary thing; it decays so the field cannot silt up.
      if (this.mkind[i] === MK_SHED && this.time - (this.mborn[i] as number) > 14) {
        this.malive[i] = 0
        this.moteCount--
      }
    }

    // Light mutual separation. Without it motes drift into stacks and the
    // numerals — the one thing that must stay readable — pile on top of each
    // other four deep.
    this.grid.build(this.mx, this.my, this.malive, MAX_MOTES, this.px, this.py, this.gridSpan)
    for (let i = 0; i < MAX_MOTES; i++) {
      if (!this.malive[i] || this.mkind[i] === MK_ANSWER) continue
      const xi = this.mx[i] as number
      const yi = this.my[i] as number
      const ri = this.mr[i] as number
      this.grid.query(xi, yi, ri * 2.1, (j) => {
        if (j <= i || !this.malive[j] || this.mkind[j] === MK_ANSWER) return
        const dx = (this.mx[j] as number) - xi
        const dy = (this.my[j] as number) - yi
        const want = (ri + (this.mr[j] as number)) * 1.02
        const d2 = dx * dx + dy * dy
        if (d2 >= want * want || d2 < 1e-4) return
        const d = Math.sqrt(d2)
        const push = ((want - d) / want) * 34
        const nx = dx / d
        const ny = dy / d
        this.mvx[i] = (this.mvx[i] as number) - nx * push
        this.mvy[i] = (this.mvy[i] as number) - ny * push
        this.mvx[j] = (this.mvx[j] as number) + nx * push
        this.mvy[j] = (this.mvy[j] as number) + ny * push
      })
    }

    const want = Math.round(this.spec.motes * this.depth.density)
    let guard = 40
    while (this.moteCount < want && guard-- > 0) this.spawnMote(false)

    // Rivals that wander out of the world get recycled near you.
    for (let k = 0; k < MAX_RIVALS; k++) {
      if (!this.ralive[k]) continue
      const dx = (this.rx[k] as number) - this.px
      const dy = (this.ry[k] as number) - this.py
      const far = span * (this.rleviathan[k] ? 3.4 : 2.5)
      if (dx * dx + dy * dy > far * far) {
        this.ralive[k] = 0
        this.rleviathan[k] = 0
        this.rhunter[k] = 0
        this.rivalCount--
        this.rrespawn[k] = this.rng.range(0.5, 1.8)
      }
      // A rival that outgrows the ladder leaves; otherwise one lucky bot
      // snowballs off the top of the board and the run becomes unwinnable.
      if (this.ralive[k] && !this.rleviathan[k] && (this.rmass[k] as number) > this.mass * 2.6) {
        this.ralive[k] = 0
        this.rhunter[k] = 0
        this.rivalCount--
        this.rrespawn[k] = this.rng.range(0.8, 2.0)
        continue
      }
      // A rival that has been starved into irrelevance is recycled too.
      if (this.ralive[k] && (this.rmass[k] as number) < this.mass * 0.06 && this.mass > 120) {
        this.ralive[k] = 0
        this.rivalCount--
        this.rrespawn[k] = this.rng.range(1, 2.5)
      }
    }

    if (this.rivalCount < this.spec.rivals) this.spawnRival(false)

    if (this.depth.leviathan) {
      let has = false
      for (let k = 0; k < MAX_RIVALS; k++) if (this.ralive[k] && this.rleviathan[k]) has = true
      if (!has && this.rng.chance(0.004)) this.spawnLeviathan()
    }
  }

  /**
   * The top `out.length` cores by mass, player included. Selection is a
   * bounded insertion into an already-sorted window, so it is allocation-free
   * and it is actually the *top* n — the first cut of this took the first n
   * live rivals, and the board cheerfully disagreed with the rank readout
   * sitting four inches away from it.
   */
  leaderboard(out: Int32Array, outMass: Float32Array): number {
    const cap = out.length
    let n = 0
    const consider = (idx: number, mass: number): void => {
      if (n < cap) {
        let j = n - 1
        while (j >= 0 && (outMass[j] as number) < mass) {
          out[j + 1] = out[j] as number
          outMass[j + 1] = outMass[j] as number
          j--
        }
        out[j + 1] = idx
        outMass[j + 1] = mass
        n++
        return
      }
      if (mass <= (outMass[cap - 1] as number)) return
      let j = cap - 2
      while (j >= 0 && (outMass[j] as number) < mass) {
        out[j + 1] = out[j] as number
        outMass[j + 1] = outMass[j] as number
        j--
      }
      out[j + 1] = idx
      outMass[j + 1] = mass
    }
    for (let k = 0; k < MAX_RIVALS; k++) {
      if (!this.ralive[k]) continue
      consider(k, this.rmass[k] as number)
    }
    consider(-1, this.mass)
    return n
  }

  rank(): number {
    let r = 1
    for (let k = 0; k < MAX_RIVALS; k++) if (this.ralive[k] && (this.rmass[k] as number) > this.mass) r++
    return r
  }
}

export const RIVAL_NAMES = [
  "VELA", "NYX", "ORRA", "SILT", "KELP", "MURK", "TIDE", "GLOW",
  "HUSK", "BRINE", "PALE", "COIL", "DRIFT", "SPUR", "FATHOM", "REEF",
  "LUMEN", "GYRE", "SHOAL", "TROUGH", "CRESS", "VENT", "ABYSS", "SALT",
  "OBOL", "NEAP", "SWELL", "RIME", "CALM", "FLUKE", "GHOST", "SPUME",
  "HALO", "NODE", "PRISM", "QUELL", "RUNE", "SABLE", "THORN", "UMBRA",
  "VOLT", "WRACK", "XENON", "YARROW", "ZEPHYR", "ARGON", "BASALT", "CINDER",
  "DELTA", "EMBER", "FLINT", "GRAIL", "HOLLOW", "IRIS", "JETSAM", "KRILL",
  "LATCH", "MIRE", "NIMBUS", "ONYX", "PLUME", "QUARTZ", "RIPTIDE", "SIREN",
]
