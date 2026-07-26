# Dynawalla — Test strategy

What is tested where, what each layer can and cannot tell us, and the four things no
test in this program will ever establish.

Automated curriculum and engine gates are enumerated in [GATES.md](GATES.md); this
document is the surrounding strategy.

## Runner

`node --experimental-strip-types --test`, Node 24, pinned via `.nvmrc` and `engines`.
**No vitest.** This matches the Corpán app's zero-dependency runner and avoids the
version-drift class of failure documented in RISKS R-41 — the repo already spans Node 20,
22 and 24, and `--experimental-strip-types` behaves differently across those majors, so a
job on the wrong Node fails in ways that look like code bugs.

## Layers

### 1. Unit and property tests — the bulk

Everything pure lives in `curriculum/` and `engine/`, both importable without building
Tauri. That is the point of their placement.

Property tests carry most of the weight for generators: seeded purity, exact-arithmetic
correctness, checker self-consistency, and variant adequacy are all statements over
1,000 seeds rather than over three examples.

**Named invariant tests.** Every scheduler invariant in
[ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md) is its own test with a name that matches the
invariant's wording (`A-13`). CI checks the mapping is one-to-one, so an invariant cannot
be deleted from the code without a test disappearing loudly.

### 2. Boundary tests — architecture as a build failure

A static AST test fails the build if anything under `src/reactions/` or `src/world/`
imports from `src/work/` or `engine/` (`Q-05`), and a second asserts `engine/` reaches no
IO, no DOM, no `Date.now` and no `Math.random`.

Two more of the same shape, both guarding a specific past mistake:

- **No schema exposes `canonical.length` to the input layer.** Auto-submit keyed off
  digit count silently tells a child how many digits the answer has.
- **The reaction weight function's signature takes no run-length or streak argument.**
  The registry being ported escalates on combo count; the signature test is what stops it
  coming back by copy-paste.

### 3. Golden transcripts

Fixed seed, fixed persona, fixed expected sequence — asserted on the `SelectionTrace`
rather than on the rendered output, so the explanation can never drift from the
behaviour.

Golden files are committed. A diff in a golden file is a **review artifact**: the PR must
say why the behaviour changed.

### 4. Determinism snapshots on two operating systems

Generator output hashes are committed and checked on **macOS and Linux** CI (CG-16).
Changed output without a `familyRev` bump is an error, because a silently changed
generator invalidates every committed golden transcript and every bug report.

### 5. The simulation harness

Nightly, 10 behavioural personas × 100 children × 3 seeds (plus the misspecification
persona in the EG-5 set), 30–80 minutes, with a named owner and a
paging path. PRs run a 3-persona × 20-learner smoke. See
[ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md) for why the personas are deliberately
misspecified relative to the engine's belief model.

### 6. Rendered-output review

Committed screenshots at 0 / 50 / 200 / 500 placed elements, all five reaction tiers, at
320 px / 768 px / iPad, light and dark, reduced-motion on and off. **The images are
reviewed in the PR, not the code** (`Q-14`).

This is a test in the sense that matters: it produces an artifact a human can be wrong
about in public.

### 7. Device passes

Every product milestone requires a named person to reach the capability from a **cold
launch on a TestFlight or Play-internal build** — the `[device]` items in
[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

This exists because this repo has the counterexample: a feature merged 2026-07-04 and was
unreachable by production users until 2026-07-14, across five releases, while every check
was green the entire time. **Merged is not done.**

On-device measurement is not optional either: p95 machine-side contribution, `generate()`
p95, live SVG node count and frame rate are all measured on the Galaxy Tab A9 (4 GB), not
on a development laptop.

### 8. Playtests

[PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md). Gates at M2, M6, M8, each with kill/revise
authority.

## What tests cannot tell us

Stated explicitly, because the failure mode of a heavily-gated program is believing the
gates cover everything.

1. **Whether it is any good.** No automated check distinguishes a compelling loop from a
   competently-built drill. Only a real child can, compliance forbids the remote
   alternative, and the program has exactly one child evaluator
   ([ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md)). So this is not merely
   untested by the harness — it is observed at `n = 1`, which detects a loop that fails
   and cannot establish that one succeeds.
2. **Whether it looks right.** Code review cannot see that the observatory renders as a
   gradient dashboard with gear icons. The screenshot gate plus the art director's
   sign-off is the entire instrument, and the art director is the founder — so the
   three-strangers verbatims are the only outside eyes on it.
3. **Whether a wrong answer was diagnosed usefully.** Bug recall on a synthetic persona
   measures whether the matcher fires; it says nothing about whether the child understood
   the contrast pair. `T-05` is the measurement.
4. **Whether a native change is safe.** `cargo check` proves nothing about
   signal-handler chaining, and both `[patch]` regressions in
   [ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md) compile, test
   and clippy **clean**. That is why the `cargo metadata` assertions and the device
   tombstone check exist as separate instruments.

## Two anti-patterns this program specifically forbids

**A bypass hook or an over-generous mock proves nothing about the device path.** A
sibling product in this repo had a quest that no child could finish, with every harness
green, because the mock host reported a capability the device did not have and every
proof used a bypass hook. If a test path can skip the thing being tested, it is not
evidence.

**Do not blame the build.** When a gate goes red, the default hypothesis is that the
change is wrong, not that the gate is flaky. If a gate genuinely produces false
positives, fix the gate in its own PR — do not disable it and do not merge around it.
