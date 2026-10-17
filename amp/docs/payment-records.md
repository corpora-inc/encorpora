# Paid purchase records

AMP can preserve verified Stripe annual-payment facts and let the purchasing parent download a paid purchase record and linked refund observations. These records are distinct from unpaid funding quotes. A record does not establish tax eligibility, program approval, or permission to learn.

The supported document scope is one annual USD product, quantity one, paid through the configured merchant’s captured Stripe payment. Tax-exclusive amounts and inclusive/exclusive tax components must reconcile exactly. Discounts, shipping charges, customer-credit balances, credit notes, invoice revisions, unsupported currencies, missing tax fields, or conflicting historical facts place the document under review. No proportional tax refund is invented from a cash refund.

## Purchase-time identity

`AMP_PAYMENT_DOCUMENT_PROFILE` is an optional JSON configuration consumed with the Stripe configuration. It must match the merchant account, test/live mode, product, price, SKU, currency, and unit amount. Its fields are defined by `documentProfileSchema` in `src/billing/evidence/contracts.ts`:

- A version and actual review timestamp.
- The seller’s legal name, postal address, support email, support URL, and privacy URL.
- A truthful product title and description.
- The exact merchant/catalog identifiers and USD unit amount.

Use reviewed business records and deployed public URLs. There is no default Corpora address, commercial price, or seller identity. The standard PDF font supports a bounded Western character set; unsupported text fails validation rather than being replaced. Synthetic profiles in tests are not merchant configuration.

The profile is copied into a new checkout reservation and cannot be changed on that reservation. Changing configuration does not rewrite an existing purchase or renewal. A new renewal invoice requires its reviewed profile to match the stored contract; absent or changed configuration places issuance under review while retaining verified cash facts. Invoice creation versus renewal comes from the provider’s billing reason, not delivery order. Contract migration is not automatic. Orders without a purchase-time profile cannot receive a retrospectively invented seller identity. A historical reconciliation process requires separately verified evidence and is outside this interface. An existing open reservation without a profile must be resolved through its purchase provider.

Missing profile configuration disables document issuance for new reservations; it does not fabricate missing records or enable Stripe checkout. Stripe’s independent live-billing and deployment controls apply. Tests use signed synthetic events and mocked provider resources; they do not move money or send mail.

## Payment and refund evidence

The signed webhook inbox identifies the event. The worker independently retrieves the invoice, subscription, payment, captured charge, and bounded refund history from the configured Stripe account. It serializes a second authoritative refresh with account and invoice locks before recording monetary observations. Webhook delivery order is not treated as financial truth.

The invoice baseline is immutable. Refund identities, amounts, currency, charge binding, and provider creation times are preserved. Append-only observations record status changes; only refunds currently marked `succeeded` reduce net recorded payment. A successful refund can later fail. Its correction retains the earlier observation and does not automatically reactivate learning access. Provider creation time is not a bank completion timestamp. Exact unchanged observations do not create duplicate adjustments.

Credit-note notifications create an immutable invoice-level reconciliation hold even when the payment record does not exist or a provider lookup fails. Voiding a credit note or receiving a later paid event does not erase that hold. Baseline and refund-history collisions also require review. This slice has no automatic hold-release or credit-note reconciliation command; document downloads stay unavailable for held records.

Financial evidence commits independently of successful access projection using a database savepoint. A previously unseen activation requires effective consent and a learner that has not been deleted. A paid purchase is not lost when activation is held: the evidence persists and the durable worker can retry after valid re-consent. Refund processing and exact activation replays do not require new consent. A deleted learner requires operator reconciliation; its financial identity does not create a new learner. General commerce ownership remains distinct from the authorization required to learn.

## Parent access and retention

Web Parent Account → Access → Purchases & records → Payment records lists owned records, with cursor pagination for older purchases. The parent can download a paid purchase PDF and individual refund-observation adjustments. The current paid record identifies its last verified observation time; it is not a promise of real-time bank settlement. Pending, failed, and canceled refunds are distinguished from successful refunds. Test documents prominently state that no money moved.

Identity authentication and account ownership apply to each list and download query. Consent withdrawal does not remove the parent’s financial records. Learning-data deletion retains only the existing financial binding and opaque learner reference, rather than a child’s deleted name. Family data export includes the retained payment facts, observations, and reconciliation references. Downloads are private, `no-store` attachments without public bearer links. The API reads retained facts without requiring current Stripe credentials.

Native family controls direct parents to the configured web app; native purchase and document-download endpoints are not exposed. The documents do not include a parent’s tax identifier, tax return, card details, or agency eligibility evidence. They may not satisfy a program that requires a legal student name, a different invoice format, or additional proof of delivery. No application or reimbursement is submitted by downloading a record.

## Verification

Run `npm test`, `npm run tsc`, `npm run build`, the dedicated-database suite with `AMP_TEST_DATABASE_URL`, and `npm run test:payment-ui`. The payment fixture verifies raw webhook signatures with a synthetic seller and mocked provider objects, immutable snapshots, monetary reconciliation, refunds and later failures, credit-note-first ordering, ownership, pagination, and held activation. The browser proof extracts actual PDF text, checks text bounds, rasterizes the PDF, and exercises compact screens, identity changes, downloads, and family return focus. Poppler tools (`pdfinfo`, `pdftotext`, `pdftoppm`) are required for that proof.

Stripe’s primary references describe [payment receipts](https://docs.stripe.com/receipts), [refund status and failures](https://docs.stripe.com/refunds), and [invoice amount fields](https://docs.stripe.com/api/invoices/object). These integration references do not establish government-program eligibility.

Database integration checks require a dedicated fixture database through
`AMP_TEST_DATABASE_URL`. The runner and direct integration/browser entrypoints
reject the shared `/amp` preview before setup. Production `db:migrate` retains
its deployment behavior. See [test database safety](test-databases.md).
