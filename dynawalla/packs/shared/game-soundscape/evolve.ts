/**
 * The groove as something ALIVE: a bar that drifts away from its seed, slowly,
 * and that right and wrong answers steer in opposite directions.
 *
 * The founder's brief, and the whole of what this file is for:
 *
 * > *"pulse is somewhat improved but it needs to gradually evolve more — the
 * > main rhythm is static. I think slowly things should evolve and change
 * > stochastically. so there is sort of the seed but it should be able to go
 * > almost anywhere. Maybe being 'right' or 'wrong' should affect the beat in
 * > different ways. We don't have to just use random but random is a good
 * > friend. Add and remove different beats with probability .. slowly evolve."*
 *
 * ## What was static, exactly
 *
 * `grooveMatrix` is a pure function of the soundscape and the stage. PULSE
 * calls it once per phrase with the same two arguments, so it gets the same
 * twenty-four probabilities back every phrase of every minute of the run. The
 * *draw* differed — a phrase is a fresh stream — but the BIAS never did, so the
 * same two or three instants won every coin toss forever and the bar had a
 * shape a child had heard all of within about forty seconds. That is what
 * "static" means here: not that the notes repeat, but that the thing choosing
 * them never changed its mind.
 *
 * ## The mechanism, and the three things that stop it becoming noise
 *
 * One number per instant of the bar, `-1..1`, on top of what the mode said.
 * Every few bars, one of them moves. That is the whole of it, and everything
 * else here is a constraint on it.
 *
 *   1. **The metre is not in the walk.** `grooveMatrix` drifts the mode's
 *      affinity and never the metric weight, so a downbeat outranks a halfway
 *      point outranks a sixteenth no matter where the walk has got to. A groove
 *      that drifted its own skeleton would be a groove in name only after four
 *      minutes. The downbeat itself is not in the walk at all — it is not
 *      negotiable and never was.
 *   2. **The walk is tethered, not free.** Every mutation decays every lean
 *      toward zero (`SEED_HALF_LIFE_BARS`). That is a mean-reverting walk
 *      rather than a Brownian one, and it is the exact shape of what was asked
 *      for: *"there is sort of the seed but it should be able to go almost
 *      anywhere"*. Anywhere — the stationary spread is wide and no instant is
 *      pinned — but with a home it keeps falling back through rather than a
 *      trajectory it leaves on. Individual leans cross back through zero
 *      dozens of times in a long session; `evolve.test.ts` counts them.
 *   3. **Nothing lands mid-phrase.** `matrix()` is stable between `advance()`
 *      calls, always. A game advances at a phrase boundary and the shape
 *      changes there or not at all, so a bar a child is two beats into can
 *      never become a different bar. This is also what makes a phrase cache
 *      safe, which PULSE needs.
 *
 * ## Right and wrong, which must not be a reward and a punishment
 *
 * The fleet's rule is that a miss is the teaching moment, so a wrong answer may
 * never sound like a buzzer and may never make the next thing harder. The
 * asymmetry here is the founder's own pair of verbs — *"add and remove
 * different beats"* — pointed in two DIRECTIONS rather than at two volumes:
 *
 *   * **Right → the groove ADDS.** `agree()` lights up an instant it had been
 *     ignoring: the one with the most room that the metre would most like to
 *     hear. The bar keeps finding new places to sit while the child is holding
 *     it together, which is what it sounds like when a band opens up around
 *     somebody who is playing well. **It adds no notes.** The density budget is
 *     renormalised, so the expected count is exactly what the stage asked for
 *     and what changed is WHERE. Rewarding correctness with a busier bar would
 *     be rewarding it with a harder game, which is the oldest way there is to
 *     punish someone.
 *   * **Wrong → the groove REMOVES.** `makeRoom()` takes the busiest
 *     DECORATION down — never a beat, never the downbeat — and leaves a little
 *     space in the bar for a few phrases. It is a band backing off while
 *     somebody thinks, and it comes back by itself whether or not the next
 *     answer is right, because it expires on the clock and not on merit
 *     (`ROOM_HALF_LIFE_BARS`). Nothing is removed permanently, nothing goes
 *     red, and the bar never speeds up or slows down: there is no tempo in this
 *     module and this file does not add one.
 *
 * The space is capped at `MAX_OPENNESS` — a quarter of the budget — so playing
 * badly on purpose buys a barely-thinner bar and never an easier game.
 *
 * Measured, 200 seeds per grid: a run of eight right answers leaves the groove
 * with a net +1.5 to +2.4 instants opened, a run of eight wrong ones with a net
 * −1.3 to −3.9, and right lands above wrong in 196 to 200 runs of 200 on every
 * grid PULSE plays. Right leaves the expected note count bit-identical to the
 * stage's in 60 of 60 seeds.
 *
 * ## The rate
 *
 * Measured in BARS, because bars are the only musical unit a caller can supply
 * without this module growing a tempo primitive it has no business owning. One
 * mutation event per `BARS_PER_MUTATION` bars; a lean's memory of its seed
 * halves every `SEED_HALF_LIFE_BARS`. At PULSE's opening tempo that is one
 * instant moving every twelve seconds and a shape whose favoured instants turn
 * over about every sixty-five seconds — a child notices it the way they notice
 * the light changing, which is what *"slowly evolve"* asks for and is why the
 * numbers are in this file rather than in a game's.
 *
 * No Web Audio, no DOM, no timers, no frequency. Everything is arithmetic over
 * a seeded stream, so a whole afternoon of drift is assertable in a
 * millisecond.
 */

