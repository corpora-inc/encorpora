# ADR-0026 — Repository license: Business Source License 1.1

**Status:** Accepted — founder decision, 2026-10-17. Supersedes [ADR-0014](ADR-0014-repository-license.md).

## Decision

**BUSL-1.1, converting to Apache-2.0 four years after each version is published.**

- [`LICENSE`](../../../LICENSE) is the Business Source License 1.1 text with Corpora's parameters. Licensor: Corpora Inc.
- **Additional Use Grant:** production use is permitted for personal, non-commercial and non-profit educational purposes, for example by a family or a non-profit school with its own students. Offering the work, or a product or service built on it, to third parties for a fee or commercially is not permitted without a license from Corpora Inc.
- **Change License:** Apache-2.0, four years after each version's publication.
- **Earlier versions:** versions published under ADR-0014 remain Apache-2.0, and that text is kept in [`LICENSES/Apache-2.0.txt`](../../../LICENSES/Apache-2.0.txt). Code contributed under Apache-2.0 keeps its notices. [`NOTICE`](../../../NOTICE) is unchanged in scope: trademarks, store art, voices, music and third-party material keep their own terms.
- **Manifests:** `LICENSE` governs. First-party `package.json` and `Cargo.toml` manifests still declare `Apache-2.0`, and are updated to `BUSL-1.1` product by product. Changing every pack manifest in one PR would rebuild and republish every pack.

## Why

The repository stays public, so parents, ESA reviewers and contributors can verify how the software behaves, for example its privacy and deletion handling. But the curriculum engine and content are the product, and a permissive license let any competitor sell them. A source-available license with a time-delayed open-source conversion keeps the transparency and removes the commercial copying.

## Consequences

- **"Open source" is no longer accurate.** Use "source-available". Earlier decisions justified by "the app is open source anyway" now rest on "the source is public": anyone can still read the code and bypass client-side checks, but the license no longer lets them ship it commercially.
- **Strategy goes private.** Business strategy and research (ESA dossiers, pricing) and host-specific deployment configuration are kept in private repositories, not here.
- **Outside contributions are still possible** but need a contribution grant (CLA or DCO) before they are accepted, so they can be licensed under these terms.
