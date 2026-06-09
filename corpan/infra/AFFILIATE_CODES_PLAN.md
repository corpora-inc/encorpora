# Affiliate + Discount Codes — Implementation Plan

Status: **APPROVED — building on `feature/iap-codes` for 0.17.4** · Last updated: 2026-06-09

> **Locked decisions (2026-06-09):**
> - Target **0.17.4**. The code field is HIDDEN in 0.17.3 (`SHOW_AFFILIATE_CODE_FIELD=false` in `SubscriptionOffer.tsx`).
> - Redemption UX = **in-app native StoreKit/Billing sheet** (`plugin:iap|redeem_offer_code` → `presentCodeRedemptionSheet` / `presentOfferCodeRedeemSheet` on iOS; Play offer/promo flow on Android).
> - The overloaded single field resolves **server-side**: registry classifies one-time / custom-discount / affiliate (a code like `LCCLT` can be both); unknown codes → recorded as **free-text affiliate, unverified-but-credited**.
> - Founder-gated to go live: App Store Connect / Play offer+code setup; AWS backend deploy; one iOS rebuild; sandbox testing.

This is a plan, not an implementation. It audits the real code, fixes the prior
draft's incorrect/optimistic claims, locks down platform accuracy against current
Apple/Google docs, and specifies a server-authoritative design ready to build.

> **One-line verdict:** Yes, ship the single overloaded code field — but the
> overload must be resolved **server-side**, the client must **stop failing
> open**, and "free-text affiliate codes with no allowlist" should become
> **soft-validated free-text with a registry-backed allowlist for partners that
> get revenue share**. Attribution must live in a backend ledger keyed on the
> anon `subjectId`; discounts must be **platform offers** (Apple offer codes /
> Play subscription offers), never backend price overrides.

---

## 0. TL;DR for the busy reviewer

- **Overloaded field:** endorsed, with corrections. The naive "if not a store
  code, accept anything" branch is a fraud/typo hazard for *paid* affiliates.
  Resolve every code through one backend route that classifies it
  (`discount` | `affiliate` | `discount+affiliate` | `unknown`) and returns a
  short-lived signed `resolutionToken`. Free-text is allowed only as an
  *unverified* attribution that never auto-enrolls a payout.
- **Most important architectural change:** introduce a **backend code registry +
  attribution ledger** (one DynamoDB table) and make the entitlement +
  attribution **server-authoritative**, driven by App Store Server Notifications
  V2 / Google RTDN (which the Lambda currently *parses and throws away*). The
  client today **fails open** on affiliate resolution and the server **ignores**
  `affiliateCode` entirely — both must change before any partner is paid.
- **Must ship next release:** registry + ledger + server-side attribution capture
  + idempotent writes + attribution-lock + Apple in-app offer-code redemption +
  Play offer/promo wiring + remove client fail-open. **Defer:** automated
  payouts (manual CSV export is fine), self-serve partner portal, multi-touch
  attribution, fancy fraud ML.
- **Top 3 risks:** (1) renewal re-attribution gap on reinstall (anon model has no
  durable cross-install identity); (2) self-referral / code-guessing fraud on
  unvalidated free-text codes; (3) Apple offer fields are **only on the initial
  transaction**, never on renewals — attribution durability depends on
  `appAccountToken` + our ledger, not on the receipt.

---

## 1. Current-state audit (with file:line evidence)

### 1.1 App client

**`corpan-app/src/contentPacks/purchase.ts`**

- `getCorpanSubjectId()` (L130-148) mints/persists an anon UUID in
  `localStorage["corpan:subject-id:v1"]` and mirrors it into the entitlement
  store. This is the account key. **It is lost on reinstall / storage clear** —
  critical for renewal re-attribution (see §7).
- `purchaseProduct()` (L400-477) passes the subjectId to the store:
  - iOS/macOS → `payload.appAccountToken = subjectId` (raw UUID) (L414-415).
  - Android → `payload.obfuscatedAccountId = sha256Hex(subjectId)` (L416-417).
  - It forwards `options.offerToken` to the plugin (L413) — **the Android offer
    path already exists end-to-end** (plugin honors `offerToken`).
- `verifyPurchase()` (L621-683) POSTs to `/verify-purchase` with
  `platform, productId, transactionId, subjectId`, plus `receipt` (Apple) or
  `purchaseToken` (Android) (L641-645), optional `packId`, and **`affiliateCode`
  when format-valid** (L648-653). **The server silently drops `affiliateCode`**
  (see §1.2). The response type already declares `affiliateAttribution`
  (L43-47) and `entitlementToken` (L42) — these are **aspirational**; the server
  returns neither today.
- `resolveAffiliateCode()` (L685-721) POSTs `/affiliate/resolve`. **This route
  does not exist on the backend.** On `404` *and* on any network error it
  returns `status: "ok"` (L700-705, L714-720) — i.e. it **fails open**: any
  string the user types is reported to the UI as a valid code. This is the
  single most dangerous client behavior for partner trust.
- `refreshEntitlementToken()` (L723-753) POSTs `/entitlement-token`. **This route
  also does not exist on the backend** (confirmed: not in the Lambda switch, not
  in terraform routes). It currently always 404s → token set to `null`.
