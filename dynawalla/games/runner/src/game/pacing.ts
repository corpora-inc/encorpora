/**
 * The escalation curves, in one testable place.
 *
 * These are the numbers that decide whether a run holds a child for twenty
 * minutes or bores them in ninety seconds, and whether the game is hard or
 * merely unfair. They live apart from `mount.ts` so they can be asserted
 * without a WebGL context — the floors below are promises to a ten-year-old,
 * not implementation details, and a test should notice if someone removes one.
 */

export const V_START = 27;
export const V_TERMINAL = 66;
/**
 * Seconds to close ~63% of the gap to terminal velocity.
 *
 * The free tier gives a child five to ten minutes, so terminal velocity has to
 * land *inside* that window: this reads 51 u/s at ninety seconds and 62 at four
 * minutes. A curve tuned for a twenty-minute ramp is a curve most children
 * never see the end of.
 */
export const V_TAU = 95;
/** Reduced motion still runs, just never faster than a person can track calmly. */
export const V_REDUCED_CAP = 42;

export const VOLT_MAX = 100;
export const COST_WRONG_GATE = 27;
export const COST_HAZARD = 15;
export const GAIN_GATE = 8;
export const GAIN_SPARK = 1.4;
export const GAIN_GRAZE = 3;
/**
 * Passive drain per second. Small on purpose: it exists so that dawdling is not
 * a strategy, not as a countdown. A player answering correctly gains voltage; a
 * player guessing loses it.
 */
export const VOLT_BLEED = 0.22;

/**
 * Pips needed for the next surge level.
 *
 * Surge is the reading meter and *only* the reading meter. It used to also be
 * knocked down by every pylon clipped and every pit fallen into, which meant a
 * player who answered 128 gates out of 128 correctly finished a five-minute run
 * sitting at x2 — the multiplier that is supposed to be the reward for reading
 * instead measured how well you dodged. So the two economies are now cleanly
 * split: **voltage is the world, surge is the maths.** Crashing costs voltage
 * and pushes you toward the recharge gate; only a wrong answer collapses surge.
 */
export const CHAIN_PER_SURGE = 3;
export const SURGE_MAX = 9;
export const STUMBLE_TIME = 0.85;

/**
 * The share of a gate's reading window you must already have been in the right
 * lane for it to count as a read rather than a swerve. A committed read is worth
 * two pips, so a child who actually reads climbs twice as fast as one who
 * ping-pongs across the lanes hoping to land somewhere.
 */
export const CLEAN_READ_SHARE = 0.42;

/**
 * Seconds of invulnerability granted by a successful recharge.
 *
 * Long enough to read the deck and pick a lane before anything can hit you.
 * Named because the README quotes it at a child, and a constant quoted in prose
 * is a constant that drifts.
 */
export const REVIVE_GRACE = 2.6;

/** Forward speed in units/second at `elapsed` seconds into a run. */
export function speedAt(elapsed: number, reduced: boolean): number {
  const v = V_TERMINAL - (V_TERMINAL - V_START) * Math.exp(-Math.max(0, elapsed) / V_TAU);
  return reduced ? Math.min(v, V_REDUCED_CAP) : v;
}

/**
 * Seconds between a gate becoming visible and reaching the answer plane.
 *
 * This — not speed — is the real difficulty knob: the run gets harder because
 * the time you have to read compresses. The 1.55s floor is a hard promise. A
 * gate that arrives faster than a child can read it is not difficulty.
 */
export const READ_WINDOW_FLOOR = 1.55;
export function readWindow(travel: number, reduced: boolean): number {
  const w = READ_WINDOW_FLOOR + 1.85 * Math.exp(-Math.max(0, travel) / 2600);
  return reduced ? w + 0.5 : w;
}

/** Quiet seconds after a gate resolves before the next one is scheduled. */
export function breather(travel: number): number {
  return 0.22 + 0.34 * Math.exp(-Math.max(0, travel) / 2200);
}

/** Seconds between hazard beats. Keeps rhythm constant as the world speeds up. */
export function beatTime(travel: number): number {
  return 0.62 + 0.55 * Math.exp(-Math.max(0, travel) / 2400);
}

/**
 * Difficulty hint handed to the host.
 *
 * Distance pushes it up, a hot surge pushes it up a little more, and a genuinely
 * bad patch pulls it down hard. The host owns real adaptivity; this only makes
 * sure the game never keeps escalating at a child who is drowning.
 */
export function difficultyFor(travel: number, surge: number, gates: number, right: number): number {
  const fromDistance = 1 + Math.max(0, travel) / 900;
  const fromSurge = (surge - 1) * 0.25;
  const acc = gates >= 4 ? right / gates : 1;
  const relief = acc < 0.6 ? 2.2 : acc < 0.78 ? 1.1 : 0;
  const d = fromDistance + fromSurge - relief;
  return d < 0 ? 0 : d > 12 ? 12 : d;
}
