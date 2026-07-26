# ADR-0001 — Apple Kids Category and Play under-13 target audience

**Status:** Proposed — awaiting founder
**Deadline:** must be Accepted **before M1's first store submission** (`G-01`)

## Context

Apple Guideline 1.3 states that an app placed in the Kids Category must "continue to
meet these guidelines in subsequent updates, **even if you decide to deselect the
category**." It is a one-way door. Google Play's target-audience declaration carries the
Families Policy with it.

The engineering plan already assumes the strict posture regardless: on-device-only
instrumentation, no third-party analytics or advertising SDKs, and a parental-gate
primitive in M1's shell. So the strict posture is being built either way.

## Options

**A. In — Kids Category (Apple) + under-13 target audience (Play).**
Requires an age band (5-and-under / 6-8 / 9-11), parental gates on every link-out and
purchase, and permanently forbids third-party analytics and behavioural advertising.
Gains Kids Category discovery and Play's Teacher Approved eligibility. Costs nothing
extra over the plan as written.

**B. Out — Education category with an honest 4+ rating.**
Keeps options open (a future analytics SDK, a future ad-supported tier) and forfeits the
Kids Category discovery surface. This is the option that would let the engineering
constraints relax; nothing in the plan currently depends on that relaxation.

## Consequences

- **A** locks the constraint set forever, including through any future pivot, and makes
  `G-05`/`G-06` permanent product invariants rather than V1 choices.
- **B** requires an explicit decision about what would then be permitted, otherwise it
  is strictly worse than A: all of the cost, none of the discovery.
- Either way the age band or content rating must be consistent with actual behaviour and
  with the CI dependency audit (`G-07`).

## Notes for whoever decides

Do not let this be decided implicitly by a store submission. Submitting M1's build
without a recorded decision **is** choosing, and it is the branch that cannot be undone.
