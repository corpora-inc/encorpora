# Dynawalla — Decision record index

One ADR per irreversible or expensive-to-reverse choice. Reversible decisions are not
ADRs; they live in [ARCHITECTURE.md](ARCHITECTURE.md).

**Status vocabulary**

- **Accepted** — decided, evidence recorded, implement against it.
- **Accepted (direction)** — the shape is decided and load-bearing engineering may
  proceed against it; a named sub-decision inside it is explicitly still open. The ADR
  says which.
- **Proposed — awaiting founder** — the decision is the founder's. The ADR states the
  options and their consequences and **invents no answer**. Do not implement past the
  point where the choice becomes load-bearing.
- **Deferred to <trigger>** — deliberately not decided yet, with the trigger named. The
  ADR must also record what makes the deferral safe, i.e. why nothing is being built that
  the later decision would invalidate.
- **Superseded by ADR-NNNN** — kept for the record; never edited in place.

**When an ADR may be edited in place, amended 2026-07-25.** The original rule read "an
ADR is amended by writing a new one, not by rewriting the old one," full stop. That rule
is right for a *decided* ADR and wrong for the two cases this program actually hit first,
so it is made precise rather than quietly broken:

1. **Reaching a decision is not an amendment.** An ADR sitting at `Proposed — awaiting
   founder` is an open question. Writing the founder's answer into it is the ADR arriving
   at its purpose, not a rewrite of a decision. Record the answer, the date, and the
   founder's own words; do not open a second ADR to say what the first one was for.
2. **Correcting a factual error is not an amendment either** — provided the ADR has not
   yet been implemented against, and provided **the error is left visible.** A wrong fact
   that a future agent might re-derive must be quoted as superseded inside the ADR, with
   what was wrong and why, exactly as ADR-0001 does for its parental-gate and age-band
   errors. Deleting the mistake destroys the artifact; the reasoning *is* the artifact.
3. **Everything else still requires a new ADR.** Once an ADR is `Accepted` and code or
   store state depends on it, changing the decision means writing ADR-NNNN that supersedes
   it. A `Superseded` ADR is never edited in place, for any reason.

Any in-place edit carries a dated **Amended** or **Corrected** line in the ADR header
saying what changed, so the history is readable without `git log`.

| ADR | Title | Status |
|---|---|---|
| [0001](DECISIONS/ADR-0001-kids-category-posture.md) | Apple Kids Category and Play under-13 target audience | Accepted (constraints) · election **Deferred to submission** |
| [0002](DECISIONS/ADR-0002-v1-scope-cut.md) | V1 covers number and arithmetic only | **Proposed — awaiting founder** |
| [0003](DECISIONS/ADR-0003-no-downloadable-packs-v1.md) | No downloadable content packs in V1 | **Superseded by 0020** |
| [0004](DECISIONS/ADR-0004-no-mic-no-llm-no-3d.md) | No microphone, no on-device LLM, no 3D | **Superseded by 0021** |
| [0005](DECISIONS/ADR-0005-shell-and-routing.md) | Hash router, one window, parental gate in the shell | Accepted |
| [0006](DECISIONS/ADR-0006-typed-ts-curriculum-exact-arithmetic.md) | Typed-TS curriculum authoring with exact rational arithmetic | Accepted |
| [0007](DECISIONS/ADR-0007-launch-locales.md) | Five launch locales; Arabic numbering system deferred | Accepted (sub-decision open) |
| [0008](DECISIONS/ADR-0008-fsrs-on-classes-latency-rating.md) | FSRS keyed on skill classes, rated on correctness **and** latency | Accepted |
| [0009](DECISIONS/ADR-0009-stakes-without-loss.md) | The stakes are chamber choice, working mechanisms, and discovery | Accepted |
| [0010](DECISIONS/ADR-0010-standards-alignment-claim.md) | Public standards-alignment claim | **Proposed — awaiting founder** (research in flight) |
| [0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md) | `native/` workspace, independent app roots, `[patch]` stays put | Accepted |
| [0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md) | Curriculum ships bundled; OTA deferred with a stated trigger | Accepted |
| [0013](DECISIONS/ADR-0013-monetization-model.md) | Monetization model | Accepted (direction); packaging open |
| [0014](DECISIONS/ADR-0014-repository-license.md) | Repository license | **Proposed — awaiting founder** (research in flight) |
| [0015](DECISIONS/ADR-0015-developer-account-topology.md) | Developer-account topology | Accepted |
| [0016](DECISIONS/ADR-0016-app-store-product-name.md) | App Store product name | **Proposed — awaiting founder** (checks returned 2026-07-25; two counsel-grade collisions open) |
| [0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) | Human evaluation resourcing | Accepted |
| [0018](DECISIONS/ADR-0018-multi-child-profiles.md) | Multi-child profiles designed in from M2 | Accepted |
| [0019](DECISIONS/ADR-0019-no-stage-environment.md) | No stage environment | Accepted |
| [0020](DECISIONS/ADR-0020-content-packs-are-the-product.md) | Downloadable content packs are the product | Accepted |
| [0021](DECISIONS/ADR-0021-pack-capabilities-are-per-pack.md) | Capability is per pack; the microphone stays closed | Accepted |
| [0022](DECISIONS/ADR-0022-host-ships-no-content.md) | The host ships no content; packs are the product | Accepted |

