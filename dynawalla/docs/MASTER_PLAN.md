# Dynawalla — Master Plan

Milestones in dependency order. Each decomposes into PR-sized units with objectively
verifiable exit criteria. Read with [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
open; the ids in brackets (`P-03`, `M-14`, …) point at it.

Current position: [STATUS.md](STATUS.md).

---

## The reset of 2026-07-26, and what it does to every milestone below

The founder ruled that the core app ships **zero content**: every exercise, game,
world and asset is a pack, and the app is a shell around them
([ADR-0022](DECISIONS/ADR-0022-host-ships-no-content.md)). That reversed
ADR-0003 and ADR-0004, which the program had adopted without him
([ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md),
[ADR-0021](DECISIONS/ADR-0021-pack-capabilities-are-per-pack.md)).

**This plan is not re-numbered here, and it is not quietly re-pointed either.**
What each milestone is now aimed at:

| Milestone | Effect of the ruling |
|---|---|
| M0a, M0b, M1, M3 | Unaffected. Trunk hygiene, store records and the native move are the same work. |
| **M2 — the vertical slice** | **Done and then deleted.** The bundled practice loop was built, shown to the child, and rejected. The shell that remains is the host: five real destinations, profiles, storage, the pack registry and the pack boundary. Its exit criterion — a child reaching something real from a cold launch — is now a criterion about a *pack*. |
| **New: the pack runtime** | Install, verify, update, remove and mount. Native, and the largest single unit of work now on the critical path. It did not exist in this plan because ADR-0003 removed it. Start from `corpan/plugins/tauri-plugin-game-packs` and `corpan/packs/{sdk,shared}`, not from scratch. |
| M4 — curriculum kernel | Unaffected as *work*, re-aimed as *output*: `dynawalla/curriculum/` becomes a library packs import rather than an artifact bundled into the app. The `CG-*` gates are unchanged. |
| M5 — the adaptive engine | The engine stays the host's, because the host is what follows a learner across packs. It is unwired until a pack declares a skill catalog; the harness and its gates are unaffected. |
| **M6 — the world and the character** | Split. The construction survives in the host as the progress figure, written by packs through the boundary. The character and the reaction layer are gone from the host — juice belongs to the thing being juicy, and the first packs get to define what that is. |
| M7, M8 — breadth and diagnosis | Pack work. Mal-rules and contrast representations are content, and content is a pack's. |
| **M9 — profiles, parents, accessibility** | Substantially **pulled forward and delivered**: profiles are real (add, name, switch, remove, erase), the parent area exists, settings act on the document and on packs. What is left of M9 is i18n fill and the parental gate. |
| M10 — store readiness | Unaffected in shape. What ships is the host plus its first packs. |

**The sizing law below still holds and now bites somewhere new**, though not for
the reason first written. There is no cap to be "over": a pack is a diff too,
and an ambitious one is simply a large diff, which the gate reviews in full. The
reason to keep it small is that a reviewer holds one idea at a time. Pack work
is planned at the same honest granularity as curriculum work: a slice per PR,
not a world per PR.

---

## The sizing law, and why it changes the plan

Trunk-based development is not a style preference here — it is the enforcement
mechanism. Its rule is about *where changes come from*, not how big they are:
**local `main` only ever moves by fast-forward from `origin/main`**, and every
change reaches it as worktree → remote branch → PR → squash-merge → pull.

There is **no diff cap**. `adversarial-review` chunks a diff and asserts it
reviewed 100% of it before making a model call, so a large PR is reviewed in
full or the check fails. (This paragraph used to promise a hard cap that
**fails** above `MAX_DIFF_BYTES`; that was the M0a plan, chunking replaced it,
and `MAX_DIFF_BYTES` no longer exists. Do not split a PR for size.)

That has a consequence the first draft of this plan missed, and it is the single
largest correction carried into this document:

> **Curriculum breadth planned as manifest rows is a defect.** A `SkillNode` literal
> with its ~20 fields is 30–40 lines. "Ship 42 generator families in six PRs" and
> "promote 390 nodes in four PRs" are each 5–20× the size any one reviewer can hold
> in their head. The milestone silently becomes 120 PRs against a list that names
> 22, discovered mid-flight.
>
> (As first written this argued from a hard diff cap that the gate would enforce.
> The cap is gone — diffs are chunked and reviewed in full — but the conclusion is
> unchanged and now rests where it always should have: on what a human can review,
> not on what a script will truncate.)

So the plan is stated at its honest granularity: **one generator family per PR** (~600–1,200
lines each), **one domain per node-promotion PR**, **mal-rules in batches of ~10–14**.
M4 is 17 PRs and M7 is 20, not the 11 and 15 the first draft named. The named PR count
in the budget table below is **~122** and it is the number to plan staffing and CI budget
against, not a floor. See [RISKS.md](RISKS.md) R-01, R-05.

The second correction of the same kind: **the V1 scope cut is deliberate and
load-bearing** — six domains, ~160 active skills, 18 generator families, four answer
schemas, four representations and five launch locales. (Its sixth clause — "no
downloadable content packs" — was reversed on 2026-07-26; packs are the delivery
mechanism now, see the table above.) Geometry, measurement, data, ratio and integers are V2 because their
interactions (`dragPlace`, `drawSegment`, `dialRead`, `buildChart`) do not exist and
cannot be laundered into multiple choice. Gate CG-13 exists to stop exactly that
laundering. The cut itself narrows the founder-stated grade range, so
[ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) is `Proposed — awaiting founder`: this
plan is written against option A and says so, but M4 should not buy breadth against one
grade range while the other is still live.

---

## Dependency graph

```
M0a ──┬── M0b (parallel, blocks nothing in Dynawalla)
      └── M1 ── M2 ──┬── M3
                     ├── M4 ── M5 ──┐
                     └──────────────┴── M6 ── M7 ── M8 ── M9 ── M10
```

`M3` (the native move) depends on `M0a` and `M2`: on `M0a` for a native CI gate that
can actually fail, and on `M2` for a second real consumer, so the move is verified by
two apps rather than asserted.

`M5` deliberately lands gate **EG-5** before the scheduler. Everything downstream
measures the wrong thing if `b()` is not real.

---

## M0a — Harden the trunk (additive only)

**Goal.** Close the fail-open gates and make the repo tell the truth, with changes that
are purely additive to Corpán's delivery path. Everything depends on this; nothing here
touches the CDN or Corpán's release ritual.

**Depends on:** nothing.

| PR | What |
|---|---|
| 0a.1 | Bootstrap: docs (this set), `.claude/` agents/skills/hooks/commands + `.gitignore` negations, PR and issue templates, `LICENSE` placeholder, the deprecated-methodology expunge, five inert `ci.yml` area filters, `uncovered` in **warn** mode, **delete `.github/workflows/pr-agent.yml`**, and `dynawalla/tools/check-docs-refs.mjs` — every `R-NN`, `CG-NN` and `EG-NN` reference resolves to a real heading or gate row, and every acceptance id is claimed by a milestone exit list. This class of drift already happened once in the draft. |
| 0a.2 | `adversarial_review.py`, four fixes in one PR: truncation exits non-zero with `::error::diff too large to review — split this PR`; **any** lens error fails (today only all-lenses-fail closes, so two of three timeouts pass green); the resolved provider+model printed to `$GITHUB_STEP_SUMMARY`; a 1-token model ping before spending three full-diff calls. `MAX_DIFF_BYTES` becomes a repo variable at 400,000. Adds the fork-PR path and an `admin-override` break-glass label. **SHIPPED, but the truncation item was superseded:** the diff is CHUNKED with asserted 100% coverage instead of failing above a cap, so there is no size limit and no split-the-PR error. `MAX_DIFF_BYTES` no longer exists. |
| 0a.3 | Flip `uncovered` to failing, gated `if: github.event_name == 'pull_request'`; explicit no-CI allowlist; PR-size advisory step. |
| 0a.4 | `.cargo/config.toml` generated from `config.toml.in` resolving `$ANDROID_NDK_HOME`, replacing the hardcoded local NDK path. Keeps the `linker = "/usr/bin/cc"` Apple pins. **Must land before 0a.5.** |
| 0a.5 | Native CI gate **inside `ci.yml`** so it can be a `ci-gate` need: `rust-linux` (ubuntu, `if: native`) = fmt + `clippy -D warnings` + test over `native/` **and** explicitly over `corpan/corpan-app/src-tauri/Cargo.toml`, plus `cargo check --target aarch64-linux-android`, plus the two `cargo metadata | jq -e` vendored-fork assertions; `rust-apple` (macos-14, `if: native`) = the per-plugin `aarch64-apple-ios` loop lifted from `ios-native.yml`. **Delete `ios-native.yml`.** |
| 0a.6 | `shared_ts` wiring + SHA-pin every third-party action, then `sha_pinning_required: true`. Give `corpan/packs/shared` a `package.json` so `changed-packs` stops skipping it. |
| 0a.7 | **Settings, not a PR.** Scripted `gh api` migration of required checks from classic branch protection into ruleset `11721169`, with the revert payload written first, in the strict order in [RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md). Create the four store environments. |

**Why `pr-agent.yml` goes first, not seventh.** It is the repo's only unpinned mutable
third-party action holding `contents: write` + `issues: write` + `pull-requests: write`,
triggered by an *unfiltered* `issue_comment` on a public repo that also holds Apple
signing certs, an ASC API key and a Play service account. Any commenter on any issue
can invoke it. Its own `/review`-only gate is commented out. It duplicates
`adversarial-review`. It is a one-line file removal with no dependencies.

**Exit criteria:** `C-01`, `C-02`, `C-03`, `C-04`, `C-05`, `C-06`, `C-07`, `C-08`,
`C-09`, `C-10`, and `G-03` `[founder]`. Plus: `rg -n -i -e 'moonshot-15-plus-v2'
-e 'app-store-prep' -e 'Branch: \`journey\`' -e 'towards-17-final' --glob '*.md'
--glob '!books/**'` returns zero hits. Plus the docs cross-reference check from PR-0a.1
is green: every `R-NN` reference in `dynawalla/docs/**` resolves to a `### R-NN` heading,
every `CG-`/`EG-` reference resolves to a row in [GATES.md](GATES.md), and every
acceptance id in [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) is claimed by at least
one milestone's exit criteria.

---

## M0b — Corpán delivery hygiene (parallel)

**Goal.** Make Corpán's CDN and release path safe under constant merging.

**Depends on:** M0a. **Blocks:** nothing in Dynawalla — V1 ships no packs.

| PR | What |
|---|---|
| 0b.1 | Pin pack installs: a `package-lock.json` per pack; `deploy-pages.yml` (14 sites) and `ci.yml` (1, at `ci.yml:245`) switch to `npm ci`; `--legacy-peer-deps` moves into each pack's versioned `.npmrc`. Prerequisite for the rest. |
| 0b.2 | Build cost: keep the **full-site** artifact; use `actions/cache` keyed on a per-pack content hash to skip npm-install/build for unchanged packs, restoring the cached `dist/` + `.zip` into `web/io/out`. `cancel-in-progress: false`. |
| 0b.3 | Immutable pack versions on the S3/CloudFront path this repo already operates; `catalog-v3` points there; Pages keeps only a current-version convenience URL. Emit sha256 at build time. |
| 0b.4 | Move `requireCompleteLocalization` out of the deploy build into a PR gate. |
| 0b.5 | Extract `release-mobile-reusable.yml` (`workflow_call`); `release-corpan.yml` calls it, **tag-triggered** on `corpan-v*` with `workflow_dispatch` fallback. Both jobs **fail hard** on missing secrets instead of warning and reporting success. Lands before any secret moves into an environment. |
| 0b.6 | Store-build preflight: query the current highest build and hard-fail if the computed number is not strictly greater. |
| 0b.7 | Scope the store secrets into the protected environments; the reusable workflow declares `environment: ${{ inputs.environment }}` per job. |

**Two corrections carried here, both verified against the repo.**

1. **Do not "build only the changed packs."** `deploy-pages.yml` uploads `web/io/out`
   as a **whole-site** Pages artifact that atomically replaces everything at
   encorpora.io, and no pack ZIP is committed — every ZIP is produced from source at
   build time. Conditional emission would 404 every unrebuilt pack's ZIP and `dist/`
   the instant the artifact publishes: the drift.zip incident, for all other packs at
   once. Immutable versioned URLs are structurally unachievable on a source-rebuilt
   Pages site for the same reason, which is why they move to S3/CloudFront.
2. **Do not change the build number.** `release-mobile.yml:176,355` derives it as
   `$(date +%s) / 60` — about 29,750,000 today. `github.run_number` is scoped to a
   workflow *file path* and restarts at 1 on rename, so switching to it **decreases**
   the number and gets the release rejected by both stores. The in-file warning says
   never to revert to a derived scheme. Keep minutes-since-epoch for both apps and add
   the preflight. See [RISKS.md](RISKS.md) R-12 for the new collision risk that the
   constant-merge cadence introduces.

**Exit criteria:** `C-12`, `C-13`, `C-14`, `C-15`, `C-16`, `C-17`, `C-18`.

---

## M1 — Dynawalla exists and ships to both stores

**Goal.** Retire mobile-build and store-bootstrap risk for `inc.corpora.dynawalla` with
an empty shell, using **zero shared native code**, so this cannot be blocked by or
destabilize Corpán.

**Depends on:** M0a.

| PR | What |
|---|---|
| 1.1 | Skeleton: the `dynawalla/` tree, Vite + React 19 + TS + Tailwind 4, react-router v7 `createHashRouter` with placeholder routes, `.nvmrc` pinning Node 24 + `engines`, `node --experimental-strip-types --test` with one passing test, tsconfig paths. |
| 1.2 | Tauri shell: `identifier inc.corpora.dynawalla`, **non-null CSP**, narrow `capabilities/default.json` (no plugins), iOS 16.0 + `ITSAppUsesNonExemptEncryption:false`, Android minSdk 26 / compileSdk 36 / targetSdk 36, release profile, 16 KB page-size flags, and its **own** `[patch.crates-io]` in its own independent workspace root with its own `Cargo.lock`. |
| 1.3 | Android production fixes ported day one: the `LaunchGateActivity` WebView trampoline, the 19-entry `configChanges` list, `prevent_exit()` on `ExitRequested`, and a **local copy** of the crash-breadcrumb signal handler. These live in `gen/android` and `lib.rs`, not in any plugin, so a plugin-only extraction at M3 would silently miss all four. |
| 1.4 | Parental-gate primitive: one `<ParentalGate>` component + route guard, in the shell, before any link-out or purchase surface exists. |
| 1.5 | CI + release: the three Dynawalla filters failing closed; a `dynawalla-app` job in `ci-gate.needs`; `release-dynawalla.yml` calling the reusable workflow, tag-triggered on `dynawalla-v*`; `shared/tooling/bump-version.mjs` parameterized (Corpán migrates in the same PR, one line). |
| 1.6 | i18n gate at **zero keys**: `shared/i18n-gate/check-i18n.mjs` parameterized by locale root + reference locale, with CLDR plural-category checking; five locale dirs; compile-time key typing; wired into `npm run build`. Corpán migrates in the same PR. |

**Why the parental gate lands now.** It costs one component today. Retrofitting it at
M10 is a navigation-model change across every purchase and link-out surface, under
launch pressure, which is how a gate becomes a checkbox.

**Two founder browser clicks are on the critical path.** Apple `POST /v1/apps` returns
404 and an ASC API key gets 403 on create; the Play `androidpublisher` v3 discovery
document has no application-create method. M1 cannot complete without roughly ten
minutes of founder time in two consoles. See [STORE.md](STORE.md).

**Exit criteria:** `X-01`, `X-02`, `X-03`, `X-04`, `X-05`, `X-06`, `X-07`, `C-11`,
`C-19`, `C-22`, `G-01`, `G-09`. Plus `Q-08` at zero keys.

---

## M2 — The vertical slice, in front of a child

**Goal.** Prove or kill the actual thesis: that a child gets something here they cannot
get from a drill app. One skill cluster — **subtraction with regrouping across zero** —
end to end: locale-correct entry, three mal-rules, the Stage-2 LOCATE contrast pair,
visible construction, the character. And a real child playing it, unhelped, on a store
build ([ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md)). The slice was
chosen before the evaluator was, and it happens to sit squarely in his range — the
highest-uncertainty content in V1 is the content that can actually be observed.

**Depends on:** M1.

**This is the plan's largest structural correction.** The first draft made M2 three
generator families, a keypad and a reaction layer, with adaptivity at M5, diagnosis at
M8 and the world at M6 — i.e. a randomly-ordered arithmetic drill with juice. If that
is boring you learn nothing (the interesting parts were scoped out); if it is fun you
also learn nothing (juice on drill is commoditized). The M8 exit criterion "identifies
borrow-across-zero and serves a contrast pair within 3 cards" moved **up** to here.

| PR | What |
|---|---|
| 2.1 | `shared/kernel`: `rng.ts` (FNV-1a + mulberry32 with pinned known-answer vectors), `clock.ts`, `boundary.test.ts`. Corpán migrates its three imports in the same PR. Deliberately the first engine-adjacent code, before any model logic. |
| 2.2 | `src/number/` `NumberFormat`: decimal separator, grouping separator, numbering system, numeral direction, for all five launch locales. Drives keypad glyphs, the slate renderer **and `judge`**. Property tests round-trip format→parse. |
| 2.3 | Answer schema + `judge`: `integer` and `columnAlgorithm` only. Exact integer/rational `AnswerValue` with a lint banning bare float ops in `curriculum/` and `engine/`. Includes the test asserting no schema exposes `canonical.length` to the input layer. |
| 2.4 | Work surface: problem slate on a fixed tabular grid (no reflow between digit counts), keypad on `pointerdown` with `touch-action: manipulation` and ≥2 cm targets, `columnAlgorithm` borrow grid forced `dir="ltr"` with a test. Design tokens. |
| 2.5 | Read-aloud: WebView `speechSynthesis` for problem text and character lines, behind an injectable seam so the native plugin drops in at M3. |
| 2.6 | Reaction layer: one `pointer-events:none` canvas, `Reaction` interface with `settleNow()`, the five-tier budget map, energy-weighted non-repeating picker, reduced-motion branch, pre-allocated particle pools. |
| 2.7 | Feel: asset-free Web Audio synth with a speech-collision gate; haptics stubbed until M3. |
| 2.8 | `gen.arith.column-op`, seeded and pure, `PromptSpec` output, committed cross-platform output-hash snapshots, parameterized to reach the across-zero case. |
| 2.9 | Three executable mal-rules: `mis.add.smaller-from-larger`, `mis.add.borrow-across-zero`, `mis.add.carry-dropped`, each ≥95% divergent, wired as principled distractors. |
| 2.10 | Stage-2 LOCATE for borrow-across-zero: the counting-board contrast pair. The product's namesake capability, in the first playable build. |
| 2.11 | Construction + character slice: a 20-answer chamber that visibly assembles and never regresses; the child **chooses** which chamber to start; ~12 combinatorial character fragments over 3 observation types, in all five locales. |
| 2.12 | Loop assembly + bench: present/commit/settle/present concurrency, on-deck buffer in `requestIdleCallback`, headless bench; per-profile storage namespace. |

**Why read-aloud is here and not at M9.** Grade-1 content ships at M4. A six-year-old
cannot read the prompts. Read-aloud is the input method, not an accessibility nicety;
without it, every pacing target and persona gate for grades 1–2 is measured against a
child who does not exist. It also ships with **no child observation behind it** — the
program's one evaluator is 10 — so `Q-11` is an adult-proxy device check and the grade
1–2 gap is carried openly as R-46 rather than assumed away.

**Why `NumberFormat` is here and not at M9.** Math notation is content. `1.000` means
one thousand to a German child and one to an English one, and a French child writing
three-and-a-half writes `3,5`. The repo has zero prior art — no `Intl.NumberFormat`
use anywhere and no CLDR plural keys across 55 locale dirs — and its track record on
deferred localization is documented. See [RISKS.md](RISKS.md) R-19.

**Exit criteria:** `P-02`, `P-03`, `Q-01`, `Q-04`, `Q-05`, `Q-06`, `Q-07`, `M-07`, and
the playtest gates `T-01`, `T-02`, `T-03`.

**This milestone has kill/revise authority over everything after it.** If the M2
playtest says the LOCATE pair reads as punishment, the plan changes here, before
content breadth is bought. One child saying that is enough to trigger the revision; one
child not saying it is not enough to prove the opposite, and the report is written that
way round.

---

## M3 — Shared native namespace move

**Goal.** Move `corpan/plugins/` to a neutral top-level `native/` workspace with Corpán
green at every commit, now that a real native CI gate covering `corpan_lib` and a real
second consumer both exist.

**Depends on:** M0a, M2.

| PR | What |
|---|---|
| 3.1 | Directory move: `corpan/plugins/*` → `native/plugins/*`, `native/crates/*`. Touches ten `path = "../../plugins/..."` strings, the release-workflow globs and the `native` filter. **Crate names may change; the Tauri plugin identifier and the `links =` value do not.** |
| 3.2 | `vendor/` dirs move to `native/vendor/`. **`[patch.crates-io]` stays in each app's own root manifest**, repointed. Proven by the `cargo metadata` assertions plus an on-device Android LLM prefill benchmark. |
| 3.3 | Cargo workspace at `native/Cargo.toml` for the **plugins and crates only**, with one committed workspace `Cargo.lock`. Both apps' `src-tauri` remain independent workspace roots with independent lockfiles ([ADR-0011](DECISIONS/ADR-0011-native-workspace-and-patch-placement.md)). |
| 3.4 | `corpora-crash-breadcrumb` crate extracted; **both** apps switch here, deliberately after the rust gate covers `corpan_lib`. |
| 3.5 | Wire haptics + tts into Dynawalla from `native/`, with narrow per-command capability grants. |
| 3.6 | Hygiene while in there: delete the dead `ios/`+`android/` scaffolding in `tauri-plugin-corpan-llm` that its `build.rs` never registers and rewrite its README; reconcile the docs still describing the removed `CORPAN_LLM_SYSPROMPT` knob; fix the `game_packs` runtime vs `game-packs` permission name mismatch; consolidate to one vendored `tauri-plugin-iap` and correct its VENDORING claim. |
| 3.7 | Back-port the generated `.cargo/config.toml` to Corpán, removing the release-time sed-rewrite. Do **not** remove the `linker = "/usr/bin/cc"` Apple pins. |

**The trap this milestone exists to not fall into.**
`corpan/corpan-app/src-tauri/Cargo.toml:73` declares `[patch.crates-io]`, and **no
manifest in this repo has a `[workspace]` section** — so that file is its own implicit
workspace root. Cargo honours `[patch]` from the workspace root **of the package being
built**. A `[patch]` moved to `native/Cargo.toml` is ignored entirely when Tauri builds
Corpán, which silently reverts `ndk-context` to upstream, whose
`initialize_android_context` asserts and **aborts on Android Activity recreation** —
the crash that hit 7+ users in 0.13.1 — and reverts `llama-cpp-sys-2` to
`-march=armv8-a`, losing the Q4_K dotprod/fp16 kernels. Both regressions compile, test
and clippy clean. There is no failing test unless we write one, which is what the two
`cargo metadata | jq -e` assertions are.

**Renaming plugin identifiers is deferred and decoupled.** It is not a Cargo find/replace:
capability grants name permissions by plugin identifier, guest-JS invokes
`"plugin:iap|initialize"`, every crate carries `links = "tauri-plugin-<name>"`, and
`tauri-plugin-game-packs` registers the `corpan-pack://` scheme that already-installed
packs' built JS resolves against on user devices. A Cargo-only rename compiles and then
fails at runtime with permission-denied on every native call.

**Exit criteria:** `X-08`, `X-09`, `X-10`, `X-11`, `X-12`, `X-13`, `X-14`, `C-22`.

---

## M4 — Curriculum kernel and the gates that block merges

**Goal.** Schema, the seven grade 1–2 generator families, the grade 1–2 spine, and the
full CG-gate validator as a required check — so curriculum can never outrun generators
**or** renderers.

**Depends on:** M2.

| PR | What |
|---|---|
| 4.1 | Schema + [GATES.md](GATES.md): `SkillNode`, `Edge`, `Exercise`, `PromptSpec`, `GeneratorBinding`, `MalRule`, `CapabilityTag`, `RepId`; id regex and immutability rules. Publishes the complete CG-1..CG-22 table with one owner PR per gate and no gaps. |
| 4.2 | Structure gates CG-1 (id hygiene + immutability), CG-2 (Kahn topo-sort printing the actual cycle), CG-3 (edge integrity), CG-4 (two-way reachability), CG-5 (grade sanity). CLI `dw-curriculum check --report json`. |
| 4.3 | CG-7 bidirectional generator ownership — the merge blocker. A curriculum row without a working generator cannot reach `status: active`. |
| 4.4 | CG-8 renderer ownership + CG-13 choice-laundering ban + CG-18 accessibility. CG-8 is the gate the first draft was missing entirely. |
| 4.5 | CG-6 capability flow: `provides`/`consumes` and the missing-prerequisite detector that suggests the edge — the only mechanically sound way to find a *missing* edge. |
| 4.6 | Execution gates CG-9, CG-10, CG-11, CG-16, CG-17. Incremental (diff-scoped) on PR plus a nightly full sweep with a named owner. |
| 4.7 | CG-14 locale round-trip + CG-19 i18n completeness. |
| 4.8 | The parametric `b()` function plus a golden table of `b` per exemplar item, all coefficients in one `constants.ts`. |
| 4.9–4.14 | **One generator family per PR** for the six grade 1–2 families that do not exist yet: `fact-recall`, `mental-strategy`, `missing-operand`, `place-value-decompose`, `compare-order`, `numberline-locate`. (`gen.arith.column-op` is the seventh and shipped at 2.8.) Each ships `paramSchema`, property tests, mal-rule wiring, prompt templates, renderers where new, and passes CG-9/10/11/13/14/16/17. |
| 4.15 | Grade 1–2 spine in three PR-sized clusters: `ns` place value, `add` within 100, `alg` equality (~62 active skills) bound to those seven families. |
| 4.16 | `fraction` and `choice` answer schemas and their judge branches, with renderers, so CG-8 can pass for the M7 fraction families. |
| 4.17 | CI: `dynawalla-curriculum` job in `ci-gate.needs`, incremental on PR, full sweep nightly. |

**Runtime is a design constraint.** CG-9/10/11/12 over 160 skills × 4 levels × 1,000
seeds is ~640k `generate()` calls. Incremental on PR, full sweep nightly, from day one.

**Why the families are here and not at M7.** The exit criterion is 62+ *active* grade-1–2
skills and CG-7 blocks a skill from going `active` without a working generator. `ns` place
value, `add` within 100 and `alg` equality need `place-value-decompose`, `compare-order`,
`numberline-locate`, `fact-recall`, `mental-strategy` and `missing-operand` — so those
families are M4 work, not M7 work, and the first draft's M4 could not have hit its own
exit criterion. See the staging table in [CURRICULUM.md](CURRICULUM.md): 7 families at
M4, 11 at M7, 18 total.

**Exit criteria:** `M-02`, `M-03`, `M-04`, `M-05`, `M-06`, `M-07`, `M-08`, `M-09`,
`M-10`, `Q-10`, `C-20`. Plus: 62+ active grade-1–2 skills, every one producing
≥`minVariants` distinct exercises under execution. (`M-13` — no orphaned gate — is graded
at M8, the milestone that lands the last gate, CG-22.)

---

## M5 — The adaptive engine and a non-circular harness

**Goal.** Three-layer learner model, a scheduler with every anti-frustration and
anti-stagnation invariant as a named test, and a persona harness whose response model is
**deliberately misspecified** relative to the engine's belief model.

**Depends on:** M4.

| PR | What |
|---|---|
| 5.1 | Engine skeleton: `types.ts`, `constants.ts` (every tunable in one file), `boundary.test.ts`, persistence codecs. No model logic. |
| 5.2 | Layer S: per-skill Elo, asymmetric credit, prerequisite propagation, memoized derived state. Golden transcripts. |
| 5.3 | Sim harness skeleton with a **different functional form than the engine**: personas answer from a 3PL with per-child discrimination and item features the engine cannot observe, plus one explicit misspecification persona. Loads the M2 playtest residuals as a fixture. |
| 5.4 | **Gate EG-5, deliberately before the scheduler.** Reliability diagram against the misspecified personas and the real-child fixture. |
| 5.5 | Scheduler: pools, 8-card batch quotas expressed as **offsets from `pTarget`**, `pTarget` as a per-item asymmetric leaky integrator with the batch **re-planned on any invariant trip**, interleaving rules with the blocked-debut exception. |
| 5.6 | Every anti-frustration and anti-stagnation invariant as its own named test, including the controller-stability assertion. |
| 5.7 | Layer F: FSRS-6 on the bounded fact set, keyed on **classes** not instances, with the 21-weight equality test. Rating is a function of `(correct, latency)`; card creation gated on `φ_s`. |
| 5.8 | Signals: latency EWMA over log-latency of correct responses per input mode; revision/hint/guess control; fatigue detection; flow classifier. |
| 5.9 | `SelectionTrace` + Developer Mode, traces produced by the same code path that made the decision, compiled out in production. |
| 5.10 | The ten behavioural personas + the EG-gate suite (the misspecification persona ships at 5.3). The synthetic child **acquires skill** from day one. Nightly job; PRs run a 3-persona × 20-learner smoke. |

**Why EG-5 lands before the scheduler.** The first draft's reliability check was
circular: the engine computes `σ(θ − b)` and the persona answered from `σ(α − b)`
against the *same* `b`, so the gate passed by construction and measured nothing. The
corrected harness makes it falsifiable — but only if the M2 real-child residual fit is
not skipped "until there is more content."

**Exit criteria:** `A-01` through `A-09`, `A-13`, `A-14` through `A-19`.

---

## M6 — The world, the character, and a verified art direction

**Goal.** Progress becomes a building the child chose to build; the character has range;
the art is checked as pixels, not as code.

**Depends on:** M2, M5.

| PR | What |
|---|---|
| 6.1 | **Rasterize-to-snapshot first**, with the ~1,200 live-SVG-node cap and a failing perf test above it, on an empty world. Lands before any art PR, not after. |
| 6.2 | Screenshot harness: a deterministic seed set capturing the world at 0/50/200/500 placed elements and all five reaction tiers, at 320 px / 768 px / iPad, light and dark, reduced-motion on and off, built on the existing device-pixel capture pipeline. PNGs are committed and **reviewed as images in the PR**. |
| 6.3 | Construction model: what each correct answer places, chamber composition, the never-regresses rule, persistence keyed by `profileId`. |
| 6.4 | Child agency ([ADR-0009](DECISIONS/ADR-0009-stakes-without-loss.md)): the child chooses which chamber to build next and that choice biases the scheduler's skill pool. |
| 6.5 | Stakes without loss: a completed chamber's instrument **operates**, and correctly only if built correctly; hidden parts revealed by depth; an optional challenge run that costs nothing on failure. |
| 6.6 | Girih strapwork generation from the five-tile system. |
| 6.7 | Chamber layouts + the four V1 representations as first-class renderers. |
| 6.8 | Palette and material pass; the hostile reference board in [EXPERIENCE_DESIGN.md](EXPERIENCE_DESIGN.md) naming what it must **not** look like. |
| 6.9 | Reaction effects rebuilt in that vocabulary, tiered on `(b_item − θ_s)` and repair. |
| 6.10 | The character grammar: ~8 observation types × slotted nouns × 3–4 phrasings (~100 authored fragments), rarity budget 3–5 per session, all five locales. |
| 6.11 | Return + stopping: designed stopping points with equal-weight Done / Keep going; the return-after-absence restoration beat. |
| 6.12 | Parent-facing report-topic layer scaffold (~25 coarse topics mapping many-to-one onto ~160 skills), local only. |

**Why the rasterization step is first.** Procedural girih at 500+ answers becomes tens
of thousands of live SVG nodes and will stall a mid-range Android WebView. If it slips
behind the art PRs, the world ships and then has to be rebuilt.

**Why the art gate is images, not code.** Code review cannot see that the observatory
looks like a Bootstrap admin panel. Procedural girih plus a brass-and-lapis palette is
precisely the recipe that renders as a gradient dashboard with gear icons. The committed
screenshots and the art director are the only instruments. The art director is the
founder ([ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md)), so the sign-off
blocks on nobody — which also means the three-strangers verbatims in `Q-14` are the only
part of the gate that is not the founder judging his own product, and they are therefore
not optional.

**Exit criteria:** `P-04`, `P-05`, `P-06`, `P-07`, `P-08`, `P-10`, `Q-02`, `Q-06`,
`Q-14`, and the playtest gate `T-04`.

---

## M7 — Breadth to grades 3–5

**Goal.** The full V1 curriculum, compiled to a bundled SQLite artifact. No pack
runtime, no catalog, no CDN — curriculum ships in the app until there is an installed
base worth OTA-ing.

**Depends on:** M4, M6.

**20 PRs, and that is the honest count** (the first draft said 15 and would have
produced twelve unmergeable PRs; six of the families it listed here belong at M4, where
the grade 1–2 spine needs them).

| PR | What |
|---|---|
| 7.1–7.8 | **One generator family per PR** for the remaining 8 non-word families: `multidigit-mul`, `long-div`, `round-estimate`, `factor-multiple`, `frac.partition-model`, `frac.equivalence-simplify`, `frac.arith`, `frac.convert`. Each ships `paramSchema`, property tests, mal-rule wiring, prompt templates, renderers where new, and passes CG-9/10/11/13/14/16/17. Sized at ~600–1,200 lines so every one clears the diff cap. |
| 7.9–7.10 | The two word-problem families, each with its locale-scoped `contextTheme` asset sets. |
| 7.11 | `gen.logic.error-analysis` wired to the mal-rule table — "here is the apprentice's work, find the mistake." Every mal-rule becomes content for free. |
| 7.12–7.17 | **Six domain node-promotion PRs** (`ns`, `add`, `mul`, `div`, `frac`, `alg`), each promoting ~15–30 cluster nodes from draft to active only when CG-7 **and** CG-8 pass. One domain per PR, not one grade band per PR. |
| 7.18 | CG-21 word-problem context sets: per-locale name pools, object pools, currency and unit sets — **authored, not translated** — with a native-speaker review of the compare phrasings per locale. |
| 7.19 | CG-15 grade-band coverage matrix + CG-20 standards traceback (report-only, never blocking). |
| 7.20 | Curriculum compiler: typed TS graph → deterministic hash-stamped SQLite emitted into the app bundle. A release-checklist gate asserts the artifact hash matches the compiled source. |

11 families land here (8 + 2 word + `error-analysis`) and 7 landed at M4 — 18, which is
the [ADR-0002](DECISIONS/ADR-0002-v1-scope-cut.md) number and the
[CURRICULUM.md](CURRICULUM.md) staging table.

**Exit criteria:** `M-01`, `M-11`, `M-12`, `M-17`, `M-18`, `K-01`, `K-02`, `Q-03`.
Plus: a named person reaches a fraction exercise and a word problem from a cold launch
on a store build.

---

## M8 — Diagnosis and repair

**Goal.** The product's namesake capability, generalized from the M2 slice — and scoped
honestly to where a representation can actually carry the contradiction.

**Depends on:** M5, M7.

| PR | What |
|---|---|
| 8.1 | Mal-rule catalog part 1 (~14): add/sub and place value beyond the M2 three, plus multiplication — the domains with a real evidence base. Each executable, each passing CG-12. |
| 8.2 | Mal-rule catalog part 2 (~11): division, fractions, equality — flagged in Developer Mode as thinner-evidence and degrading to unclassified rather than inventing bugs. |
| 8.3 | CG-22 LOCATE capability gate: a mal-rule may be tagged LOCATE-capable only if it has a bound contrast representation. |
| 8.4 | Layer B integration: the decayed per-(skill, bug) tracker and the four-way slip/misconception discriminator (mal-rule match, recurrence, **self-correction**, latency shape). |
| 8.5–8.8 | LOCATE contrast interactions, **one PR per representation family**: place-value regrouping, fraction addition (bar contradiction), magnitude comparison (number line), division remainder (partition model). |
| 8.9 | Stage-3 RECONSTRUCT: faded worked examples with self-explanation prompts, plus the prerequisite-probe descent. |
| 8.10 | Harness gates: bug recall, false-positive rate, non-contamination. |
| 8.11 | Developer Mode diagnosis view: which rule fired, which candidates were rejected and why, and the LOCATE-capable count. |

**Scoped honestly.** There is no generic "make the contradiction self-evident"
function. Roughly 8–12 mal-rules get a genuine contrast; every other one routes to
Stage 3. Pretending otherwise makes LOCATE into "try again" with extra steps, and makes
any marketing claim about it false.

**Exit criteria:** `P-03` (generalized), `M-13`, `M-14`, `M-15`, `M-16`, `A-10`, `A-11`,
`A-12`, and the playtest gate `T-05`.

---

## M9 — Profiles, parents, accessibility, i18n fill

**Goal.** Make it real for a household: several children, a parent who can see progress
without surveilling, and a child who cannot see well or cannot yet read.

**Depends on:** M6, M8.

| PR | What |
|---|---|
| 9.1 | Multi-child profiles surfaced: profile switcher, per-profile storage namespace and engine state (designed in from M2). |
| 9.2 | Parent view over the ~25-topic report layer, plus a plain-language explanation of how the model works. Child-initiated, local only, no server profile. |
| 9.3 | Accessibility implementation against CG-18 (enforced since M4): VoiceOver/TalkBack pass, dynamic type, focus order, nothing solvable by colour alone. |
| 9.4 | Native TTS quality pass for read-aloud (the seam and the WebView path have shipped since M2). |
| 9.5 | i18n fill: all five locales complete including every character fragment and every prompt template. **Agents translate directly**; do not resurrect the retired translation scripts. |
| 9.6 | Parent controls: disable speed rewards, set/override grade, session-length preference. |
| 9.7 | `ar` / `hi` / `zh-Hans` groundwork behind the `NumberFormat` layer: Arabic-Indic numbering-system support and LTR-forced numerals inside RTL, with the numbering-system choice recorded in [ADR-0007](DECISIONS/ADR-0007-launch-locales.md). Shipping those locales is V1.1. |

**The pre-reader half of that goal ships unobserved.** `Q-11` is an adult-proxy device
check, not a child observation, because the program's one evaluator is 10 (R-46). M9 is
the last point at which the alternative — one younger evaluator for one session — is
still cheap; after it, the only honest options are shipping on heuristics or narrowing the
advertised grade band. [ADR-0017](DECISIONS/ADR-0017-human-evaluation-resourcing.md)
recommends; the founder decides.

**Exit criteria:** `A-17`, `Q-08`, `Q-09`, `Q-11`, `Q-12`, `Q-13`.

---

## M10 — Store readiness and V1 launch

**Goal.** Compliance, monetization, and a public release on both stores.

**Depends on:** M9.

| PR | What |
|---|---|
| 10.1 | Compliance implementation against the [ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md) decision: parental gates on every link-out and purchase flow, zero third-party analytics and ads, no AAID/IMEI/MAC/phone-number transmission, no precise location, privacy policy in-app and in both listings. |
| 10.2 | Monetization per the founder decision ([ADR-0013](DECISIONS/ADR-0013-monetization-model.md)). If entitlements are used, adopt Corpán's never-block-an-offline-subscriber policy. |
| 10.3 | Store metadata by API: `dynawalla/infra/` scripts reusing the existing parameterized ASC and Play tooling. Category, age-rating declaration including `kidsAgeBand`, beta groups, listings, Play Data safety declaration. |
| 10.4 | Dependency audit in CI: fails if any third-party analytics or advertising SDK appears in either bundle, and cross-checks the result against the submitted Play Data safety declaration. |
| 10.5 | Docs finalized, CHANGELOG, the release ritual recorded, tag `dynawalla-v1.0.0`. |
| 10.6 | Post-launch guard: smoke coverage of the store listings; the release-checklist gate asserting the curriculum artifact hash matches compiled source. |
| 10.7 | V1.1 groundwork: OTA curriculum delivery is deliberately deferred; this PR records only the decision and the trigger condition in [ADR-0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md). |

**Exit criteria:** `P-01`, `P-09`, `K-03`, `G-02`, `G-04` `[founder]`, `G-05`, `G-06`,
`G-07`, `G-08`, `G-10`, `G-11`, `C-21`, `T-06`.

---

## PR budget

| Milestone | Named PRs |
|---|---|
| M0a | 6 + 1 settings change |
| M0b | 7 |
| M1 | 6 |
| M2 | 12 |
| M3 | 7 |
| M4 | **17** |
| M5 | 10 |
| M6 | 12 |
| M7 | **20** |
| M8 | 11 |
| M9 | 7 |
| M10 | 7 |
| **Total** | **~122 PRs** |

At three review lenses per PR and roughly 2.5 evaluations each (PR plus merge-queue
entries), that is about 900 model calls through `adversarial-review`. It is a real cost
line and a real single point of failure; see [RISKS.md](RISKS.md) R-16.
