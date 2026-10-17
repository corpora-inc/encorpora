# Commerce ledger

The commerce module is a deterministic, in-memory state-transition library for
one-student, fixed-term curriculum licenses. It models Stripe, Apple, Google,
ESA, and free pilot orders. The pure ledger makes no network calls. A PostgreSQL adapter and local
admin import CLI persist normalized events and project license grants. No payment
provider, webhook-verification, marketplace or tax integration is implemented.

`contracts.ts` exports the TypeScript interfaces. `ledger.ts` exports
`emptyCommerceState()`, `reduceCommerce(state, event)`, `activeGrants(state,
accountId, learnerId, at)` and `CommerceError`. Inputs must be trusted,
authenticated, authorized, normalized events. Runtime checks defend transition
invariants; these interfaces are not an untrusted-JSON parsing schema.

## Events and independent states

An order identifies its parent account, learner, SKU, fixed start/end timestamps,
channel, channel reference, external order ID, ISO-style uppercase currency code,
and nonnegative safe-integer minor-unit amount. Currency validation checks format,
not whether an issuer recognizes that currency or its minor-unit precision.
The channel reference identifies the merchant, store or ESA program; it must not
contain secrets. Validate learner ownership against the server's account records
before accepting an event; matching account IDs in the payload is insufficient.

| Event | Effect |
| --- | --- |
| `order.created` | Records a pending order; creates no access grant. |
| `order.approved` / `order.rejected` | Records the independent approval decision once. |
| `order.fulfilled` | Records delivery after approval; creates no access grant. |
| `order.settled` | Records the complete order payment independently of delivery and approval. |
| `license.activated` | Issues one fixed-term grant if its activation gates pass. |
| `refund.requested` | Records a full-refund request without revoking issued access. |
| `refund.completed` | Records a full refund and revokes the order's grant. |
| `license.revoked` | Blocks activation and revokes issued access independently of refund. |

All noncreation events require a nonempty evidence reference. Keep sensitive
provider evidence in a controlled store and reference it here. The ledger stores
an evidence history and canonical event payloads, so do not put credentials,
full card details or unnecessary student information into event bodies.

Paid orders have positive amounts. Pilot orders have zero amounts, cannot settle,
and should use `after-approval`. A settled amount represents the complete order
amount, not the processor's net payout after fees. Record fees/payout reconciliation
separately. A settlement can be recorded before approval or delivery because
money received and access authorization are different facts.

`after-settlement` requires approval, delivery, settlement, no refund request or
completion, and no revocation before activation. `after-approval` allows activation
without settlement for ESA and pilot orders only. This is an explicit business
credit decision; ESA eligibility or vendor approval is not established by this
setting. Staff must select it only when the actual program agreement authorizes
delivery against an accepted order. Paid consumer channels cannot use this policy.

License starts are inclusive and ends exclusive. Activation may precede a future
start, but cannot occur at or after expiration. Access also requires the grant to
have been issued. `activeGrants` scopes results to both parent and learner. It can
answer historical queries: a revoked grant counts before its revocation instant
and never at or afterward. Renewal uses a new external order/transaction identity
and a new fixed term; it does not silently extend the existing grant.

A refund can complete without a preceding local request, supporting externally
initiated refunds. Full refunds require prior settlement. Partial refunds,
chargeback accounting, refund reversals, rejection reversals, grant reinstatement,
partial fulfillment, multi-student bundles, proration and recurring scheduling
are unsupported. Send such cases to reconciliation rather than coercing them into
a supported event. An unpaid ESA order can be revoked without inventing a refund.

## Replay, persistence and adapters

Events are unique by channel, channel reference and event ID. Replaying an exact
canonical payload returns the existing state object. Reusing that identity with
any changed payload fails. Canonicalization ignores JSON object property order,
but preserves array order and requires JSON-safe values. Distinct events cannot
recreate the same channel/reference/external-order identity or issue a second
grant for an order. These checks apply within the supplied state; persistence
must enforce them across all concurrent requests.

Process events in accepted per-order chronological order. Canonical UTC ISO
strings such as `2026-10-16T12:00:00.000Z` are required; equal timestamps are
permitted and append order resolves ties. A new event older than the last accepted
event fails and must be reconciled. Exact retries bypass this ordering check.
Provider notifications often arrive out of order: an adapter must retrieve and
verify authoritative state or queue reconciliation rather than change a signed
provider timestamp just to pass this check. Persist the original notification
separately from the normalized event and record their linkage.

A server integration must:

1. Authenticate provider callbacks or authorized staff actions, verify signatures
   and ownership, and normalize the actual provider contract into these events.
   Never expose a client endpoint that trusts a caller's settlement assertion.
2. Load the relevant complete ledger state under a serializable transaction or
   an equivalent lock plus unique constraints. Reduce and persist the event,
   order, grant and evidence changes atomically. Failed transitions must not
   consume the event ID. Preserve event history for replay and reconciliation.
3. Enforce uniqueness of source event identity and channel/reference/external-order
   identity in the database. The grant projection must retain `channelReference`;
   channel plus external order alone is insufficient across ESA programs or stores.
4. Use delivery evidence for fulfillment and a separate explicit activation event.
   Reconcile external payments against local orders; distinguish pending approval,
   accepted order, funds reserved, settled order amount and processor payout.
5. Project grants for authorization using server time with inclusive start/exclusive
   end and revocation checks. Apply refund/revocation updates in the same transaction
   as the corresponding ledger event. Authenticate access to downloaded content
   according to the product's licensed retention/offline policy.

The current in-memory reducer scans arrays and retains full canonical payloads;
it is a correctness foundation, not a million-order storage engine. Persistence
should index identities and load the necessary records without weakening global
uniqueness or audit history. No provider integration is operational merely because
a channel name is represented in the union.

## PostgreSQL adapter and administrator import

Apply migrations `0001.sql` and `0002-commerce.sql` before import.
`applyCommerceEvent(pool, input)` validates untrusted JSON with the exported
`commerceEventSchema`/`parseCommerceEvent`, locks the single ledger row, verifies
the learner belongs to the purchasing account, reduces the event, and atomically
persists ledger history and grant projection. The event table rejects row updates
and deletes. New future-dated events are rejected for reconciliation.

The global lock serializes imports; this is an initial administrative workflow,
not a high-volume webhook service. PostgreSQL credentials grant administrative
authority: protect them and never expose this function as a public unauthenticated
endpoint. Strict schema validation does not authenticate a payment.

Run `tsx scripts/commerce-event.ts EVENT.json` with `AMP_DATABASE_URL` set in the
process environment. There is no default database. The CLI accepts one regular
JSON file of at most 64 KiB and prints the resulting order states. Failures print
a generic rejection without database connection details or student data. It does
not contact a payment processor, apply for a marketplace, or send email.

Projected grant IDs use `commerce:<orderId>`. The existing grant table's
`external_order_id` contains JSON encoding of `[channelReference, externalOrderId]`
to preserve source uniqueness without a change to migration 0001. The projection's
start time is the later of contractual start and actual grant issuance, preventing
access before activation. Revocations and completed full refunds update the grant
in the same transaction. The original term and evidence remain in the ledger.

Integration tests require `AMP_TEST_DATABASE_URL`; without it, database tests skip
and schema-boundary tests run. Tests create and remove a fresh random PostgreSQL
schema, exercise concurrent replay, ownership rejection, source collisions, fixed
term projection, refund/revocation, event immutability and transaction rollback.
They never use `AMP_DATABASE_URL` or a default production connection.
