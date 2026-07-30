// The director — what gets thrown, when, and how many.
//
// ── what this file used to promise, and why it was wrong ────────────────────
//
// It used to open with a twenty-five line defence of a *density contract*: a
// `floorCount()` that "tops the field up the instant it drops below" a hard
// minimum, so "the market never stops breathing". Measured against the shipped
// build, that doctrine produced a median of 7 and a p90 of 25 simultaneously
// cuttable objects, a maximum of 34, and sixteen on screen at thirteen seconds.
//
//   "our current implementation has like NNNNNNNNNNNNNN things come out at the
//    same time so the best strategy right now is to mindlessly swipe randomly"
//
// The doctrine was the bug. Fruit Ninja Classic opens with one or two fruit and
// clear air between waves, and that air is not a defect in it — it is
// anticipation, and it is thinking time. So:
//
//   * `floorCount()` is GONE. There is no minimum number of objects and an empty
//     screen is tolerated, and at the calm end desirable.
//   * the ceiling is a HARD PER-OBJECT CAP enforced at launch, not a per-wave
//     gate. The old `if (inFlight < ceiling) pushWave(waveSize())` admitted a
//     wave of seven the moment the field was one under the cap, which is how a
//     ceiling of 21 produced a p90 of 25.
//   * the automatic factor cascade is gone, so cutting things is no longer how
//     you get more things to cut.
//
// ── what replaces it: the OFFER INVARIANT ───────────────────────────────────
//
// The one thing this file still guarantees is not about density at all. It is
// that **a numeral which advances the child's order is airborne, or arriving,
// and never more than `offerGap()` seconds away.** That is what makes the
// arithmetic unrushed without a clock anywhere: a child who needs forty seconds
// to see that 33 − 10 − 15 = 8 watches the market go by and the 8 is in it,
// again and again. Nothing expires. Missing costs exactly what missing costs in
// Fruit Ninja Zen, which is nothing.
//
// ── and the escalation is EVIDENCE, not a stopwatch ─────────────────────────
//
// `heat` — a pure function of `elapsed` — is gone. Root cause 3 of
// `PACING_AUDIT_2026-07.md`, and this file was one of the seventeen. Everything
// below rides `intensity`, which the mount computes from the shared flow
// controller out of orders filled and overshoots made. Minute nineteen is harder
// than minute three only if the child made it so.

import { countAt, valueAt } from "../../../../packs/shared/game-pacing/index.ts"
import { Rng } from "../core/rng.ts"

export type Phase = "calm" | "market" | "rush"

export type ThrowKind = "gourd" | "melon" | "bomb"

export type Throw = {
  kind: ThrowKind
  /** The printed value. Zero for a melon (contents chosen when it splits) and for a bomb. */
  value: number
  /** Non-empty on an ABSURD gourd: `π`, `−∞`, `½`. The glyph replaces the numeral. */
  glyph: string
  delayMs: number
  /** 0..1 across the launch band. */
  bandT: number
  /** Apex as a fraction of screen height. */
  apex: number
}

/**
 * What the market can see of the child's order, handed in once per frame.
 *
 * The director does not own an order and cannot classify anything — R1 lives in
 * `order.ts` and runs against the live residual at the moment of the cut. All
 * this needs is a set to offer from and a count of how much of it is already up.
 */
export type Market = {
  /** Cuttable objects currently in the air. */
  live: number
  /** How many of those carry a value that would advance the order right now. */
  frontierLive: number
  /** Values that would advance it. Never empty while an order is unfilled. */
  frontier: readonly number[]
  /** Everything the market may print at this rung, frontier members included. */
  printed: readonly number[]
  /** The residual, so the market can offer the exact finisher more often. */
  residual: number
}

/** Absurd glyphs. Not a whole number you can add — a real idea, cheaply made. */
export const ABSURDS: readonly string[] = ["π", "−∞", "½", "√2", "0.5", "⅓"]

/** Base length of a MARKET RUSH, in seconds. */
const RUSH_SECONDS = 8

