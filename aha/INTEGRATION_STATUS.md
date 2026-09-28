# Free2Z integration evidence

Snapshot: 2026-09-27. This file separates code from deployment and device acceptance.

| Surface | Evidence | Status |
|---|---|---|
| Native SDK | Public reviewed source `39ec2720c3aff5384c46f6f53fe655657c79c40e` | Prerelease source, not a registry release |
| TypeScript facade | Public reviewed source `550c3ff29705620d53da25a1ae5da8f889778789`; exact tarball built with npm ci/pack | Packaged |
| App provider | Real Client/NativeTransport, durable request identity, exact money, bounded output, same-key recovery | Contract-tested with fake transport; not live |
| OIDC discovery | GET https://free2z.cash/.well-known/openid-configuration returned HTTP200 | Reachable, not proof of login |
| Registration console | AHA native public client registered, zero markup; repository build variable configured | Login and metered inference not yet verified end-to-end |
| AI gateway | https://ai.free2z.cash/v1/models failed DNS resolution from build Mac | Live inference blocked |
| Store APIs | TestFlight build `0.1.0.29842540` is processed and available to the existing internal group; Play build `29842522` is completed internally | Play tester audience and physical installation on both platforms remain unverified; see [RELEASE.md](RELEASE.md) |
| Paid acceptance | User identifies account at sign-in, maximum $5 existing balance; no credit purchases | No paid calls made |

## Public registration configuration

Intended public client: ¡AHA!, zero developer markup, inc.corpora.aha native app. Register `inc.corpora.aha:/oauth/callback` and desktop ephemeral `http://127.0.0.1:<port>/callback` per SDK rules; purchase return `https://encorpora.io/aha/purchase-return` must exist before purchase flows. A configured client ID is supplied to Rust at build time as AHA_FREE2Z_CLIENT_ID, never as a credential or webview override. No invented client ID is built in.

Android custom-scheme intent and iOS URL types must match the registration. Upgrade to claimed HTTPS only after valid AASA/assetlinks and platform verification. Until configured, the app exposes local practice clearly and sign-in explains the exact missing service setup.

## Spending correctness

The estimate is not a maximum charge. Paid tests require separately verified total-period grant metadata for the selected account, a cap <=500 whole2Z (reverify USD conversion at live test), and sufficient remaining service cap and local authorization. Estimate responses do not expose cap period; do not infer total-period consent from a small remainder. Native readiness keeps paid testing disabled pending actual service/grant evidence. Do not set a ready flag merely to make a demo work.

Calls persist identity/body before invocation. Unknown or pending settlement blocks new calls. Cancellation does not imply zero charge. Finalized transcripts are archived separately from the compact usage ledger; pending output is bounded and journal capacity is reserved before any billable call. Recovery older than24h never silently creates a new charge.

## Next live acceptance steps

1. Verify the registration console and deployed catalogue/estimate/chat/call endpoints are ready (upstream epic free2z/zuu#1047).
2. Native client registration and public policy/return pages are now present. Verify the configured OS redirect round trip and native credential persistence.
3. User identifies and authenticates the funded test account. Verify total-period cap and provider conditions for supervised child-directed use.
4. Implement/read authoritative grant verification through the released SDK contract before enabling paid readiness; no private-auth bypass.
5. Perform native login/balance/lesson/receipt/restart on each platform within the authorized cap. Record call IDs and balance evidence without tokens or learner identifiers.

Browser fixtures, mocked receipts and successful native compilation do not satisfy these steps.
