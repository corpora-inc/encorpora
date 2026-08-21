/**
 * FSRS-6, in integer arithmetic, behind the `FactScheduler` seam.
 *
 * ADR-0008 makes four decisions and this file implements the fourth: the
 * algorithm is reached only through a one-file seam with a test pinning its
 * weight vector, so replacing it — by vendoring the upstream library, by
 * re-fitting, or by a dependency bump — is a loud change and not a silent
 * rescheduling of every child's review queue.
 *
 * ## The model
 *
 * Three quantities per card:
 *
 *   **S** stability  — the interval at which recall probability is 0.9.
 *   **D** difficulty — 1..10, mean-reverting.
 *   **R** retrievability — `R(t, S) = (1 + F·t/S)^-d`, a **power law**, not an
 *   exponential. The power-law forgetting curve is FSRS's substantive claim and
 *   the reason it beats SM-2 on the open benchmark; `d = w20` and
 *   `F = 0.9^(-1/d) − 1` are chosen so that `R(S, S) = 0.9` exactly, which is
 *   what makes "interval = stability" true at the default retention.
 *
 * ## What is deliberately not implemented
 *
 * **The same-day / short-term terms.** The engine's unit of time is a whole `Day`
 * (`types.ts`) because it may not read a clock, so an interval shorter than a day
 * is not a representable quantity here. A fact answered twice in one session is
 * handled by Layer S's fluency burst, which is where a child who is still
 * *computing* the fact belongs anyway (ADR-0008 §3). A same-day FSRS review would
 * be modelling a construct this program has decided not to schedule.
 *
 * ## The weights
 *
 * `DEFAULT_WEIGHTS` is **PROVISIONAL**, in exactly the sense `constants.ts` uses
 * the word: the shape is pinned by FSRS-6, the twenty-one numbers are the vector
 * this implementation carries. They have not been checked against an upstream
 * release from inside this repository, because the engine has no dependencies and
 * this machine has no network. `fsrs.test.ts` pins them by value **and by
 * checksum**, so the day a vendored library arrives with a different vector, the
 * test names it rather than the intervals quietly moving.
 */

import { ONE, ZERO, add, clamp, div, fromInt, fromRatio, mul, sub, toRoundedInt } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { exp, pow } from "./math/elementary.ts";
import { NEW_FACT_CARD } from "./types.ts";
import type { Day, FactCard, Rating } from "./types.ts";
import type { FactScheduler } from "./facts.ts";

/** The twenty-one FSRS-6 weights, as millionths. PROVISIONAL — see the header. */
export const DEFAULT_WEIGHTS: readonly Fix[] = [
  217_200, 1_177_100, 3_260_200, 16_150_700, // w0..w3   initial stability by rating
  7_011_400, 570_000, // w4, w5   initial difficulty
  2_096_600, 6_900, // w6, w7   difficulty step and mean reversion
  1_526_100, 112_000, 1_017_800, // w8..w10  stability on success
  1_849_000, 113_300, 312_700, 2_293_400, // w11..w14 stability after a lapse
  219_100, 3_000_400, // w15, w16 hard penalty, easy bonus
  753_600, 333_200, 143_700, // w17..w19 short-term terms, unused here
  200_000, // w20      the forgetting-curve decay
].map((micro) => micro as Fix);

export const WEIGHT_COUNT = 21;

/** Reviews are scheduled at this recall probability. */
export const REQUEST_RETENTION: Fix = fromRatio(9, 10);

/** Intervals are whole days, at least one and at most this. */
export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

/** Difficulty is 1..10 by construction, and every update re-clamps. */
const D_MIN: Fix = fromInt(1);
const D_MAX: Fix = fromInt(10);
/** Stability never reaches zero: it is a divisor and an exponent base. */
const S_MIN: Fix = fromRatio(1, 100);