import {
  grooveMatrix,
  type GrooveBias,
  type GrooveSlot,
  type GrooveSpec,
} from "./groove.ts"
import { Rng } from "./rng.ts"
import type { Soundscape } from "./soundscape.ts"

/**
 * How many bars pass between one instant moving and the next.
 *
 * Four, which is one phrase in every game that has asked so far, and the reason
 * it is four rather than one is the whole of *"slowly"*. A mutation a bar would
 * be a bar that is different every time it comes round, which is not evolution
 * — it is a bar with no identity. A mutation a phrase means the shape a child
 * has just learnt survives long enough to be learnt.
 */
export const BARS_PER_MUTATION = 4

/**
 * How long a lean remembers the seed, in bars.
 *
 * The tether, and with `MUTATION_STEP` it is the pair that decides how far
 * "almost anywhere" reaches. A hundred and forty-four bars is about six and a
 * half minutes at PULSE's tempi: a shape put in place by a run of right answers
 * is still recognisably there three minutes later and mostly gone ten minutes
 * later. Shorter and the drift is a shimmer that never gets anywhere; longer
 * and an early accident becomes the rest of the session.
 *
 * The two together were fitted against a measurement rather than chosen: at
 * these values a groove's favoured instants have moved 8% away from the seed
 * after a minute, 15% after nine, and never further — the walk reaches its
 * spread and stays inside it for an hour of play.
 */
export const SEED_HALF_LIFE_BARS = 144

/** How long the room a miss makes lasts, in bars. Two phrases, then mostly gone. */
export const ROOM_HALF_LIFE_BARS = 8

/**
 * How far one random mutation may move one instant.
 *
 * Signed and uniform, so *"add and remove different beats with probability"* is
 * one draw and not two mechanisms. The stationary spread this produces against
 * `SEED_HALF_LIFE_BARS` is measured rather than asserted by eye — see
 * `evolve.test.ts`, which holds both ends of it: far enough to be a different
 * groove, near enough that no instant ever pins.
 */
const MUTATION_STEP = 0.7

/** How much room one wrong answer asks for, and how much one right answer takes back. */
const ROOM_PER_MISS = 0.55
const ROOM_KEPT_ON_AGREE = 0.5

/**
 * The bar shape a groove walks over before anybody has told it another.
 *
 * Quarters and a bar of four: the narrowest thing that is still a bar. The
 * universe WIDENS to the union of every grid the groove is shown (see
 * `remember`), so this is a floor and not an assumption — a groove nobody ever
 * asks for a matrix still has somewhere to walk.
 */
const DEFAULT_BEATS_PER_BAR = 4
const DEFAULT_DIVS: readonly number[] = [1]

/** How strongly the walk prefers decoration to the pulse. */
const ORNAMENT_LEAN = 0.55

