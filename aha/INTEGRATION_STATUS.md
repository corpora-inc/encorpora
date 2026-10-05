# Free2Z integration evidence

Snapshot: 2026-09-28; SDK pin moved to `e95becd6` on 2026-10-04. Source integration, deployed services, and device acceptance are separate evidence.

| Surface | Evidence | Status |
|---|---|---|
| Native SDK and TypeScript facade | Unified public source `e95becd6517bada55ca933e4072ebf13bbbb3bff` (TS SDK, guest API and Rust plugin move together); exact revision-namespaced tarballs and lockfiles | Real source preview, not an invented registry release. Delivered store builds predate this pin (`534d2a58`) |
| Sign-in spend-cap hint | `signIn()` suggests `spendCap: 100 2Z`, `spendPeriod: month` | An optional suggestion the user may change or remove, per zuu `spec/oidc.md` §5.1; deployed IdP support unverified. Admission never compares a grant with it |
| Spending policy (#879) | "Budget optional": any app budget (amount, period) or none. Paid admission checks account/client/scope/freshness/`enforced`, then the estimate against balance and budget remainder | Implemented and fixture-tested (unit + `test:ai` with a TEST-ONLY fake SDK). **Not live-verified**; the platform still reports `platform_disabled` |
| AI activity batches (#867) | Activity Spec prompt, journal v2 (2600-token budget, v1 records recoverable), durable prefetch queue, local grading and `ai-spec` evidence | Wired and tested with TEST fixture specs over the real SDK and synthetic native IPC; live gpt-4o output, cost and parse rate unverified |
| App provider | Durable request identity, exact money, same-key recovery, completed-answer acknowledgement, conservative pending settlement | Tested with explicit fake transport and real SDK over synthetic native IPC |
| Discovery and verification keys | Public discovery and advertised JWKS both returned HTTP 200 | Reachable; not proof of AHA mobile sign-in |
| AI gateway | Public HTTPS `/v1/models` returned HTTP 502 during the check | Upstream paid activation and receipt acceptance remain pending |
| Registration | Native public client configured through build-time public configuration | Native login/balance/lesson/receipt journey remains to be verified live |
| Stores | Existing TestFlight and Play internal builds are recorded in [RELEASE.md](RELEASE.md) | Source changes are not automatically delivered builds |

## Runtime integration

The native host exposes the registered public client ID, not a client secret or a
webview-configurable endpoint. The controller uses the real SDK to verify the
current grant; an obsolete compile-time disabled flag no longer decides AI
availability. `enforced=false`, missing scope, wrong account/client or an expired
proof stop paid admission. The budget's size and period never do. Compilation,
registration, or successful balance reads cannot override these checks.

Each new operation re-reads the grant, then re-estimates against balance and budget
remainder, after saving its durable identity and before invoking the model. The SDK
contract supplies a live snapshot, not an immutable per-operation policy version.
Server revocation stamps must not be treated as cap-policy versions. Internal
acceptance still needs the explicit account and aggregate spending authorization
recorded privately.

## Spending policy: budget optional (#879)

The app budget belongs to the user. They set, change or remove it in Free2Z, on the
consent screen or at free2z.cash/account/apps, never in AHA. AHA admits paid AI with
any budget (any amount, `day`/`week`/`month`/`total`) and with none, when the user's
2Z balance is the only bound. `verifyPaidGrant` and `admitEstimate` in
`src/provider/free2z.ts` implement it:

| Grant / estimate state | Behavior |
|---|---|
| Session subject or grant `sub`/`client_id` differs, or `ai:invoke` missing (session or grant) | Refused (`account_changed`, `scope_denied` or `grant_verification_required`); no paid call |
| Grant older than 60 s, or the supplied proof is stale or for another session generation | Refused (`grant_verification_required`); re-read before retrying |
| `enforced: false`, reason `platform_disabled`, `ledger_cutover_pending`, `unknown` or absent | **AI not ready yet** (`ai_not_ready`): no paid call, calm local practice, no alert at connect. With or without a budget |
| `enforced: false`, reason `ledger_cap_pending` | `budget_pending`: same as above, with a grant-specific message |
| `enforcement_reason` contradicts `enforced` | Protocol error, refused (the SDK also fails `grant()` closed) |
| Enforced, `spend_cap_2z: N` with any period | Admitted if the estimate's `hold_2z × 1000 ≤ available_milli_2z` and `≤ cap_remaining_milli_2z`. A missing/`null` remainder is refused |
| Enforced, `spend_cap_2z: null` (no app budget) | Admitted if `hold_2z × 1000 ≤ available_milli_2z`. A `null` or absent remainder is fine; a numeric remainder (a budget added meanwhile) still binds |
| Estimate above balance | `insufficient_balance` before any journal operation: calm message, local practice |
| Estimate above remainder | `cap_exceeded` before any journal operation: calm message, local practice |
| Estimate without `available_milli_2z` | The authoritative `balance()` decides |
| Estimate or `/v1/chat` refused by Free2Z (402/403) | The same codes and messages; the gateway enforces regardless |

The check runs before the journal write and again at the send boundary (fresh grant,
fresh estimate, session fence). The journal wire format, settlement, same-key
recovery and "an unsettled receipt blocks new paid calls" are unchanged. The test-era
app-side 500 2Z tally of past charges is gone: settled history no longer limits new
calls. Operations written by the test-era build stay readable and recoverable with
their original key and body; a migration test covers v1 and v2 containers.

Settings show, read-only: the available balance, the app budget ("100 2Z per month",
"No app budget") with what is left when Free2Z has reported it, and the cost of the
last activity batch ("About N 2Z" from the settled charge, else "Up to N 2Z" from the
estimate's hold). "Manage allowance or balance" opens the fixed Free2Z account URL.
There is no in-app purchase.

Contract questions for the Free2Z team (current spec text leaves these open):

1. Does a grant with `spend_cap_2z: null` report `enforced: true` / `ok` once
   enforcement is active? AHA assumes yes; if no-budget grants stay `enforced: false`,
   those users never get paid AI.
2. `platform_disabled` is described as "has not activated grant enforcement". Does the
   gateway also refuse paid calls in that state, or would it accept and bill them
   unenforced? AHA sends none either way.
3. Is `cap_remaining_milli_2z` always present on `/v1/chat/estimate` (`null` when
   uncapped)? It is optional on decode. AHA refuses a budgeted grant without it and
   accepts an absent value for an unbudgeted one.
4. Is `available_milli_2z` always present on the estimate? AHA falls back to
   `balance()` when it is absent.
5. A non-strict estimate clamps `max_output_tokens` to what is affordable, so
   `hold_2z` always fits and a nearly exhausted budget yields a shortened, still-charged
   batch. Should apps compare the clamp, or adopt `max_output_tokens_strict` once the
   gateway accepts it?

Only currently advertised model IDs are selected. AI context contains bounded
candidate skills, recent answer evidence, and optional short fluency practice;
local code independently validates and grades the mathematical task. No model
response or fixture can award whole-standard mastery.

## Sign-in spend-cap hint

Sign-in passes `SIGN_IN_OPTIONS` (`src/provider/free2z.ts`): a suggested app budget
of `SUGGESTED_SPEND_CAP_2Z` = 100 whole 2Z per `month`. It is only a suggestion. The
user may edit or remove it on the consent screen, and the app works the same with any
budget or none. The hint grants nothing. Per the spec (deployed IdP behavior not yet
observed), Free2Z only lets it lower the pre-selection at the same period as a capped
registration default and a capped existing grant, and otherwise ignores it. A
sign-in without a consent screen ignores it. Paid admission reads the grant back
from `grant()` and never compares it with the hint. This pin also decodes the grant's
optional `enforcement_reason`; a reason that contradicts `enforced` makes `grant()`
fail closed (`invalid_response`).

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
`f2z-api` audience that `grant()` needs (zuu `spec/oidc.md` §6 `aud`, `spec/grant.md`).
Purchase and checkout commands were already outside the Tauri capability.

For the Free2Z team, there's nothing to fix server-side. Two notes: (1) a grant
made before this change may still carry `purchase:create` until the parent
signs in again or revokes it at free2z.cash/account/apps (the in-app Manage
button appears only while connected; the sign-out message names that URL). (2) If AHA's
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
one-line note, and records a diagnostic (`warn` for `browser_error`, which also covers a
browser that could not open, so it still reaches the console; `info` otherwise). Every other code is logged
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

## AI activity batches

Each paid call asks gpt-4o for a batch of four Activity Specs. The output is prompt-only JSON
with client validation, because the gateway has no `response_format` yet, and
`max_output_tokens_strict` is not sent. Estimated cost per call:

- Input: about 3.0–3.5k tokens. The system prompt is about 1.9k tokens and the learner summary
  plus standards window about 1.0–1.5k. The provider bounds the prompt at 20k characters.
- Output: about 0.9–2k tokens, capped at 2600. The four-fixture batch is about 0.9k tokens.
- Price: the whole-2Z minimum applies, so about 3 2Z per call, or roughly 0.75 2Z per
  activity. A reply that fails to parse is still charged.

So 100 2Z covers about 30 calls, or about 130 activities. The next
batch is prefetched only when one activity remains, and only one request is in flight at a time.
The fallback backoff and Retry-After gate prefetches as well. Restarts and recovered replies
reuse queued activities and never buy them again.

## Remaining live acceptance

1. Obtain the platform's paid-readiness and first-receipt checkpoint through the
   private coordination runbook; reconcile the shared test allowance before any
   AHA paid call. No AHA paid call or purchase has been made.
2. Verify native browser redirects, sign-in persistence, authoritative balance,
   fresh enforced grant and advertised models on each mobile platform.
3. Exercise live AI activity batches: measure parse/acceptance rate, real token use and 2Z per
   call, rendering of model-authored figures on phone and tablet, prefetch latency, and restart
   mid-queue. Confirm `finish_reason` values for cut-off batches match `length`.
4. Exercise a generated lesson, correct/incorrect answers, hint assistance,
   curiosity, receipt reconciliation, cancellation and restart within the
   remaining authorized allowance. Keep call/account evidence private.
5. Confirm both updated store builds are installed by existing authorized
   testers. Android audience selection is now verified; physical installation remains separate
   from source tests or signed uploads.

Canonical contracts: [integration guide](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/INTEGRATION.md),
[source preview](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/SOURCE-PREVIEW.md),
[current grant](https://github.com/free2z/zuu/blob/main/docs/free2z/sdk/spec/grant.md).
