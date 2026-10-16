# ADR-0014 — Repository license

**Status:** Accepted — founder decision, 2026-10-16

## Decision

**Apache-2.0.** The founder chose it from the options as "Permissive, with an explicit
patent grant, and lets forks and outside PRs happen", with a `LICENSE` plus a `NOTICE`
that keeps third-party assets (fonts, voices, music, store art) under their own terms.

- [`LICENSE`](../../../LICENSE) is the verbatim Apache License 2.0 text.
- [`NOTICE`](../../../NOTICE) lists what it does not cover: the Corpora, Corpán, ¡AHA!
  and Dynawalla trademarks (Apache §6 already excludes them), store art, voices,
  music, and vendored or third-party material, which keeps its own license.
- First-party `package.json` and `Cargo.toml` manifests declare `Apache-2.0`.
- "The app is open source anyway" is now a fact about the repository.

The text below is the context as it stood before the decision.

## Context

The repository is public. GitHub reports `license: null` and no `LICENSE` or `COPYING`
file exists at the root.

Meanwhile, several shipped architectural decisions are justified in this codebase with
the phrase "the app is open source anyway" — notably client-bypassable entitlements and
server-truncated free tiers. Those decisions rest on a claim the repository does not
currently make.

"Public" and "open source" are not the same thing. With no license, the default is
exclusive copyright: no one has permission to use, modify or redistribute the code, and
an outside contributor has no clear grant to contribute under.

## Options

Not enumerated here as recommendations — this is a founder and counsel decision about the
whole monorepo, not about Dynawalla. The axes that matter operationally:

- **Permissive vs copyleft vs source-available.** Decides whether a competitor may ship
  the code, which is the question the "open source anyway" justifications are really
  leaning on.
- **Whether outside contributions are wanted at all.** If not, the fork-PR gate path
  ([RISKS.md](../RISKS.md) R-18), a `CODEOWNERS` file and a fork-only required approval
  are maintenance for a case that will never happen. If yes, they are required, along
  with a contribution grant (a CLA or a DCO sign-off).
- **Whether third-party content in the repo is compatible.** The monorepo contains book
  corpora, vendored forks and generated assets with their own terms; a single root
  license must not overclaim rights over them.

## Consequences

- A `LICENSE` placeholder lands in the bootstrap PR stating that the license is pending
  this decision, so the gap is visible rather than implicit.
- Until this is Accepted, do not repeat "it's open source anyway" as a justification in
  any new design decision. It is not a fact yet.
- This ADR blocks nothing in the build, and gates the fork-PR posture and any external
  contribution flow.
