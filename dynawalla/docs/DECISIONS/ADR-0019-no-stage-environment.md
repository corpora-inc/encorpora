# ADR-0019 — No stage environment

**Status:** Accepted

## Context

The natural response to "we now merge to `main` constantly, with two products" is to
build a staging site — `stage.encorpora.io` — and promote from it.

**It is not buildable from this repository.** GitHub Pages serves exactly one site per
repository; `gh api repos/corpora-inc/encorpora/pages` returns one site
(`cname: encorpora.io`, `build_type: workflow`). A second Pages site would require a
second repository, which contradicts locked decision #3 (monorepo, not a separate repo).

## Decision

No stage environment. The budget goes instead to the things that actually carry
deployment risk:

- **Immutable, versioned pack artifacts on S3/CloudFront** with a sha256 in the catalog
  (M0b), because the dangerous deploys are pack ZIPs and catalog JSONs, not the website.
- **A real native CI gate**, which today does not exist at all: there is zero
  `cargo`/`clippy`/`rustup` invocation in the required PR checks, and the only cargo in
  CI sits in a non-required workflow with workflow-level path filters.
- **Staged exposure through the mechanisms that already exist**: the catalog's
  `channel: "preview"`, `minAppVersion`/`maxAppVersion` routing, TestFlight and Play
  internal tracks, and the post-deploy smoke that asserts live ZIP URLs.

## Consequences

- Dynawalla V1 ships **no server-side state and no packs**, so it has nothing to stage.
  Its staged exposure is TestFlight and Play internal, which is also what every
  `[device]` acceptance item requires anyway.
- Corpán's staging story is `channel: "preview"` plus version routing, unchanged.
- **Revisit only if Dynawalla acquires server-side state or an OTA content path** — i.e.
  if [ADR-0012](ADR-0012-ota-curriculum-deferral.md)'s trigger fires. At that point the
  question is not "build a stage site" but "how are signed immutable artifacts promoted,"
  which is a different design.
