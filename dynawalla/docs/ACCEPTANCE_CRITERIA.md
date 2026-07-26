# Dynawalla — Acceptance Criteria

The definition of done for V1. This is the document the program is graded against.

**Every item below is currently UNMET.** Nothing has been built.

> Links to `GATES.md`, `CURRICULUM.md`, `ADAPTIVE_LEARNING.md`, `ARCHITECTURE.md`,
> `EXPERIENCE_DESIGN.md`, `PACK_SYSTEM.md`, `RELEASE_ENGINEERING.md`, `STORE.md` and
> `TEST_STRATEGY.md` resolve once the reference-set PR lands. The two were split so
> neither diff is truncated by the adversarial reviewer; delete this note in the
> follow-up.

## How to use this file

Each item has an id, a claim, and a **Verify** line naming the command or procedure
that decides it. Fill the **Evidence** slot with a permalink: a PR number, a CI run
url, a committed report path, or a dated line in the relevant playtest report. An
item is met when a third party can follow the Verify line and reach the same verdict
without asking anyone.

Rules that make this honest rather than aspirational:

- **`Evidence: UNMET` is the only default.** Do not mark an item met with a promise.
- **"A test asserts it" never satisfies a `[device]` item.** Those require a named
  person to reach the capability from a cold launch on a TestFlight or Play-internal
  build. The repo's own counterexample: Journey merged 2026-07-04 and was unreachable
  by production users until 2026-07-14, across five releases.
- **`[playtest]` items cannot be waived.** Waiving one voids every judgement
  downstream of it — see [RISKS.md](RISKS.md) R-02.
- **`[founder]` items are not the program's to close.** They are listed so the
  critical path is visible, not so an agent can decide them.

---

## A. Product

- [ ] **P-01** `[device]` A named person installs Dynawalla from the App Store and from
      Google Play, creates a profile, passes the parental gate, completes a practice
      session and opens the parent report — on each of the three reference devices
      (Samsung Galaxy Tab A9 SM-X110, Pixel 6a, iPad 10th gen).
      Verify: dated record with device, build number and store channel in `STATUS.md`.
      Evidence: UNMET
- [ ] **P-02** `[device]` A named person reaches the practice loop from a cold launch
      with **no dev flags** on a TestFlight build and on a Play-internal build.
      Verify: recorded session; build numbers noted.
      Evidence: UNMET
- [ ] **P-03** `[device]` On `5,001 − 2,798` answered as `3,203`, the app identifies
      `mis.add.borrow-across-zero` and serves the counting-board contrast pair **within
      3 cards**, reached from a cold launch on a store build. The same problem answered
      `3,797` must instead identify `mis.add.smaller-from-larger` — a wrong rule-to-answer
      mapping passes CG-12 and fails here.
      Verify: recorded session, both answers.
      Evidence: UNMET
- [ ] **P-04** Construction never regresses: no code path removes a placed element.
      Verify: named unit test over the construction reducer; `rg` shows no delete path.
      Evidence: UNMET
- [ ] **P-05** The child's chamber choice measurably biases the scheduler's skill pool.
      Verify: harness test — the same seed with two different chamber choices produces
      different skill distributions in the next 50 cards, in the declared direction.
      Evidence: UNMET
- [ ] **P-06** The character produces ≥200 distinct true utterances across the persona
      corpus, never repeats within a session, and holds a 3–5 utterance/session budget.
      Verify: harness report over 10 personas × 180 simulated days.
      Evidence: UNMET
- [ ] **P-07** Every character fragment resolves in all five launch locales with no
      fallback to English.
      Verify: `npm run check:i18n` plus a fragment-resolution test per locale.
      Evidence: UNMET
- [ ] **P-08** A returning child after 30 days sees a restoration beat, not a
      punishment beat.
      Verify: named test on the return path; confirmed in the M6 playtest report.
      Evidence: UNMET
- [ ] **P-09** No countdown timer, streak counter, loss state or purchased-absolution
      surface exists in the shipped bundle.
      Verify: lint + a documented `rg` sweep recorded in the release checklist.
      Evidence: UNMET
- [ ] **P-10** "Done" and "Keep going" are equal-weight at every designed stopping
      point.
      Verify: screenshot set (M6 harness) reviewed in-PR; no visual hierarchy between
      the two controls.
      Evidence: UNMET

