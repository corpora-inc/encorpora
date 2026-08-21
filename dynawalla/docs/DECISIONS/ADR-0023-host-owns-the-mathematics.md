# ADR-0023 — The host owns the mathematics; packs own the games

**Status:** accepted
**Date:** 2026-07-26
**Amends:** ADR-0022 (the host ships no content), ADR-0020, ADR-0021

## Context

ADR-0022 stripped the host to a shell and put *everything* in packs, including
the curriculum. `src/work/` was deleted, `boundary.test.ts` grew a guard that
fails the build if anything under `dynawalla-app/src/` imports the curriculum,
and the front door became the pack list.

The pack contract that shipped alongside it says something different, and says
it in the wire protocol rather than in prose:

- `items.next` returns a question and **does not carry the answer**.
- `items.answer` records the attempt and **then** returns the canonical value.
- `items.reveal` is a separately declared capability, visible to the parent,
  for the narrow case of a game that must place the correct target before the
  child reaches it.

That design exists for one reason, and it is the reason this is a mathematics
product rather than a toy: *a game cannot be beaten by fiddling with the game*,
because the thing that decides whether a child was right is not inside it.

The two cannot both be true. A host with no arithmetic cannot answer
`items.next`, cannot judge `items.answer`, and cannot produce a mal-rule
distractor — so `HostServices` would be unimplementable, the `items` capability
would be dead, and every pack would end up carrying its own generator and its
own judge. That is precisely the outcome the protocol was designed to prevent,
and it would arrive by omission rather than by decision.

FUSE and SIEGE both landed on trunk with stub hosts that generated and judged
their own questions. Two packs, two arithmetics, two sets of mal-rules. At a
hundred packs that is a hundred.

## Decision

The split is not "content in packs, nothing in the host". It is:

- **Packs own every game, world, screen, asset and sound.** All of it. The host
  ships no exercise surface, no keypad, no worksheet. `src/work/` stays deleted.
- **The host owns the mathematics**: which item a child is served, and whether
  the answer was right. One curriculum, one judge, one set of mal-rules, for
  every pack that will ever be installed.

Concretely:

- `dynawalla-app/src/packs/items.ts` is the item service — the ladder, the
  ledger, and the judgement. It is built on `packs/shared/curriculum`.
- `dynawalla-app/src/packs/curriculum.ts` is the only module that names the
  curriculum. Everything else in the host reaches it through that one page.
- `boundary.test.ts` keeps its guard and gains a second measured exemption
  beside the SDK contract, with two properties asserted about it: the
  curriculum re-exports nothing outside its own package, and it touches no DOM.
  `dynawalla/curriculum/` and `dynawalla/engine/` remain out of bounds.
- Exactly two host modules may name an exercise. The list is asserted, not
  described.

## Consequences

**Good.** The `items` capability becomes real: a pack asks for a question, draws
it however it likes, reports what a child did, and is told the verdict. Two
games now share one arithmetic, one difficulty ladder and one learner record.
Adding the ninety-eighth pack adds no mathematics.

**Cost.** The host is no longer content-free in the strictest reading of
ADR-0022, and the boundary is now a *rule about what kind of thing* rather than
a rule about a directory. That is weaker, so it is compensated with the two
structural assertions above rather than with a paragraph.

**What this does not license.** A screen in the host that renders an exercise. A
keypad. A component that decides an answer. Those are still refused, by a test,
by name.

## Alternatives rejected

**Leave the curriculum to packs and let each judge itself.** Cheapest today.
It makes the `items` capability decoration, puts the answer inside the game
where a curious child can find it, and produces one arithmetic per pack.

**Widen the SDK so a pack can post its own generator to the host.** A plugin
inside a plugin, with the generator crossing a boundary that exists to keep
untrusted code out. The reason to have the boundary is the reason not to.
