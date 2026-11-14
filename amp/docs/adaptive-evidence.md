# Practice evidence and frontier experiments

For the curriculum budgets, selection probabilities, and proposed full learner
model, see [Pathway selection](pathway-selection.md).

AMP selects mixed practice from implemented problem families. Production uses the Bayesian grade-based estimator in `src/learning/frontier.ts` and scheduler in `src/server/mixed-practice.ts`. These organize practice; they are not validated grade placement, mastery or standardized-test score estimates. Curriculum links do not establish that a learner has demonstrated a skill.

## Production evidence and selection

Each skill has a durable summary: attempts, independent correct answers, the latest five outcomes, latest independent success and retrieval schedule. Summaries exclude response text, answers and explanations. Assistance contributes an attempt but no independent success. A skill is **review-ready** only after at least five attempts, with four of the latest five independently correct and the latest independently correct. Errors and assistance return it to **practicing**.

Retrieval intervals are six hours, one day, three days, seven days, fourteen days and thirty days. Independent success advances spacing only after six hours since the last credited retrieval. Errors and assistance reset it. Response speed does not affect this scheduling rule.

The frontier estimates a curriculum-grade coordinate: kindergarten is 0, grades 1–8 use their numbers, and Algebra 1, Geometry, Algebra 2 and Precalculus occupy 9–12. This ordering is a scheduling convenience, not proof that courses have equivalent difficulty. The prior starts from age or a selected grade band; for a start set by age, the overall readout's prior is only as wide as that age is spread nationally ([early placement](#early-placement-grade-frontier-v5)). **A working grade is not mastery of that grade or a population percentile.** The readout shows hundredths so small changes are visible; hundredths do not establish that degree of measurement accuracy.

The versioned, validated `src/learning/frontier-policy.ts` separates two jobs:

- **Overall working level:** a steadier pooled estimate, using a provisional 60% unassisted typed-success anchor at the same grade, a 4% typed guess floor and an 8% slip ceiling allowance. Four-choice chance guessing raises the modeled same-grade observed success to 70%. These are editorial parameters, not student norms.
- **Local selection:** responsive subject estimates and a responsive pooled prior for unpracticed areas. This retains the local response model's roughly 68% typed-success anchor and 4% slip allowance. Each observed area uses its own answers. The broad pooled prior shares information across areas but does not demonstrate a skill there. The two estimates have different purposes and are not expected to be identical.

Recency remains active in both: before each answer, process variance lets older evidence fade. The overall variance per answer is 0.003 grade²; local estimates use 0.03. Both allow 0.02 grade² per elapsed day, with each gap capped at 30 days. Surprising independent successes can reopen an estimate that has become too certain. Local estimates also widen after surprising failures, allowing the scheduler to react promptly to gaps.

For the overall readout, a rare miss adds a bounded reporting-uncertainty reserve rather than increasing the next answer's influence. When expected success excluding choice guessing exceeds 70%, a miss adds 0.36 grade², capped at 1 grade². The reserve retains 70% of its value per independent answer; partial evidence has proportionally slower decay. The point estimate still responds to the miss through its likelihood. This reserve affects the displayed range, not local selection. Displayed ranges use ±1.64 uncertainty widths and curriculum bounds; they are **estimated envelopes, not validated 90% confidence or credible intervals**.

A correct answer after a hint or lesson contributes half an independent answer's log-likelihood weight. An assisted miss has zero likelihood weight. Both remain recorded attempts; neither earns independent mastery or illumination credit. The skill-evidence support path can revisit that skill to check it without help. Answer correctness and the retained history are unchanged.

**Paper results** from a workbook (`src/workbook/results.ts`) are attempts with `evidenceSource: "paper"`. The weights are founder decisions, named constants in that file.
- A typed answer checked by the app's exact grader is an independent attempt at full weight.
- A parent's right / not-yet mark without the answer has `evidenceWeight` 0.5. It contributes half the log-likelihood weight and half the drift.
- A "right" mark never counts as independent: it confirms no band, adds no independent credit, and leaves the retrieval schedule as it was.
- A "not yet" mark is a miss.

The skill summary (migration 0079 and `projectSkillEvidence`) and the frontier (`FrontierObservation.evidenceWeight`) apply this. Attempts without a weight are unchanged.

