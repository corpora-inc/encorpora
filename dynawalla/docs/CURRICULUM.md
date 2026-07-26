# Dynawalla — Curriculum

Authoring model and immutability rules: [ADR-0006](DECISIONS/ADR-0006-typed-ts-curriculum-exact-arithmetic.md).
Scope cut and why: [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md).
The gates that enforce all of this: [GATES.md](GATES.md).

## V1 shape

**6 domains · ~160 active skills · 18 generator families · ~28 executable mal-rules ·
4 answer schemas · 4 representations.**

| Domain | id | V1 skills | Grades |
|---|---|---|---|
| Number sense and place value | `ns` | 34 | 1–5 |
| Addition and subtraction | `add` | 32 | 1–4 |
| Multiplication | `mul` | 26 | 2–5 |
| Division | `div` | 22 | 3–5 |
| Fractions | `frac` | 32 | 2–5 |
| Equality and early algebra | `alg` | 14 | **1**–5 |

Cut to V2 and named in the non-goals list: geometry and spatial, measurement, data and
probability, ratios and rates, integers, decimals-as-a-domain, grade 6, formal
pre-algebra.

**`alg` starts at grade 1.** On `8 + 4 = ☐ + 5`, roughly 5% of grade 1–2 children answer
7; in one sample *all 145 sixth graders* answered 12 or 17; equal-sign knowledge at
second grade predicts fourth-grade algebra competence.
`dw.alg.equality.balance-meaning` is a grade-1 node and the balance scale is one of the
four V1 representations.

**Fractions are prioritized ahead of any breadth elsewhere.** Elementary fraction and
division knowledge uniquely predicts high-school algebra achievement 5–6 years later,
controlling for IQ, working memory and family income, replicated in US and UK
longitudinal samples.

## Node identity

Ids are `dw.<domain>.<cluster>.<slug>`, matching
`^dw\.[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$`, and are **immutable forever** — they are
mastery keys on learner devices. A rename means minting a new id and setting
`status: "deprecated"` + `supersededBy` on the old one, which stays hidden from
scheduling.

**Grade is not in the id.** It is `gradeBand { earliest, nominal, latest }`, because
Singapore teaches fraction-of-a-whole at P2, CCSS starts fractions at grade 3, and
England mandates 12×12 tables by Y4. All three frameworks agree on the spine and
disagree on timing by 1–2 years, so **progression gates on prerequisites, never on
grade.**

**Difficulty is not in the id.** It is a per-level generator parameter.

`SkillNode` carries: `rev`, `status`, `title`/`learnerGoal` as locale keys (never
English literals), `domain`, `cluster`, `bigIdeas`, `gradeBand`, `strandRole`, an NRC
`proficiency` 4-tuple, `classification`, `fluencyTarget?`, `prereqs: Edge[]`,
`difficulty { b, levels }`, `misconceptions`, `contrastsWith?`,
`representations { required, optional }`,
`generator { family, familyRev, params, forms, minVariants, consumes }`, `probes`,
`provides: CapabilityTag[]`, and `standards? { ccss, sg, uk }` **as codes only**.

Edges are `requires` / `extends` / `supports` / `contrasts`.

## Exercise contract — three non-negotiables

```ts
Exercise {
  exerciseId: `${family}@${familyRev}:${skillId}:L${level}:${seed}`
  skillId, level, seed
  prompt: PromptSpec          // { key: LocKey, slots } — NEVER a rendered string
  representation?: RepSpec
  answer: { canonical, alsoAccept }
  distractors: { value, misconception? }[]
  check: { kind, tolerance? }
  solution: SolutionStep[]
}
```

1. **Exact rational arithmetic only.** No IEEE floats in any generator or checker.
   `0.1 + 0.2 !== 0.3` produces deterministically wrong decimal answers that no
   flaky-test detector will ever surface. A lint bans bare float ops in `curriculum/` and
   `engine/`.
2. **Seeded, pure and platform-stable.** Own PRNG, never `Math.random`, byte-identical
   on x86 and arm64, no `Intl` inside generation, no key-order assumptions.
3. **Structured prompts, never strings.** One template key translated once serves every
   seeded instance forever, so localization cost scales with template count rather than
   content volume.

## Difficulty

`b` is a **pure function of generator parameters**, e.g.

```
b = b_skill
  + 0.55·regroupings
  + 0.30·(maxDigits − 2)
  + 0.25·zeroBorrowThrough
  + 0.20·noAnchor
  − 0.35·specialCase
  + repOffset + formOffset
```

with every coefficient in one `constants.ts`. That is why no item-calibration corpus is
needed — and it is falsifiable, which is what gate **EG-5** exists to do. See
[ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md).

## The 18 V1 generator families

**Arithmetic core (6):** `gen.arith.column-op` (12 skills), `fact-recall` (10),
`mental-strategy` (8), `multidigit-mul` (7), `long-div` (7), `missing-operand` (9).

**Number (5):** `place-value-decompose` (12), `compare-order` (14 — one family over
whole/fraction/decimal via a `numberType` param), `numberline-locate` (10),
`round-estimate` (7), `factor-multiple` (8).

**Rational (4):** `frac.partition-model` (10), `frac.equivalence-simplify` (9),
`frac.arith` (13), `frac.convert` (7).

**Word problems (2):** `gen.word.additive-situation`, parameterized by the 12 cells of
the CCSS Glossary Table 1 matrix (Add-To / Take-From / Put-Together / Compare ×
Result / Change / Start) crossed with `unknownPosition`, `comparePhrasing`,
`numberRange` and `contextTheme`; and `gen.word.multiplicative-situation` (3 situation
types × 3 unknowns).

