/**
 * Camera and time.
 *
 * Trauma-based shake (Squirrel Eiserloh's model): callers add *trauma*, the
 * camera shakes by trauma², so a single hit is a tap and five hits at once is a
 * detonation, and it always decays to still. Shake is offset AND rotation —
 * rotation is what separates Nuclear Throne from a jitter filter.
 *
 * Hitstop is a frozen simulation with a live camera, which is why a break reads
 * as an impact instead of a disappearance ("Art of Screenshake": stop the world,
 * not the presentation).
 *
 * The flash budget is a child-safety limit, not a taste one: never more than
 * three luminance events per second and never above a capped alpha, so the game
 * cannot produce a photosensitive trigger even at peak multiball chaos.
 */
const ZOOM_MIN = 0.9;
const ZOOM_MAX = 1.16;

const clampTo = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : 0;

export class Camera {
  trauma = 0;
  /** Zoom punch: 1 is rest. */
  zoom = 1;
  zoomVel = 0;
  /** Seconds of frozen simulation remaining. */
  hitstop = 0;
  /** Multiplier applied to simulation dt (bullet time). */
  timeScale = 1;
  timeScaleTarget = 1;

  flash = 0;
  flashHue: [number, number, number] = [255, 245, 222];
  private flashTimes: number[] = [];

  offX = 0;
  offY = 0;
  rot = 0;

  reduced = false;

  private t = 0;
  private seedA = Math.random() * 1000;
  private seedB = Math.random() * 1000;

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + (this.reduced ? v * 0.18 : v));
  }

  /**
   * Zoom punch. The velocity and the resulting zoom are both hard-clamped:
   * an underdamped spring fed a chain of impacts in consecutive frames will
   * happily overshoot through zero and turn the whole scene into a postage
   * stamp — which is exactly what it did before these two clamps existed.
   */
  punch(v: number): void {
    if (this.reduced) return;
    this.zoomVel = clampTo(this.zoomVel + v * 0.62, -6, 6);
  }

  stop(seconds: number): void {
    // Hitstop is information, not decoration: it survives reduced motion.
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  /**
   * Request a screen flash. Silently downgraded when it would breach the
   * three-per-second luminance budget.
   */
  requestFlash(alpha: number, rgb?: [number, number, number]): void {
    const now = this.t;
    this.flashTimes = this.flashTimes.filter((x) => now - x < 1);
    const cap = this.reduced ? 0.08 : 0.26;
    if (this.flashTimes.length >= 3) {
      this.flash = Math.max(this.flash, Math.min(alpha, cap) * 0.25);
      return;
    }
    this.flashTimes.push(now);
    this.flash = Math.max(this.flash, Math.min(alpha, cap));
    if (rgb) this.flashHue = rgb;
  }

  update(dtReal: number): void {
    this.t += dtReal;

    this.trauma = Math.max(0, this.trauma - dtReal * 1.55);
    const s = this.trauma * this.trauma;

    if (s > 0.0001 && !this.reduced) {
      const f = this.t * 34;
      this.offX = (noise(f + this.seedA) * 2 - 1) * 26 * s;
      this.offY = (noise(f + this.seedB) * 2 - 1) * 26 * s;
      this.rot = (noise(f * 0.7 + 91) * 2 - 1) * 0.035 * s;
    } else {
      this.offX = 0;
      this.offY = 0;
      this.rot = 0;
    }

    // Critically-damped-ish spring back to zoom 1.
    const k = 132;
    const c = 17;
    const accel = (1 - this.zoom) * k - this.zoomVel * c;
    this.zoomVel = clampTo(this.zoomVel + accel * dtReal, -6, 6);
    this.zoom += this.zoomVel * dtReal;
    if (this.zoom < ZOOM_MIN) {
      this.zoom = ZOOM_MIN;
      this.zoomVel = Math.max(0, this.zoomVel);
    } else if (this.zoom > ZOOM_MAX) {
      this.zoom = ZOOM_MAX;
      this.zoomVel = Math.min(0, this.zoomVel);
    }
    if (Math.abs(this.zoom - 1) < 0.0004 && Math.abs(this.zoomVel) < 0.004) {
      this.zoom = 1;
      this.zoomVel = 0;
    }

    this.flash = Math.max(0, this.flash - dtReal * 3.4);

    if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dtReal);

    const rate = this.timeScaleTarget < this.timeScale ? 14 : 4.5;
    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, dtReal * rate);
  }

  /** Simulation dt for this frame: zero while frozen, scaled while slowed. */
  simDt(dtReal: number): number {
    if (this.hitstop > 0) return 0;
    return dtReal * this.timeScale;
  }
}

/** Cheap value noise: smooth, deterministic, no allocation. */
function noise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Easing, by name, so the tuning is legible
// ---------------------------------------------------------------------------

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
export const easeInQuad = (t: number): number => t * t;
export const easeOutBack = (t: number): number => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.36;
  return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
};
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