- Format gate: `normalizeAffiliateCode` (L150-152, upcases + strips whitespace)
  and `isAffiliateCodeFormatValid` (L154-156: `^[A-Z0-9_-]{1,32}$`).

**`corpan-app/src/components/packs/SubscriptionOffer.tsx`**

- The code field is labeled **"Affiliate code"** (L467) — there is **no offer/
  discount affordance** and no "Redeem with Apple/Google" path.
- Debounced resolve on input (L134-168) calls `resolveAffiliateCode`; because the
  resolver fails open, the field shows "valid" for essentially any input.
- `handleSubscribe()` (L170-204) calls
  `purchaseAndVerify(productId, undefined, "subs", { affiliateCode })`. It does
  **not** pass an `offerToken`, never presents a redemption sheet, and treats the
  code purely as a string to attach to verification.
- `purchaseAndVerify()` (purchase.ts L771-849) sets local entitlement on store
  confirmation and treats backend verify failure as non-fatal (L828-834). Fine
  for entitlement; means **attribution can be silently lost** if verify fails.

**Subject/entitlement store** — `corpan-app/src/store/entitlements.ts` holds
`subjectId`, `entitlementToken` (L33), `setEntitlementToken` (L97-98),
`setSubjectId`. The plumbing exists; the data behind it does not.

### 1.2 Backend — `corpan/infra/terraform/lambda/verify_purchase.js`

- Routes wired (L496-510): `/verify-purchase`, `/subscription-status`,
  `/apple-notifications`, `/google-notifications`. **No `/affiliate/resolve`, no
  `/entitlement-token`.** The draft's claim that these exist is **wrong** — they
  are client-only stubs that 404 today.
- `verifyApple()` (L87-168): calls `getTransactionInfo(transactionId)`, decodes
  the JWS payload, and reads **only** `productId, type, environment,
  transactionId, originalTransactionId, expiresDate` (L143-161). It **does NOT
  capture** `appAccountToken`, `offerType`, `offerIdentifier`,
  `offerDiscountType`, `price`, `currency` — all present in the JWS and all
  needed for attribution/discount confirmation.
- `verifyGoogle()` (L174-285): uses **`purchases.subscriptions.get` (v1)**
  (L198-202), **not `subscriptionsv2.get`**. v1 does **not** return
  `externalAccountIdentifiers` (obfuscated account id), `lineItems`, or
  `offerDetails`. So Android attribution-by-account and offer confirmation are
  **impossible with the current call** — the draft is right that we must move to
  v2.
- `handleVerifyPurchase()` (L291-354): validates platform/productId, verifies the
  receipt, generates a CloudFront signed URL if a pack was requested. It
  **never reads `body.affiliateCode`, never reads `body.subjectId`** beyond what
  the receipt carries, **persists nothing** (no datastore at all), and does
  **no idempotency** — replaying the same `transactionId` re-runs everything.
- It does **not compare** the client-requested `productId` against the
  store-decoded `productId` (a client could claim any product; the Apple path is
  safe because it re-fetches by `transactionId`, but the response echoes the
  decoded product — Android echoes the *client* `productId`, L237, which is a
  minor trust gap to tighten).
- `handleAppleNotification` (L387-412) and `handleGoogleNotification`
  (L418-440): **decode and `console.log` only** — they do not verify signatures
  and do not update any state. This is the natural home for renewal attribution
  and is currently unused.
- Infra (`main.tf`): one Lambda, Secrets Manager (`apple/google/cloudfront`
  creds, L40-54), S3 + CloudFront. **No DynamoDB, no ledger, no KMS signing key
  for our own tokens.** `versions.tf`/`provider.tf` are standard AWS.

### 1.3 Native plugins — `corpan/plugins/tauri-plugin-iap/`

- **iOS** (`ios/Sources/IapPlugin.swift`):
  - `purchase` honors `appAccountToken` as a `Product.PurchaseOption`
    (L300-307) and requires it be a valid UUID (L301-305). Good.
  - It returns `jwsRepresentation` (L587) to JS, but the server re-fetches via
    `getTransactionInfo` anyway, so the JWS is not the trust anchor.
  - **No offer-code redemption.** There is no `presentOfferCodeRedeemSheet`
    binding, no `Product.PurchaseOption.promotionalOffer`, no offer-code command.
    `Transaction.updates` is listened to (L69-72, L527-555) and auto-finished —
    so a *redeemed* offer would entitle the user but **emit no attribution
    signal to our backend**.
  - The `getProducts` subscription mapping (L205-242) emits empty `offerToken`
    on iOS (correct — iOS doesn't use offer tokens; promotional offers use
    signatures, offer *codes* are redeemed via the sheet).
- **Android** (`android/src/main/java/app/tauri/iap/IapPlugin.kt`):
  - `purchase` honors `offerToken` (L206-212), `obfuscatedAccountId` (L220-222),
    `obfuscatedProfileId`, and subscription update params (L230-240). The **paid
    discount path (offer selection) is fully wired** at the billing layer.
  - `getProducts` returns full `subscriptionOfferDetails[]` incl.
    `offerToken/basePlanId/offerId/pricingPhases` (L132-156) — the client can
    already select an offer.
  - **No promo-code redemption affordance.** Play promo codes are redeemed in the
    Play UI ("Redeem" link in the billing sheet) or via deep link; there is no
    `launchBillingFlow`-side API for it. We expose a deep link + the native sheet
    (which already shows the Redeem link).
