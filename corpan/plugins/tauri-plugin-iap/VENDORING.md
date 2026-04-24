# Vendoring

This directory is a vendored copy of [Choochmeque/tauri-plugin-iap](https://github.com/Choochmeque/tauri-plugin-iap).

## Pinned version

- **Upstream tag:** `v0.8.2`
- **Upstream commit:** `21e1916e6bea6489626107e102438910bbd64c27`
- **Vendored on:** 2026-04-23

## Why vendored

The upstream plugin has no retry logic around StoreKit's
`Product.products(for:)`, which is known to transiently return empty
sets in sandbox. Vendoring gives us the option to patch Swift/Kotlin
directly (e.g. add retry at the native layer, expose richer errors,
add logging hooks) without waiting on upstream.

Today we are carrying **no local patches** — the vendored source
is an unmodified snapshot of `v0.8.2`. Any divergence should be
documented in this file under "Local patches" below as it accrues.

## Wire-up

`corpan/corpan-app/src-tauri/Cargo.toml` references this directory
via a path dependency:

```toml
tauri-plugin-iap = { path = "../../plugins/tauri-plugin-iap" }
```

JS side: the app uses raw `invoke("plugin:iap|...")` calls against the
plugin's Tauri commands — it does NOT import from the
`@choochmeque/tauri-plugin-iap-api` npm package. No JS wire-up needed
here.

## Re-syncing from upstream

```sh
cd corpan/plugins
rm -rf tauri-plugin-iap
git clone --depth 1 --branch v<next-tag> https://github.com/Choochmeque/tauri-plugin-iap.git
cd tauri-plugin-iap && rm -rf .git .github .gitignore
# Re-apply any entries from "Local patches" below.
# Update this file's pinned version.
```

## Local patches

### 2026-04-23 — `resetTestTransactions` command

Added a new command that iterates `Transaction.currentEntitlements` +
`Transaction.unfinished` and calls `finish()` on each — clears pending
transaction state that routinely tangles dev iteration. Returns the
count of transactions finished.

Earlier iteration tried to call `SKTestSession.clearTransactions()` for
a harder "wipe the local test DB" reset, but that requires the
`StoreKitTest` framework which lives in Xcode's
`Developer/Library/Frameworks/` and is not available to regular app
targets without hardcoded linker paths in `Package.swift`. Apple gates
this API to XCTest targets by design. The weaker `Transaction.finish()`
approach works without any framework linkage changes. Non-consumable
ownership cannot be reset by any in-app code — Apple-side limitation;
switch Apple IDs to get a truly fresh slate.

Files wired (re-apply on upstream re-sync):

- `ios/Sources/IapPlugin.swift` — `@objc func resetTestTransactions(_:)`.
- `src/models.rs` — `ResetTestTransactionsResponse { finished: u32 }`.
- `src/commands.rs` — `reset_test_transactions` command fn.
- `src/mobile.rs` — `reset_test_transactions` on `Iap<R>`.
- `src/desktop.rs`, `src/macos.rs`, `src/windows.rs` — stub impls that
  return "iOS-only" error for trait consistency.
- `src/lib.rs` — `commands::reset_test_transactions` in
  `generate_handler!`.
- `build.rs` — `"reset_test_transactions"` in COMMANDS.
- `permissions/default.toml` — `allow-reset-test-transactions` in
  default allow list.