export class Director {
  private rng: Rng
  elapsed = 0
  /**
   * The one axis, 0…1. Set by the mount from the shared flow controller; this
   * file never advances it, because a director that could raise its own
   * difficulty is a stopwatch wearing a different hat.
   */
  intensity = 0
  private nextWaveIn = 0.35
  /** Seconds the offer invariant has been unsatisfied. Bounded by `offerGap()`. */
  dryFor = 0
  rushLeft = 0
  private nextRushIn = 45
  private queue: Throw[] = []
  private queueT: number[] = []
  /** Values carried by queued gourds, so a queued offer counts as an offer. */
  private queueV: number[] = []
  rushCount = 0
  /** Set on the frame a rush starts / finishes; the caller reads and clears. */
  rushJustStarted = false
  rushJustEnded = false

  /**
   * Set while the child is being HELD: a completed sum on screen, or the bomb
   * gate open. The market stops outright — no waves, no bombs, no rush across
   * it, and the dry timer does not run, because a hold is the child's own time
   * and the invariant may not be charged for it.
   */
  quiet = false

  /** Seconds of the post-fill surge remaining. The breath let out. */
  surgeLeft = 0

  constructor(rng: Rng) {
    this.rng = rng
  }

  reset(): void {
    this.elapsed = 0
    this.intensity = 0
    this.nextWaveIn = 0.35
    this.dryFor = 0
    this.rushLeft = 0
    this.nextRushIn = 45
    this.rushCount = 0
    this.quiet = false
    this.surgeLeft = 0
    this.queue.length = 0
    this.queueT.length = 0
    this.queueV.length = 0
    this.rushJustStarted = false
    this.rushJustEnded = false
  }

  get phase(): Phase {
    if (this.rushLeft > 0) return "rush"
    return this.intensity > 0.34 ? "market" : "calm"
  }

  /**
   * Host difficulty for the order's target, 1…10. Rides the same axis as
   * everything else; there is no second opinion about how hard the child is
   * finding it.
   */
  questionDifficulty(): number {
    return Math.max(1, Math.min(10, Math.round(1 + this.intensity * 9)))
  }

  /**
   * How many objects the market *aims* for. Not a floor and not a promise: if
   * the child clears the field, the field stays clear until the next wave.
   */
  targetCount(): number {
    if (this.rushLeft > 0) return countAt(this.intensity, 4, 9)
    return countAt(this.intensity, 2, 9)
  }

  /**
   * THE HARD CAP, enforced per object at launch.
   *
   * 3 → 12, and the offer invariant below may add exactly one more when it has
   * to, so **13 is the largest field this game can ever put in front of a
   * child** — the design's number, against a measured p90 of 25 and a maximum of
   * 34 in the build the founder played.
   *
   * It is not a wave gate: `pushWave` computes its room from `inFlight` before
   * every single object it queues, and the melon split checks it before it is
   * allowed to split. "Children arrive after the check" is exactly how the old
   * ceiling was overshot by 50-100%.
   */
  hardCap(): number {
    if (this.rushLeft > 0) return countAt(this.intensity, 6, 12)
    return countAt(this.intensity, 3, 12)
  }

  /** The largest field the child can face: the cap, plus R3's one exception. */
  absoluteCap(): number {
    return this.hardCap() + 1
  }

  waveSize(): number {
    if (this.rushLeft > 0) return this.rng.int(2, Math.max(2, countAt(this.intensity, 3, 5)))
    const lo = countAt(this.intensity, 1, 4)
    const hi = countAt(this.intensity, 2, 6)
    return this.rng.int(lo, Math.max(lo, hi))
  }

  /** Air between waves. 1.9 s at the calm end — the air IS the thinking time. */
  waveInterval(): number {
    if (this.rushLeft > 0) return valueAt(this.intensity, 0.9, 0.5)
    const base = valueAt(this.intensity, 1.9, 0.6)
    return this.surgeLeft > 0 ? base * 0.62 : base
  }

  /**
   * R3's bound: the longest the child may go with nothing useful available.
   *
   * 1.2 s at the calm end and 4.0 s at the top. Read the direction carefully —
   * the CALM end gets offers MORE often, because a struggling child needs the
   * number they are looking for to keep coming back, and a fluent one is fine
   * hunting for it.
   */
  offerGap(): number {
    return valueAt(this.intensity, 1.2, 4.0)
  }

