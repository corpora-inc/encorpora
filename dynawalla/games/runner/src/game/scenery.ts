import type { SolidField } from "./fields.ts";
import type { Particles } from "./particles.ts";
import type { Rng } from "./rng.ts";
import type { Biome } from "./biomes.ts";
import { DECK_HALF } from "./world.ts";

/**
 * Everything beside and above the causeway.
 *
 * Near-field parallax is the whole trick of a runner: the horizon barely moves,
 * so speed is read almost entirely from objects passing close to the camera.
 * The monolith band is therefore weighted *toward* the deck, and the overhead
 * arches exist for one reason — to put geometry within four metres of the
 * player's head twice every hundred metres.
 *
 * Flat arrays, fixed capacity, recycled in place.
 */

type Shards = {
  x: Float32Array; y: Float32Array; z: Float32Array;
  w: Float32Array; h: Float32Array; rot: Float32Array;
  hue: Float32Array; glow: Float32Array;
};

export class Scenery {
  private n: number;
  private s: Shards;
  private rng: Rng;
  private far: number;

  // Overhead arches
  private archZ: Float32Array;
  private archH: Float32Array;
  private archN = 0;
  private nextArch = -180;

  private ambientAcc = 0;

  constructor(capacity: number, far: number, rng: Rng) {
    this.n = capacity;
    this.far = far;
    this.rng = rng;
    const f = () => new Float32Array(capacity);
    this.s = { x: f(), y: f(), z: f(), w: f(), h: f(), rot: f(), hue: f(), glow: f() };
    this.archZ = new Float32Array(8);
    this.archH = new Float32Array(8);
    for (let i = 0; i < capacity; i++) this.reseed(i, -this.rng.range(20, far));
  }

  resize(capacity: number, far: number): void {
    this.far = far;
    if (capacity === this.n) return;
    const old = this.s;
    const oldN = this.n;
    this.n = capacity;
    const f = () => new Float32Array(capacity);
    this.s = { x: f(), y: f(), z: f(), w: f(), h: f(), rot: f(), hue: f(), glow: f() };
    const keep = Math.min(oldN, capacity);
    for (const k of ["x", "y", "z", "w", "h", "rot", "hue", "glow"] as const) {
      this.s[k].set(old[k].subarray(0, keep));
    }
    for (let i = keep; i < capacity; i++) this.reseed(i, -this.rng.range(20, far));
  }

  private reseed(i: number, z: number): void {
    const s = this.s;
    const rng = this.rng;
    // Two bands: a dense near band that reads as speed, a sparse far band that
    // reads as a city. 68/32 keeps the near band from becoming a picket fence.
    const near = rng.chance(0.68);
    const side = rng.chance(0.5) ? -1 : 1;
    const dist = near ? rng.range(DECK_HALF + 2.0, DECK_HALF + 16) : rng.range(34, 132);
    s.x[i] = side * dist;
    s.w[i] = near ? rng.range(0.85, 3.1) : rng.range(4, 15);
    s.h[i] = near ? rng.range(3.5, 26) : rng.range(24, 96);
    s.y[i] = -rng.range(0.5, 7) + (near ? 0 : -8);
    s.z[i] = z;
    s.rot[i] = rng.range(0, Math.PI);
    s.hue[i] = rng.next();
    s.glow[i] = near ? rng.range(0.22, 1.05) : rng.range(0.05, 0.34);
  }