- **JS bridge** (`guest-js/index.ts`), **Rust** (`commands.rs`, `mobile.rs`):
  commands are `get_products, purchase, restore_purchases, acknowledge_purchase,
  get_product_status` (+ deprecated `initialize`, `get_purchase_history`,
  listeners). Adding a command = add to `commands.rs` + `mobile.rs` (`Iap` impl)
  + Swift/Kotlin `@objc/@Command` + `permissions/autogenerated/commands/*.toml` +
  `permissions/default.toml` + `guest-js`.

### 1.4 "What's missing" gap list

| # | Gap | Where |
|---|-----|-------|
| 1 | No code registry / ledger / datastore at all | backend |
| 2 | `affiliateCode` accepted by client, **dropped** by server | verify_purchase.js |
| 3 | `/affiliate/resolve` + `/entitlement-token` **don't exist** | backend (client 404s) |
| 4 | Resolver **fails open** (404/network → "ok") | purchase.ts L700-720 |
| 5 | Apple JWS offer/account fields **not captured** | verify_purchase.js L143-161 |
| 6 | Google uses **v1** get — no account id / offers / line items | verify_purchase.js L198 |
| 7 | Renewal notifications **parsed then discarded** | verify_purchase.js L387-440 |
| 8 | No idempotency / no productId cross-check / no replay defense | verify_purchase.js |
| 9 | No Apple in-app offer-code redemption sheet | IapPlugin.swift |
| 10 | No Play promo-code redemption affordance/deep link | IapPlugin.kt / UI |
| 11 | UI says "Affiliate code" only; no discount/redeem UX | SubscriptionOffer.tsx |
| 12 | No signed entitlement token issuance | backend (KMS) |
| 13 | `subjectId` is fragile (lost on reinstall) — renewal credit risk | purchase.ts L130 |

---

## 2. The overloaded single field — verdict, decision flow, free-text vs allowlist

### 2.1 Can we overload one field? Verdict: **Yes — resolve server-side.**

The founder's flow is the right UX (one box, low friction, no taxonomy the user
must understand). The flaw is in *where* and *how* the branching happens. Two
hard rules:

1. **The store decides what a store code is, not us.** We cannot tell from the
   string alone whether `LCCLT` is an Apple offer code, a Play promo code, or
   just an affiliate tag. Apple offer codes are redeemed through Apple's sheet;
   Play promo codes through Play's UI. The app cannot "validate" a store code by
   format. So the only reliable classifier is **our registry** (what we
   provisioned) cross-checked with **the platform** (did the offer actually
   apply, per the receipt).
2. **The naive last branch ("accept anything, no validation") is fine for
   tracking but unsafe for *paying*.** Accept the free-text tag, but mark it
   `unverified` and do **not** enroll it for revenue share until a human/registry
   promotes it. This kills typo-leakage and self-referral payouts.

### 2.2 Corrected decision flow (state machine)

The client never classifies. It sends the raw code to `POST /code/resolve` and
acts on the returned `kind` + `purchaseAction`. The server is the brain.

```
USER ENTERS CODE (or leaves blank)
        │
   blank? ──► [A] NORMAL PURCHASE (no offer, no attribution)        ───► done
        │
   POST /code/resolve { code, subjectId, platform, productId }
        │
        ├─ kind = "appleOfferCode"   → purchaseAction = "REDEEM_APPLE_SHEET"
        │      [B] present in-app offer-code sheet (or apps.apple.com/redeem URL).
        │          On return: refreshEntitlements + verifyPurchase(resolutionToken).
        │          Server confirms offer applied from JWS (offerType/offerIdentifier)
        │          AND records attribution if the registry entry is also an affiliate.
        │
        ├─ kind = "playPromo"        → purchaseAction = "REDEEM_PLAY_PROMO"
        │      [C] open Play redeem (deep link / billing sheet Redeem link).
        │          Free-trial only (Google constraint). Same post-return verify.
        │
        ├─ kind = "playOffer"        → purchaseAction = "USE_OFFER_TOKEN"
        │      [D] purchase with the resolved offerToken (paid % discount).
        │          Server confirms offer from subscriptionsv2 offerDetails.offerId.
        │
        ├─ kind = "affiliate"        → purchaseAction = "ATTRIBUTE_ONLY"
        │      [E] NORMAL purchase at full price; attach resolutionToken so the
        │          server writes the ledger attribution (verified partner).
        │
        ├─ kind = "affiliate+offer"  → server returns BOTH the offer descriptor
        │      (D or B/C) AND attribution; client does the discount path, server
        │      records attribution. This is the LCCLT case.
        │
        └─ kind = "unknown"          → purchaseAction = "ATTRIBUTE_UNVERIFIED"
               [F] NORMAL purchase; attach raw code as an UNVERIFIED tag.
                   Recorded in ledger as status="unverified" (no payout enrollment).
                   UI copy is honest: "We'll record this code with your purchase."
```

Notes that correct the draft:

