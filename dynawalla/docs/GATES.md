# Dynawalla — Gates

Two families of automated gate. **CG-series** validate the curriculum, its generators and
its renderers. **EG-series** validate the engine against simulated and real learners.

**Gate ids are `CG-`/`EG-` prefixed on purpose.** Acceptance criteria use bare `C-NN` and
`G-NN` for the CI/CD and governance sections, and an earlier draft distinguished the two
families only by zero-padding — which is not a distinction any script or reader can be
trusted to hold. A `CG-`/`EG-` id is always a gate in this file; a bare `C-`/`G-` id is
always an item in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

The first draft's table had one identifier naming two different gates, four identifiers
naming nothing, and three defined gates with no implementing PR. This table is the
corrected one: **CG-1..CG-22 with no holes, one owning PR each, and a failing-case test per
gate.** `M-13` asserts none is orphaned.

Published before M4's first curriculum PR.

---

## CG-series — curriculum

| Gate | What it checks | Owner PR |
|---|---|---|
| **CG-1** | Id hygiene and immutability — no shipped `active` id removed or re-pointed | PR-4.2 |
| **CG-2** | Acyclic `requires ∪ extends`, by Kahn topological sort, **printing the actual cycle** | PR-4.2 |
| **CG-3** | Edge integrity — targets exist, edge kinds valid | PR-4.2 |
| **CG-4** | Two-way reachability — unreachable node = error, dead-end = warn | PR-4.2 |
| **CG-5** | Grade sanity — `prereq.nominal ≤ node.nominal` | PR-4.2 |
| **CG-6** | **Capability flow** — `provides` on skills, `consumes` on bindings; the only mechanically sound *missing-edge* detector, and it suggests the edge | PR-4.5 |
| **CG-7** | **Bidirectional generator ownership** — merge blocker | PR-4.3 |
| **CG-8** | **Renderer ownership** — merge blocker | PR-4.4 |
| **CG-9** | Level coverage by **running** generators over N seeds, ≥`minVariants` distinct | PR-4.6 |
| **CG-10** | Variant-space adequacy — <2% duplicates over 1,000 draws | PR-4.6 |
| **CG-11** | Self-consistency — the family's own checker accepts `canonical` and every `alsoAccept`, and rejects every distractor, over 1,000 seeds; and every generated item's `AnswerSchema` passes `schemaDefect` | PR-4.6 |
| **CG-12** | Mal-rule fidelity — ≥95% divergence from the correct answer | PR-8.1 |
| **CG-13** | **Choice-laundering ban** — no `conceptual`/`reasoning` skill binds a choice-only generator | PR-4.4 |
| **CG-14** | **Locale round-trip** — every `canonical`/`alsoAccept` survives format→parse in all launch locales; every count slot declares its CLDR plural set | PR-4.7 |
| **CG-15** | Grade-band coverage matrix (grade × domain) — empty cell is an error at release, a warning in draft | PR-7.19 |
| **CG-16** | Determinism + committed output-hash snapshots on **macOS and Linux**; changed output without a `familyRev` bump is an error | PR-4.6 |
| **CG-17** | Performance — `generate()` p95 <5 ms, p99 <20 ms | PR-4.6 |
| **CG-18** | **Accessibility** — every representation has a text alternative; nothing solvable by colour alone | PR-4.4 |
| **CG-19** | i18n completeness, plus a lint that no `Exercise.prompt` is a bare string | PR-4.7 |
| **CG-20** | Standards traceback — **report-only, never blocking** | PR-7.19 |
| **CG-21** | Word-problem context sets populated per locale for every active word family | PR-7.18 |
| **CG-22** | **LOCATE capability** — a mal-rule may be tagged LOCATE-capable only if it has a bound contrast representation | PR-8.3 |

### The four that carry the most weight

**CG-7 — generator ownership.** A curriculum row without a working generator cannot reach
`status: active`. Draft nodes are allowed but are excluded from the shipped graph and
from all coverage math. Without this, the graph becomes a wish list.

**CG-8 — renderer ownership.** A skill cannot go `active` unless its generator's
`AnswerSchema` kind **and every `representations.required` RepId** has a registered,
tested renderer. This is the gate the first draft was missing entirely: a generator can
emit a perfectly valid `Exercise` that the app cannot draw.

**CG-13 — choice-laundering ban.** CG-7 and CG-8 are both trivially satisfiable by making
everything multiple choice. CG-13 is what stops "Which of these is a line of symmetry?
A B C D" from counting as geometry coverage. It is the mechanical form of
[ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) and without it the scope cut is a
promise rather than a constraint.

**CG-16 — determinism.** Generators run in a WebView on iOS, Android and desktop. Any
`Math.random`, any `Intl` inside generation, or any key-order assumption produces
different exercises per device and makes a bug report irreproducible. Snapshots are
committed and checked on both runners. Note the residual: CG-16 does not run in a real
Android WebView, so a device spot-check belongs in the M7 device pass.

