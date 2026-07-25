# Dynawalla — Risk register

Every risk has a mitigation and an owner. **Owners here are roles.** The person
holding each role is named in [STATUS.md](STATUS.md); a role with no name is itself an
open risk (R-33).

Roles: **Program** (program lead) · **Native** (Rust/Tauri/plugins) ·
**Release** (CI, merge queue, store pipelines) · **Curriculum** ·
**Engine** (learner model) · **Experience** (work surface, world, character) ·
**Founder** (decisions the program cannot make for itself).

Severity: **H** = can kill or void the program · **M** = costs a milestone ·
**L** = costs days.

---

## Process and evidence

### R-01 · H · Program
**The trunk law is documented but not practiced.** The root runbook has said "the
integration branch is dead" since 2026-06-22, and every merge since is a batched
release: 186, 160, 146, 269, 619 files. Declaring it again changes nothing.
**Mitigation:** the only binding mechanisms are (a) `adversarial-review` failing on
oversized diffs and on any lens error, and (b) `enforce_admins`. Both are in M0a.
Expect the first weeks to regress anyway; treat a >200-file PR as an incident and
write it up.

### R-02 · H · Founder + Program
**The playtest gates are the most likely thing to be waived, and waiving them voids the
program.** Recruiting six children with documented parental consent takes weeks and has
zero slots today. Compliance forbids remote A/B testing, so there is no substitute
instrument: if M2 ships without children, every judgement about pacing, reaction
budgets, the 0.80 difficulty target and "wrong must not be more fun than right" reverts
to being a claim about children that a simulator the team wrote cannot falsify.
**Mitigation:** recruitment starts in the bootstrap PR, not at M2.
See [PLAYTEST-PROTOCOL.md](PLAYTEST-PROTOCOL.md).

### R-03 · H · Program
**Merged is not done, and this repo has the counterexample.** Journey merged
2026-07-04, released in 0.20.1 on 07-07, and was unreachable by production users until
0.20.6 on 07-14 — five releases in seven days to unblock a feature that was green and
merged. **Mitigation:** every product milestone requires a named person to reach the
capability from a cold launch on a store build (`[device]` items in
[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)). If that is ever softened to "a test
asserts it," the plan reverts to measuring that code exists.

### R-04 · M · Program
**The V1 cut will be re-litigated under schedule pressure.** Geometry, measurement,
data, ratio and integers are out because their manipulation schemas do not exist.
Anyone who "adds geometry" without them is adding worksheets.
**Mitigation:** gate C-13 blocks a `conceptual`/`reasoning` skill from binding a
choice-only generator, and the marketing claim stays "grades 1–5 number and
arithmetic." [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) records why.

### R-05 · M · Curriculum + Program
**Breadth planned as manifest rows produces unmergeable PRs.** A `SkillNode` literal is
30–40 lines; "42 families in six PRs" is 5–20× the diff cap. Either the cap gets raised
until it means nothing, or the milestone silently becomes ~120 PRs against a list that
names 22. **Mitigation:** [MASTER_PLAN.md](MASTER_PLAN.md) states M7 at its honest
granularity — one family per PR, one domain per promotion PR, 25 PRs — and the PR
budget table is the number to plan against.

---

## Native and shared platform

### R-06 · H · Native
**The vendored-fork `[patch]` is the single highest-consequence mechanical trap.**
`corpan/corpan-app/src-tauri/Cargo.toml:73` holds `[patch.crates-io]` and **no manifest
in the repo has a `[workspace]` section**, so that file is its own implicit workspace
root. Cargo honours `[patch]` from the workspace root *of the package being built*, so
a patch relocated to `native/Cargo.toml` is silently ignored: Corpán reverts to upstream
`ndk-context`, whose `initialize_android_context` asserts and aborts the process on
Android Activity recreation (7+ users in 0.13.1), and to `-march=armv8-a`, losing the
Q4_K dotprod/fp16 kernels. **Both regressions compile, test and clippy clean.**
**Mitigation:** two `cargo metadata | jq -e` assertions in the required `rust-linux`
job proving both forks resolve under `native/vendor` for both apps, plus a device
prefill benchmark. **The residual risk is a future tidy-up:** anyone who "consolidates
the patch into the workspace" reintroduces it. That is why it is written here, in
[ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md), and in the
native-gatekeeper agent brief.

