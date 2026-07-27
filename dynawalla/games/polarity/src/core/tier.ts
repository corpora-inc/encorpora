/**
 * Quality tiers. The mid-range tablet sets the FLOOR, never the ceiling: LOW is
 * a budget that always holds 60fps, ULTRA is allowed to be extravagant. The
 * runtime also demotes live if frames are being missed, so a device we guessed
 * wrong about recovers within a couple of seconds instead of stuttering for a
 * whole session.
 */

export type TierName = "low" | "mid" | "ultra";

export type Tier = {
  name: TierName;
  /** hard caps on the instanced pools */
  bullets: number;
  particles: number;
  /** particles emitted per unit of event weight */
  partScale: number;
  /** real bloom post-pass */
  bloom: boolean;
  /** chromatic aberration + grain + scanline in the composite */
  grade: boolean;
  /** animated backdrop (drifting field lines, nebula) */
  liveBackdrop: boolean;
  /** device pixel ratio ceiling */
  maxDpr: number;
  /** persistent scorch/wake layer */
  wake: boolean;
  trails: boolean;
};

const TIERS: Record<TierName, Tier> = {
  low: {
    name: "low",
    bullets: 720,
    particles: 900,
    partScale: 0.45,
    bloom: false,
    grade: false,
    liveBackdrop: true,
    maxDpr: 1.5,
    wake: false,
    trails: false,
  },
  mid: {
    name: "mid",
    bullets: 1100,
    particles: 2200,
    partScale: 0.8,
    bloom: false,
    grade: true,
    liveBackdrop: true,
    maxDpr: 2,
    wake: true,
    trails: true,
  },
  ultra: {
    name: "ultra",
    bullets: 1600,
    particles: 4600,
    partScale: 1.35,
    bloom: true,
    grade: true,
    liveBackdrop: true,
    maxDpr: 2.25,
    wake: true,
    trails: true,
  },
};

export const tierByName = (n: TierName): Tier => TIERS[n];

/** A cheap, conservative first guess. The live monitor does the real work. */
export function detectTier(): Tier {
  try {
    const url = new URL(location.href);
    const forced = url.searchParams.get("tier") as TierName | null;
    if (forced && TIERS[forced]) return TIERS[forced];
  } catch {
    /* not in a browser with a parsable URL — fall through */
  }
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const mem = nav.deviceMemory ?? 4;
  const cpu = nav.hardwareConcurrency ?? 4;
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  const px = (innerWidth || 1024) * (innerHeight || 768) * Math.min(dpr, 2) ** 2;
  if (mem >= 8 && cpu >= 8 && px < 4.6e6) return TIERS.ultra;
  if (mem <= 3 || cpu <= 4) return TIERS.low;
  return TIERS.mid;
}

/**
 * Watches frame cost and steps the tier down (never silently up past the
 * detected ceiling) so a wrong guess costs ~1.5s of judder, not a session.
 */
export class TierMonitor {
  private samples: number[] = [];
  private cursor = 0;
  private cooldown = 0;
  constructor(
    public tier: Tier,
    private readonly onChange: (t: Tier) => void,
    private readonly ceiling: TierName = tier.name,
  ) {
    for (let i = 0; i < 90; i++) this.samples.push(16.7);
  }

  /** @returns the (possibly new) tier */
  sample(frameMs: number, dtWall: number): Tier {
    this.samples[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % this.samples.length;
    this.cooldown -= dtWall;
    if (this.cooldown > 0) return this.tier;

    let over = 0;
    let sum = 0;
    for (const s of this.samples) {
      sum += s;
      if (s > 20) over++;
    }
    const mean = sum / this.samples.length;
    const order: TierName[] = ["low", "mid", "ultra"];
    const at = order.indexOf(this.tier.name);
    const cap = order.indexOf(this.ceiling);

    if ((over > this.samples.length * 0.28 || mean > 19) && at > 0) {
      this.set(order[at - 1] as TierName);
    } else if (over === 0 && mean < 11.5 && at < cap) {
      this.set(order[at + 1] as TierName);
    }
    return this.tier;
  }

  private set(n: TierName): void {
    this.tier = TIERS[n];
    this.cooldown = 4;
    for (let i = 0; i < this.samples.length; i++) this.samples[i] = 16.7;
    this.onChange(this.tier);
  }
}
