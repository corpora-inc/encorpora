/**
 * Frame budget and the thermal ladder.
 *
 * Target device is the Galaxy Tab A9 at 60 fps. If RAF frame time p90 exceeds
 * 20 ms for three seconds we drop a tier. Automatic, silent, never announced —
 * a status line telling a child their tablet is slow is wasted UI copy and
 * a small cruelty besides.
 *
 *   tier 1  dust, steam, heat shimmer and reflections go
 *   tier 2  the far layers merge into one pre-rendered bitmap; pigeons and
 *           cats freeze
 *   tier 3  the centred preview falls back to its poster; the street is a
 *           still painting
 *
 * Recovery needs ten seconds below 14 ms p90, so it cannot oscillate.
 */

export interface Budget {
  dust: boolean;
  steam: boolean;
  shimmer: boolean;
  reflections: boolean;
  farParallax: boolean;
  fauna: boolean;
  livePreview: boolean;
  maxMotes: number;
}

const BUDGETS: Budget[] = [
  { dust: true, steam: true, shimmer: true, reflections: true, farParallax: true, fauna: true, livePreview: true, maxMotes: 60 },
  { dust: false, steam: false, shimmer: false, reflections: false, farParallax: true, fauna: true, livePreview: true, maxMotes: 0 },
  { dust: false, steam: false, shimmer: false, reflections: false, farParallax: false, fauna: false, livePreview: true, maxMotes: 0 },
  { dust: false, steam: false, shimmer: false, reflections: false, farParallax: false, fauna: false, livePreview: false, maxMotes: 0 },
];

export class PerfGovernor {
  private samples: number[] = [];
  private tier = 0;
  private overSince = 0;
  private underSince = 0;
  private last = 0;
  private smallScreen = false;

  /** Phones halve the mote budget before anything is measured. */
  setSmallScreen(v: boolean): void {
    this.smallScreen = v;
  }

  sample(frameMs: number, now: number): void {
    this.samples.push(frameMs);
    if (this.samples.length > 120) this.samples.shift();
    if (now - this.last < 250) return;
    this.last = now;
    const p90 = percentile(this.samples, 0.9);
    if (p90 > 20) {
      this.underSince = 0;
      if (!this.overSince) this.overSince = now;
      else if (now - this.overSince > 3000 && this.tier < BUDGETS.length - 1) {
        this.tier++;
        this.overSince = now;
      }
    } else if (p90 < 14) {
      this.overSince = 0;
      if (!this.underSince) this.underSince = now;
      else if (now - this.underSince > 10_000 && this.tier > 0) {
        this.tier--;
        this.underSince = now;
      }
    } else {
      this.overSince = 0;
      this.underSince = 0;
    }
  }

  get budget(): Budget {
    const b = BUDGETS[this.tier]!;
    return this.smallScreen ? { ...b, maxMotes: Math.round(b.maxMotes * 0.4) } : b;
  }

  get level(): number {
    return this.tier;
  }

  get p90(): number {
    return percentile(this.samples, 0.9);
  }

  get fps(): number {
    if (!this.samples.length) return 0;
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return mean > 0 ? 1000 / mean : 0;
  }
}

function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]!;
}