### R-07 · M · Native
**Renaming plugin identifiers is a runtime-only failure.** Capability grants name
permissions by Tauri plugin identifier, guest-JS invokes `"plugin:iap|initialize"`,
every crate carries `links = "tauri-plugin-<name>"`, and `tauri-plugin-game-packs` owns
the `corpan-pack://` scheme baked into installed packs' built JS on user devices. A
Cargo-only rename compiles and then fails with permission-denied on every native call.
**Mitigation:** the rename is deferred entirely and decoupled from the M3 move. If
pressure builds to do it "while we're in there," that pressure **is** the risk.

### R-08 · M · Native + Release
**Sharing native plugins couples the two apps' release cadences permanently.** Path
gating reduces workflow blast radius; it cannot reduce code blast radius. Any upgrade
Dynawalla needs rebuilds and re-risks Corpán's shipping binary.
**Mitigation:** per-plugin CHANGELOG + semver + the required rust job. The coupling is
structural and is accepted as the price of locked decision #4.

### R-09 · M · Native
**The crash-breadcrumb extraction is the one shared move `cargo check` cannot
validate.** Signal-handler chaining to `debuggerd` is not provable by compilation, and
getting it wrong turns every Corpán native crash into a lost tombstone.
**Mitigation:** Dynawalla adopts a **local copy** at M1; both apps switch only at M3,
after the rust gate covers `corpan_lib`, and the exit criterion is a forced crash
producing an attributable tombstone in a **Corpán** build (`X-09`).

---

## CI, merge queue and release

### R-10 · H · Release
**A path-gated required status check blocks the merge queue forever.** A required
context whose workflow has a workflow-level `paths:` filter never reports on PRs that
miss those paths, so those PRs sit "expecting" it indefinitely. `ci.yml` already
documents and solves this with an always-running `changes` job and an `if: always()`
`ci-gate` aggregator that treats `skipped` as pass.
**Mitigation:** Dynawalla adds jobs to `ci-gate.needs` and **never** a fourth required
context. Required contexts stay exactly `ci-gate`, `adversarial-review`, `hygiene`
(`C-01`).

### R-11 · H · Release
**Changing the build number gets the release store-rejected.**
`release-mobile.yml:176,355` derive it as `$(date +%s) / 60` — about 29,750,000 today —
and an in-file warning says never to revert to a derived scheme. `github.run_number` is
scoped to a workflow *file path* and restarts at 1 on rename, so switching to it
**decreases** the number; Play rejects the versionCode and ASC rejects the
CFBundleVersion. Because the upload is the last step of a 60-minute macOS job, it
surfaces as a red X at the end of a release, not at PR time.
**Mitigation:** keep minutes-since-epoch for both apps, and ship the preflight that
queries the current highest build and hard-fails in ~10 s if the computed number is not
strictly greater (`C-14`).

### R-12 · M · Release — **new, introduced by the constant-merge cadence**
**Minutes-since-epoch collides at one release per minute.** The scheme is monotonic and
safe at the historical cadence of a few releases a week. Under the founder's new
constant-merge law, two releases triggered in the **same minute** compute the **same**
build number — and two different apps releasing in the same minute do not collide
(different app records), but two runs of the same app do. A retried release run within
the same minute produces the same number and the second upload is rejected as a
duplicate. **Mitigation:** the preflight catches it in 10 s rather than 60 minutes and
tells you to wait a minute. **Open:** whether to move to
`max(preflight_highest + 1, minutes_since_epoch)` inside the reusable workflow. That is
a change to the number-generation scheme and needs its own PR, its own preflight run,
and a recorded decision — do not fold it into an unrelated release PR.

### R-13 · M · Release
**The full-site Pages artifact makes "build only changed packs" an outage, not an
optimisation.** `deploy-pages.yml` uploads `web/io/out` wholesale and no pack ZIP is
committed, so every ZIP is produced from source each run. Conditional emission 404s
every unrebuilt pack the instant the artifact publishes. Immutable versioned URLs are
structurally unachievable on a source-rebuilt Pages site for the same reason.
**Mitigation:** content-hash caching for build cost; S3/CloudFront for immutability
(M0b). **Residual:** if anyone reintroduces conditional emission, it is a
multi-pack outage — smoke only catches it after users see it.

### R-14 · M · Release
**A batched merge group silently drops a release.** The current release trigger detects
a version bump with `git show HEAD^:...tauri.conf.json`; the queue merges up to five
entries at once under `ALLGREEN`, so a version bump batched with any later PR yields
`release=false` and nothing ships. **Mitigation:** move both apps to tag-triggered
release (`corpan-v*`, `dynawalla-v*`) plus `workflow_dispatch`, keeping the path filter
as belt (`C-11`, `C-12`).

