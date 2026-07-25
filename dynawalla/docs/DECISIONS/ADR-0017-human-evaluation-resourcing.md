# ADR-0017 — Human evaluation resourcing

**Status:** Proposed — awaiting founder
**Recruitment starts now. Consent has weeks of lead time.**

## Context

Two gates in this program require people the plan cannot supply for itself. Both have
kill/revise authority over milestones. Neither has a substitute instrument.

**(a) A child playtest cohort.** 6+ children aged 7–11, including at least 2 who dislike
math, with documented parental consent under COPPA and the UK Children's Code. Gates at
M2, M6 and M8 (`T-01`..`T-06`).

**(b) A named human art director.** Their sign-off on the committed M6 screenshots is an
exit criterion (`Q-14`).

## Why there is no alternative instrument

For (a): Apple's Kids Category (1.3 / 5.1.4) bars third-party analytics and behavioural
advertising, and the UK Children's Code restricts nudge techniques and using children's
data to keep them on a platform. **The feel therefore cannot be A/B tested remotely.**
Scheduled in-person playtesting is the binding constraint, not an oversight. Without it,
every judgement about pacing, reaction budgets, the difficulty target and "wrong must not
be more fun than right" reverts to a claim about children that a simulator the team wrote
cannot falsify.

For (b): the art direction has the highest slop risk in the program — procedural girih
plus a brass-and-lapis palette is precisely the recipe that renders as a gradient
dashboard with gear icons — and **code review cannot see it**. The committed-screenshot
gate exists so the images can be reviewed as images, but that only works if someone who
can see it is accountable for the verdict.

## What the founder must supply

1. Access to a cohort meeting the [PLAYTEST-PROTOCOL.md](../PLAYTEST-PROTOCOL.md)
   definition, with consent forms returned before the first M2 session. Recruitment
   begins in the bootstrap PR because consent takes weeks, not days.
2. A named art director, and their commitment to review three screenshot sets (M6, plus
   any subsequent art PR that changes the palette or the world vocabulary).
3. A named owner for the nightly simulation harness with a paging path (`A-19`).

## Consequences of not supplying them

- Without (a), the product's core claim is untested at every gate and there is no legal
  path to testing it remotely. The honest response is to say so publicly rather than to
  claim evidence the program does not have.
- Without (b), the highest-slop-risk surface ships unreviewed by anyone who can see it,
  and `Q-14` has no mitigation at all ([RISKS.md](../RISKS.md) R-32).
- Without a nightly harness owner, an unwatched nightly is a gate that silently stops
  gating.

These are the three items most likely to be quietly waived. Waiving them does not save
time; it converts measured claims into unmeasured ones.
