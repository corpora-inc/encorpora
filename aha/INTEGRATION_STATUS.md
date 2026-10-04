# Free2Z integration evidence

Snapshot: 2026-09-28; SDK pin moved to `e95becd6` on 2026-10-04. Source integration, deployed services, and device acceptance are separate evidence.

| Surface | Evidence | Status |
|---|---|---|
| Native SDK and TypeScript facade | Unified public source `e95becd6517bada55ca933e4072ebf13bbbb3bff` (TS SDK, guest API and Rust plugin move together); exact revision-namespaced tarballs and lockfiles | Real source preview, not an invented registry release. Delivered store builds predate this pin (`534d2a58`) |
| Sign-in spend-cap hint | `signIn()` suggests `spendCap: 500 2Z`, `spendPeriod: total` | Pre-selection only, per zuu `spec/oidc.md` §5.1; deployed IdP support unverified. The grant is still verified before paid admission |
| Current grant | Supported `client.grant()` through native IPC; account/client/scope/enforcement/total-period cap/freshness verification before paid admission | Implemented and fixture-tested; AHA live acceptance pending |
| App provider | Durable request identity, exact money, same-key recovery, completed-answer acknowledgement, conservative pending settlement | Tested with explicit fake transport and real SDK over synthetic native IPC |
| Discovery and verification keys | Public discovery and advertised JWKS both returned HTTP 200 | Reachable; not proof of AHA mobile sign-in |
| AI gateway | Public HTTPS `/v1/models` returned HTTP 502 during the check | Upstream paid activation and receipt acceptance remain pending |
| Registration | Native public client configured through build-time public configuration | Native login/balance/lesson/receipt journey remains to be verified live |
| Stores | Existing TestFlight and Play internal builds are recorded in [RELEASE.md](RELEASE.md) | Source changes are not automatically delivered builds |

## Runtime integration

The native host exposes the registered public client ID, not a client secret or a
webview-configurable endpoint. The controller uses the real SDK to verify the
current grant; an obsolete compile-time disabled flag no longer decides AI
availability. `enforced=false`, missing scope, wrong account/client, expired
proof, non-total or excessive allowance all stop paid admission. Compilation,
registration, or successful balance reads cannot override these checks.

Each new operation refreshes the grant and allowance after saving its durable
identity and before invoking the model. The SDK contract supplies a live
snapshot, not an immutable per-operation policy version. Server revocation stamps
must not be treated as cap-policy versions. Internal acceptance still needs the
explicit account and aggregate spending authorization recorded privately.

Only currently advertised model IDs are selected. AI context contains bounded
candidate skills, recent answer evidence, and optional short fluency practice;
local code independently validates and grades the mathematical task. No model
response or fixture can award whole-standard mastery.

## Sign-in spend-cap hint

Sign-in passes `SIGN_IN_OPTIONS` (`src/provider/free2z.ts`): a suggested cap of
`TEST_SPEND_CAP_2Z` = 500 whole 2Z with period `total`. That is exactly the
policy `verifyTestGrant` admits (enforced, `total`, 1–500 2Z), so a parent who
accepts the pre-selection gets a grant the app can use. The hint grants nothing.
Per the spec (deployed IdP behavior not yet observed), Free2Z only lowers its amount to the registration's default cap and the user's
existing grant, ignores it when either of those is capped with a different
period, and the parent may edit or remove it on the consent screen. A sign-in
without a consent screen ignores it. Paid admission still reads the policy back
from `grant()` and refuses anything other than an enforced total cap ≤ 500 2Z.
This pin also decodes the grant's optional `enforcement_reason`; a reason that
contradicts `enforced` makes `grant()` fail closed (`invalid_response`).

Strict output (`max_output_tokens_strict`) is not adopted: it waits on the gateway image that accepts the field (the deployed gateway rejects unknown fields with 400).

## Requested scopes (#862)