/**
 * How many instants one mutation event moves: one per this many live slots.
 *
 * The drift rate has to be a property of TIME and not of how fine the grid
 * happens to be. PULSE's opening stage has three movable instants and its last
 * has twenty-three; one mutation per phrase in both would mean the groove
 * evolved eight times more slowly for the child who got good, which is exactly
 * backwards. Holding the per-instant rate constant instead means "the shape
 * turns over in about this many minutes" is true at every stage.
 */
const SLOTS_PER_MUTATION = 8

/**
 * How much of a lean's range one right answer, or one wrong one, is worth.
 *
 * Four answers takes an instant the whole way, which is the right coarseness:
 * one gate is a nudge a child would not name, and a stage's worth of them is a
 * groove that has visibly made up its mind.
 */
const COMMIT_STEP = 0.28
const OPEN_STEP = 0.28

/**
 * How many answers one phrase boundary will spend.
 *
 * `advance` already clamps a caller that hands over a nonsense number of bars;
 * this is the same guard on the other input, because each pending gesture now
 * re-reads the field and so costs a matrix build. Six is far above anything a
 * game can produce in four bars — PULSE serves a gate every five or six bars —
 * and it means a caller that reported a thousand answers between boundaries
 * pays for six of them rather than for a thousand.
 */
const MAX_PENDING = 6

/** A lean below this is not worth carrying, and dropping it keeps the map small. */
const LEAN_EPSILON = 1e-4

type Pending = {
  /** Right answers waiting for the next phrase boundary. */
  agree: number
  /** Wrong answers waiting for the next phrase boundary. */
  room: number
  /** A key the host published, waiting for the same boundary. */
  scape: Soundscape | null
}

/**
 * A living groove: the seed matrix, plus where it has wandered to.
 *
 * Stateful on purpose, in the way `Melody` is: the whole claim is that where
 * the bar is now depends on what has already happened. The state is held in an
 * object the game owns and the randomness comes from a seed, so two runs from
 * one seed are the same session note for note and two different seeds are not.
 */
export class Groove {
  private scape: Soundscape
  private readonly rng: Rng
  /** Beat offset → lean, `-1..1`. Absent means "the mode's own opinion". */
  private readonly leans = new Map<number, number>()
  private room = 0
  private rev = 0
  private barsBanked = 0
  private barsTotal = 0
  private beatsPerBar = DEFAULT_BEATS_PER_BAR
  private divs: readonly number[] = [...DEFAULT_DIVS]
  private readonly pending: Pending = { agree: 0, room: 0, scape: null }

  /**
   * @param scape the key the host published; the seed of the walk, not a cage.
   * @param seed  the stream the walk is drawn from. Defaults to the
   *   soundscape's own, which is right for a game with one groove; a game that
   *   wants a different walk each run — PULSE does, its run seed is its
   *   identity — passes its own and gets one that is still reproducible.
   */
  constructor(scape: Soundscape, seed?: number) {
    this.scape = scape
    this.rng = new Rng(typeof seed === "number" && Number.isFinite(seed) ? seed : scape.seed)
  }

  /** The key this groove is in. */
  get soundscape(): Soundscape {
    return this.scape
  }

  /**
   * How many times the shape has changed.
   *
   * Exported because it is exactly the right cache key for a caller that
   * memoises phrases: it changes when and only when `matrix()` would answer
   * differently, so a phrase rebuilt after a cache eviction inside the same
   * phrase is rebuilt identically. PULSE relies on that.
   */
  get revision(): number {
    return this.rev
  }

  /** Bars of music this groove has lived through. */
  get bars(): number {
    return this.barsTotal
  }

  /**
   * How much room the bar is currently leaving, `0..1`.
   *
   * `0` is the density the stage asked for. `1` is `MAX_OPENNESS` of it handed
   * back. For a debug read-out and for tests; nothing about a game's behaviour
   * should read it.
   */
  get openness(): number {
    return this.room
  }

  /**
   * Where one instant of the bar has been pushed to, `-1..1`. `0` is the
   * mode's own untouched opinion.
   *
   * For a debug read-out and for tests, in the same spirit as
   * `Melody.position` — the walk is the claim this module makes, and a claim
   * that cannot be observed cannot be checked. Reading it back out of the
   * matrix does NOT work: `leanAffinity` is bounded by what the mode already
   * said, so an instant the mode has already put at 1 shows a lean of +0.8 as
   * a change of exactly zero. That is correct behaviour and it is invisible.
   *
   * Nothing about a game's behaviour should read this.
   */
  leanAt(beat: number): number {
    return this.leans.get(beat) ?? 0
  }

