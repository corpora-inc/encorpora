# Dynawalla: Apprentice of Numbers — Mission

Status: discovery complete, nothing built. See [STATUS.md](STATUS.md).
Index: [README.md](README.md).

> Links to `GATES.md`, `CURRICULUM.md`, `ADAPTIVE_LEARNING.md`, `ARCHITECTURE.md`,
> `EXPERIENCE_DESIGN.md`, `PACK_SYSTEM.md`, `RELEASE_ENGINEERING.md`, `STORE.md` and
> `TEST_STRATEGY.md` resolve once the reference-set PR lands. The two were split so
> neither diff is truncated by the adversarial reviewer; delete this note in the
> follow-up.

## What it is

A mathematics practice product for children, shipping as `inc.corpora.dynawalla` on iOS,
Android and desktop from `dynawalla/` in this monorepo. Tauri 2 + React 19 + Vite,
sharing the native/Rust layer with Corpán and nothing else.

**V1 is proposed at grades 1–5, number and arithmetic**: place value, addition and
subtraction, multiplication, division, fractions, and the equals sign as a relation.
Geometry, measurement, data, ratio, integers, grade 6 and formal pre-algebra are proposed
**out** of V1 because their answer schemas do not exist and "adding geometry" without
them is adding worksheets. That narrows a founder-stated scope, so it is a founder
decision, not the plan's: [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) is
`Proposed — awaiting founder` and everything below is written against the cut as
proposed. No public scope or marketing statement goes out before it is decided.

## The core promise

**When a child gets a problem wrong, the app can often tell them *which step* broke
— and show it, rather than say it.**

That is the whole differentiator. Drill apps with spaced retrieval already exist and
some are good; XtraMath has ESSA Tier IV evidence and its fair criticism is that it
"does not teach mathematical concepts or problem-solving." Dynawalla is aimed at
exactly that gap.

The mechanism is executable mal-rules. A mal-rule is a pure function
`(exercise) => AnswerValue | null` that reproduces a documented buggy procedure. When
a child's wrong answer *equals* a mal-rule's output, we know which procedure they ran.
`5,001 − 2,798 = 3,203` is not a random error; it is `mis.add.borrow-across-zero` — the
child regrouped all the way down and never gave up the thousand — and the response is a
contrast pair on the counting board, where the borrowed thousand is still visibly sitting
in the answer. The child sees the contradiction instead of being told about it. (The
answer `3,797` on the same problem is a *different* rule,
`mis.add.smaller-from-larger`, and gets a different representation. The mapping from rule
to representation is the product, so it has to be exact — see
[CURRICULUM.md](CURRICULUM.md).)

This is scoped honestly. There is no generic "make the contradiction self-evident"
function — fraction addition needs a bar contradiction, magnitude comparison needs a
number line. Roughly 8–12 mal-rules get a genuine contrast representation in V1; every
other one degrades to a faded worked example. Gate CG-22 exists so the count is always
checkable against anything we claim publicly. See [GATES.md](GATES.md).

## Engagement ethics

These are product constraints, not aspirations. Each has an enforcement mechanism.

**We will not:**

- Put a countdown timer on any problem, ever.
- Fail a child for slowness. "Fast" is an internal multiplier only, and a parent
  switch disables every latency-derived reward path (asserted in the harness).
- Escalate celebration on streak or run length. The reaction picker's weight function
  takes no run-length argument — a unit test asserts its signature. Escalation keys on
  `(b_item − θ_s)` (harder problems earn more) and on repairing a misconception you
  used to fire.
- Make being wrong more interesting than being right. `energy(SLIP) < energy(SEAT)` is
  unit-tested, and it is also playtested, because it is a proxy a determined designer
  can satisfy while still making failure the fun part.
- Ship a streak counter, a loss state, play-by-appointment, grinding gates, purchased
  absolution, or social comparison.
- Name a child's defect in learner-facing copy. Mal-rule labels are internal; feedback
  names the correct idea. A lint enforces it.
- Send behavioural data anywhere. All instrumentation is on-device. No third-party
  analytics SDK, no advertising SDK — enforced by a CI dependency audit that is
  cross-checked against the submitted Play Data safety declaration.

