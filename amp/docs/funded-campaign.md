# Funded purchase campaign totals

The funding-request API accepts optional `campaignAttribution` with three fixed labels: `campaign: "ar-efa-launch"`, a source from `CAMPAIGN_SOURCES`, and a medium from `CAMPAIGN_MEDIA`. Only an enabled offer identifying `programId: "ar-efa"` and `jurisdiction: "AR"` can accept these labels. Arbitrary text, click identifiers, names, email addresses and learning data are rejected.

Labels are supplied by the caller, not independently verified by an ad platform. They support first-party campaign reporting; they do not prove that an ad caused a purchase. This API does not install tracking pixels, export conversions, or join the anonymous assessment to a parent account. The browser purchase flow must explicitly supply permitted labels before it can contribute attributed requests. Existing requests are not backfilled.

The original request keeps its labels across retries. Retrying an unattributed request cannot attach a later campaign. The HTTP endpoint ignores new attribution when the request carries `Sec-GPC: 1` or `DNT: 1`; purchasing continues normally. Privacy preferences must also suppress forwarding in any calling interface.

`npm run report:campaign -- 30` includes `fundedCampaign` alongside the distinct operational `arkansasOrders` and public page/link activity. Apply migration `0027-funded-campaign.sql` before running this code.

| Action | Evidence | Date |
| --- | --- | --- |
| `request_prepared` | A new authenticated, consent-authorized funding request with campaign labels | Request creation |
| `order_created` | Verified operator provisioning links an ESA order to that request | Order creation event |
| `order_settled` | The commerce ledger accepts positive settled payment | Settlement event |
| `refund_completed` | The ledger accepts a completed positive refund | Refund event |

Dates use UTC. Each action counts at most once per request, in the transaction that accepts its evidence. Replayed imports and concurrent retries cannot add a second count. Credit-approved learning access can precede settlement; neither approval nor activation counts as payment. Parent-reported submission and refund requests do not count as settled or refunded money. Counts from different date windows are not a same-cohort conversion rate. These are order counts, not gross receipts, net revenue or refund amounts.

Daily aggregate rows contain only date, campaign, source, medium, action and count. Labels and deduplication markers reside on the existing funding request, separate from learning records. Unconverted requests expire under the funding-request retention rule; linked requests follow the financial-record retention period. Aggregate historical preparation totals survive deletion of an expired request. The parent’s private family export includes retained campaign labels. It does not expose the internal deduplication markers.

Verification uses the dedicated database funding-purchase integration suite: concurrent creation/imports, delayed settlement, refund replay, unchanged attribution on retry, expiry, program mismatch, invalid labels and privacy headers. No test contacts a payment or ad platform.
