# Phase 3 — Affiliate/Discount Codes Backend — FROZEN CONTRACT

Status: **FROZEN v1.0** · 2026-06-14 · Owner: architecture lead

> **This is the single source of truth that parallel builder teams (WS-A..WS-E)
> implement against.** It crystallizes `AFFILIATE_CODES_PLAN.md` (APPROVED) into
> exact, buildable interfaces — JSON wire formats, signing claims, DynamoDB
> PK/SK strings, ledger writes, the seed file, and a file-ownership map. Where
> the plan left a gap, this contract closes it; the closure is flagged
> `[FROZEN DECISION]`. **Do not diverge.** Changes go through the lead and bump
> the `registryVersion` / contract version.

> **Cited plan sections** are noted inline as `(plan §X)`.

---

## 0. Invariants (non-negotiable — every workstream)

1. **Discounts are PLATFORM OFFERS, never backend price overrides.** (plan §3.6,
   §2.2) Apple = native custom **offer codes** redeemed via the StoreKit sheet;
   Google = per-code subscription **offers** (`relativeDiscount: 0.7`,
   `offerTags: ["code-<x>"]`) applied via `offerToken`. The backend only
   *confirms* the offer applied (from the receipt) and *attributes* it.
2. **No fail-open, ever.** (plan §1.1, §4.1, App.10) Unknown/error from
   `/code/resolve` returns an explicit status — never `"ok"`. The client
   `resolveAffiliateCode` fail-open (purchase.ts L854-874) is deleted.
3. **Server-authoritative.** (plan §7) The open-source client requests; the
   server decides eligibility, attribution, and entitlement from platform
   receipts + the registry. Never trust a client `plus`/`partnerId` claim.
4. **`resolutionToken` gates every attribution write.** (plan §2.2, §7) A purchase
   cannot be attributed to a partner without a valid, unexpired, subject-bound
   token issued by `/code/resolve`.
5. **Idempotent, conditional writes.** (plan §3.3) Replayed `transactionId` →
   no double ledger credit.
6. **First-verified-touch attribution lock.** (plan §3.4) The first *verified*
   (registry) code locked to a subject wins; later codes never change a verified
   partner. `unverified` may upgrade to `verified` once, never downgrade.
7. **Promo codes are NOT used** (no attribution signal). Apple = custom offer
   codes only; Google = subscription offers + (deferred) free-trial promo.

---

## 1. Environment & shared constants

| Constant | Value |
|---|---|
| API base (prod) | `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod` (purchase.ts L767) |
| Region | `us-east-2` |
| Secret | `corpan/content-packs/verify` (Secrets Manager). Keys: `apple`, `google`, `cloudfront`, `appStoreConnect`. **WS-A ADDS** `codeSigning.hmacKey` (see §3). |
| DynamoDB table | `corpan-iap` (PAY_PER_REQUEST, PITR on) — **new**, WS-A |
| Lambda | existing `corpan-verify-purchase` extended (no new Lambda) — routes by `event.routeKey` |
| Code normalization | `raw.trim().toUpperCase().replace(/\s+/g,"")`; valid `^[A-Z0-9_-]{1,32}$` (purchase.ts L156-162) |

`<NORMALIZED>` everywhere below = the normalized code (e.g. `IAN30`).

---

## 2. Route 1 — `POST /code/resolve` (NEW · WS-A route, WS-B handler)

Replaces the dead client call to `/affiliate/resolve` (plan §4.1). Client sends the
raw code; the server is the only classifier (plan §2.1-§2.2).

### 2.1 Request
```jsonc
{
  "code": "IAN30",                  // raw; server normalizes
  "subjectId": "8f1c…-uuid",        // anon UUID (purchase.ts getCorpanSubjectId)
  "platform": "ios | android",      // "macos" maps to "ios" branch
  "productId": "corpan.sub.annual"  // optional; lets server pick the offer
}
```

### 2.2 Classification (`classification` field) — `[FROZEN DECISION]`
The contract uses the FOUR classes the task mandates (the plan's longer `kind`
list collapses into these; `purchaseAction` carries the platform mechanic):

| `classification` | meaning |
|---|---|
| `discount` | platform offer, no revenue share (registry `revenueSharePct == 0`) |
| `affiliate` | revenue-share partner, no discount |
| `discount+affiliate` | both (the IAN30…/`LCCLT` case) |
| `unknown` | not in registry → unverified free-text tracking |

