# 05. Rust

## What it is

Rust is a systems programming language designed around a single
constraint: the compiler refuses to build any program that has a data
race, a use-after-free, or undefined behavior in safe code. It
achieves this by tracking, at compile time, who owns every value in
your program and how long every reference is allowed to live. The
compiler is strict; the resulting binary is not. Rust programs run at
the speed of C and C++ because the safety analysis happens before the
binary exists, not while it executes.

In this repo Rust lives in two places. It is the language of every
Tauri app's privileged side, which means it is the language of the
Corpán app's backend at `corpan/corpan-app/src-tauri/`, and it is the
language of every Tauri plugin (the seven of them in
`corpan/plugins/`). It is also the language of two sister Tauri apps,
`corpus-reader/src-tauri/` and `homeschool-offline/app/src-tauri/`.
Everywhere else in the repo, Rust is absent: the React UI is
TypeScript, the content corpus is Django and Python, the books are
Markdown and LaTeX, the shell glue is bash.

## How it fits

Rust on the privileged side of Tauri is the choice that lets the
host stay small. The corpan binary opens SQLite, makes HTTPS
requests, unzips packs onto the device's filesystem, talks to the
OS-native TTS and STT APIs, and serves files back to the webview
through a custom URL scheme. Every one of those operations is a
sharp-edged interaction with a resource the rest of the program does
not understand. Rust's ownership model is exactly the discipline that
those operations need: a SQLite connection has one owner, an HTTP
response body has one reader, and a downloaded zip is closed when its
handle drops. The compiler enforces this; the programmer does not
have to remember it.

The IPC boundary (section 04) is the point where Rust hands work to
or receives work from JavaScript. Everything on the Rust side of the
boundary is fully typed: each command declares its parameter types
and its return type, and serde does the conversion between JSON and
Rust structs in both directions. The TypeScript side mirrors those
types by hand. The "type" of the IPC seam is the union of the two
type systems; sections 05 and 07 together describe one shared
contract.

## Files and entry points

- `corpan/corpan-app/src-tauri/Cargo.toml`: the manifest of the app
  binary. Pins every dependency, points at the seven local plugins,
  declares the release profile, and patches `ndk-context` to a
  vendored fork (see section 04 for the Android exit story).
- `corpan/corpan-app/src-tauri/src/`: 2,431 lines of Rust across six
  files. `main.rs` is the entry point (six lines). `lib.rs` is the
  app's `run()` builder and the home of every `#[command]`. `db.rs`,
  `pack_db.rs`, `content_packs.rs`, and `phrase_packs.rs` are the
  modules `lib.rs` calls into.
- `corpan/plugins/<plugin>/`: seven Tauri plugins, each its own
  crate with its own `Cargo.toml`, `CHANGELOG.md`, `src/lib.rs`,
  `src/commands.rs`, and platform-specific files. The shapes are
  uniform; once you can read one, you can read all seven.
- `corpan/corpan-app/src-tauri/Cargo.lock`: present in the working
  tree but `.gitignore`d at the repo root, deliberately. The comment
  in `.gitignore` notes a `rusqlite`/`sqlx` member mismatch that
  prevents committing it without churn.
- `corpus-reader/src-tauri/` and `homeschool-offline/app/src-tauri/`:
  the two sister apps. Same Tauri-2 shape, smaller surface.

## How it works

Most of this subsection is a Rust primer using the STT plugin
(`corpan/plugins/tauri-plugin-stt/`) as the running example. The
plugin is 637 lines across six small files, every file under 220
lines, and it touches every major Rust idea: ownership, traits,
generics, conditional compilation, derive macros, error handling, and
the FFI bridge to native iOS and Android code. Read the plugin
alongside this section.

### Ownership, briefly

Every value in Rust has exactly one **owner**. When the owner goes
out of scope, the value is dropped (its destructor runs and its
resources are released). Assigning a value to a new binding **moves**
ownership unless the type implements the `Copy` trait, in which case
the value is copied. There is no garbage collector; there is no
reference counting by default; there is no shared mutable state
without explicit opt-in.

Borrowing is how a function can use a value without taking ownership.
`&T` is a shared reference (many readers allowed). `&mut T` is an
exclusive reference (one writer, no readers). The compiler enforces
that these never overlap. If a function signature borrows, the caller
keeps ownership.

The plugin's commands illustrate this:

```rust
// plugins/tauri-plugin-stt/src/commands.rs:11
#[command]
pub(crate) async fn prepare<R: Runtime>(
    app: AppHandle<R>,
    args: PrepareArgs,
) -> Result<PrepareResult> {
    app.stt().prepare(args.model)
}
```

`app` and `args` are moved into the function. `args.model` is moved
into the call to `prepare`. The function takes ownership of both and
gives back ownership of a `PrepareResult` (or an `Error`). There are
no lifetime annotations because none of these references outlive
the function call.

