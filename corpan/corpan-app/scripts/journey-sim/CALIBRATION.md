# W11 Engine Calibration Study — round 2 complete (§5–§10); round-1 evidence in §1–§4

Scope: engine.md §7.4 gates P1/P3/P4/P7, which failed on W3's final 25×180 run.
Method: reproduce → single-axis sweeps over `engine/constants.ts` → combined
mechanisms → 3-seed before/after matrix. This document records the study as far
as it has run; **no behavioral constant change ships from this branch yet** —
the only sim-validated finding so far is that the flat-retention knob alone
cannot satisfy the gates (table below), and shipping an unvalidated combination
would be threshold-hacking, not calibration.

## 1. Reproduction (gate config: 25 learners/persona × 180 days × 7 personas, seed 1)

W3's failures reproduce **verbatim** (`cli.ts --seed 1`, 315.8 s):

```
[FAIL] P1 daily-median 0/25 (median due ratio 2.11 vs ≤1.2, p95 2.39 vs ≤2.0); lapser drain 2/25
[FAIL] P3 median review:new 34.92:1 (bounds [3,6])
[FAIL] P4 Arc-1 median 55 active days (ok); daily-fast 41 (needs ≤41, knife-edge);
       slow-struggler struggle share 51.1% (≤40%)
[FAIL] P7 19/25 within ±10 strand points (needs ≥20/25); worst dev 13.3%
[PASS] P2 P5 P6 P9 P10 P11   [DEFER] P8 (R10)
```

Baseline daily-median internals (metrics.json): ~100 scored cards/day capacity,
~12,900 review touches vs ~750 debuts over 180 d, `newPerDay` pinned at the
4–5 floor from ~week 5 — the intake throttle collapses and the due queue parks
at ~2× capacity. This matches W3's diagnosis.

## 2. Desired-retention sweep (single axis)

`request_retention` moved from a scheduler literal into
`constants.ts:DESIRED_RETENTION` (engine.md §1.1: every tunable in one module;
adaptivity §1.3 names it the pace knob, "0.85 = fewer reviews/more
forgetting"). Sweep driver: `sweep.ts` (patches constants.ts in place per
config, runs cli.ts, restores). Config: 12 learners × 180 d, seed 1, personas
daily-median/daily-fast/slow-struggler/lapser (the failing gates' personas;
P5's FAIL rows below are an artifact of the persona subset — placed-intermediate
absent — not a regression).

| config | P1 med ratio (≤1.2) | P1 p95 (≤2.0) | lapser drain | P3 ratio ([3,6]) | P4 arc1 med (45–100) | P4 fast (≤0.75×med) | P4 struggle (≤40%) | P7 within ±10 (≥80%) |
|---|---|---|---|---|---|---|---|---|
| base DR=0.90 | 2.11 | 2.41 | 0/12 | 35.03 | 55 | 40 ≤41 ✓ | 48.8% ✗ | 11/12 ✓ |
| DR=0.87 | 2.02 | 2.29 | 10/12 | 21.56 | 55.5 | 37.5 ≤42 ✓ | 51.7% ✗ | 5/12 ✗ |
| DR=0.85 | 1.93 | 2.28 | 8/12 | 18.45 | 58 | 41.5 ≤44 ✓ | 50.8% ✗ | 3/12 ✗ |
| DR=0.83 | 1.88 | 2.31 | 11/12 | 14.72 | 62.5 | 53 ≤47 ✗ | 53.3% ✗ | 0/12 ✗ |
| DR=0.80 | 0.33 | 2.27 | 12/12 | 10.69 | 73 | 58 ≤55 ✗ | 53.2% ✗ | 2/12 ✗ |

**Findings — the flat pace knob is NOT sufficient:**

1. **P1 median is pinned by the debt-brake/throttle operating point, not by
   FSRS demand.** Lowering DR halves scheduled demand (P3 35→14.7) yet the
   median due ratio only moves 2.11→1.88 through DR=0.83; at DR=0.80 demand
   finally undershoots the operating point and the median collapses to 0.33 —
   but the **p95 stays ≈2.3 at every DR**, because the churner spikes (finding
   2) and weekly-throttle clumping survive any flat demand cut. Between 0.83
   and 0.80 there is a demand/capacity crossover for the median; no flat DR
   value passes both P1 legs. The weekly throttle only cuts
   `newPerDay` when the backlog median exceeds `DEBT_BRAKE_RATIO`(1.5)×capacity
   and only raises it below 0.1×capacity (`daily.ts` — thresholds currently
   hard-coded 2.5/0.1 there, in tension with engine.md §1.1). Intake therefore
   refills the queue until it hovers at the brake boundary ≈1.5–2× capacity,
   structurally above P1's 1.2× median bound. Fix direction: extract the
   throttle target ratios to constants.ts and aim them at ~1.0×cap (P2's
   "engages whenever backlog > 1.5×" stays satisfied — it is one-sided).