  /** The bar as it stands, at this stage's grid and density. */
  matrix(spec: GrooveSpec): GrooveSlot[] {
    this.remember(spec)
    return grooveMatrix(this.scape, spec, this.bias())
  }

  /** The seed bar — where this groove started, and what it is drifting from. */
  seedMatrix(spec: GrooveSpec): GrooveSlot[] {
    return grooveMatrix(this.scape, spec)
  }

  /**
   * How far the shape has travelled, `0..1`: the mean absolute change in a
   * slot's probability against the seed matrix.
   *
   * The number the design is argued in. A drift that cannot be measured is a
   * drift that can be switched off without anything failing, which is how the
   * last generator in this lineage shipped with its matrix inert.
   */
  distanceFromSeed(spec: GrooveSpec): number {
    const now = this.matrix(spec)
    const seed = this.seedMatrix(spec)
    if (now.length === 0) return 0
    let total = 0
    for (let i = 0; i < now.length; i++) total += Math.abs((now[i]?.p ?? 0) - (seed[i]?.p ?? 0))
    return total / now.length
  }

  /**
   * Music happened. Nothing moves until a whole `BARS_PER_MUTATION` has passed,
   * and then everything that was waiting moves at once.
   *
   * A caller passes the bars it just played — a phrase, usually — and calls it
   * at a phrase boundary. Calling it mid-phrase is not wrong, it is simply
   * early: the shape still only turns over at the boundary the bar budget
   * crosses, which is what the "nothing lands mid-phrase" guarantee is made of.
   */
  advance(bars: number): void {
    if (!Number.isFinite(bars) || bars <= 0) return
    this.barsBanked += bars
    this.barsTotal += bars
    // A guard and not a loop bound: a caller that slept for an hour and handed
    // over four hundred bars gets four hundred bars of drift, but a caller that
    // handed over a nonsense number cannot spin.
    let steps = Math.floor(this.barsBanked / BARS_PER_MUTATION)
    this.barsBanked -= steps * BARS_PER_MUTATION
    if (steps <= 0) return
    steps = Math.min(steps, 512)
    for (let i = 0; i < steps; i++) this.step()
  }

  /**
   * Something the child was trying to do WORKED.
   *
   * Not "make it louder" and not "add a note": the groove leans harder into the
   * instant it already likes most, so the bar it plays next is a more decided
   * version of the bar it was already playing. Music agreeing with you.
   *
   * Takes effect at the next `advance()`, like everything else here.
   */
  agree(): void {
    this.pending.agree += 1
  }

  /**
   * It did NOT — and this is the one method in the module that has to be read
   * as a design document rather than as a setter.
   *
   * A wrong answer must never sound like punishment. So this does not thin the
   * pulse, does not mute anything, does not slow anything down and does not
   * make a noise at all: it takes the busiest piece of DECORATION down a step
   * and leaves a little space in the bar. That is what a band does when the
   * person out front needs a second, and a child reads it as room rather than
   * as a verdict. It expires on the clock (`ROOM_HALF_LIFE_BARS`), so nothing
   * has to be earned back.
   */
  makeRoom(): void {
    this.pending.room += 1
  }

  /**
   * The app changed key.
   *
   * The drift is KEPT, exactly as `Melody.retune` keeps the walker's degree and
   * for the same reason: a lean is a statement about an instant of the bar, and
   * an instant of the bar means the same thing in the new mode. Carrying it
   * across makes a key change sound like a modulation of the groove that was
   * playing rather than like one groove stopping and a different one starting.
   *
   * Queued to the next `advance()` so a key that arrives on a settings push
   * cannot re-shape a bar a child is halfway through.
   */
  retune(scape: Soundscape): void {
    this.pending.scape = scape
  }

  // ── the walk ───────────────────────────────────────────────────────────────

