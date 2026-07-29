import {
  SECOND_GRADE_FLOW,
  countAt,
  curved,
  observe,
  quickness,
  revealMs,
  rungAt,
  seedSuccess,
  settle,
  valueAt,
} from "../../../../packs/shared/game-pacing/index.ts"
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
 * THE BREATH.
 *
 * ARENA had no adaptation of any kind. Density, rival count, speed and question
 * difficulty were all functions of the DEPTH, the depth was a ratchet that can
 * only ever go up, and the ratchet was driven by the clock and by mass. Nothing
 * anywhere in this file asked whether the child was getting the maths right.
 * Measured on the first frame of a seeded mid-tier run: 155 motes and 16
 * rivals, which are the same counts the twentieth minute carries. There was no
 * onset, and there was no way back down.
 *
 * So one number now drives density, rival count, player speed, void rate,
 * hunter budget, question difficulty and how long a question stays open — all
 * of it, together, in both directions. Struggle and the whole world breathes
 * out. Succeed for a while and it leans in. The controller is shared rather
 * than local (`packs/shared/game-pacing`) because every game in this catalogue
 * wants exactly this and none of them should re-derive it.
 *
 * The depth ratchet is deliberately left alone. It still runs the palette, the
 * water and the leviathan, because "how deep this run has been" is a record and
 * a record should not un-happen. What it no longer runs is anything a child has
 * to compute against.
 */
const FLOW = SECOND_GRADE_FLOW

/**
 * Motes and rivals at the floor of the breath, as a fraction of the tier's
 * ceiling.
 *
 * A quarter of the rivals, a third of the motes. Both were chosen against a
 * measured ON-SCREEN count rather than against the pool size, because the pool
 * is spread over a disc of 1.65 view-spans and only a fixed fraction of it is
 * ever in frame: the old field put ~15 motes on a phone held tall and 35-70 on
 * a tablet held wide, in the FIRST FIFTEEN SECONDS. A third takes the tablet's
 * opening frame from seventy numbers to about twenty-three, which is a field a
 * seven-year-old can actually read.
 */
const MOTE_FLOOR = 0.45
const RIVAL_FLOOR = 0.28

/**
 * Rungs on the difficulty ladder ARENA hands the Host.
 *
 * The ladder itself is the curriculum's, not this file's: `host.next` takes a
 * difficulty in 1..10 and the Host decides what that means. ARENA's job is only
 * to stand on the right rung, which is why the mapping goes through the shared
 * `rungAt` — with hysteresis, so a difficulty sitting on a band edge cannot
 * hand a child alternating easy and hard questions.
 *
 * What rung 1 actually *contains* is content, not tuning. Today the active
 * curriculum's easiest generator starts at two-digit + two-digit, so the bottom
 * of this ladder is currently clamped by what exists rather than by anything
 * here. When the first-grade fact spine lands, this reaches down to it with no
 * change to this file.
 */
const DIFFICULTY_RUNGS = 10

/**
 * THE QUIET TIDE, and why the world's pace is not simply the breath.
 *
 * A Resonance can be ignored. Miss one and it times out, nothing is reported,
 * and the controller — which is fed by answers and by nothing else — never
 * moves. Drive that to its conclusion and a child who only wants to swim spends
 * twenty minutes in a four-rival ocean that never builds. Measured exactly
 * that: a bot that hunts rivals and never answers a question peaked at mass 60
 * in twenty minutes.
 *
 * So the two things the intensity drives are separated, and the split is the
 * honest one:
 *
 *   * The MATHS — which rung of the ladder, how long a question stays open —
 *     follows the breath alone, and falls all the way to the bottom. Nothing a
 *     clock does may make a struggling child's questions harder.
 *
 *   * The WORLD — density, rivals, speed, growth, the temper of the water —
 *     follows whichever is higher, the breath or this tide. A long run fills up
 *     whether or not anybody is answering, which is the escalation a growth game
 *     needs, and answering well still gets there far sooner.
 *
 * Capped at half, so the tide alone never delivers the mayhem. The top half of
 * the world is earned.
 */
const QUIET_TIDE_SECONDS = 420
const QUIET_TIDE_CEILING = 0.62

/**
 * The largest any rival may be, as a multiple of the player's mass.
 *
 * Stated as a multiple of mass but DERIVED from the screen, which is the only
 * place the constraint actually lives. Radius is `R_K * sqrt(mass)` and the
 * view is `11 * R_K * sqrt(mass) + 520`, so once the constant term stops
 * mattering a rival at `k` times your mass has
 *
 *     diameter / viewport width = 2*sqrt(k) / (11 * aspect)
 *
 * and the worst aspect we ship into is a phone held tall, 1080x2340, where
 * `aspect` is 0.4615. That makes the fraction `0.394 * sqrt(k)`:
 *
 *     k = 2.6  ->  0.63 of the width      k = 4.0  ->  0.79 of the width
 *
 * So an ordinary rival may reach two thirds of the narrow dimension and a
 * leviathan four fifths. Both are enormous. Neither can enclose a child, which
 * is the whole difference between a threat and a coin flip.
 */
const RIVAL_MAX_RATIO = 2.6
const LEVIATHAN_MAX_RATIO = 4.0

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
 *
 * **They were fitted against the wrong objective, and this is the deepest of
 * the founder's complaints.** At 0.62 / 0.60 a seeded run measured
 *
 *     t=5s  mass 104   t=15s  mass 537   t=30s  mass 1,771   t=60s  mass 2,624
 *
 * — the player's own number is four digits before the first minute is out, and
 * the numbers in the water with it are four and five digits from then on. The
 * pack declares `dw.ns.compare.whole-numbers`, whose generator poses 3-digit
 * comparisons at its first two levels and does not reach 5 digits until its
 * fourth. So the arena was spending twenty-nine seconds in the range the
 * curriculum starts at and the following twenty minutes past the range it ends
 * at. As the founder put it: "5000 versus 8000 in like 2 minutes". Reading
 * 3,418 against 3,481 is genuinely the declared skill; arriving there in half a
 * minute and never coming back is not.
 *
 * Both numbers matter and they do different jobs.
 *
 *   FOOD_A scales the whole curve down. Because the field's own size scales
 *   with the player, the eat RATE goes as M^-0.35 and the gain per mote as
 *   M^FOOD_B, so dM/dt is proportional to M^(FOOD_B - 0.35) and the solution is
 *   a power of t. A slows the clock on the whole climb without touching shape.
 *
 *   FOOD_B is the shape, and it is the one that decides whether the twelfth
 *   minute is still a maths game. At 0.60, dM/dt goes as M^0.25 and mass runs
 *   as t^(4/3) — super-linear, so the run accelerates away from the curriculum
 *   forever. At 0.50 the exponent is 0.15 and mass runs as t^1.18: very nearly
 *   linear, which is a climb a child can stay inside.
 *
 * A moved 0.62 -> 0.40 when the curve was first refitted and 0.40 -> 0.16 when
 * absorption was made exact, and the second cut is not a second opinion about
 * pace: a mote used to be worth `v / (1 + 6v/M)` and is now worth `v`, so the
 * same table of numbers feeds a player two to six times faster than it did.
 * The constant fell to keep the CURVE where it already was. Measured, mid tier,
 * four seeds, median, at 15s / 60s / 2min / 5min / 10min / 20min:
 *
 *   struggling      before  47 / 300 / 752 / 1,294 / 1,261 / 1,241
 *                   after   65 / 352 / 441 /   683 / 1,700 / 1,853
 *   answering well  before  47 / 1,044 / 11,422 / 42,909 / 130,137 / 258,477
 *                   after   65 /   742 /  2,703 / 28,709 / 103,960 / 255,153
 *
 * — the same bands, in the same minutes, with the arithmetic on screen true.
 * See `sim.test.ts`, which asserts the bands rather than the numbers.
 */