### Failing-case tests

Every gate ships with a test that **deliberately violates it** and asserts the gate goes
red. A gate with no failing-case test is indistinguishable from a gate that silently
passes everything, and this program has an in-repo precedent for exactly that failure
mode (the pack-shared directory that sets a filter true and is then skipped by the job
that consumes it).

### Runtime and where each gate runs

CG-9/10/11/12 over 160 skills × 4 levels × 1,000 seeds is roughly 640k `generate()` calls
— far too slow to run per PR.

| Mode | Scope | Where |
|---|---|---|
| **Incremental** | Diff-scoped: only the families and nodes the PR touches, plus their dependents | `dynawalla-curriculum` job in `ci-gate.needs`, on `pull_request` and `merge_group`. Must complete in <90 s (acceptance item `C-20`). |
| **Full sweep** | The entire graph, all gates | Nightly, with a **named owner** who is paged on failure. |

Both from day one. Retrofitting incremental mode after the graph is large is how a
validator becomes a thing people skip.

---

## EG-series — engine

Run by the simulation harness. See [ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md).

| Gate | What it checks | Owner PR |
|---|---|---|
| **EG-1** | Engine purity — no IO, no DOM, no `Date.now`, no `Math.random` reachable from `engine/` | PR-5.1 |
| **EG-2** | Determinism — identical seed yields byte-identical transcripts across two runs and across macOS and Linux | PR-5.1 |
| **EG-3** | State size — <100 KB per learner after 500 simulated sessions, every persona | PR-5.2 |
| **EG-4** | Performance — `nextExercises(8)` p99 <5 ms, `applyResult` p99 <1 ms | PR-5.2 |
| **EG-5** | **Calibration** — reliability diagram within ±0.06 per 0.05 bin over ≥200 items, against the **misspecified** personas and against the M2 real-child residual fixture | PR-5.4 |
| **EG-6** | Scheduler invariants — every anti-frustration and anti-stagnation rule as its own named test | PR-5.6 |
| **EG-7** | Controller stability — over any 50-item window, per-item `\|ΔpTarget\|` under bound, sign alternating ≤ N times | PR-5.6 |
| **EG-8** | Persona outcome gates — see the mapping below | PR-5.10 |
| **EG-9** | Diagnosis quality — bug recall ≥0.85 within 6 firings; false-positive rate <0.05 on bug-free personas; `\|Δθ\| < 0.2` on untouched skills | PR-8.10 |
| **EG-10** | Trace fidelity — golden transcripts assert on `SelectionTrace`, produced by the same code path that made the decision | PR-5.9 |

**EG-5 lands before the scheduler, deliberately.** Everything downstream measures the
wrong thing if `b()` is not real, and against a self-consistent simulator EG-5 would pass
by construction and tell you nothing.

### EG-8 — which persona maps to which acceptance item

There are **eleven** personas: ten behavioural plus one misspecification persona
([ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md)). Six have an acceptance-level pass
condition; the other five are covered by other gates, and EG-8 does not invent one for
them.

| Persona | Pass condition |
|---|---|
| `accurate-counter-on` | `A-03` |
| `pure-guesser` | `A-04` |
| `slow-accurate` | `A-05` |
| `fast-careless` | `A-06` |
| `fatiguer` | `A-07` |
| `struggling` | `A-08` |
| `steady-strong`, `returning-lapser`, `rapid-improver` | no EG-8 condition — covered by EG-5 calibration and EG-6 invariants |
| `single-misconception` | no EG-8 condition — covered by EG-9 |
| misspecification | no EG-8 condition — it is EG-5's instrument, not an outcome persona |

### Every EG-gate is labelled

**REGRESSION BOUND** — the threshold is derived from a pilot run and exists to catch
drift. **PEDAGOGICAL ASSERTION** — the threshold is derived from theory and a violation
means the behaviour is wrong, not that the bound is tight.

This labelling is not bureaucracy. Corpán set 11 ship gates of which three were
mathematically unsatisfiable under any scheduler, because the synthetic learner had
**fixed ability**; it cost two full calibration rounds and a spec amendment to discover.
When a gate fails, the label tells you whether to fix the code or to question the bound —
and "a different marginal leg fails on each seed" is treated as a **FAIL**, not as noise.

### PR versus nightly

| Mode | Scope | Runtime |
|---|---|---|
| PR smoke | 3 personas × 20 learners | seconds |
| Nightly | 10 behavioural personas × 100 children × 3 seeds, plus the misspecification persona in the EG-5 set only | 30–80 minutes |

The nightly job has a named owner and a paging path (`A-19`). An unwatched nightly is a
gate that silently stops gating.
