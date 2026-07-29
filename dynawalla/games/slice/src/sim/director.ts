// The director — what gets thrown, when, and how hard.
//
// The escalation curve is the whole reason this has to hold for twenty minutes
// instead of ninety seconds. Nothing here has a completion state; every knob is
// a saturating curve on elapsed time, so minute nineteen is harder than minute
// three and there is no top.
//
// Throw choreography is the quiet half of why the format works. Objects come in
// **waves**, staggered by 55–130ms across a fanned launch band, so a single
// swipe path can take three of them. Apex is placed between 58% and 84% of the
// screen height, which is where an object is slowest and therefore where the
// game is secretly asking you to cut.
//
// ── the density contract ────────────────────────────────────────────────────
//
// An earlier cut of this file expressed pacing purely as a wave *timer*, and a
// timer cannot promise anything: a 320px-tall viewport retires a gourd in ~1.8s
// while the calm interval was 1.85s, so the screen could — and measurably did —
// go completely empty. Playtest data on that build: 2.8–4.2 live objects for
// the first minute, minimum ZERO, first genuine rush at 82 seconds.
//
// So the wave timer is now only the *texture*. The guarantee is `floorCount()`:
// a hard minimum number of live cuttable objects that the director tops up the
// instant the field drops below it, on any viewport, at any tier. The timer
// makes the market feel like it breathes; the floor makes sure it never stops.
//
// ── and the one thing that outranks it ──────────────────────────────────────
//
// The floor is a promise about the market. It is not a promise about the child's
// attention, and it was being kept at the child's expense: `quiet` throttled the
// wave timer and the wave size and never touched `floorCount()`, so the
// guaranteed six-to-eight cuttable objects and the bomb spawner were both fully
// enforced *while a live equation was on screen*. The moment the game had
// designated for thinking was the busiest moment in it.
//
// `quiet` now stops the market outright, and the market comes back with a surge
// rather than a trickle. Sparser around the answer, louder after it.

import { Rng } from "../core/rng.ts"
import type { NumberPool } from "./factor.ts"

export type Phase = "calm" | "market" | "rush"

export type Throw = {
  kind: "numeral" | "bomb" | "sigil"
  value: number
  delayMs: number
  /** 0..1 across the launch band. */
  bandT: number
  /** Apex as a fraction of screen height. */
  apex: number
}

/** Seconds before the first MARKET RUSH. A child should meet the real game fast. */
const FIRST_RUSH_AT = 20

export class Director {
  private rng: Rng
  private pool: NumberPool
  elapsed = 0
  private nextWaveIn = 0.15
  private nextSigilIn = 2.6
  /** Seconds of MARKET RUSH remaining. */
  rushLeft = 0
  private nextRushIn = FIRST_RUSH_AT
  private queue: Throw[] = []
  private queueT: number[] = []
  /** How many rushes have fired. Each one is longer and hotter than the last. */
  rushCount = 0

  constructor(rng: Rng, pool: NumberPool) {
    this.rng = rng
    this.pool = pool
  }

  reset(): void {
    this.elapsed = 0
    this.nextWaveIn = 0.15
    this.nextSigilIn = 2.6
    this.rushLeft = 0
    this.nextRushIn = FIRST_RUSH_AT
    this.rushCount = 0
    this.quiet = false
    this.surgeLeft = 0
    this.queue.length = 0
    this.queueT.length = 0
  }

  /** 0 at the start, saturating toward 1. Drives every other curve. */
  get heat(): number {
    // Two stacked curves. The FAST one exists to make second ten look like a
    // game rather than a screensaver — tau 15 puts heat at 0.26 by t=10 and
    // 0.40 by t=20, where the old tau 70 was still at 0.09. The SLOW one is
    // what keeps minute nineteen harder than minute three; it is still climbing
    // at t=600 and does not saturate inside a twenty-minute session.
    const fast = 1 - Math.exp(-this.elapsed / 15)
    const slow = 1 - Math.exp(-this.elapsed / 400)
    return Math.min(1, fast * 0.5 + slow * 0.62)
  }