`purchaseAction` enum (drives the client CTA):

| `purchaseAction` | when |
|---|---|
| `REDEEM_APPLE_SHEET` | Apple, code maps to an `appleOfferIdentifier` |
| `USE_OFFER_TOKEN` | Android, code maps to a `googleOfferId` |
| `ATTRIBUTE_ONLY` | registry affiliate, no platform offer this platform |
| `ATTRIBUTE_UNVERIFIED` | `classification == unknown` |

### 2.3 Response — exact JSON per branch

**Common success envelope** (all `status:"ok"` branches):
```jsonc
{
  "status": "ok",
  "code": "IAN30",
  "classification": "discount+affiliate",
  "purchaseAction": "REDEEM_APPLE_SHEET",
  "partnerName": "Ian",                       // null when classification == discount/unknown
  "discountLabel": "30% off your first year", // localized server-side; null if no discount
  "offerId": null,                            // see per-branch
  "offerTokenHint": null,                     // see per-branch
  "appleOfferId": null,                       // see per-branch
  "resolutionToken": "<JWT-HS256, §3>",
  "expiresInSec": 900
}
```

**Branch A — Apple, `discount+affiliate` → `REDEEM_APPLE_SHEET`** (platform=ios):
```jsonc
{
  "status": "ok", "code": "IAN30",
  "classification": "discount+affiliate",
  "purchaseAction": "REDEEM_APPLE_SHEET",
  "partnerName": "Ian",
  "discountLabel": "30% off your first year",
  "appleOfferId": "IAN30",                    // = registry appleOfferIdentifier
  "appleRedeemUrl": "https://apps.apple.com/redeem?ctx=offercode&id=<asc-offer-id>&code=IAN30", // <iOS16 fallback
  "offerId": null, "offerTokenHint": null,
  "resolutionToken": "…", "expiresInSec": 900
}
```

**Branch B — Android, `discount+affiliate` → `USE_OFFER_TOKEN`** (platform=android):
```jsonc
{
  "status": "ok", "code": "IAN30",
  "classification": "discount+affiliate",
  "purchaseAction": "USE_OFFER_TOKEN",
  "partnerName": "Ian",
  "discountLabel": "30% off your first year",
  "offerId": "code-ian30",                    // = registry googleOfferId; client re-reads
  "offerTokenHint": { "googleOfferId": "code-ian30", "basePlanId": "annual", "offerTags": ["code-ian30"] },
  "appleOfferId": null,
  "resolutionToken": "…", "expiresInSec": 900
}
```
> The client re-reads the live `offerToken` from `getProducts()` by matching
> `subscriptionOfferDetails[].offerId == "code-ian30"` (offer tokens are session-
> bound, never returned by the backend). (plan §4.1 note)

**Branch C — `affiliate` (no discount) → `ATTRIBUTE_ONLY`** (either platform):
```jsonc
{
  "status": "ok", "code": "FRIENDS",
  "classification": "affiliate",
  "purchaseAction": "ATTRIBUTE_ONLY",
  "partnerName": "Acme Club",
  "discountLabel": null,
  "offerId": null, "offerTokenHint": null, "appleOfferId": null,
  "resolutionToken": "…", "expiresInSec": 900
}
```

**Branch D — `unknown` → `ATTRIBUTE_UNVERIFIED`** (still issues a token so the
same write path runs; ledger row marked `unverified`, no payout) (plan §2.2[F]):
```jsonc
{
  "status": "ok", "code": "FOO",
  "classification": "unknown",
  "purchaseAction": "ATTRIBUTE_UNVERIFIED",
  "partnerName": null, "discountLabel": null,
  "offerId": null, "offerTokenHint": null, "appleOfferId": null,
  "resolutionToken": "…", "expiresInSec": 900
}
```

**Error — NO fail-open** (registry read error / signer error / bad input):
```jsonc
{ "status": "error", "error": "code check failed" }   // HTTP 502/400
```
HTTP: 200 for every `status:"ok"`; **400** bad input (missing/format-invalid code,
missing subjectId/platform); **502** backend/registry/signer failure. The client
shows "Couldn't check — Retry"; it may proceed only after explicit user confirm,
treated as `ATTRIBUTE_UNVERIFIED` (plan §4.1, §5.2). **Never** surface `error`
as `ok`.

