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

*(none)*