2. **Low-ceiling "churner" items dominate steady-state demand.** The §7.1
   learner has a fixed recall ceiling σ(a−b\*) that practice never raises. An
   item's FSRS interval grows only when expected log-growth
   c·ln(2.1) − (1−c)·ln(0.3)⁻¹ > 0, i.e. true pass rate c ≳ 0.63. daily-median
   (a≈0) meets Arc-2 items at b\*∈[−2,−0.6] (σ∈[0.65,0.88], ×0.85 on production
   forms): a growing share of items sit below the growth threshold and re-due
   every few days forever. Current leech policy (`lapses ≥ 6 ∧ reps/lapses < 2`)
   only retires items failed >50% of the time — the c∈[0.5,0.63] churner band
   is never flagged. This is why demand saturates at ANY retention level. Fix
   direction (spec-permitted pool policy, adaptivity §6.4 / engine.md §5):
   sweep `LEECH_LAPSES` 6→4 and `LEECH_REPS_RATIO` 2→2.5 with P9/P10 watched.
3. **P7 anti-correlates with DR.** Fewer due servings shift the served mix
   toward debut/lesson templates and away from the higher-form (output/fluency)
   reviews, blowing the strand shares out (worst dev 13.3%→29.0% as DR drops).
   Any demand reduction must be paired with strand-aware serving pressure
   (`STRAND_BIAS_WEIGHT`, control-law exponent) — re-diagnose with the
   mean-signed-deviation instrumentation now emitted in the P7 detail line.
4. **P4's two sub-gates pull in opposite directions.** slow-struggler struggle
   share (~50%) is invariant across DR: it is the churner mechanism again
   (window of 8 with ≥3 fails ⇒ struggle; a≈−1 keeps true pass ≈0.55–0.65 on
   frontier items regardless of scheduling). daily-fast's ≤0.75× ratio erodes
   at low DR because Jump offers ride cruise mode, which the noisier low-DR
   review stream suppresses.

## 3. Provisional recommendation (to validate before adoption) — *validated in §7 (round 2): REJECTED for adoption*

Mechanism bundle for the next sweep round (all constants-surface except one
extraction):

- `DESIRED_RETENTION = 0.85` (P3/P1 demand cut; adaptivity §1.3 endorses),
- extract `daily.ts` throttle ratios to constants and target median backlog
  ≈1.0×capacity (P1), keep `DEBT_BRAKE_RATIO = 1.5` (P2 spec text),
- `LEECH_LAPSES = 4`, `LEECH_REPS_RATIO = 2.5` (retire the churner band; watch
  P10 ≤3% and P9 Again ∈[5,25]%),
- strand re-tune after the above (P7),
- then the full 25×180×7 matrix at seeds 1/2/3.

**If the bundle still fails P4's struggle-share leg**, the evidence above
supports a spec-target amendment rather than more knob pressure: a learner
whose ability sits a full σ below item difficulty *is* in productive struggle
>40% of scored cards under any scheduler that keeps serving frontier content;
either the flow-struggle classification threshold (adaptivity §6.1, perf<0.55)
or P4's 40% bound should move (proposed: struggle share ≤50%, or classify
struggle on a 2-of-3-batches persistence rule). Similarly P3's [3,6] band
presumes intake never floors; with a 15-min session and FSRS-0.9 it is
unreachable at day 180 — if 0.85 retention is rejected on pedagogy grounds,
P3's band must widen (proposed: [3,10]). Do not edit the spec from this
workstream; escalate with this table.

## 4. Tooling landed on this branch

- `sweep.ts` + `sweeps/*.json` — constants-matrix sweep driver (engine.md §7.4
  "tuning sweeps reuse the same runner with a config matrix").
- `cli.ts` metrics.json now carries per-learner `finalCapacity`, `dueCurve`
  (due-at-start at days 30/60/90/120/150/179) and `modeTotals` — the
  saturation diagnostics used above.
- `report.ts` P7 detail now prints mean signed per-strand deviation
  (in/out/lang/flu) for the strand re-tune.
- `DESIRED_RETENTION` in constants.ts (value unchanged at 0.90 — behaviorally
  identical; golden transcripts untouched, engine.md §8.3 regen not needed).

Raw runs: baseline `out/`-equivalents and the sweep summary were produced under
the session scratchpad; re-run with the commands above — everything is
seed-deterministic (P6 held on every run).