const FOOD_A = 0.16
const FOOD_B = 0.50

/**
 * How much of a mote becomes you: ALL of it. Eat a `4`, gain exactly 4.
 *
 * This function used to saturate. A mote's number was treated as a SIZE and not
 * as an addend — a fish that swallows a fish nearly its own size does not double
 * — so swallowing a `4` at mass 10 was worth `+1`, and the running equation
 * printed `10 + 1 = 11` under a numeral a child had just watched read `4`. The
 * founder's ruling, and it is the right one twice over:
 *
 *   "it would seem more intuitive to me to absorb the exact number? ... is that
 *    not how most games like this work?"
 *
 * In the genre you absorb what you ate. And in THIS product a maths game may not
 * put an equation on screen that is not the one it performed: `10 + 4` has to
 * be `14`, and the only way to make the ribbon true is to make the simulation
 * do what the ribbon says. Absorption is now the identity, forever, and nothing
 * may be added to it.
 *
 * The saturation was not decoration — it was the only thing holding the economy
 * down, because it is the near-tie mote (worth ~M) that compounds. That job has
 * moved to `NEAR_PRIZE` below, where it belongs: not "you get less than you
 * ate", but "there is less of it to eat". Metering the SUPPLY is honest;
 * metering the ARITHMETIC is not.
 *
 * `Math.round` is defensive only. `mval` is an Int32Array, so every value that
 * reaches here is already an integer, and it must stay one: the ribbon's terms
 * are integers and this is the number that lands between them.
 */
export function absorbGain(value: number): number {
  if (value <= 0) return 0
  return Math.round(value)
}

/**
 * PLACEHOLDER
 *
 * About one mote in twelve is drawn from a band straddling your own mass,
 * because telling 3,418 from 3,481 at speed IS the declared skill and the band
 * is where that reading happens. Most of it is a wall. The sliver below your
 * mass is the prize, and a prize worth ~M added exactly is a DOUBLING: repeat
 * it and mass is exponential in the number of motes eaten, with no polynomial
 * anywhere to save it. Measured, with absorption made exact and this band left
 * alone: 27,494,014 at two minutes against 12,738 before, and 189,893,983 by
 * twenty. Eight digits on the player's own core ends the game the pack is for.
 *
 * So the prize gets rarer exactly as fast as it gets bigger. The edible sliver
 * is `NEAR_PRIZE / sqrt(mass)` of the band, which makes its contribution to
 * growth `p * M ∝ sqrt(M)` — the same shape as the crumb economy, which is what
 * keeps the whole curve polynomial. At mass 10 roughly a quarter of the near-tie
 * band is edible; at mass 10,000, one in four hundred.
 *
 * What does NOT change is how often the band appears. The READING is the
 * pedagogy and it keeps its full frequency; what tapers is how often the answer
 * to "can I eat this?" is yes. That asymmetry is also the honest picture of the
 * genre: the bigger you are, the less there is anywhere near your size that is
 * beneath you.
 */
const FOOD_MIN = 1
const PRIZE_RATE = 0.8
const PRIZE_RATE_EXP = 0.85
const PRIZE_RATE_MAX = 0.005

/**
 * THE WALLS, and why they are not a bank account.
 *
 * One mote in seven is drawn at or above your own mass. That band is where the
 * declared skill lives — telling 3,418 from 3,481 at speed, deciding in half a
 * second whether the thing in front of you is beneath you — and a growth arena
 * with nothing in it to flee is a screensaver. So it keeps its full frequency,
 * at every size, forever.
 *
 * What it does NOT keep is the right to become a meal. A wall is only a prize
 * with a delay on it: grow five per cent and the 1.05x you swam around thirty
 * seconds ago is a hundred-per-cent breakfast, free, at no risk, available
 * continuously because the field manufactures walls forever. Under the old
 * saturating curve that was worth a seventh of you and nobody noticed. With
 * absorption exact it is the single largest term in the economy and it is a
 * repeated doubling — it is most of the 100,000-in-sixty-seconds measured
 * above.
 *
 * So a wall stays a wall for as long as it lives, and when you finally outgrow
 * it, it comes apart: it bursts into crumbs on the ordinary food scale, which
 * you can then eat, each one worth exactly what it says. The genre's best
 * moment — watching the world turn into food underneath you — is kept, and it
 * is kept as an event rather than as a jackpot.
 */
const WALL_RATE = 0.14
/** Of the walls, how many are the near-tie rather than the far threat. */
const WALL_NEAR_SHARE = 0.57
/** Crumbs a burst wall leaves behind, and the food scales each is worth. */
const WALL_SHARDS = 4
const WALL_SHARD_SCALE = 0.8

/**
 * The most a void may be worth, as a fraction of your mass.
 *
 * This used to be a clamp on the DAMAGE — `min(mass * 0.11, |v|)` — which meant
 * a void wearing `−40` could take 11 off you, and the ribbon then printed
 * `100 − 11 = 89` under a numeral that plainly said 40. Same lie as the mote,
 * so it gets the same fix: the cap moves onto the LABEL, the loss is exactly
 * the label, and the hit a child actually takes is unchanged to the unit.
 */
const VOID_MAX_FRACTION = 0.11

