---
name: native-move
description: Relocate, rename, or re-parent a Tauri plugin crate without breaking the frontend, the capability file, or the custom URI scheme. Use before moving anything under corpan/plugins/ or */src-tauri/, when sharing a plugin between Corpán and Dynawalla, or when a crate rename is proposed.
---

# Moving a Tauri plugin

The native layer is shared between Corpán and Dynawalla, so plugins will move.
Moving one is mostly mechanical, with two values that must survive the move
untouched.

## The invariant

**Crate names MAY change. Tauri plugin identifiers and `links =` values MUST NOT.**

A crate name is a Cargo-internal label. A plugin **identifier** is a wire
protocol: it appears in every `invoke("plugin:<id>|<command>")` call in
TypeScript, in every permission string in the capability JSON, and in the mobile
plugin registration. A `links =` value is a global key in the Cargo resolver;
two crates claiming the same one is a hard build failure, and changing one
breaks any build script keying off `DEP_<LINKS>_*`.

The identifier is the `Builder::new("<id>")` argument, **not** the crate name.
They already differ in this repo: `tauri-plugin-game-packs` registers as
`game_packs`. Never infer one from the other — read `src/lib.rs`.

Current identifiers (`rg -n 'Builder::new\("' corpan/plugins/*/src/lib.rs`):

| crate | identifier | `links =` |
|---|---|---|
| `tauri-plugin-tts` | `tts` | `tauri-plugin-tts` |
| `tauri-plugin-stt` | `stt` | `tauri-plugin-stt` |
| `tauri-plugin-asr-native` | `asr-native` | `tauri-plugin-asr-native` |
| `tauri-plugin-corpan-llm` | `corpan-llm` | `tauri-plugin-corpan-llm` |
| `tauri-plugin-haptics` | `haptics` | `tauri-plugin-haptics` |
| `tauri-plugin-radio-stream` | `radio-stream` | `tauri-plugin-radio-stream` |
| `tauri-plugin-audio-keepalive` | `audio-keepalive` | `tauri-plugin-audio-keepalive` |
| `tauri-plugin-iap` | `iap` | `tauri-plugin-iap` |
| `tauri-plugin-subscriptions` | `subscriptions` | `tauri-plugin-subscriptions` |
| `tauri-plugin-game-packs` | **`game_packs`** | `tauri-plugin-game-packs` |

Twelve crates declare `links` repo-wide (the two above plus
`homeschool-offline`'s `tauri-plugin-ios-share` and the vendored
`llama-cpp-sys-2`, which declares `links = "llama"`). All distinct.

## Who depends on the identifiers — verified call sites

Do not take this list on faith; re-run the searches. But these are the real
consumers as of 2026-07-25.

**Capability permissions.** `corpan/corpan-app/src-tauri/capabilities/default.json`
lists permissions as `<identifier>:<permission>`:

```
"tts:default", "tts:allow-speak", "audio-keepalive:default", "haptics:default",
"radio-stream:default", "iap:default", "stt:default", "asr-native:default",
"corpan-llm:default", "subscriptions:allow-show-manage-subscriptions"
```

Change an identifier and Tauri rejects the capability at build time — or worse,
the permission silently no longer matches and every command from that plugin is
denied at runtime.

**Frontend `invoke` calls.** Spread across the app *and the packs*, which is the
part that bites: packs ship independently and an installed old pack still calls
the old identifier.

```
corpan/corpan-app/src/util/haptics.ts:41        invoke("plugin:haptics|impact", …)
corpan/corpan-app/src/contentPacks/platformPacks.ts:21
                                                invoke("plugin:game_packs|list_game_packs")
corpan/packs/shared/audio/nativeRadio.ts:69,147,160,170,180,191,264,272
                                                invoke("plugin:radio-stream|…")
corpan/packs/shared/catalog/src/appShell.ts:326 invoke("plugin:iap|restore_purchases", …)
```

Find them all before moving anything:

```bash
rg -n 'plugin:<identifier>\|' -g '!node_modules' -g '!dist' -g '!*.map'
rg -n '"<identifier>:' corpan/corpan-app/src-tauri/capabilities/
```

