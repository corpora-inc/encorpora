# Ad click evidence and purchase attribution

The Arkansas marketing page captures acquisition identifiers separately
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
time. Valid matching cookies are preserved verbatim, including when cookie
creation follows the first server observation. It never uses the settlement time as the click time and never fabricates
`fbp`. A captured click supersedes a cookie referring to a different click.

Expiry deletes raw evidence and leaves null order bindings, preventing later
visits from refilling old attribution. `purgeAdClickEvidence` removes at most
200 expired journeys per call. `eraseAccountAdClicks` removes a selected
provider's evidence, or all evidence, for a parent while preserving those
empty bindings.

## Collection and purchase binding

The production Arkansas page loads `acquisition-client.js`. It sends actual
Google click IDs and an actual Meta click ID with any existing Meta cookies to
`POST /api/v1/advertising/acquisition`. Only allowlisted campaign labels accompany
the IDs. The page removes click parameters from its address and never adds them
to assessment or learner links. Ordinary visits without a click ID do not create
an acquisition record.

The API registers this route when `AMP_CAMPAIGN_SITE_ORIGIN` is
`https://corpora.inc`. Credentialed CORS accepts only that origin; body size,
provider count, request rate and concurrent work are bounded. The response has
no identifier payload. A Secure, HttpOnly, SameSite=Lax, host-only cookie on the
AMP API origin contains the opaque reference. It survives navigation and
sign-in on that device without application JavaScript reading it. No shared
parent-domain cookie or third-party pixel is installed.

Funding-request creation and both Stripe checkout paths read that cookie and
bind eligible evidence before returning the purchase response. Binding verifies
ownership under the exclusive account privacy lock. Invalid, missing or expired
handles do not block purchasing. A failed binding logs only a fixed diagnostic;
no handle, provider identifier or request body enters that log.

Global Privacy Control and Do Not Track stop collection and clear the cookie.
On authenticated requests they also invoke existing permission withdrawal.
Provider withdrawal deletes the associated evidence and prevents binding new
evidence for that provider until the preference changes. Learning withdrawal
and deletion erase both providers' associated evidence. Family exports include
owned acquisition records, but never the cookie or its digest. The existing
privacy-retention command drains expired journeys in transactions of at most 200.
It reports failure if expired records remain after its work budget. A separate
minimal provider opt-out setting survives expiry of permission audit evidence;
an explicit grant clears that setting.

Apply `0036-ad-click-evidence.sql` before using the route or repository. Internal
callers own their transactions; binding and account erasure require the account
privacy lock. The repository does not itself authorize external disclosure.

## Provider delivery

Google and Meta dispatchers resolve saved identifiers through the exact owned
checkout or funding request after independently verifying payment and current
permission. Google receives unmodified `gclid`, `gbraid` or `wbraid`; Meta receives
actual `fbc` and any captured `fbp`. Evidence observed after the payment is not
attached. Missing evidence leaves the permitted adult-email matching path
available; no identifier is fabricated.

The Google v3 and Meta v2 notices disclose these fields. Older grants cannot
authorize the expanded payload. Both workers default off and require configured
financial sources and destinations. Meta supports verified Arkansas funded
settlements as well as eligible Stripe enrollment confirmations. Funded events
represent administrative settlements, using their actual timestamp with `other`
source and no invented browser URL or user agent. They do not describe the
parent's original ClassWallet browser action. See the provider-specific guides
for eligibility, delivery outcomes and refund limitations.

The delivery path verifies payment separately, uses current
provider-specific permission covering the identifiers, and preserves the
payment's real event time, value, currency and deduplication identity. Invoice
creation is not a purchase. Provider upload windows and ad-attribution windows
are separate: a valid delayed DirectPay sale may fall outside the original
click's attribution window. Provider acceptance is not proof of attribution.

## Verification

`tests/click-evidence.integration.ts` exercises actual PostgreSQL persistence,
owned funding/checkout bindings, exact replay, cross-account rejection and
expiry tombstones. `tests/click-identifiers.test.ts` checks exact identifier
preservation, Meta click-time construction and rejection of unrelated fields.
`tests/acquisition.integration.ts` exercises the registered collection endpoint,
the actual funding-request route, privacy export, withdrawal and scheduled
retention. `scripts/verify-acquisition-ui.ts` verifies a real Chromium browser's
cross-origin cookie handling, clean address, purchase binding and privacy
clearing; every browser request is intercepted locally. These tests do not
contact advertising or payment providers.

Provider field references: [Google Data Manager ad identifiers](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#AdIdentifiers)
and [Meta's official server-side user-data implementation](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/src/objects/serverside/user-data.js).
