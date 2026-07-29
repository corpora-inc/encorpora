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
 * the time you have to read compresses. The floor is a hard promise. A gate
 * that arrives faster than a child can read it is not difficulty.
 *
 * The floor used to be 1.55s. This pack covers `dw.add.regroup.subtract-across-zero`
 * — `5,001 − 2,798` is on its own skill list — and `docs/EXPERIENCE_DESIGN.md`
 * instruments two-digit regrouping at **p50 6s / p90 14s**. 1.55s was not a
 * reading window, it was a coin toss with three faces, and the honest read of a
 * child's answer at that speed is "they guessed". Picking one of three shown
 * candidates is cheaper than producing an answer cold, but it is not four times
 * cheaper.
 *
 * 3.2s is what the *geometry* can actually deliver at terminal velocity on the
 * smallest tier (see `deliveredWindow`), so it is the largest number that is not
 * a lie. The gate cycle as a whole — window plus dodge corridor — lands near the
 * 6s p50; the corridor is where the runner is a runner.
 */
export const READ_WINDOW_FLOOR = 3.2;
export function readWindow(travel: number, reduced: boolean): number {
  const w = READ_WINDOW_FLOOR + 2.2 * Math.exp(-Math.max(0, travel) / 2600);
  return reduced ? w + 0.5 : w;
}

/**
 * The dodge corridor: seconds after a gate resolves before the next is scheduled.
 *
 * This is not dead air, it is the *other half of the game*. Hazards are only
 * allowed to arrive here (see `readingOverlaps`), so if this collapses the
 * runner has nowhere to put a pylon and either the reading gets trampled or the
 * world goes quiet. At 0.22s the reading window occupied 88% of the wall clock,
 * which is exactly why the no-hazards-while-reading guard could never have been
 * honoured. Space and time, not less feedback.
 */
export const DODGE_CORRIDOR_FLOOR = 1.9;
export function breather(travel: number): number {
  return DODGE_CORRIDOR_FLOOR + 1.0 * Math.exp(-Math.max(0, travel) / 2200);
}

/**
 * How long the corridor still belongs to the gate that just resolved.
 *
 * The next sum goes on the HUD during the corridor, not when the gate carrying
 * its candidates appears — that is the pre-read `comprehensionWindow` measures.
 * But swapping it in on the very frame the child crosses the answer plane makes
 * the new question part of the verdict on the old one, and the crossing is
 * already the busiest frame in the game.
 *
 * 0.3s: eighteen frames, enough that the swap is plainly a separate event from
 * the crossing, and a sixth of the corridor rather than a quarter of it. Every
 * tenth of a second here is a tenth taken off the pre-read, which is the whole
 * reason the pre-read exists, so it is not rounded up for comfort.
 */
export const RESOLVE_HOLD = 0.3;

/* --------------------------- gate geometry ---------------------------- */

/** Nearest a gate may spawn — closer than this and it is on top of you. */
export const GATE_MIN_DIST = 68;
/** Share of the draw distance a gate may spawn at. Past it, nothing is drawn. */
export const GATE_FAR_SHARE = 0.84;
/** Ceiling on the surge speed bonus applied in `mount.ts`. */
export const V_SURGE_BOOST_MAX = 1.2;

const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Where a gate is spawned, in units ahead, for a wanted reading window. */
export function gateDistance(speed: number, window: number, far: number): number {
  return clampN(speed * window, GATE_MIN_DIST, far * GATE_FAR_SHARE);
}

/**
 * The reading window the child actually gets, after the draw distance has had
 * its say.
 *
 * `readWindow` is a *wish*; a gate cannot be spawned beyond the far plane, so at
 * high speed on a low tier the clamp quietly hands back less. This is the number
 * that is promised, and there is a test that walks every tier at every speed the
 * game can reach — including the surge bonus — and holds it to the floor.
 */
export const DELIVERED_WINDOW_FLOOR = 3.1;
export function deliveredWindow(travel: number, speed: number, far: number, reduced: boolean): number {
  return gateDistance(speed, readWindow(travel, reduced), far) / Math.max(1, speed);
}

/**
 * The whole time a child has with a question: the dodge corridor the prompt is
 * *already on the HUD* for, plus the gate's own hazard-free window.
 *
 * **Why this number exists.** `deliveredWindow` is the time between a gate
 * becoming visible and reaching the answer plane, and it is capped by the far
 * plane: measured across a ten-minute run at every tier, with and without the
 * surge speed bonus, it is 3.19s at worst and 3.20s at p50.
 * `docs/EXPERIENCE_DESIGN.md` instruments two-digit regrouping at p50 6s, so
 * VOLTA was asking for a two-digit regroup in slightly over half the time the
 * product says one takes.
 *
 * The geometry cannot give more. `readWindow` already sits at the largest floor
 * the far plane can honour (3.2s — raise it and `gateDistance` clamps it back
 * down, which is the exact lie #665 removed), so a longer hazard-free window
 * needs the low tier's draw distance or the terminal velocity to move, and both
 * of those are decisions about frame rate and feel rather than about reading.
 *
 * What is free is *when the child is told the sum*. The question is drawn a
 * corridor early and its prompt goes on the HUD then, so the corridor is reading
 * time too: measured through the real scheduling loop, 4.79s at worst and 4.80s
 * at p50, up from 3.19s and 3.20s.
 *
 * **This is not the same promise as `deliveredWindow` and must not be read as
 * one.** Hazards live in the corridor — that is what #665 built it for — so the
 * pre-read is time a child *may* use to compute, while dodging, and the window
 * in which nothing can hit them is still `deliveredWindow`. It is still short of
 * 6s p50 and the reason is written down above.
 */