**The `corpan-pack://` scheme.** Owned by
`corpan/plugins/tauri-plugin-game-packs/src/lib.rs:45`:

```rust
.register_uri_scheme_protocol("corpan-pack", |ctx, request| { … })
```

This is the highest-blast-radius item in the native layer. The scheme is the
origin every installed content pack is served from — `corpan-pack://localhost/<packId>/...`,
and `http://corpan-pack.localhost/...` on Android and Windows. Consumers reach
well beyond the plugin that registers it:

```
corpan/corpan-app/src-tauri/src/content_packs.rs
corpan/corpan-app/src-tauri/src/blob_store/{mod,core}.rs
corpan/corpan-app/src-tauri/src/offline_cache/{mod,core,net}.rs
corpan/corpan-app/src/lib/storage/blob.ts:8,132
corpan/corpan-app/src/lib/offlineCache/imageCache.ts
corpan/packs/juice-squeeze/src/vite-env.d.ts
```

Dropping, renaming, or failing to register `tauri-plugin-game-packs` in a new
app removes the scheme and breaks blob storage, the offline image cache, and
every installed pack at once — with a runtime failure, not a build failure.
If Dynawalla is to serve packs, it must register the same scheme.

**Mobile plugin classes.** Android Kotlin packages are independent of the crate
path (`com.corpan.llm`, `com.corpora.audio_keepalive`,
`space.httpjames.tauri_plugin_tts`) and are referenced by the Gradle module
path. A directory move changes those paths; the Kotlin `package` and the
`@TauriPlugin` class must keep working. Same for the iOS Swift package.

## Procedure

1. **Inventory first.** For the plugin being moved, record: crate name,
   `Builder::new("<id>")`, `links =`, every `invoke("plugin:<id>|…")` call site,
   every capability permission string, any registered URI scheme, the Android
   Kotlin package + Gradle path, the iOS Swift package name. Paste the inventory
   into the PR body.
2. **Move the directory.** `git mv` so history follows.
3. **Update path dependencies.** Every `Cargo.toml` referencing the plugin by
   relative path. Both apps if it is now shared.
4. **Do not touch** `Builder::new(...)`, `links =`, the scheme string, or the
   permission strings. If a rename genuinely must happen, it is a separate,
   deliberate PR with a compatibility window — old installed packs call the old
   identifier.
5. **Check `[patch.crates-io]` placement.** It is honoured only at the root
   manifest of the package being built, and **no manifest in this repo has a
   `[workspace]` section** — each `src-tauri/Cargo.toml` is its own root. Moving
   a crate must not move or orphan a `[patch]`. See the `native-gatekeeper`
   agent; this is the trap that silently reverted `ndk-context` and crashed 7+
   users with no failing test.
6. **Verify.**

```bash
# links values still unique repo-wide (must print nothing)
rg --no-heading -o '^links = "[^"]+"' --glob 'Cargo.toml' . | sed 's/.*links = //' | sort | uniq -d

# no manifest gained a [workspace] (must print nothing)
rg -l '^\[workspace\]' --glob 'Cargo.toml' .

# identifiers unchanged
rg -n 'Builder::new\("' corpan/plugins/*/src/lib.rs
rg -n 'register_uri_scheme_protocol' -g '*.rs' .

# builds, on a target that actually ships
cargo check --manifest-path <new-path>/Cargo.toml --target aarch64-linux-android
cargo check --manifest-path <new-path>/Cargo.toml --target aarch64-apple-ios
cargo fmt --check --manifest-path <new-path>/Cargo.toml
cargo clippy --manifest-path <new-path>/Cargo.toml --all-targets -- -D warnings
```

7. **Grep for stale paths** in workflows, docs, and `tauri.conf.json` before
   pushing: `rg -n '<old/path>' -g '!target' -g '!node_modules'`.

## Reporting

State the inventory, what moved, and — explicitly — that the identifiers,
`links` values, and URI scheme are byte-identical to before. That sentence is
the point of the whole procedure.
