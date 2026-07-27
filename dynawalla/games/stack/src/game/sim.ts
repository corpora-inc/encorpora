/**
 * MONUMENT — the simulation.
 *
 * Deliberately free of THREE, the DOM and time-of-day: every rule that decides
 * whether a run lives or dies is here, so it can be tested at 10,000 floors a
 * second without a GPU.
 *
 * The loop, in one paragraph: a slab sweeps back and forth above the tower.
 * Its face shows one value from a shuffled set — the true answer to the prompt
 * plus mal-rule decoys — and the value changes only at a turnaround, so you get
 * a whole pass to read it. One tap places it. The overhang shears off, exactly
 * as in Stack. If the value was ALSO the right answer and you were inside the
 * tolerance, the slab instead SNAPS true and the tower grows back. If the value
 * was wrong the slab cracks and takes a second bite out of the width. Nothing
 * is ever explained to you; the monument just gets thinner, and you can see it.
 */

import type { Host, Question } from "../contract.ts";
import {
  T,
  difficultyFor,
  holdMs,
  perfectTol,
  slotsFor,
  swayAmp,
  sweepSpeed,
} from "./tuning.ts";

export type Axis = 0 | 1; // 0 = X, 1 = Z
export type Phase = "sweep" | "over" | "revive";
export type Outcome = "perfect" | "good" | "wrong" | "miss";

export type Slab = {
  /** Course index; 0 is the foundation. */
  i: number;
  cx: number;
  cz: number;
  wx: number;
  wz: number;
  /** Value written on its face (empty for the foundation). */
  label: string;
  /** True when this course was placed dead true. */
  perfect: boolean;
  /** Set when the course was placed on a wrong value. */
  cracked: boolean;
};

export type PlaceEvent = {
  type: "place";
  outcome: Outcome;
  slab: Slab;
  /** The piece that sheared off, or null. */
  shear: { cx: number; cz: number; wx: number; wz: number; sign: number; axis: Axis } | null;
  /** Signed misalignment along the placement axis, in world units. */
  delta: number;
  combo: number;
  answered: string;
  correct: boolean;
};
export type SimEvent =
  | PlaceEvent
  | { type: "stratum"; index: number }
  | { type: "collapse" }
  | { type: "revive"; ok: boolean }
  | { type: "tick"; slot: number; value: string }
  | { type: "restart" };

const shearScratch = { cx: 0, cz: 0, wx: 0, wz: 0, sign: 1, axis: 0 as Axis };

export class Sim {
  readonly host: Host;

  /** Every course placed, oldest first. Trimmed from the bottom by the view. */
  slabs: Slab[] = [];
  floor = 0;
  best = 0;
  wx: number = T.START_W;
  wz: number = T.START_W;
  cx = 0;
  cz = 0;
  axis: Axis = 0;

  phase: Phase = "sweep";
  question!: Question;
  /** Shuffled [answer, ...distractors]; one is showing at a time. */
  slots: string[] = [];
  slot = 0;
  questionAt = 0;

  /** Sweep, in world units along `axis`, relative to the tower centre line. */
  sweep = 0;
  dir: 1 | -1 = 1;
  holdLeft = 0;
  cyclesIdle = 0;
  dither = 1;
  private startSide: 1 | -1 = 1;

  combo = 0;
  bestCombo = 0;
  perfects = 0;
  placed = 0;
  correctCount = 0;

  swayExcite = 0;
  swayT = 0;
  swayX = 0;
  swayZ = 0;

  /**
   * After a wrong value the equation completes itself for a beat instead of
   * being marked wrong. The sweep is held for the same beat so the player is
   * never reading one thing while aiming at another.
   */
  revealPrompt: string | null = null;
  revealAnswer: string | null = null;
  revealLeft = 0;

  stratum = 0;
  revives = 0;
  reviveQ: Question | null = null;
  reviveChoices: string[] = [];

  events: SimEvent[] = [];

  private rngState = 0x9e3779b9;

  constructor(host: Host, seed = 0x51ab) {
    this.host = host;
    this.rngState = seed >>> 0;
    this.reset();
  }

