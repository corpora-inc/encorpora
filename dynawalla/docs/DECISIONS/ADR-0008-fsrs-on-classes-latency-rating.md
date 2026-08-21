# ADR-0008 — FSRS keyed on skill classes, rated on correctness **and** latency

**Status:** Accepted

## Context

Layer F of the learner model schedules the bounded set of ~180 enumerable arithmetic
facts (addition and subtraction within 20, the multiplication and division tables) with
FSRS-6.

Two implementation choices look obvious and are both wrong.

**Keying.** Corpán's spaced-repetition usage keys cards on item ids. Dynawalla's
exercises are *generated* and have no stable id — `exerciseId` embeds a seed. Reusing
per-item keys would mint a new card for every generated instance, so nothing would ever
come up for review. Spaced repetition would degenerate into random practice, invisibly,
for months.

**Rating.** FSRS grades are normally derived from correctness. But grades 1–3 *are* the
transition from computing to recalling. A child who works out `7 + 8` on their fingers in
nine seconds and a child who recalls it in one second are both "correct," and scheduling
them identically models a construct the child does not have.

## Decision

1. **Cards are keyed on classes, never instances:** `skill:<id>#L<level>#<formId>`.
2. **The FSRS rating is a function of `(correct, latency)`**: fast-correct → Good/Easy;
   **slow-correct → Hard, and the interval does not grow past a cap**; incorrect →
   Again.
3. **Card creation is gated on the fluency signal `φ_s`.** Facts a child still *computes*
   stay in the Layer-S fluency-burst pool and never enter the FSRS pool.
4. FSRS-6 is used through a **one-file `Scheduler` seam** over the vendored library,
   with a test pinning the 21 default weights so a library upgrade fails loudly rather
   than silently rescheduling every child.

## Consequences

- Layer S (`θ_s` = can do it) and `φ_s` (does it without counting) remain separate
  signals, and **no skill promotion is ever denied on latency alone** (`A-05`).
- A dedicated persona, **accurate-counter-on** (high `θ`, low `φ` across all facts),
  gates that the system never accumulates long-interval fact cards for a child who is
  still counting (`A-03`). This failure is invisible in the healthy-looking direction:
  the child appears to be doing fine right up until the intervals are too long to
  recover from.
- FSRS is applied to facts **only**. `34 + 29` is computed, not recalled; scheduling it
  as a memory item is a category error. Alternatives considered and rejected: BKT (needs
  per-skill fitting we cannot do, has confirmed semantic degeneracy, and over-predicts
  collapse after a single failure — structurally punitive, which is disqualifying for
  children), DKT/SAKT (no corpus, ships a model artifact, cannot answer "why this
  exercise"), full IRT calibration (needs ~200 responses per item; undefined with zero
  users and infinitely many generated items), and SM-2/Leitner (FSRS-6 dominates SM-2 on
  the open benchmark; Leitner gives no retrievability estimate).