/**
 * Swallowing a rival is worth exactly the rival, and this was the one call in
 * the pass that could honestly have gone either way.
 *
 * It used to saturate at `DEVOUR_K = 2.6` — something your own size was worth
 * about a third of you — and the argument for keeping that was that a rival is
 * "a creature you burst", not a labelled quantity you add. That argument does
 * not survive looking at the screen. `gfx.ts` draws `Math.round(rmass[k])` on
 * every core big enough to carry a numeral, so a rival IS a number in the
 * water, read the same way and against the same law of radius; eat the one
 * wearing `300` at mass 400 and the old code put `400 + 84 = 484` in the ribbon
 * under a numeral that plainly said 300. That is the founder's complaint word
 * for word, applied to a core instead of a mote, and there is no principled
 * place to stop it at the mote.
 *
 * What made it *safe* to make exact is the thing the old comment already had
 * right, and it is the same thing that governs the mote economy after this
 * pass: a rival is a rationed supply and a mote is not. There are at most
 * MAX_RIVALS of them, they respawn on a timer, and one is only edible below
 * `mass / 1.06` — so a kill can never more than 1.94x you and the world, not
 * an arithmetic fudge, decides how often you get one.
 *
 * Measured against the bot that hunts nothing but the largest legally edible
 * rival for twenty minutes, answering every question correctly, over three
 * seeds: saturating peaked at 97,715 / 139,611 / 156,320; exact peaks at
 * 125,210 / 701,405 / 230,764. Six digits at the very top of the strongest
 * possible play, which is the legibility contract this file has always held —
 * and 1.3x to 5x the old numbers, which is what an honest doubling costs.
 *
 * Rival-versus-rival is now conserving: the winner becomes exactly the two of
 * them. That is also the honest picture, and the size recycler still caps any
 * core at RIVAL_MAX_RATIO of the player, so it cannot fill the screen.
 */
export function devourGain(rivalMass: number): number {
  if (rivalMass <= 0) return 0
  return Math.round(rivalMass)
}
const MAX_RIVALS = 26
const MAX_EVENTS = 96

/**
 * World units of view across the screen's HEIGHT — `gfx.worldPerPx` divides by
 * the canvas height, so on a phone held tall this is the LONG dimension and the
 * width is only `span * aspect`, which on a 1080×2340 is 0.46 of it.
 *
 * The constant term is the opening's whole sense of space. At 150 a run began
 * with a 463-unit view and a 28-unit player: 16 player-radii of visible world,
 * crossed at 2.44 screen-widths per second. There was nowhere to be. At 520 the
 * opening view is 833 units — 29 player-radii — and by mass 1,000 the term is a
 * 10% correction, so this buys room exactly where a child needs it and costs
 * nothing once they are large.
 */
export function viewSpanFor(mass: number): number {
  return R_K * Math.sqrt(mass) * 11 + 520
}

/**
 * How many view-spans of world lie between the player and the membrane.
 *
 * "Why is there an edge of the board?" — because there was one, five seconds
 * away. `arenaRadiusFor` used to be `max(2600, span * 3.4)`, and at the
 * starting mass the `max` chose the constant: a 2,600-unit pond around a
 * 463-unit view. Measured: swimming in one straight line from the centre, the
 * wall arrived after 4.77 seconds. A child finds that inside their first
 * attempt at moving.
 *
 * The membrane is kept, and only kept, because positions live in Float32Array
 * and an unbounded world eventually loses sub-unit precision. Ninety spans puts
 * the wall over three minutes of dead-straight swimming away at the open, and
 * further at every larger size, so it bounds the coordinates without ever being
 * a thing a child can play against. Thirty was the first number tried and the
 * test below found the wall at 63.9 s — long, but not longer than a determined
 * nine-year-old.
 */
const ARENA_SPANS = 90

export function radiusForValue(v: number): number {
  return Math.max(MOTE_MIN_R, R_K * Math.sqrt(Math.abs(v)))
}