### R-15 · M · Release
**A fail-closed hygiene check inside the merge queue ejects innocent PRs.** The
`changes` job diffs `merge_group.base_sha..head_sha`, which spans every entry in a
batch. One entry touching an uncovered path fails `ci-gate` for the whole group under
`ALLGREEN`, ejecting up to five PRs and re-running three review model calls per entry.
**Mitigation:** the `uncovered` assertion runs only on `pull_request`. Path coverage is
a property of the individual PR and is fully knowable before enqueue (`C-05`).

### R-16 · M · Release
**`adversarial-review` is a cost, latency and single-point-of-failure line.** ~121 PRs
× 3 lenses × ~2.5 evaluations is ~900 model calls against a 60-minute timeout, and the
gate now fails on **any** lens error. The key in use is an OpenAI key last rotated
2025-03-22 against a hardcoded default model; when that model retires, every PR blocks.
**Mitigation:** an explicit model repo-variable, a 1-token startup ping, the resolved
provider printed to the step summary, and a named-actor `admin-override` break-glass
label. **The override is the thing that will be abused** — every use should appear in
`STATUS.md`.

### R-17 · M · Release
**Deleting `ios-native.yml` and adding `rust-apple` to `ci-gate` puts a macOS runner in
the queue.** It is gated on the `native` filter and a skipped job is free, but a filter
regression makes a 10×-billed macOS job run on every queue entry, amplified by
`ALLGREEN` re-forming groups on any failure.
**Mitigation:** watch the first month's CI bill; `C-07` asserts `rust-apple` is skipped
on a docs-only PR.

### R-18 · L · Release
**Fork PRs are a posture problem, not only a gate problem.** With
`required_approving_review_count` at 0 there is no human reviewer culture to fall back
on when the automated reviewer is bypassed for a fork.
**Mitigation:** no key + fork head → `::notice::` + exit 0, paired with `CODEOWNERS`
and a fork-only required approval. Whether fork PRs are wanted at all depends on
[ADR-0014](DECISIONS/ADR-0014-repository-license.md).

### R-19 · L · Release
**Production pack builds are unpinned.** Fifteen hand-written
`npm install --legacy-peer-deps` blocks mean a transitive publish can break the
production deploy or silently change a shipped bundle with zero repo change.
**Mitigation:** PR-0b.1 commits a lockfile per pack and switches to `npm ci`.

---

## Curriculum

### R-20 · H · Curriculum
**Curriculum will still outrun capability, now on two axes.** C-7 (generator ownership)
was the original defence. A generator can emit a perfectly valid `Exercise` the app
cannot render (C-8), and the easiest way to satisfy C-7 for conceptual content is to
make everything multiple choice (C-13).
**Mitigation:** all three gates are required from the **first** curriculum PR, not
retrofitted.

### R-21 · H · Curriculum
**Floating point in a generator produces deterministically wrong answers.**
`0.1 + 0.2 !== 0.3` marks correct decimal work wrong, and because it is deterministic
no flaky-test signal ever fires.
**Mitigation:** exact integer/rational arithmetic everywhere and a lint banning bare
float ops in `curriculum/` and `engine/`. **Residual:** lints are easy to suppress —
a suppression comment in those two directories should be treated as a review blocker.

### R-22 · H · Curriculum + Experience
**Locale number notation is content, and the repo has zero prior art.** No
`Intl.NumberFormat` or `toLocaleString` use exists anywhere in the Corpán app, and no
CLDR plural-category keys exist across 55 locale dirs. Rendering `1.000` as one thousand
to a French child, or rejecting `3,5`, teaches notation that is wrong in the child's own
classroom — on the exact domain where notation **is** the content. The repo's track
record on deferred localization is documented: three shipped readers at 0/54 localized
UI. **Mitigation:** `NumberFormat` is M2, not M9, and drives `judge`; gate C-14 is the
round-trip proof (`Q-07`, `M-10`).

### R-23 · M · Curriculum
**Platform determinism drift.** Generators run in a Tauri WebView on iOS, Android and
desktop. Any `Math.random`, any `Intl` inside generation, or any key-order assumption
produces different exercises per device and breaks bug-report reproduction.
**Mitigation:** own seeded PRNG with pinned known-answer vectors; C-16 output-hash
snapshots on macOS **and** Linux CI. **Residual:** C-16 does not run on a real Android
WebView. A device spot-check belongs in the M7 device pass.