### 2.4 Server logic (WS-B)
1. Normalize + format-gate (`400` if invalid).
2. `GetItem PK=CODE#<NORMALIZED> SK=META`.
3. Miss or `active=false` → `classification:"unknown"`, `ATTRIBUTE_UNVERIFIED`.
4. Hit → derive `classification` from `revenueSharePct>0` and presence of
   `appleOfferIdentifier`/`googleOfferId`; pick `purchaseAction` by `platform`
   + offer presence; localize `discountLabel` from `discountLabelKey` (Accept-
   Language header → fall back English).
5. Mint `resolutionToken` (§3). On any throw → `502 status:"error"`.
6. Rate-limit per `subjectId` + source IP (token-bucket, e.g. 20/min) to blunt
   enumeration (plan §7). Over limit → `429 {status:"error"}`.

---

## 3. `resolutionToken` — signing + validation (WS-B; secret key WS-A)

`[FROZEN DECISION]` **HMAC (JWT HS256)**, not KMS — lower latency/cost, no new
IAM, key lives in the existing secret. WS-A adds to `corpan/content-packs/verify`:
```jsonc
"codeSigning": { "hmacKey": "<32+ byte base64 random>", "kid": "v1" }
```

JWT header `{ "alg":"HS256", "typ":"JWT", "kid":"v1" }`. Claims:
```jsonc
{
  "v": 1,
  "iss": "corpan-codes",
  "sub": "8f1c…-uuid",          // subjectId — token is bound to this subject
  "code": "IAN30",              // NORMALIZED
  "partnerId": "ian",           // null for classification == unknown
  "classification": "discount+affiliate",
  "purchaseAction": "REDEEM_APPLE_SHEET",
  "appleOfferId": "IAN30",      // echo for verify cross-check (null if n/a)
  "googleOfferId": "code-ian30",// echo (null if n/a)
  "registryVersion": 3,         // CODE#…/META registryVersion at resolve time
  "iat": 1750000000,
  "exp": 1750000900             // iat + 900s  (≈15 min)
}
```

**`/verify-purchase` validation (WS-B), all must pass or attribution is skipped
(purchase still verifies — attribution is best-effort, never blocks entitlement,
plan §1.1):**
- HS256 signature with `codeSigning.hmacKey` (by `kid`).
- `exp` in the future, `iss == "corpan-codes"`, `v == 1`.
- `sub == body.subjectId`.
- `code == normalize(body.affiliateCode)` (if `affiliateCode` present).

A missing/invalid token ⇒ no attribution write, `affiliateAttribution` omitted.

---

## 4. Route 2 — `POST /entitlement-token` (NEW · WS-A route, WS-B handler)

Client plumbing already exists (purchase.ts L877; store L97) — the route 404s
today (plan §1.1, §4.3).

### 4.1 Request
```jsonc
{ "subjectId": "8f1c…-uuid" }
```
### 4.2 Response
```jsonc
{
  "status": "ok",                 // or "failed"
  "subjectId": "8f1c…-uuid",
  "plus": true,
  "expiresAt": "2026-06-15T00:00:00.000Z",
  "entitlementToken": "<JWT-HS256>"
}
```
Server: read latest entitlement for the subject (most recent non-expired
`SUBJECT#<id>/PURCHASE#…` with `subscriptionActive`, or notification-derived
state). Mint a JWT (same `codeSigning.hmacKey`, **separate `iss:"corpan-ent"`**,
**~24h exp**) with claims `{ iss, sub, plus, expiresAt, iat, exp }`. No verified
purchase on file → `{ status:"failed", plus:false }` (HTTP 200). This is an
additive convenience; the CloudFront signed-URL gate remains the real boundary
(plan §3.5).

---

## 5. Route 3 — `POST /verify-purchase` ADDITIONS (extend existing · WS-B)

Existing behavior (verify receipt, sign CloudFront URL) is preserved. Add:

### 5.1 New request fields
```jsonc
{
  // …existing: platform, productId, transactionId, subjectId, receipt|purchaseToken, packId, downloadPath
  "affiliateCode": "IAN30",         // already sent (today dropped, plan §1.2)
  "resolutionToken": "<from /code/resolve>"   // NEW — required for any attribution write
}
```

