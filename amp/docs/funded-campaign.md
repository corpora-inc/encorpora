# Funded purchase campaign totals

The funding-request API accepts optional `campaignAttribution` with three required fixed labels: a campaign from `CAMPAIGN_NAMES`, a source from `CAMPAIGN_SOURCES`, and a medium from `CAMPAIGN_MEDIA`. An optional `creative` identifies an authored ad from `CAMPAIGN_CREATIVES`. An enabled Arkansas offer (`ar-efa`, `AR`) accepts `ar-efa-launch`; an enabled Arizona offer (`az-esa`, `AZ`) accepts `az-esa-launch`. The API and database reject mismatched program/campaign combinations. Arbitrary text, click identifiers, names, email addresses and learning data are rejected.

Labels are supplied by the caller, not independently verified by an ad platform. They support first-party campaign reporting; they do not prove that an ad caused a purchase. This API does not install tracking pixels, export conversions, or join the anonymous assessment to a parent account. The Arkansas and Arizona browser purchase flows supply matching permitted labels when preparing a purchase request. Existing requests are not backfilled.

The original request keeps its labels across retries. Retrying an unattributed request cannot attach a later campaign. The HTTP endpoint ignores new attribution when the request carries `Sec-GPC: 1` or `DNT: 1`; purchasing continues normally. Privacy preferences must also suppress forwarding in any calling interface.

`npm run report:campaign -- 30` includes `fundedCampaign` alongside the distinct operational `arkansasOrders` and `arizonaOrders` and public page/link activity. Apply the migrations shipped with the API using `npm run db:migrate` before serving requests.

| Action | Evidence | Date |
| --- | --- | --- |
| `request_prepared` | A new authenticated, consent-authorized funding request with campaign labels | Request creation |
| `order_created` | Verified operator provisioning links an ESA order to that request | Order creation event |
| `order_settled` | The commerce ledger accepts positive settled payment | Settlement event |
| `refund_completed` | The ledger accepts a completed positive refund | Refund event |

Dates use UTC. Each action counts at most once per request, in the transaction that accepts its evidence. Replayed imports and concurrent retries cannot add a second count. Credit-approved learning access can precede settlement; neither approval nor activation counts as payment. Parent-reported submission and refund requests do not count as settled or refunded money. Counts from different date windows are not a same-cohort conversion rate. These are order counts. Payment amounts are reported separately in `arkansasCash` and `arizonaCash`.

Daily aggregate rows contain only date, campaign, source, medium, action and count. Labels and deduplication markers reside on the existing funding request, separate from learning records. Unconverted requests expire under the funding-request retention rule; linked requests follow the financial-record retention period. Aggregate historical preparation totals survive deletion of an expired request. The parent’s private family export includes retained campaign labels. It does not expose the internal deduplication markers.

`amp_campaign_creative_daily` provides an optional creative breakdown of the landing activity and funded-purchase counters. Its rows contain only date, campaign, source, medium, creative, action and count. These are subsets of the existing coarse totals, not extra conversions. The same financial transaction and deduplication marker protect both counts. An absent or unknown creative is omitted rather than inferred; existing records are not backfilled. First-party labels do not establish a causal effect or independently verify the originating ad.

The Arkansas landing script and parent purchase routes preserve only allowlisted `utm_content` values. Invalid content is discarded while valid campaign/source/medium labels can continue. GPC/DNT suppress forwarding and collection; the campaign endpoint also honors those request headers. Creative labels are not added to learner profiles, anonymous assessment records or learning events. `report:campaign` emits this breakdown separately from coarse totals and platform-attributed reporting.

Apply migration `0028-creative-campaign.sql` before serving the supporting API. Deploy compatible API instances before forwarding creative labels from the public site or creating attributed funded requests: older strict schemas reject the additional field. Enable live offers and campaign traffic only after deployment and an end-to-end check. The additive table preserves the existing coarse counter tables and their keys.

