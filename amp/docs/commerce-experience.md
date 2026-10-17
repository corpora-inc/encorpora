# Family purchase and account experience

AMP sells a learning relationship: a parent can see what one learner can practice, what the learner has mastered, what access costs, and what happens when access ends. Payment screens belong in the parent area. Practice must not interrupt a child with prices, billing failures, marketplace applications or requests to ask a parent to pay.

This document defines the intended experience and its release acceptance. The repository includes an optional annual Stripe server adapter, a channel-independent commerce ledger and a research inventory of funding programs. It does not establish approved ESA vendor/SKU listings, a completed parent purchase UI, native store billing or a public-launch-ready family lifecycle.

## Choosing access

A parent sees the released curriculum coverage, included printable materials, supported devices and annual term before a price. “K–12” must not imply unavailable topics. Coverage links show what is available, what has been reviewed, and what is outside the offering. Do not promise a perfect SAT score or guaranteed mastery.

The offer identifies one learner, one annual license, the actual price and currency, applicable tax treatment, whether it renews, the renewal date or date calculation, and the cancellation/refund policy. “Annual” is a term, not a disguised monthly installment. If a monthly equivalent is shown, the actual annual charge is at least as prominent. Download retention rights must be decided and displayed; entitlement expiry and permission to retain an already downloaded book are separate questions.

A learner with current access gets an “Access through [date]” summary and a parent billing-management action. Do not offer a second overlapping license as the default. Multiple learners get separate explicit rows with names, terms, and prices; the parent never discovers an extra learner charge at the payment provider. The implemented Stripe adapter purchases one learner at a time; a family cart requires a separately tested fulfillment policy.

The choice between card payment and education funding must not imply that every family qualifies for funding. Education funding starts with a state/program selector, the program's actual operating status, and whether Corpora's vendor, SKU and payment route are approved. Unapproved channels show a preparation checklist and support contact, not a funded checkout button. A platform logo is not approval evidence.

## Family onboarding

The parent creates or signs into their own account, receives a plain explanation of learner data use, and completes the applicable consent flow. Do not make a child accept parental terms. Collect only information required to create the learner and operate the service. A learner's public display name must not be sent as payment metadata.

After consent, the parent creates a learner, confirms the selected learner for the license, and chooses a route to access. Where a trial or sample exists, show its real scope and end condition. A trial must not silently become a paid subscription; the implemented Stripe adapter does not create trials.

Account recovery must restore the same parent, learners and subscriptions. An email spelling change is not a new purchase. Recovery screens acknowledge receipt without exposing whether another family has an account. A second device must show the existing learner license after authentication, without requiring a repeat payment.

## Card purchase states

1. **Ready:** Show the learner, annual subtotal, currency, tax disclosure, auto-renewal notice and “Continue to secure checkout.” Keep the final payment action in hosted Checkout. Retain a stable request UUID for repeated clicks and network retries.
2. **Opening checkout:** Disable duplicate activation, show progress in the same button footprint, and retain the learner/price summary. If opening fails, keep context and offer “Try again”; reuse the request UUID.
3. **Hosted payment:** Use the configured merchant customer and product. Do not accept customer IDs or prices from browser input. A parent may cancel without losing their learner account or prior learning work.
4. **Payment processing:** A redirect back to AMP says “We’re confirming your payment.” Poll authenticated entitlement status with bounded backoff and a visible support route. Never show a paid success badge from a URL query string. Navigating away does not lose the purchase.
5. **Access confirmed:** Show “Access through [date]” and the selected learner. Offer “Start learning” as the primary action and receipt/billing management as secondary actions. The learner enters a quiet, stable practice workspace; there is no sales celebration in the problem area.
6. **Delayed confirmation:** Preserve the account and learner. Explain that payment confirmation can be delayed and provide a safe reference, support contact and “Check again.” Do not invite the parent to pay a second time.
7. **Expired checkout:** Explain that the payment session expired before completion and offer a new session. The server must confirm expiry and close the old reservation before creating another purchase.
8. **Uncertain creation:** If an external request may have succeeded but cannot be safely retried, present a support/reconciliation state. The adapter stops automatic creation after the idempotency safety window; uncertainty must not turn into a duplicate charge.

The server adapter provides Checkout, portal and durable payment reconciliation. The parent UI, receipt presentation, status polling and replacement-subscription recovery described here require implementation and browser acceptance before release.

## Education funding states

Education funding has four distinct facts: whether the vendor/SKU is approved; whether a particular purchase is approved; whether materials/access were delivered; and whether funds settled. The parent timeline must label these facts separately.

An order may display “Submitted for approval,” “Approved—awaiting fulfillment,” “Access delivered—payment processing,” or “Paid.” The program contract determines whether access can begin after purchase approval or only after settlement. Do not display “Paid” for an award balance, parent submission, reserved amount, approved invoice or fulfilled order.