### 5.2 Apple — capture from the decoded JWS (verify_purchase.js `tryVerifyAppleWith`
currently reads only productId/type/env/txn/originalTxn/expiresDate, L150-161):
ADD `appAccountToken`, `offerType`, `offerIdentifier`, `offerDiscountType`,
`price`, `currency`. (plan §1.2 gap 5, §4.2)
- `offerType == 3` (`OFFER_CODE`) + `offerIdentifier` ⇒ offer applied.
- `offerApplied = (offerType is set)`; confirm `offerIdentifier ==
  token.appleOfferId` for a *verified* discount credit.

### 5.3 Google — move `verifyGoogle` from `purchases.subscriptions.get` (v1,
L198) to **`purchases.subscriptionsv2.get`** (plan §1.2 gap 6, §4.2). Capture:
- `externalAccountIdentifiers.obfuscatedExternalAccountId` (= `sha256Hex(subjectId)`
  the client already sends, purchase.ts L571) — store it on the rows so renewals
  can reverse-map (plan §3.4).
- `lineItems[].offerDetails.offerId` + `lineItems[].offerDetails.offerTags[]`.
- `offerApplied = offerId present`; confirm `offerId == token.googleOfferId`.
- Derive `subscriptionActive` from v2 `lineItems[].expiryTime` + state (keep the
  grace-period logic). **Stop echoing the client `productId`** — use the
  line-item product (plan §3.3 cross-check).

### 5.4 Ledger writes (in order; all conditional)
1. **PURCHASE# idempotency** — `PutItem` `PK=SUBJECT#<subjectId>
   SK=PURCHASE#<platform>#<txnOrOriginalId>` with
   `ConditionExpression: attribute_not_exists(SK)`. On `ConditionalCheckFailed`
   ⇒ already processed; return prior result, **no further writes** (plan §3.3).
2. **ATTRIBUTION lock** (only if token valid + `partnerId` non-null OR unknown):
   `PutItem PK=SUBJECT#<subjectId> SK=ATTRIBUTION`
   `ConditionExpression: attribute_not_exists(SK) OR #status = :unverified`
   (so a verified lock never overwrites; an unverified lock upgrades once)
   (plan §3.4 first-verified-touch).
3. **LEDGER initial credit** (only when `status == verified`, i.e. registry code):
   `PutItem PK=LEDGER#<partnerId>#<yyyy-mm> SK=EVENT#<platform>#<txnId>`
   `kind:"initial"`, conditional `attribute_not_exists(SK)`.

### 5.5 Response additions (client type already declares these, purchase.ts L42-54)
```jsonc
{
  "status": "verified",
  "transactionId": "…", "productId": "…",
  "subscriptionActive": true, "expiresAt": "…",
  "subjectId": "8f1c…-uuid", "plus": true,
  "entitlementToken": "<JWT-HS256, §4>",
  "affiliateAttribution": {
    "code": "IAN30",
    "locked": true,
    "verified": true,            // false for unknown/unverified
    "partnerName": "Ian",
    "message": "Credited to Ian"
  }
}
```
Attribution failure is **non-fatal**: omit `affiliateAttribution`, still return
`status:"verified"` so entitlement is never blocked (plan §1.1).

---

## 6. Route 4 & 5 — Notification handlers (renewals · WS-B)

Both currently decode-and-`console.log` only (verify_purchase.js L387-440); they
become the renewal-credit path (plan §1.2 gap 7, §3.4, §6, §7).

### 6.1 `POST /apple-notifications` — ASSN V2
- **Verify the JWS signature** with `SignedDataVerifier` (already imported,
  verify_purchase.js L3; currently unused for notifications). Reject unverified.
- Decode `data.signedTransactionInfo`. On `DID_RENEW` (and `SUBSCRIBED`):
  read `appAccountToken` + `originalTransactionId` + renewal `transactionId`.
- **Offer fields are NOT on renewals** — do not expect them (plan §3.4 note).
- Look up `SUBJECT#<appAccountToken>/ATTRIBUTION`. If a `partnerId` lock exists,
  write `LEDGER#<partnerId>#<yyyy-mm> / EVENT#apple#<renewalTxnId>`
  `kind:"renewal"`, conditional `attribute_not_exists(SK)` (exactly-once across
  Apple retries). Return `200 {received:true}` always (so Apple stops retrying).

### 6.2 `POST /google-notifications` — RTDN
- **Validate the Pub/Sub push OIDC token** (Authorization bearer) before trust
  (plan §7). Reject otherwise.