  update(dt: number, scroll: number, travel: number, biome: Biome, parts: Particles): void {
    const s = this.s;
    for (let i = 0; i < this.n; i++) {
      s.z[i] += scroll;
      if (s.z[i] > 34) this.reseed(i, s.z[i] - this.far - this.rng.range(0, 40));
    }

    // Arches. Cadence tightens a little with distance so late runs feel busier.
    const spacing = Math.max(78, 128 - travel * 0.004);
    this.archN = 0;
    for (let i = 0; i < 8; i++) {
      if (this.archZ[i] === 0) continue;
      this.archZ[i] += scroll;
      if (this.archZ[i] > 30) this.archZ[i] = 0;
      else this.archN++;
    }
    if (travel > this.nextArch) {
      this.nextArch = travel + spacing;
      for (let i = 0; i < 8; i++) {
        if (this.archZ[i] !== 0) continue;
        this.archZ[i] = -this.far * 0.92;
        this.archH[i] = this.rng.range(7.5, 13.5);
        break;
      }
    }

    // Ambient debris. Emitted in front and swept back by the world scroll.
    this.ambientAcc += dt * (biome.ambient === "ember" ? 52 : biome.ambient === "ash" ? 40 : 30);
    const c = colorOf(biome.ambientColor);
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      const rng = this.rng;
      const zz = -rng.range(20, this.far * 0.85);
      const xx = rng.range(-46, 46);
      if (biome.ambient === "ember") {
        parts.puff(xx, rng.range(-6, 18), zz, rng.range(-1, 1), rng.range(1.5, 5), 0,
          rng.range(1.2, 2.6), rng.range(0.1, 0.32), -0.05, c[0], c[1], c[2], 1);
      } else if (biome.ambient === "ash") {
        parts.puff(xx, rng.range(4, 30), zz, rng.range(-1.5, 1.5), rng.range(-3.4, -1.2), 0,
          rng.range(1.4, 2.8), rng.range(0.12, 0.4), 0, c[0], c[1], c[2], 1);
      } else if (biome.ambient === "mote") {
        parts.puff(xx, rng.range(-8, 22), zz, rng.range(-0.6, 0.6), rng.range(-0.5, 0.9), 0,
          rng.range(2.0, 3.6), rng.range(0.08, 0.24), 0.02, c[0], c[1], c[2], 1);
      } else {
        parts.puff(xx, rng.range(-4, 24), zz, rng.range(-2, 2), rng.range(-0.6, 0.6), 0,
          rng.range(1.0, 2.2), rng.range(0.06, 0.2), 0, c[0], c[1], c[2], 1);
      }
    }
  }

  draw(shardField: SolidField, boxField: SolidField, biome: Biome, shift: number): void {
    const a = colorOf(biome.accent);
    const b = colorOf(biome.accent2);
    const s = this.s;
    for (let i = 0; i < this.n; i++) {
      const t = s.hue[i];
      const r = a[0] + (b[0] - a[0]) * t;
      const g = a[1] + (b[1] - a[1]) * t;
      const bl = a[2] + (b[2] - a[2]) * t;
      const glow = s.glow[i] * (1 + shift * 2.5);
      shardField.add(
        s.x[i], s.y[i] + s.h[i] * 0.5, s.z[i],
        s.w[i], s.h[i], s.w[i],
        s.rot[i],
        r, g, bl, glow, 1,
      );
    }

    // Arches: two legs and a lintel, drawn from the box field.
    for (let i = 0; i < 8; i++) {
      const z = this.archZ[i];
      if (z === 0) continue;
      const h = this.archH[i];
      const legX = DECK_HALF + 1.4;
      boxField.add(-legX, h * 0.5, z, 0.85, h, 1.5, 0, a[0], a[1], a[2], 0.7, 1);
      boxField.add(legX, h * 0.5, z, 0.85, h, 1.5, 0, a[0], a[1], a[2], 0.7, 1);
      boxField.add(0, h, z, legX * 2 + 1.7, 1.05, 1.5, 0, b[0], b[1], b[2], 0.95, 1);
      boxField.add(0, h - 1.0, z, legX * 2 - 2, 0.28, 0.9, 0, a[0], a[1], a[2], 1.6, 1);
    }
  }
}

const cache = new Map<number, [number, number, number]>();
export function colorOf(hex: number): [number, number, number] {
  let c = cache.get(hex);
  if (!c) {
    // sRGB -> linear, so additive blending and bloom behave.
    const to = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    c = [to(((hex >> 16) & 255) / 255), to(((hex >> 8) & 255) / 255), to((hex & 255) / 255)];
    if (cache.size > 512) cache.clear();
    cache.set(hex, c);
  }
  return c;
}
