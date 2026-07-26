# ADR-0022 — The host ships no content; packs are the product

**Status:** Accepted
**Date:** 2026-07-26
**Related:** [ADR-0020](ADR-0020-content-packs-are-the-product.md),
[ADR-0021](ADR-0021-pack-capabilities-are-per-pack.md),
[ADR-0005](ADR-0005-shell-and-routing.md),
[ADR-0018](ADR-0018-multi-child-profiles.md)

## Context

The app that existed before this decision shipped a practice loop: a fixed
ladder of column arithmetic, a keypad, a judge, a contrast card, a character
with a grammar of remarks, and a reaction layer to play over them. It was built
carefully. The founder's verdict on it was that it was a calculator, and the
most boring app he had ever seen, and that the exercises shipping inside the app
should be removed and the thing started over.

The instruction is not "make the bundled content better". It is that the core
app has none.

## Decision

**The host is a shell. It contains no exercise, no curriculum, no game, no
world, no art asset and no piece of content of any kind.**

What the host keeps, and nothing more:

| Kept | Where |
|---|---|
| Learner profiles — add, name, switch, remove | `src/profiles/` |
| Local storage, namespaced per learner, with migrations | `src/app/profile.ts`, `src/app/persist.ts` |
| The pack registry: what is installed, at what version, at what cost | `src/packs/registry.ts` |
| The capability boundary a pack is mounted against | `src/packs/host.ts` |
| Settings that act on the document and on packs | `src/settings/` |
| A parent area, and developer diagnostics inside it | `src/shell/surfaces.ts` |
| Navigation to five destinations, all of them real | `src/app/Nav.tsx` |
| The cross-pack record and the progress figure it draws | `src/learner/`, `src/world/` |

Two things need saying because they look like exceptions and are not:

- **`src/world/` stays.** It is the progress surface: pure geometry over one
  integer — how many apertures a learner has cut — with its text alternative
  handed in from outside. It contains no exercise and asks no question. It is
  what "progress is a building, not a number" is made of, and it is written by
  packs through the boundary rather than by anything in the host.
- **`@dynawalla/engine` stays in the repository and leaves the host's bundle.**
  The adaptive model is the host's, because the host is what follows a learner
  across packs. It is unwired today for a concrete reason: it models *skills*,
  the skill catalog is content, and content is a pack's. It wires back up when a
  pack declares one.

`dynawalla/curriculum/` — exact rational arithmetic, seeded deterministic
generators, executable mal-rules, the worked-solution walkthrough, the `CG-*`
gates — is genuinely good work and is not deleted. It becomes a **library that
packs import**, not content bundled in a host.

## The rule, and how it is enforced

A rule with no enforcement is a preference, and this one erodes in a single
import from a single screen because it was easier than defining the boundary.
Three mechanical gates, all in `npm test`:

1. `app/boundary.test.ts` fails the build if anything under `src/` imports
   `dynawalla/curriculum`, `dynawalla/engine`, or anything outside `src/` — with
   one exemption, `dynawalla/packs/sdk/src/index.ts`.

   That exemption is the *contract*, not content: the capability table, the
   manifest schema, the wire protocol and the version arithmetic that the host
   and every pack must agree on. Sharing one copy is what makes a change that
   would break an installed pack fail to typecheck in the host as well, which a
   second copy would hide. It is one file rather than a directory — a pack
   imports the SDK's entry point and nothing else, and so does the host, so
   reaching into an SDK module directly still fails — and a test of its own
   holds that entry point to re-exporting nothing but its own siblings, because
   one `export * from "../shared/curriculum"` there would put every generator
   back in the host through a door the offender scan waves past.
2. The same file fails on a set of words that only content uses — exercise,
   mal-rule, misconception, keypad, numerator, minuend, and the rest.
3. `shell/surfaces.test.ts` fails if any destination renders nothing, and
   `app/routes.test.ts` fails if any route renders anything other than the shell
   and the surface model. **Two of the five destinations previously rendered an
   empty recess, permanently, with a green suite** — a component whose whole job
   was to look deliberate about being blank. Both it and the recess primitive
   are banned by name.

## Consequences

- **The app got smaller, measurably.** 9,781 lines of source deleted against
  2,490 added. The host's own contribution to the JavaScript bundle — total
  bundle minus the React, react-router and zustand floor — falls from 94.6 kB to
  21.2 kB, a 78% cut. Total bundle: 382.39 kB → 309.23 kB (123.51 kB → 98.95 kB
  gzipped); CSS 26.77 kB → 19.55 kB. Modules transformed: 179 → 116.
- **The host is not fun and is not supposed to be.** Fun is a pack's job. The
  five host destinations are a registry, a progress figure, a learner list,
  settings and a parent area. Judged as a product this is a utility; judged as
  what it is — the smallest possible thing that can install, keep and mount
  packs — it is finished-shaped rather than half-built.
- **`/practice` is gone as a route and as an idea.** The host has no opinion
  about arithmetic. It knows a pack reported an outcome and whether it was
  right.
- The acceptance criteria written against the bundled loop (the practice
  surface, the ladder, the contrast card, `M-17`'s artifact hash) are graded
  against packs now, and several are void. They are not quietly re-pointed —
  see [STATUS.md](../STATUS.md).