- Decode `message.data`. On `subscriptionNotification.notificationType ==
  SUBSCRIPTION_RENEWED (2)`: call `subscriptionsv2.get(purchaseToken)` → read
  `obfuscatedExternalAccountId`.
- Reverse-map via the stored hash on ATTRIBUTION/PURCHASE rows
  (`obfHash == sha256Hex(subjectId)`) — query a GSI (§7.3) to find the subject
  without reversing the hash (plan §3.4). Found lock → write
  `LEDGER#<partnerId>#<yyyy-mm> / EVENT#android#<orderId>` `kind:"renewal"`,
  conditional. Return `200 {received:true}` always.

---

## 7. DynamoDB single-table `corpan-iap` (WS-A schema, WS-B access)

PAY_PER_REQUEST, PITR on. `PK`/`SK` String. `ttl` Number (epoch) where noted.

### 7.1 Item types (exact PK/SK strings + attributes)

| Item | PK | SK | Attributes |
|---|---|---|---|
| **Code registry** | `CODE#<NORMALIZED>` | `META` | `partnerId`(S), `classification`(S `discount\|affiliate\|discount+affiliate`), `appleOfferIdentifier`(S, null-ok), `googleOfferId`(S, null-ok), `googleOfferTags`(SS), `googleBasePlanId`(S), `discountLabelKey`(S), `discountLabelEn`(S), `revenueSharePct`(N), `active`(BOOL), `registryVersion`(N), `validFrom`(S ISO), `validTo`(S ISO null-ok) |
| **Attribution lock** | `SUBJECT#<subjectId>` | `ATTRIBUTION` | `code`(S), `partnerId`(S), `status`(S `verified\|unverified`), `lockedAt`(S ISO), `lockSource`(S `verify-purchase`), `obfHash`(S = sha256Hex(subjectId)), `appAccountToken`(S) |
| **Purchase (idempotency)** | `SUBJECT#<subjectId>` | `PURCHASE#<platform>#<txnOrOriginalId>` | `productId`(S), `code`(S null-ok), `partnerId`(S null-ok), `offerApplied`(BOOL), `offerType`(S/N null-ok), `offerIdentifier`(S null-ok), `price`(N null-ok), `currency`(S null-ok), `environment`(S), `obfHash`(S), `appAccountToken`(S null-ok), `verifiedAt`(S ISO) |
| **Ledger event** | `LEDGER#<partnerId>#<yyyy-mm>` | `EVENT#<platform>#<txnId>` | `subjectId`(S), `code`(S), `productId`(S), `price`(N null-ok), `currency`(S null-ok), `kind`(S `initial\|renewal`), `revenueSharePct`(N), `eventTime`(S ISO), `notificationType`(S null-ok) |
| **Partner** | `PARTNER#<partnerId>` | `META` | `name`(S), `payoutEmail`(S null-ok), `defaultRevenueSharePct`(N), `status`(S `active\|paused`) |

`<txnOrOriginalId>` = Apple `originalTransactionId`; Android `orderId`.
`<txnId>` (ledger) = the per-event txn (each renewal is unique on both platforms).
`<yyyy-mm>` from the event time (UTC).

### 7.2 Access patterns (all `GetItem`/`Query`, **no scans**)
- Resolve code → `GetItem CODE#<NORMALIZED>/META`.
- Idempotency / lock → `GetItem`/conditional `PutItem` on `SUBJECT#…`.
- Monthly payout export → `Query PK=LEDGER#<partnerId>#<yyyy-mm>`, sum `price*pct`.
- Renewal reverse-map (Google) → **GSI1** below.

### 7.3 `[FROZEN DECISION]` GSI1 (Google renewal reverse-map)
`GSI1PK = obfHash`, `GSI1SK = SK`. Project `partnerId, subjectId, status`.
Written on ATTRIBUTION + PURCHASE rows. RTDN handler queries
`GSI1 where GSI1PK = obfuscatedExternalAccountId` to find the locked subject
without reversing the hash (Apple uses `appAccountToken` directly as the PK, no
GSI needed).

---

## 8. Code-registry SEED (`infra/codes/seed.json`) — WS-A loads, WS-E owns Play

`[FROZEN DECISION]` All 8 live Apple codes are on the **annual** plan, attributed
via `offerType=OFFER_CODE` + `offerIdentifier=<UPPERCASE CODE>`. Google offers
named `code-<lowercase>` with `relativeDiscount: 0.7` (= 30% off) on base plan
`annual`, `offerTags:["code-<lowercase>"]`. `classification: "discount+affiliate"`,
`revenueSharePct: 0.30`, `discountLabel "30% off your first year"`.