Before submission, show the exact eligible SKU, learner, term, line items, approved price, program/year, required parent steps and expected route: marketplace purchase, direct payment, permitted reimbursement, school/provider purchasing, or a tax benefit. A tax deduction or credit is not a wallet balance. A school-tuition scholarship is not a direct software reimbursement program.

Rejected or incomplete orders preserve the parent’s information and identify the actionable reason without promising reimbursement. If the family must purchase first under an authorized reimbursement route, state that requirement and risk before card entry. Do not substitute an ordinary card purchase when an ESA approval is delayed. Do not automatically renew publicly funded access unless that program and the specific authorization permit it.

A fulfillment record identifies delivered access dates and materials. Refunds return through the original authorized channel and reconcile the license; they must not become a cash rebate to a parent when program rules prohibit that. An operator can trace an order from external reference through approval, delivery, settlement and refund without searching child practice data.

## Parent controls and cancellation

The parent area has a single account summary with each learner's access source, term, renewal state and management action. Payment details stay with the payment provider. “Cancel renewal” must be distinct from “End access immediately” and “Delete learner data.” Show the date through which paid access continues before and after cancellation.

Consent withdrawal must not hide billing management or make renewal cancellation impossible. Account deletion must resolve active renewals and legally required financial records before erasing the identity mapping that enables cancellation or refunds. Explain the concrete retention/deletion result before final confirmation; never describe retained financial records as deleted.

For Stripe annual licenses, a failed renewal creates no new term. Full successful refunds revoke the corresponding invoice's access; pending refunds do not. Partial refunds preserve access and require financial reconciliation under the implemented policy. Refund initiation is an authorized support operation, not a public API. Display refund status using confirmed provider evidence, not an agent's promise or a pending request.

## Native purchases

An iOS or Android purchase must use the applicable store purchase route when required, with server verification, durable transaction identity, renewal/refund notifications, restoration, and account linking. Display store-managed subscriptions and the correct store management action. A browser subscription must not masquerade as a restored store purchase. Do not create a second subscription because a parent changed devices or platforms.

The native shell does not implement store purchases or a complete native authentication flow. Native purchase buttons, restore controls and subscription marketing must remain unavailable until those flows pass real sandbox acceptance on supported devices. Store review, signing, products and release account setup are separate operational requirements.

## Error recovery and support

Every recoverable screen retains learner and purchase context, explains the next action, and provides one primary action. Avoid generic “Something went wrong” when the system knows that consent is missing, the session expired, access already exists, or confirmation is pending. Do not expose raw Stripe errors, tokens, database messages or internal account identifiers.

Keyboard focus stays on the changed status or next action after a transition. Status text is announced once to assistive technology. Buttons have visible focus, adequate target sizes and readable contrast; status must not depend on color. Screens work at 200% text scaling and in a narrow phone viewport. Payment forms belong in the parent flow and must not displace an active learner's problem or answer dock.

Support can locate a purchase with an opaque reference and authenticated parent context. A support reply states what was verified, what action was taken, and when to check again. The operator interface needs event age, retry status, source order, learner binding, grant dates and refund state; it must not require unrestricted access to payment or learner records. Alerts cover delayed fulfillment and failed reconciliation, not merely server uptime.

## Release acceptance

A release candidate must demonstrate all applicable journeys with test merchant/store/program credentials and synthetic families:

- Two clicks, a timed-out request, refresh, second device and duplicate webhook each result in one intended purchase and one grant per paid invoice.
- Returning before the webhook shows processing; returning after it shows confirmed access; closing the browser does not lose fulfillment.
- A current learner license prevents accidental overlapping checkout. Sibling selection cannot grant the wrong learner or reveal another family's data.
- Missing or withdrawn consent blocks a new purchase; withdrawal does not block cancellation or confirmed refund reconciliation. The concurrent withdrawal/purchase case is tested at the transaction boundary.
- Paid renewal grants exactly the verified next term. Failed renewal does not remove the current paid term. Cancellation shows the retained access date and prevents unintended renewal.
- Full refund before payment delivery never grants temporary access. Refund after activation revokes exactly that invoice. Pending and partial refunds follow the displayed policy.
- Each supported ESA program demonstrates its own approval, delivery, payment and refund sequence against the actual approved SKU and contract. Unsupported routes cannot be selected as if available.
- Screens remain understandable with keyboard-only navigation, screen reader status announcements, reduced motion, large text and supported phone dimensions. Purchase confirmation does not become an unsolicited learner celebration.
- Support recovers an uncertain purchase without a duplicate charge, and operations can detect a stalled worker before parents discover missing access.
- Native purchase release includes device sandbox purchase, restore, renewal, refund, cancellation, account recovery and cross-device entitlement tests. Passing web tests does not satisfy native acceptance.

Each supported route requires recorded acceptance evidence and an operational owner. A passing ledger test, approved product application, successful hosted checkout, or attractive screenshot alone is not completion of the family experience.
