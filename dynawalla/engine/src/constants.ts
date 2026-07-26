/**
 * Every coefficient the learner model uses, in one file, each one traced to the
 * line of ADAPTIVE_LEARNING.md it comes from — or marked PROVISIONAL where the
 * document pins the *shape* of a rule but not its number.
 *
 * The distinction matters, and it is the same one GATES.md draws between a
 * REGRESSION BOUND and a PEDAGOGICAL ASSERTION: when something fails, the label
 * tells you whether to fix the code or to question the constant. Corpán set eleven
 * ship gates of which three were unsatisfiable under any scheduler, and it cost two
 * calibration rounds to find out.
 */

import { fromInt, fromMicro, fromRatio } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";

// ---------------------------------------------------------------- Layer S ----

/** `U(n) = 0.9 / (1 + 0.06n)` — the learning-rate numerator. */
export const UPDATE_RATE_NUMERATOR: Fix = fromRatio(9, 10);
/** …and the 0.06 in its denominator. */
export const UPDATE_RATE_DECAY: Fix = fromRatio(6, 100);

/** Asymmetric credit: ×1.0 correct, ×0.7 incorrect, so one mis-tap never craters a child. */
export const CREDIT_CORRECT: Fix = fromInt(1);
export const CREDIT_INCORRECT: Fix = fromRatio(7, 10);

/** 0.15× of the residual propagates to each direct prerequisite. */
export const PREREQ_PROPAGATION: Fix = fromRatio(15, 100);

/** Evidence weights. 1 is the default; the others are named at their call sites. */
export const EVIDENCE_FULL: Fix = fromInt(1);
export const EVIDENCE_HALVED: Fix = fromRatio(1, 2);
export const EVIDENCE_LUCKY_CHOICE: Fix = fromRatio(3, 10);

/**
 * φ, the fluency estimate, moves on the same evidence but at a fifth of the rate
 * and only on speed. PROVISIONAL: the document defines φ's role — "does it without
 * counting" — but not its update constant.
 */
export const FLUENCY_RATE: Fix = fromRatio(2, 10);

// -------------------------------------------------------------- Mastery ----

/**
 * PROVISIONAL. The document pins three hard rules — a choice item can never
 * advance past Practiced, no promotion is ever denied on latency alone (A-05), and
 * a Mastered skill unfailed for 21 days is Retired — but not the thresholds. These
 * are the knobs EG-5 calibration will move; the rules above are not knobs.
 */
export const PRACTICED_MIN_ATTEMPTS = 4;
export const PRACTICED_MARGIN: Fix = fromRatio(3, 10);
export const MASTERED_MIN_ATTEMPTS = 8;
export const MASTERED_MARGIN: Fix = fromInt(1);
/** A Mastered skill unfailed for this many days is Retired from normal pools. */
export const RETIREMENT_DAYS = 21;

// ---------------------------------------------------------------- Layer B ----

/** `β ← 0.9·β + 1{bug fired}`. */
export const BUG_DECAY: Fix = fromRatio(9, 10);
/** A bug is active at β ≥ 2.2 — roughly three firings in short order. */
export const BUG_ACTIVE_THRESHOLD: Fix = fromRatio(22, 10);
/** Sparse and hard-capped, so state size cannot grow with use (EG-3). */
export const MAX_TRACKED_BUGS = 64;

// -------------------------------------------------------------- Controller ----

/** Difficulty target 0.80, band [0.70, 0.92]. Not 0.85 — see ADAPTIVE_LEARNING.md. */
export const P_TARGET_DEFAULT: Fix = fromRatio(80, 100);
export const P_TARGET_MIN: Fix = fromRatio(70, 100);
export const P_TARGET_MAX: Fix = fromRatio(92, 100);
/** `pTarget ← clamp(pTarget + 0.06·fail − 0.015·pass, 0.70, 0.92)`, per item. */
export const P_TARGET_UP_ON_FAIL: Fix = fromRatio(6, 100);
export const P_TARGET_DOWN_ON_PASS: Fix = fromRatio(15, 1000);

/** Batch composition is expressed as offsets from `pTarget`, never absolute `P̂`. */
export const STRETCH_OFFSET: Fix = fromMicro(-70_000);
export const CONFIDENCE_OFFSET: Fix = fromMicro(100_000);
/** Never two consecutive items below `pTarget − 0.20`. */
export const FRUSTRATION_OFFSET: Fix = fromMicro(-200_000);

// -------------------------------------------------------------- Scheduler ----

export const BATCH_SIZE = 8;
/** Within a batch: ≤2 consecutive from one skill, ≤3 from one operation. */
export const MAX_CONSECUTIVE_SAME_SKILL = 2;
export const MAX_PER_OPERATION = 3;
/** ≥3 distinct skills once three are reachable. */
export const MIN_DISTINCT_SKILLS = 3;
/** A brand-new skill gets a blocked debut of 3–4 consecutive guided items. */
export const DEBUT_BLOCK_MIN = 3;
export const DEBUT_BLOCK_MAX = 4;
/** Repair items are capped at ≤25% of any batch (A-12). */
export const MAX_REPAIR_FRACTION_PERCENT = 25;
/** Never re-serve an identical item within 6 cards. */
export const NO_REPEAT_WINDOW = 6;
/** After 3 failures on one skill it is benched for the session. */
export const BENCH_AFTER_FAILURES = 3;
/** ≤40% of a rolling 50-item window from any one skill. */
export const ROLLING_WINDOW = 50;
export const MAX_WINDOW_SHARE_PERCENT = 40;
/** 25% of a batch of 8, expressed as the count the planner actually uses. */
export const MAX_REPAIR_PER_BATCH = 2;

