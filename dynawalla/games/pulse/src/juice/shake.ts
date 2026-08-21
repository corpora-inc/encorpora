/**
 * Screen shake, the trauma model (Squirrel Eiserloh / "Juicing Your Cameras").
 *
 * Events add *trauma*, not offset. Displacement is `trauma^2`, so small events
 * barely register and a drop is violent, and trauma decays linearly so shake always
 * ends cleanly instead of asymptoting into a permanent wobble. Offsets come from a
 * smooth value-noise walk rather than `Math.random()` per frame, which is the
 * difference between a camera kick and a buzzing artefact.
 */

export class Shake {
  private trauma = 0;
  private readonly decay: number;
  private t = 0;
  private readonly seeds: number[];

  x = 0;
  y = 0;
  rot = 0;

  constructor(decay = 1.9, seed = 1) {
    this.decay = decay;
    this.seeds = [seed * 0.913, seed * 1.771 + 3.1, seed * 2.393 + 7.7];
  }

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get level(): number {
    return this.trauma;
  }

  /** `maxPx` and `maxRot` are the amplitudes at full trauma. */
  update(dt: number, maxPx: number, maxRot: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const s = this.trauma * this.trauma;
    if (s <= 0.00002) {
      this.x = 0;
      this.y = 0;
      this.rot = 0;
      return;
    }
    this.x = s * maxPx * noise(this.t * 22 + this.seeds[0]!);
    this.y = s * maxPx * noise(this.t * 24.7 + this.seeds[1]!);
    this.rot = s * maxRot * noise(this.t * 18.3 + this.seeds[2]!);
  }

  reset(): void {
    this.trauma = 0;
    this.x = 0;
    this.y = 0;
    this.rot = 0;
  }
}

/** Smooth 1-D value noise in [-1, 1]. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function hash(i: number): number {
  let h = Math.imul(i | 0, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
