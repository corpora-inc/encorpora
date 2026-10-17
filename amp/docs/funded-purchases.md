# Education-fund purchase requests

AMP can prepare an unpaid PDF quote for a parent and track its submission separately from verified approval, payment and learning access. An authenticated parent selects an owned learner and an explicitly configured program/product offer. The server fixes the price, tax, annual term and approved route in an immutable request snapshot. Preparing or reporting a request never grants access.

No program offers are enabled by default. The national funding registry records research; it does not establish Corpora's vendor approval or a product's eligibility. Deployment requires documentary evidence for the merchant, exact SKU, purchasing route, payment method, annual term and document requirements. Marketplace and direct-pay routes are supported. Reimbursement and app-store purchasing are outside this request workflow.

## Operator configuration

`AMP_FUNDING_OFFERS_FILE` identifies a private, bounded JSON array validated by `loadFundingOffers`. Each entry follows `fundingOfferSchema` in `src/funding-purchase/contracts.ts`. It includes a revision, program/year, SKU, merchant details, price and tax in integer cents, verified HTTPS destination, parent instructions, validity window and private evidence references. Use a new revision when an offer changes. Synthetic fixtures in tests are not product prices or available offers.

The PDF identifies the student by an opaque reference. Enable an offer only when the specific program accepts that identifier and this quote format. Programs requiring legal student names, additional tax forms or their own invoice format require another supported workflow. The supplied standard PDF fonts support Western Latin text, including accents; configuration rejects unsupported text before showing offers. Text is never silently transliterated or discarded.

A request expires after at most 30 days, bounded by the offer's validity. Disabling an offer or changing its configuration blocks conversion of an unconverted request. It does not revoke existing licenses. An exact replay of a completed conversion remains a no-op even if its offer has since been disabled.

## Parent document and status

`FundingPurchaseCenter` is a focused workspace with learner selection, request history, an authenticated PDF download, the verified program destination and explicit submission reporting. Its stable account identity is separate from its renewable access token. Active verified consent is required for a new request; existing records can be viewed without creating new access.

The Letter PDF includes merchant/contact details, quote and student references, program/year, SKU, description, subtotal, tax, total, UTC expiry and a twelve-month activation-based term. It is an unpaid quote, not an invoice, receipt, approval or promise of reimbursement. Downloading it does not open a popup or send it to an agency. Parents must complete the program's process themselves. Cancelling a quote in AMP does not cancel an order submitted to the program.

Payment, approval, fulfillment, refund and access are separate status fields. A parent's “submitted” report is unverified. Private evidence references are excluded from parent purchase-status responses.

## Verified provisioning

`npm run funding:import -- /trusted/path/events.json` requires an explicit `AMP_DATABASE_URL` and the current offer configuration. This is an operator-only import, not a public webhook or marketplace integration. The bounded JSON input contains `requestId` and an explicit commerce-event bundle: order creation, approval or settlement as required by policy, fulfillment and license activation. Verify the program transaction and its documents before importing anything.

The importer locks the parent account and request, checks active consent and learner ownership, and binds account, learner, SKU, channel, amount, currency and activation policy to the quote snapshot. It applies the commerce events and links the request in one transaction. Invalid or incomplete bundles roll back. An identical replay is idempotent; changed replay payloads are rejected.

The default activation policy requires settlement. Activation after approval requires an explicit approved-credit agreement reference in the private offer. An operator cannot change that policy in the order. The license starts at the activation event and ends one calendar year later; February 29 clamps to February 28. Events preserve approval, fulfillment, settlement and activation as distinct facts. Refunds and revocations use the commerce ledger; disabling a purchasing offer does not silently alter a paid license.

## Verification

The tests cover account isolation, server-bound prices, concurrent idempotency, consent/deletion checks, rollback, exact replay, policy mismatch, disabled/revised offers and financial-record retention. `npm run test:funding-ui` exercises three phone/landscape widths, consent gating, token renewal, submission without activation and PDF downloads. `tsx scripts/verify-funding-quote.ts` additionally requires Poppler tools (`pdftotext`, `pdfinfo`, `pdftoppm`) to inspect text, arithmetic, dimensions and rendered pages. Rendering checks do not establish acceptance by any funding program.
