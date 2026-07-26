# Dynawalla — Decision record index

One ADR per irreversible or expensive-to-reverse choice. Reversible decisions are not
ADRs; they live in [ARCHITECTURE.md](ARCHITECTURE.md).

**Status vocabulary**

- **Accepted** — decided by the program, evidence recorded, implement against it.
- **Proposed — awaiting founder** — the decision is the founder's. The ADR states the
  options and their consequences and **invents no answer**. Do not implement past the
  point where the choice becomes load-bearing.
- **Superseded by ADR-NNNN** — kept for the record; never edited in place.

An ADR is amended by writing a new one, not by rewriting the old one. The reasoning is
the artifact — several of these exist specifically so a future agent does not
cheerfully reintroduce a mistake that was already paid for once.

| ADR | Title | Status |
|---|---|---|
| [0001](DECISIONS/ADR-0001-kids-category-posture.md) | Apple Kids Category and Play under-13 target audience | **Proposed — awaiting founder** |
| [0002](DECISIONS/ADR-0002-v1-scope-cut.md) | V1 covers number and arithmetic only | **Proposed — awaiting founder** |
| [0003](DECISIONS/ADR-0003-no-downloadable-packs-v1.md) | No downloadable content packs in V1 | Accepted |
| [0004](DECISIONS/ADR-0004-no-mic-no-llm-no-3d.md) | No microphone, no on-device LLM, no 3D | Accepted |
| [0005](DECISIONS/ADR-0005-shell-and-routing.md) | Hash router, one window, parental gate in the shell | Accepted |
| [0006](DECISIONS/ADR-0006-typed-ts-curriculum-exact-arithmetic.md) | Typed-TS curriculum authoring with exact rational arithmetic | Accepted |
| [0007](DECISIONS/ADR-0007-launch-locales.md) | Five launch locales; Arabic numbering system deferred | Accepted (sub-decision open) |
| [0008](DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md) | FSRS keyed on skill classes, rated on correctness **and** latency | Accepted |
| [0009](DECISIONS/ADR-0009-stakes-without-loss.md) | The stakes are chamber choice, working mechanisms, and discovery | Accepted |
| [0010](DECISIONS/ADR-0010-standards-alignment-claim.md) | Public standards-alignment claim | **Proposed — awaiting founder** |
| [0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md) | `native/` workspace, independent app roots, `[patch]` stays put | Accepted |
| [0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md) | Curriculum ships bundled; OTA deferred with a stated trigger | Accepted |
| [0013](DECISIONS/ADR-0013-monetization-model.md) | Monetization model | **Proposed — awaiting founder** |
| [0014](DECISIONS/ADR-0014-repository-license.md) | Repository license | **Proposed — awaiting founder** |
| [0015](DECISIONS/ADR-0015-developer-account-topology.md) | Developer-account topology | **Proposed — awaiting founder** |
| [0016](DECISIONS/ADR-0016-app-store-product-name.md) | App Store product name | **Proposed — awaiting founder** |
| [0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) | Human evaluation resourcing | **Proposed — awaiting founder** |
| [0018](DECISIONS/ADR-0018-multi-child-profiles.md) | Multi-child profiles designed in from M2 | Accepted |
| [0019](DECISIONS/ADR-0019-no-stage-environment.md) | No stage environment | Accepted |

## Open founder decisions, in the order they bite

1. **ADR-0001 Kids Category** — a one-way door under Apple Guideline 1.3. Must be
   Accepted **before M1's first store submission**. The engineering plan already assumes
   the strict posture, so choosing *in* costs nothing extra; choosing *out* is the
   decision that would let constraints relax.
2. **ADR-0017 Human evaluation resourcing** — the founder must supply a playtest cohort
   and a named art director. Recruitment has weeks of lead time, which is why
   [PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md) starts in the bootstrap PR.
3. **ADR-0002 V1 scope cut** — narrows the founder-stated grade range (1–6 plus intro
   pre-algebra) to grades 1–5 number and arithmetic, and rewrites the public claim.
   Needed before any public scope statement, and before M4 buys curriculum breadth
   against one range or the other. The engineering argument is settled; the scope
   decision is not the plan's.
4. **ADR-0015 Developer-account topology** and **ADR-0016 product name** — both needed
   before the ASC and Play app records are created in M1. The SKU and package name are
   literally immutable.
5. **ADR-0014 License** — decides whether outside contributions are wanted at all, and
   therefore whether the fork-PR gate path is worth maintaining.
6. **ADR-0010 Standards-alignment claim** — needed before any public marketing copy;
   decides whether gate CG-20 stays report-only.
7. **ADR-0013 Monetization** — deferring past M7 is fine; past M9 blocks launch.
