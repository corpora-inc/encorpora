// journey/engine/constants.ts — every tunable number in one module so
// simulation sweeps patch exactly one file (engine.md §1.1).

/** itemCardCodec schemaVersion + meta stamp (engine.md §3.4). */
export const ENGINE_SCHEMA = 1

// ---- FSRS / scheduling ------------------------------------------------------
/** FSRS desired retention — the internal pace knob (adaptivity §1.3: "0.85 =
 *  fewer reviews/more forgetting; 0.93 = review-heavy"; never user-visible).
 *  W11 round 2 VALIDATED 0.85 AND REJECTED it: it cuts P3 demand 35→14:1 and
 *  P1 median 2.1→1.7 but still passes neither bound, while collapsing P7
 *  strand convergence (17–23/25 → ~3/12 equivalent — thinner days make the
 *  2-week shares noise-limited; serving pressure cannot recover it). Under
 *  the §7.1 fixed-ability learner P1/P3/P4 are unsatisfiable at ANY flat
 *  retention — see scripts/journey-sim/CALIBRATION.md §7–§8 (spec-amendment
 *  escalation). Do not lower this without re-running the gate matrix. */
export const DESIRED_RETENTION = 0.9
export const MAX_ELAPSED_DAYS = 365 // clock-jump clamp (engine.md §1.3)
/** Codec sanity range for `due` (epoch days ≈ 1970..2079; static, no clock). */
export const MAX_EPOCH_DAY = 40_000

// ---- θ / Elo (adaptivity §2.3) ---------------------------------------------
export const THETA_K_START = 0.5
export const THETA_K_FLOOR = 0.08
export const THETA_K_DECAY = 0.99 // per result; 0.5 → 0.08 over ~180 results
export const THETA_DEFAULT = -4 // zero-beginner

// ---- skill level thresholds (engine.md §2.3 table) --------------------------
export const LEVEL_PRACTICED = { coverage: 0.8, strength: 0.7, accEwma: 0.75 }
export const LEVEL_MASTERED = { coverage: 0.95, strength: 0.9, accEwma: 0.85 }
export const LEVEL_DEMOTE = { strength: 0.5, accEwma: 0.5 }
export const ACC_EWMA_ALPHA = 0.3
export const PLACED_ACC_EWMA = 0.75 // provisional Practiced floor (§4.3.2)

// ---- new-intake throttle + debt brake (adaptivity §5.5, pedagogy §12.2) -----
export const NEW_PER_DAY_DEFAULT = 12
export const NEW_PER_DAY_MIN = 4
export const NEW_PER_DAY_MAX = 30
export const CAPACITY_EWMA_ALPHA = 0.15
export const CAPACITY_SEED = 40
export const BACKLOG_RING_SIZE = 7
export const THROTTLE_ADJUST_INTERVAL_DAYS = 7
export const THROTTLE_DOWN_FACTOR = 0.8
export const THROTTLE_UP_FACTOR = 1.2
/** Weekly-throttle thresholds vs dailyCapacityEwma (extracted from daily.ts
 *  hard-codes — engine.md §1.1; values preserve shipped behavior: 2.5 and
 *  the 0.1 up-gate were literals, the down-step was keyed to
 *  DEBT_BRAKE_RATIO). W11 round 2 VALIDATED a 1.0 down-target AND REJECTED
 *  it: the NEW_PER_DAY_MIN floor binds long before the threshold does, so
 *  the P1 median doesn't move (2.08 vs 2.10) while lapser recovery
 *  floor-pins (drain leg 0/12). See scripts/journey-sim/CALIBRATION.md §7. */
export const THROTTLE_HARD_RATIO = 2.5 // median > this × cap ⇒ double down-step
export const THROTTLE_DOWN_RATIO = 1.5 // median > this × cap ⇒ down-step
export const THROTTLE_UP_RATIO = 0.1 // median < this × cap ∧ cruise > 50% ⇒ up-step
export const DEBT_BRAKE_RATIO = 1.5 // |DUE| > 1.5× dailyCapacityEwma ⇒ new = 0
export const SOFT_BACKLOG_RATIO = 2 // |DUE| > 2× sessionThroughput ⇒ review += .15
export const SESSION_THROUGHPUT_MIN = 20
export const MAX_TICKDAY_ITERATIONS = 30