/**
 * Cold start. **No placement test**: the first 20 exercises are a
 * scripted-but-adaptive ladder inside the fiction, and no card in them may be
 * predicted below `P̂ = 0.55`. Both numbers are the document's.
 */
export const COLD_START_ITEMS = 20;
export const COLD_START_MIN_P: Fix = fromRatio(55, 100);
/** One grade answer seeds `θ = b̄ − 0.4` at or below the band… */
export const SEED_AT_BAND: Fix = fromRatio(-4, 10);
/** …and `b̄ − 2.0` one band above it. */
export const SEED_ABOVE_BAND: Fix = fromInt(-2);

/**
 * A low-`φ`/high-`θ` child gets short fluency bursts **at `P̂ ≈ 0.90`, never
 * harder problems**. This is the whole of the slow-but-correct discrimination on
 * the scheduling side; the other half is `A-05`, which `masteryFor` honours by
 * containing no reference to `φ` at all.
 */
export const FLUENCY_BURST_P: Fix = fromRatio(90, 100);

/** The Stage-1 VERIFY retry is served at `b = θ_s − 0.8`. */
export const RETRY_EASIER_BY: Fix = fromRatio(8, 10);

/** A Mastered skill comes back for review after this many quiet days. */
export const REVIEW_AFTER_DAYS = 7;

/**
 * Anti-stagnation: three sessions with `θ` improving by less than 0.3 and the
 * scheduler goes around — a different representation, not more of the same.
 * PROVISIONAL in the count of sessions; the 0.3 is the document's.
 */
export const STALL_SESSIONS = 3;
export const STALL_MIN_GAIN: Fix = fromRatio(3, 10);

/** Bounded rings. The state budget is a property of these two numbers (EG-3). */
export const MAX_ROLLUPS = 180;
export const MAX_EVENTS = 512;

// -------------------------------------------------------------- Gate bounds ----

/**
 * EG-5. The reliability diagram is binned at 0.05 and each bin with at least 200
 * items must agree with its realised rate to ±0.06. Both numbers are the
 * document's.
 */
export const CALIBRATION_BIN_WIDTH = 50_000;
export const CALIBRATION_MIN_ITEMS = 200;
export const CALIBRATION_TOLERANCE: Fix = fromRatio(6, 100);

/**
 * EG-7 / `A-09`. **REGRESSION BOUND — set from the pilot run recorded in the M5
 * handoff, not from theory.**
 *
 * `N` in the document is the number of times the controller's direction may
 * alternate. Measured over 10-item blocks inside a 50-item window, because the
 * per-item reading is vacuous: `ΔpTarget` is `+0.06` on a failure and `−0.015`
 * on a pass by construction, so per-item sign alternation counts the child's
 * failures rather than the controller's stability. `gates.ts` explains the
 * substitution at the point it is made.
 */
export const CONTROLLER_BLOCK = 10;
/**
 * The span the alternations are counted over. **100, not 50**: five ten-card
 * blocks admit at most four alternations, so any bound of four over a 50-card
 * window is satisfied by every possible series and the gate cannot fail. Ten
 * blocks admit nine, so a bound inside that range is a real constraint.
 */
export const CONTROLLER_SPAN = 100;
/**
 * `N`, recorded here because `A-09` requires it to be — and recorded together with
 * the finding that **it cannot be made into a non-vacuous bound for this
 * controller.**
 *
 * `pTarget ← clamp(pTarget + 0.06·fail − 0.015·pass)` has its fixed point exactly
 * where `0.06·(1−q) = 0.015·q`, i.e. at a realised accuracy of 0.80 — which is
 * the accuracy the scheduler is aiming for. A controller sitting at its fixed
 * point has an expected net movement of zero over any window, so the *sign* of
 * that movement is a coin flip whatever the window length: measured over ten
 * 10-card blocks the worst case was 8 and 9 alternations out of a possible 9,
 * consistently, on a controller that is behaving exactly as specified.
 *
 * The meaningful stability measure for this controller is the **swing** —
 * `CONTROLLER_MAX_SWING` — which is a bound on how much the difficulty can move
 * inside a window a child could feel, and which does fail when the controller
 * misbehaves. The alternation leg is kept because `A-09` names it, is set to the
 * maximum the measure admits, and is labelled VACUOUS in the report so nobody
 * reads it as evidence.
 */
export const CONTROLLER_MAX_ALTERNATIONS = 9;
export const CONTROLLER_MAX_SWING: Fix = fromRatio(23, 100);

// ---------------------------------------------------------------- Latency ----

/** EWMA weight for the child's personal latency baseline. PROVISIONAL. */
export const LATENCY_EWMA_WEIGHT: Fix = fromRatio(2, 10);
/**
 * Rating thresholds as a fraction of the child's own baseline. The document pins
 * the shape — fast-correct → Good/Easy, slow-correct → Hard with the interval
 * capped, incorrect → Again — and these are PROVISIONAL numbers for it.
 */
export const RATING_EASY_RATIO_PERCENT = 60;
export const RATING_GOOD_RATIO_PERCENT = 140;
/** A fact card is only created once the child is fluent enough to be recalling it. */
export const FACT_ELIGIBILITY_PHI: Fix = fromRatio(1, 2);

/** z-score bands for the slip / misconception / no-idea discrimination. */
export const LATENCY_Z_SLIP: Fix = fromInt(1);
export const LATENCY_Z_NO_IDEA: Fix = fromInt(2);

// ---------------------------------------------------------------- Fatigue ----

/** Accuracy down ≥20 points against the session's first third. */
export const FATIGUE_ACCURACY_DROP_POINTS = 20;
/** Any two indicators → fatigued: evidence halved, pTarget to 0.90, no new skills. */
export const FATIGUE_INDICATORS_REQUIRED = 2;
export const FATIGUE_P_TARGET: Fix = fromRatio(90, 100);