function weight(weights: readonly Fix[], index: number): Fix {
  const value = weights[index];
  if (value === undefined) throw new RangeError(`fsrs: no weight w${String(index)}`);
  return value;
}

function ratingIndex(rating: Rating): number {
  return rating === "again" ? 0 : rating === "hard" ? 1 : rating === "good" ? 2 : 3;
}

/**
 * `F` in the forgetting curve, from the decay `d = w20`.
 *
 * `F = 0.9^(-1/d) − 1`, which is what makes `R(S, S)` exactly 0.9 and therefore
 * makes "the interval at the default retention is the stability" true rather than
 * approximately true.
 */
export function curveFactor(weights: readonly Fix[]): Fix {
  const decay = weight(weights, 20);
  return sub(pow(fromRatio(9, 10), div(fromInt(-1), decay)), ONE);
}

/** `R(t, S) = (1 + F·t/S)^-d`. */
export function retrievability(weights: readonly Fix[], stability: Fix, elapsedDays: number): Fix {
  if (elapsedDays <= 0) return ONE;
  const s = stability < S_MIN ? S_MIN : stability;
  const inner = add(ONE, div(mul(curveFactor(weights), fromInt(elapsedDays)), s));
  return clamp(pow(inner, -weight(weights, 20) as Fix), ZERO, ONE);
}

/** The interval that lands the card back at `REQUEST_RETENTION`. */
export function intervalFor(weights: readonly Fix[], stability: Fix): number {
  const decay = weight(weights, 20);
  const factor = curveFactor(weights);
  const s = stability < S_MIN ? S_MIN : stability;
  const days = toRoundedInt(div(mul(s, sub(pow(REQUEST_RETENTION, div(fromInt(-1), decay)), ONE)), factor));
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, days));
}

/** `D0(G) = w4 − e^(w5·(G−1)) + 1`, clamped into 1..10. */
function initialDifficulty(weights: readonly Fix[], rating: Rating): Fix {
  const g = fromInt(ratingIndex(rating));
  return clamp(add(sub(weight(weights, 4), exp(mul(weight(weights, 5), g))), ONE), D_MIN, D_MAX);
}

/** `S0(G) = w[G−1]`, floored so it can be divided by. */
function initialStability(weights: readonly Fix[], rating: Rating): Fix {
  const value = weight(weights, ratingIndex(rating));
  return value < S_MIN ? S_MIN : value;
}

/**
 * The difficulty update, with FSRS's linear damping and its mean reversion
 * towards the `easy` anchor.
 *
 * The mean reversion is why a child who has one bad day with a fact does not
 * carry it forever: `D` is pulled back towards `D0(easy)` on every review, so a
 * single lapse decays out instead of compounding.
 */
function nextDifficulty(weights: readonly Fix[], difficulty: Fix, rating: Rating): Fix {
  const delta = mul(-weight(weights, 6) as Fix, fromInt(ratingIndex(rating) - 2));
  const damped = mul(delta, div(sub(D_MAX, difficulty), fromInt(9)));
  const moved = add(difficulty, damped);
  const anchor = initialDifficulty(weights, "easy");
  const reverted = add(mul(weight(weights, 7), anchor), mul(sub(ONE, weight(weights, 7)), moved));
  return clamp(reverted, D_MIN, D_MAX);
}

/**
 * `S' = S·(1 + e^w8·(11−D)·S^-w9·(e^(w10·(1−R)) − 1)·hard·easy)`.
 *
 * The `S^-w9` term is the one that matters pedagogically: the higher the
 * stability already is, the less another success adds. That is what stops a fact
 * a child has known for a year from being scheduled at absurd intervals on the
 * strength of one more correct answer.
 */
