# Meta purchase measurement

`src/advertising/meta-conversions.ts` is an internal Conversions API transport for a verified adult purchase. It has no delivery worker, scheduler or credential-file loader. Nothing invokes this transport from the running application. A separate authenticated route collects local confirmation context as described below; it does not upload events. The default operation is a local preview, and delivery is disabled unless the destination explicitly sets `enabled: true`.

## Payload and permission

A request contains one `Purchase` event, its actual time, a random `amp_meta_` reference, USD amount and the confirmed adult purchaser's SHA-256 email hash. Email normalization trims the ends and lowercases; it preserves dots and plus tags. Google-specific Gmail normalization is not interchangeable.

The caller must supply evidence of current adult permission naming Meta and the purpose `measurement-and-ad-delivery`. The transport requires the `meta-adult-purchase-v1` version shared with AMP’s separate Meta notice in Family → Privacy and records → Purchase measurement. The parent must explicitly attest to being at least 18 and using their own confirmed email. Google permission does not authorize Meta sharing; neither choice grants learning consent.

Each provider’s preference lasts one year and can be withdrawn independently. An email change or notice revision requires a fresh explicit grant. Learning-consent withdrawal, learning-data deletion, and an authenticated request carrying Global Privacy Control or Do Not Track withdraw both preferences. Withdrawal removes the local email binding; the remaining preference is retained for up to 90 days after withdrawal or expiry. The family export includes the preference without its email binding.

The permission API is `/api/v1/family/meta-purchase-measurement`; it accepts only the authenticated account’s strict, versioned allow/withdraw request. It does not upload purchase events. A current preference is a prerequisite for a future dispatcher, not evidence of payment or delivery. Do not promise attribution-only handling: Meta documents measurement, custom audience and optimization capabilities for all action sources.

A website event requires the purchaser's actual browser user agent and an allowed adult purchase-page URL. No query, fragment, account or learner identifier is accepted. The fixed URL allowlist is a privacy boundary, not proof that a conversion happened there. Do not substitute an AMP landing page for a hosted checkout URL. Transactions whose actual page is not supported are ineligible until their truthful representation is established.

Non-website sources accept `email`, `phone_call`, `chat` or `other` without browser fields. Selection must come from verified purchase-channel evidence. A ClassWallet settlement webhook alone does not establish the channel where the customer converted. Do not invent a user agent, relabel a website sale, use `physical_store` to gain a longer upload window, or treat an initial payment as an automatic subscription renewal.

Learner names, ages, grades, answers, lessons, progress, assessment results, account identifiers, IP addresses, cookies and click IDs are excluded. A user agent is permitted only for an eligible adult website purchase. Hashes and browser context remain personal data. Never log the builder's payload.

## Verified enrollment confirmation context

On the adult `/start/purchase` screen, a confirmed `paid` phase, matching Stripe return reference and current Meta permission allow one local request to `POST /api/v1/advertising/meta/purchase-context`. Its body contains only the checkout reference. No Meta SDK is loaded, and no request goes to Meta. Processing, cancellation, learning screens, native clients and privacy signals do not trigger collection. The small first-party request uses browser keepalive so continuing to learner setup does not cancel it. Its original account token is fixed, and obsolete responses never update account or learner state.

The server requires an authenticated owner, the actual matching confirmation referrer and a bounded browser user agent. It resolves the live initial-payment record itself and checks payment verification, financial holds, refunds, current confirmed email and Meta permission granted before payment under the shared account privacy lock. A browser return, client-side paid flag or referrer alone cannot establish a purchase. Renewals, test payments, other owners and existing-learner checkouts are excluded. The latter return to a different page and need their own truthful adult confirmation flow.

Only the fixed `https://amp.corpora.inc/start/purchase` address is retained: queries, fragments, IP addresses and click identifiers are excluded. The first captured context is immutable across reloads. Withdrawal deletes it; the privacy worker removes it no later than seven days after payment or earlier permission expiry. Family export includes the retained address and user agent without internal financial or account references. The browser request is evidence of its reported context, not independent proof of browser identity.