Partner ids: `ian, sky, august, ac, flo, monica, dwalker, agus`.

```jsonc
// infra/codes/seed.json — DynamoDB BatchWrite source. partners[] → PARTNER#<id>/META, codes[] → CODE#<CODE>/META
{
  "registryVersion": 1,
  "partners": [
    { "partnerId": "ian",     "name": "Ian",     "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "sky",     "name": "Sky",     "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "august",  "name": "August",  "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "ac",      "name": "AC",      "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "flo",     "name": "Flo",     "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "monica",  "name": "Monica",  "defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "dwalker", "name": "D. Walker","defaultRevenueSharePct": 0.30, "status": "active" },
    { "partnerId": "agus",    "name": "Agus",    "defaultRevenueSharePct": 0.30, "status": "active" }
  ],
  "codes": [
    { "code": "IAN30",     "partnerId": "ian",     "classification": "discount+affiliate", "appleOfferIdentifier": "IAN30",     "googleOfferId": "code-ian30",     "googleOfferTags": ["code-ian30"],     "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "SKY30",     "partnerId": "sky",     "classification": "discount+affiliate", "appleOfferIdentifier": "SKY30",     "googleOfferId": "code-sky30",     "googleOfferTags": ["code-sky30"],     "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "AUGUST30",  "partnerId": "august",  "classification": "discount+affiliate", "appleOfferIdentifier": "AUGUST30",  "googleOfferId": "code-august30",  "googleOfferTags": ["code-august30"],  "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "AC30",      "partnerId": "ac",      "classification": "discount+affiliate", "appleOfferIdentifier": "AC30",      "googleOfferId": "code-ac30",      "googleOfferTags": ["code-ac30"],      "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "FLO30",     "partnerId": "flo",     "classification": "discount+affiliate", "appleOfferIdentifier": "FLO30",     "googleOfferId": "code-flo30",     "googleOfferTags": ["code-flo30"],     "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "MONICA30",  "partnerId": "monica",  "classification": "discount+affiliate", "appleOfferIdentifier": "MONICA30",  "googleOfferId": "code-monica30",  "googleOfferTags": ["code-monica30"],  "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "DWALKER30", "partnerId": "dwalker", "classification": "discount+affiliate", "appleOfferIdentifier": "DWALKER30", "googleOfferId": "code-dwalker30", "googleOfferTags": ["code-dwalker30"], "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null },
    { "code": "AGUS30",    "partnerId": "agus",    "classification": "discount+affiliate", "appleOfferIdentifier": "AGUS30",    "googleOfferId": "code-agus30",    "googleOfferTags": ["code-agus30"],    "googleBasePlanId": "annual", "discountLabelKey": "code.discount.first_year_30", "discountLabelEn": "30% off your first year", "revenueSharePct": 0.30, "active": true, "registryVersion": 1, "validFrom": "2026-06-14T00:00:00Z", "validTo": null }
  ]
}
```
> Google offers (`code-ian30`…) must be **created in Play Console by WS-E** before
> the Android `USE_OFFER_TOKEN` path works; the registry rows ship regardless
> (Apple path is live first). `validTo:null` = open-ended.

---

## 9. WORKSTREAM FILE-OWNERSHIP MAP

Every file is owned by exactly one workstream. **Shared-file conflicts are
flagged with a split rule.**

### WS-A — Infra / Terraform (DynamoDB, routes, IAM, secret, seed loader)
- `corpan/infra/terraform/main.tf` — DynamoDB `corpan-iap` + GSI1; IAM additions
  (`dynamodb:GetItem/PutItem/Query/UpdateItem` on table + GSI1); `codeSigning`
  key in the `aws_secretsmanager_secret_version.verify` block; **2 new routes**
  `POST /code/resolve`, `POST /entitlement-token`; `DYNAMO_TABLE` Lambda env var.
- `corpan/infra/terraform/outputs.tf`, `variables.tf` — table name/arn outputs.
- `corpan/infra/codes/seed.json` (new, §8) + `corpan/infra/codes/load_seed.py`
  (new BatchWrite loader).

