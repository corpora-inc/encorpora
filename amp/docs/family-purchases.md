# Parent purchase workspace

Family → Access opens two purchase routes: an annual card subscription and education-fund purchase requests. These screens are parent account settings; learners receive no payment prompts during practice. Each screen has a Back action that returns to Access and restores keyboard focus to its entry button.

Annual pricing and terms come from the configured server offer. Disabled billing shows that no payment can be taken. A sandbox offer is visibly labeled. Checkout completion does not activate learning: the app checks the owned purchase and waits for webhook-verified access. Refunds and renewal management follow the [Stripe integration](stripe.md).

Education-fund purchasing lists only explicitly configured offers. An absent `AMP_FUNDING_OFFERS_FILE` produces an empty list, not an implied approval. Configure a trusted private JSON file according to [funded purchases](funded-purchases.md), apply all database migrations, and restart the API. Parent-reported submission does not grant access. Verified consent is required for new requests, including local development.

## Returning from checkout

The app accepts only `processing`, `canceled`, or `account` return reasons. Purchase returns require an opaque UUID; it grants no authority. The app removes those parameters from the address bar while preserving unrelated parameters and fragments, including identity callback data.

A navigation record containing only the return reason, purchase UUID and expiry is held in session storage for up to fifteen minutes so sign-in can finish. It contains no learner identity, payment outcome or credentials. The authenticated server verifies ownership before opening the purchase view. The record is consumed after that lookup and cleared on account changes. Expired or malformed records cannot open a purchase screen. Failed ownership checks direct the parent to Access without selecting another learner's purchase.

A same-parent token renewal preserves the current workspace. Changing accounts closes it and invalidates pending responses. Closing a purchase refreshes family metadata; learning access continues to be enforced on every server request.

## Verification

`npm run test:purchase-app-ui` exercises the actual app with a controlled identity adapter and intercepted API responses. It checks parent entry and return focus, unavailable providers, owned checkout returns, same-parent token renewal and delayed account-switch responses at phone and landscape sizes. The fixture makes no live charges. The separate annual, funded-purchase and database suites verify provider workflows and ledger behavior.

Hosted release requires configured identity, verified consent, privacy/support operations and reviewed provider agreements. Mounting these workspaces does not enable a merchant account or confer program approval.

Family Access shows recorded learner access before the separate purchase chooser. Multiple learner cards use a bounded scrolling list; at small phone sizes later cards require scrolling. The chooser and annual purchase action fit ordinary phone viewports. Enlarged text can use the workspace's bounded scrolling region rather than clipping content.
