# Free2Z integration evidence

Snapshot: 2026-09-28; SDK pin moved to `e95becd6`, then to `42acc57f` on 2026-10-04, then to `d63959f9` on 2026-10-05. Source integration, deployed services, and device acceptance are separate evidence.

| Surface | Evidence | Status |
|---|---|---|
| Native SDK and TypeScript facade | Unified public source `d63959f9c766258d7ce827e68f4ddd93d2797f99` (TS SDK, guest API and Rust plugin move together); exact revision-namespaced tarballs and lockfiles | Real source preview, not an invented registry release. Delivered store builds predate this pin (`534d2a58`) |
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

## SDK `d63959f9` adoption (2026-10-05)

zuu main at `d63959f9` (#1143 on top of `d4d58ea3`) is additive over `42acc57f`. Tarball recipe and sha256 values: [vendor/README.md](aha-app/vendor/README.md).
What AHA adopts:

- **Schema member order (#1143).** Before this pin, nothing in AHA's native dependency graph enabled serde_json
  `preserve_order` (this pin's `Cargo.lock` adds `indexmap` under `serde_json` for the first time). The Tauri IPC `Value`
  therefore sorted the `response_format` schema before the gateway saw it, which is why replies arrived with `activities`
  before `rationale`. `tauri-plugin-f2z` at `d63959f9` enables `preserve_order` itself, and the pinned `ChatRequest` holds the
  schema as `OrderedJson`. Two tests read the same fixture bytes:
  - `nativeBoundary.test.ts` checks the TS SDK hands the plugin the app's order (string equality; `rationale` first).
  - The Rust test `structured_batch_schema_member_order_survives_ipc_and_the_native_chat_request` checks the bytes survive
    IPC `Value` → `ChatRequest` → the body the SDK sends. It has a negative control that a sorted `Value` fails.
  End to end, this also needs the gateway image with #1143; not live-verified. The validator still reads by key, so either
  order is accepted.
  `preserve_order` applies to the whole AHA binary. Backup integrity (`storage.rs` `digest`) therefore now hashes the
  canonical member-sorted form, which is the bytes every earlier build hashes. Backups verify in both directions between
  this build and older ones (`backup_digest_is_canonical_whatever_the_json_member_order`). Same-key recovery is unaffected:
  an older journal entry was stored with its schema already sorted and is resent as stored. The gateway's idempotency
  fingerprint also hashes the schema sorted (#1143 golden digests).
- **Typed catalogue (#1137).** `models.ts` and `structuredCapability` read `model.capabilities.structured_output === true`
  from the SDK's typed `Model`. Limits and prices are `bigint`. The model-choice policy (#905) is unchanged. The SDK decodes an
  absent `capabilities` as `{}`, so the reason is logged as `structured_output_absent`; the `capabilities_absent` and
  `structured_output_not_boolean` reasons are gone. A non-boolean capability now fails the whole `models()` read
  (`invalid_response`) in the SDK. That means no catalogue, no estimate, no journal entry and no paid call (a test covers it);
  the batch falls back to local practice.
- **Preflight.** Every paid send (fresh, send boundary, same-key recovery) is admitted by `client.preflight(request)`, a strict
  estimate. `ready` hands the estimate to the unchanged local check (`admitEstimate`: hold within balance and budget remainder,
  full strict `max_output_tokens`). `needs_top_up` maps to `insufficient_balance`, `needs_budget` to `cap_exceeded`, and
  `too_large` (context window, or the strict output ceiling) to `too_large`. All three are zero-cost. Before a journal write
  nothing is journaled. At the send boundary, a fresh entry is released as `released`/0. Other errors are rethrown, so the
  format-refusal fallback and the uncertain cases are unchanged.
- **Refusal details (#1136).** The native transport now keeps the documented `details`, with amounts as `bigint`.
  `insufficient_balance` (402) shows "Not enough 2Z: top up in Free2Z." and, when Free2Z reports `required_2z` (or the local check
  knows the hold), "The next activities need N 2Z." `cap_exceeded` (403) shows "App budget reached: raise it in Free2Z." with a
  **Raise app budget in Free2Z** button that opens the fixed `free2z.cash/account/apps` URL (the existing native command). Both
  say the refusal cost nothing and continue with local practice. #882's invariants hold: only a fresh first send can release;
  refusals during same-key recovery stay uncertain (tests cover estimate and chat). A bare 402/403 with the refusal code (an older
  plugin) is still recognised. Known gap zuu#1145: `cap_exceeded` lacks `resets_at`/`cap_2z`/`cap_period`, so AHA reads none of
  them.
  Because `details` now arrive, the strict output-ceiling refusal (`invalid_request`, `reason: max_output_tokens_strict`) is
  `too_large`, not a format refusal. This closes the LOW left open in #886.
- **Sign-in codes (#1138).** `user_cancelled` (dismissed iOS sheet or Android Custom Tab) is quiet, logged as info.
  `browser_unavailable` shows "AHA could not open a browser for the Free2Z sign-in…" and `timeout` shows "…took too long…",
  both logged as errors. `browser_error` stays the quiet fallback, logged as a warning, for older plugins and unclassified failures.
- Not adopted: `ChatRequest` builders (Rust-side; AHA's journaled body is rebuilt by `chatRequest()` so same-key recovery stays
  byte-identical) and `formatMilli2z` (AHA's `format2z` trims trailing zeros for display).
- Verified with fakes only: unit tests through the real SDK (`NativeTransport` over plugin-shaped TEST bridges) and `test:ai`
  scenarios (402 with `required_2z`, 403 with the account link, `user_cancelled`, `browser_unavailable`). Not live-verified.

## Learner-chosen model (#899)

Free2Z's `/v1/models` is no longer a gpt-4o-only allowlist. AHA never hardcodes a model id; `src/provider/models.ts` (pure,
`models.test.ts`) reads the catalogue each batch:

- **Eligible:** `capabilities.structured_output === true` (typed by the SDK since `d4d58ea3`), a reported
  `max_output_tokens` ≥ 2600 and a reported `context_window` ≥ 16k.
- **Estimate:** Free2Z's client formula (metering.md §2.5) over a typical batch of 4000 input / 2000 output tokens (the top of
  the measured 3–4k / 0.6–2k ranges), `max(min_charge_2z, ceil(...))`. Shown in Settings as "≈ N 2Z per set".
- **Best (auto), the default:** the highest-priced eligible model (price as the quality proxy) whose estimate is ≤ 10 2Z. It
  steps down when the worst case (4000 input + the 2600 output budget) exceeds the fresh balance or the app budget remainder.
  If nothing fits, it sends the cheapest, which Free2Z refuses calmly at no cost. If every structured model is above the
  ceiling, it picks the cheapest of them. If no eligible model has structured output, the prompt-only request goes to the
  best-priced usable model, or the first one in catalogue order when none is priced (as before).
- **Manual:** Settings → "AI model" lists "Best (auto)" and every eligible model by `display_name`, including models above
  the ceiling. The choice is stored per account in the local journal (`aha-model-choice-v1`). A choice that leaves the
  catalogue or loses structured output falls back to auto for each request while it is missing (logged once as an `ai-model` warning); the stored choice is kept, so one degraded catalogue read never erases it.
- **Attribution:** the journal operation already records `request.model`, so same-key recovery resends to the same model
  whatever is chosen now (a test covers this). Replies carry it as `TutorReply.model`, and queued activities, activity records
  and `ai-spec` attempts store it (`spec.model`; older evidence without it still restores, with a migration test). The status
  sheet names the model that wrote the activity on screen.
- **Stats (local only, no PII):** Settings → "Something not working?" → "Model stats" shows one line per model: sets, activities
  kept vs rejected (schema, meaning shape or damaged JSON, vs semantic), unreadable replies, learner flags, average settled 2Z
  per set, and first-try correct rate. Sources are a bounded batch log (`aha-model-batches-v1`, 400 records, one per
  operation), the billing journal's settled charges, `ai-spec` evidence and disputes. The same lines go into "Report a
  problem".
- Verified with fakes only (unit tests and a `test:ai` scenario with three TEST models). Not checked against the live
  catalogue or prices.

## Structured output (#884)

SDK pin `42acc57f` (zuu #1129) adds opt-in `response_format`. When `/v1/models` reports
`capabilities.structured_output: true` for the chosen model, an activity batch is sent with
`response_format {type:'json_schema', json_schema:{name:'aha_activity_batch', schema, strict:true}}`.
The schema is `activityBatchStrictJsonSchema`, 28.6 KB (28,650 bytes) serialized against the gateway's 32 KiB
limit, and a test enforces that limit. The system prompt drops the inline grammar for a short list of rules
the schema cannot express (`STRUCTURED_OUTPUT_RULES`).

- **Fallback.** The request is prompt-only, exactly as before, when the flag is absent or false, when
  the request falls outside the gateway's limits, or after Free2Z refuses the format. Free2Z refuses
  with `400 invalid_request` and `details.reason` of `response_format_unsupported`, `unsupported`
  (field `response_format.type`) or `null` (field `response_format`), all before any hold.
  The native transport drops `details`, so a bare 400 `invalid_request` on a structured request also
  counts as a refusal. Every `invalid_request` is refused before any hold.
  - A refusal at the estimate is free and journals nothing.
  - A refusal of a fresh send settles that entry as `released`/0, like the strict refusal (#881).
    The prompt-only request then goes out as a new operation with a new key, because the gateway
    stores the refusal as the refused key's terminal answer.
  - The tutor instance stops trying the format for that model and logs a warning (`ai-structured`).
  - A refusal during same-key recovery stays uncertain, as in #881.
- **Journal v3.** A request records the exact `responseFormat` it was sent with. Same-key recovery
  rebuilds the identical body from the journal, whatever today's catalogue says. v1 and v2 journals
  stay readable (their requests never carry a format) and are stored as v3 on first write; an older
  app build then reads that journal as invalid and pauses paid AI, failing closed as the v1-to-v2
  change did. Archiving a settled entry drops its saved schema from both the live journal and the
  per-call archive record.
- **Validation stays mandatory.** Strict mode constrains shape only. keyCheck, figure references,
  TeX safety and the other semantic rules are still checked locally. The gateway forwards the
  schema's members sorted by name (until the `d63959f9` pin; see "SDK `d63959f9` adoption"), so replies arrived with keys in alphabetical order (`activities`
  before `rationale`) and with `null` for unused optional fields. The validator reads by key, treats
  `null` as absent, and a test covers that reply shape. Recovery of a cut-off reply does not depend on
  key order either (#888). It locates activities as elements of the `activities` array when they do
  not lead with `"version"`, and a reply cut off before its trailing `rationale` keeps its complete
  activities. A rationale that is present but invalid, or missing from a reply that was not cut off,
  still rejects the batch.
- **One source of truth (#890).** The wire schema is derived from the zod validator. Strict mode makes every key
  required, so an activity-level `keyCheck` could only be nullable everywhere, while the validator requires it for
  numeric, fraction and plot_point answers and forbids it elsewhere. The wire schema therefore carries `keyCheck`
  inside those three response variants, required and non-null, and leaves it out of the rest. Before validation,
  `normalizeActivity` drops null members and moves `response.keyCheck` back to the activity. A property test
  (`strictSchema.test.ts`, json-schema-faker, 400 batches / 1,217 activities) requires 99% of generated
  strict-schema instances to pass the validator's shape rules after normalization. The new schema passes 100%. The
  previous shape passed 35.2%, because generated instances could omit a required keyCheck or add a forbidden one.
  String lengths and the text rules (safe text, TeX, expressions) stay validator-only: strict mode cannot express
  them.
- **Prompt-only path (`npm run spec-eval`, Haiku, 45 batches, 180 activities, no Free2Z).** On identical Haiku
  replies, main's validator and the new one both accept 89.4%. Haiku did not produce the gpt-4o shapes this change
  now accepts: `round(x, d)` and a bare activity. Those shapes are covered by regression fixtures instead. With
  `round(x, decimals)` added to the shared grammar line, a fresh run gave 88.3% schema-valid, within the ±2-point
  noise, and keyCheck pass went from 98.9% to 100%.
- **Per-batch log.** Every batch logs one content-free `ai-structured` line, for example
  `batch send: structured=yes model=gpt-4o response_format.type=json_schema strict=true json_schema.name=aha_activity_batch transport=stream`,
  or `structured=no reason=<model_not_in_catalog|structured_output_absent|structured_output_false|refused_earlier_this_session|outside_limits|format_refused>`
  (the `capabilities_absent` and `structured_output_not_boolean` reasons went away with the typed catalogue in `d4d58ea3`).
  A prompt-only batch is a warning. The `ai-batch` line now starts with `structured:` or `prompt-only:` and is
  logged for every batch. Unknown fields are named (`unknown field(s) tolerance`), because zod's own wording
  (`key: "…"`) was redacted by the diagnostics scrubber.
- **Transport.** AHA batches use the streamed chat, the only chat the native plugin exposes (`start_chat` /
  `next_chat`). Free2Z forwards `response_format` on its single upstream path, which is always streamed. The
  non-streamed `ChatResponse` (which carries `cap_remaining_milli_2z`, zuu#1133) is not reachable from the
  webview without a plugin change.
- **Native boundary.** `nativeBoundary.test.ts` sends a batch through the real SDK `NativeTransport` to a
  plugin-shaped TEST bridge and checks the `start_chat` payload. It saves that payload as
  `src-tauri/fixtures/structured-batch-start-chat.json`. A native unit test reads the same bytes through the
  pinned Rust `ChatRequest` and `ResponseFormat::check`, and `response_format` survives with `strict: true`.
- **Live run of 2026-10-05 (S26).** Nine gpt-4o batches (13:13 to 13:23Z) were mostly rejected by the validator.
  The device journal and logcat show that the installed APK did not contain structured output. The APK had been
  built at 02:01Z, before #883 and #884, and it embeds bundle `index-CttBv_aH.js`. Its journal is version 2, and
  every call's system prompt is byte-identical to the #882 prompt. No call carried `response_format`, and no
  `ai-structured` fallback was logged. Gateway forwarding and AHA's capability detection were not at fault. That
  run is therefore not structured-output evidence; a rebuilt APK is still needed.
- **Input tokens (approximate, chars/4).** The structured system prompt is about 1.7k tokens instead
  of about 2.6k, which saves about 0.9k per batch. The schema, however, is input too: Free2Z reserves
  its 28 KB in the input hold, as it does for a tool definition, and the provider bills its own
  rendering of it. The net billed input change is therefore unknown until measured live, and may be an
  increase. The expected gain is the parse and acceptance rate, not cost.
- Tests use fakes only (`free2z.test.ts`, `aiActivities.test.ts`, `prompt.test.ts`, and the
  structured-output scenarios in `scripts/verify-ai.mjs`). This has not been verified against the
  deployed gateway, which rolls out 42acc57 around 02:30 to 02:40Z.

## Strict output budget (#881)

Every paid request (activity batches, tutor and curiosity replies, same-key recovery) sets
`max_output_tokens_strict: true` on both the estimate and `/v1/chat`, so a nearly exhausted
balance or budget gets a refusal instead of a silently shortened, truncated batch that is
still charged. **Relies on Free2Z gateway image `70b74edd9` (includes `da1862531`) or later**;
an older gateway rejects the unknown field. This is safe to ship before that image is live
because no paid call is sent until the grant reports `enforced: true`.

- A strict refusal (HTTP 402/403 with `details.reason`, or the gateway code `insufficient_balance`
  / `cap_exceeded`; before `d4d58ea3` the native transport dropped `details`) costs 0 2Z. AHA settles the journal entry
  as `released`/`0`, leaves no pending receipt, keeps later calls unblocked, shows a calm
  message and continues with local practice (`aiFallback.ts`). Other 402/403 errors stay
  uncertain, as before.
- Journal entries written before strict stay recoverable; same-key recovery now resends them
  strict.
- The test fixtures (`free2z.test.ts`, `scripts/verify-ai.mjs`) now require strict on every
  paid request. Still not live-verified against the deployed gateway.

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
| Estimate or `/v1/chat` refused by Free2Z (402/403) | The same codes and messages, with `required_2z` when reported; the gateway enforces regardless |
| Preflight `too_large` (context window or strict output ceiling) | `too_large` before any journal operation: calm message, local practice |
| Estimate returns fewer `max_output_tokens` than requested | Treated as a refusal (`not_enough_2z`); nothing is sent, even with strict |

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

Since `d4d58ea3` (zuu #1138, included in the `d63959f9` pin) the plugin distinguishes `user_cancelled`, `browser_unavailable` and `timeout`; see
"SDK `d63959f9` adoption". The text below describes the `browser_error` fallback, which older plugins send for all of them.

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

Each paid call asks the chosen model (see "Learner-chosen model") for a batch of four Activity Specs. It uses structured output when the
model advertises it, and prompt-only JSON otherwise (see "Structured output (#884)"). Either way the
client validates every activity and sends `max_output_tokens_strict`. The estimates below are for the
prompt-only request:

- Input: about 3.0–3.5k tokens. The system prompt is about 1.9k tokens and the learner summary
  plus standards window about 1.0–1.5k. The provider bounds the prompt at 20k characters.
- Output: about 0.9–2k tokens, capped at 2600. The four-fixture batch is about 0.9k tokens.
- Price: the whole-2Z minimum applies, so about 3 2Z per call, or roughly 0.75 2Z per
  activity. A reply that fails to parse is still charged.

So 100 2Z covers about 30 calls, or about 130 activities. The next
batch is prefetched only when one activity remains, and only one request is in flight at a time.
The fallback backoff and Retry-After gate prefetches as well. Restarts and recovered replies
reuse queued activities and never buy them again.

### Queue refill after an in-place upgrade (2026-10-05, S26)

The founder's S26 received main `f4964739` over a #882-era build that had queued a batch. Read-only
device state showed the new build never served a local task: its session still held the old
build's AI activity and three queued ones, and the journal was still v2. The local practice seen
that morning came from the old build: three `invalid_batch` prompt-only replies (13:14–13:19Z) put
it into the fallback backoff, which served two local tasks (each logged `ai-fallback`).
When the restored queue reached one activity on `f4964739`, the prefetch fired as designed: one
structured (`json_schema`, strict) call, settled at 4 2Z, kept 3 and rejected 1, and the journal
became v3. The changes that followed: a restored queue that is already low is refilled at launch;
a Continue with an empty queue waits at most 6 s for the batch on its way instead of until it
lands (about 29 s on device); every decision not to use AI while signed in logs `ai-skip`.

## Live activity-authoring eval (2026-10-05, `scripts/live-eval/`)

The first paid AHA calls. They ran through the AHA public client's loopback sign-in in a dev-only Node harness, not through the app. The founder signed in and consented in their own browser. The grant was enforced, with a 300 2Z `total` budget and scopes `openid offline_access balance:read ai:invoke`. **58 2Z** was spent, and the session was revoked at the end.

- **Catalogue.** `/v1/models` offered only `gpt-4o` and `gpt-4o-mini`, both with structured output. gpt-4.1, gpt-5.x and reasoning models were not offered.
- **Request.** Each call is v1 exactly as on main: `structuredSystem` with the strict `response_format`, 4 activities and 2600 strict output tokens. It was sent non-streamed, with a new Idempotency-Key per call.
- **Learners and scoring.** 10 synthetic grade 2–5 learner states, 6 of them on the founder's failure domains. 14 batches went to gpt-4o and 13 to gpt-4o-mini; one batch was lost to a `concurrency_limit` estimate refusal, which cost nothing. Accepted activities were judged on their rendered 384×832 focus-stage screenshot by `codex` gpt-6.1-sol with binary checks.
- **Calibration.** The judge flagged all 10 of the founder's live flags.

| Model | Accepted | Defects / 100 accepted: any · figure≠text · key wrong · off level | Good / 100 requested | 2Z / call | 2Z / good | p50 / p95 |
|---|---|---|---|---|---|---|
| gpt-4o | 91% | 67 · 57 · 20 · 35 | 30 | 3.2 | 2.65 | 8.8 / 12.9 s |
| gpt-4o-mini | 38% | 60 · 10 · 5 · 35 | 15 | 1.0 | 1.63 | 13.3 / 18.1 s |

What this shows:

- **gpt-4o stays the default.** It returns about twice the good activities per batch and is faster. gpt-4o-mini is cheaper per good activity, but its validator rejection rate (62%: duplicate slice labels and region ids, words in TeX, unshown figures) halves what each wait delivers.
- **Most of gpt-4o's defects are rendered contradictions.** Examples: "5 plates of 4 candies" over one plate of 4, and "4 rows of 3 fish" drawn as one `picture` group of 12 that the renderer wraps 4 across. Neither can be caught by v1 validation, which is the Activity Spec v2 rationale.
- **Billing.** Real input was about 7.3k tokens per batch (later calls hit the provider's prompt cache). Calls settled at 3–4 2Z, but the strict estimate's `input_tokens` with its safety factor was about 46k, so each gpt-4o hold was about 18 2Z.
- **v2.** No v2 arm ran: the v2 prompt (README §15 step 7) does not exist yet.

Re-run: `npm run live-eval -- --cap <2Z>`, then `npm run live-eval:score -- --run <name> --flags <flags.json>`. Outputs and the receipt ledger stay in gitignored `.live-eval/`.

## Remaining live acceptance

1. Obtain the platform's paid-readiness and first-receipt checkpoint through the
   private coordination runbook; reconcile the shared test allowance before any
   AHA paid call. The first paid calls were the dev-only live eval above (58 2Z); no in-app paid call or purchase yet.
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
