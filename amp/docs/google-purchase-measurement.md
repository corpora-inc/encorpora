# Google purchase measurement

AMP's operator-only Google measurement worker collects verified payments, prepares durable attempts, sends permitted adult purchase information and checks asynchronous processing. It defaults off. It has no browser upload endpoint, pixel, automatic scheduler or connection to learner analytics. Deploying the code does not enable exports or advertising spend. Meta delivery is separate.

## Prerequisites

Choose the matching method explicitly. `matchingMode: "click_only"` uses the original Google click identifier linked to the verified purchase and omits `userData` entirely. It sends no email hash to Google. The local permission check still verifies the confirmed adult email against its retained permission binding. Google's [offline-event identifier requirements](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events#identifier-requirements) permit `adIdentifiers` without customer-provided matching data. Missing eligible click evidence returns `missing_click`, without a network event or an email fallback.

`matchingMode: "enhanced_email"` includes the confirmed adult email hash and any eligible original Google click identifier. Omission of `matchingMode` preserves this legacy behavior. Before using enhanced email matching, establish eligibility under [Google's customer data policies](https://support.google.com/google-ads/answer/7475709?hl=en), including restrictions concerning children and child-directed collection surfaces. Adult attestation, permission and hashing alone do not establish that eligibility.

Both modes remain disabled until the actual source, collection surface, applicable policies, authorization and live destination have been verified. Click-only matching is not blanket policy approval and does not bypass AMP's adult permission, withdrawal or verified-payment checks. Keep the assessment private. Validation requests also disclose identifiers; local tests cannot establish platform eligibility or live attribution.

Use a Data Manager API-enabled Google Cloud project and a separate OAuth grant with the `https://www.googleapis.com/auth/datamanager` scope. The advertising workbench's `auth-google.py --measurement` requests both Ads and Data Manager access without overwriting YouTube credentials. The worker accepts its private credential file, refreshes against Google's fixed OAuth endpoint and caches access tokens only in memory.

Verify the conversion-owner account, its `UPLOAD_CLICKS` action, applicable account requirements and, for enhanced email matching, customer-data terms and enhanced-conversion settings. OAuth alone does not establish those facts. The worker does not accept terms, create actions, activate campaigns or verify product eligibility for funding. See [Google's access restriction](https://developers.google.com/google-ads/api/docs/conversions/upload-offline) and [offline conversion setup](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events).

Before enabling delivery, verify the deployed adult preference, live purchase/refund flow, source namespaces, destination and retained receipts. Local tests use synthetic accounts and mocked provider responses; they do not establish live API acceptance or attribution.

## Adult permission and payment evidence

Family → Privacy → Purchase measurement is optional and defaults off. It requires a confirmed AMP adult email, own-email attestation and explicit permission for the current notice. It expires after one year. External identities without a confirmed AMP account record cannot authorize sharing. Price, buying and learning access do not depend on this choice. GPC/DNT, learning-consent withdrawal, learning-data deletion and expiry of current consent evidence revoke permission. Withdrawal stops future event sharing; it cannot recall data already received by Google.

The current permission must predate the payment and match the queued revision, notice, dates and confirmed address at delivery. Email or notice changes require a fresh grant. A regrant cannot revive a cancelled preparation or authorize older payments. The response preserves the legacy `noticeVersion` field for shipped clients; `currentNoticeVersion` carries the actual server notice. Stale forms cannot grant a newer notice or undo withdrawal.

Eligible Stripe payments are verified live initial subscription invoices with matching merchant, checkout and account bindings, complete latest evidence and no reconciliation hold. Renewals, test payments and zero-net unsent purchases are excluded. Successful refunds reduce value; pending refunds block delivery. Arkansas EFA and Arizona ESA payments require a linked funding request whose retained offer identifies the matching state, program and configured payment namespace, plus an accepted settlement event. Approval, invoice preparation, license access and unlinked imports do not establish settlement.

## Data and retention

An event includes only a random purchase reference, payment timestamp, USD amount/currency, normalized confirmed-adult email hash, any eligible saved Google click identifiers and consent settings. The current v3 permission covers those identifiers; older grants cannot authorize this payload. Ad personalization is denied. Learner identity, age, grade, answers, lessons, progress, device, IP address, and page URL are excluded. Actual `gclid`, `gbraid` and `wbraid` values are sent unchanged, resolved through the owned paid order rather than browser-supplied purchase fields. Funded settlements use `OTHER` as the event source. Hashing does not anonymize an email. Follow [Google's normalization rules](https://developers.google.com/data-manager/api/devguides/concepts/formatting); never log event payloads or email hashes.

The queue assigns one immutable reference per payment and conversion action. A manager access-path change cannot allocate a duplicate or silently reroute an existing record. The queue and attempts store no emails or email hashes. Attempts retain only delivery identity, value, outcome, receipt and safe processing diagnostics. Family exports include preparation and delivery information, excluding internal routing, source, request and export identifiers. Other financial datasets retain their own export rules.

Purchase-measurement records and their dependent attempts expire 90 days after payment. The closed selection window prevents recreation after deletion. Permission records have their separately disclosed retention period. Run the privacy-retention worker regularly. Google handles received data under its own policy.

## Delivery and refunds

The worker saves an `unknown` attempt before external I/O, commits it, then reacquires the account privacy lock and rederives payment and permission. Changed evidence produces `not_sent`. It holds the account lock and confirmed-email row lock during the bounded send. Financial and permission writers coordinate through that lock. Credential retrieval happens before locking and has a ten-second bound; HTTP calls also have a ten-second bound.

If the process or connection fails after the durable intent, the outcome stays uncertain even when the request may not have reached Google. Unknown or rejected attempts block automatic resubmission. Preserve them for private operator investigation; do not delete records, substitute another transaction ID or call the transport directly to retry. A database transaction cannot guarantee an atomic commit with an external service.

`accepted` means Google returned a receipt. Diagnostics begin after 30 minutes, back off by 1.3 with small jitter to a 60-minute maximum, and stop after 24 hours. Missing, mismatched or malformed diagnostics cannot establish success. Warnings, partial success and failed processing require investigation. `success` means clean processing, not an attributed sale, causal lift or reconciled net revenue. A diagnostic lookup sends the retained request reference, not another email/event; it can complete after withdrawal. See [Google diagnostics](https://developers.google.com/data-manager/api/devguides/diagnostics).

A refund correction requires a retained cleanly processed purchase, the same reference/destination and still-current original permission and eligible identifiers for the configured matching mode. Partial refunds restate the verified net value. Full refunds restate zero; this does not retract the conversion count. An unknown transaction ID can create a new conversion, so corrections cannot bypass the receipt checks. Withdrawal, changed identity, held evidence or expired records block corrections; the batch reports `correction_blocked`. Investigate these before interpreting platform values as net revenue. See [conversion adjustments](https://developers.google.com/data-manager/api/devguides/events/google-ads/conversion-adjustments).

## Operator commands

Store a reviewed configuration outside Git with mode `0600`. Replace these synthetic values with the verified action and financial namespaces; omit an unavailable source. Enable only after the prerequisites above are verified.

```json
{
  "enabled": false,
  "matchingMode": "click_only",
  "destination": {
    "conversionCustomerId": "1234567890",
    "conversionActionId": "123"
  },
  "sources": {
    "stripeNamespace": "acct_example:live",
    "efaChannelReference": "example-arkansas-namespace",
    "azEsaChannelReference": "example-arizona-namespace"
  }
}
```

`efaChannelReference` selects Arkansas EFA settlements; `azEsaChannelReference` selects Arizona ESA settlements. Each requires a linked request whose program, jurisdiction and payment channel match. An Arizona payment cannot qualify through the Arkansas setting, even if both programs use the same payment provider. Deploy migration 0041 before running the Arizona collector. Meta’s Arizona exporter uses the same verified payment source and requires migration 0043.

Set `AMP_DATABASE_URL`, `AMP_GOOGLE_MEASUREMENT_CONFIG` (configuration path) and, for delivery/diagnostics, `AMP_GOOGLE_MEASUREMENT_CREDENTIALS` (the separate OAuth credential path). Files must be private regular files; symlinks, broad permissions and oversized files are rejected. Do not put credentials in command arguments or public logs.

From `amp/`:

```sh
npm run advertising:google -- report
npm run advertising:google -- collect 20
npm run advertising:google -- deliver 20
npm run advertising:google -- diagnostics 20
```

Each invocation is bounded to 1–200 items per source or delivery page. Durable private cursors advance only after processing a page and restart after the last page, so later sweeps find inserts behind an earlier cursor. Concurrent collectors cannot move a cursor backward. Repeat collection and delivery regularly; diagnostics enforce their own due times. The commands print only aggregate outcomes. `report` is read-only and works while disabled; other commands do nothing while disabled. It reports attempt counts, not unique purchases or attributed revenue.

The low-level `GoogleDataManager.purchase` and `restate` methods default to validation. Validation still sends personal data and requires the same privacy checks as ingestion. The production worker uses trusted database references and ingestion only; it never accepts an event file or caller-supplied email/value. Do not use a direct transport invocation as a substitute for the dispatcher.

Changing matching mode does not change the purchase transaction identity. A processed
purchase with the same verified value is not sent again merely to add or remove
matching data. A correction still requires a clean original receipt; if click-only
evidence has expired or been erased, it returns `correction_blocked`. Batch outcome
counts expose `missing_click` separately from other ineligible payments. These are
processing counts, not unique purchases or proof that Google attributed an ad.