- **There is no "discount = backend price override" branch.** Discounts are
  always [B]/[C]/[D] platform mechanisms. The server's role is to *confirm* the
  discount happened (from the receipt) and to *attribute* it — never to alter
  price. (The draft says this; we make it a hard invariant.)
- The `resolutionToken` is a short-lived (e.g. 5 min) HMAC/KMS-signed blob
  binding `{code, subjectId, kind, registryVersion, exp}`. `verify-purchase`
  requires it for any attribution write so a client can't fabricate "this was
  partner X" against an arbitrary purchase.
- For [F] unknown codes we still issue a `resolutionToken` (kind=`unverified`)
  so the same idempotent write path is used; the ledger row carries
  `status: "unverified"`.

### 2.3 Free-text vs validated allowlist — recommendation

**Use a hybrid: registry-backed allowlist for *paid* partners; soft free-text for
everyone else.** Concretely:

- **Allowlist (registry) is authoritative for revenue share.** Only codes present
  in the registry with `revenueShare > 0` and `status: active` ever enroll a
  payout. This is non-negotiable for partner trust and fraud control.
- **Free-text is accepted but quarantined.** Unknown codes are recorded as
  `unverified` attribution. They cost nothing, surface in reporting ("N purchases
  cited code FOO"), and let Ops *promote* a frequently-seen organic code into the
  registry retroactively — without ever auto-paying a typo or a self-referral.
- **Why not pure free-text (draft's "probably no allowlist needed"):** typo
  leakage (`LCLT` vs `LCCLT` silently credits a non-existent partner or, worse, a
  squatter who registers the typo), self-referral (buyer types their own code),
  and partner disputes ("your numbers don't match mine") all stem from paying out
  on unvalidated strings. The cost of an allowlist for the *paid* set is trivial
  (it's just the registry we need anyway).
- **Why not pure allowlist (reject unknowns):** loses cheap organic-signal
  capture and adds friction/error states to the happy path. Quarantine gets the
  best of both.

---

## 3. Architecture

### 3.1 Components

```
App (anon subjectId)
  └─ POST /code/resolve ─────────► Lambda ──► DynamoDB (registry read)
                                         └──► returns kind + resolutionToken (KMS/HMAC signed)
  └─ platform purchase / redeem (StoreKit / Play Billing)
  └─ POST /verify-purchase ──────► Lambda ──► verify receipt (Apple SSAPI / Google v2)
                                         ├──► validate resolutionToken
                                         ├──► idempotent PUT PURCHASE# (conditional)
                                         └──► attribution lock + LEDGER# write
Store server notifications:
  Apple ASSN V2 / Google RTDN ───► Lambda ──► verify signature ──► renewal LEDGER# write
                                         (credits original attribution by appAccountToken/originalTxn)
```

New AWS resources (terraform): **one DynamoDB table** `corpan-iap`
(PAY_PER_REQUEST, PITR on), **one KMS key** (or an HMAC secret in Secrets
Manager) for signing `resolutionToken` + `entitlementToken`, IAM policy
additions for the Lambda (dynamodb:GetItem/PutItem/Query/UpdateItem on the table;
kms:Sign/Verify or just read the HMAC secret). No new Lambda needed — extend the
existing one (it already routes by `routeKey`).

### 3.2 Data model — single-table DynamoDB `corpan-iap`

`PK` / `SK` composite. PITR enabled. TTL attribute on transient items.

| Item | PK | SK | Key attributes |
|------|----|----|----------------|
| **Code registry** | `CODE#<NORMALIZED>` | `META` | `kind` (`appleOfferCode`/`playPromo`/`playOffer`/`affiliate`/`affiliate+offer`), `partnerId`, `discountLabel`, `appleOfferId`, `playOfferId`, `playBasePlanId`, `revenueSharePct`, `status` (`active`/`paused`), `displayName`, `validFrom`, `validTo`, `registryVersion` |
| **Subject attribution lock** | `SUBJECT#<subjectId>` | `ATTRIBUTION` | `code`, `partnerId`, `lockedAt`, `lockSource` (first verified purchase), `status` (`verified`/`unverified`) — **write-once-ish** (see §3.4) |
| **Purchase (idempotency)** | `SUBJECT#<subjectId>` | `PURCHASE#<platform>#<txnOrOriginalId>` | `productId`, `code`, `partnerId`, `offerApplied` (bool + offerType/offerId), `price`, `currency`, `environment`, `verifiedAt` — conditional PutItem on `attribute_not_exists(SK)` |
| **Ledger (renewal & initial credit)** | `LEDGER#<partnerId>#<yyyy-mm>` | `EVENT#<platform>#<txnId>` | `subjectId`, `code`, `productId`, `price`, `currency`, `kind` (`initial`/`renewal`), `revenueSharePct`, `eventTime`, `notificationType` |
| **Partner** | `PARTNER#<partnerId>` | `META` | `name`, `payoutEmail`, `defaultRevenueSharePct`, `status` |

This collapses the draft's table shape into a workable single-table design.
Reporting/payout = `Query LEDGER#<partner>#<month>` then sum — no scans.

### 3.3 Idempotency & replay defense

- `verify-purchase` writes `PURCHASE#…` with
  `ConditionExpression: attribute_not_exists(SK)`. A replayed `transactionId`
  → `ConditionalCheckFailed` → treat as already-processed, return the prior
  result, **do not double-credit the ledger**.
- Ledger writes for renewals key on `EVENT#<platform>#<txnId>` (each renewal has
  a unique transaction id on both platforms) → conditional put → exactly-once
  credit even if Apple/Google redeliver the notification (they retry).
- Cross-check: on Android, **stop echoing the client `productId`**; use the
  product/line-item from the v2 response. On Apple, the `getTransactionInfo`
  re-fetch already authoritative — record the *decoded* product, not the request.

### 3.4 Attribution locking & recurring-renewal crediting

- **Lock first verified attribution per subject.** On the first verified purchase
  carrying a *verified* (registry) code, write `SUBJECT#…/ATTRIBUTION` with
  `attribute_not_exists(SK)`. Subsequent different codes for the same subject do
  **not** overwrite a verified lock (last-touch hijacking is a fraud vector and a
  partner-dispute generator). Document this as **first-verified-touch wins**.
  - An `unverified` lock *may* be upgraded to `verified` if a later purchase
    carries a registry code (configurable; default allow upgrade, never downgrade,
    never change partner once verified).
- **Renewals** are credited via store notifications, not the client:
  - **Apple ASSN V2** (`DID_RENEW`, `DID_CHANGE_RENEWAL_STATUS`, etc.): the signed
    payload carries the renewal transaction with `originalTransactionId` and
    `appAccountToken` (the latter persists across renewals — confirmed in Apple
    docs). Look up `SUBJECT#<appAccountToken>/ATTRIBUTION` → write
    `LEDGER#<partner>#<month>/EVENT#…` kind=`renewal`. **Verify the JWS signature
    against Apple root certs** (the library `SignedDataVerifier` is already a
    dependency — `verify_purchase.js` L3 — but currently unused for
    notifications; wire it).
  - **Google RTDN** (`SUBSCRIPTION_RENEWED`): the message gives package +
    purchaseToken; call `subscriptionsv2.get` → read
    `externalAccountIdentifiers.obfuscatedExternalAccountId` (= `sha256Hex(
    subjectId)`, the value the client already sends) → reverse-map to the subject
    (store the hash on the ATTRIBUTION/PURCHASE rows so the renewal can find it
    without reversing the hash) → credit ledger.
- **Important correctness note (corrects optimism):** Apple offer fields
  (`offerType/offerIdentifier/offerDiscountType`) appear **only on the initial
  transaction, never on renewals** (confirmed against Apple docs). So renewal
  *attribution* must ride on `appAccountToken` + our lock, **not** on re-reading
  the offer from the renewal receipt. The discount itself naturally ends when the
  offer period ends (renews at standard price) — that's a platform behavior, not
  ours to manage.

### 3.5 Server-authoritative entitlement

- `verify-purchase` (and a new `POST /entitlement-token`) issue a short-lived
  signed `entitlementToken` (KMS/HMAC, ~24h) attesting `{subjectId, plus: bool,
  expiresAt}`. The app already stores it (`entitlements.ts`) and sends it; we
  just need to **mint it** (today the route 404s). Premium content (signed
  CloudFront URLs) is already server-gated by receipt — the token is an additive
  convenience for offline-ish gating, not the security boundary. The security
  boundary remains: **the server only signs a CloudFront URL after a valid
  receipt.** Open-source client → never trust client-side `plus` flags.

### 3.6 How discounts map to platform offers (the invariant)

| Want | Apple | Google |
|------|-------|--------|
| Free or % discount, code-redeemed, acquisition | **Offer code** (App Store Connect) redeemed via in-app sheet / `apps.apple.com/redeem` | **Free trial only** via **promo code**; **paid/% discount** via a **subscription offer** (offerId/offerToken), not a promo code |
| Discount for existing/lapsed subs | Promotional Offer (signed) | Subscription offer with eligibility |
| Pure attribution, no discount | n/a (just `appAccountToken` + ledger) | n/a (just `obfuscatedAccountId` + ledger) |

**Platform-incorrect claims to avoid (flagged):**
- ❌ "Backend applies the discount / price override." Not possible on either
  platform. Price is set in App Store Connect / Play Console offers.
- ❌ "A Play promo code can give a percentage discount." No — Play promo codes are
  **free-trial / free-unlock only**; % discounts require subscription **offers**.
- ❌ "Apple renewal receipts re-state the offer." No — offer fields are
  initial-transaction-only.

---

## 4. Public interfaces

### 4.1 `POST /code/resolve` (new route — replaces client's `/affiliate/resolve`)

Request:
```jsonc
{
  "code": "LCCLT",            // raw; server normalizes (upper, strip ws)
  "subjectId": "<uuid>",
  "platform": "ios|android",
  "productId": "corpan.sub.annual" // optional, lets server pick the right offer
}
```
Response:
```jsonc
{
  "status": "ok",
  "code": "LCCLT",
  "kind": "appleOfferCode | playPromo | playOffer | affiliate | affiliate+offer | unverified",
  "partnerName": "Language Learning Club",      // present for affiliate kinds
  "discountLabel": "50% off first year",        // human, localized server-side
  "purchaseAction": "REDEEM_APPLE_SHEET | REDEEM_PLAY_PROMO | USE_OFFER_TOKEN | ATTRIBUTE_ONLY | ATTRIBUTE_UNVERIFIED",
  "offer": {                                     // present for USE_OFFER_TOKEN
    "playOfferId": "annual-lcclt",
    "playBasePlanId": "annual",
    "offerToken": null    // client re-reads token from getProducts; server returns offerId to MATCH
  },
  "appleRedeemUrl": "https://apps.apple.com/redeem?...", // present for REDEEM_APPLE_SHEET fallback
  "resolutionToken": "<signed: code,subjectId,kind,registryVersion,exp>",
  "expiresInSec": 300
}
```
- **No fail-open.** Network/registry error → `{ "status": "error", "error": ... }`
  and the client shows a non-blocking "couldn't check the code" with a **Retry**,
  and lets the user proceed with the code as `unverified` *only if they confirm*.
  Never auto-promote an unreachable check to "valid".

### 4.2 `POST /verify-purchase` (extend existing)

Add to request:
```jsonc
{
  "subjectId": "<uuid>",        // already sent
  "affiliateCode": "LCCLT",     // already sent (today dropped)
  "resolutionToken": "<from /code/resolve>"  // NEW — required for any attribution write
}
```
Server changes:
- Validate `resolutionToken` (signature + exp + `subjectId` match + code match).
- Capture Apple JWS extras: `appAccountToken, offerType, offerIdentifier,
  offerDiscountType, price, currency`.
- Switch Google to `subscriptionsv2.get`; capture
  `externalAccountIdentifiers`, `lineItems[].offerDetails.offerId`, `offerPhase`.
- Confirm `offerApplied` by comparing receipt offer fields vs the registry entry.
- Idempotent `PURCHASE#` write; attribution lock; ledger `initial` credit.
- Cross-check decoded productId vs requested.
Add to response (the client type already declares these):
```jsonc
{
  "status": "verified",
  "affiliateAttribution": { "code": "LCCLT", "locked": true, "verified": true,
                            "message": "Credited to Language Learning Club" },
  "entitlementToken": "<signed>",
  "subjectId": "<uuid>", "plus": true, "expiresAt": "..."
}
```

### 4.3 `POST /entitlement-token` (new route — client already calls it)

Request `{ "subjectId": "<uuid>" }` → server looks up current entitlement
(latest verified purchase / notification state) → returns signed token
`{ status, subjectId, plus, expiresAt, entitlementToken }`. (Matches the existing
client type `EntitlementTokenResponse`.)

### 4.4 IAP plugin command additions

- **iOS:** add `plugin:iap|present_offer_code_redeem_sheet` →
  `AppStore.presentOfferCodeRedeemSheet(in:)` (iOS 16+); fallback for <16 opens
  `https://apps.apple.com/redeem`. Resolves when the sheet dismisses; caller then
  runs `refreshEntitlements()` + `verifyPurchase(resolutionToken)`. (Offer-code
  redemption produces a `Transaction.updates` event which the existing listener
  already finishes; the new command just *presents* the sheet.)
- **Android:** no new billing command needed for promo codes (redeemed in Play UI
  / via deep link). Add a thin `plugin:iap|open_play_redeem` that opens
  `https://play.google.com/redeem?code=<code>` via the opener, OR rely on the
  existing in-sheet Redeem link. The **paid offer path already works** via the
  existing `offerToken` arg — no plugin change.
- Wiring per command: `commands.rs` + `mobile.rs` (`Iap` impl) + Swift `@objc` /
  Kotlin `@Command` + `permissions/autogenerated/commands/<cmd>.toml` +
  add to `permissions/default.toml` + `guest-js/index.ts`.

---

## 5. App UX / flow changes (remove fail-open)

`SubscriptionOffer.tsx` + `purchase.ts`:

1. **Rename field** "Affiliate code" → **"Offer or affiliate code"**
   (`subscription.codeLabel`); localize in ~50 langs.
2. **Resolve drives the button.** After debounce, call `/code/resolve`. Render
   `discountLabel`/`partnerName` honestly. On resolver error: **do not show
   "valid"**; show "Couldn't check — Retry" and gate proceed behind explicit
   confirm for `unverified`.
3. **Branch the CTA on `purchaseAction`:**
   - `REDEEM_APPLE_SHEET` → button "Redeem with Apple" → call new plugin command
     (or open redeem URL) → on return `refreshEntitlements()` +
     `verifyPurchase({resolutionToken})`.
   - `REDEEM_PLAY_PROMO` → "Redeem with Google Play" → open redeem deep
     link/sheet → same post-return verify.
   - `USE_OFFER_TOKEN` → normal "Subscribe", but pass the matching `offerToken`
     (re-read from `getProducts` by `offer.playOfferId`/`basePlanId`) into
     `purchaseAndVerify({ offerToken, resolutionToken })`.
   - `ATTRIBUTE_ONLY` / `ATTRIBUTE_UNVERIFIED` → normal "Subscribe", pass
     `{ affiliateCode, resolutionToken }`.
4. **Thread `resolutionToken`** through `purchaseAndVerify` →
   `verifyPurchase` (new option). Today only `affiliateCode` flows.
5. **Fix the client fail-open** in `resolveAffiliateCode` (purchase.ts L700-720):
   stop returning `status:"ok"` on 404/network. Return an `error` status; the UI
   handles it per (2).
6. **Restore/sync** after redemption: a redeemed offer entitles via
   `Transaction.updates` (iOS) / `onPurchasesUpdated` (Android) — call
   `refreshEntitlements()` and a `verifyPurchase` carrying the `resolutionToken`
   so attribution is captured even on the redemption (no purchase button) path.

---

## 6. Store setup

- **Apple (App Store Connect):** create a **Custom offer code** `LCCLT` against
  the subscription group (e.g. 50% off first year). Custom codes are a single
  shareable alphanumeric, redeemable in-app and via `apps.apple.com/redeem`.
  Apple-**generated one-time** codes (CSV batches) are also supported — map each
  batch to a campaign/partner in our registry (the *code value* differs per user;
  attribution is by `appAccountToken` + the campaign the batch belongs to).
- **Google (Play Console):**
  - **Paid/% discount** for `LCCLT` → create a **subscription offer** on the
    base plan with an eligibility/`offerId` (e.g. `annual-lcclt`). Register the
    `offerId`/`basePlanId` in our registry so `/code/resolve` returns
    `USE_OFFER_TOKEN`.
  - **Free trial / free unlock** → **promo code** (one-time auto-generated for
    Play-side redemption, or custom code for in-app). Promo codes are
    free-trial/free only.
- **Cross-platform code parity:** where feasible, use the same public string
  (`LCCLT`) as the Apple custom offer code AND the Play offer id slug AND the
  registry key, so a partner has one code to share. **Don't require it** for
  Apple-generated one-time batches — those are mapped server-side to the campaign.

---

## 7. Security / fraud / privacy

- **Open-source client → server-authoritative everything.** Discount eligibility,
  attribution, and entitlement are decided server-side from platform receipts +
  the registry. The client can request, never assert.
- **`resolutionToken`** (signed, short-lived, subject-bound) prevents a hacked
  client from writing "partner X" against an arbitrary purchase or replaying an
  attribution.
- **Idempotent, conditional writes** (§3.3) prevent double-credit via replay.
- **First-verified-touch lock** (§3.4) prevents last-touch hijack and self-credit
  flipping.
- **Self-referral:** unverified free-text never enrolls payout; verified partner
  codes can be flagged (`status: paused`) and we can exclude purchases whose
  `subjectId` matches the partner's own subject if known. Reporting surfaces
  anomalies for manual review before payout.
- **Code-guessing:** registry is an allowlist for *paid* codes; guessing a real
  partner code only attributes someone else's purchase to that partner (no payout
  to the guesser, no benefit) — low value. Rate-limit `/code/resolve` per IP/
  subject to blunt enumeration and to keep the registry's existence quiet.
- **Reinstall loses attribution (edge):** `subjectId` is `localStorage`-bound and
  lost on reinstall/clear (purchase.ts L130-148). Mitigations: (a) `appAccountToken`
  on Apple persists with the *original* transaction, so renewals still credit via
  the lock even if the app forgets its subjectId — **as long as we stored the
  appAccountToken→subject mapping at first purchase** (we do, in PURCHASE#); (b)
  on a fresh install we can `restorePurchases` → re-derive the original
  transaction → re-link the new subjectId to the existing attribution. Document
  that **new purchases after a reinstall without a code default to the existing
  lock by appAccountToken/originalTransactionId**, not to "no attribution".
- **Privacy:** keep on-device analytics posture. The ledger stores `subjectId`
  (anon UUID), platform ids, and codes — **no PII, no login**. `obfuscatedAccountId`
  sent to Google is already a SHA-256 of the subjectId (purchase.ts L417), not the
  raw id. Do not add device fingerprinting.
- **Notification signature verification:** wire `SignedDataVerifier` for Apple
  ASSN V2 and validate Google RTDN via the Pub/Sub push auth (OIDC token) before
  trusting any renewal credit.

---

## 8. Test plan

**Unit (client, vitest):**
- `resolveAffiliateCode` no longer fails open (404/network → `error`).
- CTA branching per `purchaseAction`; `resolutionToken` threaded into verify.
- offerToken re-selection by `playOfferId`/`basePlanId`.

**Unit (Lambda, node):**
- `/code/resolve` classification for each `kind` + `unverified`.
- `resolutionToken` sign/verify, exp, subject/code binding tamper rejection.
- Apple JWS field extraction (offerType/offerIdentifier/appAccountToken) from
  fixture JWS payloads (base64url).
- Google v2 mapping (offerDetails.offerId, obfuscatedExternalAccountId).
- Idempotent PURCHASE# (conditional put → second call no double-credit).
- Attribution lock: first-verified-touch wins; unverified→verified upgrade;
  no partner change after verified.
- Renewal credit from ASSN V2 / RTDN fixtures → ledger EVENT# exactly-once.

**Backend fixtures:** canned Apple `getTransactionInfo` JWS (initial w/ offer,
renewal w/o offer), Google `subscriptionsv2.get` (with/without offer + account
id), ASSN V2 `DID_RENEW`, RTDN `SUBSCRIPTION_RENEWED`.

**Device sandbox matrix:**
| Platform | Scenario |
|---|---|
| iOS sandbox | custom offer code in-app sheet; redeem URL fallback (<iOS16 sim); appAccountToken round-trips to ledger; renewal (accelerated sandbox) credits ledger |
| iOS sandbox | affiliate-only (no discount) → normal buy + attribution |
| Android (license tester) | subscription **offer** (paid %) via offerToken; offerId confirmed in v2 |
| Android | **promo code** free trial via Play redeem; attribution captured on post-redeem verify |
| Both | `LCCLT` = affiliate+offer (discount applied AND ledger credited) |
| Both | unknown free-text → unverified ledger row, no payout enrollment |
| Both | replay same txn → no double credit |
| Both | reinstall → renewal still credits via appAccountToken/originalTxn |

---

## 9. Scope split — MUST ship vs DEFER

**MUST ship next release (production-grade attribution + working discounts):**
1. DynamoDB `corpan-iap` table + KMS/HMAC signer (terraform).
2. `/code/resolve` (real classification, no fail-open) + remove client fail-open.
3. `verify-purchase` extensions: capture Apple JWS offer/account fields; switch
   Google to **subscriptionsv2.get**; validate `resolutionToken`; idempotent
   PURCHASE# write; attribution lock; ledger **initial** credit; productId
   cross-check.
4. Renewal crediting via **ASSN V2 + RTDN** (signature-verified) → ledger.
5. Apple **in-app offer-code redemption** (plugin command + UI "Redeem with
   Apple"); Play promo redeem affordance; Play **offerToken** wiring (UI; billing
   layer already done).
6. `/entitlement-token` minting (route exists in client, missing on server).
7. App Store Connect custom offer code `LCCLT` + Play offer/promo for `LCCLT`.

**Defer (post-release, not blocking partner trust):**
- Automated payout/disbursement → **manual CSV export** from the ledger
  (`Query LEDGER#<partner>#<month>`) is sufficient for v1.
- Self-serve partner portal / partner-managed codes.
- Multi-touch / time-decay attribution (v1 = first-verified-touch).
- Fraud ML / anomaly automation (v1 = reporting + manual review + pause switch).
- Promoting frequently-seen `unverified` codes into the registry (manual Ops at
  first; tool later).
- Apple-generated one-time **batch** import tooling (custom code `LCCLT` covers
  launch; batches can come next).

---

## 10. Effort / sequencing / critical path

Rough order-of-magnitude (1 senior eng), sequenced; **critical path in bold**.

1. **Terraform: DynamoDB + KMS/HMAC + IAM (0.5d).** Unblocks everything.
2. **Lambda registry + `/code/resolve` + token sign/verify (1.5d).**
3. **Lambda verify-purchase extensions (Apple JWS fields, Google v2, idempotency,
   lock, initial ledger) (2–3d).** Highest correctness risk; most tests.
4. Lambda `/entitlement-token` (0.5d) — parallelizable with 3.
5. **Renewal notifications (ASSN V2 + RTDN, signature verify, renewal ledger)
   (2d).** Depends on 1–3.
6. iOS plugin offer-code sheet command + Rust/permissions wiring (1d) — parallel.
7. Android redeem affordance/deep link (0.5d) — parallel.
8. **App UX: resolve-driven CTA branching, remove fail-open, thread
   resolutionToken/offerToken, i18n strings (2d).** Depends on 2.
9. Tests (unit + fixtures) interleaved with each (≈ +30%).
10. Store setup (LCCLT) + sandbox device matrix (1–1.5d, partly Ops/owner).

**Critical path:** 1 → 2 → 3 → 5 → 8 (→ sandbox sign-off). Estimate **~9–12
working days** to must-ship, plus store provisioning and sandbox verification
that depend on owner-held App Store Connect / Play Console + iOS build access
(coordinate ownership per project rules — do not assume the agent holds the
build/commit/store).

---

## Appendix — corrections applied to the prior draft

- ✅ Draft right: backend ignores attribution, persists no ledger; discounts =
  platform offers not price overrides; LCCLT cross-listed; Apple one-time batches
  mapped server-side; capture appAccountToken/originalTransactionId/offer fields;
  move Google to subscriptionsv2; idempotent writes; lock first attribution.
- ✏️ **Corrected:** `/affiliate/resolve` and `/entitlement-token` **do not exist
  on the backend** (client-only stubs that 404 today) — draft implies they're
  present. Renamed `/affiliate/resolve` → `/code/resolve` (it resolves all kinds).
- ✏️ **Corrected:** the client **fails open** on resolve (404/network → "ok",
  purchase.ts L700-720) — must be removed; draft says "remove fail-open" but
  didn't pin the exact behavior.
- ✏️ **Corrected:** Google verify currently uses **v1** `subscriptions.get`
  (L198), which cannot return account id / offers — must move to v2 (draft
  assumed v2 data was reachable).
- ✏️ **Corrected/flagged platform facts:** Play promo codes are **free-trial/free
  only** (no % discount → use offers); Apple offer fields are **initial-txn only,
  not on renewals** (renewal attribution must ride on appAccountToken + ledger).
- ✏️ **Tightened:** unify the draft's three-table sketch into one DynamoDB
  single-table design; add explicit reinstall/renewal re-link handling; add
  rate-limiting + notification signature verification; make free-text
  *quarantined-unverified* rather than freely paid.