### Structs and derives

A `struct` is a named record. The IPC arguments and results for the
plugin live in `models.rs`:

```rust
// plugins/tauri-plugin-stt/src/models.rs:3
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareArgs {
    pub model: Option<String>,
}
```

A few things are happening here.

`#[derive(...)]` is an attribute macro. It tells the compiler to
generate code for the named traits. `Debug` gives you
`{:?}`-formatting for logging. `Clone` gives you a `.clone()` method.
`Serialize` and `Deserialize` come from serde; together they let this
struct travel as JSON on either side of the IPC boundary.

`#[serde(rename_all = "camelCase")]` controls the JSON shape. Rust
identifiers are snake_case by convention; JSON in this codebase is
camelCase. The rename keeps both sides idiomatic without anybody
writing string literals for keys.

`Option<String>` is Rust's null. There is no `null` in the type
system; the way to say "this is sometimes absent" is the `Option<T>`
enum with variants `Some(T)` and `None`. Code that wants to use the
inner value has to handle both cases, which means there is no class
of bug where you forget that something might be missing.

`pub` makes the field visible outside the module. Without `pub`,
fields are private to the file they are declared in.

### The serde rename war story

There is a docstring comment in `models.rs:188` worth reading at
least once, because it shows the texture of what plain-text comments
preserve. `StatusResult` has two memory-reporting fields:

```rust
// plugins/tauri-plugin-stt/src/models.rs:207
#[serde(default, rename = "availableMemoryMB")]
pub available_memory_mb: Option<i64>,
```

The naive way to write this is to lean on the struct-level
`#[serde(rename_all = "camelCase")]` and let serde do the
conversion. The problem is that serde reads `_mb` as one word and
emits `availableMemoryMb` (lowercase `b`). The native iOS and Android
plugins both emit `availableMemoryMB` (uppercase `MB`), because
"MB" is the conventional abbreviation. Without the explicit
per-field `rename`, serde silently drops the field on deserialization
and the JavaScript side sees `undefined`.

The comment around line 200 documents the trap, mentions that "it bit
us twice in the same week," and ties the lesson back to a sibling
issue on `PrepareResult`. Read it in place. The shape is the lesson:
prose that captures a bug class lives next to the code that protects
against it, so the next person to add a memory field does not learn
the same way.

### Enums and pattern matching

Rust enums are sum types: a value of an enum type is exactly one of
its variants. The plugin's error type is one:

```rust
// plugins/tauri-plugin-stt/src/error.rs:5
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[cfg(mobile)]
    #[error(transparent)]
    PluginInvoke(#[from] tauri::plugin::mobile::PluginInvokeError),
}
```

An `Error` is either an `Io` (carrying a `std::io::Error`) or a
`PluginInvoke` (carrying a `tauri::plugin::mobile::PluginInvokeError`,
only on mobile builds). Pattern matching on this enum exhausts both
cases:

```rust
match err {
    Error::Io(io) => { /* handle filesystem error */ }
    Error::PluginInvoke(p) => { /* handle plugin call error */ }
}
```

The compiler enforces that the match is **exhaustive**. If a new
variant is added later, every match site that does not handle it
fails to compile until it is brought up to date. This is the source
of one of Rust's most quoted properties: refactors that add new
states find their incomplete handlers automatically.

`#[derive(thiserror::Error)]` is the crate-of-the-month for ergonomic
custom error types. The `#[error(transparent)]` attribute makes the
enum delegate `Display` to the inner error, and `#[from]` lets you
write `?` (see below) to convert from the inner type without writing
a `match` by hand.

### `?` and the `Result` type

`Result<T, E>` is another enum: `Ok(T)` or `Err(E)`. Almost every
function in this codebase that can fail returns one. The plugin's
`Result` alias narrows it:

```rust
// plugins/tauri-plugin-stt/src/error.rs:3
pub type Result<T> = std::result::Result<T, Error>;
```

The `?` operator at the end of an expression means "if this is
`Err`, return it from the enclosing function; if it is `Ok`, unwrap
it." The mobile delegate uses this pattern in every call:

```rust
// plugins/tauri-plugin-stt/src/mobile.rs:30
pub fn prepare(&self, model: Option<String>) -> crate::Result<PrepareResult> {
    let args = PrepareArgs { model };
    self.handle
        .run_mobile_plugin::<PrepareResult>("prepare", Some(args))
        .map_err(|e| {
            println!("[MOBILE_STT] prepare error: {:?}", e);
            e.into()
        })
}
```

`run_mobile_plugin` returns a `Result<PrepareResult,
PluginInvokeError>`. The `map_err` transforms the inner error: it
logs it (the `println!` is intentional), then `e.into()` converts a
`PluginInvokeError` to the plugin's own `Error::PluginInvoke` variant
because the `#[from]` on the enum generates the `From` impl. The
result is a `crate::Result<PrepareResult>`. The function is six
lines including the log; the work happens in serde, in the macro,
and in the trait machinery.

