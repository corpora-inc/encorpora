# Practice evidence and frontier experiments

For the curriculum budgets, selection probabilities, and proposed full learner
model, see [Pathway selection](pathway-selection.md).

AMP selects mixed practice from implemented problem families. Production uses the Bayesian grade-based estimator in `src/learning/frontier.ts` and scheduler in `src/server/mixed-practice.ts`. These organize practice; they are not validated grade placement, mastery or standardized-test score estimates. Curriculum links do not establish that a learner has demonstrated a skill.

## Production evidence and selection

Each skill has a durable summary: attempts, independent correct answers, the latest five outcomes, latest independent success and retrieval schedule. Summaries exclude response text, answers and explanations. Assistance contributes an attempt but no independent success. A skill is **review-ready** only after at least five attempts, with four of the latest five independently correct and the latest independently correct. Errors and assistance return it to **practicing**.

Retrieval intervals are six hours, one day, three days, seven days, fourteen days and thirty days. Independent success advances spacing only after six hours since the last credited retrieval. Errors and assistance reset it. Response speed does not affect this scheduling rule.

The frontier estimates a curriculum-grade coordinate: kindergarten is 0, grades 1–8 use their numbers, and Algebra 1, Geometry, Algebra 2 and Precalculus occupy 9–12. This ordering is a scheduling convenience, not proof that courses have equivalent difficulty. The prior starts from age or a selected grade band. A start set by a birth year is only as wide as learners of that age are spread on this scale (about 0.7 of a grade at K–2, 1.05 at grade 4, 1.65 at grade 7, 2.5 from grade 9; `AGE_PRIOR_SD`, fitted to retained answers, see [the norms prior](engine/norms-prior.md)). A start someone chose, such as an adult's start or a family band, keeps the wider 2.5, so the adult prior (default start grade 7) is unchanged. **A working grade is not mastery of that grade or a population percentile.** The readout shows hundredths so small changes are visible; hundredths do not establish that degree of measurement accuracy.

The versioned, validated `src/learning/frontier-policy.ts` separates two jobs:

