# ADR-0017 — Human evaluation resourcing

**Status:** Accepted — 2026-07-25
**Supersedes the recruitment plan this ADR originally proposed.**

## Context

Two things in this program cannot be decided by a test: whether the loop is any good,
and whether the art looks right. The first draft of this ADR answered that by specifying
an external instrument — 6+ children aged 7–11 including at least 2 who dislike math,
documented parental consent under COPPA and the UK Children's Code, and a separately
named human art director whose sign-off gated M6.

That was the plan over-specifying. Nobody had committed to supplying any of it, the
lead time was quoted in weeks, and a gate that depends on a cohort nobody is recruiting
is a gate that gets waived at the first schedule squeeze — which is worse than a smaller
gate honestly described.

## Decision

The founder corrected the resourcing directly:

> "I am the art director and any other adult needed and my 10 year old son will play any
> 6+ children needed."

Recorded as decided:

1. **The child evaluator is the founder's son, age 10.** One child. There is no
   external cohort, no recruitment, and no recruitment lead time on any milestone.
2. **Consent is parental consent, given by the founder, who is the parent.** No forms,
   no counsel review of a template, no COPPA/Children's-Code participant paperwork. The
   data-handling rules in [PLAYTEST-PROTOCOL.md](../PLAYTEST-PROTOCOL.md) §2 still apply
   and are stricter than the regulation, for a different reason: this repository is
   public.
3. **The founder holds every adult role the protocol calls for** — art director and
   design authority, observer, product owner, and QA. `Q-14`'s "named art director" is
   the founder. There is no second sign-off to wait for.
4. **What is measured does not change.** Time to voluntary quit, unprompted verbatims,
   next-day voluntary return, where the child gets stuck, and what the child skips are
   the same five signals the external protocol specified. They survive a sample of one;
   the inferences drawn from them do not, which is the subject of the next section.

## What this instrument can and cannot tell us

Stating this plainly is the point of the ADR. Direct observation of a real child using
the real build on a real device is the highest-signal instrument available to this
program, and it is enormously better than none — a simulator the team wrote cannot
falsify a claim about children. It is also one child, in one household, observed by the
parent who is building the product. Both halves are true.

**It can tell us:**

- Whether the loop holds one real child's attention without an adult driving it, and for
  how long, by the clock rather than by opinion.
- Whether the LOCATE contrast pair is *legible* — whether a child who gets one wrong can
  see what the app is showing them, or asks what it means.
- Where the interface breaks: what gets mis-tapped, what gets skipped, what prompts a
  question, what is quietly abandoned.
- Whether the child comes back the next day without being asked. In a household the
  device is present every day, so this is measured under natural conditions rather than
  simulated by leaving a loaner tablet behind.
- Longitudinally: the same child at M2, M6 and M8, with no attrition risk. Cohort
  retention was a listed hazard of the external plan and it does not exist here.

**It cannot tell us:**

- Anything generalizable about engagement. n = 1 supports no rate, no proportion, and no
  comparison against a population.
- Anything about efficacy. No claim of learning gain may cite these sessions.
- Anything the child is biased toward. He knows who built it and he wants the adult to
  be pleased. Verbal praise is therefore the least trustworthy datum this instrument
  produces, and [PLAYTEST-PROTOCOL.md](../PLAYTEST-PROTOCOL.md) §5 forbids using it as
  gate evidence; behavioural signals (quit time, return, what he does after a wrong
  answer) are weighted because they are harder to give away to please someone.
- Anything about accessibility needs nobody in the household has — low vision, motor
  impairment, and screen-reader use are covered by `Q-09`/`Q-10` and by device testing,
  not by this.
- Anything about the grade 1–2 end of the curriculum. See below.

## The age asymmetry, which is half good news

A 10-year-old is roughly grade 4–5.

**Covered, and this matters more than it might look:** V1's vertical slice is subtraction
with regrouping across zero, and the LOCATE contrast pair built on it. That is squarely
in this child's range. The highest-uncertainty, highest-risk, thesis-carrying content in
V1 is directly observable by the one evaluator the program has. The instrument is small
but it is pointed at the right thing.

**Not covered:** the grade 1–2 end — early counting, number formation, first
addition and subtraction facts — and specifically **every flow that assumes a child who
cannot yet read the interface**. Pre-reader UX is the named blind area: icon-only
affordances, audio-first instruction, read-aloud as the primary input path rather than an
accessibility fallback, and touch targets sized for smaller hands. M2 argues read-aloud
forward from M9 on a pre-reading child's behalf, and no pre-reading child will see it.

Options, none of which are the plan's to pick:

- **(a) Accept it.** Ship grades 1–2 on design heuristics plus the adaptive engine's
  placement, which keeps a young learner out of content they cannot attempt. Cheapest;
  leaves the least-observed content in the hands of the least-experienced users.
- **(b) Narrow the advertised band** to what can actually be observed. Honest, entirely
  within the program's control, and it interacts with
  [ADR-0002](ADR-0002-v1-scope-cut.md), which is also open. It discards real curriculum
  work and removes read-aloud's whole justification for landing at M2.
- **(c) One additional younger evaluator, later.** Not a cohort — one child, aged
  roughly 6–7, for one session before M9's accessibility and i18n fill. This is the only
  option that converts the blind area into an observed one, and it is a much smaller ask
  than the cohort this ADR just deleted.

**Recommendation: (c), with (a) as the interim posture and (b) as the fallback with a
trigger.** Treat grade 1–2 flows as unobserved until a younger evaluator sees them, say
so rather than implying coverage we do not have, and if no younger evaluator has played
by M9, narrow the advertised band to the range that was observed instead of shipping a
claim with nothing behind it. **This is the founder's call and he has not made it.**

## Consequences

- Three gates (`T-01`, `T-04`, `T-05`) become single-child observations. Their pass
  conditions are rewritten in [ACCEPTANCE_CRITERIA.md](../ACCEPTANCE_CRITERIA.md) as
  per-child observations with recorded verdicts, not as counts of children. **They still
  cannot be waived** (`T-06`) — a small instrument that runs beats a large one that does
  not.
- `T-03`'s real-child residual fit is directional only. One child's response data cannot
  calibrate `b()`; it can only show a gross mismatch. The engine's difficulty model
  therefore leans harder on the misspecified-persona harness than the original plan
  assumed, and [RISKS.md](../RISKS.md) R-26 is updated to say so rather than to keep
  citing a real-child anchor that no longer carries that weight.
- `Q-11` — a pre-reading child completing a session on read-aloud alone — **has no
  instrument.** It is rewritten as an adult-proxy device check, which verifies the
  capability and explicitly does not evidence the child claim.
- `Q-14`'s art-director sign-off is the founder's and can happen the same day. The
  three-strangers screenshot test is unaffected: those are adults, not participants, and
  need no consent regime.
- The program loses its excuse. There is no recruitment to wait for, so a missing
  playtest report at M2, M6 or M8 is a choice, not a resourcing failure.
