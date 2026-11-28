# Readiness: the chance of passing the Mobile Crane Operator Core exam

The app answers one question for a learner: if you sat the written core exam
today, how likely are you to pass on the first try? The model is
`harvest/practice/src/readiness.ts`; this page defines its evidence, its output
and how it will be validated against real candidates.

## The exam it predicts

A 90-item mock built from the `mobile-core` blueprint in
`crane/content/exams.json`: 90 minutes, no calculator, items drawn per domain
from the domain's skills, a practice pass mark of 70%. The certifier reports
scaled scores, so the true cut is not a fixed percent; see *Validation*.

The `mobile-core` blueprint in `exams.json` today has Site 21, Operations 26,
Technical Knowledge 22 and Load Charts 26 items (weights 0.22 / 0.28 / 0.23 /
0.27). That totals **95 items, not 90**, and differs from the revised plan's
weights (about Site 20%, Operations 26%, Technical Knowledge 28%, Load Charts
26%, which is 18 / 23 / 25 / 23 items of 90). The content lane owns the
blueprint; readiness uses whatever it says.

## Evidence

Only what the learner does in the app, and all of it already recorded by the
practice engine (`evidence.ts`):

| Evidence | Where it comes from | How it enters |
|---|---|---|
| Every graded attempt: skill, item difficulty, right or wrong, when | practice, review, mock exams (`recordAttempt`, `absorbExam`) | a Bayesian update of the skill's ability belief θ ~ N(μ, σ²) under P = c + (1 − c − s)·sigmoid(θ − b) |
| Time since the last attempt per skill | the attempt timestamps | the belief widens and relaxes toward the prior (forgetting) |
| The exam's composition | the blueprint (skills per domain, items per domain) and the difficulty mix of real forms | which skills and difficulties the predicted exam draws |

No self-report and no time-on-task enter the prediction.

## The model

1. **One learner, all skills.** Each skill's belief was updated from the
   population prior, so the prior is divided out to recover what the
   learner's own attempts say. Those are pooled into a learner level m, with
   the skill spread τ = 0.7 by default. Each skill's ability is its own
   evidence combined with N(m, τ²). A skill the learner has not practised yet
   sits at their own level, not the population's.
2. **The exam.** For one draw of the abilities, a domain's items are
   exchangeable, so its score is Binomial(count, p_d). Here p_d is the mean
   chance of success over the domain's skills and the exam's difficulty mix.
   The total score is the convolution of the domains.
3. **Uncertainty.** The learner level and every skill's ability are drawn
   1,000 times. Averaging the score distributions gives:
   - **`pPass`**, the chance the score reaches the pass mark;
   - **the expected score** and an **80% interval**;
   - **the expected score per domain**;
   - **`weakest`**, the skills ranked by expected exam items lost.
4. **When to show a number.** `confident` is true once at least 90% of the
   exam's items rest on skills with 5 or more attempts. Until then the app
   should say what to practise next, not a percentage.

## Checks so far (synthetic)

These checks use learners simulated under the model's own assumptions. They
test the arithmetic and calibration of the method, not whether the assumptions
hold for real operators.

| Check | Result |
|---|---|
| 600 simulated learners with 10 attempts per skill | Brier 0.10, against 0.25 for always predicting the base rate |
| Calibration by predicted band | below 0.2: predicted 0.04, observed 0.04; 0.2–0.4: 0.29 vs 0.26; 0.4–0.6: 0.50 vs 0.56; 0.6–0.8: 0.69 vs 0.47; 0.8 and above: 0.95 vs 0.90 |
| 30 attempts per skill | Brier 0.07; above 0.8: 0.97 vs 0.97 |
| A mismatched population prior (simulated cohort centred above the engine's default prior) | predictions were pessimistic until the prior was set to the cohort; it must be fitted from real learners |

The 0.6–0.8 band runs optimistic by 0.12–0.22, which is 2–3 standard errors at
40–55 learners per band. This is probably the Gaussian approximations, and it
is corrected by the recalibration step below. The unit test
(`harvest/practice/test/readiness.test.ts`) holds the confident ends to 0.1
and the middle loosely.

## Validation with real candidates

What to collect, with consent, in the app:

1. **The prediction at the moment it matters.** When a learner records an exam
   date, and again the day before it, store `pPass`, the interval, `confident`,
   the evidence summary and the app version.
2. **The real result.** After the date, ask once: "Did you pass the written core
   exam?" (passed / didn't pass / didn't sit), plus the scaled score if they
   want to share it. A learner who doesn't answer is never assumed to have
   passed or failed.
3. **Full mock exams under exam conditions** (90 items, 90 minutes). These
   give an earlier, in-app check: did the prediction made before the mock match
   the mock's outcome?

How to judge it:

| Question | Measure | Bar to keep the model |
|---|---|---|
| Is it calibrated? | reliability by predicted band (0–0.2, …, 0.8–1), expected calibration error | within 0.1 in every band with at least 30 candidates |
| Does it beat the obvious rule? | Brier score against "passed the last mock with at least 70%" and against the base rate | lower Brier than both |
| Does it rank candidates? | AUC on pass / fail | at least 0.75 |
| Is the number trustworthy when shown? | the same measures on `confident` predictions only | as above |

Steps, in order:

1. **Fit the population prior** (the mean and sd of learner level m) and the skill
   spread τ from the first few hundred learners' histories. Today they are the
   engine's defaults.
2. **Re-fit item difficulties** from attempt data (a Rasch or 2PL fit). Today
   the bake assigns them: 0.2 / 0.5 / 0.8.
3. **Map the practice pass mark to the scaled cut.** The certifier's cut is
   reported as a scaled score; fit the percent cut that best separates
   self-reported passes from fails.
4. **Recalibrate `pPass`** with a monotone map (isotonic or Platt) fitted on
   held-out real outcomes, and report its calibration on a later cohort.

Sample size: about 100 reported results give bands of ±0.1. Until then, only
the synthetic and mock-exam checks back the number, and the app should present
it as an estimate.
