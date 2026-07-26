# `@dynawalla/engine`

The learner model. Pure TypeScript: no IO, no DOM, no clock, no randomness, and no
import from the app or from the curriculum — `src/boundary.test.ts` fails the build
if any of that stops being true (gate EG-1).

Specification: [`../docs/ADAPTIVE_LEARNING.md`](../docs/ADAPTIVE_LEARNING.md),
[`../docs/GATES.md`](../docs/GATES.md),
[ADR-0008](../docs/DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md).

```
npm test        # unit + invariant tests
npm run tsc     # typecheck
```

## Three layers

| Layer | File | What it holds |
|---|---|---|
| **S** — skill proficiency | `skill.ts` | `P = c + (1−c)·σ(θ−b)`, `θ += U(n)·w·(y′−P)`, asymmetric credit, 0.15× prerequisite propagation, mastery. |
| **F** — fact memory | `facts.ts` | The card key, the `(correct, latency) → rating` rule, the latency model, and the `FactScheduler` seam FSRS-6 lands behind. |
| **B** — misconceptions | `bugs.ts` | `β ← 0.9·β + 1{fired}`, active at 2.2, and the slip-versus-misconception discrimination. |

`controller.ts` holds the per-item `pTarget` controller; `scheduler.ts` holds the
seam the selection policy will implement, plus every anti-frustration and
anti-stagnation invariant as a checkable function.

## No floats, at all

`math/fixed.ts` is an integer count of millionths and `math/logistic.ts` computes σ
and `e^-x` in BigInt. Two independent reasons: acceptance item `M-05` bans
floating-point arithmetic in this package outright, and gate EG-2 requires
identical seeds to produce **byte-identical transcripts across macOS and Linux**,
which float accumulation order quietly breaks.

`logistic.test.ts` checks the output against published values of σ, so the
implementation is measured against the mathematics rather than against itself.

## What is deliberately not here

The selection policy (PR-5.6), the FSRS-6 implementation behind the seam (PR-5.5),
and the simulation harness (PR-5.3). What is here is the data model, the update
rules the documents pin down, and the invariants — expressed as functions so that
gate EG-6 can require every one of them to be its own named test.

Constants that the documents pin are traced to them in `constants.ts`. Constants
that the documents leave open are marked **PROVISIONAL** in the same file. When a
gate fails, that label is what tells you whether to fix the code or to question the
number.
