# Norms prior: how spread out a grade is

AMP measures position in grades of its own curriculum: level − rostered grade. These sources say how wide that position is for students we know nothing about, and how wide a class should look. The unit is a grade-year, one typical year of growth.

## Sources

1. **NWEA 2020 student norms.** Thum, Y. M., & Kuhfeld, M. (2020). *NWEA 2020 MAP Growth Achievement Status and Growth Norms for Students and Schools.*
   - Tables: <https://teach.mapnwea.org/impl/NormsTables.pdf>
   - Report: <https://teach.mapnwea.org/impl/normsResearchStudy.pdf>
   - The tables give fall mathematics status (mean, SD) and fall-to-fall growth (mean, SD).
   - The SDs are true-score SDs, with measurement error removed (report §4).
2. **Annual gains in SD units.** Bloom, H. S., Hill, C. J., Black, A. R., & Lipsey, M. W. (2008). Performance trajectories and performance gaps as achievement effect-size benchmarks for educational interventions. *Journal of Research on Educational Effectiveness*, 1, 289–328. Working paper, Table 3: <https://mdrc.org/sites/default/files/full_473.pdf>
   - Same means: Hill et al. (2008), *Child Development Perspectives* 2(3).
   - The gains are pooled across six nationally normed tests and divided by the within-grade SD, so one SD in grade-years is 1 / gain.
3. **Spread within one school.** Schools explain 17–21% of math status variance (source 1, Table 5.3). So the spread within a school is about 0.9 of the national spread.

## In grade-years

- **NWEA:** within-grade SD = fall SD ÷ local annual growth. Local annual growth is the mean of fall-to-fall growth into and out of the grade.
- **Bloom/Hill:** within-grade SD = 1 / the next year's gain.

| Grade | NWEA fall SD (RIT) | Growth (RIT/yr) | NWEA SD (yrs) | Bloom/Hill gain (SD) | Bloom/Hill SD (yrs) | **AMP prior sd** |
|---|---|---|---|---|---|---|
| K | 12.45 | 21.95 | 0.57 | 1.14 | 0.88 | **0.7** |
| 1 | 12.43 | 18.57 | 0.67 | 1.03 | 0.97 | **0.8** |
| 2 | 12.98 | 14.25 | 0.91 | 0.89 | 1.12 | **1.0** |
| 3 | 13.45 | 12.36 | 1.09 | 0.52 | 1.92 | **1.1** |
| 4 | 14.40 | 10.54 | 1.37 | 0.56 | 1.79 | **1.6** |
| 5 | 15.19 | 7.56 | 2.01 | 0.41 | 2.44 | **1.9** |
| 6 | 16.12 | 6.36 | 2.54 | 0.30 | 3.33 | **2.5** |
| 7 | 17.41 | 6.62 | 2.63 | 0.32 | 3.13 | **2.9** |
| 8 | 18.94 | 4.87 | 3.89 | 0.22 | 4.5 | **3.5** |
| 9–12 | 19.8–21.6 | 3.3–1.0 | 6–21 | 0.25–0.01 | 4–100 | **4 (cap)** |

- **Spread of growth between students** (NWEA fall-to-fall growth SD ÷ mean):
  - about 0.4–0.6 of a year in K–4;
  - about 0.9–1.0 in grades 6–7;
  - above 2 in high school.
- **After grade 8, normed growth nearly stops**, so grade-years stop meaning much. In high school a grade means course progress (Algebra 1, Geometry…), so the prior stops at 4.

## Where AMP uses it

Display only (`src/schools/norms-prior.ts`):

- **A rostered student with no stored level at all.** Their curve is N(age-expected grade − rostered grade, sd(grade)). Until practice opens there is nothing else to draw.
- **The dashed "typical national spread"** on every standing curve. This is the mixture of N(0, sd(gᵢ)) over the group's students. A group's own curve can be read against it.

A student whose practice has opened is drawn from what the estimator shows (below).

## The estimator's age prior (grade-frontier-v5)

The overall readout of a learner whose start comes from a birth year now uses this table's **AMP prior sd** as its prior width, held at 2.5 from grade 6 up, the former flat width (`NORMS_PRIOR_SD` in `src/learning/frontier-policy.ts`):

| Start | K | 1 | 2 | 3 | 4 | 5 | 6 and up |
|---|---:|---:|---:|---:|---:|---:|---:|
| Prior sd | 0.7 | 0.8 | 1.0 | 1.1 | 1.6 | 1.9 | 2.5 |

- **A provisional, external prior.** These widths come from national norms on other vertical scales, not from AMP learners. AMP has too few real learners to fit a population spread, and its school demo learners are generated at 0.6 × these widths (`src/schools/demo/truth.ts`), so they cannot be used for this either.
- **Not scaled by 1/0.9** for a school-independent learner, as the first draft of this page proposed. Wider would move a three-answer readout further, which is the behaviour this change exists to stop. The display rule (docs/adaptive-evidence.md) carries the rest.
- **Chosen starts are unchanged.** A start someone chose (an adult's start, a family band, a restarted area) is a coarser guess and keeps 2.5.
- **Selection is unchanged.** It keeps 2.5 for every start: its pooled estimate, the areas and the climb do not read this table.
- **The cap.** The norms are wider than 2.5 from grade 6, but no start moves faster than it did under v4.

## What we would still change

1. ~~Make the overall prior sd depend on grade.~~ Done for the overall readout in grade-frontier-v5 (above). Selection keeps the flat 2.5 until a change to it shows a gain in practice.
2. **Centre the prior on the time of year.** Expected position runs from g − 0.5 in the fall to g + 0.5 in the spring (the grade model already assumes this, `grade-policy.ts`). The overview's "within their grade" band could follow it too.
3. **Set the drift from growth spread.** Between answers the posterior widens by a variance of 0.02 a day (`frontier-policy.ts`, capped at 30 days). For a learner who practises daily that adds up to 7.3 grade² a year, an sd of about 2.7 grades. The between-student spread of a year's growth here is 0.4–1.0 of a year. Once per-answer sds are calibrated, the drift should come down toward the norms.
4. **Check coverage against these spreads.** A school whose placed students show a much narrower sd than the "typical" curve is either a tracked class or an over-confident estimator. The second is the calibration worker's check (coverage of μ ± 2σ on synthetic learners).

Caveats:

- Both sources use vertical scales. The ratio of spread to growth depends on the scale, which is part of why the two disagree in grades 1–4. We used values between them.
- The norming samples predate 2020: Bloom/Hill 1991–2002, NWEA 2015–2018.
- "SD in years" divides by a growth curve that slows with age. One SD above the mean spans more grade-years than one SD below.
