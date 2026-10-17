# AMP native preview

This independent Tauri 2 application uses the provisional identifier `inc.corpora.amp`. Its native preview displays service availability through a Rust HTTPS transport. Parent sign-in, learning sessions, purchases, book downloads and family exports are unavailable in the native interface. Those features require a configured web application; this shell does not establish that a public service or payment offer is available.

The native application does not initialize the browser OIDC manager, use development authentication, or mount the browser learning workspace. Its only privileged commands are `native_status` and `read_public_resource`, restricted to the bundled main window. The latter accepts the enum `health` or `catalog`; it cannot accept URLs, headers, credentials or arbitrary API paths.

## Service configuration

Set `AMP_NATIVE_API_ORIGIN` when compiling Rust to a trusted HTTPS API origin, for example `https://api.example.test`. The origin must have a DNS hostname, port 443, and no user information, path, query or fragment. No origin is configured by default. Missing or invalid configuration disables network reads. Configuration changes require rebuilding the native binary.

The transport rejects HTTP redirects, uses no proxy or cookie storage, imposes an eight-second request deadline, allows four simultaneous requests and reads at most 2 MiB of JSON per response. Errors expose fixed categories rather than remote response bodies or operational URLs. The webview CSP does not grant access to the configured remote API; reads go through the scoped Rust command. The public catalog is content metadata, not authority to access learner data.

## Authentication boundary

There is no native credential setter or authenticated API command. A later native session implementation must use a maintained OAuth/OIDC implementation, system-browser authorization, PKCE, exact issuer/audience/nonce validation, one-use state and exact callback matching. Cold-start and running callbacks, expiry, refresh, sign-out and stale asynchronous responses require independent verification before authenticated learning can be enabled. Memory-only credentials would require signing in again after process exit; persistent credentials require platform secure storage.

These requirements follow [OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252), [Tauri capabilities](https://v2.tauri.app/security/capabilities/) and [Tauri deep links](https://v2.tauri.app/plugin/deep-linking/). A browser harness is not evidence of device sign-in or store readiness.

## Prerequisites

- Node.js 22 or later and the dependencies installed in the parent `amp` directory.
- A Rust toolchain with rustfmt and clippy; this shell is checked with Rust 1.93.
- The platform's [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/): Xcode and command-line tools on macOS, or the corresponding Linux/Windows system dependencies.
- A reachable HTTPS API is optional for the public connection check. No learner database is needed to open the native preview.

## Run the desktop preview

Start the frontend from `amp` in another terminal:

```sh
npm run dev
```

From `amp/mobile`, start the native host:

```sh
npx --yes @tauri-apps/cli@2.11.4 dev
```

The shell expects the frontend at `http://127.0.0.1:4310`. It does not start the frontend server. Keep that server restricted to the local machine. Native preview mode does not use browser development authentication. The configuration's `frontendDist` is `../dist`, resolved relative to `mobile/tauri.conf.json`; see the [Tauri configuration reference](https://v2.tauri.app/reference/config/).

## Check the shell

Build the frontend from `amp` before checks that embed assets:

```sh
npm run build
```

Run these commands from `amp/mobile`:

```sh
cargo fmt --check
cargo check --locked
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --locked --features custom-protocol
```

The last command creates a desktop executable with bundled frontend assets. It embeds the native preview interface and public transport. It does not implement sign-in or purchases. Installer generation is disabled with `bundle.active: false`.

## iOS and Android work

The crate exports Tauri's mobile entry point. Minimum configured OS versions are iOS 16 and Android API 29. Native IDE projects and app-store identities are not included. Generating a project with the Tauri CLI requires the appropriate Xcode or Android SDK/NDK installation; it does not create a store listing or authorize publishing.

Cross-target checks, when the SDKs and toolchains are configured, run from `amp/mobile`:

```sh
cargo check --locked --target aarch64-apple-ios
cargo check --locked --target aarch64-linux-android
```

These checks verify Rust compilation only. They do not replace simulator/device launch, accessibility checks, lifecycle testing or store review. Signing material and generated IDE projects belong outside this source package; `/gen/` and `/target/` are ignored. There is no native in-app billing or ESA fulfillment implementation in this shell.

The preview icon follows the AMP interface’s wave mark. Its editable source is `icons/source.svg`; regenerate the required PNG from `amp/mobile` with:

```sh
npx --yes @tauri-apps/cli@2.11.4 icon icons/source.svg --output icons --png 128
mv icons/128x128.png icons/icon.png
```
