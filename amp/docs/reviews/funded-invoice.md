# Funded invoice review

A reviewed offer can require a named student invoice instead of an opaque-reference quote. The parent enters the program-account name separately from the learner nickname. The download contains merchant details, a unique invoice number, dates, product/SKU, quantity, subtotal, tax, total and the one-learner annual term. Creating it does not verify payment or grant access.

All examples below are synthetic. The test price and merchant are not a live offer. The [sample invoice PDF](funded-invoice/sample-invoice.pdf) fits one Letter page; text extraction verified the name, charges and private-identifier exclusions. [Rendered page](funded-invoice/invoice-page.png).

| Width | Light form / prepared | Dark form / prepared | Privacy paragraph |
| --- | --- | --- | --- |
| 320 | [Form](funded-invoice/form-320-light.png) · [Prepared](funded-invoice/prepared-320-light.png) | [Form](funded-invoice/form-320-dark.png) · [Prepared](funded-invoice/prepared-320-dark.png) | [Light](funded-invoice/privacy-320-light.png) · [Dark](funded-invoice/privacy-320-dark.png) |
| 390 | [Form](funded-invoice/form-390-light.png) · [Prepared](funded-invoice/prepared-390-light.png) | [Form](funded-invoice/form-390-dark.png) · [Prepared](funded-invoice/prepared-390-dark.png) | [Light](funded-invoice/privacy-390-light.png) · [Dark](funded-invoice/privacy-390-dark.png) |
| 768 | [Form](funded-invoice/form-768-light.png) · [Prepared](funded-invoice/prepared-768-light.png) | [Form](funded-invoice/form-768-dark.png) · [Prepared](funded-invoice/prepared-768-dark.png) | [Light](funded-invoice/privacy-768-light.png) · [Dark](funded-invoice/privacy-768-dark.png) |
| 1280 | [Form](funded-invoice/form-1280-light.png) · [Prepared](funded-invoice/prepared-1280-light.png) | [Form](funded-invoice/form-1280-dark.png) · [Prepared](funded-invoice/prepared-1280-dark.png) | [Light](funded-invoice/privacy-1280-light.png) · [Dark](funded-invoice/privacy-1280-dark.png) |

The browser check measures unchanged field/footer geometry during preparation and a failed request, exercises an actual PDF download, preserves the idempotency key on retry, clears billing names when the account or selected learner changes, and checks long-name wrapping. [Error overlay](funded-invoice/error-320-light.png).

Deletion copy distinguishes the erased profile name from a required student name retained on a verified financial invoice. [Long-name deletion confirmation on a small phone](funded-invoice/deletion-confirmation-320.png) keeps confirmation actions visible. Real database tests cover ownership, consent, immutable name retries, no access on creation, original-invoice retrieval after offer withdrawal, export, and draft deletion versus financial retention.

Standard PDF fonts support Western Latin characters. Unsupported names are rejected before storage and direct the parent to merchant assistance; the service does not alter a student's name to fit the font. Program acceptance, live vendor/product approval, deployed parent-notice review and a supported verification path are separate launch requirements. No live offer is enabled by this change.