---

# Round 2 (W11 round 2 — P8 placement fix + the §3 mechanism bundle)

## 5. P8 — the R10 placement fix (bug, not tuning) and where the gate lands

W10's FAIL reproduced verbatim pre-fix (`cli.ts --p8 --p8-only --learners 40
--seed 1`): in-band 29/39 (74%), mid-band learners early-exiting
"above-content" after 2 items with θ̂ −0.72 / se 1.88. Mechanism confirmed: the
Phase-1 ladder kept the GLOBAL CEFR rungs and only dropped those above
`max_b`; on journey_en (693 items, b ∈ [−3.50, −1.50]) that collapses to
[−3, −1.5] — the second rung IS the content ceiling.

**Shipped fixes** (`engine/placement.ts`, `engine/graph.ts`, constants):

1. **Ladder subdivides the pack's actual b range** (R10): rungs = the global
   ladder span clamped to `[gidx.minB, gidx.maxB]`, re-subdivided evenly
   (5 rungs; a full-span pack reproduces the spec's [−3, −1.5, 0, 1.5, 3]
   bit-for-bit, so wide-pack behavior is unchanged).
2. **"Above-content" requires a supported θ̂**: exit also needs
   `se ≤ PLACEMENT_ABOVE_CONTENT_MAX_SE (0.7)`. Genuinely-above learners
   still exit in ~11 items (never a 25-item grind); the prior-dominated
   post-ladder θ̂ can no longer misroute mid-band learners.
3. **Above-content finalize is honest on narrow packs**: θ̂ pinned to
   `maxB + margin` (no discriminating items exist beyond the ceiling — the
   raw iterate was garbage there), frontier = the LAST unit's skills (R10
   "end of shipped content", a usable in-pack frontier) instead of `[]`.
4. **Final θ̂ = 1PL MAP refit** over the full probe transcript (Newton,
   Phase-2 prior); the running Elo iterate still drives item selection
   verbatim per engine.md §4.3, and `placeUser` equivalence holds (shared
   machine). Removes the O(K_floor) stochastic-iterate variance. A 3PL
   guess-floor refit (c = probe MC floor 0.25) was evaluated and REJECTED:
   3-seed in-band accuracy 55/103 at c=0.25, 66 at 0.2, 76 at 0.15, 85 at
   0.1 vs **87/103 at c=0** — the §7.1 learner also slips below the upper
   asymptote (retention factor ≈ 0.92), and the two 1PL mismatches cancel.
5. **Self-heal instrumented in `--p8`**: every 10th learner placed from a
   +1.5-inflated ability/prior profile, then the TRUE learner plays ≤14
   days; heal = week-one rewind offer OR a placement-seeded skill demotion.
   (Injecting only an inflated `priorKnownItems` does NOT mis-place — recall
   stays gated by true ability σ(a−b\*) — hence the ability shift.)
6. Harness: above-band learners within 0.6 of the ceiling accept an accurate
   in-band placement (the engine's 0.5 margin cannot declare "above" for
   them — band-edge identifiability), symmetric to the in-band edge grace.

**P8 verbatim after the fix** (REAL journey_en pack, 40 learners/seed):

```
seed 1: FAIL — in-band |θ̂−a|≤0.6 in ≤25 items: 26/35 (74%, need ≥90%);
  above-ceiling terminate "above-content" ≤ budget: 1/1; max items asked 24;
  wrong-placement self-heal (week-one rewind or demotion ≤14d, injected 10%
  cohort): 4/4 healed (days 2,2,2,2)
seed 2: FAIL — in-band 30/34 (88%); above-ceiling 2/2; max asked 24;
  self-heal 4/4 healed (days 2,2,2,2)
seed 3: PASS — in-band 31/34 (91%); above-ceiling 2/2; max asked 24;
  self-heal 4/4 healed (days 2,3,2,2)