### R-24 · M · Curriculum + Experience
**The mal-rule catalogue is uneven and so is LOCATE.** Evidence is deep for multi-digit
subtraction, decent for the mult/div algorithms, thin for fractions and word problems —
and only ~8–12 mal-rules get a genuine contrast representation.
**Mitigation:** where evidence is thin, default to "unclassified error" and a faded
worked example. Never invent a bug. Gate C-22 keeps the LOCATE count checkable, and any
public claim must match the Developer Mode number (`M-15`).

### R-25 · L · Curriculum + Founder
**Standards text is copyrighted and the repo is public.** CCSS text is licensed by NGA
Center/CCSSO for purposes supporting the Initiative and requires a specific notice.
**Mitigation:** store codes only, author all prose originally, keep C-20 report-only.
A public *alignment claim* is a separate exposure —
[ADR-0010](DECISIONS/ADR-0010-standards-alignment-claim.md).

---

## Engine

### R-26 · H · Engine
**The parametric `b()` is the engine's single point of failure.** The original
reliability gate was circular: the engine computes `σ(θ − b)` and the persona answered
from `σ(α − b)` against the same `b`, so it passed by construction.
**Mitigation:** personas answer from a 3PL with per-child discrimination and item
features the engine cannot observe, plus one explicit misspecification persona, plus
real-child residuals from the M2 playtest fitted before content breadth is bought
(`A-01`, `A-02`). **Residual:** if the M2 residual fit is skipped "until there is more
content," the engine is unvalidated all the way to launch.

### R-27 · M · Engine
**The harness is a nightly job with a named owner or it is nothing.** Corpán's measured
25 × 180 × 7 run is 315.8 s; ten personas × 100 children × 3 seeds is 30–80 minutes. It
cannot be a per-PR check, and an unwatched nightly is a gate that silently stops gating.
**Mitigation:** named owner + paging path (`A-19`); PRs run a 3-persona × 20-learner
smoke.

### R-28 · M · Engine
**Gate-tightness trap, with in-repo precedent.** Corpán set 11 ship gates; three were
mathematically unsatisfiable under any scheduler because the synthetic learner had
**fixed ability**, costing two calibration rounds plus a spec amendment.
**Mitigation:** Dynawalla's synthetic child acquires skill from day one; every gate is
labelled REGRESSION BOUND (derived from a pilot run) or PEDAGOGICAL ASSERTION (derived
from theory); "a different marginal leg fails on each seed" is a FAIL, not noise
(`A-14`).

### R-29 · M · Engine
**FSRS keyed on instances degenerates spaced review into random practice, invisibly.**
Generated exercises have no stable id. Naive reuse of a per-item scheduler key would
create a new card for every generated instance and never review anything.
**Mitigation:** cards are keyed on **classes** (`skill:<id>#L<level>#<formId>`), card
creation is gated on the fluency signal `φ_s`, and the rating is a function of
`(correct, latency)` — a scheduler that cannot distinguish computing from recalling
models a construct a grade 1–3 child does not have.

---

## Experience

### R-30 · H · Experience
**Wrong being more fun than right, and streak psychology re-entering by copy-paste.**
The reaction picker being ported escalates on `comboCount`, which is exactly the loop
this product bans. **Mitigation:** a unit test asserts the weight function's signature
takes no run-length or streak argument; `energy(SLIP) < energy(SEAT)` is unit-tested.
**Residual:** both are proxies a determined designer can satisfy while still making
failure the interesting moment — playtest for both specifically (`T-01`).

### R-31 · M · Experience
**World DOM explosion.** Procedural girih at 500+ answers becomes tens of thousands of
live SVG nodes and will stall a mid-range Android WebView.
**Mitigation:** rasterize-to-snapshot lands **first** in M6 with a ~1,200-node cap and
a failing perf test above it. If it slips behind the art PRs, the world ships and then
has to be rebuilt (`Q-02`).

### R-32 · H · Experience + Founder
**The art direction has the highest slop risk in the program.** Procedural girih plus a
brass-and-lapis palette is precisely the recipe that renders as a gradient dashboard
with gear icons, and code review cannot see it.
**Mitigation:** committed screenshots reviewed as **images** in the PR, a hostile
reference board naming what it must not look like, three strangers who must not say
"dashboard" or "template," and a **named** art director whose sign-off is an exit
criterion (`Q-14`). Without a named art director this risk has no mitigation at all.

