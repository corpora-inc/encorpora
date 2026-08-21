/**
 * The street generates itself.
 *
 * A virtualised list of records, and the fabric *between* the stalls is
 * procedural — so shipping a game never requires anybody to author street.
 * Past the last built quarter there is **scaffolding**: poles, ropes, a
 * half-raised dome, a counterweight crane, two builder-automata. Not a "coming
 * soon" card. When a game ships, the scaffolding comes down on that stall, and
 * a returning child can witness it. That is the best release note there is.
 *
 * BZ-LAW-17 — there is no grid view. No "all games", no search field, no
 * filter chips, no category tabs. The street is the navigation.
 */

import { frand, mix, pick } from "../util/rng.ts";
import type { Quarter, StallSpec } from "../types.ts";
import type { WardId } from "../tokens/palette.ts";
import { QUARTERS } from "./quarters.ts";

export type InterstitialKind =
  | "doorway"
  | "fountain"
  | "crates"
  | "stair"
  | "alley-mouth"
  | "water-crossing"
  | "niche"
  | "vine"
  | "porter"
  | "cat";

export interface StallFeature {
  kind: "stall";
  x: number;
  width: number;
  seed: number;
  quarter: Quarter;
  stall: StallSpec;
  /** Index among stalls only — what the keyboard steps through. */
  index: number;
}

export interface InterstitialFeature {
  kind: "interstitial";
  x: number;
  width: number;
  seed: number;
  quarter: Quarter;
  type: InterstitialKind;
}

export interface GateFeature {
  kind: "gate";
  x: number;
  width: number;
  seed: number;
  quarter: Quarter;
  ward: WardId;
}

export type Feature = StallFeature | InterstitialFeature | GateFeature;

const INTERSTITIALS: readonly InterstitialKind[] = [
  "doorway",
  "crates",
  "stair",
  "alley-mouth",
  "niche",
  "vine",
  "porter",
  "water-crossing",
  "fountain",
  "cat",
];

export interface StreetOptions {
  seed: number;
  /** The stall pitch. Everything derives from it. */
  module: number;
  stalls: StallSpec[];
  quarters?: readonly Quarter[];
}

export class Street {
  readonly features: Feature[] = [];
  readonly stalls: StallFeature[] = [];
  private cursor = 0;
  private step = 0;
  private lastKinds: InterstitialKind[] = [];
  private lastFountain = -99;
  private ward: WardId | null = null;
  private module: number;
  private seed: number;
  private quarters: readonly Quarter[];
  private given: StallSpec[];

  constructor(o: StreetOptions) {
    this.module = o.module;
    this.seed = o.seed;
    this.quarters = o.quarters?.length ? o.quarters : QUARTERS;
    this.given = o.stalls;
    this.cursor = o.module * 0.45;
  }

  get width(): number {
    return this.cursor + this.module;
  }

  /** Grow the street until it reaches `x`. Called as the camera approaches. */
  ensure(x: number): void {
    let guard = 0;
    while (this.cursor < x && guard++ < 400) this.emit();
  }

  /** The quarter a given step belongs to. Built stalls first, then forever. */
  private quarterFor(step: number): Quarter {
    const built = this.given.length;
    if (step < built) {
      const id = this.given[step]!.quarter;
      return this.quarters.find((q) => q.id === id) ?? this.quarters[step % this.quarters.length]!;
    }
    return this.quarters[step % this.quarters.length]!;
  }

  private emit(): void {
    const step = this.step++;
    const quarter = this.quarterFor(step);
    const s = mix(this.seed, step * 7919);

    // A ward boundary is a gate, and the next ward's tower is already visible
    // from inside this one.
    if (this.ward !== quarter.ward) {
      this.ward = quarter.ward;
      if (step > 0) {
        const w = this.module * 0.62;
        this.features.push({
          kind: "gate",
          x: this.cursor,
          width: w,
          seed: mix(s, 0x6a7e),
          quarter,
          ward: quarter.ward,
        });
        this.cursor += w + this.module * 0.06;
      }
    }

    const given = this.given[step];
    const stall: StallSpec = given ?? {
      id: `scaffold-${step}`,
      title: "",
      quarter: quarter.id,
      state: "scaffold",
    };
    const f: StallFeature = {
      kind: "stall",
      x: this.cursor,
      width: this.module,
      seed: s,
      quarter,
      stall,
      index: this.stalls.length,
    };
    this.features.push(f);
    this.stalls.push(f);
    this.cursor += this.module;

    // Interstitial fabric: weighted, no repeat within five, a fountain no
    // closer than nine apart. A street with no side alleys is a corridor.
    const gap = this.module * (0.2 + (frand(mix(s, 3)) - 0.5) * 0.12);
    let kind = pick(INTERSTITIALS, frand(mix(s, 11)));
    let tries = 0;
    while (
      tries++ < 12 &&
      (this.lastKinds.includes(kind) ||
        (kind === "fountain" && step - this.lastFountain < 9))
    ) {
      kind = pick(INTERSTITIALS, frand(mix(s, 11 + tries * 31)));
    }
    if (kind === "fountain") this.lastFountain = step;
    this.lastKinds.push(kind);
    if (this.lastKinds.length > 5) this.lastKinds.shift();

    this.features.push({
      kind: "interstitial",
      x: this.cursor,
      width: gap,
      seed: mix(s, 0x1f3d),
      quarter,
      type: kind,
    });
    this.cursor += gap;
  }

  /** Features overlapping [x0, x1]. Linear, and the window is small. */
  visible(x0: number, x1: number): Feature[] {
    const out: Feature[] = [];
    for (const f of this.features) {
      if (f.x + f.width < x0) continue;
      if (f.x > x1) break;
      out.push(f);
    }
    return out;
  }

  /** The stall whose centre is nearest `x`. */
  nearestStall(x: number): StallFeature | null {
    let best: StallFeature | null = null;
    let bd = Infinity;
    for (const s of this.stalls) {
      const d = Math.abs(s.x + s.width / 2 - x);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  stallById(id: string): StallFeature | undefined {
    return this.stalls.find((s) => s.stall.id === id);
  }

  /** The first stall of each ward — where Home/End and the astrolabe land. */
  wardBoundaries(): number[] {
    const out: number[] = [];
    let ward: WardId | null = null;
    for (const s of this.stalls) {
      if (s.quarter.ward !== ward) {
        ward = s.quarter.ward;
        out.push(s.index);
      }
    }
    return out;
  }
}

/** BZ-17, as data rather than as a promise. */
export function quarterTriples(qs: readonly Quarter[]): string[] {
  return qs.map((q) => `${q.ward}|${q.finial}|${q.fold}`);
}

export function adjacentWardPairs(qs: readonly Quarter[]): [WardId, WardId][] {
  const out: [WardId, WardId][] = [];
  for (let i = 0; i < qs.length; i++) {
    const a = qs[i]!.ward;
    const b = qs[(i + 1) % qs.length]!.ward;
    out.push([a, b]);
  }
  return out;
}