### WS-B — Lambda (backend handlers)
- `corpan/infra/terraform/lambda/verify_purchase.js` — `/code/resolve` handler;
  `/entitlement-token` handler; `verify-purchase` additions (Apple JWS fields,
  Google v2, token validate, idempotent PURCHASE#, lock, ledger); notification
  signature verify + renewal ledger; route switch cases.
- `corpan/infra/terraform/lambda/codes.js` (new) — registry read, classification,
  `resolutionToken` + `entitlementToken` sign/verify, ledger write helpers.
- `corpan/infra/terraform/lambda/package.json` — add `jsonwebtoken` (or hand-roll
  HS256 via `crypto`); add `aws-sdk` DynamoDBDocumentClient.
- `corpan/infra/terraform/lambda/*.test.js` (new) — per plan §8 unit set.

### WS-C — App client (TS/React)
- `corpan/corpan-app/src/contentPacks/purchase.ts` —
  rewrite `resolveAffiliateCode` → `resolveCode` hitting `/code/resolve` (DELETE
  fail-open L854-874); add `resolutionToken` to `verifyPurchase` options + body;
  thread `offerToken` selection; new response/classification types.
- `corpan/corpan-app/src/components/packs/SubscriptionOffer.tsx` — un-hide the
  field (`SHOW_AFFILIATE_CODE_FIELD`), rename "Offer or affiliate code", branch
  CTA on `purchaseAction`, render `discountLabel`/`partnerName`, no "valid" on
  error.
- `corpan/corpan-app/src/store/entitlements.ts` — (already has
  `entitlementToken`/`setEntitlementToken`; no change unless a `partnerName` hint
  is cached — keep IN-MEMORY only).
- i18n strings (`subscription.*`, `code.*`) across ~50 langs.

### WS-D — iOS plugin (separate effort)
- `corpan/plugins/tauri-plugin-iap/ios/Sources/IapPlugin.swift` —
  `present_offer_code_redeem_sheet` (`presentOfferCodeRedeemSheet`, iOS16+;
  `<16` → open `appleRedeemUrl`).
- `…/src/commands.rs`, `…/src/mobile.rs`, `…/permissions/autogenerated/commands/
  present_offer_code_redeem_sheet.toml`, `…/permissions/default.toml`,
  `…/guest-js/index.ts` — wire the new command (plan §4.4).

### WS-E — Play offers tooling (separate effort)
- `corpan/infra/asc/` / Play tooling — create the 8 Google subscription offers
  `code-ian30…code-agus30` (`relativeDiscount: 0.7`, `offerTags:["code-<x>"]`)
  on base plan `annual`; create the 8 Apple custom offer codes in App Store
  Connect (codes already exist per task — verify `offerIdentifier` == UPPERCASE).
- Play RTDN Pub/Sub topic + push subscription to `/google-notifications`;
  Apple ASSN V2 URL pointed at `/apple-notifications`.

### Shared-file flags (two workstreams must touch — split rule)
1. **`main.tf`** — WS-A owns ALL edits (DynamoDB, IAM, routes, secret). WS-B
   *requests* the `DYNAMO_TABLE` env var + `codeSigning` secret key via WS-A; WS-B
   never edits `.tf`. **WS-A is sole writer.**
2. **`verify_purchase.js`** — WS-B sole writer. To minimize merge surface, WS-B
   puts ALL new logic in the **new `codes.js`** module and touches
   `verify_purchase.js` only at: the route `switch` (2 cases), and inside
   `handleVerifyPurchase`/`tryVerifyAppleWith`/`verifyGoogle`/the two
   notification handlers (call into `codes.js`). One owner, additive edits.
3. **`purchase.ts`** — WS-C sole writer. WS-D's plugin command is invoked from
   `purchase.ts` (WS-C) but the *command definition* lives in WS-D files — no
   shared file. Coordinate only on the command name
   `plugin:iap|present_offer_code_redeem_sheet` and its arg shape
   `{ appleOfferId?: string }` (frozen here).
4. **`package.json` (lambda)** — WS-B sole writer.

---

## 10. Build order (critical path, plan §10)
WS-A table+secret+routes → WS-B `/code/resolve`+token → WS-B `verify-purchase`
extensions (highest correctness risk) → WS-B renewals → WS-C CTA branching.
WS-D and WS-E run in parallel; Apple path can ship before Google offers exist.
WS-A seed load gates `/code/resolve` returning anything but `unknown`.
