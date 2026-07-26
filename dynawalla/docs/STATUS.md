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

The four corrections most likely to be cheerfully undone by a future agent are recorded
where they will be read before the mistake is made:

| Correction | Recorded in |
|---|---|
| `[patch.crates-io]` must stay in each app's own root manifest | [ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md), R-06 |
| Build numbers stay minutes-since-epoch | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-11 |
| The Pages artifact is whole-site; never build only changed packs | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-13 |
| Never add a fourth required status context | [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md), R-10 |

## Merged

Nothing yet.

## In flight (M0a bootstrap)

| Work | Owner | State |
|---|---|---|
| `dynawalla/docs/**` + `dynawalla/AGENTS.md` (this set) | program-docs agent | PR open |
| Root runbook amendments (`AGENTS.md`) | separate agent | PR open |
| Committed agent configuration (`.claude/**`, `.gitignore` negations) | separate agent | PR open |
| Additive `ci.yml` area filters + `uncovered` in warn mode | separate agent | PR open |
| Delete `.github/workflows/pr-agent.yml` | with the bootstrap PR | not landed |
| Deprecated-methodology expunge across ~22 doc sites | separate agent | PR open |
| `LICENSE` placeholder | with the bootstrap PR | not landed |

Not started: PR-0a.2 (adversarial-review fixes), PR-0a.3 (fail-closed flip), PR-0a.4
(`.cargo/config.toml` template), PR-0a.5 (native CI gate + delete `ios-native.yml`),
PR-0a.6 (SHA-pinning), PR-0a.7 (branch-protection → ruleset migration, a scripted
settings change rather than a PR).

## Acceptance

**0 of 117** items met — [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md).

## Blockers

1. **No playtest cohort exists.** Recruitment and consent take weeks and gate M2.
   Nothing in the program can substitute for it (R-02,
   [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md)).
2. **No named art director.** `Q-14` has no mitigation without one (R-32).
3. **No native CI gate exists at all** — zero `cargo`/`clippy`/`rustup` invocation in
   any required check. Until PR-0a.5 lands, every native change is unverified by CI, and
   M3 must not start.
4. **`adversarial-review` currently fails open**: it truncates oversized diffs and still
   reports success, and it only fails when *all* lenses error. Until PR-0a.2 lands, the
   diff-size discipline this program depends on is unenforced.
5. **Two founder console sessions** (~10 minutes) are on M1's critical path and cannot
   be automated — Apple `POST /v1/apps` returns 404 for API keys, and Play has no
   application-create method (R-37).

## Open founder decisions

Eight, ordered by when they bite; see [DECISIONS.md](DECISIONS.md) for the full list.

| ADR | Decision | Bites at |
|---|---|---|
| [0001](DECISIONS/ADR-0001-kids-category-posture.md) | Kids Category posture (one-way door) | M1, first store submission |
| [0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md) | Playtest cohort + named art director | now (weeks of lead time) |
| [0002](DECISIONS/ADR-0002-v1-scope-cut.md) | V1 scope cut: grades 1–5, number and arithmetic | any public scope statement; M4 curriculum breadth |
| [0015](DECISIONS/ADR-0015-developer-account-topology.md) / [0016](DECISIONS/ADR-0016-app-store-product-name.md) | Account topology, product name | M1, app-record creation |
| [0014](DECISIONS/ADR-0014-repository-license.md) | Repository license | M0a (fork-PR posture) |
| [0010](DECISIONS/ADR-0010-standards-alignment-claim.md) | Standards-alignment claim | first public marketing copy |
| [0013](DECISIONS/ADR-0013-monetization-model.md) | Monetization model | M9 |

## Roles

An unassigned role is itself a risk (R-44). Two acceptance items name a person as their
pass condition.

| Role | Person |
|---|---|
| Program lead | unassigned |
| Native (Rust/Tauri) | unassigned |
| Release (CI, queue, stores) | unassigned |
| Curriculum | unassigned |
| Engine (learner model) | unassigned |
| Experience | unassigned |
| Nightly harness owner (`A-19`) | unassigned |
| Art director (`Q-14`) | unassigned |
| Founder | Skylar Saveland |

## Incident log

Empty. Record here: any PR over 200 files (R-01), any use of the `admin-override`
break-glass label (R-16), any waived gate, and any Corpán production regression
attributable to a Dynawalla merge (`C-21`), and any waived acceptance item.
