# Growth this term

Growth is the pace of the level on the days its uncertainty was at most 0.6
grades, across the days the term has run.

A student with no such pace has no growth figure. The screen shows "—", and
"not settled yet" where it gives a reason. It does not show 0.

## What was measured

The production calibration harness
(`scripts/frontier/production-calibration.ts --growth`, seed 20261110) ran 120
misspecified learners for a 180-day term. True growth was Uniform(0, 1.5)
grades (mean 0.776 in this draw). Each learner practiced 2–6 fixed days a week
and answered 5–40 problems on each of those days. Their starting point was −2
to +3 grades from the age prior, on the same grade grid as the coverage study.
Low and high practice split at the median, 2,275 answers.

The target is the true change across the whole term. A learner with no figure
is missing, not zero. Coverage is the share of figures whose ±1.96 standard-error
interval contains that target. The half-width is the median of those 1.96
standard errors. `r` is the correlation of the figure with how many answers the
learner gave. A negative `r` is the old convergence signature: less practice,
more apparent growth.

Reported uncertainty is sd-cal-v1. The days are the stored level days, one per
practice day.

| definition | n | bias | MAE | 95% | n low | bias low | MAE low | 95% low | n high | bias high | MAE high | 95% high | half-width | r | start day | start answers |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| latest − first stored day | 120 | -0.072 | 0.504 | 99.2 | 60 | -0.113 | 0.447 | 100.0 | 60 | -0.031 | 0.560 | 98.3 | 1.95 | -0.01 | 0 | 19 |
| latest − first day with ≥ 20 answers | 120 | -0.086 | 0.434 | 100.0 | 60 | -0.091 | 0.418 | 100.0 | 60 | -0.080 | 0.449 | 100.0 | 1.82 | -0.04 | 1 | 32 |
| latest − first day with ≥ 40 answers | 120 | -0.055 | 0.386 | 100.0 | 60 | -0.080 | 0.388 | 100.0 | 60 | -0.030 | 0.385 | 100.0 | 1.82 | 0.04 | 3 | 54 |
| latest − first day with ≥ 60 answers | 120 | -0.035 | 0.379 | 100.0 | 60 | -0.086 | 0.423 | 100.0 | 60 | 0.017 | 0.334 | 100.0 | 1.80 | 0.01 | 4 | 71 |
| latest − first day with ≥ 100 answers | 120 | -0.065 | 0.388 | 100.0 | 60 | -0.076 | 0.434 | 100.0 | 60 | -0.055 | 0.341 | 100.0 | 1.81 | -0.02 | 7 | 113 |
| latest − first day with reported sd ≤ 0.5 | 59 | -0.260 | 0.449 | 94.9 | 22 | -0.249 | 0.424 | 95.5 | 37 | -0.267 | 0.463 | 94.6 | 1.49 | -0.12 | 28 | 384 |
| latest − first day with reported sd ≤ 0.6 | 120 | -0.018 | 0.393 | 100.0 | 60 | -0.012 | 0.406 | 100.0 | 60 | -0.024 | 0.380 | 100.0 | 1.62 | -0.03 | 4 | 60 |
| latest − first day with reported sd ≤ 0.7 | 120 | -0.054 | 0.405 | 100.0 | 60 | -0.054 | 0.406 | 100.0 | 60 | -0.055 | 0.405 | 100.0 | 1.71 | -0.07 | 2 | 36 |
| latest − first day with reported sd ≤ 0.8 | 120 | -0.085 | 0.434 | 100.0 | 60 | -0.103 | 0.421 | 100.0 | 60 | -0.066 | 0.446 | 100.0 | 1.80 | -0.03 | 1 | 30 |
| settled pace (sd ≤ 0.5) stretched across the term | 59 | -0.058 | 0.616 | 98.3 | 22 | -0.073 | 0.710 | 100.0 | 37 | -0.049 | 0.560 | 97.3 | 2.08 | -0.10 | 28 | 384 |
| settled pace (sd ≤ 0.6) stretched across the term | 120 | 0.014 | 0.414 | 100.0 | 60 | 0.028 | 0.434 | 100.0 | 60 | 0.000 | 0.394 | 100.0 | 1.69 | -0.05 | 4 | 60 |
| settled pace (sd ≤ 0.7) stretched across the term | 120 | -0.037 | 0.415 | 100.0 | 60 | -0.032 | 0.421 | 100.0 | 60 | -0.042 | 0.408 | 100.0 | 1.75 | -0.08 | 2 | 36 |
| settled pace (sd ≤ 0.8) stretched across the term | 120 | -0.072 | 0.439 | 100.0 | 60 | -0.088 | 0.431 | 100.0 | 60 | -0.056 | 0.447 | 100.0 | 1.82 | -0.03 | 1 | 30 |
| WLS pace on days with sd ≤ 0.5, × elapsed days, classical SE | 46 | -0.213 | 2.391 | 91.3 | 15 | -0.206 | 0.592 | 86.7 | 31 | -0.217 | 3.262 | 93.5 | 2.26 | 0.17 | 19 | 278 |
| WLS pace on days with sd ≤ 0.6, × elapsed days, classical SE | 120 | -0.024 | 0.232 | 95.0 | 60 | 0.000 | 0.230 | 96.7 | 60 | -0.048 | 0.234 | 93.3 | 0.58 | -0.01 | 4 | 60 |
| WLS pace on days with sd ≤ 0.7, × elapsed days, classical SE | 120 | -0.016 | 0.213 | 93.3 | 60 | 0.006 | 0.218 | 96.7 | 60 | -0.037 | 0.208 | 90.0 | 0.48 | -0.03 | 2 | 36 |
| WLS pace on days with sd ≤ 0.8, × elapsed days, classical SE | 120 | -0.016 | 0.213 | 92.5 | 60 | 0.004 | 0.217 | 95.0 | 60 | -0.036 | 0.210 | 90.0 | 0.45 | -0.04 | 1 | 30 |
| WLS pace on days with sd ≤ 0.5, × elapsed days, endpoint SE | 46 | -0.213 | 2.391 | 87.0 | 15 | -0.206 | 0.592 | 100.0 | 31 | -0.217 | 3.262 | 80.6 | 1.82 | 0.17 | 19 | 278 |
| WLS pace on days with sd ≤ 0.6, × elapsed days, endpoint SE | 120 | -0.024 | 0.232 | 100.0 | 60 | 0.000 | 0.230 | 100.0 | 60 | -0.048 | 0.234 | 100.0 | 1.69 | -0.01 | 4 | 60 |
| WLS pace on days with sd ≤ 0.7, × elapsed days, endpoint SE | 120 | -0.016 | 0.213 | 100.0 | 60 | 0.006 | 0.218 | 100.0 | 60 | -0.037 | 0.208 | 100.0 | 1.75 | -0.03 | 2 | 36 |
| WLS pace on days with sd ≤ 0.8, × elapsed days, endpoint SE | 120 | -0.016 | 0.213 | 100.0 | 60 | 0.004 | 0.217 | 100.0 | 60 | -0.036 | 0.210 | 100.0 | 1.82 | -0.04 | 1 | 30 |

