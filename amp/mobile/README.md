# AMP native preview

This independent Tauri 2 application uses the provisional identifier `inc.corpora.amp`. A configured native build lets a parent sign in through the system browser, select an existing owned learner, practice, review progress and read books in the app. Server-side consent, learner ownership and student-license checks govern access.

Learner creation, consent enrollment, purchases, PDF downloads and family data exports require the configured web application. The native interface does not expose those actions. No public service, live identity registration or payment offer is included. Without identity configuration, the app displays a public service-connection preview.

## Service and identity configuration

Set `AMP_NATIVE_API_ORIGIN` when compiling Rust to a trusted HTTPS API origin, for example `https://api.example.test`. It must have a DNS hostname, port 443, and no user information, path, query or fragment. No origin is configured by default.

Native sign-in additionally requires `AMP_NATIVE_OIDC_CONFIG`, a build-time JSON object with these fields. Use deployment configuration outside this public repository for actual provider identifiers.

```json
{
  "issuer": "https://identity.example.test/",
  "authorization": "https://identity.example.test/authorize",
  "token": "https://identity.example.test/token",
  "jwks": "https://identity.example.test/jwks",
  "api": "https://api.example.test/",
  "clientId": "NATIVE_PUBLIC_CLIENT_ID",
  "resource": "API_RESOURCE_AUDIENCE",
  "scopes": []
}
```

All endpoint URLs must use HTTPS on port 443 without credentials, queries or fragments. `api` must match `AMP_NATIVE_API_ORIGIN`. The provider must register the public native client and the exact callback `inc.corpora.amp://oauth/callback`, support authorization code with S256 PKCE and the configured resource parameter, and issue an API access token accepted by AMP's server. No client secret is used. The `openid` scope is automatic; additional provider-approved scopes, including `offline_access` where appropriate, are explicit configuration. Refresh is available only when the provider issues a refresh token.

The issuer and JWKS are pinned explicitly; the client does not discover or accept additional endpoints. ID tokens must use RS256 or ES256. The maintained [OpenID Connect Rust client](https://docs.rs/openidconnect/latest/openidconnect/) verifies signatures, issuer, client audience, expiry and nonce; the app also checks issue time and an access-token hash when present. Before exposing a session, `/api/v1/session` must return the same identity using the server's independent API access-token verifier. An ID token alone cannot authorize learner access.

## Session and transport boundaries

Authorization opens the system browser. A random state, nonce and PKCE verifier belong to one pending transaction with a five-minute lifetime. The exact callback is consumed before code exchange, preventing duplicate redemption. Invalid or unsolicited links cannot create a session. Cold-start links without an in-memory pending transaction require a new sign-in.

Access and refresh tokens stay in Rust memory. JavaScript receives a random opaque handle, not a bearer token, and can invoke only the fixed learning-request enum. Tokens are not persisted; quitting the native process requires signing in again. Refresh operations are serialized and retain the same account identity. Sign-out clears the native session and pending authorization; generation checks reject obsolete exchanges and API responses. Local sign-out does not clear the identity provider's system-browser cookies, revoke provider tokens or undo a request the server already committed.

The session transport rejects redirects and ambient proxies, accepts at most 16 KiB of request JSON and 2 MiB of response JSON, and imposes ten-second request deadlines with four simultaneous network operations. Public health/catalog reads have their own four-request budget and eight-second deadline. The webview CSP does not permit direct remote API access. Privileged commands are restricted to the bundled main window; there is no arbitrary URL, header or credential setter. These boundaries do not make a compromised frontend harmless: it can still request the learning actions allowed to the current parent.

The design follows [OAuth for Native Apps](https://www.rfc-editor.org/rfc/rfc8252), [Tauri capabilities](https://v2.tauri.app/security/capabilities/) and [Tauri deep links](https://v2.tauri.app/plugin/deep-linking/).

## Verification and release limits

`session-core` is the production Rust path dependency used by both Tauri and the signed-provider fixture. The fixture drives browser authorization, verifies PKCE independently, signs real ephemeral tokens, and exercises the same Rust verification/session logic against real AMP routes and an isolated PostgreSQL schema. Its loopback configuration constructor exists only under `cfg(test)`; there is no insecure runtime switch or fixture feature in the shipped application.

From `amp`, with a dedicated test database configured through `AMP_TEST_DATABASE_URL`, run:

```sh
npm run test:native-session
```

The harness supplies a controlled OS callback adapter. It proves the shared session core and app interaction, not operating-system callback registration. Live provider registration, signed app installation, actual iOS/Android cold-start and running callback delivery, system-browser return, device accessibility and store review require separate verification. The app does not claim offline practice or persistent native credentials.

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
cargo fmt --check --manifest-path session-core/Cargo.toml
cargo clippy --locked --manifest-path session-core/Cargo.toml --all-targets -- -D warnings
cargo test --locked --manifest-path session-core/Cargo.toml
cargo build --locked --features custom-protocol
```

The last command creates a desktop executable with bundled frontend assets. It embeds the frontend and the configured native transport/session capabilities. It does not implement native purchases. Installer generation is disabled with `bundle.active: false`.

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