  private step(): void {
    const scape = this.pending.scape
    if (scape !== null) {
      this.scape = scape
      this.pending.scape = null
    }

    // The tether, first: every lean forgets a little of wherever it got to, so
    // the seed is a place the walk keeps falling back through rather than a
    // point it leaves once.
    const decay = Math.pow(0.5, BARS_PER_MUTATION / SEED_HALF_LIFE_BARS)
    for (const [beat, lean] of [...this.leans]) {
      const next = lean * decay
      if (Math.abs(next) < LEAN_EPSILON) this.leans.delete(beat)
      else this.leans.set(beat, next)
    }
    this.room *= Math.pow(0.5, BARS_PER_MUTATION / ROOM_HALF_LIFE_BARS)

    /**
     * What the child did, spent first: correctness STEERS the walk and the
     * random step EXPLORES from wherever the steering left it. That ordering is
     * the design — the other way round, a run of right answers would be
     * scribbled over by the noise that followed it in the same step.
     *
     * **The field is re-read between gestures**, and it has to be. Four right
     * answers inside one phrase read against a snapshot all scored the SAME
     * instant highest and piled 4 x `COMMIT_STEP` onto it, saturating one beat
     * instead of opening four — which contradicts both the plural in the brief
     * ("add … different beats") and this file's own prose. Re-reading costs one
     * matrix build per gesture, and `MAX_PENDING` is what bounds that.
     */
    const answered = Math.min(MAX_PENDING, this.pending.agree)
    const missed = Math.min(MAX_PENDING, this.pending.room)
    for (let i = 0; i < answered; i++) this.commit(this.liveSlots())
    for (let i = 0; i < missed; i++) this.open(this.liveSlots())
    if (missed > 0) this.room = Math.min(1, this.room + ROOM_PER_MISS * Math.min(3, missed))
    if (answered > 0) this.room *= Math.pow(ROOM_KEPT_ON_AGREE, Math.min(3, answered))
    this.pending.agree = 0
    this.pending.room = 0

    // And then the stochastic part, over the field the steering just left.
    this.wander(this.liveSlots())

    this.rev += 1
  }

  /**
   * One instant moves, up or down, drawn from this groove's own stream.
   *
   * Weighted toward decoration, because the finer subdivisions are where a
   * groove is allowed to be surprising and the beats are where it has to be
   * dependable. A beat can still move — `ORNAMENT_LEAN` is a lean and not a
   * ban, and a groove whose beats never moved could not travel far — it simply
   * moves about half as often as an offbeat does.
   */
  private wander(live: readonly LiveSlot[]): void {
    if (live.length === 0) return
    const weights = live.map((s) => Math.max(0.1, 1 - s.metre * ORNAMENT_LEAN))
    const moves = Math.max(1, Math.round(live.length / SLOTS_PER_MUTATION))
    for (let i = 0; i < moves; i++) {
      const slot = live[this.rng.weighted(weights)]
      if (!slot) return
      this.nudge(slot.beat, (this.rng.next() * 2 - 1) * MUTATION_STEP)
    }
  }

  /**
   * Right: the groove ANSWERS — an instant it had been ignoring lights up.
   *
   * **Two designs were built and measured before this one, and both failed for
   * the same reason**, which is worth writing down because it is the whole
   * argument for the shape this ended up.
   *
   * The obvious reading of *"the music agreeing with you"* is that the groove
   * leans harder into what it is already doing, so the first version pushed the
   * instant with the highest `p`. It does almost nothing, and the arithmetic
   * says why: `leanAffinity` moves an instant inside the range the mode allowed
   * it, so an instant that is already at 0.9 has 0.1 of headroom upward and
   * 0.55 downward. The strongest instant is by definition the one with the
   * least room to get stronger. Measured over 60 seeds and eight right answers,
   * it beat an untouched groove 38 times — a coin, on the metric it was built
   * to move. (Drawing the target in proportion to `p` rather than taking the
   * argmax was worse still: 30 of 60, because six pushes landed on five
   * different instants and cancelled.)
   *
   * So right does what the founder actually asked for — *"add … different beats
   * with probability"* — and adds one. The target is the instant with the most
   * room that the METRE would most like to hear, `metre × (1 − affinity)`, so
   * what lights up is a musically sensible place and not the most obscure
   * corner of the grid. **It adds no notes**: the density budget is
   * renormalised, so the bar keeps the exact expected note count the stage
   * asked for and simply finds a new place to sit. A child who is getting
   * everything right is rewarded with a groove that keeps opening up, never
   * with a busier bar — rewarding correctness with more to hit is rewarding it
   * with a harder game, which is the oldest way there is to punish someone.
   */
  private commit(live: readonly LiveSlot[]): void {
    const slot = this.pickStrongest(
      live,
      (s) => s.metre * (1 - s.affinity),
      (lean) => lean < 1,
    )
    if (!slot) return
    this.nudge(slot.beat, COMMIT_STEP)
  }