## B. Mathematics (curriculum)

- [ ] **M-01** ≥160 active skills across 6 domains (`ns`, `add`, `mul`, `div`, `frac`,
      `alg`) bound to 18 generator families.
      Verify: `dw-curriculum check --report json` active-node count.
      Evidence: UNMET
- [ ] **M-02** Every active skill produces ≥`minVariants` distinct exercises under
      actual execution (not by declaration).
      Verify: gate CG-9 green in the nightly full sweep.
      Evidence: UNMET
- [ ] **M-03** Every active skill has a registered, tested renderer for its generator's
      `AnswerSchema` kind **and** for every `representations.required` RepId.
      Verify: gate CG-8 green; a deliberate violation fails `ci-gate`.
      Evidence: UNMET
- [ ] **M-04** Zero skills classified `conceptual` or `reasoning` bind a choice-only
      generator.
      Verify: gate CG-13 green; deliberate violation fails `ci-gate`.
      Evidence: UNMET
- [ ] **M-05** No floating-point arithmetic exists in `dynawalla/curriculum/` or
      `dynawalla/engine/`.
      Verify: the exact-rational lint; a deliberate `0.1 + 0.2` fails CI.
      Evidence: UNMET
- [ ] **M-06** No `Exercise.prompt` is a bare string anywhere.
      Verify: `rg 'prompt:\s*["'"'"'`]' dynawalla/curriculum` returns zero hits, and the
      lint enforces it.
      Evidence: UNMET
- [ ] **M-07** Generation is deterministic and platform-stable: identical seed →
      byte-identical exercise transcripts on macOS and Linux CI.
      Verify: gate CG-16 with committed output-hash snapshots on both runners.
      Evidence: UNMET
- [ ] **M-08** Changing a generator's output without bumping `familyRev` fails CI.
      Verify: deliberate change; CG-16 red.
      Evidence: UNMET
- [ ] **M-09** Removing or re-pointing an active skill id that shipped in a previous
      release fails CI.
      Verify: deliberate removal; CG-1 red.
      Evidence: UNMET
- [ ] **M-10** Every `canonical` and `alsoAccept` value round-trips through
      format→parse in all five launch locales.
      Verify: gate CG-14 green; a de-locale-breaking canonical fails.
      Evidence: UNMET
- [ ] **M-11** Every active word-problem family has a populated, natively-reviewed
      `contextTheme` set in all five launch locales.
      Verify: gate CG-21 green; reviewer names recorded per locale.
      Evidence: UNMET
- [ ] **M-12** The CG-15 grade-band coverage matrix has no empty (grade 1–5 × claimed
      domain) cell.
      Verify: CG-15 report.
      Evidence: UNMET
- [ ] **M-13** Every gate CG-1..CG-22 in [GATES.md](GATES.md) has an implementing PR
      **and** a failing-case test. None is orphaned.
      Verify: the gate table's owner column resolved to merged PR numbers.
      Evidence: UNMET
- [ ] **M-14** Every mal-rule diverges from the correct answer on ≥95% of seeds.
      Verify: gate CG-12 over 1,000 seeds per rule.
      Evidence: UNMET
- [ ] **M-15** Every mal-rule tagged LOCATE-capable has a bound contrast
      representation, and the count is reported in Developer Mode.
      Verify: gate CG-22; the Developer Mode count matches any external claim.
      Evidence: UNMET
- [ ] **M-16** No learner-facing string names a misconception or a defect.
      Verify: lint over locale files and prompt templates.
      Evidence: UNMET
- [ ] **M-17** The compiled curriculum SQLite is <12 MB and its hash matches the
      compiled source at release time.
      Verify: release-checklist gate.
      Evidence: UNMET
- [ ] **M-18** Standards are stored as codes only; all titles and descriptions are
      originally authored.
      Verify: `rg` for CCSS prose in `dynawalla/curriculum/` returns zero hits; CG-20
      report-only output reviewed.
      Evidence: UNMET

## C. Adaptation (learner model)

- [ ] **A-01** Gate EG-5 calibration holds within ±0.06 per 0.05 bin over ≥200 items for
      **every** persona including the misspecification persona.
      Verify: nightly harness report.
      Evidence: UNMET
