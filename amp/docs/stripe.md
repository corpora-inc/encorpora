# Annual web subscriptions

AMP's optional Stripe adapter sells one annual license for one learner. It uses hosted Checkout for card entry and the hosted customer portal for payment details and cancellation. Billing is disabled by default. Native in-app purchases and ESA funding use separate purchase channels; this adapter does not implement them.

The parent web UI must call `POST /api/v1/billing/checkout` with an authenticated parent token and `{learnerId, requestId}`. `requestId` is a UUID retained across retries of the same purchase. The returned URL opens hosted Checkout. Prices, customer IDs, redirects and subscription metadata are chosen by the server. The return page says payment is processing until the existing entitlement endpoint reports access. A successful browser redirect is not proof of payment.

`POST /api/v1/billing/portal` accepts an empty body and returns a hosted portal URL for the authenticated parent's stored customer. It remains accessible after consent withdrawal so a parent can cancel renewal. Cancellation takes effect at the end of the paid term. Failed renewal payments create no new license and do not revoke an already paid term.

## Merchant configuration

Install dependencies with `npm ci`, apply migrations with `npm run db:migrate`, and configure the commented `AMP_STRIPE_*` settings in `.env.example` through the deployment's secret manager. Do not put credentials in source control, browser environment variables or support tickets.

Use a dedicated Stripe annual product and a single active price: recurring yearly, interval count one, licensed quantity one, fixed minor-unit amount and currency. Configure the customer portal to allow cancellation **at period end** and disable subscription updates. The adapter verifies the merchant account, mode, catalog and portal configuration before creating Checkout. The amount shown in fixtures is test data, not AMP pricing.

Set `AMP_STRIPE_AUTOMATIC_TAX` explicitly. Invoice subtotal must match the configured price, while the settled total may include tax. Discounts, credits, prorations, trials, mixed payments, multiple invoice lines and catalog changes require a separate reviewed adapter policy; they are rejected for reconciliation. Use the exact configured price for renewals. Do not archive or change mappings without migrating existing subscription reconciliation.

The SDK is pinned to Stripe 23 and API version `2026-09-30.endive`. Configure a webhook endpoint for `invoice.paid`, `charge.refunded`, `refund.created` and `refund.updated` at `/api/v1/billing/stripe/webhook`. Connect events and wrong-mode events are rejected. The exact raw JSON body is verified with the endpoint secret and a five-minute timestamp tolerance. The endpoint stores only routing identifiers, a payload hash and delivery metadata, then acknowledges; full invoice snapshots and payment details are not retained.

Live mode requires `AMP_STRIPE_LIVE_APPROVED=true`, a live key and all explicit merchant settings. Development authentication cannot enable live billing. This switch is an operational guard, not evidence that public-launch privacy, customer support, tax or payment onboarding requirements are complete. No test in this repository makes a real charge.

## Delivery and reconciliation

Run `npm run billing:worker` from a scheduler at least once per minute with the same database and billing configuration as the API. Each invocation processes at most `AMP_STRIPE_WORKER_BATCH` events (default 20, maximum 100) and exits. SDK calls have ten-second timeouts and one network retry. Configure worker process time limits for this bounded workload. The worker CLI owns a four-connection pool and processes one event at a time; a pass refuses a pool with fewer than two connections or another active pass using the same pool. One connection holds the account/invoice locks while a second performs durable evidence or commerce writes. Run workers as separate processes with separate pools, not as parallel tasks inside the API pool.

The database inbox supports concurrent workers with five-minute leases. Failures use exponential backoff capped at one hour and move to `review` after ten attempts. Monitor pending age, processing leases, `review` count and worker failures. An HTTP 200 from the webhook means durable receipt, not completed fulfillment. Provider or database failures must not silently disappear into a log.

A worker retrieves the invoice, its paid InvoicePayment, successful PaymentIntent, captured Charge and successful refunds. It verifies the invoice's annual line and the original Checkout-to-subscription-to-customer binding before writing commerce events. Each invoice has one stable order identity; renewal invoices create distinct annual grants. Duplicate and out-of-order delivery cannot extend the term. Full successful refunds revoke that invoice's grant; the audit timestamp is the latest successful refund record's creation time, floored at invoice payment time (Stripe does not expose a distinct refund-success instant). pending refunds do not. If a refund is observed before payment delivery, the invoice never activates a grant. Partial successful refunds are recorded in `amp_stripe_invoice_evidence.partial_refund` for financial review and preserve access.

Review unresolved events by namespace and event ID using the Stripe Dashboard and internal database access. After correcting the underlying issue, an authorized operator may reset the reviewed inbox row to `pending`, clear its lease and reset attempts with an audit record. Do not invent replacement payment evidence or bypass a mapping failure. Refunds are initiated by authorized merchant staff in Stripe; this API does not expose a customer refund command.

Customer and checkout reservations are durable before remote calls. Remote creation uses stable Stripe idempotency keys. Unresolved creation older than 23 hours fails closed because Stripe may prune older idempotency keys. Reconcile the remote object before repairing its local mapping. An expired Checkout session is closed locally and returns `checkout_expired_retry_with_new_request`; the next explicit purchase needs a fresh request UUID. A completed subscription prevents duplicate purchase. Starting a replacement subscription after cancellation requires support reconciliation of the old binding; automatic replacement is not implemented.

Checkout holds a shared account advisory lock and checks current consent and learner ownership inside the transaction. Privacy withdrawal/deletion must acquire the matching exclusive `pg_advisory_xact_lock(hashtextextended(accountId,0))` before learner locks. Financial bindings intentionally do not cascade with learner deletion. Deletion must preserve the ability to cancel renewal and reconcile payments; the parent lifecycle service must block or resolve active subscriptions before deleting learners.

## Verification

Run `npm test`, `npm run tsc`, and `npm run build`. Set `AMP_TEST_DATABASE_URL` to a disposable development PostgreSQL database and run `npm run test:db`. Integration tests create and remove randomly named schemas, leaving public tables intact. Stripe fixtures are synthetic; tests cover signature tampering, old signatures, account/mode mismatches, annual mapping failures, concurrent purchase retries, withdrawal, durable worker retry, duplicate invoices and refund-before-payment ordering.

Before enabling actual test-mode Checkout for parents, run an operator-owned Stripe sandbox smoke test with the configured merchant product, tax settings, portal and webhook endpoint. Confirm payment, renewal, cancellation, failed renewal and full refund in the ledger and entitlement view. Repository fixtures verify code behavior; they do not establish that a merchant's Stripe Dashboard configuration is correct.

Official references: [webhook signatures and delivery](https://docs.stripe.com/webhooks), [subscription events](https://docs.stripe.com/billing/subscriptions/webhooks), [Checkout sessions](https://docs.stripe.com/api/checkout/sessions/create), [InvoicePayments](https://docs.stripe.com/api/invoice-payment/object), and [customer portal](https://docs.stripe.com/customer-management).

Commerce imports use indexed per-order storage. Stripe passes its transaction client into the importer, so invoice binding and order/event/grant effects commit together without nested account-lock connections. Measured reconciliation throughput, database capacity and bounded worker concurrency are required before a large rollout.