  get phase(): Phase {
    if (this.rushLeft > 0) return "rush"
    // Market at heat 0.34 → about fifteen seconds in, not eighty.
    return this.heat > 0.34 ? "market" : "calm"
  }

  /** Host difficulty for the next sigil: 1 → 10, but never ahead of the player. */
  questionDifficulty(accuracy: number): number {
    const base = 1 + this.heat * 7
    // Accuracy nudges by at most ±1.5 so a bad patch eases off without the
    // difficulty visibly yo-yoing.
    const adj = (accuracy - 0.72) * 4
    return Math.max(1, Math.min(10, Math.round(base + Math.max(-1.5, Math.min(1.5, adj)))))
  }

  /**
   * The promise. At least this many cuttable objects are live at all times, on
   * every viewport. Nothing else in this file is allowed to break it.
   *
   * …except the hush, which is not a pacing knob but the child's own time. See
   * `quiet`. The floor is a promise about the *market*, and while a question is
   * up there is no market.
   */
  floorCount(): number {
    if (this.quiet) return 0
    if (this.rushLeft > 0) return 11
    if (this.surgeLeft > 0) return Math.round(8 + this.heat * 6)
    return Math.round(4 + this.heat * 6)
  }

  /** …and the ceiling, so a long rush never turns the screen into soup. */
  ceilingCount(): number {
    if (this.rushLeft > 0) return 26
    return Math.round(10 + this.heat * 11)
  }

  private waveInterval(): number {
    if (this.rushLeft > 0) return 0.32
    const h = this.heat
    const base = 1.18 - h * 0.68 // 1.18s → 0.50s
    // The market comes back louder than it left. A question is a held breath and
    // the breath has to be let out, or "sparser" reads as "the game got worse".
    return this.surgeLeft > 0 ? base * 0.55 : base
  }

  /**
   * Set while a question is on screen. **The market stops.**
   *
   * It used to throttle: the wave timer stretched by 14% and the wave shrank to
   * two or three — and `floorCount()` was never consulted, so the guaranteed six
   * to eight cuttable objects and the bomb spawner ran at full strength while
   * the child was doing arithmetic. The moment designated for thinking was the
   * busiest moment in the game.
   *
   * A designated thinking moment either pauses everything that competes for the
   * child's attention or it is not a thinking moment. So while this is set the
   * director launches nothing at all: no waves, no floor top-up, no bombs, no
   * further sigils, and no rush may open across it. Objects already in the air
   * finish their arcs and retire; the field empties in about two seconds and
   * stays empty until the question is settled.
   *
   * That is also, quietly, the whole stakes model. The hush lasts exactly as
   * long as the question does, so letting a sigil expire costs the child every
   * second of market they could have been cutting — which is how a timeout comes
   * to cost *more* than an honest wrong answer without ever costing a lamp. See
   * `economy.ts`, `marketHushSeconds`.
   */
  quiet = false

  /** Seconds of the post-question surge remaining. */
  surgeLeft = 0

  /**
   * The question settled. Let the breath out, and do not fire the next sigil
   * straight into the child's face.
   *
   * The settle gap matters more than it looks: `nextSigilIn` used to keep
   * counting down through the whole live question, so it was always due the
   * instant the question resolved. With a comprehension-sized window that would
   * put the next tablet in the air before the favour wave had finished
   * sweeping, forever.
   */
  settleQuestion(): void {
    this.surgeLeft = 2.6
    this.nextSigilIn = Math.max(this.nextSigilIn, this.sigilInterval() * 0.85)
  }

  private sigilInterval(): number {
    return 6.2 - this.heat * 2.6
  }

  private waveSize(): number {
    if (this.rushLeft > 0) return this.rng.int(4, 7)
    const h = this.heat
    // Never one lonely object: an empty screen in the first ten seconds is the
    // difference between "a game" and "a worksheet with a countdown".
    const lo = 3 + Math.floor(h * 3) + (this.surgeLeft > 0 ? 2 : 0)
    const hi = 4 + Math.floor(h * 4) + (this.surgeLeft > 0 ? 3 : 0)
    return this.rng.int(lo, hi)
  }

