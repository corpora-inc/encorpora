# `@dynawalla/curriculum`

The curriculum graph, its generator families, its mal-rules and the gates that
validate all three. No React, no DOM, no Tauri: this package is importable and
testable without building the app, which is what makes the mathematics verifiable
in CI in seconds.

Specification: [`../docs/CURRICULUM.md`](../docs/CURRICULUM.md),
[`../docs/GATES.md`](../docs/GATES.md),
[ADR-0006](../docs/DECISIONS/ADR-0006-typed-ts-curriculum-exact-arithmetic.md).

```
npm test                    # unit + property tests
npm run tsc                 # typecheck
npm run check               # dw-curriculum check — incremental, 200 seeds per level
npm run check:full          # the full sweep, 1000 seeds per level
npm run check -- --report json
npm run snapshots:update    # rewrite the CG-16 output hashes
```

## What is here

| Path | What |
|---|---|
| `src/math/rational.ts` | Exact rational arithmetic over BigInt. Nothing that reaches an answer is a float. |
| `src/rng/` | Seeded integer-only PRNG (FNV-1a + mulberry32) and the FNV-1a-64 used for output hashes. Moves to `shared/kernel/` at M2. |
| `src/types/` | `SkillNode`, `Exercise`, `AnswerSchema`, `PromptSpec`, the generator contract, the mal-rule contract. |
| `src/generators/columnOp/` | `gen.arith.column-op` — the column algorithm, add and subtract, with exact regrouping control including across zeros. |
| `src/malrules/` | Three executable buggy procedures for that family, and the classifier. |
| `src/graph/` | The `add` domain seed: three active nodes and one draft. |
| `src/render/registry.ts` | Renderer *declarations*. The data behind CG-8. |
| `src/validate/` | The gates and `dw-curriculum check`. |

## Three rules that are not negotiable

**Exact arithmetic.** `0.1 + 0.2 !== 0.3` marks correct decimal work wrong
*deterministically*, so no flaky-test detector would ever surface it. Every value
that reaches an answer or a comparison is a `Rational` over BigInt, and gate `M-05`
fails the build on a fractional literal, a `Math.exp`, a `parseFloat` or a
`toFixed` anywhere in this package or in `engine/`.

**Seeded and platform-stable.** The same seed produces the identical exercise on
every device. Never `Math.random`, no `Intl` inside generation, no key-order
assumptions. CG-16 commits an output hash per level and checks it on macOS and
Linux.

**Structured prompts.** `Exercise.prompt` is a `PromptSpec` — a locale key and
typed slots — never a rendered string. One template translated once serves every
seeded instance for ever, which is what makes five locales affordable across ~160
skills.

## The gates

`dw-curriculum check` reports every gate in GATES.md. Seventeen are implemented;
five print as `pending` with the PR that owns them, because a gate table where an
unimplemented gate reads as green is worse than no table.

Each implemented gate has a failing-case test in `src/validate/gates.test.ts` that
deliberately violates it and asserts it goes red.

Two implementation notes where the document and the code differ, both deliberate:

- **CG-10** is worded as "<2% duplicates over 1,000 draws". Two-digit subtraction
  with one regrouping has on the order of 1,600 distinct problems *in total*, so
  1,000 draws from it collide about 20% of the time however good the generator is,
  and the literal gate is unsatisfiable for every grade-1 level. It is implemented
  as the thing that wording is *for*: a floor on the estimated size of the variant
  space, measured from the collisions actually observed. The estimator is
  optimistic at high collision rates, so the floor carries an order of magnitude of
  margin and CG-9's hard `minVariants` count backs it up.
- **Incremental mode** is seed-scoped, not diff-scoped. The graph is four nodes; a
  diff scoper today would be untested machinery guarding nothing. PR-4.6 owns it.

## Adding a generator family

One family per PR. It needs a `paramSchema` that rejects parameter combinations no
item could satisfy, property tests over thousands of seeds, mal-rules where the
evidence base is real (**never invent a bug**), prompt templates as locale keys, a
renderer declaration for every answer schema it emits, and a committed output hash.
