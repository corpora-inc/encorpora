# Official Free2Z SDK release tarballs

These MIT-licensed tarballs are built without source changes using the official `docs/free2z/sdk/SOURCE-PREVIEW.md` recipe at the release tag. They are not registry releases (Free2Z has not published to npm). Each package includes its upstream LICENSE. Native Rust must use the same tag. No private checkout is needed; rebuild from the public immutable tag, never a moving branch.

## Current release: `sdk-v0.2.0`

Both JavaScript packages under `free2z/sdk/sdk-v0.2.0/` and the native Cargo Git dependency (`tauri-plugin-f2z = { git = "https://github.com/free2z/zuu", tag = "sdk-v0.2.0" }`) use the coordinated release tag `sdk-v0.2.0`, commit `40bfabffb3f765046ceafad213a26a5754dbd6b9` (zuu #1180; release notes `docs/free2z/sdk/RELEASES.md`). Over the previous pin `d63959f9` it adds tool calling (`Tool.strict`, `tool_choice`, `parallel_tool_calls`, the streamed `tool_call_delta` event, `runTools`/`run_tools` capped at 32 rounds, per-round session pinning), opt-in `reasoning_effort` gated by `capabilities.reasoning_effort` and `controls.effort_levels`, the gateway's `: ping` keep-alives, and version `0.2.0` on every package (`@free2z/sdk` 0.2.0 declares `@free2z/tauri-plugin-f2z-api@^0.2.0` as its peer, so a 0.1.0 guest build no longer satisfies it).

Recipe: `git archive sdk-v0.2.0 wallet/plugins/tauri-plugin-f2z ts/free2z/sdk`, then `npm ci && npm pack` in each directory with Node 24.19.0. The same recipe first reproduced the previous `d63959f9` tarballs byte for byte (`3ce0f25c…` and `95e26140…`), so the build is deterministic. Upstream tests at the tag: TS SDK 67/67, guest API 6/6.

SHA-256:

- `free2z-sdk-0.2.0.tgz` `c9ef5644131ef307f3c2343d21adc5eac5b3a936bb9be2b632ba4283f33e1c3d`
- `free2z-tauri-plugin-f2z-api-0.2.0.tgz` `957a048dc9e38583267d9b8e1c468f03829a2e9864eebb9d5d1e0ec0e4d6de3d`

Install: `npm install ./vendor/free2z/sdk/sdk-v0.2.0/free2z-tauri-plugin-f2z-api-0.2.0.tgz ./vendor/free2z/sdk/sdk-v0.2.0/free2z-sdk-0.2.0.tgz` (`package-lock.json` carries the integrity). The superseded `d63959f9…` directory and the two unreferenced 0.1.0 tarballs at the vendor root (from `39ec2720`/`550c3ff2`) were removed with this pin. The capability explicitly permits `f2z:allow-grant` on the trusted local main window.
