# Pay by ClassWallet checkout

AMP implements ClassWallet's [Pay By API contract](https://github.com/ClassWalletTech/classwallet-docs/blob/main/PayByAPI.md). This is the marketplace checkout protocol, separate from DirectPay invoice uploads. The public [WooCommerce plugin release](https://github.com/ClassWalletTech/classwallet-wordpress-plugin/releases/tag/v1.7.2) implements the same authenticated GET/PUT callbacks.

## Family flow

The parent signs into AMP, selects their learner and prepares a funding invoice. For a configured marketplace offer, AMP creates a checkout link. ClassWallet retrieves the invoice and the parent completes the purchase there. An authenticated approval callback activates the exact learner only when that offer permits activation after approval under a recorded credit agreement. The normal settlement policy waits for separate payment evidence.

Marketplace arrival data never signs anyone into AMP. The documented base64 vendor marker and posted email are not account authentication. Parents use AMP's regular sign-in and consent process.

## Setup

ClassWallet must enable the integration and issue its vendor ID and callback Basic-auth credentials. Provide the Start URL and confirm the merchant's marketplace offers before enabling this configuration. The published documentation does not provide self-service credential issuance or a public DirectPay transaction feed.

Set `AMP_CLASSWALLET_PAYBY_FILE` to a private JSON file:

```json
{
  "enabled": true,
  "vendorId": "000000000000000000000000",
  "publicOrigin": "https://amp.example.com",
  "setupReference": "private-reviewed-setup-reference",
  "offerIds": ["approved-marketplace-offer"]
}
```

Supply `AMP_CLASSWALLET_BASIC_USER` and `AMP_CLASSWALLET_BASIC_PASSWORD` through secret storage. The callback password must contain at least 16 characters. The vendor ID above is a placeholder. No configuration means no checkout capability or provider endpoints. Only enabled, current offers whose route is `marketplace` are eligible. DirectPay approval alone does not enable this flow.

| Endpoint | Authority and purpose |
| --- | --- |
| `GET /api/v1/funding/classwallet/capabilities` | AMP parent authentication; eligible offer IDs |
| `POST /api/v1/funding/requests/:id/classwallet-checkout` | AMP parent authentication; account, learner, consent and immutable invoice checks; returns `checkoutUrl` |
| `POST /api/v1/classwallet/start` | Navigation only; redirects to AMP without creating a session or trusting posted personal data |
| `GET /api/v1/classwallet/orders/:id` | Provider Basic authentication; returns invoice items, shipping and tax |
| `PUT /api/v1/classwallet/orders/:id` | Provider Basic authentication; records `PurchaseOrderId` and approval/cancellation |

The checkout redirect is pinned to `https://app.classwallet.com/payby-checkout/`. The callback origin comes from reviewed configuration, never a request Host header. Invoice amounts come from the server's saved offer. Provider responses contain no parent email or learner name.

## Payment and recovery

ClassWallet documents `complete` as approval. It is not proof of ACH settlement. The callback creates no settlement event. Offers using `after-approval` also require a credit-agreement reference; other offers retain an approval record and wait for verified settlement evidence.

Provider purchase-order IDs are globally unique in the checkout table. Replays keep the first immutable provisioning bundle and access dates. Conflicting purchase orders and status transitions are rejected and recorded as stopped exceptions for review. A callback before invoice retrieval is rejected. A failed access transaction leaves the approval available for recovery; it does not claim fulfillment. The scheduled `funding:deliver` worker runs `reconcileClassWalletApprovals` before sending notifications. It retries up to eight due records per invocation, deferring failures for five minutes and stopping each record after eight failures for operator review. Supply the approved offers through `AMP_FUNDING_OFFERS_FILE`; missing offers cannot activate a pending purchase.

The existing CSV importer will quarantine an invoice already provisioned through Pay by ClassWallet rather than create a second license. Recording subsequent settlement for those orders requires reconciliation against the existing order and confirmed purchase-order/report identifier mapping. Do not relabel the approval as settlement or replace its order ID. Cancellation after an accepted approval likewise requires review; the callback alone does not establish a refund or revocation.

Synthetic integration tests exercise the family checkout, provider GET/PUT, duplicate callbacks, consent failure and recovery, and separation of approval from settlement. Production needs provider setup and a real test purchase before advertising this checkout as available.
