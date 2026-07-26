# Dynawalla — Release engineering

CI topology, the merge queue, release triggers, build numbers, and the traps. This is the
operational document for anyone touching `.github/`.

## What is already right and must not be replaced

`ci.yml` documents the exact trap it solves: **a workflow-level `paths:` filter on a
required check leaves unrelated PRs "expecting" it forever and deadlocks the queue.** It
solves it with a cheap always-running `changes` job, `if:`-gated heavy jobs, and an
`if: always()` `ci-gate` aggregator that treats `skipped` as pass.

Keep it. **Required contexts stay exactly three: `ci-gate`, `adversarial-review`,
`hygiene`**, all on `pull_request` and `merge_group`, with no workflow-level `paths:`.
**Dynawalla adds jobs to `ci-gate.needs`, never a fourth context** (`C-01`).

`dorny/paths-filter` is rejected — this repo solved the problem in about 20 lines of
`git diff` and the solution is better than the action.

## Fix 1 — the adversarial reviewer

This is the highest-value change in the program, because the diff-size discipline that
makes constant merging safe is currently unenforced.

Three defects, all verified:

1. **It truncates and still reports green.** `adversarial_review.py:115` truncates at
   `MAX_DIFF_BYTES` (default 200,000). Measured: PR #521 was 850,261 diff bytes across
   186 files; the model saw 67 of them, stopping mid-alphabet, and the conclusion was
   `success`.
2. **It fails closed only when *all* lenses error.** The guard is
   `if errored == len(LENSES)`, so two of three lenses timing out yields a green required
   check on one lens' output.
3. **The provider is not what anyone assumes.** There is no `ANTHROPIC_API_KEY` among the
   repository secrets and no repository variables at all, so `provider_and_key()` falls
   through to the OpenAI key and a hardcoded default model.

**One PR fixes all of it** (PR-0a.2): truncation exits non-zero with
`::error::diff too large to review — split this PR`; **any** lens error fails; the
resolved provider and model are printed into `$GITHUB_STEP_SUMMARY`; and a 1-token ping
asserts the model responds before spending three full-diff calls. `MAX_DIFF_BYTES`
becomes a repo *variable* starting at 400,000. The hardcoded app version in the prompt is
replaced by a read of `tauri.conf.json`.

**Break-glass:** an `admin-override` label that a named bypass actor can apply, so a
provider outage does not freeze the trunk. Every use of it goes in the `STATUS.md`
incident log — the override is the thing that will be abused.

**Fork PRs:** when no key is present **and** the head repo is a fork, print
`::notice::fork PR — maintainer review required` and exit 0, paired with `CODEOWNERS`
and a fork-only required approval.

**Failing on truncation is chosen over chunking deliberately.** It mechanically enforces
the small-PR discipline that trunk-based development requires. Budget: ~122 PRs × 3
lenses × ~2.5 evaluations ≈ 900 model calls.

## Fix 2 — `ci.yml` fails closed on unknown paths

The area filters are a hand-maintained allowlist with no catch-all. `dynawalla/**`
matches none of them, so a Dynawalla PR would run zero jobs and pass green. A live
instance of the same bug already exists: `corpan/packs/shared/**` sets `packs=true`, but
the changed-packs step skips any pack directory without a `package.json`, and
`corpan/packs/shared/package.json` does not exist — while nine Corpán app files import
from it.

Add an `uncovered` step that fails on any changed file matching no area pattern and no
explicit no-CI allowlist entry (`\.md$`, `books/`, `voices/`, the frozen book corpora,
`LICENSE`, image directories).

**It runs only on `pull_request`** (`if: github.event_name == 'pull_request'`). The
`changes` job diffs `merge_group.base_sha..head_sha`, which spans every entry in a batch,
so a fail-closed uncovered check inside the queue would eject up to five PRs under
`ALLGREEN` and re-run three model calls per entry on retry. **Path coverage is a property
of the individual PR and is fully knowable before enqueue** (`C-05`).

## Fix 3 — a real native gate that can actually execute

There is **no** native gate today: zero `cargo`/`clippy`/`rustup` invocation in any
required check.

The obvious design cannot run. `aarch64-apple-ios` needs macOS and Xcode (which is why
the existing non-required iOS workflow pins a macOS runner while every `ci.yml` job is
ubuntu); `aarch64-linux-android` needs the NDK, and the committed `.cargo/config.toml`
hardcodes a local NDK path that the release workflow sed-rewrites in CI; and `needs:`
cannot reference a job in another workflow, so a separate workflow can never feed
`ci-gate`.

**Both jobs live inside `ci.yml` so they can be `ci-gate` needs:**

