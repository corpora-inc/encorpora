# Practice evidence and strand selection

AMP selects mixed practice from implemented problem families. Its scheduling rules are not a validated mastery estimate, a grade placement test, or a standardized-test score prediction. Curriculum links alone do not establish that a learner has demonstrated a skill.

Each skill has a durable evidence summary derived from retained attempts: total attempts, independent correct answers, the latest five outcomes, the latest independent success, and a retrieval schedule. Summaries exclude response text, answers and explanations. An assisted answer contributes an attempt but no independent success. A skill is **review-ready** only after at least five attempts, with at least four of the latest five independently correct and the latest attempt independently correct. Errors and assistance return it to **practicing**.

Retrieval intervals are six hours, one day, three days, seven days, fourteen days and thirty days. A correct independent retrieval advances spacing only if six hours have elapsed since the last credited retrieval. A burst cannot manufacture spaced retrievals. Errors and assistance reset spacing. Response speed does not affect these scheduling rules.

## Strand estimates and item difficulty

The frontier is a Bayesian grid estimate for each strand. Its coordinate is a curriculum-grade index: kindergarten is 0, grades 1–8 use their numbers, and Algebra 1, Geometry, Algebra 2 and Precalculus occupy 9–12. This ordering is a scheduling convenience, not proof that courses have equivalent difficulty or that a learner has attained a school grade.

The prior starts from the selected band or age-based starting point. The pooled estimate seeds untouched strands and centers broad priors for observed strands; each observed strand also incorporates its own outcomes. Evidence in one strand can therefore influence another through the pooled prior. This is not independent evidence of proficiency in the other strand. Assisted answers count as unsuccessful independent retrievals. Drift per answer and elapsed day, plus extra widening after surprising outcomes, lets the posterior follow improvement and regression without erasing attempts.

`src/learning/item-calibration.ts` supplies shared parameters to the planner and production estimator:

```text
P(success | ability) = guess + (1 − guess − slip) /
  (1 + exp(−discrimination × (ability − difficulty)))
```

Difficulty is ability at the midpoint between the guess floor and slip ceiling; discrimination controls the slope. Defaults use the skill's grade minus 0.5, plus a small bounded adjustment for direct prerequisite count, an editorial proxy for depth. Broad template bands supply a fallback when skill metadata is absent. A version-keyed table distinguishes simple retrieval and multistep families. Four-option templates receive a 0.25 guess floor; free response receives 0.04. These are editorial assumptions, not parameters validated with learners. New template IDs receive defaults automatically. Production replay joins each retained problem instance to recover its generator version. Likelihood caches distinguish versions. An observation whose version has no registered calibration is omitted from the frontier estimate, while its attempt and skill evidence remain intact. Missing versions in the original outcome protocol mean version 1. Register historical parameters before retiring a generator version if its evidence must contribute to frontier replay.

## Selection policy

The default target is 70–85% conditional success **at the posterior mean**. This prediction does not integrate ability uncertainty and is not a measured learner success rate. Internal callers can set `targetBand`; invalid or nonfinite bands are rejected. It is not a learner-controlled request field.

Scores penalize distance outside the band and distinguish candidates within it by proximity to its midpoint. Expected local information, approximated at five points around the estimate, adds a bounded preference for uncertain strands. This is a learning-opportunity heuristic, not measured expected learning gain. Grade-distance safeguards discourage inaccessible advanced work. Offline pools retain their strict ceiling.

Durable evidence supplies due reviews and support needs. After repeated difficulty, the planner crosses unimplemented nodes to find the nearest implemented prerequisites needing practice. No selection or advanced answer grants ancestor credit. One eligible support or retrieval slot is reserved within each batch. Due successful reviews take precedence, favoring work within 1.5 grades below the target, a different recent strand, and then the oldest due time. Other slots prefer in-band work when it satisfies the immediate-repeat and batch-diversity constraints. Scores choose among those candidates; sparse catalogs fall back to the highest score. A separate bounded information probe checks a reachable strand not practiced for at least a day, on a six-answer cadence. It requires an independent-success prediction of at least 0.35 and positive expected information. High mean-success items can qualify because uncertainty may conceal regression. At most one probe is selected in a qualifying batch; a support reservation can take precedence. Offline batches disable probes because they lack immediate feedback. Recent skills and repeated strands receive penalties, and seeded hashes break ties deterministically.

Batches contain at most five problems. Unused problems on another device are not cross-device reservations. Selection reasons describe the task's purpose:

- **prerequisite**: an implemented prerequisite of a skill with repeated difficulty;
- **revisit**: a reachable skill whose last answer was wrong or assisted;
- **review**: a reachable skill whose retrieval interval has elapsed;
- **frontier**: another task in a skill with recorded evidence;
- **explore**: a task in a skill without recorded evidence;
- **probe**: a bounded information check of a neglected, reachable strand.

