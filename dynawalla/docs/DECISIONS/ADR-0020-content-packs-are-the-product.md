# ADR-0020 — Downloadable content packs are the product

**Status:** Accepted
**Date:** 2026-07-26
**Supersedes:** [ADR-0003](ADR-0003-no-downloadable-packs-v1.md)
**Related:** [ADR-0021](ADR-0021-pack-capabilities-are-per-pack.md),
[ADR-0022](ADR-0022-host-ships-no-content.md),
[ADR-0012](ADR-0012-ota-curriculum-deferral.md),
[PACK_SYSTEM.md](../PACK_SYSTEM.md)

## Context

ADR-0003 decided that V1 ships no downloadable content packs: the curriculum
would be compiled into a bundled artifact, and acceptance would be **by
absence** — the release checklist verifying that no catalog, installer or CDN
surface exists.

The founder has ruled the other way, in terms that leave nothing to interpret:

> "THE CORE APP SHOULD HAVE ZERO FUCKING CONTENT. Ship nothing in the core app.
> The packs and cool experiences are THE ONLY THINGS THAT MATTER. […] MAKE THE
> APP AS SMALL AS POSSIBLE. BUILDING THE FUN GAMES AND CURRICULUM IS
> EVERYTHING."

ADR-0003 was never his. It was written `Proposed`, marked `Accepted` inside the
program, and built against.

## Decision

**Content ships as packs. The pack system is not deferred work; it is the
product's delivery mechanism and it is on the critical path.**

The host installs, updates, verifies, removes and mounts packs. Everything a
child does happens inside one.

## Why ADR-0003 was wrong, stated so nobody re-derives it

Its reasoning was not innumerate — a from-scratch Rust pack runtime, a catalog,
a CDN path and an install manager really is a milestone rather than a bullet,
and the estimate was honest. Three things were wrong with it anyway, and they
are the reasons that matter:

1. **It costed a subsystem and priced a product.** The paragraph beginning "that
   bullet is a from-scratch Rust pack runtime" is an argument about *build
   cost*. Nothing in the ADR asks what the app is worth without it. The answer,
   demonstrated by the thing that was built instead, is: an arithmetic drill
   with a keypad — "the most boring worst app I've ever seen in my life."
2. **It reasoned as if this were a fresh repository.** It is not. This monorepo
   already ships `tauri-plugin-game-packs` — the runtime and the
   `corpan-pack://` scheme handler — plus `packs/sdk`, `packs/shared`, and 24
   live packs, four of them Babylon.js 3D worlds. ADR-0003 correctly described
   what building that from scratch would cost, and then charged Dynawalla for
   it anyway. **The right question was never "build or skip", it was "reuse or
   rebuild."**
3. **"Acceptance by absence" made the mistake unfalsifiable.** `K-01`/`K-02`
   graded the program on there being no installer. A gate that passes because a
   capability is missing cannot notice that the product needed it.

## Consequences

- The critical path gains the runtime, the installer, verification and a
  delivery origin. It loses the bundled-artifact pipeline, the 12 MB cap and
  `M-17`'s hash gate, which have nothing left to guard.
- **Start from what exists.** `tauri-plugin-game-packs`, `packs/sdk` and
  `packs/shared` are shipping code with the traps already paid for. A second
  from-scratch runtime in one repository is the outcome to avoid.
- The identifier surface is permanent. Corpán learned this the expensive way:
  `corpan-pack://` is baked into installed packs' built JS on user devices, so
  renaming the plugin that registers it breaks every installed pack at runtime
  while compiling cleanly. Whatever scheme Dynawalla registers, it registers
  once.
- Everything [PACK_SYSTEM.md](../PACK_SYSTEM.md) recorded as "what Corpán's pack
  system already taught" is now operative rather than archival: the Pages
  artifact is whole-site, the ETag/304 free poll is off in production, a
  published artifact is never changed in place, a catalog entry with no build
  step is a 404, and a delete path that is never registered leaks forever.
- **A silent download is still forbidden.** Ask, show the size, show progress,
  degrade gracefully if declined. That was true before this ADR and is not
  loosened by it.
- ADR-0012's OTA trigger is moot for content — content is delivered this way
  now. Its underlying caution (an app-review cycle is not a content-fix
  channel) is the reason this decision is right, not an argument against it.

## What is still open

The delivery origin, the catalog schema, the signing story and whether the
runtime is the existing plugin extended or a Dynawalla-specific sibling. Those
are the next milestone's decisions and each gets its own ADR. What is decided
here is that they are decisions to make, not to avoid.

The host-side contract exists already so that both halves are built against the
same thing: `dynawalla-app/src/packs/registry.ts` is the book of record an
installer writes into, and `packs/host.ts` is the whole of what a mounted pack
is handed and can do.