- **Overall working level:** a steadier pooled estimate, using a provisional 60% unassisted typed-success anchor at the same grade, a 4% typed guess floor and an 8% slip ceiling allowance. Four-choice chance guessing raises the modeled same-grade observed success to 70%. The slope is 1.15 logits a grade, fitted to retained production answers ([early placement](#early-placement-grade-frontier-v5-2026-11-13)); the anchor, floor and slip remain editorial.
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

## Early placement (grade-frontier-v5, 2026-11-13)

Under v4, a ten-year-old who answers three on-grade problems right is shown about grade 6, overall and in every area. The cause was the prior, not the answers: a flat 2.5-grade prior on a learner whose age says grade 4, multiplied by three right answers, which only rule out the low end. The posterior mean then sits in the prior's upper tail, about 0.8 of a prior sd above the start. v5 (`DEFAULT_FRONTIER_POLICY`; v4 is kept as `PREVIOUS_FRONTIER_POLICY` for paired replays) changes two things, both fitted to retained production answers:

- **The age prior.** A birth-year start uses `AGE_PRIOR_SD` (0.7 at K–2, 1.05 at grade 4, 1.65 at grade 7, 2.5 from grade 9). These are the upper ends of the 95% profile-likelihood intervals of the population spread, fitted by marginal maximum likelihood to learners' first 30 answers ([norms prior](engine/norms-prior.md)). Chosen starts keep 2.5.
- **The overall slope.** 1.15 logits a grade instead of 1.7. Fitted the same way, it is stable across answer windows (10, 30 and 60 answers: 1.11, 1.14, 1.20) and on half the learners (1.09). Part of the flatness is real variation between a learner's areas, which the overall readout pools.

The local model scheduling reads (`strandResponse`, the area estimates) is unchanged apart from starting from the narrower age prior.

| Synthetic case: born 2016, read in the fall of 2026 |               v4 |               v5 |
| ------------------------------------------ | ---------------: | ---------------: |
| Before any answer, overall                 |      4.13 ± 1.99 |      4.00 ± 1.00 |
| After 1 right answer (decimals, grade 4)   |             5.55 |             4.36 |
| After 2 (fraction equivalence, 4 options)  |             5.85 |             4.53 |
| After 3 (fraction line plot, grade 3)      |      5.97 ± 1.43 |      4.63 ± 0.87 |
| Areas after 3: decimals, fractions, data   | 6.21, 6.11, 6.03 | 5.33, 5.11, 5.03 |

Shown widths are the reported sd (`frontier-report.ts`). `tests/frontier-early-anchor.test.ts` pins this case and fails under v4.

**Retained production answers, replayed.** Retained attempts were exported read-only (no names, emails or account identifiers) and replayed locally under each policy, up to 300 answers per learner; nothing about any learner enters this repository. Lower is better in both tables.

| Policy                                   | Next-answer log loss, all answers | First 20 answers | Held-out half of learners |
| ---------------------------------------- | --------------------------------: | ---------------: | ------------------------: |
| v4                                       |                            0.5687 |           0.6341 |                    0.5649 |
| v4 prior from national norms, slope 1.15 |                            0.5627 |           0.6152 |                    0.5596 |
| **v5**                                   |                        **0.5622** |       **0.6112** |                **0.5591** |
| v5 with v4's slope 1.7                   |                            0.5670 |           0.6139 |                    0.5632 |

How well the level shown early predicts the level after 150 answers (learners with at least 150), as mean signed / mean absolute difference in grades:

| Policy               |          After 3 |                5 |               10 |               20 |               50 |
| -------------------- | ---------------: | ---------------: | ---------------: | ---------------: | ---------------: |
| v4                   |     +0.33 / 0.90 |     +0.22 / 0.92 |     −0.01 / 0.69 |     −0.05 / 0.56 |     −0.15 / 0.42 |
| national-norms prior |     +0.21 / 0.63 |     +0.13 / 0.65 |     −0.02 / 0.59 |     −0.04 / 0.51 |     −0.12 / 0.40 |
| **v5**               | **+0.14 / 0.60** | **+0.10 / 0.58** | **−0.01 / 0.53** | **−0.03 / 0.47** | **−0.12 / 0.38** |

Learners shown more than a grade above their age start after three answers: 26% under v4, 1% under v5; more than a grade below: 20% and 4%. After 50 answers the two policies differ by more than half a grade for no learner, and by 0.03 on average.

Caveats: the age table and slope were fitted on the same retained answers that are replayed (the held-out column refits the slope on the other half only); the population is AMP's, which may include test accounts and is not a national sample; the 150-answer reference is itself an estimate.

**Synthetic learners.** `scripts/frontier/early-anchor-simulation.ts` runs the production planner against each policy's own frontier for 200 answers, for six ages (grades 1, 2, 4, 6 and 8 by birth year, and the adult default), six profiles (two and one grade behind, on level, one and two ahead, and uneven by area), two truth curves (slope 1.7 and 1.15, each item's true difficulty off its catalog grade by N(0, 0.5²), each learner with their own slip and guess) and six replicates.

Both truth curves pooled (72 learners a profile), mean |shown − true| in grades:

| Profile                     | Policy |  After 3 |        5 |       10 |       20 |   50 |  200 |
| --------------------------- | ------ | -------: | -------: | -------: | -------: | ---: | ---: |
| On level                    | v4     |     1.01 |     0.96 |     0.78 |     0.52 | 0.39 | 0.29 |
| On level                    | v5     | **0.48** | **0.56** | **0.52** |     0.53 | 0.39 | 0.26 |
| One behind                  | v4     |     1.33 |     1.09 |     0.72 |     0.53 | 0.40 | 0.30 |
| One behind                  | v5     | **1.02** | **0.92** |     0.69 |     0.59 | 0.37 | 0.29 |
| One ahead                   | v4     |     0.92 |     0.89 |     0.74 |     0.56 | 0.39 | 0.23 |
| One ahead                   | v5     | **0.80** | **0.63** | **0.57** | **0.40** | 0.33 | 0.29 |
| Two behind                  | v4     |     1.24 |     0.83 |     0.76 |     0.57 | 0.36 | 0.29 |
| Two behind                  | v5     |     1.31 |     1.10 |     0.95 |     0.68 | 0.40 | 0.29 |
| Two ahead                   | v4     |     0.44 |     0.66 |     0.77 |     0.57 | 0.38 | 0.32 |
| Two ahead                   | v5     |     1.27 |     1.15 |     0.99 |     0.62 | 0.37 | 0.30 |
| Uneven by area              | v4     |     1.27 |     1.19 |     1.06 |     0.71 | 0.58 | 0.60 |
| Uneven by area              | v5     | **0.58** | **0.66** | **0.74** |     0.57 | 0.44 | 0.53 |
| Weighted by a spread of 0.9 | v4     |     1.02 |     0.94 |     0.73 |     0.50 | 0.37 | 0.28 |
| Weighted by a spread of 0.9 | v5     | **0.67** | **0.65** | **0.55** |     0.48 | 0.35 | 0.28 |
| Weighted by a spread of 1.6 | v4     |     0.99 |     0.90 |     0.73 |     0.51 | 0.37 | 0.28 |
| Weighted by a spread of 1.6 | v5     | **0.84** | **0.77** | **0.65** |     0.52 | 0.35 | 0.28 |

The weighted rows weight the five offsets by a normal population of that spread (0.9 is AMP's fitted spread at grades 3–5; 1.6 is the national norm at grade 4), school ages only.

- **Steadier.** The mean step of the shown level over answers 1–20 falls from 0.34 to 0.22 grades, and the largest move from the start in the first five answers from 1.94 to 1.09.
- **The cost is the far tails, for about fifteen answers.** A learner truly two grades ahead is shown a grade or more short after 10 answers 51% of the time (v4: 32%), after 20 answers 18% (13%), after 50 answers 6% (8%). Two behind: 42% (22%) at 10, 25% (17%) at 20, 1% (1%) at 50. The median answers until the shown level stays within 0.75 of the truth fall for both (two ahead 55 → 35, two behind 50 → 29), because v5 moves less once it gets there.
- **Practice is unaffected.** Mean area error is 1.19 → 1.06 after 3 answers, 0.87 → 0.89 after 20, 0.78 → 0.77 after 50, 0.62 → 0.62 after 200. The climb (`placedAfterMisses`, the ceilings) reads demonstrated success, not the prior.
- **Adults are unchanged** (chosen start): 1.13 → 1.11, 0.96 → 0.95, 0.50 → 0.48 at 3, 10 and 50 answers.

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
# Early placement: v4 against v5 on synthetic learners (about 40 minutes)
npx tsx scripts/frontier/early-anchor-simulation.ts --policies v4,v5
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