// ---- mixer quotas (engine.md §5.3) -------------------------------------------
export const BASE_QUOTA = { review: 0.35, new: 0.35, repair: 0.1, fun: 0.1, flex: 0.1 } as const
export const STRUGGLE_NEW_FLOOR = 0.1
export const STRUGGLE_NEW_CUT = 0.2
// Deficient-strand template up-weight (the spec's tie-break floor is ×1.5,
// engine.md §5.3.3; the shipped value is sweep-tuned for P7) + the
// proportional control law in strands.ts (weight ≈ (target/current)^exp,
// clamped) — over-represented strands are down-weighted by the ratio < 1
// side of the same law, so no separate down-weight constant exists (the
// unused STRAND_OVER_WEIGHT was removed in W11 round 2).
export const STRAND_BIAS_WEIGHT = 3
export const STRAND_CONTROL_EXPONENT = 1.5
export const STRAND_CONTROL_MIN = 0.15
export const STRAND_CONTROL_MAX = 5
// Speak-first: when a Whisper model is INSTALLED, the output (speaking) strand's
// template weight is multiplied by this so installing STT visibly increases live
// speaking beyond the flat stage target. Applied on top of the proportional
// control law, then re-clamped to STRAND_CONTROL_MAX so it can never dominate.
export const STT_INSTALLED_OUTPUT_WEIGHT = 1.8
export const LANGUAGE_SHARE_HARD_CAP = 0.65 // over last40 ⇒ force 2 input/fluency slots
export const REPLAY_MIN_GAP = 3
export const ITEM_MIN_GAP = 3
export const ITEM_MIN_GAP_RELAXED = 2
export const MAX_FUN_PER_10 = 1
// Doom-scroll-to-fluency: the feed is INFINITE. When the day's real work is done
// (new target met, no due/repair/trickle) the eager learner who keeps going gets
// FRESH frontier material — the NEXT reachable units' new items — pulled forward,
// plus a rotating fun/variety stream. NEVER a wind-down-to-terminal.
//
// Continuation stream: once the normal quota pools drain, the mixer serves a
// bounded slice of FUN per batch (a variety beat) but always co-serves frontier
// NEW so the feed keeps advancing — fun is a garnish, never the whole meal.
export const CONTINUATION_FUN_PER_BATCH = 2
// Frontier pull-forward horizon: how many units AHEAD of the position cursor an
// eager continuing learner can unlock new material from IN ONE SITTING, provided
// each unit's prereq skills are already reachable (DAG-gated, §6 position rules).
// The per-day NEW throttle is a SOFT milestone the binger blows past; the DAG is
// the hard wall. Position itself does NOT move here — that stays checkpoint-gated
// (SRS integrity), so spacing still governs REVIEWS; only NEW exploration uncaps.
export const FRONTIER_LOOKAHEAD_UNITS = 3
// Anti-repeat for the continuation stream: consecutive cards must differ in item
// AND (where the type menu allows) activity type. This window is how far back the
// mixer looks to escalate form/variety as a run of continuations grows.
export const CONTINUATION_VARIETY_WINDOW = 3
export const MAX_LEECH_PER_BATCH = 1
/** A match_pairs card carries 4–6 items so the renderer shows multiple pairs
 *  (never the one-pair collapse, defect #2). Companions are drawn from the
 *  primary item's unit(s) and the immediately-prior unit; fewer is accepted
 *  only when the content band is too thin to reach the floor. */
export const MATCH_PAIRS_MIN_ITEMS = 4
export const MATCH_PAIRS_MAX_ITEMS = 6
/** Flagged leeches also skip ~half their batch opportunities — leeches must
 *  not eat the feed (P10 ≤3% bound; the 1/batch cap alone allows ~10%). */
export const LEECH_SERVE_P = 0.5
export const CONSTRAINT_REPAIR_PASSES = 3
export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_CHECKPOINT_CADENCE = 10
export const OPENER_R_MIN = 0.8
export const OPENER_R_MAX = 0.95
export const NEAR_WIN_R_MIN = 0.9
export const FUN_POOL_R_MIN = 0.9

