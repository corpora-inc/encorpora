/**
 * Quality tiers. The mid-range tablet sets the FLOOR, never the ceiling.
 *
 * ULTRA is allowed to be genuinely staggering; LOW degrades to something that
 * still reads as the same game — same silhouettes, same colours, same
 * information — just with fewer photons. A live probe demotes (never promotes)
 * so a phone that thermally throttles ten minutes in does not start dropping
 * frames, it drops fidelity.
 */

export type TierName = "low" | "mid" | "ultra";

export type Tier = {
  name: TierName;
  dprCap: number;
  antialias: boolean;
  shadows: boolean;
  shadowSize: number;
  bloom: boolean;
  bloomDiv: number;
  particles: number;
  motes: number;
  debris: number;
  spireBands: number;
  grain: boolean;
  /** Slabs kept alive below the camera. */
  slabPool: number;
};

export const TIERS: Record<TierName, Tier> = {
  low: {
    name: "low",
    dprCap: 1,
    antialias: false,
    shadows: false,
    shadowSize: 0,
    bloom: false,
    bloomDiv: 4,
    particles: 190,
    motes: 60,
    debris: 10,
    spireBands: 2,
    grain: false,
    slabPool: 24,
  },
  mid: {
    name: "mid",
    dprCap: 1.5,
    antialias: true,
    shadows: true,
    shadowSize: 512,
    bloom: true,
    bloomDiv: 4,
    particles: 460,
    motes: 130,
    debris: 18,
    spireBands: 3,
    grain: true,
    slabPool: 30,
  },
  ultra: {
    name: "ultra",
    dprCap: 2,
    antialias: true,
    shadows: true,
    shadowSize: 1024,
    bloom: true,
    bloomDiv: 2,
    particles: 1000,
    motes: 240,
    debris: 30,
    spireBands: 3,
    grain: true,
    slabPool: 36,
  },
};

export function detectTier(): Tier {
  if (typeof navigator === "undefined") return TIERS.mid;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const px = typeof screen !== "undefined" ? screen.width * screen.height * dpr * dpr : 1e6;

  if (cores <= 4 || mem <= 3) return TIERS.low;
  if (cores >= 8 && mem >= 8 && px < 9.5e6) return TIERS.ultra;
  return TIERS.mid;
}

/** Rolling frame-time watchdog. Demotes once, then stops fiddling. */
export class TierWatch {
  private acc = 0;
  private n = 0;
  private demotions = 0;
  private grace = 1.6;
  private onDemote: (t: Tier) => void;

  constructor(onDemote: (t: Tier) => void) {
    this.onDemote = onDemote;
  }

  sample(dt: number, current: Tier): void {
    if (this.grace > 0) {
      this.grace -= dt;
      return;
    }
    if (this.demotions >= 2) return;
    this.acc += dt;
    this.n++;
    if (this.n < 90) return;
    const avg = this.acc / this.n;
    this.acc = 0;
    this.n = 0;
    if (avg > 0.0205) {
      const next = current.name === "ultra" ? TIERS.mid : current.name === "mid" ? TIERS.low : null;
      if (next) {
        this.demotions++;
        this.grace = 2.5;
        console.info(`[stack] frame budget missed (${(avg * 1000).toFixed(1)}ms) — dropping to ${next.name}`);
        this.onDemote(next);
      } else {
        this.demotions = 2;
      }
    }
  }
}

/** Live fps meter for the on-screen readout and the perf report. */
export class FpsMeter {
  private samples = new Float32Array(120);
  private i = 0;
  private filled = 0;
  fps = 60;
  p95 = 16.7;
  push(dt: number): void {
    this.samples[this.i] = dt;
    this.i = (this.i + 1) % this.samples.length;
    if (this.filled < this.samples.length) this.filled++;
    if (this.i % 15 !== 0) return;
    let sum = 0;
    for (let k = 0; k < this.filled; k++) sum += this.samples[k]!;
    this.fps = this.filled / Math.max(1e-6, sum);
    // p95 frame time without sorting the whole buffer every time.
    let worst = 0;
    let second = 0;
    let count = 0;
    for (let k = 0; k < this.filled; k++) {
      const v = this.samples[k]!;
      if (v > worst) {
        second = worst;
        worst = v;
      } else if (v > second) second = v;
      count++;
    }
    void count;
    this.p95 = second * 1000;
  }
}
