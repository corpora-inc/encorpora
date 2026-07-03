# W11 Engine Calibration Study — status: IN PROGRESS (evidence phase complete for the flat-retention axis)

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

## 3. Provisional recommendation (to validate before adoption)

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