- [ ] **A-02** EG-5 also holds against the M2 real-child residual fixture. This is the
      only non-circular evidence that `b()` is real.
      Verify: fixture committed from `PLAYTEST-M2.md`; harness run green.
      Evidence: UNMET
- [ ] **A-03** `accurate-counter-on` never accumulates a long-interval fact card and is
      routed to fluency bursts rather than new skills.
      Verify: named persona gate.
      Evidence: UNMET
- [ ] **A-04** `pure-guesser` reaches Practiced on **zero** skills over 180 simulated
      days at every seed.
      Verify: named persona gate.
      Evidence: UNMET
- [ ] **A-05** `slow-accurate`: no skill promotion is ever denied on latency alone.
      Verify: named assertion in the harness.
      Evidence: UNMET
- [ ] **A-06** `fast-careless`: false-positive bug rate <5%; `|θ̂ − α| ≤ 0.7` on ≥85% of
      touched skills.
      Verify: named persona gate.
      Evidence: UNMET
- [ ] **A-07** `fatiguer`: replaying with the post-fatigue window excluded yields an
      **identical** set of skill levels — zero demotions attributable to tiredness.
      Verify: named assertion.
      Evidence: UNMET
- [ ] **A-08** `struggling`: realized accuracy stays in [0.68, 0.85] from day 7, never a
      5-item window below 0.40, and still gains ≥1 Practiced skill per 10 active days.
      Verify: named persona gate.
      Evidence: UNMET
- [ ] **A-09** Controller stability: over any 50-item window, per-item `|ΔpTarget|`
      stays under bound and its sign does not alternate more than N times, on every
      persona.
      Verify: named assertion; N recorded in `constants.ts`.
      Evidence: UNMET
- [ ] **A-10** Bug recall ≥0.85 within 6 firings on bug-carrying personas;
      false-positive rate <0.05 on bug-free personas.
      Verify: harness gates from PR-8.10.
      Evidence: UNMET
- [ ] **A-11** A detected bug does not contaminate untouched skills (`|Δθ| < 0.2`).
      Verify: named assertion.
      Evidence: UNMET
- [ ] **A-12** Repair items never exceed 25% of any batch.
      Verify: named scheduler invariant test.
      Evidence: UNMET
- [ ] **A-13** Every anti-frustration and anti-stagnation invariant in
      [ADAPTIVE_LEARNING.md](ADAPTIVE_LEARNING.md) has its own named test.
      Verify: one-to-one mapping from the invariant list to test names, checked in CI.
      Evidence: UNMET
- [ ] **A-14** Every gate in the harness report is labelled **REGRESSION BOUND** or
      **PEDAGOGICAL ASSERTION**, and "a different marginal leg fails on each seed" is
      reported as a FAIL, not as noise.
      Verify: report format check.
      Evidence: UNMET
- [ ] **A-15** Persisted state <100 KB per learner after 500 simulated sessions, on
      every persona.
      Verify: harness measurement.
      Evidence: UNMET
- [ ] **A-16** `nextExercises(8)` p99 <5 ms; `applyResult` p99 <1 ms.
      Verify: harness bench.
      Evidence: UNMET
- [ ] **A-17** Disabling speed rewards removes **every** latency-derived reward path.
      Verify: harness assertion with the switch off.
      Evidence: UNMET
- [ ] **A-18** Every served card carries a `SelectionTrace` produced by the same code
      path that made the decision, and golden-transcript tests assert on traces.
      Verify: trace tests; traces compiled out in a production bundle (checked by
      absence in the shipped bundle).
      Evidence: UNMET
- [ ] **A-19** The nightly harness has a **named owner** and a paging path.
      Verify: owner recorded in `STATUS.md`; a deliberate failure pages them.
      Evidence: UNMET

## D. Packs

V1 ships **no downloadable content packs**. These criteria are verified by absence.
See [PACK_SYSTEM.md](PACK_SYSTEM.md) and
[ADR-0003](DECISIONS/ADR-0003-no-downloadable-packs-v1.md).

- [ ] **K-01** No pack catalog, no pack installer and no Dynawalla CDN surface exists.
      Verify: `rg -n 'catalog|packInstall|corpan-pack://' dynawalla/` returns zero
      product hits; no Dynawalla entry in any catalog file.
      Evidence: UNMET
