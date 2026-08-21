# ADR-0011 — `native/` workspace, independent app roots, `[patch]` stays put

**Status:** Accepted
**This ADR exists to stop a specific mistake from being made twice. Read all of it
before touching any Cargo manifest.**

## Context

Locked decision #4 shares the native/Rust/Tauri-plugin layer between Corpán and
Dynawalla. The obvious implementation is to move `corpan/plugins/` to a neutral
top-level `native/` Cargo workspace and hoist the shared bits — including
`[patch.crates-io]` — to the workspace root.

**That would ship a crash to production, and every automated check would stay green.**

Verified facts:

- `corpan/corpan-app/src-tauri/Cargo.toml:73` declares `[patch.crates-io]`.
- **No manifest anywhere in this repository has a `[workspace]` section.**
- Therefore `corpan/corpan-app/src-tauri/Cargo.toml` is its own *implicit* workspace
  root.
- Cargo honours `[patch]` from the workspace root **of the package being built**.

So a `[patch]` placed in `native/Cargo.toml` is **ignored entirely** when Tauri builds
Corpán. Corpán silently reverts to upstream `ndk-context 0.1.1`, whose
`initialize_android_context` calls `assert!(previous.is_none())` and **aborts the process
on Android Activity recreation** — the crash documented in that same manifest as having
hit 7+ users in 0.13.1. It also reverts `llama-cpp-sys-2` to `-march=armv8-a`, losing the
Q4_K dotprod/fp16 kernels. Both regressions compile clean, test clean and clippy clean.
You find out from the Play Console vitals dashboard.

## Decision

1. **`native/Cargo.toml` is a workspace for the plugins and shared crates only**, with
   **one** committed workspace `Cargo.lock`.
2. **`corpan/corpan-app/src-tauri` and `dynawalla/dynawalla-app/src-tauri` remain
   independent workspace roots with independent `Cargo.lock` files.** They are not
   workspace members. Making them members would give a Dynawalla dependency bump silent
   control of Corpán's resolved graph.
3. **`[patch.crates-io]` stays in each app's own root manifest**, repointed at
   `../../../native/vendor/*`. Only the vendor *directories* move.
4. **Two mechanical guards run in the required `rust-linux` job**, one per fork, per app:
   ```
   cargo metadata --manifest-path corpan/corpan-app/src-tauri/Cargo.toml --format-version 1 \
     | jq -e '.packages[] | select(.name=="ndk-context") | .manifest_path | test("native/vendor")'
   ```
   plus the same for `llama-cpp-sys-2`, plus both for Dynawalla once it exists. A device
   LLM prefill benchmark within 5% of the pre-move measurement is the belt (`X-13`).
5. **Plugin identifiers and `links =` values do not change.** Crate names may.

## Consequences

- The honest justification for the workspace is **not** disk savings. The app build
  compiles path dependencies into its own `target/` regardless; the workspace unifies
  the *standalone* per-plugin builds. The real gain is reproducibility: nine per-plugin
  `Cargo.lock` files exist on disk today and are untracked.
- Point 5 matters because a rename is a **runtime-only** failure. Capability grants name
  permissions by plugin identifier, guest-JS invokes `"plugin:iap|initialize"`, every
  crate carries `links = "tauri-plugin-<name>"`, and `tauri-plugin-game-packs` registers
  the `corpan-pack://` scheme that already-installed packs' built JS resolves against on
  user devices. A Cargo-only rename compiles and then fails with permission-denied on
  every native call. If a rename is ever wanted it is a separate PR with dual scheme
  registration and a test that parses the capability file and asserts each identifier
  resolves against the built plugin set.
- The `.cargo/config.toml` Apple linker pins (`linker = "/usr/bin/cc"` for both
  `*-apple-darwin` targets) must survive the templating in PR-0a.4. Removing them
  reintroduces a link-time segfault caused by the Android NDK clang appearing earlier on
  `$PATH`.

## Do not "tidy this up"

The residual risk is entirely a future cleanup PR that consolidates the two `[patch]`
blocks into the workspace root because it looks like duplication. It is not duplication.
It is the only placement Cargo honours. [RISKS.md](../RISKS.md) R-06.