**Cross-cutting (1, owns zero skills):** `gen.logic.error-analysis`, driven by the
mal-rule table — every mal-rule becomes "here is the apprentice's work, find the mistake"
content for free, and it teaches the meta-skill of checking work. Built in V1.

(`gen.logic.odd-one-out`, driven by `contrasts` edges, is V2 with the domains that make
it interesting.)

Not 60 families, because difficulty is *parameters*: `column-op` with
`{ op, digits, regroupPositions, acrossZero, decimalPlaces }` covers 2-digit addition
through decimal subtraction. Not 6, because the interaction form and the answer checker
differ irreducibly across these groups.

## Word problems are locale content, not translation

`contextTheme` is a **locale-scoped asset**: per-locale name pools, object pools,
currency and unit sets, **authored** by whoever owns that locale. Gate CG-21 requires
every active word-problem family to have a populated context set in all launch locales.
The CCSS compare phrasings ("how many more", "how many fewer") do not map one-to-one
across languages and are reviewed by a native speaker per locale before those families
go `active`.

## Mal-rules — executable, triple-duty

A mal-rule is a pure `(exercise) => AnswerValue | null` reproducing a documented buggy
procedure. One function gives three things:

- **principled distractors** (a wrong answer a real child would actually produce),
- **diagnosis** — if the child's answer *equals* the mal-rule output, you know *which*
  bug fired,
- **error-analysis content**, free, via `gen.logic.error-analysis`.

The evidence base: Brown & Burton's BUGGY work found 39% of 1,300 students showed
consistent buggy behaviour on place-value subtraction; recent catalogues encode ~101
mal-rules across ~498 templates.

V1 concentrates where the evidence is genuinely deep:
`mis.add.smaller-from-larger` (5,001 − 2,798 = 3,797 — the smaller digit taken from the
larger in every column),
`mis.add.borrow-across-zero` (602 − 437 = 265, and 5,001 − 2,798 = 3,203 — regrouped all
the way down, never decremented the leading digit), `mis.add.misaligned-columns`,
`mis.add.carry-dropped`, `mis.mul.makes-bigger`, `mis.mul.partial-product-misaligned`,
`mis.div.divisor-must-be-smaller`, `mis.div.remainder-dropped`,
`mis.frac.add-numerators-and-denominators`,
`mis.frac.larger-denominator-larger-fraction` (both children of one
`whole-number-bias` parent so remediation routes together),
`mis.frac.mixed-number-concatenation`, `mis.alg.equals-as-operator`,
`mis.ns.place-value-digit-reversal`, plus ~15 more.

**Safety rule: mal-rule labels are internal.** Learner-facing feedback names the *correct
idea*, never the child's defect. A lint enforces it (`M-16`).

**Honesty rule:** the catalogue is deep for multi-digit subtraction, decent for the
multiplication and division algorithms, and thin for fractions and word problems. Where
it is thin, default to "unclassified error" and a faded worked example. **Never invent a
bug**, and never promise "we always tell you where your thinking broke."

## Representations — four in V1

| Representation | Carries |
|---|---|
| Counting board / abacus | Place value and regrouping. This is the LOCATE representation for borrow-across-zero. |
| Balance scale | The equals sign as a **relation**, not an operator. |
| Gear train | Multiples, factors, LCM. |
| Number line / bar model | Magnitude, fractions, comparison. |

The astrolabe, water clock, girih tessellation and market weights remain **world
architecture** in V1 and become math representations in V2 with geometry and
measurement. That is how the fiction stays honest instead of being stretched to cover
probability with an invented mechanism.

## Staging

| Stage | Milestone | Content | Families |
|---|---|---|---|
| V1.0 | M4 | Grade 1–2 spine: `ns` + `add` + `alg` equality, ~62 skills | 7 — `column-op`, `fact-recall`, `mental-strategy`, `missing-operand`, `place-value-decompose`, `compare-order`, `numberline-locate` |
| V1.1 | M7 | Grade 3–4: `mul` + `div`, +58 skills | +7 — `multidigit-mul`, `long-div`, `round-estimate`, `factor-multiple`, both word families, `gen.logic.error-analysis` |
| V1.2 | M7 | Fractions and grade-5 depth, +40 skills | +4 — `frac.partition-model`, `frac.equivalence-simplify`, `frac.arith`, `frac.convert` |

7 + 7 + 4 = **18**, which is the number in [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md)
and the number of family PRs in [MASTER_PLAN.md](MASTER_PLAN.md) (`column-op` ships early,
at M2, and is bound at M4 with the rest of the spine). A family is *bound* at the
milestone that implements its generator; individual nodes go `active` in the domain
promotion PRs, which is why M4 binds seven families but activates ~62 skills rather than
all of their levels.

## Validator runtime

CG-9/10/11/12 over 160 skills × 4 levels × 1,000 seeds is roughly 640k `generate()`
calls — far too slow per PR. **Incremental mode** (diff-scoped, reusing the `changes`
job pattern) runs on PR; a **nightly full sweep** with a named owner runs the whole
graph. Both from day one, not retrofitted when it gets slow.

## Legal

Titles and descriptions are **authored originally**; standards are stored as **codes
only**. CCSS text is copyrighted by the NGA Center and CCSSO under a license limited to
purposes supporting the Initiative and requiring a specific notice, and this repository
is public. Codes are short factual identifiers. A public *alignment claim* is a separate
exposure — [ADR-0010](DECISIONS/ADR-0010-standards-alignment-claim.md).

`030-grade3/` and `math-foundations-02-grade/` in this repo may be mined once as a naming
and coverage seed, then the dependency dropped. They are book prose, not a graph, and
must never become a second source of truth.