- [ ] **K-02** Curriculum reaches the device only as the bundled compiled SQLite.
      Verify: the app makes zero network requests for curriculum content — asserted by
      a test and confirmed by a device network capture during the M7 device pass.
      Evidence: UNMET
- [ ] **K-03** The OTA deferral decision and its trigger condition are recorded in
      [ADR-0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md).
      Verify: ADR status is Accepted with a stated trigger.
      Evidence: UNMET

## E. Platforms

- [ ] **X-01** `[device]` A build of `inc.corpora.dynawalla` is downloadable from
      TestFlight internal on a real iPhone and launches.
      Verify: recorded install.
      Evidence: UNMET
- [ ] **X-02** `[device]` A build is installable from Play internal on the Galaxy Tab
      A9 SM-X110 and launches.
      Verify: recorded install.
      Evidence: UNMET
- [ ] **X-03** The generated Gradle `applicationId` is verified as
      `inc.corpora.dynawalla` **before** the first AAB upload. The Play package name is
      locked by the first upload and cannot be changed without Google support.
      Verify: build log line quoted in the PR; upload timestamp after it.
      Evidence: UNMET
- [ ] **X-04** `p_align == 0x4000` for every `.so` in the Dynawalla AAB.
      Verify: the existing 16 KB page-size check applied to the Dynawalla artifact.
      Evidence: UNMET
- [ ] **X-05** Android `targetSdk`/`compileSdk` are 36 (mandatory for new apps from
      2026-08-31) and `minSdk` is 26.
      Verify: generated Gradle config quoted in the release run.
      Evidence: UNMET
- [ ] **X-06** iOS deployment target 16.0 and `ITSAppUsesNonExemptEncryption: false`
      are set.
      Verify: `Info.plist` in the exported archive.
      Evidence: UNMET
- [ ] **X-07** The Tauri `csp` is **non-null** and `capabilities/default.json` grants
      per-command permissions, not `:default` for whole plugins.
      Verify: read the shipped capability file; a test parses it and asserts no
      `:default` grant.
      Evidence: UNMET
- [ ] **X-08** `[device]` Dynawalla fires a real haptic on a physical iPhone — proving
      the native path, since `navigator.vibrate` does not exist in WKWebView.
      Verify: recorded device check.
      Evidence: UNMET
- [ ] **X-09** `[device]` A forced native crash on a real Android device produces an
      attributable breadcrumb (signal + thread name + fault address) in the tombstone
      of a **Corpán** build, not only a Dynawalla one.
      Verify: tombstone excerpt attached to the M3 PR.
      Evidence: UNMET
- [ ] **X-10** `cargo metadata` proves both vendored forks (`ndk-context`,
      `llama-cpp-sys-2`) still resolve to `native/vendor` for **both** apps.
      Verify: the two `jq -e` assertions in the `rust-linux` job; deleting either
      `path` turns the required check red.
      Evidence: UNMET
- [ ] **X-11** `corpan/plugins/` no longer exists; `git ls-files 'native/**/Cargo.lock'
      | wc -l` == 1; both apps still have their own `Cargo.lock`.
      Verify: the three commands.
      Evidence: UNMET
- [ ] **X-12** `[device]` A Corpán iOS and Android release build produced from the moved
      layout passes a manual smoke pass covering every plugin surface (tts, haptics,
      iap, subscriptions, stt, asr-native, llm, radio-stream, game-packs asset load).
      Verify: checklist signed per surface, per platform.
      Evidence: UNMET
- [ ] **X-13** Android LLM prefill tokens/sec on a real device is within 5% of the
      pre-move measurement.
      Verify: both measurements attached to the PR.
      Evidence: UNMET
- [ ] **X-14** No plugin directory contains a README describing an implementation path
      its `build.rs` does not take.
      Verify: manual audit recorded in the M3 PR.
      Evidence: UNMET

## F. CI/CD

- [ ] **C-01** Required contexts remain exactly three: `ci-gate`,
      `adversarial-review`, `hygiene`. Dynawalla added jobs to `ci-gate.needs` and no
      fourth context exists.
      Verify: `gh api` on the protection object; a docs-only PR shows exactly three
      required checks.
      Evidence: UNMET