  private rnd(): number {
    let a = (this.rngState = (this.rngState + 0x6d2b79f5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  reset(): void {
    this.slabs.length = 0;
    this.floor = 0;
    this.wx = T.START_W;
    this.wz = T.START_W;
    this.cx = 0;
    this.cz = 0;
    this.axis = 0;
    this.phase = "sweep";
    this.combo = 0;
    this.bestCombo = 0;
    this.perfects = 0;
    this.placed = 0;
    this.correctCount = 0;
    this.swayExcite = 0;
    this.swayT = 0;
    this.swayX = 0;
    this.swayZ = 0;
    this.stratum = 0;
    this.revives = 0;
    this.reviveQ = null;
    this.cyclesIdle = 0;
    this.dither = 1;
    this.startSide = 1;
    this.slabs.push({ i: 0, cx: 0, cz: 0, wx: this.wx, wz: this.wz, label: "", perfect: false, cracked: false });
    this.nextQuestion();
    this.events.push({ type: "restart" });
  }

  /* ── derived ──────────────────────────────────────────────────────────── */

  get topY(): number {
    return this.floor * T.SLAB_H;
  }
  /** Height of the surface the next course lands on. */
  get placeY(): number {
    return (this.floor + 1) * T.SLAB_H;
  }
  get value(): string {
    return this.slots[this.slot] ?? "";
  }
  get valueIsAnswer(): boolean {
    return this.value === this.question.answer;
  }
  get width(): number {
    return Math.min(this.wx, this.wz);
  }
  /** 0 → brand new, 1 → one bad drop from a collapse. Drives the danger read. */
  get peril(): number {
    const span = T.START_W - T.DEATH_W;
    return Math.max(0, Math.min(1, 1 - (this.width - T.DEATH_W) / span));
  }
  get amplitude(): number {
    return swayAmp(this.floor, this.swayExcite);
  }
  /** Half the travel of the sweep, in world units. */
  get sweepHalf(): number {
    return (this.axis === 0 ? this.wx : this.wz) * 0.5 + T.SWEEP_MARGIN;
  }

  /** Horizontal displacement of the tower at normalised height `u` ∈ [0,1]. */
  bendX(u: number): number {
    return this.swayX * u * u * (3 - 2 * u);
  }
  bendZ(u: number): number {
    return this.swayZ * u * u * (3 - 2 * u);
  }

  /* ── question plumbing ────────────────────────────────────────────────── */

  private nextQuestion(): void {
    const n = slotsFor(this.floor);
    this.question = this.host.next({ difficulty: difficultyFor(this.floor) });
    const vals: string[] = [this.question.answer];
    for (const d of this.question.distractors) {
      if (vals.length >= n) break;
      if (d !== this.question.answer && !vals.includes(d)) vals.push(d);
    }
    // Fisher–Yates with the sim's own stream so a seeded run replays exactly.
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      const t = vals[i]!;
      vals[i] = vals[j]!;
      vals[j] = t;
    }
    this.slots = vals;
    this.slot = 0;
    this.questionAt = 0;
    this.cyclesIdle = 0;
    this.dither = 1;
    this.startSide = (-this.startSide) as 1 | -1;
    const half = this.sweepHalf;
    this.sweep = this.startSide * half;
    this.dir = (-this.startSide) as 1 | -1;
    this.holdLeft = Math.max(holdMs(this.floor) / 1000, this.revealLeft);
    this.events.push({ type: "tick", slot: this.slot, value: this.value });
  }

  /* ── stepping ─────────────────────────────────────────────────────────── */

  /** `dt` in seconds, already scaled by hit-stop and any slow-motion. */
  update(dt: number, elapsed: number): void {
    if (this.revealLeft > 0) {
      this.revealLeft -= dt;
      if (this.revealLeft <= 0) {
        this.revealLeft = 0;
        this.revealPrompt = null;
        this.revealAnswer = null;
      }
    }
    // Sway runs in every phase — a collapsing tower still whips.
    this.swayT += dt;
    this.swayExcite = Math.max(0, this.swayExcite - this.swayExcite * T.SWAY_DECAY * dt);
    const amp = this.amplitude;
    this.swayX = amp * Math.sin(this.swayT * Math.PI * 2 * T.SWAY_HZ_A);
    this.swayZ = amp * Math.sin(this.swayT * Math.PI * 2 * T.SWAY_HZ_B + 1.1);

    if (this.phase !== "sweep") return;
    if (this.questionAt === 0) this.questionAt = elapsed;

    if (this.holdLeft > 0) {
      this.holdLeft -= dt;
      return;
    }

    const half = this.sweepHalf;
    const v = sweepSpeed(this.floor, this.dither);
    this.sweep += this.dir * v * dt;

    if (this.sweep >= half || this.sweep <= -half) {
      this.sweep = this.sweep > 0 ? half : -half;
      this.dir = (-this.dir) as 1 | -1;
      this.holdLeft = holdMs(this.floor) / 1000;
      this.slot = (this.slot + 1) % this.slots.length;
      if (this.slot === 0) {
        this.cyclesIdle++;
        if (this.cyclesIdle >= T.DITHER_CYCLES) {
          this.dither = Math.min(T.DITHER_MAX, this.dither + T.DITHER_STEP);
        }
      }
      this.events.push({ type: "tick", slot: this.slot, value: this.value });
    }
  }

  /* ── the tap ──────────────────────────────────────────────────────────── */

  place(elapsed: number): PlaceEvent | null {
    if (this.phase !== "sweep") return null;

    const axis = this.axis;
    const prevW = axis === 0 ? this.wx : this.wz;
    const otherW = axis === 0 ? this.wz : this.wx;
    const u = 1; // the top of the tower
    const swayHere = axis === 0 ? this.bendX(u) : this.bendZ(u);
    const prevC = (axis === 0 ? this.cx : this.cz) + swayHere;

    const answered = this.value;
    const correct = answered === this.question.answer;
    const delta = this.sweep - prevC;
    const overlap = prevW - Math.abs(delta);
    const tol = perfectTol(this.floor);

    let outcome: Outcome;
    let newW: number;
    let newC: number;
    let shear: PlaceEvent["shear"] = null;

    if (overlap <= 0) {
      outcome = "miss";
      newW = prevW * T.MISS_KEEP;
      newC = prevC;
      this.combo = 0;
      this.swayExcite += T.SWAY_SHOCK_MISS;
      this.host.haptic("failure");
    } else {
      if (Math.abs(delta) > 1e-9 && overlap < prevW) {
        // Everything outside the overlap falls away — the signature of the form.
        const sign = delta > 0 ? 1 : -1;
        const w = prevW - overlap;
        shearScratch.wx = axis === 0 ? w : this.wx;
        shearScratch.wz = axis === 0 ? this.wz : w;
        shearScratch.cx = axis === 0 ? this.sweep + sign * (prevW - w) * 0.5 : this.cx;
        shearScratch.cz = axis === 0 ? this.cz : this.sweep + sign * (prevW - w) * 0.5;
        shearScratch.sign = sign;
        shearScratch.axis = axis;
        shear = { ...shearScratch };
      }

      if (correct && Math.abs(delta) <= tol) {
        outcome = "perfect";
        this.combo++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.perfects++;
        const grow = Math.min(T.GROW_MAX, T.GROW_BASE + (this.combo - 1) * T.GROW_PER_COMBO);
        newW = Math.min(T.MAX_W, prevW + grow);
        newC = prevC; // snap dead true
        shear = null;
        this.swayExcite *= T.SWAY_CALM_PERFECT;
        this.host.haptic("success");
      } else if (correct) {
        outcome = "good";
        this.combo = 0;
        newW = overlap;
        newC = prevC + delta * 0.5;
        this.host.haptic("light");
      } else {
        outcome = "wrong";
        this.combo = 0;
        newW = overlap * T.WRONG_SHEAR;
        newC = prevC + delta * 0.5;
        this.swayExcite += T.SWAY_SHOCK_WRONG;
        this.host.haptic("heavy");
      }
    }

    this.host.report({
      questionId: this.question.id,
      correct,
      ms: Math.max(0, Math.round((elapsed - this.questionAt) * 1000)),
      answered,
    });
    if (correct) this.correctCount++;
    this.placed++;

    const advanced = outcome !== "miss";
    if (axis === 0) {
      this.wx = newW;
      this.cx = newC;
    } else {
      this.wz = newW;
      this.cz = newC;
    }

    let slab: Slab;
    if (advanced) {
      this.floor++;
      slab = {
        i: this.floor,
        cx: this.cx,
        cz: this.cz,
        wx: this.wx,
        wz: this.wz,
        label: answered,
        perfect: outcome === "perfect",
        cracked: outcome === "wrong",
      };
      this.slabs.push(slab);
      this.best = Math.max(this.best, this.floor);
      // The tower below keeps the width it was built with; only the top course
      // carries the new one, exactly like the original.
      this.axis = axis === 0 ? 1 : 0;
    } else {
      // A miss places nothing. The course you were standing on just got bitten.
      const top = this.slabs[this.slabs.length - 1]!;
      top.wx = this.wx;
      top.wz = this.wz;
      slab = top;
    }

    const ev: PlaceEvent = {
      type: "place",
      outcome,
      slab,
      shear,
      delta,
      combo: this.combo,
      answered,
      correct,
    };
    this.events.push(ev);

    void otherW;

    if (this.width < T.DEATH_W) {
      this.phase = "over";
      this.events.push({ type: "collapse" });
      return ev;
    }

    if (!correct) {
      this.revealPrompt = this.question.prompt;
      this.revealAnswer = this.question.answer;
      this.revealLeft = 0.85;
    }

    const band = Math.floor(this.floor / T.STRATUM_FLOORS);
    if (band !== this.stratum) {
      const climbing = band > this.stratum;
      this.stratum = band;
      this.events.push({ type: "stratum", index: band });
      // Eight floors of tower, and the rock under it changes. MONUMENT's
      // chapter break. Only on the way UP: a stratum lost is not an ending
      // a child reached, and nothing may be shown after one.
      if (climbing) {
        try {
          this.host.transition?.("level", `stratum ${band}`);
        } catch {
          /* a host that throws on a stopping point must not kill the run */
        }
      }
    }

    this.nextQuestion();
    return ev;
  }

  /* ── shore it up (math where an F2P game would show an ad) ────────────── */

  offerRevive(): void {
    if (this.phase !== "over") return;
    this.phase = "revive";
    this.reviveQ = this.host.next({ difficulty: Math.max(1, difficultyFor(this.floor) - 1) });
    const vals = [this.reviveQ.answer, ...this.reviveQ.distractors.slice(0, 3)];
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      const t = vals[i]!;
      vals[i] = vals[j]!;
      vals[j] = t;
    }
    this.reviveChoices = vals;
  }

  answerRevive(choice: string, elapsed: number): boolean {
    if (this.phase !== "revive" || !this.reviveQ) return false;
    const ok = choice === this.reviveQ.answer;
    this.host.report({
      questionId: this.reviveQ.id,
      correct: ok,
      ms: Math.max(0, Math.round(elapsed * 1000)),
      answered: choice,
    });
    this.events.push({ type: "revive", ok });
    if (!ok) {
      this.host.haptic("failure");
      this.phase = "over";
      this.reviveQ = null;
      return false;
    }
    this.host.haptic("success");
    this.revives++;
    // Shoring up is always available and always costs one correct answer, but
    // it restores less every time and bottoms out just above the death width —
    // so a long chain of revives ends by itself rather than by a rule. A five
    // minute soak reached floor 76 on thirteen revives before this; a revive
    // that keeps handing back a comfortable tower is not a stake.
    const w = Math.max(T.DEATH_W * 1.45, T.START_W * Math.pow(T.REVIVE_WIDTH_FACTOR, this.revives));
    this.wx = w;
    this.wz = w;
    const top = this.slabs[this.slabs.length - 1]!;
    top.wx = w;
    top.wz = w;
    this.cx = top.cx;
    this.cz = top.cz;
    this.swayExcite = 0;
    this.combo = 0;
    this.reviveQ = null;
    this.phase = "sweep";
    this.nextQuestion();
    return true;
  }

  drain(into: SimEvent[]): void {
    for (let i = 0; i < this.events.length; i++) into.push(this.events[i]!);
    this.events.length = 0;
  }
}