Verification uses the dedicated database funding-purchase integration suite: concurrent creation/imports, delayed settlement, refund replay, unchanged attribution on retry, expiry, program mismatch, invalid labels and privacy headers. No test contacts a payment or ad platform.

## Live-map and premium-price creative labels

Each authored variant has a fixed `utm_content` label. Shared creative can be used
in either state campaign; campaign and program labels must match the destination.

| Creative label | Edition |
| --- | --- |
| `shared-map-cedar-wide-v2` | General live-map video, Cedar voice, widescreen |
| `shared-map-marin-vertical-v2` | General live-map video, Marin voice, vertical |
| `ar-map-cedar-vertical-v2` | Arkansas live-map video, Cedar voice, vertical |
| `ar-map-cedar-wide-v2` | Arkansas live-map video, Cedar voice, widescreen |
| `az-map-marin-vertical-v2` | Arizona live-map video, Marin voice, vertical |
| `az-map-marin-wide-v2` | Arizona live-map video, Marin voice, widescreen |
| `shared-premium-feed-v1` | General premium-price feed image |
| `ar-premium-feed-v1` | Arkansas premium-price feed image |
| `az-premium-feed-v1` | Arizona premium-price feed image |

Migration `0047-live-map-creative-labels.sql` extends the database constraint
without removing historical labels. Deploy that migration and compatible API
and browser builds, including the marketing-site clients, before forwarding
these labels or installing their ads.
An older strict API rejects an unknown creative; an older browser can discard it.
Registering a label does not enable an offer, publish an ad or export a conversion.
Keep exact asset hashes and platform IDs in the private campaign registry, and
assign a new creative label when a materially different asset replaces a variant.

## Parent entry and consent continuation

Each entry link opens only the selected program's offers and requests:

| Entry path | Program | Jurisdiction |
| --- | --- | --- |
| `/purchase/arkansas-efa` | `ar-efa` | `AR` |
| `/purchase/new-hampshire-efa` | `nh-efa` | `NH` |
| `/purchase/arizona-esa` | `az-esa` | `AZ` |

These links open the authenticated invoice or quote form. They do not send an email request, collect payment or grant access. The server verifies offer availability, consent and learner ownership. An unavailable offer is explained before a new parent is asked for learner details, with a link to that program's purchase help. An existing family can view retained requests even when no new offer is available.

The Arkansas site's free-practice link carries `program=ar-efa`, a functional purchase preference. It survives trial navigation without requiring campaign measurement. The plan page offers **Use Arkansas EFA funds** independently of card checkout availability. Sign-in, email verification and learner setup return to the funded route. Consent must be active before learner setup; this route does not turn on an unavailable consent method or waive its required confirmations.

The router retains only complete, allowlisted campaign labels. GPC and DNT remove them during navigation and immediately before request creation. Authentication callback URLs include only a fixed internal destination and permitted labels. No learner, visitor or click identifier is forwarded.

When consent starts, a pending funded-purchase continuation is stored in this browser for up to seven days, under the authenticated parent account. It contains the allowlisted program destination, permitted campaign labels and an expiration time, never a consent token or learner details. Consent emails opened in another tab on the same device can return that account to the purchase. Another account cannot use the entry; an expired entry is removed when read. Opting out removes retained labels without removing the purchase route. Preparing the quote or leaving the funded consent flow clears the entry. With blocked storage or a different device, use the original tab or reopen the selected program purchase link; campaign attribution may be absent.

Public invoice buttons should link to the corresponding app entry after the live offer and consent configuration pass a complete purchase check. A route's existence does not establish live offer readiness. Program selection survives signup, email verification, consent and learner setup; it does not require a card purchase.

`npm run test:funded-entry-ui` exercises signup, email verification, consent continuation in a separate tab, learner setup, quote retries, privacy signals, unavailable offers and mobile layouts against synthetic services. Funding API database tests verify the actual authorization and financial counters separately.

## Payment amounts

