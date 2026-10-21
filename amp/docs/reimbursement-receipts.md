# Reimbursement receipts

Parents can download verified card-payment receipts from **Family → Purchases & records → Payment records**. Each receipt includes the seller's snapshotted legal name and address, product description and quantity, purchase date, invoice term, taxes, amount paid, refunds, and recorded payment method. Seller and product details must be configured through the payment document profile before checkout. A receipt is evidence of a purchase, not confirmation of program eligibility.

For the processor's original payment evidence, use **Manage billing**, open the paid invoice, and choose **Download receipt** when offered. Confirm the downloaded document shows payment received; an invoice showing an amount due is not proof of payment. The Stripe customer portal can provide invoice history when that feature is enabled in the configured portal. AMP authenticates the parent before opening that customer's portal. The AMP receipt can supplement the processor document with the parent-entered learner name and license details. Check the program's current rules to determine which documents to submit; neither document guarantees eligibility.

A parent may enter a learner name for a download. AMP neither infers it from a learner profile nor stores it in payment history. The PDF labels it as parent-entered. The current PDF font supports basic Latin letters and some accents; the form rejects unsupported characters without changing the name. Purchase support must handle names in other writing systems.

Set `AMP_REIMBURSEMENT_PROGRAMS_FILE` to a UTF-8 JSON file containing an array of programs. Each entry has:

- `id`: unique lowercase identifier using letters, numbers and hyphens;
- `state`: two-letter state abbreviation;
- `programName`: public program name;
- `officialUrl`: HTTPS link to the program administrator's reimbursement instructions;
- `requiredFields`: one or more of `sellerName`, `sellerAddress`, `sellerContact`, `receiptNumber`, `purchaseDate`, `product`, `licenseTerm`, `amountPaid`, `paymentMethod`, `learnerName`.

Verify each entry against the program's current official instructions before configuring it. An HTTPS link is syntactically validated; the operator must verify that its publisher is the program administrator. No program is enabled by default. The checklist describes fields AMP can supply; programs may require additional documents or impose eligibility restrictions. For example, the [Arizona Department of Education's ESA support page](https://www.azed.gov/esa/esa-support) describes purchase documentation and reimbursement procedures. Follow the administrator's current rules for the specific purchase.

The payment screen lists configured programs by state and links to those instructions. In payment history, selecting a program requires its learner-name field before downloading. Older records without provider-observed payment-method evidence cannot produce a receipt for a program requiring that field; purchase support must supply the missing evidence. The original payment record remains downloadable with the limitation stated. No historical payment facts are backfilled from current configuration.

Checkout requires an individual customer name and saves it for billing. The receipt separately labels the paying customer from the finalized invoice's `customer_name` snapshot and, when present, the payment method's billing name from the settled charge. These can differ. Card last four are included only when the processor supplies exactly four digits.

Each invoice captures its own customer-name snapshot, including renewals. No receipt identity is inferred from a current customer profile, learner name or an earlier subscription payment. Missing values stay unknown on replay; a conflict with recorded identity requires review. Names in other writing systems remain intact in stored evidence. If the PDF font cannot display a name, the receipt directs the parent to purchase support. No card number beyond the last four digits is retained in the receipt baseline.

Stripe documents [Checkout name collection](https://docs.stripe.com/payments/checkout/name-collection) separately from payment-method billing information and freezes the [invoice customer name](https://docs.stripe.com/api/invoices/object#invoice_object-customer_name) at finalization. Older checkouts may lack either name. Program-specific payer identity requirements must be checked against the actual receipt and purchase; collecting a customer name does not verify legal identity or establish tax eligibility.