// ---- rare-card economy (D7; engine.md §5.4 step 3) ---------------------------
export const RARE_DELIGHT_P = 1 / 8
export const RARE_MINIGAME_P = 1 / 25
export const RARE_ETYMOLOGY_P = 1 / 50

// ---- flow controller (adaptivity §6.1) ---------------------------------------
export const FLOW_WINDOW = 8
export const FLOW_MIN_SCORED = 4
export const FLOW_CRUISE_PERF = 0.9
export const FLOW_STRUGGLE_PERF = 0.55
export const FLOW_STRUGGLE_FAILS = 3
export const FLOW_FAIL_SCORE = 0.5
export const FLOW_LATENCY_PENALTY = 0.15

// ---- forms (engine.md §5.5) ---------------------------------------------------
export const PRODUCTION_READY_R = 0.7
export const FORM_CEILING_P = 0.7

// ---- grading / latency (engine.md §4.5) ---------------------------------------
export const GRADE_Z_EASY = 0.6
export const GRADE_Z_HARD = 2.0
export const STT_AGAIN_BELOW = 0.45
export const STT_HARD_BELOW = 0.7
export const STT_EASY_ABOVE = 0.9
export const GAME_ROUND_HARD_BELOW = 0.5
export const LATENCY_EWMA_ALPHA = 0.2
export const LATENCY_SEEDS_MS: Record<string, number> = {
  choice_pick: 3500,
  listen_pick: 3500,
  intro_echo: 3500,
  match_pairs: 4000,
  flip_recall: 5000,
  word_order: 8000,
  speak_echo: 8000,
  cloze: 9000,
  grammar_note: 9000,
  listen_type: 11000,
}
export const LATENCY_SEED_DEFAULT_MS = 8000
export const LENGTH_SCALE_DIVISOR = 30
export const LENGTH_SCALE_MIN = 0.6
export const LENGTH_SCALE_MAX = 2.5

// ---- leeches (adaptivity §6.4) -------------------------------------------------
/** W11 round 2 VALIDATED 4/2.5 (retire the §7.1 churner band) AND REJECTED
 *  it: it does cut P3 demand (35→27:1 alone) and P4 struggle share
 *  (52.8→44.5%), but a struggling learner's entire frontier IS churner-band
 *  under the fixed-ability model — ~1,900 cards flag, and each flagged card
 *  costs a fixed ~2 post-flag lapses of servings before suspension, so P10
 *  containment blows to 6.3–7.3% (bound 3%) at ANY serve probability; flag
 *  at 5 changes nothing. Coupled P3↔P10 conflict, escalated in
 *  scripts/journey-sim/CALIBRATION.md §7–§8. */
export const LEECH_LAPSES = 6
export const LEECH_REPS_RATIO = 2
export const LEECH_SUSPEND_EXTRA_LAPSES = 2

// ---- placement (engine.md §4.3) -------------------------------------------------
export const PLACEMENT_LADDER_RUNGS = [-3, -1.5, 0, 1.5, 3] as const
export const PLACEMENT_THETA_START = -1.0
export const PLACEMENT_SE_START = 2.0
export const PLACEMENT_K_START = 0.9
export const PLACEMENT_K_DECAY = 0.82
export const PLACEMENT_K_FLOOR = 0.15
export const PLACEMENT_SE_TARGET = 0.45
export const PLACEMENT_MAX_ITEMS = 20 // Phase-2 budget
export const PLACEMENT_MAX_TOTAL = 25
export const PLACEMENT_MAX_MS = 4 * 60_000
export const PLACEMENT_TARGET_JITTER = 0.3
export const PLACEMENT_ABOVE_CONTENT_MARGIN = 0.5 // R10
/** "Above-content" needs a supported θ̂: on a narrow-band pack the post-ladder
 *  θ̂ still rides the −1.0 prior with se ≈ 1.9, and exiting on it mis-routes
 *  mid-band learners (W10 P8 FAIL on the real journey_en pack). Genuinely
 *  above-ceiling learners keep passing ceiling probes, so se falls under this
 *  bound within a few Phase-2 items — never a 25-item grind (≈11 of the
 *  20-item Phase-2 budget at this bound). */
