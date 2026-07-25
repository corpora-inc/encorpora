# ADR-0002 — V1 covers number and arithmetic only

**Status:** Accepted

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

## Decision

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
"grades 1–6 mathematics."

## Consequences

- Gate **C-13** makes the cut mechanical: no skill classified `conceptual` or
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