export const COMPREHENSION_FLOOR = 4.7;
export function comprehensionWindow(travel: number, speed: number, far: number, reduced: boolean): number {
  return Math.max(0, breather(travel) - RESOLVE_HOLD) + deliveredWindow(travel, speed, far, reduced);
}

/* ------------------------- the reading corridor ------------------------ */

/**
 * Seconds of margin either side of a hazard's predicted landing.
 *
 * The projection below is the game's own loop, so it is close — but it does not
 * know about the surge speed bonus arriving mid-flight or a stumble slowing the
 * world down, and a hazard is in the air for six seconds or more. This buys a
 * reading window that nothing leaks into, at the cost of a hazard here and there
 * at the very edge of a corridor.
 */
export const HAZARD_LEAD_SLOP = 0.3;

/** How the world will be scheduled while a hazard is in the air. */
export type FlightState = {
  /** Units ahead the hazard is being spawned. */
  dist: number;
  elapsed: number;
  travel: number;
  /** Live forward speed, which is not exactly `speedAt` — surge, stumble. */
  speed: number;
  /** Draw distance of the current quality tier. */
  far: number;
  reduced: boolean;
  /** Seconds until the live gate reaches the answer plane, null when none is up. */
  gateEndsIn: number | null;
  /** Seconds until the next gate is requested. */
  cooldown: number;
};

/**
 * Would a hazard spawned now be crossing the answer plane while a gate is being
 * read?
 *
 * This is the promise `emitBeat` has always made in a comment and never kept.
 * The old test compared a hazard's *spawn* z against a live gate's *current* z —
 * −334 against something never past −102 — so the branch was unreachable and
 * roughly two hazards landed in every reading window from ninety seconds on.
 *
 * The two quantities that are actually comparable are *arrival times*, and
 * getting them needs a projection rather than a division: a hazard spawns at the
 * far plane, further out than any gate, so it is airborne for one to three whole
 * gate cycles, and both the world speed and the cycle length move while it
 * flies. So this runs the same loop `step()` runs — accelerate, scroll, resolve
 * the gate, wait out the corridor, spawn the next — forward until the hazard
 * lands, and answers with what the child will be doing when it gets there.
 *
 * ~500 iterations of arithmetic, once per hazard beat. It is not a frame cost.
 */
export function hazardLandsOnRead(s: FlightState): boolean {
  const step = 1 / 30;
  const base = Math.max(1, speedAt(s.elapsed, s.reduced));
  // Carry whatever the live speed is doing that the curve does not know about.
  const ratio = clampN(s.speed / base, 0.4, 1.6);
  let t = 0;
  let travel = s.travel;
  let z = -Math.max(0, s.dist);
  let gz: number | null = s.gateEndsIn !== null ? -s.gateEndsIn * Math.max(1, s.speed) : null;
  let cd = s.cooldown;
  let landed = -1;
  let lastRead = -1e9;

  for (let i = 0; i < 1600; i++) {
    const v = speedAt(s.elapsed + t, s.reduced) * ratio;
    const d = v * step;
    z += d;
    travel += d;
    if (gz !== null) {
      gz += d;
      if (gz >= 0) {
        gz = null;
        cd = breather(travel);
      }
    } else {
      cd -= step;
      if (cd <= 0) gz = -gateDistance(v, readWindow(travel, s.reduced), s.far);
    }
    t += step;
    if (gz !== null) lastRead = t;
    if (z >= 0) {
      if (landed < 0) landed = t;
      if (lastRead >= landed - HAZARD_LEAD_SLOP) return true;
      if (t > landed + HAZARD_LEAD_SLOP) return false;
    }
  }
  return false;
}

/** Seconds between hazard beats. Keeps rhythm constant as the world speeds up. */
export function beatTime(travel: number): number {
  return 0.62 + 0.55 * Math.exp(-Math.max(0, travel) / 2400);
}

/** Correct gates per step of difficulty. */
export const GATES_PER_STEP = 4;

/**
 * Difficulty hint handed to the host.
 *
 * **Escalation is on achievement, not on survival.** It used to be `1 +
 * travel/900` — a step every fifteen seconds of *staying alive*, which handed
 * harder subtraction to a child who had answered nothing right and merely
 * dodged well. `docs/EXPERIENCE_DESIGN.md` bans exactly that: "escalation is on
 * difficulty and repair, never run length." Every game in the fleet that paces
 * well already does this — `siege` steps on a wave clear, `serpent` per nine
 * correct eats, `stack` on a finished floor.
 *
 * So the ramp is the count of gates read correctly. A hot surge still adds a
 * little on top, and a genuinely bad patch still pulls it down hard: the host
 * owns real adaptivity, this only makes sure the game never escalates at a child
 * who is drowning.
 */
export function difficultyFor(surge: number, gates: number, right: number): number {
  const fromRight = 1 + Math.max(0, right) / GATES_PER_STEP;
  const fromSurge = (surge - 1) * 0.25;
  const acc = gates >= 4 ? right / gates : 1;
  const relief = acc < 0.6 ? 2.2 : acc < 0.78 ? 1.1 : 0;
  const d = fromRight + fromSurge - relief;
  return d < 0 ? 0 : d > 12 ? 12 : d;
}
