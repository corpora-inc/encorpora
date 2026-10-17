# Funded product document drafts

These field-level drafts describe different documents and their permitted uses. They are not issued invoices, receipts, payment requests or program-approved forms. Fill them only after the route and exact product are accepted. Keep student names, addresses, payment references and account details out of this public repository.

## Unpaid quote

**Title:** Quote — unpaid; not proof of payment

**Seller:** [verified legal merchant name, address, support contact]  
**Quote:** [unique reference] — issued [date/time/timezone], expires [date/time/timezone]  
**Program and award year:** [program] / [year]  
**Recipient:** [parent reference; additional identity only where required and reviewed]  
**Learner:** [route-approved student reference or privately collected name]  
**Offer evidence:** [internal reference, not exposed to parent]  
**Access term:** [explicit approved start/end dates or approved activation rule]

| Item | SKU/edition | Quantity | Unit price | Discount | Line total |
| --- | --- | --- | --- | --- | --- |
| [single-student practice access, exact term] | [approved SKU/version] | 1 | [USD] | [USD] | [USD] |
| [specific downloadable PDF, if separately approved] | [book/edition] | 1 | [USD] | [USD] | [USD] |

**Subtotal:** [sum of discounted lines]  
**Approved fees:** [itemized USD or zero]  
**Tax:** [USD and reviewed tax treatment]  
**Total:** [subtotal + fees + tax]  
**Amount paid:** $0.00

Preparing this quote does not reserve program funds, establish purchase eligibility or activate access. The administrator decides whether a request is approved. Access follows the accepted channel's activation policy; submission alone does not fulfill the order.

The existing AMP PDF is an administrative quote with an opaque learner reference and an activation-based 12-month term. It must not be described as a universally acceptable ESA invoice. Arizona's named-student and contract-year requirements are unmet. Texas's portal document rules require a different approved workflow. See [route evidence](README.md).

## Invoice after accepted order

**Title:** Invoice — [unpaid or balance due, according to ledger]

Include verified seller details, unique invoice number/date, program/award year, external accepted-order reference, route-required student identity, each exact SKU/edition, quantity, approved service dates and itemized amounts. Show subtotal, discounts, fees, tax, total, verified payments and remaining balance separately. Use the accepted order's term and amount, never a changed live catalog price.

Where required, include a clear line such as “One student's mathematics software access, [start date] through [end date]” and “Downloadable [book title], edition [version], personal-print license [scope].” A book download has no physical shipping charge unless an actual separately approved printed product is supplied.

Do not mark a submitted parent request, approval notification or unpaid invoice as settled. The ledger distinguishes approval, fulfillment, settlement and refund. For portal-controlled routes, create/upload the administrator-required record inside that portal; do not automatically send the parent a duplicate transaction document contrary to the route's rules.

## Paid receipt for an eligible reimbursement route

**Title:** Receipt — paid [actual timestamp/timezone]

Reference the immutable invoice/order, itemized purchased products, full purchase date, price/subtotal/tax/fees/discounts/total, verified amount paid, payment method and minimally necessary masked transaction reference. Attach payment proof only where required and only from an actual settled event. Never expose full card/bank numbers or internal approval evidence. A quote cannot be relabeled as a receipt.

Florida's PEP and FES-UA materials documentation fields are sourced in the [structured dossier](../../src/funding/first-wave-dossiers.ts); route approval and the family's eligibility/balance remain separate. Arizona requires payment proof for reimbursement. The application does not issue a complete route-specific reimbursement receipt; this draft is a specification, not a claim that the feature is implemented.

## Refund or credit record

Link the original order and settled transaction. Record approved reason, authorized refund amount, administrator approval reference, destination back to the permitted original funding channel, timestamp, remaining entitlement and any revoked access. Retain a distinct credit/refund identifier. Do not return program money as cash, platform tokens or unrelated credit to a parent. Partial refunds and downloaded-material rights require approved channel terms; do not invent a universal policy.

Before using any draft, verify arithmetic, term, program/year, identity requirements, private-reference redaction, document transport and status against the accepted route. Tests of the generic quote renderer establish visual/arithmetic behavior, not acceptance by a program.