  /**
   * Wrong: take the busiest DECORATION down a step.
   *
   * Weighted by how loud an instant currently is AND by how little metric
   * weight it carries, so what backs off is an ornament and never the pulse. On
   * a grid that is nothing but beats — PULSE's opening stage is four quarter
   * notes — `1 - metre` is small everywhere and the whole effect is carried by
   * `openness` instead, which is the right answer there: there is no decoration
   * to take away, so the bar simply leaves a little space.
   */
  private open(live: readonly LiveSlot[]): void {
    const slot = this.pickStrongest(
      live,
      (s) => s.p * Math.max(0.05, 1 - s.metre),
      (lean) => lean > -1,
    )
    if (!slot) return
    this.nudge(slot.beat, -OPEN_STEP)
  }

  /** The instant that scores highest and still has room to move that way. */
  private pickStrongest(
    live: readonly LiveSlot[],
    score: (slot: LiveSlot) => number,
    room: (lean: number) => boolean,
  ): LiveSlot | null {
    let best: LiveSlot | null = null
    let bestScore = -Infinity
    for (const slot of live) {
      if (!room(this.leans.get(slot.beat) ?? 0)) continue
      const s = score(slot)
      if (s > bestScore) {
        bestScore = s
        best = slot
      }
    }
    return best
  }

  private nudge(beat: number, delta: number): void {
    const next = Math.min(1, Math.max(-1, (this.leans.get(beat) ?? 0) + delta))
    if (Math.abs(next) < LEAN_EPSILON) this.leans.delete(beat)
    else this.leans.set(beat, next)
  }

  /**
   * The instants currently in play, and how strong each one is right now.
   *
   * The downbeat is excluded from every one of the three movers, which is the
   * cheapest possible way to state that it is not negotiable — nothing can
   * nudge it because nothing is ever handed it.
   */
  private liveSlots(): LiveSlot[] {
    const matrix = grooveMatrix(
      this.scape,
      { beatsPerBar: this.beatsPerBar, divs: this.divs, density: 0.5 },
      this.bias(),
    )
    return matrix
      .filter((s) => s.beat !== 0)
      .map((s) => ({ beat: s.beat, metre: s.metre, affinity: s.affinity, p: s.p }))
  }

  /**
   * Remember the grid the caller is actually playing, so the walk moves
   * instants a child can hear.
   *
   * Without this the walk would spread itself over the finest grid the module
   * can imagine and PULSE's opening stage — four quarter notes — would receive
   * one audible mutation in every six. The leans of instants that are not in
   * the current grid are KEPT and keep decaying, so a stage that goes back to
   * triplets finds the shape it left rather than a blank one.
   *
   * **The UNION of every grid it has been shown, and not the last one.** One
   * groove is asked about several grids in the same bar — PULSE reads it once
   * for what the child plays and again for what the band plays underneath — and
   * a last-one-wins universe would make the walk depend on the order those two
   * calls happen to be made in, which is the kind of coupling that survives
   * every test and breaks when somebody reorders two lines. `divs` only ever
   * grows, and `SLOTS_PER_MUTATION` keeps the per-instant rate constant as it
   * does, so a wider universe costs nothing.
   */
  private remember(spec: GrooveSpec): void {
    this.beatsPerBar = Math.max(this.beatsPerBar, Math.max(1, Math.floor(spec.beatsPerBar)))
    const divs = spec.divs.length > 0 ? spec.divs : [1]
    let widened = false
    for (const d of divs) {
      const div = Math.max(1, Math.floor(d))
      if (!this.divs.includes(div)) {
        this.divs = [...this.divs, div]
        widened = true
      }
    }
    if (widened) this.divs = [...this.divs].sort((a, b) => a - b)
  }

  private bias(): GrooveBias {
    return { at: this.leans, openness: this.room }
  }
}

type LiveSlot = { beat: number; metre: number; affinity: number; p: number }