A choice item adds a guessing term: with k options a learner who cannot solve it still picks the key with chance c = 1/k, so P(correct) = c + (1 − c) × P(typed correct). The option count comes from the family's answer schema (`src/math/guess-chance.ts`, smallest count across sampled instances). A correct pick is weaker evidence than a correct typed answer; a wrong pick multiplies the typed likelihood by the constant 1 − c. Reporting surprise uses success excluding choice guessing so that this constant does not make a choice miss count more heavily.

`createFrontierPolicy` validates and freezes injected parameters. Save the full policy JSON with experiment results; its version is a human-readable identifier. `LEGACY_FRONTIER_POLICY` reproduces the former pooled likelihood and recency for paired replays. `tests/frontier-working-level.test.ts` checks isolated slips, genuine sustained difficulty, recent versus thousand-answer-old evidence, help, boundary initialization, and guessing. Existing mixed-frontier tests check that fraction repair and advanced algebra coexist. These are algorithm regression checks, not evidence of measured learning gains or national grade norms. The [public-data calibration pilot](https://github.com/corpora-inc/encorpora/issues/1544) tracks empirical grade and family anchors. Production replays retained attempts under the active policy; no evidence migration is needed, and historical trend points are recomputed consistently with that policy.

Production aims near `level − 0.5 + 0.3 × uncertainty`. Due reviews, errors and unmet implemented prerequisites can reserve support work. Repeated difficulty follows prerequisite links across unimplemented nodes to the nearest teachable ancestor; success never grants unobserved ancestor credit. Recent skills and repeated strands receive penalties. Batches have at most five problems. Offline pools retain a grade ceiling. Unused batches on another device are not cross-device reservations.

**Placement.** A new learner's first four answers follow scripted openers in `src/learning/placement.ts`. These are short, familiar items from this year's or last year's core material for the grade expected at that age; high-school ages start on grade-8 items. Choice items with at least three options may open where they bring a strand typed items cannot: comparing lengths, weights and capacity (K), clocks and lengths (grade 1), and coins and clocks (grade 2). A client without choice support skips such a slot to adaptive selection. Each slot has a small pool of items in one strand, and neighbouring slots differ. The learner id picks from each pool, so siblings start differently while one learner's sequence stays fixed. Adaptive selection then takes over from the frontier, climbing fast from a wrong start ([the climb](pathway-selection.md#practice-recovery-and-confirmation)). The first 20 answers offer only **assessment** families. **Scaffold** families, which are method steps such as a partial product or a make-ten step, return to practice afterwards. Opener outcomes are ordinary evidence.

Production selection reasons describe a prerequisite, revisit after an error or assistance, scheduled review, work in a skill with recorded evidence (`frontier`), or an unobserved skill (`explore`).

## Early placement (grade-frontier-v5)

Under v4, a ten-year-old who answers three on-grade problems right is shown about grade 6, overall and in every area. The prior causes this, not the answers. Every learner starts with a flat 2.5-grade prior. Three right answers only rule out the low end, so the posterior mean lands in the prior's upper tail, about 0.8 of a prior sd above the start.

v5 (`DEFAULT_FRONTIER_POLICY`) changes what is shown and how wide it is drawn. It does not change what is practised. v4 is kept as `PREVIOUS_FRONTIER_POLICY` for paired replays.

- **Overall readout: national-norms prior.** For a start set by a birth year, the overall readout's prior is as wide as that age is spread nationally. This is `NORMS_PRIOR_SD`, the "AMP prior sd" column of the [norms prior](engine/norms-prior.md): 0.7 at K, 1.6 at grade 4, capped at 2.5 from grade 6.
  - It is a provisional, external prior, not fitted to AMP learners.
- **Display rule** (`frontier-policy.ts` `display`; `frontier-report.ts`). For an age-anchored learner, the shown overall level is held to the half-grade band around their age, then released by a tenth of the way to the estimate per answer. From ten answers on, it is the estimate.
  - Each area is shown at the overall shown level, plus its own answers ÷ 10 of its difference from the overall estimate. An area with few answers of its own sits near the learner's level.
  - Stored level days and the trend show the same.
  - Display only: nothing that selects problems reads it.
- **Shown widths (sd-cal-v2).** The reported width is 0.2 + a factor × the posterior sd, read by each estimate's own answer count (an area's own answers, as production stores them).
  - Overall: 1.01 up to 10 answers, 0.80 from 20.
  - Areas: 0.85 up to 10 answers, 0.95 from 20.
  - When the shown overall level sits off the estimate, its width adds that distance ÷ 1.64, so the shown range always holds the estimate's own range.
  - An area's width is the same blend of the overall shown width and its own as its level.
- **Selection is unchanged.** Selection's pooled estimate keeps 2.5 for every start. The area estimates, the climb and both response curves are v4's.
  - `tests/frontier-early-anchor.test.ts` checks that selection reads identical values and plans identical problems.
  - The simulation below counts no problem that would differ in 158,400.
- **Chosen starts.** An adult's start, a family band or a restarted area is estimated and shown at v4's levels. Only its widths follow sd-cal-v2.

| Constructed case: born 2016, read in the fall of 2026, three right answers | v4 | v5 |
|---|---:|---:|
| Before any answer, overall | 4.13, range 0.8–7.4 | 4.00, range 1.0–7.0 |
| After 1 (decimals, grade 4, typed) | 5.55 | 4.54 |
| After 2 (angles, grade 4, four options) | 5.85 | 4.62 |
| After 3 (bar graph, grade 3, typed) | 5.97, range 3.6–8.3 | 4.71, range 2.0–7.4 |
| Areas after 3: decimals, geometry, data | 6.21, 6.11, 6.03 | 4.81, 4.80, 4.79 (each ± 1.62) |

Behind v5's shown 4.71, the readout's own estimate is 5.19: the narrower prior moves it 1.2 grades from 4, not 2. `tests/frontier-early-anchor.test.ts` pins the case. It fails under v4.

**Simulation.** `scripts/frontier/early-anchor-simulation.ts` runs the production planner and display path for 200 answers on both policies, along one answer sequence.

- Truth comes from external norms, not from AMP data or the demo school. Children aged grade 1, 2, 4, 6 and 8 are drawn from N(age, the national spread), with areas N(0, 0.5²) apart.
- Fixed offsets cover −4 … +4 grades, plus learners on level with areas alternately one grade above and below.
- Adults on the grade-7 default have the same offsets.
- Answers come from a misspecified curve on the estimator's scale (item difficulty off its catalog grade by N(0, 0.5²), own slip and guess) at slopes 1.7 and 1.15.
- The display rule was chosen on seed 1 from nine candidates, and the widths were fit on seed 1 and on the calibration grid at seed 20261110. The tables below are seed 2, untouched by either. Seed 1 agrees.

Overall shown level, mean |shown − true| in grades, v4 → v5:

| Learners (seed 2) | n | 3 answers | 5 | 10 | 20 | 50 | 200 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Children drawn from national norms | 30 | 1.32 → 1.40 | 1.17 → 1.23 | 0.85 → 0.79 | 0.63 → 0.57 | 0.43 → 0.42 | 0.31 → 0.31 |
| On level | 30 | 1.16 → **0.52** | 1.02 → **0.56** | 0.69 → **0.54** | 0.56 → 0.51 | 0.38 → 0.37 | 0.25 → 0.25 |
| One grade off | 60 | 1.02 → **0.63** | 0.89 → **0.55** | 0.63 → 0.56 | 0.54 → 0.48 | 0.33 → 0.32 | 0.25 → 0.25 |
| Two grades off | 60 | 0.75 → 1.42 | 0.90 → 1.22 | 0.75 → 0.85 | 0.62 → 0.65 | 0.39 → 0.39 | 0.32 → 0.32 |
| Three or four off | 120 | 1.76 → 2.67 | 1.24 → 2.27 | 1.00 → 1.16 | 0.59 → 0.70 | 0.52 → 0.51 | 0.29 → 0.29 |
| Uneven areas | 30 | 1.30 → **0.49** | 1.00 → **0.59** | 1.07 → **0.89** | 0.77 → 0.67 | 0.58 → 0.54 | 0.63 → 0.63 |
| Adults, −4 … +4 | 66 | 1.17 → 1.17 | 1.05 → 1.05 | 0.77 → 0.77 | 0.59 → 0.59 | 0.44 → 0.44 | 0.28 → 0.28 |

**Learners within half a grade of their age.** Shown a grade or more above their age after 3 answers: 51% under v4, 2% under v5. Named two grades up (shown ≥ 1.5 above): 49% → 0%. After 10 answers, 32% → 22%.

**The cost is the far tails, for the first ten to twenty answers.**

- Two grades from their age, the shown level is a grade or more off:
  - after 3 answers, 25% → 93%;
  - after 10, 22% → 35%;
  - after 20, 18% → 17%.
- Three or four off:
  - after 10, 39% → 48%;
  - after 20, 17% → 23%.
- From 50 answers on, the two differ by no more than sampling noise.
- Practice reaches these learners exactly as before.

**Areas.** Mean |shown − true| for children drawn from national norms: 1.04 → 0.87 at 10 answers, 0.95 → 0.70 at 20, 0.82 → 0.65 at 50. On-level learners: 1.47 → 0.57 at 3 answers.

**Shown range coverage.** How often the shown ±1.64-width range covers the truth (target 90%), sd-cal-v1 → sd-cal-v2:

| Learners (seed 2) | Estimate | 3 answers | 5 | 10 | 20 | 50 | 200 |
|---|---|---:|---:|---:|---:|---:|---:|
| Children drawn from national norms | overall | 80% → 97% | 80% → 97% | 80% → 97% | 83% → 83% | 100% → 100% | 100% → 100% |
| Children drawn from national norms | areas | 73% → 90% | 80% → 93% | 84% → 89% | 89% → 86% | 88% → 93% | 91% → 94% |
| Children, every profile | overall | 86% → 78% | 87% → 82% | 84% → 89% | 88% → 87% | 94% → 92% | 99% → 98% |
| Adults | overall | 92% → 94% | 91% → 97% | 94% → 94% | 91% → 94% | 92% → 92% | 98% → 98% |
| Adults | areas | 89% → 91% | 88% → 89% | 92% → 93% | 94% → 96% | 92% → 93% | 93% → 96% |

- On the validation set (seed 2 plus the calibration grid at seed 20261115), the estimate's own ±1.64 range covers 88–95% in every own-answer band, overall and areas.
- Early ranges are wider than before: an adult's overall sd after 3 answers goes from 1.37 to 1.76, after 20 from 0.78 to 0.82, and after 200 from 0.65 to 0.59.
- Children far from their age are under-covered in the first five answers (78–82% across every profile). The age prior puts little weight there.
- `tests/frontier-production-calibration.test.ts` now checks the shown ±1.64 range on the fitted seed. That is a reproducibility check; the seeds above are the evidence.

**Real learners.** Retained answers were exported read-only, excluding:

- demo-school learners;
- practice profiles;
- internal accounts.

This leaves a few dozen learners and a few hundred answers, most learners with fewer than ten. That is too few to measure accuracy, so the replay is descriptive only.

- After three answers, v4 showed a fifth of the birth-year learners more than a grade above their age start; v5 showed none.
- Learners with a chosen start are shown identically.

No parameter here is fitted to AMP data. The demo school's learners are generated at 0.6 × the national spread (`src/schools/demo/truth.ts`), so they can validate nothing about it.

## Isolated experimental model

`src/learning/experimental-frontier.ts`, `src/learning/item-calibration.ts` and `src/server/experimental-mixed-practice.ts` are research modules. API, web and offline production import graphs exclude them; a regression test checks that boundary. There is no environment switch or production routing to the experimental policy. It requires an explicit code import.

The item model is

```text
P(success | ability) = guess + (1 − guess − slip) /
  (1 + exp(−discrimination × (ability − difficulty)))
```

Difficulty is ability at the midpoint between guess floor and slip ceiling; discrimination controls slope. Editorial defaults use the skill's grade minus 0.5 and a bounded adjustment for direct prerequisite count. Broad template bands supply a fallback. A version-keyed table distinguishes simple retrieval and multistep families. Choice templates receive a provisional 0.25 guess floor, free response 0.04. These parameters are not learner-calibrated.

The experimental estimator accepts an explicit version-aware `itemOf` callback. Its likelihood cache distinguishes generator versions. If that callback has no calibration for a recorded version, the observation is omitted from this estimate; the original attempt remains intact. Missing versions denote the original version-one outcome protocol. This convention is valid only for that protocol: callers handling revised generators must supply recorded versions, including when a version-aware callback is present. Any production integration must recover recorded versions from retained problem instances and retain historical calibration entries, not infer a past version from the active generator.

The experimental scheduler targets a configurable 70–85% conditional success band at the posterior mean. This does not integrate uncertainty and is not a measured learner success rate. Invalid bands are rejected. Expected local information, approximated at five posterior points, favors uncertain strands. In-band items are preferred when immediate-repeat and batch-diversity constraints permit them.

Repair and retrieval share a support reservation through three-answer phases. Full three-answer batches split reservations evenly; batches of two or four sample these phases unevenly. Reviews favor nearby work, another strand, and oldest due time. A bounded information probe can occupy one slot in qualifying online batches on a six-answer cadence. It checks a strand not practiced for a day, with success of at least 0.35 after removing guessing and slipping, and positive expected information. Experimental selections identify these checks with `reason: "probe"`. Offline experiments disable probes. Repeated requests at the same answered count can propose the same probe; cadence is based on recorded answers, not durable issuance records. The one-per-six-answers bound applies to fully answered three-item batches. Partially answered or abandoned batches can qualify more often, and single-item support reservations can suppress probes.

Support, probing and catalog gaps can put a selection outside the band. The objective is a scheduling heuristic, not measured expected learning gain. Fixed inputs, seed and time give deterministic choices. The seed breaks near-exact score ties; it does not randomize across materially different scores.

## Reproduce the experiments

Run from `amp/`:

```sh
# Live-catalog diagnostics
npx tsx scripts/simulate-frontier.ts development
npx tsx scripts/simulate-frontier.ts evaluation
npx tsx scripts/compare-frontier.ts 86dfa922c audit
npx tsx scripts/compare-frontier.ts 86dfa922c stress
npx tsx scripts/fit-frontier-calibration.ts
# Reproduce the fixed-dataset result table
npx tsx scripts/compare-frontier.ts 86dfa922c development frozen-v1
npx tsx scripts/compare-frontier.ts 86dfa922c evaluation frozen-v1
npx tsx scripts/compare-frontier.ts 86dfa922c audit frozen-v1
npx tsx scripts/compare-frontier.ts 86dfa922c stress frozen-v1
# Early placement: both policies, seeds 1 and 2 (about 15 minutes each)
npx tsx scripts/frontier/early-anchor-simulation.ts --seed 1 --reps 3
npx tsx scripts/frontier/early-anchor-simulation.ts --seed 2 --reps 3
# Shown-range coverage on the calibration grid at another seed
npx tsx scripts/frontier/production-calibration.ts --quick --model misspecified --seed 20261115
# Regression checks
npx tsx --test tests/frontier-calibration.test.ts tests/frontier-isolation.test.ts tests/frontier-early-anchor.test.ts
```

Comparison uses the current catalog unless `frozen-v1` selects the regression fixture. It requires a Git checkout containing baseline commit `86dfa922c`. Only pass trusted baseline commits: the comparison command executes source code from the selected commit. It loads that planner, estimator and evidence projection into a temporary directory. Both policies receive the same selected template metadata and skill catalog objects, populations and seeds. Report metadata records the baseline commit, catalog counts and SHA-256 of `JSON.stringify({ templates, skills })` in source order (`template-and-skill-json-v1`). This identifies planning metadata; simulations do not execute problem generators or lesson content. The experimental run executes the actual experimental planner, estimator and evidence projection; it supplies twelve recent attempts and durable skill summaries as the API does. Six answers form a simulated day, with three-answer batches and 180 answers per run.

Synthetic learners use a separate probit response curve, template-specific perturbations, slips, guesses, uneven strand ability, learning, forgetting and outside-learning jumps. Their response model does not import the estimator's logistic curve or item parameters. The ordinary scenarios still share a grade ruler with the model. Stress cases deliberately shift item difficulty by ±1 or compress the high-school ruler to expose that assumption. Assistance behavior is not simulated.

Development seeds are 11 and 29. Evaluation seeds 101 and 307 use different ability, noise, learning and forgetting parameters; these scenarios informed development. Audit seeds 607 and 991 were inspected after an initial freeze and rerun following independent-review corrections. They are not an untouched final validation set. Stress seeds are 4001 and 5003. No synthetic result establishes learning efficacy.

Reports include:

- Mean absolute strand error every thirty attempts, including untouched strands.
- First convergence within ±0.5 grade for three consecutive batch checkpoints, after three strand answers. Counts are total learner answers; `null` means unreached.
- Paired detection delay against a no-jump control with the same seed and policy. Require three post-jump strand answers and two checkpoints differing by at least half the imposed jump in its direction. Before the intervention, histories match; afterwards their practice can diverge. Item-dependent noise can then contribute to the contrast, so detection specificity is unknown. `oppositeDirectionCrossings` counts sustained crossings of the same threshold in the wrong direction as a diagnostic, not a false-positive rate: every strand in these runs receives the intervention. `null` means undetected. `rawDirectionalMovement` separately measures movement from the pre-jump estimate and can be confounded by ordinary initial convergence.
- Band share under both the planner prediction and independent synthetic probability, and their mean absolute difference.
- Feasible-band opportunities under grade, recent-skill and batch-diversity constraints. Misses distinguish deliberate support and probes from unexplained misses; feasibility is conditional on estimated ability. This accounting checks the selector contract using matching eligibility rules; it is not an independent efficacy metric.
- Batches with due successful retrievals, batches serving one, reviews served and mean delay. The denominator includes overdue work beyond the lowered frontier; the ratio does not mean every due skill was reviewed.
- Largest strand share, longest consecutive strand run, visits and final per-strand estimates alongside synthetic abilities.

## Results and production blocker

The metric regression tests use the frozen 142-template, 312-skill dataset in `tests/fixtures/frontier-catalog-v1.json`, extracted from source commit `a163bce4b44001bd5c662b743c079a5c8872d139`. Its full source-catalog fingerprint is `805d2be8c8c27f24c7a587ec8d813a91c5466997bcfaf261dd953f57af22fbc8`. The fixture retains complete template metadata and the skill fields the planner consumes (ID, prerequisites, strand and grade); its fingerprint is `aa57b327d416c7353acafa1579a6d3db0d25f75e489ef9aafce63deef604aa4c`. Tests verify that identity and both the injected and default-live catalog paths. The frozen CLI also checks the pinned identity before running. The frozen dataset carries the editorial calibration overrides reviewed against its own generators (`scripts/frontier/frozen-catalog.ts`); the live table describes live generators, and a test pins each live entry's generator output so a rewrite that keeps version 1 cannot keep a stale entry. `gradeCalibration`, `gradeNumber`, coarse-band mapping, estimator and scheduler logic are versioned policy under test, not fixture data or part of the catalog fingerprint. Policy edits are expected to change measurements and must satisfy the fixed-data regression checks. The narrowed skill type catches new required fields; optional inputs and future template fields still require review of their absent-value behavior on frozen data. A fingerprint does not validate a policy's use of those inputs. Updating a fixture is an explicit experiment change that requires fresh baseline comparisons; adding production content does not change pinned thresholds.

The declared development objective is lower mean absolute strand error while preserving baseline paired detection, review service and diversity. Fixed development regression checks enforce those criteria. They do not establish general improvement. Component ablations on development runs produced mean errors of 0.6375 for baseline, 0.5572 for the complete experiment, 0.5873 with only its estimator, 0.7313 with only its planner, 0.6732 without probes and 0.6956 with review-only support reservation.

Each entry below is baseline `86dfa922c` → experimental policy on that frozen dataset, averaged over six runs. The current-catalog CLI is a separate diagnostic and its outputs must not be compared against these fixed-data thresholds:

| Scenarios | Final error, grades | Independent band share | Review adherence | Largest strand share | Paired detections |
| --- | ---: | ---: | ---: | ---: | ---: |
| Development | 0.637 → 0.557 | 26.9% → 26.6% | 83.6% → 85.3% | 29.2% → 22.7% | 29 → 34 |
| Evaluation | 0.714 → 0.775 | 15.9% → 18.9% | 84.7% → 85.3% | 27.7% → 24.7% | 29 → 29 |
| Audit | 0.708 → 0.723 | 17.3% → 21.0% | 82.7% → 86.2% | 27.6% → 25.1% | 25 → 30 |
| Stress | 0.971 → 0.972 | 22.1% → 21.3% | 85.5% → 87.1% | 23.5% → 27.1% | 17 → 17 |

Sustained opposite-direction crossing counts are 0 → 0 on development, 0 → 3 on evaluation, 1 → 0 on audit and 1 → 2 on stress. These failures reinforce that a higher detection count alone is insufficient for promotion.

Development, evaluation and audit each have 48 changed-strand cases; stress has 24. Censored cases stay in those denominators. Audit median delay among detected strands is 36 → 48 answers. Ordinary directional movement counts 27 → 26; it must not replace paired detection of 25 → 30.

Audit results expose important losses:

| Population / seed | Final error, grades | Independent band share | Review adherence |
| --- | ---: | ---: | ---: |
| early-uneven / 607 | 0.644 → 0.891 | 30.0% → 30.0% | 86.0% → 82.8% |
| early-uneven / 991 | 0.571 → 0.563 | 17.2% → 28.3% | 81.0% → 77.6% |
| advanced-jump / 607 | 0.358 → 0.571 | 2.2% → 4.4% | 83.3% → 91.4% |
| advanced-jump / 991 | 0.514 → 0.865 | 3.9% → 7.8% | 89.1% → 91.4% |
| uneven-loss / 607 | 1.021 → 0.693 | 27.2% → 30.0% | 82.8% → 84.5% |
| uneven-loss / 991 | 1.141 → 0.756 | 23.3% → 25.6% | 74.1% → 89.7% |

Compressed-secondary stress errors increase from 0.650 to 0.840 and 0.829 to 1.051. Estimator-only experiments improve overall averages but worsen both early evaluation runs (0.609 → 0.777 and 0.402 → 0.506). A conservative alternative using legacy scheduling and half-strength editorial difficulty/discrimination adjustments also fails the development objective (0.637 → 0.705) and worsens early strata. Point estimates, pooled priors and sparse item coverage do not reliably identify independent strand ability or a misspecified difficulty scale.

A catalog evaluation at source commit `ac9b3ebd76baaf26c60750b659d3dd906466a7c8` with 144 templates and 312 skills (`7e53011b87c55fe4d10ef620b0fe53654c3f4fcf8afd95d18736d105c69b3be2`) gives mean error 0.779 → 0.707, paired detections 30 → 28 and wrong-direction crossings 0 → 2. Both policies receive the same current metadata. This illustrates catalog sensitivity; it does not replace the fixed-dataset results or satisfy production acceptance.

**Production promotion is blocked by these regressions.** The experiment cannot justify replacing the production estimator or scheduler. Promotion requires a predeclared precision objective and per-stratum nonregression criteria, successful independent evaluation of young, advanced, uneven and misspecified-scale populations, fair repair/review service, and version-safe historical replay. A claim of learner-calibrated success probabilities additionally requires suitably consented response data with sufficient per-template evidence, an anchored ability scale and held-out learners. Synthetic averages cannot satisfy that requirement.

The fitting command estimates difficulty and discrimination on 400 synthetic responses per template and scores 400 separate responses with a different ability distribution. It prints proposed parameters and validation losses; fits are never loaded by production or the experimental scheduler. The fitting command uses the current catalog. In the 142-template diagnostic from source commit `a163bce4b44001bd5c662b743c079a5c8872d139`, mean held-out log loss decreases from 0.4399 to 0.4314 and mean probability error against the synthetic curve from 0.0506 to 0.0250. Some individual fits worsen. This checks the fitting implementation on a specified synthetic family, not parameter transfer to learners.

## Storage and cost

Migration `0008-skill-evidence.sql` builds summaries from retained attempts; missing history is not reconstructed. Historical order uses creation time and attempt ID. Future attempts receive an ingestion sequence under the learner lock. An insertion trigger updates summaries in the attempt transaction. Duplicate or rolled-back attempts add no evidence.

Scheduling reads durable skill rows and an indexed twelve-attempt recency window. Production frontier replay separately scans retained history. The experimental estimator caches per-version grid likelihoods within one call; it also replays history. Neither design establishes bounded long-term latency. Candidate selection adds constant-sized probability/information calculations per template. Capacity testing is separate work.

Parent exports identify summaries as `derived-skill-evidence`. Learning-data deletion purges summaries and attempts, including when billing requires retaining an opaque learner record. Consent withdrawal blocks new learning writes under the account lock without itself deleting history. Apply the evidence migration with learning writers stopped, after backup and a representative isolated-database test. Backfill is a transactional, bounded-memory replay whose duration grows with history.
