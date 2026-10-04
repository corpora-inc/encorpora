# Official Free2Z source previews

These MIT-licensed tarballs are built without source changes using the official `docs/free2z/sdk/SOURCE-PREVIEW.md` recipe. They are not registry releases.

- `free2z-tauri-plugin-f2z-api-0.1.0.tgz`: free2z/zuu commit `39ec2720c3aff5384c46f6f53fe655657c79c40e`, directory `wallet/plugins/tauri-plugin-f2z`, `npm ci && npm pack`.
- `free2z-sdk-0.1.0.tgz`: free2z/zuu commit `550c3ff29705620d53da25a1ae5da8f889778789`, directory `ts/free2z/sdk`, `npm ci && npm pack`.

Each package includes its upstream LICENSE. Native Rust must use the same plugin revision. No private absolute checkout dependency is needed. Rebuild from public immutable Git revisions, not a moving branch.

## Current unified preview

Both JavaScript packages under `free2z/sdk/e95becd6517bada55ca933e4072ebf13bbbb3bff/` and the native Cargo Git dependency use official commit `e95becd6517bada55ca933e4072ebf13bbbb3bff`. Built without source changes from `git archive` of that revision (directories `wallet/plugins/tauri-plugin-f2z` and `ts/free2z/sdk`), then `npm ci` and `npm pack` with Node 24; each includes its upstream LICENSE. The same recipe reproduced the previous `534d2a58` tarballs byte for byte. SHA-256: `free2z-sdk-0.1.0.tgz` `678b76c76b26491c5239d125087beff2012fd89e364ec36d65a56469f72e1ba1`, `free2z-tauri-plugin-f2z-api-0.1.0.tgz` `bc776116763de24c67482b0708ab1d0302f87b83d902939612d6af6786a57d75`. Preview package versions remain `0.1.0`, so each revision gets its own directory; the superseded `534d2a58` directory was removed with this pin. The capability explicitly permits `f2z:allow-grant` on the trusted local main window.
