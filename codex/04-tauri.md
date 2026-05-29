# 04. Tauri

## What it is

Tauri is the framework Corpán is built on. A Tauri application is a
single native binary, written in Rust, that creates operating-system
windows and fills each one with a webview. The webview is the same
native browser engine the OS already ships: WKWebView on macOS and
iOS, WebView2 on Windows, WebKitGTK on Linux, and Android's system
WebView on Android. The user interface is HTML, CSS, and JavaScript
running inside that webview; the privileged work, file I/O, SQLite,
HTTP, native APIs, lives in the Rust binary. The two halves
communicate over a JSON-over-IPC channel.

The version pinned in `corpan/corpan-app/src-tauri/Cargo.toml` is
Tauri 2. The version 2 line is the one that added first-class iOS and
Android targets to what was previously a desktop-only framework, and
it is why the same `tauri::Builder` invocation in
`corpan-app/src-tauri/src/lib.rs` produces a `corpan` binary for
macOS, Windows, Linux, iOS, and Android.

## How it fits

Tauri is the host. Everything else in `corpan/corpan-app/` is either
hosted by it (the React UI in `src/`) or is plugged into it (the
seven Tauri plugins under `corpan/plugins/`, each contributing native
behavior like TTS, STT, IAP, audio keepalive, radio streaming, and
subscriptions). The Tauri runtime is also what loads packs at runtime:
the same Rust binary that exposes corpus commands also serves
installed pack files through a custom `corpan-pack://` URL scheme so
the webview can `<script src="corpan-pack://...">` packed content
that was downloaded into the app data directory.

Tauri also fixes the platform boundary on which the rest of the
Codex's architecture rests. The IPC contract (a small set of
`#[command]` functions) is the seam between the React world (sections
06, 07) and the Rust world (section 05). Most other architectural
decisions in `corpan-app/` are downstream of Tauri's choices.

## Files and entry points

- `corpan-app/src-tauri/Cargo.toml`: the Rust manifest. Pins
  `tauri = "2"`, plugin paths (relative `../../plugins/...`), and the
  release profile. The release profile is tuned for size and mobile
  (`opt-level = "z"`, `lto = true`, `codegen-units = 1`,
  `panic = "abort"`). It also patches `ndk-context` to a vendored
  fork (see "Android exit prevention" below).
- `corpan-app/src-tauri/tauri.conf.json`: the Tauri configuration.
  Names the product (`corpan`), the version (mirrors `Cargo.toml`),
  the identifier (`com.corpora.corpan`), the dev URL
  (`http://127.0.0.1:1421`, fed by Vite), the production frontend
  bundle (`../dist`), the window defaults, and the iOS/macOS signing
  identities.
- `corpan-app/src-tauri/src/main.rs`: six lines. Calls
  `corpan_lib::run()`. The library/binary split is documented in
  `Cargo.toml` (the `_lib` suffix on the library name dodges a
  Windows Cargo issue, per the comment).
- `corpan-app/src-tauri/src/lib.rs`: the heart, 1,338 lines. Declares
  the modules (`content_packs`, `db`, `pack_db`, `phrase_packs`),
  every `#[command]` exposed to the frontend, the `tauri::Builder`
  that wires them together, and the runtime event handler.
- `corpan-app/src-tauri/src/{content_packs,db,pack_db,phrase_packs}.rs`:
  the supporting modules. `db.rs` owns the bundled SQLite handle,
  `content_packs.rs` handles pack install/download, `pack_db.rs`
  opens per-pack SQLite databases, `phrase_packs.rs` is the
  multi-source phrase corpus.
- `corpan-app/src-tauri/build.rs`: two lines. Runs `tauri_build::build()`
  at compile time to generate the IPC scaffolding from the config.
- `corpan-app/src-tauri/capabilities/default.json`: the **capability**
  declaration. Tauri 2's capability system is an explicit allowlist
  of which commands and plugin permissions the main window may use.
  This file grants `core:default`, `opener:default`, `tts:*`,
  `audio-keepalive:default`, `radio-stream:default`, `iap:default`,
  `subscriptions:allow-show-manage-subscriptions`, `stt:default`,
  and `os:default`.
- `corpan-app/src-tauri/gen/android/`: generated Android project
  scaffolding. **Do not edit by hand.** Tauri regenerates it on
  `npm run tauri android dev` and on build; manual edits are
  overwritten.
- `corpan-app/src-tauri/ios/`: iOS project template; mirrors the
  Android setup but with `project.yml` and the iOS bundle config.
- `corpan-app/src-tauri/vendor/ndk-context/`: a vendored fork of the
  `ndk-context` crate with one upstream assertion removed (see the
  Android exit prevention discussion below for why).

## How it works

### The Rust/webview split