export const PLACEMENT_ABOVE_CONTENT_MAX_SE = 0.7
export const PLACEMENT_UNLOCK_MARGIN = 0.5 // unlock b_s ≤ θ − 0.5
export const PLACEMENT_FRONTIER_PROBES = 2

// ---- week-one placement check (engine.md §4.3.4) --------------------------------
export const FIRST_WEEK_RESULTS = 150
export const FIRST_WEEK_REWIND_BELOW = 0.6
export const FIRST_WEEK_JUMP_ABOVE = 0.92

// ---- jump (engine.md §5.9) --------------------------------------------------------
export const JUMP_CRUISE_SESSIONS = 2
export const JUMP_OFFER_INTERVAL_DAYS = 3
export const JUMP_PROBES_PER_LAYER = 3
export const JUMP_NEAR_LAYERS = 2
export const JUMP_MISTAKES_NEAR = 3
export const JUMP_MISTAKES_FAR = 2
export const JUMP_THETA_BONUS = 0.3
export const CRUISE_SESSION_MIN_SCORED = 8

// ---- legendary (engine.md §5.8) ----------------------------------------------------
export const LEGENDARY_ITEMS_MIN = 12
export const LEGENDARY_ITEMS_MAX = 16
export const LEGENDARY_MISTAKES_ALLOWED = 2

// ---- interlude cadence (PREMIUM_SCROLL §2.2/§2.3) -----------------------------------
// A game interlude is a spike (~1 in 12–18 cards); a reader interlude is a
// down-tempo breath (~1 in 20–30). These are the felt-cadence MINIMUMS the
// mixer schedules toward: an interlude of a given kind is eligible only once
// its own gap since the last one of that kind is met, AND the shared floor
// below has passed (never two interludes back-to-back; a spike needs ≥ a few
// fast core cards to spike from). Deterministic-safe: a small seeded jitter
// spreads the exact card so the cadence never feels metronomic.
export const GAME_INTERLUDE_MIN_GAP = 12
export const GAME_INTERLUDE_JITTER = 6 // → effective 12–18
export const READER_INTERLUDE_MIN_GAP = 20
export const READER_INTERLUDE_JITTER = 10 // → effective 20–30
/** Never two interludes back-to-back: at least this many cards must separate
 *  ANY two interludes (game or reader), regardless of their own cadences. */
export const INTERLUDE_BACK_TO_BACK_FLOOR = 4
/** Never several checkpoints back-to-back: at least this many cards must
 *  separate ANY two checkpoints (cadence "Punto de control" OR a boss/arc
 *  checkpoint). Checkpoints are milestones — space them well. Sits safely below
 *  the default checkpoint cadence (10) so it never suppresses the normal beat,
 *  only the over-fire (catch-up drain / boss-after-cadence seam). */
export const CHECKPOINT_BACK_TO_BACK_FLOOR = 8
/** Combo at/above which the learner is "hot" → prefer a reader breath
 *  (comedown); a cold stretch (combo 0) → prefer a game spike (re-ignite). */
export const INTERLUDE_HOT_COMBO = 4

// ---- session / welcomeBack (engine.md §4.1) -----------------------------------------
export const WELCOME_BACK_GAP_DAYS = 7

// ---- REPAIR pool (engine.md §5.2) ----------------------------------------------------
export const REPAIR_ACC_BELOW = 0.6
export const REPAIR_DEMOTED_WINDOW_DAYS = 14

// ---- strands (pedagogy §12.1) --------------------------------------------------------
export const STRAND_WINDOW_DAYS = 14
export const LAST40_WINDOW = 40
/** Stage → [input, output, language, fluency] targets. */
export const STRAND_TARGETS: Record<string, [number, number, number, number]> = {
  A0: [0.3, 0.1, 0.4, 0.2],
  A1: [0.3, 0.1, 0.4, 0.2],
  A2: [0.3, 0.2, 0.3, 0.2],
  B1: [0.3, 0.25, 0.2, 0.25],
  B2: [0.3, 0.25, 0.15, 0.3],
  C1: [0.35, 0.25, 0.1, 0.3],
  C2: [0.35, 0.25, 0.1, 0.3],
}
