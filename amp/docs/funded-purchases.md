# Education-fund purchase requests

AMP can prepare a PDF quote or a program-payment invoice for a parent and track its submission separately from verified approval, payment and learning access. An authenticated parent selects an owned learner and an explicitly configured program/product offer. The server fixes the price, tax, annual term and approved route in an immutable request snapshot. Preparing or reporting a request never grants access.

No program offers are enabled by default. The national funding registry records research; it does not establish Corpora's vendor approval or a product's eligibility. Deployment requires documentary evidence for the merchant, exact SKU, purchasing route, payment method, annual term and document requirements. Marketplace and direct-pay routes are supported. Reimbursement and app-store purchasing are outside this request workflow.

## Operator configuration

`AMP_FUNDING_OFFERS_FILE` identifies a private, bounded JSON array validated by `loadFundingOffers`. Each entry follows `fundingOfferSchema` in `src/funding-purchase/contracts.ts`. It includes a revision, program/year, SKU, merchant details, price and tax in integer cents, verified HTTPS destination, parent instructions, validity window and private evidence references. Use a new revision when an offer changes. Synthetic fixtures in tests are not product prices or available offers.

An offer selects one reviewed document policy:

- `opaque-student-reference-accepted` produces a quote using the learner reference. No student billing name is accepted.
- `named-student-invoice` produces an invoice with a name explicitly entered by the parent as it appears in the program account. It includes a unique invoice number, issue and submission dates, merchant details, product/SKU, quantity, subtotal, tax, total and one-learner annual term. It is not a receipt or proof of program approval, payment or access. Submit it through the configured program route only once; do not also pay by card.

Enable an offer only when the specific program accepts its document format. Additional tax forms or a program-specific format require a separate supported workflow. The supplied PDF fonts support Western Latin text, including accents. Unsupported names are rejected before persistence with an instruction to contact the merchant for an invoice; names are never transliterated or discarded. Configuration rejects unsupported merchant/product text before showing offers.

A request expires after at most 30 days, bounded by the offer's validity. Disabling an offer or changing its configuration blocks document download, submission reporting and conversion of an unconverted request. An original invoice linked to a verified order remains available to its parent even after offer withdrawal or expiry; it does not purport to show current payment status. Its history displays an unavailable-offer notice. It does not revoke existing licenses. An exact replay of a completed conversion remains a no-op even if its offer has since been disabled.

## Parent document and status

`FundingPurchaseCenter` is a focused workspace with learner selection, request history, an authenticated PDF download, the verified program destination and explicit submission reporting. Its stable account identity is separate from its renewable access token. Active verified consent is required for a new request; existing records can be viewed without creating new access.

The Letter PDF includes merchant/contact details, quote and student references, program/year, SKU, description, subtotal, tax, total, UTC expiry and a twelve-month activation-based term. The quote policy produces an unpaid quote, not an invoice, receipt, approval or promise of reimbursement. The invoice policy produces the separate payment-request document described above. Downloading it does not open a popup or send it to an agency. Parents must complete the program's process themselves. Cancelling a quote in AMP does not cancel an order submitted to the program.

Payment, approval, fulfillment, refund and access are separate status fields. A parent's “submitted” report is unverified. Private evidence references are excluded from parent purchase-status responses.

## Verified provisioning

`npm run funding:import -- /trusted/path/events.json` requires an explicit `AMP_DATABASE_URL` and the current offer configuration. This is an operator-only import, not a public webhook or marketplace integration. The bounded JSON input contains `requestId` and an explicit commerce-event bundle: order creation, approval or settlement as required by policy, fulfillment and license activation. Verify the program transaction and its documents before importing anything.

The bounded operator import takes an exclusive parent-account advisory lock before request, order and learner locks, checks active consent and learner ownership, and binds account, learner, SKU, channel, amount, currency and activation policy to the quote snapshot. It applies the commerce events and links the request in one transaction. Invalid or incomplete bundles roll back. An identical replay is idempotent; changed replay payloads are rejected. A second active or scheduled grant overlapping the proposed term is rejected with `overlapping_learning_access`, including pilot access. The operator must reconcile the existing entitlement before provisioning; this importer does not silently extend or replace it. Exact replay of an already converted request remains a no-op. This overlap check covers recorded entitlements; it does not detect an unpaid checkout session or an unissued future renewal. Operators must reconcile pending purchases across payment channels before accepting another funded order.

The default activation policy requires settlement. Activation after approval requires an explicit approved-credit agreement reference in the private offer. An operator cannot change that policy in the order. The license starts at the activation event and ends one calendar year later; February 29 clamps to February 28. Events preserve approval, fulfillment, settlement and activation as distinct facts. Refunds and revocations use the commerce ledger; disabling a purchasing offer does not silently alter a paid license.

## Verification

The tests cover account isolation, server-bound prices, concurrent idempotency, consent/deletion checks, rollback, exact replay, policy mismatch, disabled/revised offers and financial-record retention. `npm run test:funding-ui` exercises three phone/landscape widths, consent gating, token renewal, submission without activation and PDF downloads. `tsx scripts/verify-funding-quote.ts` additionally requires Poppler tools (`pdftotext`, `pdfinfo`, `pdftoppm`) to inspect text, arithmetic, dimensions and rendered pages. Rendering checks do not establish acceptance by any funding program.

## Records and deletion

A student billing name belongs only to the immutable financial request and authenticated document; it is not copied into the learner profile, campaign aggregates or ad-platform exports. Exact retries must preserve that name; correcting it requires cancelling an unconverted request and preparing a new one.

Learning-data deletion removes unconverted requests, including drafts for a learner whose billing history requires a minimized retained record. Converted requests retain the financial snapshot and order link for reconciliation. Parent export includes an account-scoped funding-request dataset, including a supplied student billing name, with private approval, credit and document-policy evidence removed. The privacy-retention command removes expired unconverted requests; it does not purge linked financial transactions.


## Deployment and program review

Apply migration `0029-funding-invoices.sql` and deploy the compatible API and parent interface before enabling a named-invoice offer. Review the deployed parent notice for the student billing-name purpose and financial retention before collecting it. Existing opaque-reference offers and records keep their quote behavior. Do not change an issued offer snapshot or edit an applied migration. Use a new offer revision when document requirements change.

The Arkansas [vendor invoicing guide](https://efavendoronboardingchecklist.my.canva.site/efa-vendor-invoicing-and-payment-guide) requires a student name for services, vendor identification, itemized charges and a total matching the payment request. Rendering these fields does not establish approval for a specific SKU or successful ClassWallet submission. Verify the actual vendor/product route and payment/refund process before activation. The workflow continues to require verified parent consent; it does not modify the deployed consent policy.
