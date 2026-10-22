# Ad click evidence and purchase attribution

The internal click-evidence repository stores acquisition identifiers separately
from learner activity and binds each provider's last observed click before an
owned invoice or checkout was created. A binding does not establish payment,
permission to share information, or platform attribution.

`retainAdClick` accepts Google `gclid`, `gbraid` and `wbraid`, or Meta `fbclid`,
`fbc` and `fbp`. Values are case-sensitive and are not hashed for provider
matching. The repository records the server observation time and the fixed
Arkansas marketing-page address. It rejects arbitrary URLs, learner fields,
empty identifiers, future Meta cookie times and mixed-provider payloads.

The opaque browser handle is a random 256-bit value; only its SHA-256 digest is
stored. Each journey retains at most 100 distinct evidence records for at most
90 days (2,160 hours). Exact reloads preserve the first observation. Additional
cookie evidence retains its capture time without refreshing the click's first
observation. A capture using an
already account-bound handle receives a new anonymous handle, so another
person using the browser cannot append activity to the first parent's account.
An identical click supplied with that handle preserves its original time through
rotation, without copying the parent binding or unrelated click history.

`bindAdClicksToOrder` verifies the authenticated account owns the funding request
or Stripe checkout. A journey can bind to only one parent account. Each order
has one immutable binding per provider; later visits, retries and account
changes cannot replace it. History remains available separately from the
selected click. Database sequence order resolves observations in the same
millisecond. Clicks observed after order creation cannot be backfilled.

`orderClickEvidence` resolves identifiers through the owned order. Meta `fbc`
uses a matching captured cookie or the actual `fbclid` and original observation
time. A matching cookie dated after the first observation is bounded to that
observation. It never uses the settlement time as the click time and never fabricates
`fbp`. A captured click supersedes a cookie referring to a different click.

Expiry deletes raw evidence and leaves null order bindings, preventing later
visits from refilling old attribution. `purgeAdClickEvidence` removes at most
200 expired journeys per call. `eraseAccountAdClicks` removes a selected
provider's evidence, or all evidence, for a parent while preserving those
empty bindings.

## Integration requirements

Apply `0036-ad-click-evidence.sql` before using these repository functions.
Callers own the transaction; binding and account erasure require the exclusive
account privacy lock used by the existing purchase and permission workers.
Collection callers must enforce the permitted source, disclosures, applicable
consent, opt-outs, body/rate limits and server time. Never log handles or provider
identifiers, expose them in ordinary product UI, or forward them to learner URLs.

This module has no browser collector, registered HTTP route, scheduled retention
worker or provider sender. It does not change the deployed purchase-measurement
notices. Connecting it requires the landing/purchase integration, privacy
withdrawal/export/retention wiring, and Google/Meta dispatcher changes. Existing
Google and Meta dispatchers do not consume these records. The Meta dispatcher
does not support DirectPay purchases.

A complete delivery path must verify payment separately, use current
provider-specific permission covering the identifiers, and preserve the
payment's real event time, value, currency and deduplication identity. Invoice
creation is not a purchase. Provider upload windows and ad-attribution windows
are separate: a valid delayed DirectPay sale may fall outside the original
click's attribution window. Provider acceptance is not proof of attribution.

## Verification

`tests/click-evidence.integration.ts` exercises actual PostgreSQL persistence,
owned funding/checkout bindings, exact replay, cross-account rejection and
expiry tombstones. `tests/click-identifiers.test.ts` checks exact identifier
preservation, Meta click-time construction and rejection of unrelated fields.
These tests do not contact advertising or payment providers.

Provider field references: [Google Data Manager ad identifiers](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#AdIdentifiers)
and [Meta's official server-side user-data implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/user-data.js).
