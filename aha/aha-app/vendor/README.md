# Official Free2Z source previews

These MIT-licensed tarballs are built without source changes using the official `docs/free2z/sdk/SOURCE-PREVIEW.md` recipe. They are not registry releases.

- `free2z-tauri-plugin-f2z-api-0.1.0.tgz`: free2z/zuu commit `39ec2720c3aff5384c46f6f53fe655657c79c40e`, directory `wallet/plugins/tauri-plugin-f2z`, `npm ci && npm pack`.
- `free2z-sdk-0.1.0.tgz`: free2z/zuu commit `550c3ff29705620d53da25a1ae5da8f889778789`, directory `ts/free2z/sdk`, `npm ci && npm pack`.

Each package includes its upstream LICENSE. Native Rust must use the same plugin revision. No private absolute checkout dependency is needed. Rebuild from public immutable Git revisions, not a moving branch.

## Current unified preview

Both JavaScript packages under `free2z/sdk/42acc57feb4746bd93b1d3c7f4ed00f9690cc665/` and the native Cargo Git dependency use official commit `42acc57feb4746bd93b1d3c7f4ed00f9690cc665` (zuu #1129, opt-in `response_format`). Built without source changes from `git archive` of that revision (directories `wallet/plugins/tauri-plugin-f2z` and `ts/free2z/sdk`), then `npm ci` and `npm pack` with Node 24; each includes its upstream LICENSE. The same recipe reproduced the previous `e95becd6` tarballs byte for byte. SHA-256: `free2z-sdk-0.1.0.tgz` `9e7848d05c82b59bab16704242551c8cb9e7faa6f9ce827b064fa94e757ddb13`, `free2z-tauri-plugin-f2z-api-0.1.0.tgz` `233d9a00732e4dd5e870d492e8bd737c57ce29472fda6671c996c0042a3b23a4`. Preview package versions remain `0.1.0`, so each revision gets its own directory; the superseded `e95becd6` directory was removed with this pin. The capability explicitly permits `f2z:allow-grant` on the trusted local main window.