When `tauri dev` runs, two processes start. Vite serves the React
frontend at `http://127.0.0.1:1421` (the URL named in
`tauri.conf.json`'s `devUrl`). Tauri builds and runs the Rust binary,
which opens a window and points its webview at that URL. In a
production build, the same Rust binary embeds the static React build
output (`../dist`) as resources and the webview is pointed at an
internal URL that serves them.

The webview does not have direct access to anything the OS would
normally guard. It cannot read the filesystem, open arbitrary URLs,
hit local SQLite, or speak through the OS TTS API. To do any of those
things, it has to ask the Rust side.

### The IPC boundary

The webview asks the Rust side by calling `invoke()` from the Tauri
JS API. `invoke(commandName, args)` serializes `args` to JSON, sends
them over the IPC channel, the Rust side looks up the named command,
deserializes the arguments to the command's parameter types, calls
the function, serializes the return value back to JSON, and resolves
the JS-side promise with it.

A command is a Rust function annotated with `#[command]` (or
`#[tauri::command]`) and registered in the builder. The signature
declares what it expects. Here is the entry point Corpán uses to
fetch a single random phrase, abbreviated to show the contract:

```rust
// src-tauri/src/lib.rs:497
#[command]
fn get_random_entry_with_translations(
    app: AppHandle,
    state: State<'_, db::DbState>,
    pp_state: State<'_, PhrasePacksState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
    phrase_pack_ids: Option<Vec<String>>,
    base_corpus_enabled: Option<bool>,
    exclude: Option<Vec<ExcludeEntry>>,
) -> Result<EntryOut, String> { ... }
```

Several things are happening for free here:

- `AppHandle` and `State<...>` are **injected** by Tauri. They are
  not sent over the wire; Tauri sees these parameter types and
  passes references to the live app handle and to managed state
  objects the builder set up with `.manage(...)`. The frontend does
  not (and cannot) supply them.
- `Option<Vec<String>>` parameters that the frontend omits arrive as
  `None`. The frontend does not have to send keys it does not care
  about.
- `Result<EntryOut, String>` becomes a JS promise. `Ok(value)`
  resolves; `Err(msg)` rejects with the string. There is no separate
  error channel; the type is the contract.

On the JS side, the same call looks like:

```ts
import { invoke } from "@tauri-apps/api/core";

const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
  levels: ["A1", "A2"],
  languageCodes: ["es", "en"],
});
```

Two conventions worth noting. JS uses camelCase
(`languageCodes`); Rust uses snake_case (`language_codes`). Tauri
applies the conversion automatically. The TypeScript type
(`EntryOut`) is a hand-written mirror of the Rust struct; nothing
generates it from the Rust side, which means the seam is the place
errors creep in if a struct changes on one side without the other.
This is one of the places sections 05 and 07 lean on each other.

### The builder

Every Tauri app composes itself in one place. In Corpán that is
`run()` at the bottom of `lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pack_db_state = PackDbState::new();
    let phrase_packs_state = PhrasePacksState::new();
    tauri::Builder::default()
        .manage(pack_db_state)
        .manage(phrase_packs_state)
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_game_packs::init())
        .invoke_handler(tauri::generate_handler![
            get_random_entry_with_translations,
            get_random_entries_with_translations,
            count_entries_for_filter,
            get_entry_by_id_with_translations,
            search_entries_by_translation_text,
            search_entries_by_translation_text_count,
            content_packs_query_db,
            content_packs_install_from_url,
            content_packs_fetch_text,
            content_packs_fetch_bytes,
            content_packs_list_installed,
            content_packs_get_manifest_url,
            phrase_packs_invalidate_cache,
            open_apple_feedback
        ])
        .plugin(tauri_plugin_safe_area_insets_css::init())
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_audio_keepalive::init())
        .plugin(tauri_plugin_radio_stream::init())
        .plugin(tauri_plugin_iap::init())
        .plugin(tauri_plugin_subscriptions::init())
        .plugin(tauri_plugin_stt::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| { /* open SQLite, manage db state */ })
        .build(tauri::generate_context!())
        .expect(...)
        .run(|_app_handle, event| { /* runtime event handler */ });
}
```

Read top to bottom: register two managed state objects so commands
can find them by type; install the plugins this app uses; declare
the fourteen commands the frontend can call; install the rest of
the plugins; run a setup hook that opens the bundled SQLite
database and adds its handle to managed state; build the app from
the config in `tauri.conf.json`; and finally enter the runtime
event loop.

`tauri::generate_handler!` is a macro that expands at compile time
into a single dispatcher that knows about every named command and
its parameter types. Adding a new command means writing the
function, adding its name to the macro's argument list, and
exporting the matching TypeScript type from `src/` for the
frontend to use.

### Capabilities

Tauri 2 separates "is the command compiled in" from "is the window
allowed to call it." Even with a command registered in
`invoke_handler`, the webview can only call it if the capability
file grants the right permission. The current capability file lives
at `src-tauri/capabilities/default.json` and lists permissions per
plugin. `tts:allow-speak` means the main window may invoke the
`speak` command on the TTS plugin; `core:default` rolls up the
baseline window operations.

This is the difference between an Electron app (which gives the
renderer the full Node API by default and asks the developer to be
careful) and a Tauri app (which whitelists each capability per
window). For a mobile-shipping app that bundles a SQLite database
of user-content the user did not author, the smaller default surface
is the right tradeoff.

### Android exit prevention

The runtime event handler at the bottom of `run()` is the most
production-incident-driven thirty lines in this codebase. The comment
in `lib.rs:1314` documents the chain of failures it prevents; the
short version:

- `tao` (the windowing crate Tauri uses through `wry`) ends its
  event loop by calling `std::process::exit()`.
- On Android, `std::process::exit()` runs `__cxa_finalize`, which
  invokes every C++ static destructor across `libhwui`, `libgui`,
  and OEM vendor libraries, on the event-loop thread, while the
  RenderThread, Mali GPU workers, and OEM singletons are still live.
- Those teardowns abort the process with
  `pthread_mutex_lock called on a destroyed mutex`, segfault in
  `Surface::connect` on a dead BufferQueue, or crash inside vendor
  destructors.
- `tauri-runtime-wry` raises `RunEvent::ExitRequested` before that
  exit, on any Android Activity `onDestroy` (which fires on a Back
  press, a swipe-from-recents, an OOM kill, or a config change).

The fix is a single line, inside the Android-only `cfg`:

```rust
.run(|_app_handle, event| {
    if let tauri::RunEvent::ExitRequested { api: _api, .. } = event {
        #[cfg(target_os = "android")]
        _api.prevent_exit();
    }
});
```

`prevent_exit()` keeps the event loop alive. Android then reclaims
the process through `SIGKILL` when it needs the memory back, which
runs no destructors and is race-free. Desktop platforms are
intentionally left to exit normally. The 7+ users hitting this
crash in `0.13.1` (per the comment) and the calm decision to vendor
a fork of `ndk-context` to remove an upstream assertion are the
adjacent fingerprints of the same incident.

This is included not for the fix itself but for the shape: a one-line
event handler with thirty lines of comment, born from production
crashes on real devices, citing the exact call stack. That is what
load-bearing prose around load-bearing code looks like.

## Common operations

1. **Run the app with hot reload.** From `corpan/corpan-app/`:
   `npm run tauri dev`. Vite watches React; Tauri rebuilds Rust on
   change.
2. **Type-check without running.** `cargo check` from
   `corpan-app/src-tauri/` for Rust, `npm run tsc` from
   `corpan-app/` for TypeScript. CI runs both.
3. **Add a new command.** Write the Rust function with `#[command]`,
   register it in the `invoke_handler!` list in `run()`, add the
   matching TypeScript types to the frontend, and call it from React
   via `invoke()`. If the command touches a plugin that needs new
   permissions, edit `capabilities/default.json` accordingly.
4. **Build a desktop binary.**
   `npm run tauri build`. Output in `corpan-app/src-tauri/target/release/`
   and `bundle/`.
5. **Build for iOS or Android.**
   `npm run tauri ios build` / `npm run tauri android build`. The
   first time on a fresh machine, Tauri runs `init` to fill out
   `gen/android/` and `ios/`; subsequent builds use them in place.
6. **Inspect what compiles together.**
   `cargo tree -p corpan` from `corpan-app/src-tauri/`. Shows the
   plugin paths (`../../plugins/...`) and the full transitive
   dependency graph.

## Why we built it this way

Tauri over Electron is the choice that opened mobile. Electron
bundles Chromium and Node for every install; the resulting desktop
binary is on the order of 100 to 200 MB before any application code,
and there is no Electron equivalent for iOS or Android at all. Tauri
ships a Rust binary that uses the OS's existing webview, so a
desktop Corpán binary is in the single-digit-megabytes range and the
same source tree builds for iOS and Android.

Rust on the privileged side and React in the webview is the
specialization split that pays for itself. The privileged work is
sharp-edged: open SQLite, hit HTTPS, spawn TTS, manage installed
packs on disk, talk to native IAP APIs. Rust's type system and
ownership model are exactly the discipline that those operations
need, and the cost (a slower edit cycle than pure JavaScript) is
absorbed by keeping Rust code small. The webview side is high-churn
UI work; React and TypeScript carry that load, and the IPC boundary
keeps the two paces from interfering with each other.

The capability system is the other quiet win. A mobile app that
downloads packs containing third-party JavaScript and serves them
through a custom URL scheme needs explicit answers to "what can that
JavaScript reach?" The default capabilities file is that answer in
one place. Tauri 1 did not have this; the Tauri 2 model is one of
the largest reasons the upgrade was worth doing.

The Android exit code is also why this stack is the right one.
Catching the crash required reading `tao` and `tauri-runtime-wry`
source, vendoring a crate, and writing thirty lines of comment that
the next maintainer (or agent) can read in place. None of that is
available when the application platform is a black box.

## To go deeper

- Tauri's own documentation at `v2.tauri.app` is in good shape;
  start with "Commands" and "Capabilities" and read the IPC pages
  before the plugin pages.
- `corpan/corpan-app/src-tauri/MANUAL.md` for incident-specific
  recipes that have not yet earned a real doc, and for iOS
  `Info.plist` adjustments the framework does not write.
- Read the comment at `lib.rs:1314` once a year. It is a small
  master class in writing prose that protects a fix that nobody
  remembers why they made.