### Traits and generics

A **trait** is a named collection of methods that any type can
implement. A **generic** is a type parameter that the compiler
specializes per call. Together they let you write code that operates
over many concrete types without inheritance.

The plugin's top-level public API is a trait:

```rust
// plugins/tauri-plugin-stt/src/lib.rs:26
pub trait SttExt<R: Runtime> {
    fn stt(&self) -> &Stt<R>;
}

impl<R: Runtime, T: Manager<R>> crate::SttExt<R> for T {
    fn stt(&self) -> &Stt<R> {
        self.state::<Stt<R>>().inner()
    }
}
```

`SttExt<R>` is a trait declaring one method, `stt(&self) -> &Stt<R>`.
The `impl` block implements `SttExt<R>` for **every** type `T` that
implements `tauri::Manager<R>`. The Tauri `AppHandle<R>` implements
`Manager<R>`, so the plugin's commands can write `app.stt()` to reach
the plugin's state without `AppHandle` knowing the plugin exists.
This is the "extension trait" pattern: add methods to types you do
not own.

`<R: Runtime>` is a generic parameter constrained to types that
implement the `Runtime` trait. Tauri uses this so the same plugin
source can compile against the real `Wry` runtime for shipping and
against a `MockRuntime` for tests. Without generics, the plugin
would need to commit to one runtime or duplicate its code.

### Modules and visibility

The Rust file system is the module system. A file `src/foo.rs` is a
module named `foo`, reachable from `lib.rs` by writing `mod foo;`.
`lib.rs` itself is the **crate root** for a library. `main.rs` is
the crate root for a binary. The STT plugin's `lib.rs:6` declares
its module tree:

```rust
#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
```

`#[cfg(desktop)]` is a conditional-compilation attribute. The
`desktop` module is only included in the crate on desktop builds;
the `mobile` module is only included on mobile builds. The rest of
the plugin can then write:

```rust
#[cfg(desktop)]
use desktop::Stt;
#[cfg(mobile)]
use mobile::Stt;
```

…and the `Stt` type in scope is whichever one is right for the
current target. The desktop `Stt` is a stub that returns
`{ ready: false, message: "STT not supported on desktop in this build" }`.
The mobile `Stt` delegates each method to a native iOS or Android
plugin through `run_mobile_plugin`. The frontend does not know or
care which one it is talking to.

### `setup` and the plugin Builder

The plugin's `init()` function is the Tauri-plugin equivalent of
the app's `run()` (section 04):

```rust
// plugins/tauri-plugin-stt/src/lib.rs:39
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("stt")
        .invoke_handler(tauri::generate_handler![
            commands::prepare,
            commands::start_session,
            commands::stop_session,
            commands::cancel_session,
            commands::is_available,
            commands::get_status,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            { let stt = mobile::init(app, api)?; app.manage(stt); }
            #[cfg(desktop)]
            { let stt = desktop::init(app, api)?; app.manage(stt); }
            Ok(())
        })
        .build()
}
```

It registers six commands, runs a setup closure that constructs the
right `Stt` and parks it in app state, and builds. The app's
top-level builder (section 04) calls
`.plugin(tauri_plugin_stt::init())` to bring all of this into the
binary in one line.

### Cargo

`Cargo.toml` is the build manifest. The plugin's is twenty lines:

```toml
[package]
name = "tauri-plugin-stt"
version = "0.5.1"
edition = "2021"
links = "tauri-plugin-stt"

[dependencies]
tauri = { version = "2" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1"
thiserror = "2"

[build-dependencies]
tauri-plugin = { version = "2", features = ["build"] }
tauri-build = "2"
```

A few cargo-specific concepts are visible:

- `edition = "2021"` selects the language edition. Editions are
  opt-in incompatibilities; staying in 2021 means the same set of
  reserved keywords and macro behaviors as everything else in the
  repo.
- `links = "tauri-plugin-stt"` is the native-library link key; it
  makes the Tauri build process aware that this crate corresponds
  to a native plugin module the mobile build will load by name.
- `features = ["derive"]` opts into an optional code path of the
  dependency. serde without `derive` is a pure-runtime library;
  serde with `derive` brings in the macro crate that generates the
  `Serialize`/`Deserialize` impls.
- `[build-dependencies]` are crates used by `build.rs`, not by the
  crate itself. `tauri-build` invokes the Tauri build pipeline at
  compile time to generate the IPC glue.

The app's `Cargo.toml` is longer and uses **path dependencies** to
pull in the local plugins (`path = "../../plugins/tauri-plugin-stt"`).
Path deps are what make the monorepo work for Rust: edits to a
plugin source file are picked up by the next `cargo check` of the
app, no publish required.