## Reversed on 2026-07-26

Two ADRs were reversed by the founder, and the reversal is the largest change
this program has taken. **Neither had ever been ratified by him** — both were
written `Proposed`, marked `Accepted` inside the program, and built against.

- **ADR-0003 → [ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md).**
  Content packs are the product and the pack system is the delivery mechanism.
  "Acceptance by absence" (`K-01`, `K-02`) graded the program on the installer
  not existing, which is a gate that cannot notice the product needed one.
- **ADR-0004 → [ADR-0021](DECISIONS/ADR-0021-pack-capabilities-are-per-pack.md).**
  3D, executable packs and an on-device model are decided per pack at the
  boundary. The microphone stays closed pending a compliance decision.
- **New: [ADR-0022](DECISIONS/ADR-0022-host-ships-no-content.md).** The host
  ships no content at all; it is a shell around packs, and three mechanical
  gates in `npm test` keep it one.

The superseded ADRs are kept unedited, and ADR-0020 states which parts of the
old reasoning were wrong rather than deleting them — the reasoning is the
artifact, and an error nobody can see is an error somebody re-derives.

## Decided on 2026-07-25

Four ADRs closed in one pass, recorded from the founder's own words in each ADR:

- **ADR-0017 Human evaluation resourcing** — the evaluator is the founder's 10-year-old
  son; the founder holds every adult role including art director. No external cohort, no
  recruitment, no consent paperwork. The protocol keeps measuring the same five things
  and the ADR states plainly what a sample of one cannot support.
- **ADR-0015 Developer-account topology** — same Corpora accounts as Corpán. The founder
  said "same as Corpan I think"; the blast-radius cost was identified by the program and
  **was not put to him**, which the ADR now says in its header.
- **ADR-0013 Monetization** — direction only: generous free tier plus a subscription for
  unlimited exercises and full access; packaging and pricing still open, and the
  founder's own "I'm not sure" and "hasn't worked in the slightest" are carried as R-45
  rather than smoothed into a mandate.
- **ADR-0001 Kids Category** — the engineering constraints (no third-party ads,
  analytics or SDKs) are locked unconditionally; a parental-gate primitive is built and
  every link-out routes through it; the category election, **and the age band inside
  it**, are deferred to submission.

## Still open

**[STATUS.md](STATUS.md) is the single source of truth for what is open and when it
bites** — it is the file kept current in the PR that changes it. This index previously
disagreed with both STATUS.md and MISSION.md about how many decisions were outstanding,
which is exactly how one goes unnoticed. Do not re-enumerate them here.

The short version, for orientation only: **ADR-0016** (name), **ADR-0002** (scope cut),
**ADR-0014** (license) and **ADR-0010** (standards claim) are open at the ADR level; and
two decisions live *inside* ADRs that are otherwise decided — **ADR-0001's category
election and age band** (`G-01`) and **ADR-0013's packaging and pricing** (`G-02`). The
**age-band choice is the newest and the least expected**: no V1 scope currently proposed
fits a single Apple Kids band.