- **`rust-linux`** (ubuntu, `if: native`): `cargo fmt --check`;
  `cargo clippy --all-targets -D warnings` and `cargo test` over `native/`; **plus
  explicit `--manifest-path corpan/corpan-app/src-tauri/Cargo.toml`** clippy and test,
  and the Dynawalla equivalent — otherwise the gate never compiles `corpan_lib`, which is
  the content-pack code, the blob store, the offline cache and the SIGSEGV breadcrumb,
  i.e. the exact code it exists to protect. Plus
  `cargo check --target aarch64-linux-android` using `android-actions/setup-android` and
  a config generated from `$ANDROID_NDK_HOME`. Plus the two `cargo metadata` vendored-fork
  assertions.
- **`rust-apple`** (macos-14, `if: native`): the per-plugin
  `cargo build --target aarch64-apple-ios` loop, lifted verbatim from the existing iOS
  workflow.

Then **delete `ios-native.yml`.**

Gating `rust-apple` behind the `native` filter is load-bearing: GitHub-hosted macOS bills
at a 10× minute multiplier and `ALLGREEN` re-forms groups on any failure, so an ungated
macOS job on every queue entry would become the dominant CI cost line, spent almost
entirely on PRs touching zero native code. A skipped job costs nothing and `ci-gate`
treats skipped as pass (`C-07`).

**`config.toml.in` must land before this job, not after.**

**New area filters:**

```
dynawalla_app        ^(dynawalla/dynawalla-app/|\.github/workflows/ci\.yml$)
dynawalla_curriculum ^(dynawalla/curriculum/|\.github/workflows/ci\.yml$)
dynawalla_engine     ^(dynawalla/engine/|\.github/workflows/ci\.yml$)
shared_ts            ^(shared/|corpan/packs/shared/)      # also sets corpan_app + dynawalla_app
native               ^(native/|.*/src-tauri/|corpan/plugins/)
```

## Merge queue

**Batched releases are silently dropped.** The current release trigger detects a release
by comparing `git show HEAD^:...tauri.conf.json`; the queue ruleset sets
`max_entries_to_merge: 5` with `ALLGREEN` and a 5-minute minimum wait. A version bump
batched with any later PR yields `release=false` and **nothing ships**.

**Move both apps to tag-triggered release** (`corpan-v*`, `dynawalla-v*`) plus
`workflow_dispatch`, keeping the path filter as belt (`C-11`, `C-12`).

### Build numbers do NOT change

`release-mobile.yml:176` (CFBundleVersion) and `:355` (versionCode) are
`$(( $(date +%s) / 60 ))` — about 29,750,000 today — with an in-file warning never to
revert to a derived scheme.

`github.run_number` is scoped to a workflow *file path* and restarts at 1 on rename. It
would **decrease** the build number, and Play rejects a versionCode that is not strictly
greater while ASC rejects the CFBundleVersion for the same short-version string. Because
the upload is the last step of a 60-minute macOS job, that surfaces as a red X at the end
of a release rather than at PR time.

**Keep minutes-since-epoch for both apps.** Add a **preflight** that queries the current
highest build (`androidpublisher edits.tracks.get`, ASC `/v1/preReleaseVersions`) and
hard-fails if the computed number is not strictly greater — turning a 60-minute discovery
into a 10-second one (`C-14`, `C-15`).

**Open risk introduced by the constant-merge cadence:** two release runs of the same app
in the **same minute** compute the **same** build number, and the second upload is
rejected as a duplicate. The preflight catches it in seconds; whether to move to
`max(preflight_highest + 1, minutes_since_epoch)` is an open decision that needs its own
PR and its own verification run. Do not fold it into an unrelated release PR.
See RISKS R-12.

### Where protection lives

**Protection lives in two objects, and most people edit the wrong one.**

- Required checks are in **classic branch protection**:
  `contexts: [ci-gate, adversarial-review, hygiene]`, `strict: true`,
  `enforce_admins: false`, `required_linear_history: true`.
- The merge queue is in **ruleset 18008260**.
- Ruleset **11721169** ("main") has only `deletion` and `non_fast_forward`.

Anyone told to "add the check to the main ruleset" edits ruleset 11721169 and silently
changes nothing.

**Migration is strictly ordered, scripted, and recorded with the revert payload written
FIRST** — deleting classic protection before the ruleset rule is verified leaves `main`
with an active merge queue and **zero** required checks, and auto-merge would drain the
queue unreviewed:

1. `PUT` `required_status_checks` into ruleset 11721169 with all three contexts.
2. Open a throwaway PR with a deliberately failing check; confirm the UI attributes the
   block to the **ruleset** rule.
3. Only then `DELETE /branches/main/protection`.
4. Re-run the throwaway PR; confirm it is still blocked.
5. Separately: `enforce_admins` via ruleset with one named break-glass bypass actor.

