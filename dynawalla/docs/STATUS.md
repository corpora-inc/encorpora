# Dynawalla — Status

**Last updated:** 2026-07-25
**Current milestone:** M0a — Harden the trunk (additive only)
**Nothing has been built.** No Dynawalla application, curriculum, engine or store record
exists.

Update this file **in the PR that changes it**, not afterwards. A status doc that is
brought up to date in a batch is a status doc nobody trusts.

---

## Where the program actually is

Discovery is complete. A 14-agent program produced the plan in these docs; three
adversarial critics produced 42 findings, of which the blocking ones changed the plan.
The revised positions are what is written here — see
[MASTER_PLAN.md](MASTER_PLAN.md) and [RISKS.md](RISKS.md), not any earlier draft.

The bootstrap docs and CI groundwork are merged. Four of the eight open founder decisions
have been answered and recorded. What remains before code starts is the native CI gate
and the adversarial-review fixes.

The four corrections most likely to be cheerfully undone by a future agent are recorded
where they will be read before the mistake is made:

| Correction | Recorded in |
|---|---|
| `[patch.crates-io]` must stay in each app's own root manifest | [ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md), R-06 |
| Build numbers stay minutes-since-epoch | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-11 |
| The Pages artifact is whole-site; never build only changed packs | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-13 |
| Never add a fourth required status context | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-10 |

## Merged

`main` is at `7fc5b7d98`.

| PR | What |
|---|---|
| #522 | Removed the `pr-agent` workflow |
| #523 | Deprecated-methodology expunge, false-claim corrections, `LICENSE` placeholder |
| #524 | Project-scoped Claude control plane + additive `ci.yml` area filters |
| #525 | Program plan: mission, acceptance criteria, master plan, ADRs |
| #526 | Program reference set: architecture, curriculum, engine, gates, release, store |

## In flight (M0a bootstrap)

| Work | State |
|---|---|
| Founder decisions recorded in ADRs 0001 / 0013 / 0015 / 0017 | this PR |
| Repository-license research ([ADR-0014](DECISIONS/ADR-0014-repository-license.md)) | commissioned 2026-07-25, recommendation pending |
| Standards-alignment research ([ADR-0010](DECISIONS/ADR-0010-standards-alignment-claim.md)) | commissioned 2026-07-25, recommendation pending |
| Store reconnaissance — Corpán's live category/rating, the account reuse matrix, the Dynawalla name check | in flight; `TODO(store-recon)` markers left in ADR-0001, ADR-0015, ADR-0016 |
| Is the vendored `ndk-context` `[patch]` actually applying, or already inert? | under investigation — see below |
| `adversarial-review` fail-open audit | under investigation — see below |

Not started: PR-0a.2 (adversarial-review fixes), PR-0a.3 (fail-closed flip), PR-0a.4
(`.cargo/config.toml` template), PR-0a.5 (native CI gate + delete `ios-native.yml`),
PR-0a.6 (SHA-pinning), PR-0a.7 (branch-protection → ruleset migration, a scripted
settings change rather than a PR).

## Findings under investigation

Two live findings. Neither has a verdict yet; nothing here should be cited as settled.

1. **The `ndk-context` `[patch]` may be inert.** R-06 and
   [ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md) treat the
   vendored fork as load-bearing — upstream `ndk-context` aborts the process on Android
   Activity recreation. An investigation is checking whether the patch actually resolves
   to the vendored fork in the shipping build today. If it does not, the M3 move is not
   the only thing at risk: Corpán is already shipping without it, and R-06's severity is
   understated rather than overstated.
2. **`adversarial-review` fails open.** It truncates oversized diffs and still reports
   success, and it only fails when *all* lenses error. An audit is establishing how many
   merged PRs were reviewed by a truncated diff or a partially-failed lens run. Until
   PR-0a.2 lands, the diff-size discipline this program depends on is unenforced.

## Acceptance

**0 of 117** items met — [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## Blockers

1. **No native CI gate exists at all** — zero `cargo`/`clippy`/`rustup` invocation in
   any required check. Until PR-0a.5 lands, every native change is unverified by CI, and
   M3 must not start.
2. **`adversarial-review` fails open** (finding 2 above). Until PR-0a.2 lands, an
   oversized PR is reviewed by a truncated diff and reported green.
3. **Two founder console sessions** (~10 minutes) are on M1's critical path and cannot
   be automated — Apple `POST /v1/apps` returns 404 for API keys, and Play has no
   application-create method (R-37).

**No longer a blocker:** the playtest cohort and the named art director. Both were
resolved by [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) — the evaluator
is the founder's 10-year-old son and the founder is the art director. That removes the
recruitment lead time from the critical path and replaces it with a stated limitation:
`n = 1`, observed by the builder, with grades 1–2 and every pre-reader flow unobserved
(R-46).

## Founder decisions

Recorded 2026-07-25, from the founder's own words, in each ADR:

| ADR | Decision |
|---|---|
| [0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) | One child evaluator — the founder's 10-year-old son. The founder holds every adult role, including art director. |
| [0015](DECISIONS/ADR-0015-developer-account-topology.md) | Same Corpora Apple team and Play account as Corpán; shared blast radius and nomination pool accepted. |
| [0013](DECISIONS/ADR-0013-monetization-model.md) | Direction: generous free tier + subscription for unlimited exercises and full access; offline-first keeps marginal cost near zero. Packaging and pricing still open (R-45). |
| [0001](DECISIONS/ADR-0001-kids-category-posture.md) | No third-party ads, analytics or SDKs, unconditionally. Parental gate on every link-out. Category election deferred to submission. |

Still open, ordered by when they bite:

| ADR | Decision | Bites at |
|---|---|---|
| [0016](DECISIONS/ADR-0016-app-store-product-name.md) | Product name (name check in flight) | M1, app-record creation |
| [0002](DECISIONS/ADR-0002-v1-scope-cut.md) | V1 scope cut: grades 1–5, number and arithmetic | any public scope statement; M4 curriculum breadth |
| [0014](DECISIONS/ADR-0014-repository-license.md) | Repository license (research in flight) | M0a (fork-PR posture) |
| [0010](DECISIONS/ADR-0010-standards-alignment-claim.md) | Standards-alignment claim (research in flight) | first public marketing copy |
| [0001](DECISIONS/ADR-0001-kids-category-posture.md) | The category election itself | M1, first store submission (`G-01`) |
| [0013](DECISIONS/ADR-0013-monetization-model.md) | Packaging and pricing | M9 (`G-02`) |
| — | Whether to add one younger evaluator for the grade 1–2 gap (R-46) | M9 at the latest |

## Roles

An unassigned role is itself a risk (R-44). Two acceptance items name a person as their
pass condition; one of them is now filled.

| Role | Person |
|---|---|
| Program lead | unassigned |
| Native (Rust/Tauri) | unassigned |
| Release (CI, queue, stores) | unassigned |
| Curriculum | unassigned |
| Engine (learner model) | unassigned |
| Experience | unassigned |
| Nightly harness owner (`A-19`) | unassigned |
| Art director (`Q-14`) | Skylar Saveland |
| Playtest observer | Skylar Saveland |
| Founder | Skylar Saveland |

## Incident log

Empty. Record here: any PR over 200 files (R-01), any use of the `admin-override`
break-glass label (R-16), any waived gate, and any Corpán production regression
attributable to a Dynawalla merge (`C-21`), and any waived acceptance item.