`report:campaign` includes separate `arkansasCash` and `arizonaCash` arrays: daily gross settled payments, completed refunds and their difference, drawn from accepted commerce events linked to retained requests for the corresponding funding program. This read-only report requires no additional migration. It includes payments for requests created before the selected window. Dates follow the evidence in UTC, not import time; today is included and future days are excluded. Replaying an accepted import does not add another payment. Approval, license activation, parent submission and pending refund requests contribute no cash.

Each row contains `day`, `currency`, optional fixed `campaign`, `source`, `medium` and `creative` labels, and `grossMinor`, `refundedMinor` and `netMinor`. Amounts are exact integer strings in the currency's minor unit (USD cents); use decimal or integer arithmetic when consuming them. Sum rows only within the same currency. Null campaign labels identify unattributed payments. Missing creative labels stay null. Invalid stored attribution is treated as unattributed and cannot emit arbitrary text.

These rows partition the included cash movements; the creative rows are not extra payments to add to a separate campaign total. Refunds can make a reporting period negative when settlement occurred earlier. The report excludes unlinked payments and other programs, fees and ad spend. Net cash is neither profit nor recognized revenue, and this report alone cannot establish return on ad spend or reconcile the merchant's bank account. It emits no account, learner, order, invoice or provider identifiers and sends nothing to an ad platform.

## Acquisition deployment boundary

The capture endpoint accepts an optional `sourcePath` from exactly `/amp/`, `/esa/arkansas-efa/` and `/esa/arizona-esa/`. It stores only the corresponding canonical Corpora URL, never query strings or arbitrary destinations. Requests from an older client without this field retain the legacy Arkansas source URL; historical rows are not rewritten or treated as proof of a different landing page.

Deploy the API and migration before publishing a client that sends `sourcePath` or Arizona labels. The older strict API rejects these fields. Accepting Arizona labels does not establish an enabled Arizona offer, a complete browser purchase route or Google/Meta delivery support. Those integrations need their own deployment and verified-payment checks before Arizona ads can run.

## Invoice before account setup

The public billing forms `/invoice/arkansas-efa`, `/invoice/arizona-esa` and
`/invoice/new-hampshire-efa` collect the parent email and the student's billing
name. They return a downloadable unpaid PDF and the reviewed program payment
instructions. No AMP account, learning profile, card payment or learning consent
is needed to prepare the invoice. An enabled named-student offer is required.

The invoice number is a random UUID. No public lookup by invoice number or email
exists. Retries require the original random idempotency key and identical billing
fields. The form keeps its draft in memory, including after a failed request; it
does not put names, emails or retrieval credentials in URLs or browser storage.

A parent signs in with the same verified email to recover invoices. Linking an
invoice to a learner requires active learning consent and server-verified learner
ownership. Linking preserves the original invoice number and offer snapshot. It
does not confirm payment or grant access. Only trusted program payment evidence
can provision the purchase. Payment received before learner setup must be retained
by the reconciliation adapter until the invoice is claimed. An expired invoice
requires billing review rather than silently changing its issued terms.

Unpaid unclaimed billing drafts expire within 30 days and are removed by the
privacy retention worker. Verified payment records follow the financial retention
period. Claimed paid invoices follow their commerce order's retention. Verified
parents can export matching billing drafts and remove unpaid drafts through family
data deletion. Learning deletion preserves required payment records.

Guest invoices retain an internal reference to the original unexpired advertising
journey and matching program campaign labels. Claiming the invoice binds eligible
click evidence to its funded request; a later browser visit cannot replace that
history. Invoice creation and claiming do not count as purchases. Only verified
payment evidence can qualify for purchase delivery to an advertising provider.

Browser opt-outs suppress attribution. Claiming applies recorded provider
withdrawals in the same transaction as journey ownership. Expired or differently
owned journeys cannot be attached. Tracking failures do not prevent billing;
failed claim attribution is discarded. Family exports include campaign labels,
but never journey credentials or raw advertising click identifiers.
