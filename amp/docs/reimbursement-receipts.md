# Reimbursement receipts

Parents can download verified card-payment receipts from **Family → Purchases & records → Payment records**. Each receipt includes the seller's snapshotted legal name and address, product description and quantity, purchase date, invoice term, taxes, amount paid, refunds, and recorded payment method. Seller and product details must be configured through the payment document profile before checkout. A receipt is evidence of a purchase, not confirmation of program eligibility.

A parent may enter a learner name for a download. AMP neither infers it from a learner profile nor stores it in payment history. The PDF labels it as parent-entered. The current PDF font supports Latin letters and accents; the form rejects unsupported characters without changing the name. Purchase support must handle names in other writing systems.

Set `AMP_REIMBURSEMENT_PROGRAMS_FILE` to a UTF-8 JSON file containing an array of programs. Each entry has:

- `id`: unique lowercase identifier using letters, numbers and hyphens;
- `state`: two-letter state abbreviation;
- `programName`: public program name;
- `officialUrl`: HTTPS link to the program administrator's reimbursement instructions;
- `requiredFields`: one or more of `sellerName`, `sellerAddress`, `sellerContact`, `receiptNumber`, `purchaseDate`, `product`, `licenseTerm`, `amountPaid`, `paymentMethod`, `learnerName`.

Verify each entry against the program's current official instructions before configuring it. An HTTPS link is syntactically validated; the operator must verify that its publisher is the program administrator. No program is enabled by default. The checklist describes fields AMP can supply; programs may require additional documents or impose eligibility restrictions. For example, the [Arizona Department of Education's ESA support page](https://www.azed.gov/esa/esa-support) describes purchase documentation and reimbursement procedures. Follow the administrator's current rules for the specific purchase.

The payment screen lists configured programs by state and links to those instructions. In payment history, selecting a program requires its learner-name field before downloading. Older records without provider-observed payment-method evidence cannot produce a receipt for a program requiring that field; purchase support must supply the missing evidence. The original payment record remains downloadable with the limitation stated. No historical payment facts are backfilled from current configuration.