- [ ] **C-02** A PR exceeding `MAX_DIFF_BYTES` **fails** `adversarial-review` with
      `::error::diff too large to review — split this PR`.
      Verify: deliberate oversized test PR.
      Evidence: UNMET
- [ ] **C-03** A run where exactly one of three lenses errors fails the required check.
      Verify: deliberate single-lens failure injection.
      Evidence: UNMET
- [ ] **C-04** The resolved review provider and model are printed to
      `$GITHUB_STEP_SUMMARY`, and a 1-token ping precedes the three full-diff calls.
      Verify: a run's step summary.
      Evidence: UNMET
- [ ] **C-05** A PR touching a path matching no area filter and no explicit no-CI
      allowlist entry fails `ci-gate` **on `pull_request`**, and does **not** fail
      inside a merge group.
      Verify: one deliberate PR, plus one batched merge group containing it.
      Evidence: UNMET
- [ ] **C-06** A deliberate clippy warning in any plugin **and** a deliberate clippy
      warning in `corpan_lib` each turn the required check red.
      Verify: two throwaway PRs.
      Evidence: UNMET
- [ ] **C-07** `ios-native.yml` no longer exists; `rust-apple` is skipped (green, zero
      cost) on a docs-only PR.
      Verify: file absence plus a docs-only PR's check list.
      Evidence: UNMET
- [ ] **C-08** `gh api .../branches/main/protection` returns 404 **and** a throwaway
      failing PR is still blocked. Both recorded, in that order.
      Verify: the migration transcript in the root runbook, with the revert payload
      written before step 1.
      Evidence: UNMET
- [ ] **C-09** `git ls-files .claude` returns the committed agents/skills/hooks/
      commands/settings.json; `pr-agent.yml` is gone.
      Verify: the two commands.
      Evidence: UNMET
- [ ] **C-10** Every third-party action is SHA-pinned with a trailing version comment
      and `sha_pinning_required: true` is set.
      Verify: `rg 'uses:.*@(?!\w{40})' .github/` returns zero third-party hits.
      Evidence: UNMET
- [ ] **C-11** Tag `dynawalla-v0.1.0` triggers exactly one release workflow, and the
      same tag does **not** trigger `release-corpan`.
      Verify: the two workflow run lists.
      Evidence: UNMET
- [ ] **C-12** Tag `corpan-v0.20.7` triggers exactly one mobile release; a plain merge
      to `main` touching `tauri.conf.json` does not.
      Verify: run lists for both events.
      Evidence: UNMET
- [ ] **C-13** A release run with one store secret unset fails **red** rather than
      reporting success.
      Verify: deliberate `workflow_dispatch` with a secret removed from the environment.
      Evidence: UNMET
- [ ] **C-14** The store-build preflight rejects a deliberately low build number in
      under 30 s.
      Verify: one deliberate run.
      Evidence: UNMET
- [ ] **C-15** Corpán's next real release ships to TestFlight + Play internal through
      the reusable workflow with a build number **greater than 29,750,000**.
      Verify: the release run log and both store consoles.
      Evidence: UNMET
- [ ] **C-16** A merge touching one Corpán pack leaves every other pack's ZIP and
      `dist/` resolving 200 after the deploy, asserted by `smoke.yml` over **all**
      catalog entries, not a sample.
      Verify: post-deploy smoke run.
      Evidence: UNMET
- [ ] **C-17** `catalog-v3` carries a sha256 and a versioned S3/CloudFront URL for
      every pack, and the previous version's URL still resolves 200 after a new version
      publishes.
      Verify: two `curl -I` checks across a publish boundary.
      Evidence: UNMET
- [ ] **C-18** A deliberately missing locale on one pack fails a **PR check** and does
      **not** fail the deploy.
      Verify: one deliberate PR plus the following deploy run.
      Evidence: UNMET
- [ ] **C-19** On the `pull_request` event, a Dynawalla-only PR runs `dynawalla-app`
      and does not run `corpan-app` or `deploy-pages`. (Inside a merge group the
      `changes` job diffs the whole batch, so a batched Dynawalla+Corpán group running
      `corpan-app` is expected and correct.)
      Verify: one Dynawalla-only PR's job list.
      Evidence: UNMET
- [ ] **C-20** The incremental curriculum validator completes in <90 s on PR; the
      nightly full sweep completes and has a named owner who is paged on failure.
      Verify: two run durations plus the owner record.
      Evidence: UNMET
