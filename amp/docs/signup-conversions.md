# Verified signup conversions

A signup conversion means a new parent account with a verified email address and eligible original ad-click evidence. A returning sign-in, button click, trial answer or invoice request is not a signup conversion. Purchases have separate workers and revenue records.

Google uses the Google signup worker. Meta and OpenAI use `src/advertising/provider-signups.ts`, called by their existing measurement workers. Set `signupEnabled: true` in the provider’s external measurement configuration to enable collection and delivery. Both the provider’s `enabled` setting and `signupEnabled` must be true. The default is disabled. `report` includes signup counts separately from purchases.

Meta receives `CompleteRegistration`, the original click/browser identifiers, an opaque event ID, timestamp, fixed signup URL and actual signup browser user agent. OpenAI receives `registration_completed` with the original `oppref`, opaque event ID, timestamp, fixed signup URL and `customer_action` data. OpenAI events set `opt_out: true`. Neither receives an email, account ID, learner data or revenue value.

The server captures Meta browser context during successful signup, when real Meta click evidence is attached. Missing browser context makes an event ineligible. Context expires after seven days. Both providers require signup events within seven days and click evidence preceding verification by no more than 30 days. Workers recheck account verification, email identity, evidence ownership, expiry and provider withdrawal under a dedicated sharing lock before sending. Ordinary account reads and learning operations do not acquire this sharing lock. Withdrawal acquires it exclusively, so a completed withdrawal cannot be followed by an older in-flight export. No provider request runs in the signup or practice request path.

The outbox allows one event per account and provider. Concurrent workers claim a lease; uncertain delivery retries the same event ID and content. A destination change stops pending delivery for review. Provider acceptance means receipt, not confirmed matching or attribution. Inspect rejected, exhausted and stopped rows before diagnosing missing conversions. Repeated logins do not create another event.

Deleting click evidence cascades to its signup context and delivery record. Account deletion also cascades; parent data exports include local signup context and delivery status. The retention worker removes expired browser context and signup intents, and delivery rows older than 90 days. It runs independently of optional email delivery.

Validate OpenAI payloads with `validate_only` before enabling a destination. Meta’s `test_event_code` is not an isolated sink: test events can be used for advertising measurement. Do not manufacture a production signup to test the integration. Use intercepted transport tests and inspect the receipt for the first eligible real signup. Configure campaign conversion goals separately; changing an event export does not change campaign bidding or budgets.

Provider references: [OpenAI supported events](https://developers.openai.com/ads/supported-events), [OpenAI Conversions API](https://developers.openai.com/ads/conversions-api), [Meta customer information](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters/), and [Meta test events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api#testEvents).

## GA4 signup key event

The web signup context uses the existing Google tag's client and session IDs
only when its analytics cookie exists and browser privacy settings allow it.
Signup never waits for the tag. A blocked tag, internal visit, automation, or
missing context produces no GA4 signup export. The signup intent passes that
context to the server; email and account identifiers never enter GA4.

`npm run analytics:signup -- deliver` sends `sign_up` through Measurement
Protocol after the server observes a new, verified parent account. Returning
logins and repeated callbacks cannot enqueue another event. Run this command in
a background worker with `AMP_DATABASE_URL` and `AMP_GA_SIGNUP_CONFIG` pointing
to a private JSON file containing `enabled`, the public `measurementId`, and
an `apiSecret` from that web stream. Configure `sign_up` as a GA4 key event;
do not import it as another primary Google Ads conversion alongside the
existing verified-signup action.

Exports require verification and delivery within 24 hours of the signup
context. Google applies the consent state from the matching web interaction;
ad user data and personalization are explicitly denied. Learning screens and
learning activity remain outside GA4. DNT/GPC and Google-sharing withdrawal
prevent export. Browser identifiers are cleared after dispatch or expiry;
account export/deletion includes the remaining receipt, which expires after
90 days.

`npm run analytics:signup -- report` returns receipt counts. `accepted` means
HTTP acceptance, not proven appearance or attribution in GA4. A timeout or
worker crash becomes `uncertain` and requires reconciliation; automatically
retrying could double-count a key event. Validate payload changes with Google's
Measurement Protocol debug endpoint, which does not ingest test events, and
confirm reporting against a subsequent real signup.

First-party `auth_request` events identify configuration, preparation, provider
handoff, password, passkey, and session failures. The `screen` stage records
visible auth controls after rendering; a route arrival alone does not establish
that the form appeared. A completed handoff request does not establish a
completed login. If the browser stays on AMP or restores a pending form, AMP
checks the session and either continues or releases the controls with a retry
message. These events use the existing asynchronous first-party batch. Runtime diagnostics contain fixed
error categories and app bundle coordinates, never error messages, stacks,
form values, or private URLs. Passkey failures also record the delay before the
prompt and whether browser user activation was available; a `NotAllowedError`
does not establish that the person deliberately cancelled.

React errors and unhandled promise rejections retain the first same-origin
hashed JavaScript bundle location found within a bounded stack scan. Only the
public asset basename, line and column leave the browser. React's numeric
production error code is retained when present. Render events distinguish
caught and uncaught errors; a caught error does not prove the visitor recovered.