export function arenaRadiusFor(mass: number): number {
  // Proportional to the view at every size, with no constant floor. The floor
  // was the bug: it made the arena a fixed pond that the opening view was small
  // enough to cross.
  return viewSpanFor(mass) * ARENA_SPANS
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
   * The same instant on the SIMULATION clock.
   *
   * `openedAt` is `performance.now()` and must stay that way: the Host's
   * mastery model wants the real seconds a real child took. But the moment
   * latency also began steering the difficulty controller, wall time became an
   * INPUT to the simulation — and a run seeded with `?seed=` stopped being
   * reproducible, because the same seed on a slower machine took a different
   * ladder. Anything that feeds the world reads this instead.
   */
  openedT: number
  /**
   * Seconds the player cannot avoid spending TRAVELLING to an answer.
   *
   * In ARENA committing to an answer is swimming into a sphere, and the spheres
   * sit `ringR` away, so the fastest possible answer still takes real time —
   * measured between 0.62 s and 1.35 s depending on size, because `stepPlayer`
   * floors the traversal speed at `ringR / 1.35`.
   *
   * That component is part of what a child DID, so it stays in the latency
   * reported to the Host: `ms` is the honest observable, from the moment the
   * question was readable to the moment it was committed. It is NOT part of what
   * a child THOUGHT, so the difficulty controller — which is trying to tell
   * "already knew it" from "worked it out" — subtracts it. Without that, the
   * same three seconds of thinking scores as brisk at mass 10 and as laboured at
   * mass 20,000, purely because the arena got bigger.
   */
  reachSeconds: number
  /**
   * Deliberation, in seconds, frozen at the moment of the answer — the number
   * the difficulty controller was actually handed.
   *
   * Kept beside `answerMs` rather than derived from it because the two are
   * deliberately different quantities, and a test that recomputes the
   * subtraction itself is a test that passes when the subtraction is deleted.
   */
  thinkSeconds: number
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

  // -- the breath ---------------------------------------------------------
  /**
   * How hard the world is pushing, 0..1. Drives density, rivals, speed, void
   * rate, hunters, question difficulty and question duration — all of it, at
   * once, so escalation reads as one thing rather than as six.
   */
  intensity = FLOW.start
  /** Smoothed estimate of how the child is doing. Never rendered anywhere. */
  success = seedSuccess(FLOW)
  /** The rung of the difficulty ladder currently stood on, 0-based. */
  rung = rungAt(FLOW.start, DIFFICULTY_RUNGS)

  // -- the running equation -----------------------------------------------
  /**
   * The last piece of arithmetic that happened to the player, as three integers
   * that are exactly consistent: `eqA + eqD === eqC`, always.
   *
   * Consistency is the whole point and it is why these are integers rather than
   * the floats the simulation runs on. `Math.round(before)`, `Math.round(delta)`
   * and `Math.round(after)` do not have to agree — 10.4 + 4.4 = 14.8 rounds to
   * "10 + 4 = 15" — and a maths product may not print a sum that is false. So
   * the ends are rounded and the middle is DERIVED from them.
   */
  eqA = Math.round(START_MASS)
  eqD = 0
  eqC = Math.round(START_MASS)
  /** Bumped whenever the three above change, so a HUD can tell new from same. */
  eqSeq = 0

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
  /**
   * Born at or above the player's mass, and therefore never food. See WALL_RATE.
   * A wall keeps its number and its menace for as long as it lives; outgrowing
   * one bursts it into crumbs rather than handing you a free doubling.
   */
  readonly mwall = new Uint8Array(MAX_MOTES)
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
    openedT: 0,
    reachSeconds: 0,
    thinkSeconds: 0,
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

  /**
   * Motes the world wants alive right now.
   *
   * Three factors, and the order of the words matters: the TIER says what this
   * machine can draw, the DEPTH says what this band of the water is like, and
   * the ONSET says how far into the run we are. Only the third is new, and it
   * is the one the founder was missing.
   */
  get moteBudget(): number {
    const ceiling = Math.round(this.spec.motes * this.depth.density)
    return countAt(this.worldIntensity, Math.round(this.spec.motes * MOTE_FLOOR), ceiling, "gentle")
  }

  /**
   * How hard the WORLD is pushing: the breath, or the quiet tide, whichever is
   * higher. Everything except the maths reads this rather than `intensity`.
   */
  get worldIntensity(): number {
    const tide = QUIET_TIDE_CEILING * curved(Math.min(1, this.time / QUIET_TIDE_SECONDS), "gentle")
    return Math.max(this.intensity, tide)
  }

  /**
   * Rivals the world wants alive right now.
   *
   * Floored at two rather than at the fraction alone: a growth arena with one
   * other creature in it is not an arena, and the ladder — which is the entire
   * reason to keep playing — needs somebody on it.
   */
  get rivalBudget(): number {
    const open = Math.max(2, Math.round(this.spec.rivals * RIVAL_FLOOR))
    return countAt(this.worldIntensity, open, this.spec.rivals, "gentle")
  }

  /**
   * How much of the depth's aggression the breath is currently letting through.
   *
   * The depth ratchets and cannot fall; this can, and it is what lets a
   * struggling child's water genuinely calm down rather than merely hand them
   * easier questions inside the same storm. Floored at a quarter so the world
   * never becomes inert — an arena with nothing to be afraid of is not an
   * arena, it is a screensaver.
   */
  private get pressure(): number {
    return valueAt(this.worldIntensity, 0.25, 1, "settle")
  }

  /** Void motes as a fraction of the field, after the breath. */
  get voidRate(): number {
    return this.depth.voidRate * this.pressure
  }

  /** Rivals allowed to lock on and pursue, after the breath. */
  get hunterBudget(): number {
    return Math.round(this.depth.hunters * this.pressure)
  }

  /**
   * Seconds a Resonance stays open — and the reason it is a curve rather than a
   * constant is the most important pacing decision in this file.
   *
   * It was `max(6.5, 10.5 - resonanceCount * 0.16)`: a window that shrank
   * toward six and a half seconds for EVERY player, regardless of whether they
   * were keeping up. That is a countdown imposed on a child, and a countdown
   * imposed on a child is the thing that converts arithmetic into guessing.
   *
   * The founder's rule is that time should be measured and REWARDED, never
   * used to cause anxiety: "I like infinite time to think in most cases ... we
   * can usually measure, pace and reward, not cause anxiety". So the clock is
   * something a player EARNS by demonstrating they are comfortably fast.
   *
   *   at the floor    26 s — three times the curriculum's own p50 for this
   *                          skill, which is as close to "unlimited" as ARENA
   *                          can honestly offer
   *   mid-ladder      20 s — still nowhere near pressure
   *   at the ceiling   6 s — a real countdown, and the player climbed here
   *
   * `gentle` is what makes that true: two thirds of the way up the ladder the
   * window is still over sixteen seconds. A struggling child never meets a
   * clock. A mathlete opts into one by being visibly ready for it.
   *
   * It is not literally unbounded, and the reason is structural rather than
   * pedagogical: the arena holds its breath during a Resonance — nothing can
   * touch you and you cannot eat — so a window that never closes is a game that
   * never resumes for a player who put the tablet down mid-question. What the
   * floor gives instead is a window nobody working at this level will ever
   * reach the end of, and no visible clock at all (see `sphereDrift`).
   *
   * It reads `intensity`, not `worldIntensity`: the quiet tide may fill the
   * ocean up around a player who is not answering, but it may never put them
   * on a clock they did not earn.
   */
  get resonanceSeconds(): number {
    return valueAt(this.intensity, 26, 6, "gentle")
  }

  /**
   * How fast the four spheres drift outward while a question is open.
   *
   * The other clock, and the one that was invisible as a clock. At a flat 22
   * units a second the answer physically walked away from a hesitating child,
   * so "a hesitant answer costs distance" was a countdown wearing a different
   * hat. It is now earned on exactly the same terms as the window: zero at the
   * floor, so a child may think for as long as they like with the answer
   * staying where they found it.
   */
  get sphereDrift(): number {
    return valueAt(this.intensity, 0, 22, "gentle")
  }

  /**
   * How fast the player's own number is allowed to grow, as a fraction of full.
   *
   * The founder: "we meant to start in the first grade range of numbers and
   * ramp into 3rd and 4th really as the sweet spot. we go from 10 to >1000 in
   * minutes .. it should start with 1,2,3 and really get into the 2nd and 3rd
   * grade for a while."
   *
   * Sparser water and a gentler food curve slow the climb for everybody; this
   * is what makes the climb *earned*. At the floor of the breath a run creeps,
   * so the numbers a child is comparing stay small while they are finding their
   * feet. Answer well and the world lets you grow into three digits, and then
   * four. The digits are the reward, which is the right way round — they used
   * to be a side effect of the clock.
   *
   * **It applies to the MOTE economy and to nothing else**, and the first cut of
   * this got that wrong. Scaling the kill and the right answer down with it took
   * the two deliberate payoff moments of the game and made them small at exactly
   * the moment a player most needs them to be large; measured, a bot that hunts
   * nothing but rivals for twenty minutes peaked at mass 58 instead of several
   * thousand, because a kill was worth 8% of it rather than 28%. Motes are the
   * continuous supply and therefore the right place to meter the climb. A kill
   * and a correct answer are events, they are rare, and they pay in full.
   */
  private get growth(): number {
    // `intensity`, not `worldIntensity`. The quiet tide may fill the ocean up
    // around a player who is not answering — a growth game has to escalate —
    // but it may not inflate the NUMBERS they are being asked to read. The
    // digits on the field track the player's own mass, so this is the line
    // that keeps a struggling child in two and three figures for as long as
    // they need, however long the run has been going.
    return valueAt(this.intensity, 0.60, 1, "settle")
  }

  /**
   * Seconds the finished sum is held in front of the player after a miss.
   *
   * The teaching moment, and at the bottom of the range it may be the only
   * channel that is working: a child who is not producing answers is still
   * absorbing numerals, symbols and the shape of an equation resolving. So the
   * arena completes the sum for them, calmly, for as long as it takes to read —
   * and shorter and shorter as they climb, until a player in wizard mode is not
   * held at all. Skipping it is the reward for not needing it.
   *
   * It is never inside an answering window. The answer is already given; this
   * hold costs the child nothing.
   */
  get revealSeconds(): number {
    return revealMs(FLOW, this.intensity) / 1000
  }

  /**
   * The player's ordinary top speed, before any Resonance traversal floor and
   * before the surge multiplier.
   *
   * Extracted so `openResonance` can compute the traversal floor from the same
   * arithmetic `stepPlayer` uses. Two copies of this drifted apart once already.
   */
    // Agar's law: mass costs agility. Without this, growth has no downside and
    // the whole genre collapses into a farming sim.
    // Size buys momentum, not top speed denial: a leviathan crosses the water
    // quickly and turns like a barge. Making size cost *agility* rather than
    // *speed* is what keeps the twelfth minute from becoming a slow crawl
    // across an empty screen, while still letting a minnow dance out of reach.
    //
    // The two numbers were tuned in world units, where 520 looks brisk. In
    // SCREEN units they were the founder's "the character zips too fast it's
    // hard to control": at the starting mass, 520 with an exponent of 0.30 was
    // 1.13 screen-heights per second and 2.44 screen-WIDTHS per second on a
    // phone held tall — the width of the glass crossed in 0.41 s, before the
    // surge multiplier. Worse, it was the FASTEST the game ever was in screen
    // terms. By mass 20,000 the same formula gives 0.12 screen-heights per
    // second, a nine-fold swing, and it ran the wrong way round: hardest to
    // control in the first ten seconds, sluggish by the twentieth minute.
    //
    // 520 -> 400 slows the opening. 0.30 -> 0.42 gives size more of its speed
    // back, which flattens the swing to 3.7x and leaves Agar's law intact —
    // mass still costs agility, below, which is where "majestic" actually comes
    // from. Measured, with the wider opening view: 0.48 screen-heights per
    // second at the start (was 1.13) and 0.13 at mass 20,000 (was 0.12).
  get playerSpeed(): number {
    const r = this.playerRTrue
    return 400 * Math.pow(Math.max(18, r) / 28, 0.42)
  }

  /** The largest rival `k` may be before the world recycles it. */
  private rivalCeiling(k: number): number {
    return this.rleviathan[k] === 1 ? LEVIATHAN_MAX_RATIO : RIVAL_MAX_RATIO
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
  private damage(loss: number, ledger = true): number {
    const before = this.mass
    const floor = Math.min(before, this.checkpoint)
    const raw = before - loss
    this.mass = Math.max(floor, raw)
    if (ledger) this.note(before)
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

  /**
   * Record one change to the player's mass as an equation a child can read.
   *
   * The founder's idea, and it is the best one in the batch: "an animation of
   * the math as we 'eat' numbers ... 10 + 4 = 14 / 14 + 10 = 24 / 24 - 5 = 19".
   * It turns eating numbers into arithmetic that is visible and reviewable
   * instead of implicit.
   *
   * **It shows the TRUE change, and the true change is now the number printed
   * on the thing you ate.** This comment used to say the opposite, and it was
   * right about the rule and wrong about the fix: absorption saturated, so a
   * `4` at mass 10 was worth +1, and the ribbon printed "10 + 1 = 11" — a true
   * sentence about a game that had done something a child could not see. The
   * founder's ruling reversed it. `absorbGain` is the identity, `devourGain` is
   * the identity, a void costs exactly the number it wears, and the ribbon now
   * reads "10 + 4 = 14" because that is what happened.
   *
   * This function still rounds, because mass is a float and the ribbon's terms
   * are integers — the Resonance reward and the rupture are the only two things
   * left that move mass by a non-integer. Both ends are rounded, the middle is
   * DERIVED, and `sim.test.ts` walks a seeded run pairing every absorb back to
   * the numeral it came from.
   *
   * Both ends are rounded and the middle is derived, never the other way round,
   * so `eqA + eqD === eqC` holds exactly however the floats fell. A change that
   * rounds to nothing is not recorded at all: "1503 + 0 = 1503" is noise.
   */
  private note(before: number): void {
    const a = Math.round(before)
    const c = Math.round(this.mass)
    if (a === c) return
    this.eqA = a
    this.eqD = c - a
    this.eqC = c
    this.eqSeq++
  }

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
    this.mwall.fill(0)
    this.ralive.fill(0)
    this.resonance.active = false
    this.resonance.phase = 0
    this.nextResonanceAt = 16
    this.resonanceCount = 0
    this.bestMass = START_MASS
    this.deepest = 0
    this.depth = DEPTHS[0] as Depth
    this.intensity = FLOW.start
    this.success = seedSuccess(FLOW)
    this.rung = rungAt(FLOW.start, DIFFICULTY_RUNGS)
    this.refreshDepth()
    this.eqA = Math.round(START_MASS)
    this.eqD = 0
    this.eqC = Math.round(START_MASS)
    this.eqSeq = 0
    // The opening field is the ramp's floor, not the tier's ceiling, and it is
    // laid down PLAYER-RELATIVE rather than scattered over the whole arena.
    // Scattering was always wasted work — `maintain` culls past 1.65 view-spans
    // on the very first step and re-spawns near the player anyway — and with
    // the membrane now thirty spans out it would have been worse than wasted:
    // the first frame of a run would have been empty water.
    for (let i = 0; i < this.moteBudget; i++) this.spawnMote(false)
    for (let i = 0; i < this.rivalBudget; i++) this.spawnRival(false)
  }

  applySpec(spec: TierSpec): void {
    this.spec = spec
    while (this.moteCount > this.moteBudget) {
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
    while (this.rivalCount > this.rivalBudget) {
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
  private rollValue(): { v: number; kind: number; wall: number } {
    const M = this.mass
    const r = this.rng
    // The climb is metered by how much food the water carries, NOT by handing a
    // child less than the number they ate. `growth` used to multiply the GAIN,
    // which is the one thing in this file that may not be scaled by anything:
    // it made `10 + 4 = 12` on top of the saturation's `10 + 4 = 11`. It now
    // scales the crumb SCALE and the near-tie prize rate instead, which is the
    // same brake on the same curve and does exactly what the old comment said
    // it was for — a struggling child stays in two and three figures — while
    // leaving every printed number exact.
    const g = this.growth
    if (r.chance(this.voidRate)) {
      // A void costs EXACTLY the number it wears; see the sting in `collide`.
      // So the label carries the mercy that the loss used to: it is capped at
      // the same 11% of your mass the damage was clamped to, which leaves the
      // hit identical and makes `24 − 5 = 19` a sentence the game can print.
      const mag = Math.min(
        Math.max(1, Math.round(M * VOID_MAX_FRACTION)),
        Math.max(2, tidyValue(FOOD_A * Math.pow(M, FOOD_B) * r.range(1.0, 3.0))),
      )
      return { v: -mag, kind: MK_VOID, wall: 0 }
    }
    // THE PRIZE. A number just under your own, swallowed whole, worth all of
    // you — the bravest thing in the game and now, with absorption exact, a
    // literal doubling. It is rationed; see PRIZE_RATE.
    if (r.chance(this.prizeRate)) {
      const hi = Math.max(1, Math.round(M) - 1)
      const lo = Math.max(1, Math.min(hi, Math.round(M * 0.90)))
      // Tidied DOWN, never up. `tidyValue` rounds to three significant figures,
      // and rounding 3,996 up to 4,000 at mass 4,000 would turn the prize into
      // the wall it was drawn NOT to be.
      return { v: Math.min(hi, tidyValue(r.int(lo, hi))), kind: MK_FOOD, wall: 0 }
    }

    // THE WALLS. Everything at or above your own mass. Full frequency, because
    // this is where the reading is — 3,418 against 3,481 — and a field with
    // nothing in it to flee is not this game. They are never food; see `mwall`.
    if (r.chance(WALL_RATE)) {
      if (r.f() < WALL_NEAR_SHARE) {
        const lo = Math.max(2, Math.round(M) + 1)
        const hi = Math.max(lo + 2, Math.round(M * 1.32))
        return { v: Math.max(lo, tidyValue(r.int(lo, hi))), kind: MK_FOOD, wall: 1 }
      }
      const lo = Math.max(2, Math.round(M * 1.5))
      const hi = Math.max(lo + 2, Math.round(M * 3.1))
      return { v: Math.max(lo, tidyValue(r.int(lo, hi))), kind: MK_FOOD, wall: 1 }
    }

    const scale = Math.max(FOOD_MIN, FOOD_A * Math.pow(M, FOOD_B) * g)
    if (r.f() < 0.72) {
      // Crumbs — where almost all of your food comes from. Their value grows
      // with the square-ish root of your mass, so a crumb is a fifth of you at
      // the start and a rounding error when you are enormous. That single
      // choice is what makes the climb last.
      return { v: tidyValue(r.int(1, Math.max(1, Math.round(scale)))), kind: MK_FOOD, wall: 0 }
    }
    const lo = Math.max(1, Math.round(scale * 0.8))
    const hi = Math.max(lo + 1, Math.round(scale * 2.6))
    return { v: tidyValue(r.int(lo, Math.min(hi, Math.max(2, Math.round(M * 0.55))))), kind: MK_FOOD, wall: 0 }
  }

  /**
   * How often the water offers a number just under your own.
   *
   * This one rate is what makes exact absorption survivable, and it replaces
   * the saturation that used to do the same job by lying about arithmetic.
   *
   * A prize is worth ALL OF YOU: swallow one and you double, exactly, and the
   * ribbon prints the doubling. Repeat that at a fixed frequency and mass is
   * exponential in the number of motes eaten, with no polynomial anywhere to
   * catch it. Measured, with absorption made exact and the old flat 8% band
   * left alone: a struggling run passed 100,000 inside the first minute and a
   * well-answered one reached 27 million by the second — against 300 and
   * 11,422 before. Eight digits on the player's own core is the end of the
   * product the pack exists for.
   *
   * So the prize gets rarer exactly as fast as it gets bigger. Its contribution
   * to growth is `rate * M`; the crumb economy's goes as `sqrt(M)`; holding the
   * ratio fixed at every size — which is what "the same curve" actually means —
   * needs `rate ∝ M^-0.85` once the eat rate's own `M^-0.35` is folded in. The
   * ceiling is what keeps the opening explosive: for the first half-minute the
   * cap binds and doubling is a thing that happens to you often.
   *
   * It is scaled by `growth`, so a child who is struggling meets fewer of them.
   * That is the same brake the old code applied by shrinking the gain, moved
   * onto the supply, where it does not have to lie to work.
   */
  private get prizeRate(): number {
    return Math.min(PRIZE_RATE_MAX, (PRIZE_RATE * this.growth) / Math.pow(Math.max(1, this.mass), PRIZE_RATE_EXP))
  }

  private spawnMote(anywhere: boolean): number {
    const i = this.freeMote()
    if (i < 0) return -1
    const r = this.rng
    const { v, kind, wall } = this.rollValue()
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
    this.mwall[i] = wall
    this.mflip[i] = kind === MK_VOID || wall ? 0 : Math.abs(v) < this.mass ? 1 : 0
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
      this.mwall[i] = 0
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
    // on the kill economy: a kill is worth exactly the rival now, so a quarter
    // of every board being worth a twentieth of you is what stops "hunt the
    // easiest thing on screen" being the whole game.
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

    const hunterBudget = this.hunterBudget
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
    // 3.4-5.2 -> 2.4-3.2. The old range was already ABOVE the ceiling the
    // recycler now enforces, so a leviathan was born condemned or born
    // screen-filling depending on which ran first. Spawning inside the ceiling
    // means it arrives frightening and stays alive long enough to matter.
    const m = Math.round(this.mass * r.range(2.4, 3.2))
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
    // The breath, before anything reads it. One call, one number, and every
    // budget below is a pure function of it.
    this.intensity = settle(FLOW, this.intensity, this.success, dt)
    this.rung = rungAt(this.intensity, DIFFICULTY_RUNGS, this.rung)
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
    // Agar's law, and the two constants behind it, live on `playerSpeed`.
    let speed = this.playerSpeed
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
    //
    // 8.0 -> 10.0 is turn AUTHORITY, and it is the other half of "I can hardly
    // move": a first-order lag at 8.0 takes 0.12 s to reach 63% of a new
    // heading, which at the old top speed meant a third of the screen's width
    // travelled in the direction the child had already decided against. At 10.0
    // that settling is 0.10 s. It buys deliberate placement without buying
    // twitch, because the ceiling on how fast you may travel came down at the
    // same time.
    const agility = 10.0 * Math.pow(30 / Math.max(24, r), 0.45)
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
      // `false`: surge burn is a continuous drain, not an event. Left on the
      // ledger it would rewrite the ribbon sixty times a second with
      // "1503 - 1 = 1502" and bury every real piece of arithmetic.
      const paid = this.damage(burn, false) > burn * 0.5
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
      //
      // A WALL does not flip — it BURSTS. See WALL_RATE: a number born above
      // you is not a deposit you collect later at a hundred per cent interest,
      // and with absorption exact that is precisely what flipping one would be.
      // Outgrow it and it comes apart into crumbs on the ordinary food scale,
      // which is the same moment with the same sound and an economy behind it.
      // Queued rather than burst in place, because bursting allocates motes and
      // `freeMote` may hand back an index this loop has not reached yet.
      if (this.mwall[i]) {
        if (Math.abs(this.mval[i] as number) < M && this.burstLen < this.burstQ.length) {
          this.burstQ[this.burstLen++] = i
        }
      } else if (this.mkind[i] !== MK_VOID && this.mkind[i] !== MK_ANSWER) {
        const want = Math.abs(this.mval[i] as number) < M ? 1 : 0
        const cur = this.mflip[i] as number
        if (want === 1 && cur < 0.5) {
          this.emit("flip", this.mx[i] as number, this.my[i] as number, this.mr[i] as number, this.mval[i] as number)
        }
        this.mflip[i] = cur + (want - cur) * Math.min(1, dt * 7)
      }
    }

    for (let q = 0; q < this.burstLen; q++) {
      const i = this.burstQ[q] as number
      if (!this.malive[i] || !this.mwall[i]) continue
      const x = this.mx[i] as number
      const y = this.my[i] as number
      this.emit("flip", x, y, this.mr[i] as number, this.mval[i] as number)
      this.malive[i] = 0
      this.mwall[i] = 0
      this.moteCount--
      // On the FOOD scale, not on the wall's own. The wall's number was a size
      // to be read, never an addend, and shards that carried a share of it would
      // put the doubling straight back into the economy through the side door.
      const scale = Math.max(FOOD_MIN, FOOD_A * Math.pow(M, FOOD_B) * this.growth)
      this.scatter(x, y, Math.round(scale * WALL_SHARD_SCALE * WALL_SHARDS), WALL_SHARDS, 130, MK_SHED)
    }
    this.burstLen = 0
  }

  /** Walls outgrown this frame, waiting to come apart. Preallocated; see above. */
  private readonly burstQ = new Int32Array(24)
  private burstLen = 0

  private stepRivals(dt: number): void {
    const frame = (this.time * 60) | 0
    for (let i = 0; i < MAX_RIVALS; i++) {
      if ((this.rrespawn[i] as number) > 0) {
        this.rrespawn[i] = (this.rrespawn[i] as number) - dt
        if ((this.rrespawn[i] as number) <= 0) {
          this.rrespawn[i] = 0
          if (this.rivalCount < this.rivalBudget) this.spawnRival(false)
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

      // Multiplied by the breath, like every other pressure in the world. The
      // depth's temper is a ratchet the CLOCK turns, and a ratchet the clock
      // turns is an escalate-on-failure line by another route: a child who is
      // struggling has, by definition, been playing for a while.
      const temper = (this.depth.temper + this.over * 0.2) * this.pressure
      const lev = this.rleviathan[i] === 1
      // Rival speed is a RATIO to the player's, and it was only ever written as
      // an absolute because the player's was. Dropping the player's base from
      // 520 to 400 silently made every rival in the game faster than the player
      // at every size below a few hundred mass — measured: a bot that hunts
      // nothing but rivals for twenty minutes peaked at mass 59, because it
      // could not catch anything. So both ends move together.
      //
      // 470 + temper*120 -> 300 + temper*110, and the exponent matched to the
      // player's 0.42, which also gives the escalation the flat exponent never
      // did: at DRIFT's temper of 0.22 a rival makes 324 against the player's
      // 403, so early prey is genuinely catchable; at THE LAST LIGHT's 1.0 it
      // makes 410 and nothing is safe.
      const base = lev ? 240 : 300 + temper * 110
      let speed = base * Math.pow(Math.max(18, rr) / 28, lev ? 0.35 : 0.42)

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
    const aggro = (this.depth.temper + this.over * 0.25) * this.pressure
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
        // Exactly the number it wears. The cap that used to live here now lives
        // on the label (VOID_MAX_FRACTION), so this is the same hit and a true
        // sentence instead of a false one.
        const loss = this.damage(Math.abs(v))
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

      // `!this.mwall[i]` is load-bearing in both directions. A wall you have
      // just outgrown is bursting this frame but has not burst yet — mass can
      // rise mid-`collide`, several absorbs deep — and without the guard it
      // would be swallowed for its whole number, which is the free doubling the
      // wall rule exists to remove. The sting branch then has to survive a
      // NEGATIVE `over` for the same reason: `0.035 + over * 0.09` goes below
      // zero, `damage` is handed a negative loss, and a negative loss PAYS the
      // player. That is the exact shape of the rupture bug that once printed six
      // orders of magnitude of free mass.
      if (v < this.mass && !this.mwall[i]) {
        // Absorb once the mote is meaningfully inside you — the little bit of
        // required overlap is what makes a near-miss feel like a near-miss.
        if (d > pr - mr * 0.35) return
        // Exactly the mote's own number. Nothing scales this — not the breath,
        // not the depth, not a combo. The instant anything multiplies this line
        // the ribbon above it stops being true.
        const gain = absorbGain(v)
        const before = this.mass
        this.mass += gain
        this.note(before)
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
        const over = Math.max(0, v / Math.max(1, this.mass) - 1)
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
        // A wall is not food for anybody. Rivals get the same rule the player
        // does, or a rival simply farms the doubling the player cannot.
        if (this.mwall[i]) return
        const v = this.mval[i] as number
        if (v < 0 || v >= m) return
        const dx = (this.mx[i] as number) - rxk
        const dy = (this.my[i] as number) - ryk
        if (Math.hypot(dx, dy) > rr - (this.mr[i] as number) * 0.35) return
        this.rmass[k] = m + absorbGain(v)
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
            const before = this.mass
            this.mass += devourGain(m)
            this.note(before)
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
            this.rmass[k] = m + devourGain(m2)
            this.killRival(j, true)
          } else if (m2 > m * 1.06 && dd < rr2 - rr * 0.72) {
            this.rmass[j] = m2 + devourGain(m)
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
    const beforeRupture = this.mass
    this.mass = target
    this.note(beforeRupture)
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
    if (res.phase === 1 && res.t > 0.55) {
      res.phase = 2
      // THE CLOCK STARTS HERE, and it used to start 0.55 s earlier.
      //
      // `openResonance` set both stamps at the moment the beat OPENED, which is
      // the start of a 0.55 s ramp during which `resolveResonance` refuses to
      // register anything (`res.phase !== 2`) and the prompt is still fading up
      // in the HUD. Every latency this game has ever reported therefore carried
      // 0.55 s of animation that no child could have answered inside.
      //
      // That was harmless while nothing read the number. It stopped being
      // harmless the moment latency began deciding whether a player climbs: the
      // inflation is SYSTEMATIC, not noisy, so it never averages out, and it
      // reads as a plausible number while quietly refusing to promote children
      // who answered instantly. Latency starts when the child can first read the
      // question and act on it. Nothing else belongs in it.
      res.openedAt = performance.now()
      res.openedT = this.time
    }
    if (res.phase === 2 && res.t > res.duration) {
      this.emit("resonance-fade", this.px, this.py, 0, 0)
      // A question that went unanswered comes back LATER, not on the usual
      // cadence. A player who is not engaging with the maths right now should
      // not be interrupted every twenty seconds to be asked again — and while a
      // Resonance is open the arena is inert, so a stream of ignored questions
      // is also a stream of seconds in which the game is not a game.
      this.nextResonanceAt = this.time + this.rng.range(40, 55)
      this.closeResonance()
      return
    }
    // A right answer resolves in a beat. A miss is held for the reveal, which
    // is long and calm at the bottom of the ladder and absent at the top.
    if (res.phase === 3 && res.t > res.duration + (res.wasCorrect ? 0.9 : Math.max(0.9, this.revealSeconds))) {
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
      const drift = res.phase === 2 ? this.sphereDrift : 0
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
    // The difficulty comes from the BREATH, not from the depth.
    //
    // This one line is the founder's whole complaint about adaptation. It used
    // to be `depth.difficulty + over * 2` — the depth is a ratchet that can
    // never fall and the overdrive is a function of mass and the clock, so the
    // questions got harder because time had passed and for no other reason. A
    // child who had missed the last four in a row was handed a fifth that was
    // harder than all of them. Now the rung is the rung the run's recent work
    // has earned, and it goes down as readily as it goes up.
    const diff = this.rung + 1
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
    res.duration = this.resonanceSeconds
    res.question = q
    res.chosen = -1
    // Provisional: both are re-stamped at the phase 1 -> 2 transition, when the
    // question actually becomes answerable. These values exist only so a
    // Resonance that is torn down mid-ramp does not carry a stale stamp.
    res.openedAt = performance.now()
    res.openedT = this.time
    this.resonanceCount++

    const ringR = Math.max(viewSpanFor(this.mass) * 0.30, this.playerRTrue * 3.4)
    res.ringR = ringR
    // The traversal floor, computed the same way `stepPlayer` computes it, so
    // the two cannot drift.
    const travelSpeed = Math.max(this.playerSpeed, ringR / 1.35)
    res.reachSeconds = ringR / Math.max(1, travelSpeed)
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
      // A sphere is never a wall, whatever the mote it was recycled from was.
      this.mwall[i] = 0
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
    /**
     * THINKING time on the simulation clock: deterministic, and what steers.
     *
     * The wall clock is reported to the Host and never read here — a seeded run
     * has to reproduce on a slow machine. The traversal floor comes off because
     * swimming to a sphere is not deliberation, and leaving it in makes the
     * signal a function of the player's size rather than of their fluency.
     */
    const took = Math.max(0, this.time - res.openedT - res.reachSeconds)
    res.thinkSeconds = took

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

    // The only place the breath is fed. A child's answers are the only evidence
    // this game has about a child, and they are the only thing allowed to move
    // the world's difficulty.
    //
    // The LATENCY goes in with the verdict, and it is what separates "already
    // knew it" from "worked it out" — two outcomes that want opposite things
    // from the world. ARENA has always measured this: `res.answerMs` is frozen
    // at the moment of the answer and reported to the Host. It has simply never
    // been used to decide anything until now.
    this.success = observe(FLOW, this.success, correct, took)

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
      // SPEED PAYS. Not "slowness costs" — the same measurement with the
      // opposite valence, and the difference is the whole feel of the beat. A
      // laboured correct answer earns the full base reward; a brisk one earns
      // up to 70% more on top, and the celebration scales with it. Nothing is
      // ever taken away for thinking.
      const quick = quickness(FLOW, took)
      const cap = Math.min(before * (0.30 + streak * 0.045), 26 * Math.sqrt(before) + 12) * (1 + 0.7 * quick)
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
      this.note(before)
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
      // `r` carries the quickness so the presentation layer can pay it out in
      // spectacle as well as in mass, without recomputing anything.
      this.emit("resonance-hit", this.px, this.py, gain, this.combo, quick)
      this.emit("shockwave", this.px, this.py, wave, 2)
      this.host.haptic("success")
    } else {
      // A wrong answer cost a flat 24% of the run. That is a punishment aimed
      // squarely at the child who is finding it hard, and it is the exact
      // shape of thing this pass exists to remove: at the bottom of the ladder
      // it is now 2%, a nudge, and it only becomes real stakes at the top —
      // where the player climbed on purpose and the stakes are the point.
      const loss = this.damage(this.mass * valueAt(this.intensity, 0.02, 0.14, "settle"))
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

    const want = this.moteBudget
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
      //
      // **`!this.rleviathan[k]` was the bug.** Leviathans were exempt from this
      // rule and from every other size rule, they are spawned at a multiple of
      // your mass, they eat, and a rupture cuts your own mass by nearly half —
      // so the ratio compounds and nothing ever collected it. Measured over a
      // five-minute seeded run: the largest core on the field reached 27.4x the
      // player's mass, which is 1.99 times the WIDTH of a phone held tall.
      // Exactly the founder's "they can get so big that they are bigger than
      // the whole screen ... they just basically envelope me and I can't do
      // anything". A creature that fills the screen and cannot be escaped is
      // not difficulty; it is a coin flip.
      //
      // So the rule applies to everything, with the leviathan allowed a bigger
      // ceiling because being frightening is its entire job. See
      // `RIVAL_MAX_RATIO` for where the two numbers come from.
      if (this.ralive[k] && (this.rmass[k] as number) > this.mass * this.rivalCeiling(k)) {
        this.ralive[k] = 0
        this.rleviathan[k] = 0
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

    if (this.rivalCount < this.rivalBudget) this.spawnRival(false)

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
