# Native build conventions

Use Rust 1.97.1 (`rust-toolchain.toml`) and the app's pinned Tauri CLI 2.11.4.
The app-root toolchain file also covers Gradle's npm-driven Cargo invocation.
Each app is its own Cargo root: do not add a shared workspace. Run the app's
frontend build before native distribution builds.

Initialize from `aha/aha-app` with `npm run tauri -- ios init --ci` or
`npm run tauri -- android init --ci`. The iOS source template is `ios/project.yml`,
not the ignored generated Xcode project. CLI 2.11.4 generates Android compile/target
SDK 36; the app config sets minimum API 29. The iOS minimum is 16.
The generated Android project is never committed, so `build.rs` patches it during
`tauri android build` with the OAuth intent filter and a native bridge (system bars and the
keyboard; see below). The
studio's theme follows the WebView's `prefers-color-scheme`. On iOS, WKWebView and
the default status-bar style both follow the system. Android WebView can disagree
with the system night mode (an S26 on Android 16 rendered light in night mode), and
the template's `enableEdgeToEdge()` picks icons once, at launch, from the system
setting. So `build.rs` adds an `ahaSystemBars` JavaScript interface to the generated
MainActivity, and `src/ui/systemBars.ts` reports the scheme the page renders, and
every change to it. The icons follow the rendered theme, never the system setting
alone. The patch panics if the template drifts. Android WebView
reports `env(safe-area-inset-*)`; the studio paints a fixed backdrop behind the top
inset so scrolled content never sits under the clock. If a reused `CARGO_TARGET_DIR`
skips build scripts after a fresh `android init`, `gen/android/.../generated/` stays
empty and Kotlin fails on `TauriActivity`; force a rebuild of the app crate.
Supply `APPLE_DEVELOPMENT_TEAM` for signed iOS initialization/builds; no account's
team identifier is baked into the app configuration or template.

Pin Android NDK **28.2.13676358** by exporting
`NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"` for both initialization and builds.
Do not rely on CLI auto-detection: it selected an installed NDK 26 in this workspace,
which produced 4 KiB ELF LOAD alignment. Even selecting NDK 28 did not change the
observed Rust ELF alignment, so `build.rs` explicitly sets 16 KiB maximum/common
page sizes for Android. Release validation must inspect
every packaged native `.so` with `llvm-readelf -l` and require LOAD alignment of at
least `0x4000`, alongside APK ZIP alignment. No developer-specific NDK path is
committed to Cargo configuration.

Icons are generated from `icons/source.svg`, with persisted iOS/Android sizes.
iOS app icons are stored as opaque RGB PNGs without an alpha channel; preserve
that encoding when regenerating to avoid App Store icon validation failures.
The app uses the existing homeschool iOS share plugin as an iOS-only dependency;
changes to that shared plugin must exercise AHA's iOS build as well. Filesystem and
dialog plugins are called from Rust only. The WebView has no generic filesystem,
dialog or share permissions.

Core checks: `cargo test --lib`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`,
and `cargo check --target aarch64-apple-ios`. A complete Android debug APK and iOS
archive still need the Tauri CLI/Gradle/Xcode pipeline; a Rust cross-check is not a
signed or installable distribution artifact. Actual document picking/sharing and
background/kill/resume behavior need device tests before release claims.

## iOS WebView and the software keyboard

`src/ios_webview.rs` sets the WKWebView scroll view's `contentInsetAdjustmentBehavior` to
`.never` app-wide (the page applies `env(safe-area-inset-*)` itself; the automatic inset left an
unpainted band under every screen). While the focus loop is on screen the page calls the
`pin_page_scroll` command, which disables the scroll view and holds it at its resting offset with
KVO on `contentOffset`: WebKit otherwise scrolls the page to reveal a focused field even with
scrolling disabled, which pushed the answer to the top of the screen above a blank gap. Leaving the
loop releases the pin, so other screens keep WebKit's reveal behaviour. The main window is built in
`setup` (`create: false` in `tauri.conf.json`) so iOS can drop the keyboard's form toolbar. The web
side (`src/ui/keyboard.ts`) lifts only the answer dock by the keyboard's overlap; verify on the iOS
Simulator with the software keyboard (`ConnectHardwareKeyboard` off), not only in a browser.

## Android WebView and the software keyboard

The keyboard overlays the page, as on iOS. The bridge `build.rs` adds to MainActivity
(`build_support/android_bridge.rs`, unit-tested) sets `SOFT_INPUT_ADJUST_RESIZE`; under the template's
`enableEdgeToEdge()` that neither resizes nor pans the window, it only delivers IME insets. The
WebView's insets listener strips the IME inset before the WebView sees it, so the layout and visual
viewports never change and Chromium never scrolls a focused field into view. The keyboard's height
reaches the page as `window.__ahaKeyboard(devicePx, settled)` on every frame of
`WindowInsetsAnimationCompat` (and `window.ahaKeyboard.height()` reads it), and `src/ui/keyboard.ts`
uses that number alone, never the viewports. Before this, the default soft-input mode panned the
window while the page's viewport math also moved the dock: on the S26 the answer overshot to
mid-screen and settled back, and the problem left the screen. Every screen gets the keyboard
variables on Android, so Settings and sheets rise above the keyboard and reveal their focused field
once it settles. Verify on a device with `adb shell screenrecord`, not only in a browser.

## Free2Z native host

The official plugin is pinned to the public source preview
`d63959f9c766258d7ce827e68f4ddd93d2797f99`; its transitive core is the sole native
client. Configure the public registration through the build environment variable
`AHA_FREE2Z_CLIENT_ID` or the gitignored file `release-config/free2z-client-id`;
`build.rs` resolves either (they must agree) into the crate. The file exists because
`tauri ios build` runs xcodebuild with a cleared environment, so the env var never
reaches the iOS Rust compile; the release workflow writes the file on both platforms and
`release_verify.py client-id` fails the release if the IPA executable or any ABI's
`libaha_lib.so` lacks the configured id. An unconfigured build starts normally with
sign-in unavailable.
No credentials, endpoint overrides or callback injection commands are exposed to
JavaScript. The local `main` window receives only the named Free2Z guest permissions.
Purchase and checkout commands are not granted in this beta, matching its disabled
external-checkout UI; enabling a payment flow requires a reviewed capability change.

The mobile redirect is `inc.corpora.aha:/oauth/callback`. The tracked iOS template
registers the scheme, and `build.rs` uses Tauri's manifest updater to insert the
Android intent filter on native builds. The SDK checks callback path, attempt state
and issuer; Android retains the generated `singleTask` activity configuration.
Desktop uses `http://127.0.0.1:0/callback` registration with an ephemeral actual port.
The purchase-return configuration is `https://encorpora.io/aha/purchase-return`.
This version does not claim a verified HTTPS app link.

`app_readiness` reports public registration configuration. The controller verifies
a current enforced total-period grant through the SDK before admitting paid work;
there is no compile-time paid-readiness override. Purchase/checkout permissions
remain disabled. A fixed native command opens the Free2Z account-management page
from Settings; it accepts no URL from the webview. Compiling the SDK does not establish
successful login, persistent credentials, live metering or settlement. Those require
registered-account testing on each shipping platform, without publishing account
details or authentication logs.