On a full term of this practice, an answer-count start is only mildly biased.
The convergence the schools were seeing sits inside the first stored day when a
student answers 5–40 problems that day, so subtracting two levels mostly
tracks the term. Those intervals cover the truth because they are about ±1.8
grades wide. A cut of 0.5 grades of uncertainty leaves about half the learners
with no figure, and stretching a late pace across the term is unstable.

Replaying the estimator at term start was not used. A school read is not
allowed to replay the frontier, and the stored level days already hold the
reported level and its sd.

## The choice

Weighted least squares of the reported level on the day, for days whose
reported sd is at most 0.6, weights 1/sd², times the days the term has run.
The standard error is the classical one for that fit, `elapsed / √Sxx`, which
is what makes the 95% interval a 95% interval (95.0% overall, 96.7% low
practice, 93.3% high). Bias is −0.024 grades. Mean absolute error is 0.232,
about half the two-point definitions. The correlation with practice is −0.01.

A looser cut (0.7 or 0.8) has a slightly smaller error and a slightly
under-covering interval on the students who practiced most. The two-point
"settled" definitions are easier to say and almost as unbiased, and their
intervals cover everyone by being about three times too wide. The pace is the
one whose uncertainty is honest.

The same function, `termGrowth` in `src/schools/growth.ts`, is what the
overview, the grade model, the standing curves and the standings board read.
Closed terms keep the suggestion that was frozen with them.
