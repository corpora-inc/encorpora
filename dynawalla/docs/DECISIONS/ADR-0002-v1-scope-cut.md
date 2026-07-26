# ADR-0002 — V1 covers number and arithmetic only

**Status:** Proposed — awaiting founder
**Deadline:** before any public scope or marketing statement, and before M4 buys
curriculum breadth against one grade range or the other.

The engineering argument below is the program's and it is strong. The *scope* it
implies is not the program's to accept: it narrows the founder-stated product
(grades 1–6 plus intro pre-algebra) and it rewrites the public claim. That is a larger
product decision than the store display name, which is correctly awaiting the founder in
[ADR-0016](ADR-0016-app-store-product-name.md).

## Context

The first draft of the program claimed 13 domains, ~480 skills, 45 generator families,
8 answer schemas and ~75 mal-rules for grades 1–6. Adversarial review multiplied those
numbers through the plan's own review gate and through the answer schemas that actually
exist, and both checks failed.

Grade 1–6 geometry is composing and decomposing shapes, drawing lines of symmetry,
sorting by property, reading a protractor, building nets, and van Hiele level 1–2
property reasoning. Measurement is reading a ruler, a scale, an analog clock face, a
measuring jug. Data is reading and constructing bar graphs, pictographs and line plots.
**None of these is a keypad answer.** The manipulation schemas they need — `dragPlace`,
`drawSegment`, `dialRead`, `buildChart` — do not exist, and each needs its own judge
branch, touch-target model, mal-rules and accessibility story.

Under a merge gate that requires every active skill to own a working generator, there
were only two outcomes for those ~113 nodes: stay in draft forever and silently drop a
quarter of the advertised coverage, or get laundered into `{kind: "choice", k: 4}`.
"Which of these is a line of symmetry? A B C D" is a worksheet with an ancient-futurist
frame. It teaches nothing about symmetry and it is exactly the failure mode this product
exists to avoid.

## The store age bands constrain this decision — recorded 2026-07-25

New information, and it means this ADR and
[ADR-0001](ADR-0001-kids-category-posture.md) are two views of one decision.

**Apple's Kids Category bands are 5-and-under, 6-8 and 9-11, and exactly one is
chosen. There is no band above 9-11.** Play's target-audience declaration is
multi-select and does have a 9-12 band, so Play can express the founder-stated scope and
Apple cannot.

Grades 1–6 plus intro pre-algebra spans roughly **ages 6–12**:

- **Option A below (grades 1–5) lands exactly inside Apple's 9-11 ceiling.** The scope
  cut and the Apple band become consistent for free.
- **Option B (the founder-stated scope) pushes past it**, and then requires one of:
  declaring 9-11 anyway and skewing the listing to the top of the range; splitting into
  two SKUs; or skipping the Kids Category — which Guideline 2.3.8 and 5.1.4(b) make a
  trap rather than an escape, because child-implying metadata is reserved *to* the
  category and forbidden *outside* it.

This is not an argument for option A. It is a cost that was previously invisible on
option B and should be priced in when the founder decides. The band choice itself is a
separate founder decision and is **not made**; see
[ADR-0001](ADR-0001-kids-category-posture.md).

## Options

**A — V1 as scoped below (recommended by the program).** Ship grades 1–5 number and
arithmetic. Geometry, measurement, data, ratio, integers, grade 6 and formal pre-algebra
go to V2, behind the manipulation schemas they need. Cost: the public claim is narrower
than the founder-stated scope from day one.

**B — V1 at the founder-stated scope.** Build `dragPlace`, `drawSegment`, `dialRead` and
`buildChart` — each with its own judge branch, touch-target model, mal-rules and
accessibility story — *before* the domains that need them go `active`. Cost: four answer
schemas and four interaction models ahead of M4, and every downstream milestone moves.
This is a real option; it is not a way of doing A faster.

**C — Ship the domains without the schemas.** Rejected on the evidence below: under
CG-7 they either stay in draft forever (silently dropping a quarter of advertised
coverage) or get laundered into `{kind: "choice", k: 4}`. Recorded here only so it is
not re-proposed as a compromise.

## Proposed decision (option A)

V1 is **6 domains · ~160 active skills · 18 generator families · ~28 executable
mal-rules · 4 answer schemas · 4 representations · 5 launch locales**.

Domains: number sense and place value (`ns`), addition and subtraction (`add`),
multiplication (`mul`), division (`div`), fractions (`frac`), equality and early algebra
(`alg`).

Explicitly **cut to V2**, and named in the non-goals list: geometry and spatial,
measurement, data and probability, ratios and rates, integers, decimals-as-a-domain
(decimal *notation* is carried by the number layer plus `ns`/`frac` parameterization),
grade 6, and formal pre-algebra.

The marketing claim follows the code: **"grades 1–5 number and arithmetic"**, not
"grades 1–6 mathematics." That sentence does not go public until this ADR is decided
(`G-04` covers the separate standards-alignment claim).

## Consequences of option A

- Gate **CG-13** makes the cut mechanical: no skill classified `conceptual` or
  `reasoning` may bind a generator whose only form is `choice`. Without it, schedule
  pressure re-creates the laundering path.
- Adding any V2 domain means first adding its manipulation schema, its judge branch, its
  touch-target and accessibility story, and its mal-rules — in that order. Anyone who
  "adds geometry" without them is adding worksheets.
- `alg` starts at **grade 1** deliberately. On `8 + 4 = ☐ + 5`, roughly 5% of grade 1–2
  children answer 7; in one sample *all 145 sixth graders* answered 12 or 17; equal-sign
  knowledge at second grade predicts fourth-grade algebra competence.
- Fractions are prioritized ahead of any breadth elsewhere: elementary fraction and
  division knowledge uniquely predicts high-school algebra achievement 5–6 years later,
  controlling for IQ, working memory and family income, replicated in US and UK
  longitudinal samples.

## Do not reintroduce

This cut will be re-litigated under schedule pressure ([RISKS.md](../RISKS.md) R-04).
The counter-argument to have ready is not "we do not have time" — it is that the schemas
do not exist, and that shipping the domains without them produces content the product's
own thesis calls worthless.
