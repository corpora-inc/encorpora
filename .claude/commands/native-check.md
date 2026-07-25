---
description: Run the native/Rust gate — fmt, clippy, cross-compile, links uniqueness, [patch] integrity
---

Gate the native changes in $ARGUMENTS (a crate path, or the current branch's
diff under `native/`, `*/src-tauri/`, `corpan/plugins/`). Use the
`native-gatekeeper` agent; report each check with its actual output.

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
```

A patch that moves from used → unused is a HIGH finding: it silently reverts a
vendored fork. `ndk-context` is already unused on `main` today — that is the
baseline, not your regression. Do not delete a patch to quiet the warning.