- [ ] **C-21** **Every** merge to `main` during the program landed with **no Corpán
      production regression attributable to a Dynawalla merge**.
      Verify: an incident review of Corpán releases in the period against the
      `STATUS.md` incident log.
      Evidence: UNMET
- [ ] **C-22** Corpán's `ci-gate` is green on every commit of every milestone that
      touches shared code (M0a, M1, M3).
      Verify: the branch's check history.
      Evidence: UNMET

## G. Quality

- [ ] **Q-01** `[device]` Measured on the Galaxy Tab A9: p95 machine-side contribution
      per item <120 ms; `generate()` p95 <5 ms; no layout shift between problems of
      different digit counts across 50 consecutive items.
      Verify: on-device bench output attached to the PR.
      Evidence: UNMET
- [ ] **Q-02** `[device]` A 500-answer session keeps live SVG nodes under the ~1,200
      cap and holds 60 fps on the Galaxy Tab A9.
      Verify: on-device capture; the failing perf test above the cap exists.
      Evidence: UNMET
- [ ] **Q-03** `[device]` The app cold-launches to a first problem in under 2.5 s on the
      Galaxy Tab A9 with the bundled curriculum.
      Verify: timed cold launches, median of 5.
      Evidence: UNMET
- [ ] **Q-04** Interrupting a tier-2 reaction with a keypress settles it within 90 ms
      and never drops or delays the input.
      Verify: named test.
      Evidence: UNMET
- [ ] **Q-05** A boundary test fails the build if anything under `src/reactions/` or
      `src/world/` imports from `src/work/` or `engine/`.
      Verify: deliberate import; build red.
      Evidence: UNMET
- [ ] **Q-06** `prefers-reduced-motion` produces a zero-travel cross-fade with no
      particles, verified in a test **and** in the committed screenshot set.
      Verify: test plus screenshots.
      Evidence: UNMET
- [ ] **Q-07** A French-locale build accepts `3,5` and renders `1 000`; an English
      build accepts `3.5` and renders `1,000`. Both asserted.
      Verify: named tests plus a device check.
      Evidence: UNMET
- [ ] **Q-08** `npm run build` is green with all five locales at 100% key coverage and
      complete CLDR plural sets; a deliberate missing key or missing plural category
      fails the build.
      Verify: one deliberate removal.
      Evidence: UNMET
- [ ] **Q-09** `[device]` VoiceOver and TalkBack complete a full problem end to end on
      real devices.
      Verify: recorded passes.
      Evidence: UNMET
- [ ] **Q-10** Every representation has a text alternative and nothing is solvable by
      colour alone, from the first representation authored.
      Verify: gate CG-18 green; a representation without a text alternative fails.
      Evidence: UNMET
- [ ] **Q-11** `[device]` A grade-1 child who cannot read completes a session using
      read-aloud only, observed.
      Verify: the named non-reader in the `T-01` cohort, recorded in `PLAYTEST-M2.md`
      under the standard observation protocol. If the cohort has no non-reader, `Q-11`
      is UNMET — it is not waivable by a test.
      Evidence: UNMET
- [ ] **Q-12** Three children on one device have fully independent progress, verified
      by a test that cross-reads namespaces **and** by a named person on a real device.
      Verify: test plus device record.
      Evidence: UNMET
- [ ] **Q-13** A parent can answer "what is my child working on and what is hard for
      them" in under 30 seconds, without a server account.
      Verify: timed observation with three parents.
      Evidence: UNMET
- [ ] **Q-14** `[art]` Three strangers shown **only** the committed M6 screenshots,
      unprompted, do not use the word "dashboard" or the word "template"; a **named**
      art director signs off on those images.
      Verify: verbatims plus a signed record in the M6 PR.
      Evidence: UNMET

## H. Compliance and governance

- [ ] **G-01** `[founder]` The Kids Category / Play under-13 decision is recorded in
      [ADR-0001](DECISIONS/ADR-0001-kids-category-posture.md) with status Accepted
      **before** the first store submission. Apple 1.3 makes it a one-way door.
      Evidence: UNMET
- [ ] **G-02** `[founder]` The monetization model is decided and recorded in
      [ADR-0013](DECISIONS/ADR-0013-monetization-model.md) before M9 completes.
      Evidence: UNMET