The signed version-one offline protocol keeps its original reason vocabulary.

Support reservations, interleaving and catalog gaps can put the chosen task outside the band. The band is an objective, not a guarantee. Selection is deterministic for fixed inputs, seed and time.

## Reproducible synthetic checks

Run from `amp/`:

```sh
npx tsx scripts/simulate-frontier.ts development
npx tsx scripts/simulate-frontier.ts evaluation
npx tsx scripts/compare-frontier.ts 86dfa922c audit
npx tsx scripts/fit-frontier-calibration.ts
npx tsx --test tests/frontier-calibration.test.ts
```

The simulation runs the real planner, estimator and evidence projection. The planner receives twelve recent attempts and durable summaries, as the API does. Synthetic learners use a separate probit response model with template-specific difficulty/noise perturbations, slips, guesses, uneven strands, practice gains, forgetting and positive or negative outside-learning jumps. Their response model does not import the planner's logistic curve or item parameters. Six answers form a simulated day; batches contain three answers. Runs contain 180 attempts.

Development scenarios use seeds 11 and 29. Evaluation scenarios use seeds 101 and 307 with different ability, noise, learning and forgetting parameters. These scenarios informed policy development; they are not untouched validation. A final frozen-policy audit uses new seeds 607 and 991 with the same evaluation population families. Reports include:

- Mean absolute strand-estimate error every 30 attempts, including untouched strands.
- First sustained convergence within ±0.5 grade: three consecutive batch checkpoints after at least three answers in that strand. Counts are total learner attempts, not strand attempts; `null` means unreached.
- Detection delay: at least three post-jump strand answers and two consecutive checkpoints showing movement of at least half the jump from its pre-jump estimate. `null` means undetected. This measures directional response, not arrival at the new ability.
- Target-band share under both the planner prediction and the independent synthetic probability, plus their mean absolute difference.
- Feasible-band opportunities: an in-band template existed within the grade ceiling, avoiding recent skills and strands already selected in the batch. Missed opportunities distinguish deliberate support and probe selections from unexplained misses. This is conditional on the estimate, not an oracle of real ability.
- Batches with due successful retrievals, batches serving at least one, reviews served and mean delay. The denominator includes overdue work outside the lowered frontier, exposing unserved demand. The ratio does not mean every due skill was reviewed.
- Maximum strand share, longest consecutive strand run and per-strand visit counts.

Regression tolerances cover error, band coverage, review service, concentration and change detection. They do not promise monotonic improvement. Curriculum additions can change the experiment; tolerance changes require inspection of the full reports and censored results. Some strands never converge or detect a jump. Sparse advanced material, pooled priors and forced review/diversity choices limit placement and target-band accuracy.

The fitting command estimates difficulty and discrimination on 400 synthetic responses per template and scores a separate 400-response validation sample with a different ability distribution. It prints proposed parameters and both validation losses; some fits can worsen validation. Diagnostic fits are never loaded by the API. Real-attempt fitting requires an independently anchored ability scale, sufficient per-template data, privacy controls and held-out learners. Across the 142-template fitting experiment, mean held-out response log loss decreased from 0.4399 to 0.4314, and mean absolute probability error against the synthetic response curve decreased from 0.0506 to 0.0250. This supports the fitting implementation on that synthetic family, not transfer of those parameters to real learners. Synthetic fitting and simulation cannot establish learning efficacy or justify sales claims.

Per-candidate work is constant-sized: one probability, five information points and existing evidence checks. The estimator builds each template's grid likelihood once per request and reuses it. Historical replay remains proportional to retained attempts; this change does not establish bounded long-term request latency.

## Storage and privacy

Migration `0008-skill-evidence.sql` builds summaries from attempts present in the database. Missing or deleted history is not reconstructed. Historical ordering uses creation time and attempt ID. Future attempts receive a monotonically increasing ingestion sequence under the learner lock, defining order for equal timestamps and concurrent requests. Original attempt facts are retained unchanged.

An insertion trigger updates the summary in the attempt transaction. A rejected duplicate or rolled-back transaction adds no evidence. Scheduling summaries use one row per observed skill and an indexed twelve-attempt recency window. The frontier separately replays retained history; it does not use a durable posterior checkpoint.

Parent exports identify summaries as `derived-skill-evidence`. Learning-data deletion purges summaries and history, including when an opaque learner record must be retained for billing. Consent withdrawal blocks learning writes under the account lock; it does not itself delete retained history.

Apply the migration with learning writers stopped before starting an application version that reads the projection. Back up the database and test against a representative isolated database first. Backfill is a transactional, bounded-memory replay whose duration grows with retained attempts. Fixtures require a dedicated database or isolated schema. This design does not establish throughput at millions of learners; capacity testing is separate work.
