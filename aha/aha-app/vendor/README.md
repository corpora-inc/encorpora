# Official Free2Z source previews

These MIT-licensed tarballs are built without source changes using the official `docs/free2z/sdk/SOURCE-PREVIEW.md` recipe. They are not registry releases.

- `free2z-tauri-plugin-f2z-api-0.1.0.tgz`: free2z/zuu commit `39ec2720c3aff5384c46f6f53fe655657c79c40e`, directory `wallet/plugins/tauri-plugin-f2z`, `npm ci && npm pack`.
- `free2z-sdk-0.1.0.tgz`: free2z/zuu commit `550c3ff29705620d53da25a1ae5da8f889778789`, directory `ts/free2z/sdk`, `npm ci && npm pack`.

Each package includes its upstream LICENSE. Native Rust must use the same plugin revision. No private absolute checkout dependency is needed. Rebuild from public immutable Git revisions, not a moving branch.