  private omegaCap(): number {
    // How deep a factor tree may be. Starts at 2 (one cut, then two primes) and
    // climbs past 5 — a 288 is 2·2·2·2·2·3·3, a genuine cascade.
    const h = this.heat
    if (this.rushLeft > 0) return Math.min(this.pool.maxOmega, 3 + Math.round(h * 3))
    return Math.min(this.pool.maxOmega, 2 + Math.round(h * 4))
  }

  /**
   * Magnitude ceiling. Three digits is the hard legibility limit on a 320px
   * screen, and the game walks up to it rather than starting there.
   */
  private valueCap(): number {
    return Math.round(48 + this.heat * 276) // 48 → 324
  }

  private bombChance(): number {
    if (this.rushLeft > 0) return 0 // a rush is a pure reward; never a trap
    if (this.elapsed < 14) return 0 // the opening is safe
    // Density roughly tripled, so the per-object rate has to come down or the
    // absolute number of bombs on screen triples with it.
    return Math.min(0.075, (this.elapsed - 14) / 1600)
  }

  private pickValue(): number {
    const cap = this.omegaCap()
    const vcap = this.valueCap()
    // Bias toward the deepest bucket allowed — cascades are the fun — but keep
    // primes in circulation at every heat so the payoff colour stays familiar.
    const r = this.rng.next()
    let w: number
    if (r < 0.16) w = 1
    else if (r < 0.42) w = Math.max(1, cap - 2)
    else if (r < 0.76) w = Math.max(1, cap - 1)
    else w = cap
    const bucket = this.pool.byOmega[Math.min(w, this.pool.byOmega.length - 1)] ?? this.pool.primes
    if (bucket.length === 0) return this.rng.pick(this.pool.primes)
    // Rejection-sample against the magnitude cap. Bounded: the smallest member
    // of every bucket the pool builds is under 48, so this always terminates.
    for (let i = 0; i < 8; i++) {
      const v = this.rng.pick(bucket)
      if (v <= vcap) return v
    }
    for (const v of bucket) if (v <= vcap) return v
    return this.rng.pick(this.pool.primes)
  }

  private pushWave(size: number): void {
    // A fanned band: consecutive objects in a wave land next to each other so
    // one stroke can take the set. The band is narrow when the wave is small.
    const bandCentre = this.rng.range(0.22, 0.78)
    // Wider than it used to be. With the density floor raised, a narrow fan put
    // seven gourds through the same 200px of a phone screen and they arrived as
    // one unreadable heap.
    const bandWidth = Math.min(0.88, 0.155 * size)
    const bombP = this.bombChance()
    for (let i = 0; i < size; i++) {
      const f = size === 1 ? 0.5 : i / (size - 1)
      const bandT = Math.max(0.06, Math.min(0.94, bandCentre + (f - 0.5) * bandWidth))
      const isBomb = this.rng.chance(bombP)
      this.queue.push({
        kind: isBomb ? "bomb" : "numeral",
        value: isBomb ? 0 : this.pickValue(),
        delayMs: 0,
        bandT,
        apex: this.rng.range(0.58, 0.84),
      })
      this.queueT.push(i * this.rng.range(55, 130))
    }
  }

