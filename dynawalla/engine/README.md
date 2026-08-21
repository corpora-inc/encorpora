# `@dynawalla/engine`

The learner model. Pure TypeScript: no IO, no DOM, no clock, no randomness, and no
import from the app or from the curriculum — `src/boundary.test.ts` fails the build
if any of that stops being true (gate EG-1).

Specification: [`../docs/ADAPTIVE_LEARNING.md`](../docs/ADAPTIVE_LEARNING.md),
[`../docs/GATES.md`](../docs/GATES.md),
[ADR-0008](../docs/DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md).

```
npm test                      # unit + invariant tests, plus the PR harness smoke
npm run tsc                   # typecheck
npm run harness               # the PR smoke, with the labelled report printed
npm run harness:pilot         # 10 personas x 12 children x 3 seeds x 180 days
npm run harness:nightly       # 10 personas x 100 children x 3 seeds (30-80 min)
```

## Three layers

| Layer | File | What it holds |
|---|---|---|
| **S** — skill proficiency | `skill.ts` | `P = c + (1−c)·σ(θ−b)`, `θ += U(n)·w·(y′−P)`, asymmetric credit, 0.15× prerequisite propagation, mastery. |
| **F** — fact memory | `facts.ts` | The card key, the `(correct, latency) → rating` rule, the latency model, and the `FactScheduler` seam FSRS-6 lands behind. |
| **B** — misconceptions | `bugs.ts` | `β ← 0.9·β + 1{fired}`, active at 2.2, and the slip-versus-misconception discrimination. |

`controller.ts` holds the per-item `pTarget` controller. `scheduler.ts` holds the
seam and every anti-frustration and anti-stagnation invariant as a checkable
function; `select.ts` is the policy that has to satisfy them, `apply.ts` is the
answer path where the three layers meet, `catalog.ts` is the curriculum's shape
as data, and `learner.ts` creates a learner and writes one down.

`fsrs.ts` is FSRS-6 behind the `FactScheduler` seam, with its twenty-one weights
pinned by value and by checksum so a library upgrade fails loudly.

`harness/` is the simulation: a seventy-two-skill synthetic curriculum, eleven
personas answering from a **misspecified** 3PL, and the EG-series gates as
functions over the transcripts they produce. It is not exported from `index.ts`
— nothing in the app may reach it.

## No floats, at all

`math/fixed.ts` is an integer count of millionths and `math/logistic.ts` computes σ
and `e^-x` in BigInt. Two independent reasons: acceptance item `M-05` bans
floating-point arithmetic in this package outright, and gate EG-2 requires
identical seeds to produce **byte-identical transcripts across macOS and Linux**,
which float accumulation order quietly breaks.

`logistic.test.ts` checks the output against published values of σ, so the
implementation is measured against the mathematics rather than against itself.

## What is deliberately not here

Stage 3 RECONSTRUCT's faded worked examples, and Developer Mode's user interface.
The engine produces the `SelectionTrace` those need; drawing it is the app's.

## Where the documents disagree with themselves

Three conflicts were found by running this, not by reading it. Each is recorded
at the line of code that resolves it and pinned by a test:

- **The cold-start seed and the cold-start floor.** `θ = b̄ − 0.4` caps a first
  card at `σ(−0.4) = 0.40`; "no card in the first 20 below `P̂ = 0.55`" asks for
  more. The seed yields — `learner.ts`.
- **`A-01`'s ±0.06 calibration and the ×0.7 asymmetric credit.** The credit rule
  makes `θ` a biased estimator with fixed point `P* = q/(0.7 + 0.3q)`; at 72%
  realised accuracy that is already a 0.064 over-prediction. Measured with the
  asymmetry removed, the worst bin error falls from −0.117 to −0.054 —
  `harness/harness.test.ts`.
- **`A-08`'s "never a 5-item window below 0.40"**, stated as an outcome. At the
  0.75 accuracy the same item demands, three or more errors in five consecutive
  answers has probability 0.104; over a 180-day run it is certain. The
  *schedulable* form of the rule is checked instead — `harness/gates.ts`.

Constants that the documents pin are traced to them in `constants.ts`. Constants
that the documents leave open are marked **PROVISIONAL** in the same file. When a
gate fails, that label is what tells you whether to fix the code or to question the
number.