  /**
   * Per-object bomb probability.
   *
   * Zero at the calm end — a child who is finding it hard never meets one — and
   * it is deliberately NOT zero during a rush any more. "MARKET RUSH — no bombs,
   * cut everything" was the highest-scoring phase in the game and the one phase
   * in which indiscriminate swiping could not be punished; the banner told the
   * child to mash and the scoreboard agreed with it.
   */
  bombChance(): number {
    if (this.intensity < 0.12) return 0
    return Math.min(0.06, (this.intensity - 0.12) * 0.09)
  }

  /** A melon: no glyph, slower, and its contents are decided when it opens. */
  melonChance(): number {
    return valueAt(this.intensity, 0.1, 0.16)
  }

  /** `π`, `−∞`, `½`. Absent at the bottom, common at the top. */
  absurdChance(): number {
    return valueAt(this.intensity, 0, 0.14)
  }

  /**
   * The SIEVE interlude. During a rush only EVEN values advance an order, so the
   * market's loudest phase acquires a real filter at no cost to the flow. The
   * mount reads this; the director only decides when a rush is on.
   */
  get sieveOn(): boolean {
    return this.rushLeft > 0
  }

  /** The order was filled. Let the breath out. */
  settleOrder(): void {
    this.surgeLeft = 2.2
  }

  private pickPrinted(m: Market): number {
    // Uniform over the WHOLE printed set, frontier members included.
    //
    // Filling the non-reserved slots from decoys only would be a tell: the child
    // would learn that the newest gourd in a dry patch is the useful one and
    // stop reading. Drawing uniformly means helpful and decoy gourds arrive at
    // whatever rate the arithmetic itself dictates — which is the game.
    if (m.printed.length === 0) return 1
    return m.printed[Math.floor(this.rng.next() * m.printed.length)] as number
  }

  private pickFrontier(m: Market): number {
    if (m.frontier.length === 0) return this.pickPrinted(m)
    // Bias toward the exact finisher as the order closes: the last cut is the
    // one worth landing, and a child who has worked out that they need 8 should
    // meet an 8 fairly soon after.
    if (m.frontier.includes(m.residual) && this.rng.chance(0.35)) return m.residual
    return m.frontier[Math.floor(this.rng.next() * m.frontier.length)] as number
  }

  private push(t: Throw, delayMs: number): void {
    this.queue.push(t)
    this.queueT.push(delayMs)
    this.queueV.push(t.kind === "gourd" && t.glyph === "" ? t.value : 0)
  }

  /**
   * Queue a wave, checking the HARD CAP before every single object.
   *
   * `inFlight` is passed in and the room is computed from it, because the whole
   * point is that the cap is enforced per object rather than once per wave.
   */
  private pushWave(size: number, inFlight: number, reserveFrontier: boolean, m: Market): void {
    const cap = this.hardCap()
    const room = Math.max(0, cap - inFlight)
    const n = Math.min(size, room)
    if (n <= 0) return

    const bandCentre = this.rng.range(0.22, 0.78)
    const bandWidth = Math.min(0.7, 0.17 * n)
    const bombP = this.bombChance()
    const melonP = this.melonChance()
    const absurdP = this.absurdChance()

    for (let i = 0; i < n; i++) {
      const f = n === 1 ? 0.5 : i / (n - 1)
      const bandT = Math.max(0.06, Math.min(0.94, bandCentre + (f - 0.5) * bandWidth))
      const apex = this.rng.range(0.58, 0.84)
      const delay = i * this.rng.range(70, 170)

      if (i === 0 && reserveFrontier) {
        this.push(
          { kind: "gourd", value: this.pickFrontier(m), glyph: "", delayMs: 0, bandT, apex },
          delay,
        )
        continue
      }
      if (this.rng.chance(bombP)) {
        this.push({ kind: "bomb", value: 0, glyph: "", delayMs: 0, bandT, apex }, delay)
        continue
      }
      if (this.rng.chance(melonP)) {
        this.push({ kind: "melon", value: 0, glyph: "", delayMs: 0, bandT, apex }, delay)
        continue
      }
      if (this.rng.chance(absurdP)) {
        this.push(
          { kind: "gourd", value: 0, glyph: this.rng.pick(ABSURDS), delayMs: 0, bandT, apex },
          delay,
        )
        continue
      }
      this.push(
        { kind: "gourd", value: this.pickPrinted(m), glyph: "", delayMs: 0, bandT, apex },
        delay,
      )
    }
  }