### R-33 · M · Experience
**The character is the differentiation claim and is easy to under-build.** ~100
combinatorial fragments plus a 3–5-per-session rarity budget is the plan; falling back
to a flat line pool reproduces the in-repo precedent that resolves to
"Perfect / Nice / Brilliant / Boom / Nailed it" and reads as broken rather than laconic.
**Mitigation:** `P-06` requires ≥200 distinct true utterances across the persona corpus
and no repeat within a session.

---

## Compliance, store and operations

### R-34 · H · Founder
**Apple's Kids Category is a one-way door.** Guideline 1.3 states the requirements
continue to bind "in subsequent updates, even if you decide to deselect the category."
**Mitigation:** it must be decided before M1's first submission
([ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md), `G-01`). The engineering plan
already assumes the strict posture, so choosing **in** costs nothing extra; choosing
**out** is the decision that would let constraints relax.

### R-35 · M · Program
**Child-directed compliance constrains engineering, not paperwork.** Play's Families
Policy forbids transmitting AAID/IMEI/MAC/phone number and collecting precise location
from child users; Apple 1.3/5.1.4 bars third-party analytics and advertising outright.
Every dependency addition becomes a compliance decision.
**Mitigation:** the CI dependency audit is the only mechanical enforcement (`G-05`,
`G-06`).

### R-36 · M · Release
**The Play package name is locked by the first uploaded AAB.** If a Tauri-default or
`com.corpora.dynawalla` applicationId leaks into the first upload, the convention is
dead for that app record without Google support.
**Mitigation:** verify the generated Gradle applicationId **before** the first upload —
`X-03` exists for this reason alone.

### R-37 · M · Release
**Two founder browser clicks are unavoidable and on the critical path.** Apple
`POST /v1/apps` returns 404 and an ASC API key gets 403 on create; the Play
`androidpublisher` v3 discovery document has no application-create method. The ASC API
key almost certainly needs re-minting at Admin role, and the existing Play service
account needs an explicit per-app permission grant on the new record.
**Mitigation:** schedule the ~10 minutes of founder console time as an M1 task, not a
surprise (`G-09`).

### R-38 · L · Release
**Play's first-release draft gate will bite.** On a never-published app the API can only
create draft releases. This is Google's anti-abuse gate, not a code bug, and should not
be debugged as one. **Mitigation:** budget one Console-side publish (`G-10`).

### R-39 · L · Release
**Play target API 36 is mandatory for new apps from 2026-08-31.** A Tauri template
default below 36 is rejected outright. **Mitigation:** Dynawalla ships at 36 from
PR-1.2, so this is don't-regress rather than migrate (`X-05`).

### R-40 · M · Native + Release
**Two bundle-id conventions coexist permanently.** `com.corpora.corpan` is immutable in
both stores; Dynawalla is `inc.corpora.dynawalla`. Any tooling deriving paths, keychain
entries, `os_log` subsystems or store lookups from a bundle-id prefix must take it as a
parameter — a `corpan`-prefixed literal already appears in 7+ Rust/Swift/Kotlin sites.
**Mitigation:** parameterize at every such site touched during M3; do not attempt a
sweeping rename (see R-07).

### R-41 · L · Program
**Build-environment version drift.** `corpan-app` uses Node 24, packs/lambda/web use
Node 20, the local machine runs 22, and the test runner depends on
`--experimental-strip-types`, whose behaviour differs across those majors. A job on the
wrong Node fails in ways that look like code bugs.
**Mitigation:** Dynawalla pins Node 24 via `.nvmrc` + `engines`.

### R-42 · L · Program
**Disk exhaustion is a realistic operational failure.** `corpan/` alone is ~179 GB of
working tree with a 52 GB root `target/`, and constant worktree creation multiplies it.
**Mitigation:** the worktree-guard hook warns above a worktree count; shared-target and
symlinked-`node_modules` discipline from day one; worktrees live **outside** the repo
directory.

### R-43 · M · Founder
**The repo is public with no license.** GitHub reports `license: null` and no `LICENSE`
file exists, while several shipped decisions rest on "it's open source anyway."
**Mitigation:** a `LICENSE` placeholder lands in the bootstrap PR pointing at
[ADR-0014](DECISIONS/ADR-0014-repository-license.md); the real decision is the
founder's and counsel's.

### R-44 · M · Program
**A role with no name is a gate that does not run.** Three roles in this register are
currently unassigned, and two acceptance items (`A-19` nightly harness owner, `Q-14` art
director) name a person as their pass condition.
**Mitigation:** [STATUS.md](STATUS.md) carries the role→person table and is updated in
the PR that changes it.
