# AMP native preview

This Tauri 2 shell hosts the AMP mathematics interface in a native webview. It is an independent application with the provisional identifier `inc.corpora.amp`. It has no Free2Z dependency, native purchase integration, or privileged frontend commands.

The supported use is a local desktop preview connected to the AMP development server. A compiled binary is not a production-ready mobile learning application. The bundled frontend uses same-origin `/api` requests, while a native webview has a local asset origin. Hosted API routing, system-browser sign-in with a native callback, secure token storage, purchases, offline entitlement verification, and durable offline learner synchronization require explicit integration before distribution. The browser OIDC redirect flow is not a native authentication implementation.

## Prerequisites

- Node.js 22 or later and the dependencies installed in the parent `amp` directory.
- A Rust toolchain with rustfmt and clippy; this shell is checked with Rust 1.93.
- The platform's [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/): Xcode and command-line tools on macOS, or the corresponding Linux/Windows system dependencies.
- A configured local AMP API and PostgreSQL database for interactive practice. Follow the parent project's setup instructions.

## Run the desktop preview

Start the API from `amp` in one terminal using the documented local development environment:

```sh
npm run dev:api
```

Start the frontend from `amp` in another terminal:

```sh
npm run dev
```

From `amp/mobile`, start the native host:

```sh
npx --yes @tauri-apps/cli@2.11.4 dev
```

The shell expects the frontend at `http://localhost:4310`. It does not start either server. Keep development authentication and both servers restricted to the local machine. The configuration's `frontendDist` is `../dist`, resolved relative to `mobile/tauri.conf.json`; see the [Tauri configuration reference](https://v2.tauri.app/reference/config/).

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

The last command creates a desktop executable with bundled frontend assets. It does not establish that sign-in, API requests or purchases work from the bundled origin. Installer generation is disabled with `bundle.active: false`.

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