Meta's [official archived online CAPI example](https://github.com/fbsamples/lead-ads-webhook-sample/blob/main/postman/FB%20Conversions%20API%20%28Part%201%20-%20online%29.postman_collection.json) uses a purchase thank-you page as `event_source_url`. The AMP integration records the confirmation page actually visited. It does not label invoice preparation or a ClassWallet settlement webhook as a website conversion.

A dispatcher must re-read current permission, confirmed email, financial evidence and context expiry before submission. The context row is not authorization to bypass those checks and is not a delivered event.

## Preview, test and live requests

Construct `MetaConversions` with a numeric dataset ID, an access-token callback and optional fetch/clock dependencies for tests. The token belongs in approved secret storage. The application has no production token configuration for this transport.

- `purchase(input)` validates locally and returns a redacted preview. It does not obtain credentials or send a request.
- `purchase(input, { kind: "test", testEventCode: "TEST123" })` sends to Meta's Test Events feature only when delivery is enabled. **Meta states that these events are not dropped and can be used for targeting and measurement.** This mode is not a privacy-safe dry run.
- `purchase(input, { kind: "live" })` sends without a test code only when delivery is enabled.

Only the fixed `https://graph.facebook.com/v26.0/{dataset}/events` endpoint is used. The token is sent in the Authorization header; it is absent from URLs and payloads. Redirects are refused. Credential retrieval and the complete HTTP response each have a ten-second bound. Responses are limited to 64 KiB. Raw provider messages are discarded; receipts retain a message count and a bounded trace identifier.

Events must be no more than seven days old, cannot be future-dated, and must follow the permission grant. The transmitted integer-second timestamp is checked too. Expiry and event age are checked again after credentials arrive. Caller mutation cannot change the validated payload during that wait.

## Delivery and refunds

A successful receipt means the API reported receiving one event. It does not prove matching, attribution, optimization eligibility or net revenue. Inspect Events Manager's received, matched, attributed and diagnostic views separately. A receipt with messages needs review; the count is not certification that the event is usable.

The transport never retries. Network failures, timeouts, unexpected responses, rate-limit responses and server failures have an `unknown` outcome; ordinary definite client rejection has a `rejected` outcome. A durable dispatcher must record intent before I/O, serialize a payment's submissions and preserve uncertain results. Never create a new event reference merely to retry. Provider deduplication is not a permanent exactly-once guarantee.

Zero or negative purchases are rejected. There is no refund or restatement method. Sending a negative `Purchase`, changing its reference, or sending a custom refund event is not evidence that Meta reversed the original purchase attribution. Use verified first-party settlement/refund reporting for net cash, and make the distinction explicit in campaign reporting. Block unsent fully refunded payments; reconcile later refunds locally.

## Integration required before activation

The transport must be connected to trusted initial-payment/Arkansas-settlement selection, current Meta-specific adult permission, verified channel context, a durable queue, retention/export handling and a bounded operator schedule. Current permission, confirmed email and payment/refund holds must be checked immediately before sending under the shared account privacy lock. Test permission withdrawal and email changes racing delivery, crash uncertainty, duplicate workers and refund transitions against the database.

Verify the actual authorized app/token/dataset, disclosure and platform terms, event permissions and diagnostic results before activation. A test code does not replace those prerequisites. No campaign-spending authorization follows from an export configuration.

## Sources and verification

The contract was checked against Meta's current documentation on 2026-10-22:

- [Server event parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event): actual event time, seven-day limit and truthful action source.
- [Customer information parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters): email normalization and required website user agent.
- [Using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api): request endpoint, Test Events behavior and received/matched/attributed verification.
- [Meta's EventResponse implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/event-response.js): response fields.

`tests/meta-conversions.test.ts` exercises synthetic payloads and mocked HTTP only. It verifies the published email-hash vector, field exclusion, source context, permission/time boundaries, no-I/O preview, disabled delivery, token handling, response uncertainty and timeouts. It does not establish live Meta acceptance.

`tests/meta-context.integration.ts` uses real PostgreSQL and authenticated routes to test evidence selection, ownership, permission boundaries, browser-field exclusion, withdrawal races, expiry and export. The onboarding browser verifier checks a matching return stays unrecorded while processing and records context only after its synthetic billing API reports payment confirmed; it does not perform a real Stripe payment.
