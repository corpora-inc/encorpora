# Official Free2Z source previews

These MIT-licensed tarballs are built without source changes using the official `docs/free2z/sdk/SOURCE-PREVIEW.md` recipe. They are not registry releases.

- `free2z-tauri-plugin-f2z-api-0.1.0.tgz`: free2z/zuu commit `39ec2720c3aff5384c46f6f53fe655657c79c40e`, directory `wallet/plugins/tauri-plugin-f2z`, `npm ci && npm pack`.
- `free2z-sdk-0.1.0.tgz`: free2z/zuu commit `550c3ff29705620d53da25a1ae5da8f889778789`, directory `ts/free2z/sdk`, `npm ci && npm pack`.

Each package includes its upstream LICENSE. Native Rust must use the same plugin revision. No private absolute checkout dependency is needed. Rebuild from public immutable Git revisions, not a moving branch.

## Current unified preview

Both JavaScript packages under `free2z/sdk/d63959f9c766258d7ce827e68f4ddd93d2797f99/` and the native Cargo Git dependency use official commit `d63959f9c766258d7ce827e68f4ddd93d2797f99` (zuu main after #1134, #1136, #1137, #1138 and #1143, which preserves schema member order end to end and makes the plugin enable serde_json `preserve_order`; earlier: typed estimate budget fields and model catalogue, `preflight()`, typed error codes, native refusal `details`, distinct sign-in codes). Built without source changes from `git archive` of that revision (directories `wallet/plugins/tauri-plugin-f2z` and `ts/free2z/sdk`), then `npm ci` and `npm pack` with Node 24.19.0; each includes its upstream LICENSE. The same recipe reproduced the previous `42acc57f` tarballs byte for byte first. SHA-256: `free2z-sdk-0.1.0.tgz` `3ce0f25c1bc32fc0edbf8e5e22a45c3e4366f74dcc1ae889cfaf4821fb941326`, `free2z-tauri-plugin-f2z-api-0.1.0.tgz` `95e26140f01b6e31778e1c23099c2174ac4f49ab8710a8902827bcb1c4afe03a` (its only content change from `d4d58ea3` is the packed CHANGELOG; the SDK tarball is byte-identical to `d4d58ea3`'s). Upstream tests at that revision: TS SDK 52/52, guest API 6/6. Preview package versions remain `0.1.0`, so each revision gets its own directory (and `package-lock.json` carries the new integrity); the superseded `42acc57f` directory was removed with this pin. The capability explicitly permits `f2z:allow-grant` on the trusted local main window.
