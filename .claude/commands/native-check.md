---
description: Run the native/Rust gate — fmt, clippy, cross-compile, links uniqueness, [patch] integrity
---

Gate the native changes in $ARGUMENTS (a crate path, or the current branch's
diff under `native/`, `*/src-tauri/`, `corpan/plugins/`). Use the
`native-gatekeeper` agent; report each check with its actual output.

No required check compiles Rust. `.github/workflows/ios-native.yml` is the only
workflow that does — path-gated on `corpan/plugins/**/{ios,src}/**`,
`**/Cargo.toml`, `**/build.rs`; it cross-builds each plugin for
`aarch64-apple-ios` (which is what compiles its Swift). It is **advisory**, not
in the required set, so read it yourself (`gh pr checks <PR>`); a red run will
not block the merge. Android, clippy and fmt run nowhere in CI. Everything below
is local-only.

```bash
cargo fmt --check --manifest-path <crate>/Cargo.toml
cargo clippy --manifest-path <crate>/Cargo.toml --all-targets -- -D warnings
cargo check --manifest-path <crate>/Cargo.toml --target aarch64-linux-android
cargo check --manifest-path <crate>/Cargo.toml --target aarch64-apple-ios

# links values unique repo-wide — must print nothing
rg --no-heading -o '^links = "[^"]+"' --glob 'Cargo.toml' . | sed 's/.*links = //' | sort | uniq -d

# no manifest has a [workspace] — must print nothing, or every per-app
# [patch.crates-io] just went inert
rg -l '^\[workspace\]' --glob 'Cargo.toml' .

# the vendored forks still resolve (run from corpan/corpan-app/src-tauri)
cargo metadata --format-version 1 --filter-platform aarch64-linux-android \
  >/tmp/meta.json 2>/tmp/meta.err
jq -e '.packages[] | select(.name=="llama-cpp-sys-2") | select(.source==null) | .manifest_path' /tmp/meta.json
grep 'was not used in the crate graph' /tmp/meta.err   # compare to before your change
grep 'patch for the non root package' /tmp/meta.err     # a re-parented manifest
```

A patch that moves from used → unused is a HIGH finding: it silently reverts a
vendored fork. Since #528 retired the inert `ndk-context` patch, the expected
`/tmp/meta.err` is **empty** — any unused-patch line is new. Do not delete a
patch to quiet the warning unless you have proved both that the fork is inert in
the shipped graph and that upstream no longer has the defect it patched.

Note the two warnings are different failure modes: a re-parented manifest (a
stray `[workspace]`) emits the *non root package* warning and resolves the crate
to the registry — the unused-patch warning does not fire at all. A
`source = "registry+..."` line appearing on a vendored crate in the `Cargo.lock`
diff is the third, and most reliable, signal.
