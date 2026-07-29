# `@dynawalla/curriculum`

The mathematics, as a library packs import. The skill graph, its generator
families, its mal-rules, the counting-board contrast pair, and the gates that
validate all of them. No React, no DOM, no Tauri, no Node on the runtime surface:
this package is importable and testable without building anything, which is what
makes the mathematics verifiable in CI in seconds and consumable by a pack in a
WebView.

Consumed through the `@shared` alias — see [`../README.md`](../README.md).
Specification: [`../../../docs/CURRICULUM.md`](../../../docs/CURRICULUM.md),
[`../../../docs/GATES.md`](../../../docs/GATES.md),
[ADR-0006](../../../docs/DECISIONS/ADR-0006-typed-ts-curriculum-exact-arithmetic.md).

## Running it

The commands live in the dev workspace at [`../../../curriculum/`](../../../curriculum/),
which holds this library's devDependencies and nothing that ships:

```
cd dynawalla/curriculum
npm ci
npm test                    # unit + property + boundary tests
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
| `src/rng/` | Seeded integer-only PRNG (FNV-1a + mulberry32) and the FNV-1a-64 used for output hashes. |
| `src/types/` | `SkillNode`, `Exercise`, `AnswerSchema`, `PromptSpec`, the generator contract, the mal-rule contract. |
| `src/generators/numberFacts/` | `gen.arith.number-facts` — the recalled facts, `0 + 1` through `15 − 8`, drawn uniformly from an enumerated closed set. |
| `src/generators/columnOp/` | `gen.arith.column-op` — the column algorithm, add and subtract, with exact regrouping control including across zeros. |
| `src/malrules/` | Sixteen executable buggy procedures, and the classifier. |
| `src/board/` | Reading a column item back out of the public prompt contract, and the **counting-board contrast pair**. |
| `src/graph/` | The graph, and `ladder.test.ts` — one root, everything climbing from it, `activeNodes()` in prerequisite order. |
| `src/render/registry.ts` | Renderer *declarations*. The data behind CG-8. |
| `src/validate/` | The gates and `dw-curriculum check`. Tooling: never imported by a pack. |
| `src/boundary.test.ts` | The pack-consumability boundary, enforced. |

## Three rules that are not negotiable

**Exact arithmetic.** `0.1 + 0.2 !== 0.3` marks correct decimal work wrong
*deterministically*, so no flaky-test detector would ever surface it. Every value
that reaches an answer or a comparison is a `Rational` over BigInt, and gate `M-05`
fails the build on a fractional literal, a `Math.exp`, a `parseFloat` or a
`toFixed` anywhere in this package or in `engine/`.

**Seeded and platform-stable.** The same seed produces the identical exercise on
every device. Never `Math.random`, no `Intl` or `localeCompare` anywhere, no
key-order assumptions. CG-16 commits an output hash for the first 20 seeds of every
level, checks it on macOS and Linux, and scans both packages for locale-dependent
ordering — the one form of drift that regenerating in-process cannot see.

**Structured prompts.** `Exercise.prompt` is a `PromptSpec` — a locale key and
typed slots — never a rendered string. One template translated once serves every
seeded instance for ever, which is what makes five locales affordable across ~160
skills.

## The counting-board contrast pair

`src/board/countingBoard.ts` is the mechanism the product is named for, and it is
library code rather than pack code for the same reason the arithmetic is: the
contradiction is a property of the mathematics. A pack that redrew it its own way
would be free to draw one that does not hold — which has already happened once,
when a digit-wise comparison drew nine empty hundreds sockets on `903 − 778` and
taught a second misconception on the screen meant to repair the first.

Two things a consumer must not get wrong, both tested:

- **The board is drawn for one misconception.** `mis.add.borrow-across-zero`
  declares `contrastRep: "counting-board"`; `mis.add.smaller-from-larger` declares
  nothing and is not LOCATE-capable, because `3797` on `5001 − 2798` is not off by
  a place-value unit at all. Route on the declaration, never on "the answer is
  wrong".
- **`null` means fall back to Stage 1.** A board that cannot be built honestly is
  not built. A LOCATE card showing no contradiction is worse than a strike mark.

## The gates

`dw-curriculum check` reports every gate in GATES.md. Seventeen are implemented;
five print as `pending` with the PR that owns them, because a gate table where an
unimplemented gate reads as green is worse than no table.

Each implemented gate has a failing-case test in `src/validate/gates.test.ts` that
deliberately violates it and asserts it goes red.

Implementation notes where the document and the code differ, all deliberate:

- **CG-10** is worded as "<2% duplicates over 1,000 draws". Two-digit subtraction
  with one regrouping has on the order of 1,600 distinct problems *in total*, so
  1,000 draws from it collide about 20% of the time however good the generator is,
  and the literal gate is unsatisfiable for every grade-1 level. The 1,000 is the
  gate's sample size; a child never sees 1,000 items at one level. So the duplicate
  rate is stated about the run a child does experience — at most one repeat in
  fifty over a 40-item practice run — and the floor follows from it: `S ≥ (n−1)·D/2`,
  which is 975 problems per level. The space itself is estimated from the collisions
  observed, and that estimator is optimistic at high collision rates, so a level
  near the floor deserves a look and CG-9's hard `minVariants` count backs it up.
- **CG-10 does not apply to a closed fact set.** There are thirty-six additions
  within ten and there is no thirty-seventh, so the floor above — which reads a
  repeat as evidence of a shallow generator — would forbid teaching number facts.
  A level that declares `GeneratorBinding.closedFactSet` is measured against that
  number instead: the gate fails when the generator reaches a problem the row says
  does not exist. That is a *sharper* claim than the floor, not a waiver, and it
  is pinned from the other side by `numberFacts.test.ts`, which enumerates each
  level's set from the level's stated rules and asserts the generator reaches
  every member of it and nothing else.
- **CG-12** also checks the *declaration* half of the mal-rule contract: every id in
  a node's `misconceptions` resolves in the registry and belongs to the family the
  node binds, and every diagnosis the node's own items emit as a distractor is
  declared on the node. GATES.md words CG-12 as the ≥95% divergence clause alone;
  without this half the field is unvalidated metadata that repair routing reads.
- **CG-16** carries a third check the other two cannot make: a source scan for
  `localeCompare`, `Intl` and `Collator`. In-process regeneration and two CI runners
  with the same ICU data both agree with themselves; a device is where they stop.
- **An empty lint root fails.** `listSourceFiles` swallows a missing directory, so
  before the move a source-scanning gate handed a root that no longer existed
  scanned zero files, found zero violations and reported **pass** — indistinguishable
  from clean code, and arriving precisely on the commit that relocates the package.
  CG-16, CG-19 and M-05 now fail on an empty root, and `gates.test.ts` asserts both
  that they do and that the roots the CLI ships with are real directories with
  source in them.
- **Incremental mode** is seed-scoped, not diff-scoped. The graph is four nodes; a
  diff scoper today would be untested machinery guarding nothing. PR-4.6 owns it.
- **The full sweep** (`npm run check:full`, 1,000 seeds per level) is a command, not
  a job. CI runs the incremental check.

## Adding a generator family

One family per PR. It needs a `paramSchema` that rejects parameter combinations no
item could satisfy, property tests over thousands of seeds, mal-rules where the
evidence base is real (**never invent a bug**), prompt templates as locale keys, a
renderer declaration for every answer schema it emits, and a committed output hash.