```

Above-ceiling and self-heal legs are green on every seed. The in-band
accuracy leg sits AT the estimator's information floor: pooled placed-row
error is unbiased (mean +0.07, σ = 0.40, n = 99) and se ≈ 0.40 is the
binomial-information bound for ≤25 guessable (4-choice, c = 0.25) probes —
±0.6 at ≥90% needs σ ≤ 0.36, i.e. ≥ 40 probes. No estimator can pass this
bar under the §7.1 learner within the spec's own ≤25-item budget;
sweeping `PLACEMENT_ABOVE_CONTENT_MAX_SE` ∈ {0.55, 0.7} ×
`PLACEMENT_TARGET_JITTER` ∈ {0.15, 0.3} moves nothing (87/103 on all four).

**P8 spec-amendment recommendation (CTO decision — evidence above):** keep
≥90% and ≤25 items, widen the tolerance to **|θ̂ − a| ≤ 0.8** (measured:
94%/94%/100% per seed, z = 2σ so seed-robust; ±0.75 measures 89%/94%/94% —
knife-edge on seed 1). Alternative if ±0.6 is pedagogically non-negotiable:
raise the probe budget to ~40 items (σ → 0.36) or drop the rate to ≥80%
(measured 74–91%: still seed-fragile at ±0.6). Adaptivity §4 already
concedes the point: *"our b values are author-assigned, not calibrated, so
precision beyond ±half a CEFR band is fake anyway"* — half a band on the
ladder scale IS 0.75; P8's ±0.6 asks for precision the research doc calls
fake. Do not tune further constants against this leg — the residual is
binomial noise, not mechanism.

## 6. Round-2 baseline ("before", at the P8-fix commit) — 25×180×7, seeds 1/2/3

Full-config runs recorded under `out/before-s{1,2,3}/`. Two notes vs the
round-1 §1 reproduction: this baseline includes W10's integration and the
Task-1 placement fix (round 1 ran pre-W10), and **P11 now FAILS on every
seed** — a finding round 1 did not have:

| seed | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P9 | P10 | P11 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FAIL | PASS | FAIL | FAIL | PASS | PASS | FAIL | PASS | PASS | FAIL |
| 2 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| 3 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |

Key details (P8 DEFERs to the real-pack `--p8` mode, §5):

- P1: median due ratio 2.09–2.10, p95 2.40–2.41, 0/25 learners in-bound on
  every seed; lapser drain 2–6/25. The §1 saturation picture verbatim:
  capacity ≈ 83–100/day, due-at-start parked at ~170–190, `newPerDay`
  floor-pinned at 4 for ~2/3 of daily-median learners.
- P3: median review:new 34.55 / 36.03 / 39.20 (bounds [3,6]).
- P4: struggle share 52.8% / 56.6% / 56.2% (≤40%); arc-1 medians 52.5–59.5
  (in range); daily-fast leg passes s2/s3, knife-edge s1 (40 vs ≤39).
- P7: 17–23/25 within ±10 (needs ≥20) — seed-marginal, FAIL on s1 only;
  mean signed dev ≤1.6 points on every strand (no systematic bias left).
- **P11 (NEW)**: relaxation rate 0.319 / 0.302 / 0.308 per batch (bound
  <0.2), zero hard violations (itemGap/debut/model-block all 0). Per-persona
  (s1): weekend-binger 0.468, daily-fast 0.311, daily-median 0.268,
  placed-intermediate 0.226 — broad-based, NOT placement-driven (daily
  personas never run placement, and their transcripts are deterministic vs
  the tip). Hypothesis: type-restricted lesson-recipe/boss slots (e.g. boss
  = 4 slots drawn from {cloze, word_order, listen_type}) make sameType
  adjacency structurally unsatisfiable, and W10's lesson integration raised
  the share of recipe-driven batches. NOT in this round's mandate — needs
  its own workstream (either widen recipe activityTypes in fixtures/packs,
  or exempt recipe-restricted slots from the relaxation count the way
  model-block pairs already are — the latter needs a CTO ruling since it
  weakens P11's meaning).

## 7. Round-2 mechanism bundle — VALIDATED AND REJECTED (evidence)

The §3 bundle was implemented and swept (`sweeps/round2.json`, 12 learners ×
180 d, seed 1, personas daily-median/daily-fast/slow-struggler/lapser; P5
FAILs in these rows are the persona-subset artifact — trickle needs
placed-intermediate; the stale leg is in-bounds at 67–71 vs the 2% cap):

| config | P1 med (≤1.2) | P1 p95 (≤2.0) | lapser drain | P3 (∈[3,6]) | P4 struggle (≤40%) | P7 (≥10/12) | P10 (≤3%) |
|---|---|---|---|---|---|---|---|
| before (25L, s1) | 2.10 | 2.40 | 6/25 | 34.6 | 52.8% | 17/25 ✗ | 1.6% ✓ |
| iso-dr85 | 1.93 | 2.35 | 8/12 | 17.2 | 51.6% | 2/12 ✗ | ✓ |
| iso-throttle (1.0) | 2.08 | 2.30 | 0/12 | 35.6 | 50.3% | 11/12 ✓ | ✓ |
| iso-leech (4/2.5) | 2.04 | 2.28 | 3/12 | 27.3 | 44.5% | 7/12 ✗ | 6.6% ✗ |
| **bundle (all 3)** | **1.66** | **2.18** | **11/12** | **13.7** | **48.6%** | **3/12 ✗** | **7.3% ✗** |
| bundle-dr87 | 1.88 | 2.25 | 9/12 | 16.7 | 45.2% | 5/12 ✗ | 6.7% ✗ |
| bundle-throttle12 | 1.67 | 2.22 | 11/12 | 13.8 | 48.6% | ✗ | 7.3% ✗ |
| bundle-leech5 | 1.70 | 2.25 | 10/12 | 14.0 | — | ✗ | 6.3% ✗ |
| bundle-strand-exp2 | 1.62 | 2.18 | 10/12 | 13.8 | — | 4/12 ✗ | 6.9% ✗ |
| bundle-strand-bias4 | 1.74 | 2.19 | 9/12 | 13.2 | — | 1/12 ✗ | 6.6% ✗ |

**Verdict: every needle moves in the predicted direction and no red gate
reaches its bound, while two green gates break.** Specifics:

1. **P1** — the bundle's median due ratio bottoms at 1.66 vs the 1.2 bound.
   The binding constraint is `NEW_PER_DAY_MIN = 4`: the throttle threshold
   is irrelevant once intake is floor-pinned (iso-throttle median 2.08 ≈
   baseline 2.10), and demand from already-introduced §7.1 churners keeps
   the queue parked. The 1.0 down-target also floor-pins lapser recovery
   (drain leg 0/12) — worse than keying to 1.5.
2. **P3** — 34.6 → 13.7:1 at best (bound 6). The steady-state ratio equals
   reviews-per-item, and §7.1's fixed recall ceiling means the sub-0.63
   pass-rate band never grows intervals: the ratio floor under this learner
   model is ~14, not 6.
3. **P4 struggle** — 52.8 → 44.5–48.6% (bound 40%): same churner mechanism;
   a learner a full σ below frontier difficulty IS in struggle >40% of
   scored cards under any serving policy that keeps serving frontier.
4. **P7 collapses at DR 0.85** (17–23/25 → 2–5/12): mean signed deviation
   stays ≤2 points (the controller is unbiased) but per-day share variance
   explodes when fewer cards/day are served — P7's max-over-days metric is
   noise-limited, and NO serving-pressure knob recovers it (exponent 2:
   4/12; bias 4: 1/12 — stronger pressure adds oscillation).
5. **P10 breaks at leech 4/2.5** (1.6% → 6.3–7.3% vs 3%): ~1,900 cards flag
   for slow-struggler (the fixed-ability model makes their ENTIRE frontier
   churner-band), and each flagged card costs a fixed ~2 post-flag lapses
   of servings before suspension — serve-probability can only spread the
   same servings over time; flag-at-5 changes nothing. P3 relief and P10
   containment are structurally coupled under §7.1.

**Adoption decision (kaizen, no-regression):** the shipped tree keeps
`DESIRED_RETENTION = 0.90`, `LEECH_LAPSES/RATIO = 6/2`, and a
behavior-preserving `THROTTLE_DOWN_RATIO = 1.5`. What ships from round 2 is
the refactor surface (throttle ratios + strand control law as constants,
`STRAND_OVER_WEIGHT` deleted, runner leech-mirror reading the real
constants, tests parameterized) so the next round is constants-only — plus
the Task-1 placement fixes (§5), which are independent of the bundle.
Adopting the bundle would trade two green gates for zero red-to-green
flips; that is threshold trading, not calibration.

## 8. Spec-amendment recommendations (P1/P3/P4 unsatisfiable — CTO input)

**Root cause, one sentence: engine.md §7.1's learner has a FIXED ability
(recall ceiling σ(a − b\*) that practice never raises), so a growing share
of introduced items can never stabilize — no scheduler drains a queue that
content keeps refilling.** Real learners' ability grows with practice —
that is the product's premise (curriculum-spine's whole hour-budget model
assumes progress). The gates P1/P3/P4 encode healthy-SRS numbers that are
only reachable when items eventually graduate.

**Recommended (option A — fix the model, keep the gates):** amend §7.1 to
give the synthetic learner slow skill acquisition, e.g. per-item effective
`b*` decreasing with successful exposures (`b*_eff = b* − γ·successes`,
γ ≈ 0.05–0.1, capped at ~1.5 logits) or global `a` growing with time-on-
task at the FSI-anchored rate curriculum-spine already cites. Then re-run
this study; predicted effect: churner band drains, P3 falls toward
reviews-per-item ≈ 5–7, P1 median unparks, P4 struggle share decays after
week 4. This keeps P1/P3/P4 meaning what they say.

**Fallback (option B — keep §7.1, re-derive the bounds):** the measured
floors under the static model with the best validated mechanism bundle are:
P1 median ≈ 1.65 (recommend ≤1.8), p95 ≈ 2.2 (recommend ≤2.4); P3 ≈ 14:1
(recommend [3, 18]); P4 struggle ≈ 45% (recommend ≤50%, or classify
struggle on a 2-of-3-batches persistence rule per round 1). These bounds
gate regressions but no longer assert pedagogy — option A is strictly
better.

**P7 metric note (either option):** gate on the steady-state mean share
deviation (≤ ±10 from week 3) or on ≥90% of active days in-band, not on
max-over-all-days — the current form is dominated by single-day sampling
noise at low served volume (mean signed dev measured ≤2 points even in the
worst FAIL row).

**P8:** see §5 — widen to |θ̂ − a| ≤ 0.8 (or raise the probe budget); the
±0.6 asks for precision below the information floor of ≤25 guessable
probes, which adaptivity §4 itself calls fake for author-assigned b.

**Stale spec literals to sync when rulings land** (spec editors, not this
branch): engine.md §4.4 line "lapses ≥ 6 ∧ reps/lapses < 2", §5.7, §8.2
leech row; engine.md §4.6 step 4 + adaptivity §5.5 throttle "1.5×" (now
`THROTTLE_DOWN_RATIO`); engine.md §1.2 `request_retention: 0.90` comment
("pace knob" — now `DESIRED_RETENTION`).

## 9. New finding: P11 fails on the round-2 baseline (out of mandate)

See §6 — relaxation rate 0.30–0.32/batch vs the <0.2 bound on every seed,
zero hard violations, broad-based across personas including ones that never
run placement (so NOT introduced by Task 1; round 1 measured P11 PASS
pre-W10). Hypothesis: type-restricted lesson-recipe/boss slots make
sameType adjacency structurally unsatisfiable and W10's lesson integration
raised recipe-driven batch share. Needs its own workstream: widen recipe
`activityTypes` in fixture + pack recipes, or a CTO ruling to exempt
recipe-restricted slots from the relaxation count (as model-block pairs
already are).

## 10. Round-2 after matrix (shipped config, 25×180×7, seeds 1/2/3)

The shipped config is behavior-identical to the §6 baseline for the full
sim (all bundle values reverted after validation; 334/334 unit tests green
against the Task-1 golden transcripts). Verified the strong way: the
`out/after-s{1,2,3}` reports are **byte-identical** to `out/before-s{1,2,3}`
(modulo the elapsed-time header line) — the refactor changed nothing. The
matrix therefore stands as in §6:

| seed | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P9 | P10 | P11 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FAIL | PASS | FAIL | FAIL | PASS | PASS | FAIL | PASS | PASS | FAIL |
| 2 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |
| 3 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | FAIL |

P8 (real pack, final tree — reproduces §5 exactly): seed 1 FAIL 26/35
in-band, seed 2 FAIL 30/34, seed 3 PASS 31/34; above-ceiling 1/1·2/2·2/2;
self-heal 4/4 on every seed.

Red gates P1/P3/P4 (all seeds), P7 (seed 1), P11 (all seeds) and P8's
in-band leg (seeds 1–2) are blocked pending the §8 rulings — further knob
pressure against them is threshold trading under the current §7.1 learner
model and gate definitions, and two of them (P7 serving pressure, P10 vs
P3) actively fight each other.

---

# W13 — engine-correctness closure (2026-07-04, encoding R17 §8 rulings)

Scope: land the R17 simulator-gate rulings. All W13 changes are confined to
`scripts/journey-sim/**` (P8 tolerance, sim fixture, sim learner) — **the
shipped engine (`src/journey/engine/**`) is byte-for-byte untouched, golden
transcripts unchanged, 343/343 unit tests green**. Gate deltas below are vs the
§10 "after" matrix (the branch tip before W13).

## 11. P8 — the R17 tolerance ruling, encoded (Task 1)

R17 amended P8's in-band accuracy target to **|θ̂−a| ≤ 0.8 @ ≥90%** (from 0.6;
rationale in §5/§8 — the ±0.6 leg sits below the ≤25-guessable-probe
information floor, σ≈0.40). Encoded as the named constant
`PLACEMENT_INBAND_TOLERANCE = 0.8` in `cli.ts`; the P8 gate's placed-leg and
band-edge-placed checks and the report string all measure against it (the
separate 0.6 ceiling-proximity grace is band-edge identifiability tied to the
engine's 0.5 above-content margin — a different quantity — and is left at 0.6).

**P8 verbatim, REAL journey_en pack (`build_journey_pack.py en`; 693 items,
b ∈ [−3.50, −1.50]), 40 learners/seed, final W13 tree:**

```
seed 1: PASS — in-band |θ̂−a|≤0.8 in ≤25 items: 33/35 (94%, need ≥90%);
  above-ceiling terminate "above-content" ≤ budget: 1/1; max items asked 24;
  wrong-placement self-heal (week-one rewind or demotion ≤14d, injected 10%
  cohort): 4/4 healed (days 2,2,2,2)
seed 2: PASS — in-band 31/34 (91%); above-ceiling 2/2; max asked 24;
  self-heal 4/4 healed (days 2,2,2,2)
seed 3: PASS — in-band 34/34 (100%); above-ceiling 2/2; max asked 24;
  self-heal 4/4 healed (days 2,3,2,2)
```

94/91/100% (W11 §5 measured 94/94/100% on its pack snapshot; the seed-2 −3pt is
a one-learner difference from the current pack build, still comfortably ≥90%).
All three legs green on every seed.

## 12. P11 — the relaxation-rate regression, diagnosed and fixed (Task 2)

**R17's stated hypothesis (type-restricted lesson-recipe/boss slots) is REFUTED
by direct instrumentation.** Attributing every relaxation increment by source
over the 7-persona × 180-day sim (seed 1):

| source | count | share |
|---|---:|---:|
| boss-batch same-type adjacency | 0 | 0% |
| item-gap relax (pass-3) | 0 | 0% |
| cross-batch **seam** (`slots[0]` == prev tail) | 17 502 | 54% |
| within-batch same-type adjacency | 15 144 | 46% |
| …of seam+within occurring in a recipe-drawn (lesson) batch | 167 | **0.5%** |

The boss recipe's per-slot `avoidType` already fully resolves its adjacency (0),
and recipe/lesson batches account for 0.5% of relaxations — the recipe
restriction is innocent. Splitting by activity type, **one fixture template drove
~65% of the rate**: `lingo_hero:round` — the SOLE form-1 fun activity
(`funWeight>0`) in `SIM_TEMPLATES`. The dominant slice (14 752, 45% of the total
rate) was **lone single-slot trailing FUN batches**: late in a 15-min session,
once due/new/repair drain or gap-block, `nextFeedItems` returns a single fun
card — always `lingo_hero:round` (no other form-1 fun type exists) — matching the
previous batch's cool-down tail (also `lingo_hero:round`). This is exactly the
"residual sameType adjacency unsatisfiable on tiny type sets" the mixer already
RELAXES-and-logs BY DESIGN (§5.4 step-5 comment): a (form,strand/fun) cell with
one type cannot be de-adjacent-ified.

A tried engine fix (a post-partition seam guard restoring the step-5 seam check
that step-6 `reorderWithinBlocks` drops for the first block's head / ≤2-slot
blocks) recovered only 502 genuinely-avoidable multi-slot seams (1.5%) — it does
not approach 0.2 and would regenerate goldens, so it was reverted (recorded here
as a real but minor engine gap for a future workstream; not worth golden churn
for 1.5% on a non-blocking metric).

**Fix (sim fixture, `fixture.ts`): give the form-1 fun cell a second type.** The
fixture header promises "activity templates covering all forms/strands/
modelNeeds", but the form-1 fun cell was degenerate (one type). A real
multi-provider Journey course has more than one fun mini-game; adding one
(`recall_race`, form-1, LANGUAGE strand — mirroring `flip_recall`, `funWeight`
1) lets the EXISTING anti-adjacency machinery alternate them. LANGUAGE (not
fluency) strand chosen so the extra fun serves land on the largest strand target
and do **not** perturb the fluency share (a fluency-strand variant regressed P7
to FAIL on all 3 seeds; the language variant leaves P7 at its baseline pattern).

**P11 before → after (25×180×7, relaxation rate per batch, <0.2 bound):**

| seed | before (§10) | after | hard violations (itemGap/debut/model/replay) |
|---|---|---|---|
| 1 | 0.319 FAIL | **0.113 PASS** | 0/0/0/0 |
| 2 | 0.302 FAIL | **0.115 PASS** | 0/0/0/0 |
| 3 | 0.308 FAIL | **0.114 PASS** | 0/0/0/0 |

**Verdict: FAIL → PASS on all three seeds, zero hard violations, no P5/P9/P10
regression (all remain PASS), no P7 regression (baseline pattern preserved).**
The rate is now dominated by the form-2 no-model production cell
(listen_type/type_translate/shadow_read due↔due), a 3-type cell that is
adequately de-clustered (residual ~0.11, well under bound).

## 13. P1/P3/P4 — option A: realistic learner acquisition (Task 3)

Per R17/§8 option A, the §7.1 synthetic learner's FIXED ability (recall ceiling
σ(a−b*) that practice never raised) is the defect. `learner.ts` now models slow
skill acquisition: an item's effective difficulty decays with **spaced**
successful retrievals, `b*_eff = b* − γ·successes`, γ = 0.08 (mid-range of §8's
0.05–0.1), capped at 1.5 logits. Acquisition is gated on ≥1-day spacing
(`ACQUISITION_MIN_SPACING_DAYS`) so same-day repeats grant none — this keeps the
model pedagogically honest (durable skill comes from spaced retrieval) AND keeps
placement honest: the ~25 same-day probes of a placement test grant no
acquisition, so P8's θ̂ still tracks base ability (a naive version, and a
prior-known-item `successes` seed, both mis-placed placed-intermediates at probe
time and were corrected). Shipped-engine behavior is NOT touched.

**Option-A matrix (25×180×7, seeds 1/2/3; language-strand `recall_race`; γ=0.08):**

| seed | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P9 | P10 | P11 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FAIL | PASS | FAIL | FAIL | PASS | PASS | FAIL | PASS | PASS | PASS |
| 2 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | PASS |
| 3 | FAIL | PASS | FAIL | FAIL | PASS | PASS | PASS | PASS | PASS | PASS |

(P8 runs separately vs the real pack: PASS 94/91/100 — §11.)

**What option A fixed and what it did not:**

- **P4 struggle share 52.8/56.6/56.2% → 39.2/41.4/41.1%** (bound ≤40%) — the
  churner-band drain the model predicted; now AT the boundary (seed 1 passes the
  struggle leg at 39.2%). P4 still FAILs each seed, but on a *different marginal
  leg per seed*: seed 1 on daily-fast (39 vs ≤0.75×48=36 — the ≤0.75× ratio is
  noise-tight when both medians are ~50 days), seeds 2/3 on struggle by ~1pt.
- **P3 34.6/36.0/39.2 → 25.3/26.7/27.3** (bound [3,6]) — improved but still far
  from 6. Root cause is NOT the learner now: P3 = reviews/debuts, and debuts
  stay floor-pinned at `NEW_PER_DAY_MIN`(4)/day, so the ratio is inflated by the
  intake throttle regardless of acquisition (§7 finding #1).
- **P1 median 2.10/2.09/2.10 → 2.08/2.08/2.07** (bound ≤1.2) — essentially
  unmoved. Same throttle-operating-point coupling: the backlog parks at ≈2×cap,
  the weekly throttle floors intake at 4, acquisition doesn't drain enough to
  unpin it. This is an ENGINE-config issue (extract the throttle target to
  constants, aim ≈1.0×cap, lower the NEW floor — §7 #1), out of W13's sim-only
  scope; option A cannot reach it.

**Re-derived-bounds recommendation (concrete numbers, worst-of-3-seed floors
under option A + shipped config — for the spec editors; option A is strictly
more honest than re-deriving, but P1/P3 residuals need the engine throttle fix,
not a bound change):**

- **P4 struggle share:** measured max 41.4% → **≤42%**, OR adopt the round-1
  2-of-3-batches struggle-persistence classification (removes single-window
  noise). daily-fast ≤0.75×dmMed leg → **≤0.8×** (the 0.75× ratio tips on
  ±3-day median sampling noise). With either, P4 passes under option A.
- **P3:** measured max 27.3 → a bound of **[3, 30]** gates regressions but no
  longer asserts pedagogy; the pedagogically-honest fix is the §7 #1 intake-
  throttle extraction (raises debuts off the 4/day floor so the ratio isn't
  intake-starved) — recommend that ENGINE follow-up over widening the bound.
- **P1:** measured median max 2.08, p95 max 2.31 → regression bounds **median
  ≤2.2, p95 ≤2.4**; but the real fix is again the throttle extraction (§7 #1),
  which is the SAME lever as P3. Recommend pairing P1+P3 into one engine
  follow-up (throttle target + NEW-floor to constants) rather than two bound
  moves.
- **P7:** unchanged from R17 — gate on ≥90%-of-active-days-in-band (mean signed
  per-strand dev measured ≤1.2 pts, i.e. the controller is unbiased; the
  max-over-days form is noise-limited). W13 introduces no P7 regression.

**Net W13 gate movement:** P8 FAIL→PASS (tolerance ruling), P11 FAIL→PASS
(fixture fun-cell fix), P4 struggle leg essentially reaches its bound (option A),
P1/P3 improved but throttle-bound (engine follow-up identified). P2/P5/P6/P9/P10
remain PASS; P7 unchanged. No shipped-engine change; goldens intact.