  /** How many queued gourds carry a frontier value. */
  private queuedFrontier(m: Market): number {
    let n = 0
    for (const v of this.queueV) if (v > 0 && m.frontier.includes(v)) n++
    return n
  }

  /**
   * Milliseconds until the next queued frontier value is released, or Infinity.
   * Only the test reads this; it is how R3 is checked rather than believed.
   */
  nextFrontierEtaMs(m: Market): number {
    let best = Infinity
    for (let i = 0; i < this.queue.length; i++) {
      const v = this.queueV[i] as number
      if (v > 0 && m.frontier.includes(v)) best = Math.min(best, this.queueT[i] as number)
    }
    return best
  }

  /**
   * Advance. Returns the throws that should happen *now*.
   *
   * @param m what the market can see of the order. `m.live` is the real count of
   *        cuttable bodies, so the cap holds on a 320px phone exactly as it does
   *        on a desktop.
   */
  step(dt: number, out: Throw[], m: Market): number {
    this.elapsed += dt
    let n = 0

    // The hold. Nothing launched, nothing queued, no timer moves — including the
    // dry timer, because the child is reading a completed sum or answering the
    // gate, and neither is time the offer invariant may be charged for.
    if (this.quiet) return 0

    if (this.surgeLeft > 0) this.surgeLeft -= dt

    if (this.rushLeft > 0) {
      this.rushLeft -= dt
      if (this.rushLeft <= 0) this.rushJustEnded = true
    }

    this.nextRushIn -= dt
    if (this.nextRushIn <= 0) {
      if (this.rushLeft <= 0 && this.intensity > 0.3) {
        this.rushCount++
        this.rushLeft = Math.min(16, RUSH_SECONDS + this.rushCount * 0.7)
        this.rushJustStarted = true
        this.nextRushIn = Math.max(38, 62 - this.rushCount * 2) * this.rng.range(0.88, 1.14)
      } else {
        // Not eligible: re-arm rather than firing the instant intensity rises.
        this.nextRushIn = 12
      }
    }

    // Release anything whose stagger has elapsed.
    for (let i = 0; i < this.queue.length; i++) {
      const t = (this.queueT[i] as number) - dt * 1000
      this.queueT[i] = t
      if (t <= 0) {
        out[n++] = this.queue[i] as Throw
        this.queue.splice(i, 1)
        this.queueT.splice(i, 1)
        this.queueV.splice(i, 1)
        i--
        if (n >= out.length) break
      }
    }

    let inFlight = m.live + this.queue.length

    // ── R3, the only guarantee left in this file ────────────────────────────
    const available = m.frontierLive + this.queuedFrontier(m)
    if (available === 0 && m.frontier.length > 0) {
      this.dryFor += dt
      if (this.dryFor >= this.offerGap()) {
        const before = this.queue.length
        this.pushWave(this.waveSize(), inFlight, true, m)
        // The cap must never be allowed to starve the child of an option. If the
        // field is genuinely full of unhelpful gourds there is still room for
        // exactly one more, because a full screen with nothing useful on it is
        // the one state this design may not produce.
        if (this.queue.length === before) {
          this.push(
            {
              kind: "gourd",
              value: this.pickFrontier(m),
              glyph: "",
              delayMs: 0,
              bandT: this.rng.range(0.2, 0.8),
              apex: this.rng.range(0.6, 0.82),
            },
            0,
          )
        }
        inFlight = m.live + this.queue.length
        this.dryFor = 0
        this.nextWaveIn = Math.max(this.nextWaveIn, this.waveInterval() * 0.6)
      }
    } else {
      this.dryFor = 0
    }

    // ── the wave timer. Texture, not a promise. ─────────────────────────────
    this.nextWaveIn -= dt
    if (this.nextWaveIn <= 0) {
      this.nextWaveIn = this.waveInterval() * this.rng.range(0.82, 1.2)
      if (inFlight < this.targetCount()) {
        this.pushWave(this.waveSize(), inFlight, available === 0 && m.frontier.length > 0, m)
      }
    }

    return n
  }
}
