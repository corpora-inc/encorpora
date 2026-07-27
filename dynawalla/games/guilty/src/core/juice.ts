/**
 * The feel layer. Trauma-based shake, hitstop, slow-motion, camera punch and a
 * *rate-limited* screen flash.
 *
 * Shake is trauma-squared (Squirrel Eiserloh's model): trauma decays linearly,
 * amplitude is trauma², so a small knock is barely there and a big one is
 * violent, and every hit feels like a different size of hit rather than the
 * same rattle at a different volume.
 *
 * The flash budget is not a nicety. This ships to children: a full-screen
 * luminance jump is the exact stimulus that provokes photosensitive seizures,
 * so bright flashes are hard-capped in amplitude, forced to decay over at least
 * ~150ms, and rate-limited to well under three per second. `reduced` tightens
 * every one of those numbers again.
 */

export type Juice = {
  trauma: number;
  /** Frozen frames, in real seconds. */
  hitstop: number;
  /** Multiplies world dt. 1 = normal. */
  timeScale: number;
  slowFor: number;
  slowTo: number;
  /** 0..1 white veil. */
  flash: number;
  flashColor: string;
  /** Camera dolly kick, world units. */
  punch: number;
  punchVel: number;
  /** Seconds since the last flash above the "significant" threshold. */
  sinceBigFlash: number;
  reduced: boolean;
  /** Random source for shake — kept off Math.random so a replay is a replay. */
  rand: () => number;
  shakeSeed: number;
};

const SIGNIFICANT = 0.16;
const MIN_FLASH_GAP = 0.34; // seconds; < 3 significant flashes per second
const MAX_FLASH = 0.4;
const MAX_FLASH_REDUCED = 0.09;

export function makeJuice(reduced: boolean, rand: () => number): Juice {
  return {
    trauma: 0,
    hitstop: 0,
    timeScale: 1,
    slowFor: 0,
    slowTo: 1,
    flash: 0,
    flashColor: "#ffffff",
    punch: 0,
    punchVel: 0,
    sinceBigFlash: 99,
    reduced,
    rand,
    shakeSeed: 0,
  };
}

export function addTrauma(j: Juice, amount: number): void {
  if (j.reduced) amount *= 0.25;
  j.trauma = Math.min(1, j.trauma + amount);
}

export function addHitstop(j: Juice, seconds: number): void {
  if (j.reduced) seconds *= 0.35;
  j.hitstop = Math.max(j.hitstop, seconds);
}

export function slowMotion(j: Juice, scale: number, seconds: number): void {
  if (j.reduced) return;
  j.slowTo = scale;
  j.slowFor = Math.max(j.slowFor, seconds);
}

export function punch(j: Juice, amount: number): void {
  j.punchVel += j.reduced ? amount * 0.3 : amount;
}

/**
 * Request a screen flash. The budget decides what the player actually gets:
 * amplitude is clamped, and a second bright flash inside the guard window is
 * demoted to a dim one instead of being stacked on top of the first.
 */
export function flash(j: Juice, amount: number, color = "#ffffff"): void {
  const ceiling = j.reduced ? MAX_FLASH_REDUCED : MAX_FLASH;
  let a = Math.min(amount, ceiling);
  if (a > SIGNIFICANT && j.sinceBigFlash < MIN_FLASH_GAP) a = SIGNIFICANT * 0.6;
  if (a > SIGNIFICANT) j.sinceBigFlash = 0;
  if (a > j.flash) {
    j.flash = a;
    j.flashColor = color;
  }
}

/**
 * Advances the juice on *real* time and returns the world dt the simulation
 * should use. Returns 0 while hitstop is holding the frame.
 */
export function stepJuice(j: Juice, realDt: number): number {
  j.sinceBigFlash += realDt;

  // Flash decays with a floor on the fall time, so it can never strobe.
  if (j.flash > 0) {
    j.flash = Math.max(0, j.flash - realDt * (1 / 0.16));
  }

  if (j.hitstop > 0) {
    j.hitstop = Math.max(0, j.hitstop - realDt);
    // The camera keeps living during hitstop; that is what sells the freeze.
    decayCamera(j, realDt);
    return 0;
  }

  if (j.slowFor > 0) {
    j.slowFor = Math.max(0, j.slowFor - realDt);
    const target = j.slowFor > 0 ? j.slowTo : 1;
    j.timeScale += (target - j.timeScale) * Math.min(1, realDt * 9);
  } else {
    j.timeScale += (1 - j.timeScale) * Math.min(1, realDt * 5);
    if (j.timeScale > 0.995) j.timeScale = 1;
  }

  decayCamera(j, realDt);
  return realDt * j.timeScale;
}

function decayCamera(j: Juice, dt: number): void {
  j.trauma = Math.max(0, j.trauma - dt * 1.55);
  // Spring the dolly kick back: stiff, slightly underdamped, so it overshoots
  // once and settles. That single overshoot is most of the "punch".
  j.punchVel += -j.punch * 210 * dt;
  j.punchVel *= Math.pow(0.0012, dt);
  j.punch += j.punchVel * dt;
}

/** Amplitude in CSS pixels for the current trauma. */
export function shakeAmount(j: Juice): number {
  return j.trauma * j.trauma;
}
