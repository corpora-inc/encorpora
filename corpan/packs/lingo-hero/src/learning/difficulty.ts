/**
 * learning/difficulty.ts — Gentle adaptive difficulty for Lingo Hero.
 *
 * STREAM: learning. Pure, side-effect-free math. Tracks a rolling window of
 * recent wave outcomes and derives a 0..1 "difficulty" signal that the learning
 * layer can use to bias content selection (e.g. how aggressively to resurface
 * weak/due words vs. let fresh content flow).
 *
 * IMPORTANT — scope of "difficulty": the foundation owns NOTE_TRAVEL_SECONDS and
 * we must NOT make the game impossible again (the calibrated ~7s travel feel is
 * a hard non-regression). This module therefore does NOT touch note speed or
 * spawn timing. "Difficulty" here means *content* difficulty: when the learner
 * is hot, lean harder into due/weak resurfacing and more believable distractors;
 * when they're struggling, ease off and let familiar/fresh words breathe. It is
 * a comfort dial on the LEARNING curve, never on the playability curve.
 *
 * The curve is deliberately gentle and hysteretic: it ramps up slowly on
 * success and backs off quickly on a rough patch, so the learner is challenged
 * but never punished into a spiral. Defaults give a calm, encouraging ride.
 */

export interface DifficultyConfig {
  /** How many recent outcomes feed the rolling accuracy. */
  windowSize: number;
  /** EWMA smoothing for the difficulty signal (0..1; lower = smoother). */
  smoothing: number;
  /** Accuracy at/above which difficulty ramps up. */
  hotAccuracy: number;
  /** Accuracy at/below which difficulty eases off (back off fast). */
  coldAccuracy: number;
}

export const DEFAULT_DIFFICULTY: DifficultyConfig = {
  windowSize: 8,
  smoothing: 0.25,
  hotAccuracy: 0.8,
  coldAccuracy: 0.5,
};

export class AdaptiveDifficulty {
  private readonly window: boolean[] = [];
  /** 0 = easiest content bias, 1 = hardest. Starts neutral-low (encouraging). */
  private signal = 0.3;

  constructor(private readonly cfg: DifficultyConfig = DEFAULT_DIFFICULTY) {}

  /** Reset to a fresh, encouraging baseline (call on run start). */
  reset(): void {
    this.window.length = 0;
    this.signal = 0.3;
  }

  /** Feed one resolved wave outcome. Updates the rolling window + signal. */
  record(correct: boolean): void {
    this.window.push(correct);
    if (this.window.length > this.cfg.windowSize) this.window.shift();

    const acc = this.accuracy();
    // Target difficulty derived from how far accuracy sits in the comfort band.
    let target: number;
    if (acc >= this.cfg.hotAccuracy) {
      // Hot: ramp toward harder, scaled by how far above the threshold we are.
      const span = 1 - this.cfg.hotAccuracy || 1;
      target = 0.6 + 0.4 * ((acc - this.cfg.hotAccuracy) / span);
    } else if (acc <= this.cfg.coldAccuracy) {
      // Cold: ease toward easier, scaled by how far below we are.
      const span = this.cfg.coldAccuracy || 1;
      target = 0.15 * (acc / span);
    } else {
      // In-band: gently settle toward the middle.
      target = 0.45;
    }

    // Asymmetric hysteresis: ease DOWN quickly (be kind), ramp UP slowly.
    const k = target < this.signal ? Math.min(1, this.cfg.smoothing * 2) : this.cfg.smoothing;
    this.signal = clamp01(this.signal + (target - this.signal) * k);
  }

  /** Rolling accuracy over the window (0..1). Neutral 0.7 before enough data. */
  accuracy(): number {
    if (this.window.length === 0) return 0.7;
    const hits = this.window.reduce((n, ok) => n + (ok ? 1 : 0), 0);
    return hits / this.window.length;
  }

  /** Current content-difficulty signal in [0,1]. */
  get value(): number {
    return this.signal;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