- [ ] **G-03** `[founder]` The repository license is decided and a `LICENSE` file
      exists ([ADR-0014](DECISIONS/ADR-0014-repository-license.md)).
      Evidence: UNMET
- [ ] **G-04** `[founder]` The public standards-alignment claim is decided
      ([ADR-0010](DECISIONS/ADR-0010-standards-alignment-claim.md)); CG-20 stays
      report-only unless it says otherwise.
      Evidence: UNMET
- [ ] **G-05** No third-party analytics or advertising SDK exists in either bundle.
      Verify: the CI dependency audit, cross-checked against the submitted Play Data
      safety declaration.
      Evidence: UNMET
- [ ] **G-06** No AAID / IMEI / MAC / phone number is transmitted and no precise
      location is collected.
      Verify: dependency audit plus a device network capture during the release pass.
      Evidence: UNMET
- [ ] **G-07** Apple age rating and Play target-audience/content-rating declarations
      are complete and consistent with actual behaviour and with the CI audit.
      Verify: both console declarations against the audit output.
      Evidence: UNMET
- [ ] **G-08** A parental gate stands in front of every link-out and every purchase
      flow.
      Verify: route-guard test enumerating external links and purchase entry points;
      device pass.
      Evidence: UNMET
- [ ] **G-09** Play Console shows the service account granted explicit per-app
      permission on the new Dynawalla app record.
      Verify: console screenshot recorded in `STATUS.md` (no credential values).
      Evidence: UNMET
- [ ] **G-10** Play's first-release draft gate is cleared. On a never-published app the
      API can only create draft releases; one Console-side publish is budgeted.
      Verify: the published release in Play Console.
      Evidence: UNMET
- [ ] **G-11** No credential ever appears in the repo: no keystore, `.p8`,
      service-account JSON, issuer id, key id, provisioning-profile UUID or token.
      Verify: `hygiene` (gitleaks) green on every commit, plus a manual grep of the
      Dynawalla docs before each release.
      Evidence: UNMET

## I. Playtest gates (cannot be waived)

- [ ] **T-01** `[playtest]` **M2**: 6+ children aged 6–11 — including **at least one
      grade-1 child who cannot yet read** (the `Q-11` instrument) — at least 2 of whom
      dislike math, each complete two unsupervised 20-minute sessions on a real device.
      Time-to-voluntary-quit, unprompted verbatims and next-day voluntary return rate
      are recorded in `PLAYTEST-M2.md`.
      Evidence: UNMET
- [ ] **T-02** `[playtest]` **M2**: at least 3 of the 6 children, unprompted, do
      something after a wrong answer other than ask for the answer — i.e. the LOCATE
      contrast pair reads as an explanation, not a punishment.
      Evidence: UNMET
- [ ] **T-03** `[playtest]` **M2**: residuals from the cohort are fitted against
      predicted `b()` and reported in `PLAYTEST-M2.md`, **before** M7 spends on content
      breadth.
      Evidence: UNMET
- [ ] **T-04** `[playtest]` **M6**: the same 6+ children return for two more 20-minute
      sessions. Recorded in `PLAYTEST-M6.md`: can each child say, unprompted, what they
      are building and why they chose it; does the chosen-chamber mechanic change what
      they do.
      Evidence: UNMET
- [ ] **T-05** `[playtest]` **M8**: with 6+ children, after a LOCATE contrast pair the
      child's next attempt at the same mal-rule class is correct more often than after
      a Stage-1 verify. If it is not, LOCATE is revised or cut. Recorded in
      `PLAYTEST-M8.md`.
      Evidence: UNMET
- [ ] **T-06** Every playtest gate has a committed report and **none was waived**.
      Verify: three reports exist and `STATUS.md` records no waiver.
      Evidence: UNMET

---

## Summary

| Area | Items | Met |
|---|---|---|
| A. Product | 10 | 0 |
| B. Mathematics | 18 | 0 |
| C. Adaptation | 19 | 0 |
| D. Packs | 3 | 0 |
| E. Platforms | 14 | 0 |
| F. CI/CD | 22 | 0 |
| G. Quality | 14 | 0 |
| H. Compliance and governance | 11 | 0 |
| I. Playtest gates | 6 | 0 |
| **Total** | **117** | **0** |