`strict: true` is confirmed set but empirically not blocking — the last 20 merges,
including 186- and 619-file PRs, all landed through the queue. Demoted from "bug" to
housekeeping: drop it while migrating, spend no more attention on it.

### Delete `pr-agent.yml` in the very first PR

It is the highest-severity supply-chain item in the repository: a second LLM reviewer
pinned to a **mutable** third-party action ref, holding `contents: write` +
`issues: write` + `pull-requests: write`, triggered by an **unfiltered** `issue_comment`
on a public repo that also holds Apple signing certs, an ASC API key and a Play service
account. Its own `/review`-only gate sits commented out. It duplicates
`adversarial-review`.

Then **SHA-pin every third-party action** with a trailing `# vX.Y.Z` comment, and set
`sha_pinning_required: true` (`C-10`).

## `deploy-pages.yml` — Corpán-only hygiene

427 lines, 14 hand-written `npm install --legacy-peer-deps` blocks (plus one more at
`ci.yml:245`, which is the one that also needs the per-pack `.npmrc`),
`concurrency: { group: "pages", cancel-in-progress: true }`, and a smoke workflow that
only runs on `conclusion == 'success'` — so a cancelled deploy is never smoke-tested.

**The per-pack-matrix idea is wrong and is replaced.** `upload-pages-artifact` publishes
`path: web/io/out` as a **whole-site artifact** that atomically replaces everything at
encorpora.io, and `git ls-files 'corpan/packs/*/*.zip'` returns **0** — every ZIP is
produced from source at build time. Building only changed packs would 404 every
unrebuilt pack's ZIP and `dist/` the instant it publishes: the drift.zip incident, for
every other pack at once. And immutable versioned URLs are structurally unachievable on
a source-rebuilt Pages site, because the artifact can only contain the version in the git
tree.

The two concerns split:

- **Build cost:** always assemble the COMPLETE site; use `actions/cache` keyed on a
  per-pack content hash to skip npm-install/build for unchanged packs, restoring the
  cached `dist/` + `.zip` into `web/io/out`.
- **Immutability:** move versioned pack ZIPs to the S3/CloudFront path this repo already
  operates for narration and phrase packs, where objects genuinely persist per version,
  and point the catalog there. Keep only a current-version convenience URL on Pages.
- **Prerequisite, not follow-up:** commit a `package-lock.json` per pack and switch both
  the deploy and CI to `npm ci`, with `--legacy-peer-deps` moved into each pack's
  versioned `.npmrc`. Unpinned installs mean a transitive publish can break the
  production deploy or silently change a shipped bundle with zero repo change.
- Emit **sha256** into the catalog at build time; move the complete-localization check
  out of the deploy build into a PR gate (so one missing locale on one pack cannot take
  down the publish of every pack plus the website); set `cancel-in-progress: false`.

Because Dynawalla V1 has **no downloadable packs**, all of this is M0b — parallel to
M1/M2 and blocking nothing Dynawalla does.

## Store pipelines

`release-mobile.yml` hardcodes `corpan/corpan-app` in 18 places, plus a Corpán signing
profile name and package name. Extract
`.github/workflows/release-mobile-reusable.yml` (`workflow_call`) with inputs
`app_dir, bundle_id, package_name, profile_name, product_name, runner, environment`.
**Corpán is the first caller** (which proves parity), Dynawalla second.

**Preserved verbatim, because each is load-bearing:** the `macos-26` runner and the
"select newest Xcode" step (the iOS 26 SDK has been required for uploads since
2026-04-28); manual signing with a self-written `ExportOptions.plist` and a self-run
`xcodebuild -exportArchive`; `jarsigner` on the unsigned AAB; the 16 KB page-size triple
belt; and minutes-since-epoch build numbers.

**Fail-hard on missing secrets lands BEFORE the environment migration.** Today the
workflow emits `::warning::`, skips every step and reports **success** — so a mis-scoped
secret produces a green run that ships nothing (`C-13`).

**`secrets: inherit` does not pass environment secrets.** It passes repository and
organisation secrets only; environment secrets resolve from the `environment:` key of the
consuming job **in the called workflow**. So the reusable workflow takes an `environment`
input and declares `environment: ${{ inputs.environment }}` per job. Environments:
`corpan-ios`, `corpan-android`, `dynawalla-ios`, `dynawalla-android`.

Credentials for Dynawalla are covered in [STORE.md](STORE.md). Nothing in this repository
ever contains a credential value; secrets are referenced by their GitHub secret **name**
only.

## No stage environment

GitHub Pages serves exactly one site per repository, so `stage.encorpora.io` is not
buildable here without a second repo. See
[ADR-0019](DECISIONS/ADR-0019-no-stage-environment.md).
