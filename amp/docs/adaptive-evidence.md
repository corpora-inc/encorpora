# Practice evidence and frontier experiments

AMP selects mixed practice from implemented problem families. Production uses the Bayesian grade-based estimator in `src/learning/frontier.ts` and scheduler in `src/server/mixed-practice.ts`. These organize practice; they are not validated grade placement, mastery or standardized-test score estimates. Curriculum links do not establish that a learner has demonstrated a skill.

## Production evidence and selection

Each skill has a durable summary: attempts, independent correct answers, the latest five outcomes, latest independent success and retrieval schedule. Summaries exclude response text, answers and explanations. Assistance contributes an attempt but no independent success. A skill is **review-ready** only after at least five attempts, with four of the latest five independently correct and the latest independently correct. Errors and assistance return it to **practicing**.

Retrieval intervals are six hours, one day, three days, seven days, fourteen days and thirty days. Independent success advances spacing only after six hours since the last credited retrieval. Errors and assistance reset it. Response speed does not affect this scheduling rule.

The frontier estimates a curriculum-grade coordinate: kindergarten is 0, grades 1–8 use their numbers, and Algebra 1, Geometry, Algebra 2 and Precalculus occupy 9–12. This ordering is a scheduling convenience, not proof that courses have equivalent difficulty. The prior starts from age or a selected grade band. A pooled estimate seeds untouched strands and centers broad priors for observed strands. Each observed strand also uses its own outcomes. Evidence can therefore influence another strand through the pooled prior; it is not independent evidence of proficiency there. Drift per answer and elapsed day, plus widening after surprising outcomes, lets estimates follow changes without erasing attempts.

Production aims near `level − 0.5 + 0.3 × uncertainty`. Due reviews, errors and unmet implemented prerequisites can reserve support work. Repeated difficulty follows prerequisite links across unimplemented nodes to the nearest teachable ancestor; success never grants unobserved ancestor credit. Recent skills and repeated strands receive penalties. Batches have at most five problems. Offline pools retain a grade ceiling. Unused batches on another device are not cross-device reservations.

Production selection reasons describe a prerequisite, revisit after an error or assistance, scheduled review, work in a skill with recorded evidence (`frontier`), or an unobserved skill (`explore`).

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
# Regression checks
npx tsx --test tests/frontier-calibration.test.ts tests/frontier-isolation.test.ts
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

The metric regression tests use the frozen 142-template, 312-skill dataset in `tests/fixtures/frontier-catalog-v1.json`, extracted from source commit `a163bce4b44001bd5c662b743c079a5c8872d139`. Its full source-catalog fingerprint is `805d2be8c8c27f24c7a587ec8d813a91c5466997bcfaf261dd953f57af22fbc8`. The fixture retains complete template metadata and the skill fields the planner consumes (ID, prerequisites, strand and grade); its fingerprint is `aa57b327d416c7353acafa1579a6d3db0d25f75e489ef9aafce63deef604aa4c`. Tests verify that identity and both the injected and default-live catalog paths. The frozen CLI also checks the pinned identity before running. Editorial calibration overrides, `gradeCalibration`, `gradeNumber`, coarse-band mapping, estimator and scheduler logic are versioned policy under test, not fixture data or part of the catalog fingerprint. Policy edits are expected to change measurements and must satisfy the fixed-data regression checks. The narrowed skill type catches new required fields; optional inputs and future template fields still require review of their absent-value behavior on frozen data. A fingerprint does not validate a policy's use of those inputs. Updating a fixture is an explicit experiment change that requires fresh baseline comparisons; adding production content does not change pinned thresholds.

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
