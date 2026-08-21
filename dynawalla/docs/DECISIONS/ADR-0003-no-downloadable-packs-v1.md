# ADR-0003 — No downloadable content packs in V1

**Status:** **Superseded by [ADR-0020](ADR-0020-content-packs-are-the-product.md)** (2026-07-26)
**Related:** [ADR-0012](ADR-0012-ota-curriculum-deferral.md), [PACK_SYSTEM.md](../PACK_SYSTEM.md)

> Reversed by the founder. Content packs are the product and the pack system is
> the delivery mechanism, not deferred work. The text below is kept unedited —
> ADR-0020 says which parts of this reasoning were wrong and why, so that the
> argument is not made again from the same premises.

## Context

Corpán has a content-pack system: a catalog, a CDN, an installer, a Rust pack runtime of
roughly 2,900 lines reached through eight Tauri commands, and a `corpan-pack://` URI
scheme baked into installed packs' built JS on user devices. The first draft of this
program proposed Dynawalla adopt an equivalent, and budgeted it as one bullet.

That bullet is a from-scratch Rust pack runtime with connect and stall watchdogs,
fail-closed sha256 verification, a catalog surface, a CDN publishing path and an install
manager — plus three shared-TypeScript extraction waves to make any of it reusable. It
is a milestone, not a bullet.

Dynawalla's V1 content is a skill graph compiled from typed TypeScript. It is small,
it changes with the app's own code, and there is no installed base to serve it to.

## Decision

V1 ships **no downloadable content packs**. The curriculum is compiled to a
deterministic hash-stamped SQLite artifact and **bundled in the app**.

This deletes from the critical path: a Rust pack runtime, a catalog, a CDN surface, an
install manager, three shared-TS extraction waves, and every failure mode that comes
with them (404s on unrebuilt packs, version-skew between an installed pack and the host
app, quota-exhaustion on device, and a second security boundary).

## Consequences

- A curriculum fix requires an app release. That is acceptable while there is no
  installed base. The trigger condition for revisiting is stated in
  [ADR-0012](ADR-0012-ota-curriculum-deferral.md).
- `shared/net-cache` and `shared/pack-install` are **not** extracted — they are moot
  with no packs, and extracting a module with one hypothetical consumer is negative work.
- Storage stays small: with no downloadable content, no audio assets and no models,
  Dynawalla's bounded per-child state does not produce the quota-exhaustion class of
  failure that justifies Corpán's large storage layer. Dynawalla writes its own small
  adapter instead.
- Acceptance is **by absence** (`K-01`, `K-02`): the release checklist verifies that no
  catalog, installer or CDN surface exists.
- Corpán's pack delivery is unaffected. M0b hardens it because it needs hardening, not
  because Dynawalla depends on it.

## Note for whoever revives the net-cache module

Every Corpán catalog policy sets `skipConditionalGet: true`, because CloudFront/Fastly
reject the `If-None-Match` CORS preflight. The ETag/304 "free poll" is **off in
production**. Do not plan capacity on it.
