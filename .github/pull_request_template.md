<!--
Trunk-based: one change, one PR, squash-merged. Keep it small — the
adversarial-review gate truncates the diff at 200000 bytes
(.github/scripts/adversarial_review.py:115) and never sees the rest. Check with:
  git diff --unified=3 origin/main...HEAD | wc -c
-->

## What

<!-- One or two sentences. What this does, in the imperative. -->

## Why

<!-- The problem. Link the issue. If it's a bug, what it broke and for whom. -->

## Blast radius

<!-- Delete the lines that don't apply; answer the ones that do. N/A is fine,
     silence is not — this is the part a reviewer cannot reconstruct from the diff. -->

**Areas touched:** <!-- corpan-app / packs / dja / lambda / web / terraform / native / dynawalla / CI / docs -->

- [ ] Every touched path is covered by a `ci.yml` area filter (or is docs/config
      with no gate by design). Uncovered paths are reported as a warning by the
      `uncovered` step in the `changes` job — check the run.
- [ ] **Pack back-compat.** No published pack zip changed in place (version bumped
      instead); no `voiceId` renamed; no catalog entry dropped or raised its
      `minAppVersion`/`maxAppVersion`/`platforms` without a compat route. Shipped
      app floor is 0.20.6.
- [ ] **Native integrity.** `cargo fmt --check` and `clippy -D warnings` clean;
      `links =` values still unique repo-wide; no manifest gained a `[workspace]`
      section and no `[patch.crates-io]` moved out of an app's
      `src-tauri/Cargo.toml`. (A misplaced `[patch]` is ignored **silently** —
      it once reverted the vendored `ndk-context` fork and crashed 7+ users with
      no failing test.)
- [ ] **Strings.** Every new user-visible string exists in every locale directory
      under `corpan/corpan-app/public/locales/` (54 today). `npm run check:i18n`
      runs inside `npm run build` and fails on any missing key.
- [ ] **Curriculum.** No skill id renamed or reused. Grade changes are metadata
      only. Fraction/decimal answers use exact rationals, never floats. Any skill
      promoted to `active` has a passing generator binding **and** a registered,
      tested renderer for its answer schema and every required representation.
- [ ] **Secrets.** No `.p8`, keystore, service-account JSON, issuer id, key id,
      or token — this repo is public.

## Proof

<!-- The commands you ran and their real output. Not "tests pass". -->

```
```
