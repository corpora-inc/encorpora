# ADR-0020 — Rapier 2D is the physics engine

**Status:** Proposed
**Supersedes:** nothing. **Interacts with:** [ADR-0004](ADR-0004-no-mic-no-llm-no-3d.md).

## Context

The Bazaar's games need real physics: projectile arcs with usable aim-assist, stacking
and toppling, ropes and chains, soft bodies, a particle-liquid approximation, gear
trains, dominoes, and a balance scale that is the physical embodiment of the equals sign.

Four candidates were benchmarked against identical scenes rather than compared from
documentation: **Rapier 2D** 0.19.3, **Box2D v3** (`box2d3-wasm` 5.2.0), **Planck.js**
1.5.0 and **Matter.js** 0.20.0. The full evidence, every table, and instructions to
re-run everything are in [`dynawalla/foundations/physics/README.md`](../../foundations/physics/README.md).
Havok and Jolt were excluded on the record: both are 3D engines whose shipped JS surface
is a Babylon plugin API, and the games are 2D-simulated.

## Decision

**Use Rapier 2D, pinned to `@dimforge/rapier2d-compat` 0.19.3**, behind the kit in
`dynawalla/foundations/physics/src/`. Prototypes call `createWorld()` and the recipes;
they do not talk to Rapier directly.

**The physics never decides a mathematical fact.** Quantities a prototype may treat as
truth — `compare()`, `momentOf()`, `volumeIn()`, `fallenFraction()` — are computed by
exact arithmetic over what the game put into the world. The solver drives the *picture*.
This extends [ADR-0009](ADR-0009-stakes-without-loss.md)'s "true by construction" to the
simulation layer, and it is enforced by a test: `compare()` is already correct before a
single step has run, and stays correct after the beam is forcibly rotated.

**Budget: 4 ms of a 16.67 ms frame, measured as step p99**, with four quality tiers whose
floor (`mid`) is the reference tablet, not a downgrade from desktop.

## Why Rapier and not the others

Each of the three alternatives failed a capability that is on the required list, not a
performance target.

- **Matter.js drops 0 of 300 dominoes** at friction 0.45 and 0.7 — the wave dies at
  domino three. Rapier, Box2D v3 and Planck agree within 2 dominoes across the whole
  friction sweep; Matter falls off a cliff above 0.3. Its iteration count also makes
  chain stretch *worse* (17% → 62%), so it is not a convergence knob. Last published
  2024-06-23.
- **Planck.js stretches a chain 64% at a 10:1 load ratio** and 92% at 150:1, and more
  iterations barely help — Box2D 2.4's solver cannot hold a chain. It is also 8.8x
  slower than Rapier on 500 bodies, with a 9.9 ms worst frame on a Mac.
- **Box2D v3 has the fastest solver** — 6x Rapier's median on a 120-box pyramid — but its
  Embind binding allocates a heap handle per getter, so reading 500 transforms costs
  0.454 ms against Rapier's 0.171 ms and the solver win is spent at the boundary. It also
  settles a balance scale at 46-70° of tilt with equal weight in both pans, at every
  sub-step count tested.

Rapier's cost is size: its WASM is 1.12 MB raw, 2.75x Box2D v3's. Accepted, because in a
Tauri app the module is bundled rather than fetched, and because most of the measured gap
is the `-compat` base64 packaging rather than the engine.

## Determinism

Verified, not assumed. One seeded scene — a toppling stack, a loaded chain, 120 particles
and a projectile — run for 900 steps produces the **identical state hash in Node/V8,
Chrome/V8 and WebKit/JavaScriptCore**. This is structural: the module imports no libm
from JavaScript, so all floating-point work happens inside WASM, where f32/f64 semantics
are fully specified.

Replays therefore store **commands addressed by step index**, never positions. Not
verified: cross-architecture (everything above ran on arm64). If a cross-device replay
ever desyncs, `@dimforge/rapier2d-deterministic` is a one-line swap.

## Relationship to ADR-0004

ADR-0004 excludes a 3D renderer from V1 and sets its revisit condition as "a measured
frame budget on the Galaxy Tab A9". **This ADR does not claim that condition is met.**
No Galaxy Tab A9 was available; the budget above was measured in real Chrome under CDP
CPU throttling, which inserts pauses and does not model a smaller cache or slower memory.
The rig to take the real measurement is committed and runs from any browser on the
device.

ADR-0004's reasoning about 3D is also about the *renderer*, not the solver: this kit
simulates in 2D and presents in 3D, so the frame-budget question it raises applies to the
rendering foundation rather than to this one. Whether V1 renders in 3D at all is a
separate decision and a separate ADR.

## Consequences

- One physics engine across every prototype, so a trap found once is fixed for all of
  them. Three are already gated by tests, including the two that silently produce a dead
  mechanism: Rapier joints collide the bodies they connect and expose no
  `collideConnected`, and `JointData.limitsEnabled`/`.limits` are accepted and ignored.
- Prototype authors do not choose an engine, tune a solver, or discover any of this.
- Switching engines later means rewriting the kit's internals but not the prototypes,
  because nothing above the kit imports Rapier.
- Before shipping, move the dependency from `-compat` to `@dimforge/rapier2d` (separate
  `.wasm`), worth roughly 200 KB gzip.

## Revisit conditions

A measured 60 fps failure on the reference tablet that tiering cannot recover; a
cross-device replay desync that the `-deterministic` build does not fix; or a game design
that genuinely needs 3D rigid-body simulation rather than 3D presentation, which would be
a second engine and its own ADR.