### Macros

Two macro flavors show up. `derive` macros (`#[derive(Debug)]`,
`#[derive(Serialize)]`) generate trait impls from a struct or enum
declaration. Attribute macros (`#[command]`, `#[tauri::command]`,
`#[cfg(...)]`) transform the item they annotate. Procedural macros
in general run at compile time, take in token streams, and emit
token streams. You do not need to write a procedural macro for
years; you just need to know that the attributes are not free
decoration, they are code generators.

`tauri::generate_handler!` is a function-style macro. It expands at
compile time into a single dispatcher that knows the names, the
parameter types, and the return types of every command listed
inside it. The compile error you get from misspelling a command
name is therefore at the macro call site, not in the runtime
dispatcher.

## Common operations

1. **Read a plugin.** Start at `src/lib.rs`, find the `init()`
   function, follow the `invoke_handler!` list to `commands.rs`,
   follow each command into the desktop or mobile module, follow
   the args and results back to `models.rs`. The seven plugins
   in `corpan/plugins/` all have this same shape.
2. **Add a new field to an IPC type.** Edit the struct in
   `models.rs`. Add the field with a matching `#[serde(rename = ...)]`
   if the camelCase auto-conversion would produce the wrong name
   (the MB case above is the canonical example). Add a TypeScript
   field on the JS side to match (section 07). If the field is
   optional, wrap it in `Option<T>` and add `#[serde(default)]`.
3. **Add a new command.** Write the function in `commands.rs` with
   `#[command]`. Add its name to the `generate_handler!` list in
   `lib.rs`. Implement the underlying behavior in the desktop and
   mobile modules so both targets compile. Bump the plugin's
   `Cargo.toml` version and update its `CHANGELOG.md`.
4. **Type-check Rust.** `cargo check` from any Rust directory. It
   does the type analysis without producing a binary, so it is the
   fastest feedback loop.
5. **Format and lint.** `cargo fmt` to format,
   `cargo clippy --all-targets` to lint. The CI does not run these
   today; the discipline is local.
6. **Run a specific test.** `cargo test <name>` from the relevant
   crate. The Rust side of this codebase is undertested by design;
   the IPC seam is the natural test surface and most of it is
   exercised end-to-end through the app.

## Why we built it this way

Rust on the privileged side is the choice that lets the host stay
small and the seam stay strict. Every command that crosses from
JavaScript into Rust forces a decision: what is the type of this
input, what is the type of this output, what can go wrong. The
compiler will not let you defer those decisions. The cost is that
adding a command takes longer than adding an endpoint in a typical
Node server; the benefit is that the command works the first time
the React side calls it and it keeps working when the app
backgrounds, the device runs out of memory, and the user denies a
permission. The Android exit story in section 04 is a small example
of what is left after the compiler has done its job: rare, sharp,
documented, fixed.

The plugin shape is uniform on purpose. Every plugin has a
`lib.rs` with a trait extension and an `init()`. Every plugin has
a `commands.rs` with `#[command]` async functions. Every plugin has
a `models.rs` with serde structs. Every plugin has a `desktop.rs`
and a `mobile.rs` (sometimes one stubs the other). The uniform
shape means a new contributor can read one plugin and read the
other six in minutes, and a generated plugin from a future Tauri
template will probably land in the same shape without ceremony.

Plain-text Rust source files inside a monorepo with path
dependencies are the parts of this stack that resist the pull
toward NPM-style ecosystem complexity. There is no package
registry, no semver-range resolution, no peer-dependency dance.
There is one workspace, fourteen `Cargo.toml` files, and a single
`cargo check` that catches a type mismatch in a plugin before the
binary is rebuilt.

## To go deeper

- Steve Klabnik and Carol Nichols, *The Rust Programming Language*
  (the "book") at `doc.rust-lang.org/book`. Chapters 4 (ownership),
  10 (generics, traits, lifetimes), 17 (object safety, dyn), and 19
  (advanced features, macros) are the foundations that everything
  in this codebase is built on.
- Jon Gjengset, *Rust for Rustaceans*, when chapter 19 of the book
  is too short. The chapter on FFI applies directly to
  `tauri::plugin::mobile::PluginInvokeError` and the
  `run_mobile_plugin` bridge.
- `cargo doc --open` from inside any Rust crate in this repo. Cargo
  builds the API documentation for the crate and every transitive
  dependency, with cross-links between them. It is the single
  fastest way to learn what is in `tauri::plugin::*` or
  `rusqlite::*` without leaving your editor.
- The Rustonomicon at `doc.rust-lang.org/nomicon` for the day you
  need to know what `unsafe` actually buys you. Nothing in this
  codebase requires it; the vendored `ndk-context` fork is the
  nearest we come.