AHA's consent screen listed "Start 2Z credit purchases for you to confirm"
because the app asked for `purchase:create`: `src-tauri/src/f2z.rs` built the
plugin with `f2z_sdk::Config::new(client_id)`, and `Config::new` uses the SDK's
`DEFAULT_SCOPES` (`openid profile offline_access balance:read purchase:create
ai:invoke`, zuu `rs/crates/f2z-sdk/src/config.rs` at `e95becd6`). The SDK sends
that list verbatim as the authorization request's `scope`. So this was a
client-side request, not a server default. The SDK's own doc comment says to
narrow it with `Config::with_scopes`.

AHA now requests exactly `openid offline_access balance:read ai:invoke`
(`SCOPES` in `f2z.rs`, pinned by a Rust unit test). `profile` was dropped too:
AHA never shows the account's name or picture. `ai:invoke` alone gives the
`f2z-api` audience that `grant()` needs (zuu `spec/oidc.md` §4, `spec/grant.md`).
Purchase and checkout commands were already outside the Tauri capability.

For the Free2Z team, there's nothing to fix server-side. Two notes: (1) a grant
made before this change may still carry `purchase:create` until the parent
signs in again or revokes it at free2z.cash/account/apps. (2) If AHA's
registration `allowed_scopes` includes `purchase:create`, it can be removed. The
app no longer requests it, and a request outside `allowed_scopes` fails with
`invalid_scope` (oidc.md §2), which AHA reports as a setup problem.

## Sign-in cancel and failures (#862)

On mobile, closing the sign-in browser rejects the plugin's native `authorize`.
That covers the Android Custom Tab (back, close, the 300 s expiry, or a launch
failure) and iOS `ASWebAuthenticationSession` (cancel, the expiry, or an
unaccepted callback). The Rust mobile session maps every such rejection to
`f2z_sdk::Error::Browser`, and IPC carries it as
`{code: "browser_error", retryable: false}`. The platform's message string
(`"authentication cancelled"`) never crosses IPC. `signInFailure`
(`src/application/connection.ts`) treats `browser_error`, `access_denied` (the
parent declined consent) and `cancelled` (the plugin stopped the attempt) as a
person closing sign-in. Each of those leaves AHA disconnected, shows at most a
one-line note, and records an info-level diagnostic. Every other code is logged
as an error with its code and gets a specific message, or a generic one if the
code is unknown. Disconnected Settings show only Connect Free2Z. Manage
allowance and Refresh connection appear only once connected.

## Recovery and account controls

Completed answer text and its learner/task context stay in the billing journal
until the activity/session is durably saved. A restart before that acknowledgement
restores the same answer without a new model call; replaying a displayed activity
preserves its assistance and timing. Curiosity answers are also saved before
acknowledgement. Settings can restore saved answers for their original
learner or explicitly set them aside while retaining usage records.

Unknown settlement blocks fresh paid calls. Explicit recovery uses the original
body and key within the service's recovery window. Receipt-only replay does not
pretend to regenerate text. Learner deletion and backup replacement cannot strand
unsettled requests. Stop during grant/model preparation prevents paid dispatch.
Capacity Retry-After delays survive the provider adapter and prevent immediate
manual re-dispatch; no automatic new paid retry or top-up occurs.

App-cap exhaustion and insufficient balance have distinct explanations. A fixed
native command opens `https://free2z.cash/account/apps` in the system browser for
parent-managed consent and its Billing link. No learner content can supply that
URL. Purchase/checkout SDK commands remain outside the app's capabilities.

## Remaining live acceptance

1. Obtain the platform's paid-readiness and first-receipt checkpoint through the
   private coordination runbook; reconcile the shared test allowance before any
   AHA paid call. No AHA paid call or purchase has been made.
2. Verify native browser redirects, sign-in persistence, authoritative balance,
   fresh enforced grant and advertised models on each mobile platform.
3. Exercise a generated lesson, correct/incorrect answers, hint assistance,
   curiosity, receipt reconciliation, cancellation and restart within the
   remaining authorized allowance. Keep call/account evidence private.
4. Confirm both updated store builds are installed by existing authorized
   testers. Android audience selection is now verified; physical installation remains separate
   from source tests or signed uploads.

Canonical contracts: [integration guide](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/INTEGRATION.md),
[source preview](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/SOURCE-PREVIEW.md),
[current grant](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/spec/grant.md).