  /**
   * Advance. Returns the throws that should happen *now*; the caller launches
   * them. Never allocates on a frame with nothing to launch.
   *
   * @param live how many cuttable objects are currently in the air — the
   *        density floor is enforced against this, not against a timer.
   */
  step(dt: number, out: Throw[], live = 0): number {
    this.elapsed += dt
    let n = 0

    // ── the hush ────────────────────────────────────────────────────────────
    //
    // Nothing is launched, nothing is queued, and no timer moves. Heat still
    // climbs with `elapsed`, because heat is how long the child has been playing
    // and thinking is playing — but every clock that would *put something on
    // screen* is frozen, including the rush. A rush opening over a live equation
    // would be the loudest possible contradiction of the word "quiet".
    if (this.quiet) return 0

    if (this.surgeLeft > 0) this.surgeLeft -= dt

    if (this.rushLeft > 0) {
      this.rushLeft -= dt
      // The crest passed and the board is coming down. THE SPLIT has no
      // levels and no ending, so the settle after a rush is the only place in
      // it a child is finished with something rather than interrupted.
      if (this.rushLeft <= 0) this.rushJustEnded = true
    }

    // A rush opens *before* the frame's throws are released, so the very first
    // objects of a rush are already rush objects.
    this.nextRushIn -= dt
    if (this.nextRushIn <= 0 && this.rushLeft <= 0 && this.elapsed > FIRST_RUSH_AT - 4) {
      this.rushCount++
      // Every rush is longer than the last, forever: 8s, 8.9s, 9.8s … and the
      // gap between them closes from ~62s toward ~40s.
      this.rushLeft = Math.min(20, 8 + this.rushCount * 0.9)
      this.rushJustStarted = true
      const gap = Math.max(40, 68 - this.rushCount * 2.4)
      this.nextRushIn = gap * this.rng.range(0.88, 1.14)
    }

    // Release anything whose stagger has elapsed.
    for (let i = 0; i < this.queue.length; i++) {
      const t = (this.queueT[i] as number) - dt * 1000
      this.queueT[i] = t
      if (t <= 0) {
        const th = this.queue[i] as Throw
        // "MARKET RUSH — no bombs, cut everything" has to be literally true. A
        // bomb queued in the second before a rush began would otherwise land
        // inside it and take a lamp, which makes the banner a lie.
        if (th.kind === "bomb" && this.rushLeft > 0) {
          th.kind = "numeral"
          th.value = this.pickValue()
        }
        out[n++] = th
        this.queue.splice(i, 1)
        this.queueT.splice(i, 1)
        i--
        if (n >= out.length) break
      }
    }

    const inFlight = live + this.queue.length
    const ceiling = this.ceilingCount()

    // ── the floor. Checked every frame, ahead of the timer. ──────────────────
    const floor = this.floorCount()
    if (inFlight < floor) {
      // Top up to the floor with a *little* headroom so the field does not
      // flicker in and out of starvation once per wave.
      this.pushWave(Math.max(2, Math.min(6, floor - inFlight + 1)))
      // Do not also fire the scheduled wave on the same frame.
      this.nextWaveIn = Math.max(this.nextWaveIn, this.waveInterval() * 0.6)
    }

    this.nextWaveIn -= dt
    if (this.nextWaveIn <= 0) {
      this.nextWaveIn = this.waveInterval() * this.rng.range(0.82, 1.2)
      if (inFlight < ceiling) this.pushWave(this.waveSize())
    }

    this.nextSigilIn -= dt
    if (this.nextSigilIn <= 0) {
      // Roughly one sigil every 6.2s at the start, closing to 3.6s. The caller
      // may refuse the launch (a tablet is already in the air, or a question is
      // live); `sigilRefused` reschedules it in a moment rather than dropping
      // it, which is what used to stretch the real gap out to 10.6 seconds.
      this.nextSigilIn = this.sigilInterval() * this.rng.range(0.92, 1.1)
      this.queue.push({
        kind: "sigil",
        value: 0,
        delayMs: 0,
        bandT: this.rng.range(0.28, 0.72),
        apex: this.rng.range(0.62, 0.78),
      })
      this.queueT.push(0)
    }

    return n
  }

  /** The caller could not launch the sigil; try again shortly. */
  sigilRefused(): void {
    this.nextSigilIn = Math.min(this.nextSigilIn, 0.45)
  }

  /** Set on the frame a rush starts; the caller reads and clears it. */
  rushJustStarted = false
  /** Set on the frame a rush finishes. Read and cleared the same way. */
  rushJustEnded = false
}