function stabilityOnSuccess(weights: readonly Fix[], card: FactCard, rating: Rating, r: Fix): Fix {
  const hard = rating === "hard" ? weight(weights, 15) : ONE;
  const easy = rating === "easy" ? weight(weights, 16) : ONE;
  const base = mul(exp(weight(weights, 8)), sub(fromInt(11), card.difficulty));
  const decay = pow(card.stability < S_MIN ? S_MIN : card.stability, -weight(weights, 9) as Fix);
  const surprise = sub(exp(mul(weight(weights, 10), sub(ONE, r))), ONE);
  const growth = mul(mul(mul(base, decay), mul(surprise, hard)), easy);
  return mul(card.stability, add(ONE, growth));
}

/** `S_f = w11·D^-w12·((S+1)^w13 − 1)·e^(w14·(1−R))`, never above the old stability. */
function stabilityAfterLapse(weights: readonly Fix[], card: FactCard, r: Fix): Fix {
  const s = card.stability < S_MIN ? S_MIN : card.stability;
  const byDifficulty = pow(card.difficulty < D_MIN ? D_MIN : card.difficulty, -weight(weights, 12) as Fix);
  const bySize = sub(pow(add(s, ONE), weight(weights, 13)), ONE);
  const bySurprise = exp(mul(weight(weights, 14), sub(ONE, r)));
  const lapsed = mul(mul(weight(weights, 11), byDifficulty), mul(bySize, bySurprise));
  return lapsed < s ? lapsed : s;
}

/**
 * The scheduler the rest of the engine sees.
 *
 * `capInterval` is ADR-0008's second decision made mechanical: a **slow**-correct
 * answer is rated Hard *and* the interval is not allowed to grow past what it
 * already was. Without the cap, a child who is still counting on their fingers
 * gets the fact back in a fortnight, and the failure is invisible in the
 * healthy-looking direction right up until the intervals are too long to recover
 * from (`A-03`).
 */
export function fsrsScheduler(weights: readonly Fix[] = DEFAULT_WEIGHTS): FactScheduler {
  if (weights.length !== WEIGHT_COUNT) {
    throw new RangeError(`fsrs: expected ${String(WEIGHT_COUNT)} weights, got ${String(weights.length)}`);
  }
  return {
    name: "fsrs-6",
    weightCount: weights.length,

    create(today: Day): FactCard {
      const stability = initialStability(weights, "good");
      return {
        ...NEW_FACT_CARD,
        stability,
        difficulty: initialDifficulty(weights, "good"),
        dueDay: today + intervalFor(weights, stability),
        reps: 0,
        lapses: 0,
      };
    },

    review(card: FactCard, rating: Rating, today: Day, capInterval: boolean): FactCard {
      const elapsed = Math.max(0, today - (card.dueDay - intervalFor(weights, card.stability)));
      const r = retrievability(weights, card.stability, elapsed);
      const difficulty = nextDifficulty(weights, card.difficulty, rating);
      const lapsed = rating === "again";
      const stability = lapsed
        ? stabilityAfterLapse(weights, card, r)
        : stabilityOnSuccess(weights, { ...card, difficulty }, rating, r);

      const previousInterval = intervalFor(weights, card.stability);
      const wanted = intervalFor(weights, stability);
      const interval = capInterval ? Math.min(wanted, Math.max(MIN_INTERVAL_DAYS, previousInterval)) : wanted;

      return {
        stability: stability < S_MIN ? S_MIN : stability,
        difficulty,
        dueDay: today + interval,
        reps: card.reps + 1,
        lapses: card.lapses + (lapsed ? 1 : 0),
      };
    },
  };
}

/**
 * A checksum of a weight vector, so the pinning test names a *changed vector*
 * rather than printing twenty-one numbers at a reviewer.
 *
 * A plain sum would not notice two weights swapping places, which is exactly the
 * shape a hand-edit produces.
 */
export function weightChecksum(weights: readonly Fix[]): number {
  let hash = 0;
  weights.forEach((value, index) => {
    hash = (Math.imul(hash ^ (value + index * 7919), 0x01000193) >>> 0) >>> 0;
  });
  return hash;
}

