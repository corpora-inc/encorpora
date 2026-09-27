# Native build conventions

Use Rust 1.97.1 (`rust-toolchain.toml`) and the app's pinned Tauri CLI 2.11.4.
Each app is its own Cargo root: do not add a shared workspace. Run the app's
frontend build before native distribution builds.

Initialize from `aha/aha-app` with `npm run tauri -- ios init --ci` or
`npm run tauri -- android init --ci`. The iOS source template is `ios/project.yml`,
not the ignored generated Xcode project. CLI 2.11.4 generates Android compile/target
SDK 36; the app config sets minimum API 29. The iOS minimum is 16.

Pin Android NDK **28.2.13676358** by exporting
`NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"` for both initialization and builds.
Do not rely on CLI auto-detection: it selected an installed NDK 26 in this workspace,
which produced 4 KiB ELF LOAD alignment. NDK 28 supplies the 16 KiB page-compatible
linker defaults required for modern Play delivery. Release validation must inspect
every packaged native `.so` with `llvm-readelf -l` and require LOAD alignment of at
least `0x4000`, alongside APK ZIP alignment. No developer-specific NDK path is
committed to Cargo configuration.

Icons are generated from `icons/source.svg`, with persisted iOS/Android sizes.
The app uses the existing homeschool iOS share plugin as an iOS-only dependency;
changes to that shared plugin must exercise AHA's iOS build as well. Filesystem and
dialog plugins are called from Rust only. The WebView has no generic filesystem,
dialog or share permissions.

Core checks: `cargo test --lib`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
and `cargo check --target aarch64-apple-ios`. A complete Android debug APK and iOS
archive still need the Tauri CLI/Gradle/Xcode pipeline; a Rust cross-check is not a
signed or installable distribution artifact. Actual document picking/sharing and
background/kill/resume behavior need device tests before release claims.