**We will:**

- Make progress a building, not a number. Every correct answer places something real,
  and construction **never regresses**. The pull to return is "my observatory is
  unfinished," not "my streak is at risk."
- Give the child a real choice with real consequences: which chamber to build next,
  which biases the scheduler's skill pool toward that instrument's mathematics. The
  child picks their own interleaving and the choice is legible.
- Design stopping points with **equal-weight** "Done" and "Keep going."
- Keep the character rare. It speaks 3–5 times per session, at genuine milestones,
  and says the specific true thing. Silence is the personality.
- Cap the juice. In the largest study to date (N=3,018) both *no* juiciness and
  *extreme* juiciness reduced play time, player experience, intrinsic motivation and
  performance relative to medium/high. Feedback must be contingent, not loud.

The compliance regime makes this partly structural rather than voluntary: Apple's Kids
Category (1.3 / 5.1.4) bars third-party analytics and behavioural advertising, and the
UK Children's Code restricts nudge techniques and using children's data to keep them
on a platform. **The practical consequence is that the feel cannot be A/B tested
remotely.** In-person playtesting is therefore the binding instrument, not a nicety —
which is why [PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md) starts in the bootstrap.

## Locked founder decisions

| # | Decision |
|---|---|
| 1 | Trunk-based development. Worktree → PR → adversarial review → green → squash-merge to `main`. Merges happen constantly. The long-lived integration branch methodology is **deprecated and expunged**; never restore or cite it. |
| 2 | Path-gate every workflow. That is what makes constant merging safe in a monorepo. Dynawalla adds jobs to the existing `ci-gate` aggregate and **never** a fourth required context. |
| 3 | Monorepo, not a separate repo. Dynawalla is a top-level sibling of `corpan/`. |
| 4 | Share the native/Rust/Tauri-plugin layer with Corpán; the frontend may diverge. |
| 5 | The repo is public and open source. No credential, keystore, `.p8`, service-account JSON, issuer id, key id or token is ever committed. |
| 6 | Bundle id `inc.corpora.dynawalla` (note: `inc.` — Corpán is `com.corpora.corpan`, and both conventions now coexist permanently). |
| 7 | Ancient-futurist setting: Byzantine / Persian / Fertile Crescent; astrolabes, gears, automata, mechanical computers. Sourced from al-Jazari's 1206 *Book of Knowledge of Ingenious Mechanical Devices* and the Banū Mūsā's 9th-century *Book of Ingenious Devices*. No steampunk goggles, no gears-as-decoration. |

## Open founder decisions

Eight decisions are the founder's and are not made. Each has an ADR with status
`Proposed — awaiting founder` stating the options and their consequences. Three are on
the critical path: the Kids Category posture is a one-way door that must be decided
before M1's first store submission; the playtest cohort plus a named art director are
people the plan cannot supply for itself; and the V1 scope cut narrows the founder-stated
grade range, so it is not the plan's to ratify. See [DECISIONS.md](DECISIONS.md).

## How this product is graded

[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) is the definition of done. Every item
is objectively verifiable and every item is currently UNMET. The two standing rules
that shape it:

1. **Merged is not done.** This repo has the counterexample: Journey merged
   2026-07-04, released in 0.20.1 on 07-07, and was unreachable by production users
   until 0.20.6 on 07-14 — five releases in seven days to unblock a feature that was
   green and merged. Every product milestone therefore requires a **named person to
   reach the capability from a cold launch on a TestFlight or Play-internal build**.
   "A test asserts it" does not satisfy that criterion.
2. **Playtest gates have kill/revise authority.** They are at M2, M6 and M8. Waiving
   one voids the evidence for everything downstream of it.

## Brand voice

Understated, elegant. Direct, concise, honest. No marketing hype, no AI slop, no
emoji-studded headers, in this repo or in the product. The *proposed* marketing claim is
**"grades 1–5 number and arithmetic"** — not "grades 1–6 mathematics" — and it is
proposed rather than settled because [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) is
the founder's. Whatever sentence is chosen, the code has to be able to back it.
