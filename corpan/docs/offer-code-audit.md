# Discount / Offer / Affiliate Code Audit

Date: 2026-06-17

Scope:
- Frontend paywall and code entry flow in `corpan-app/src/components/packs/SubscriptionOffer.tsx`
- Purchase orchestration in `corpan-app/src/contentPacks/purchase.ts`
- Native IAP bridge paths in `plugins/tauri-plugin-iap`
- Backend resolve, attribution, entitlement, and renewal logic in `infra/terraform/lambda`
- Seed/loading and Terraform routes/table wiring in `infra/codes` and `infra/terraform/main.tf`

Browser inspection:
- Ran the app at `http://127.0.0.1:5176/`.
- Used Playwright with a mocked Tauri IAP bridge so the native-only paywall could render in Chromium.
- Captured:
  - `corpan-app/tmp/audit/paywall-timeout-state.png`
  - `corpan-app/tmp/audit/paywall-ian30-mobile.png`
- The mock returned annual/monthly store products, a 7-day trial, and a mocked `IAN30` code resolve. The app's persisted locale was Korean, which exposed some useful localization issues.

## Executive Summary

The system is thoughtfully structured: the client never classifies codes locally, Android re-reads session-bound Play offer tokens, Apple receipt verification reads offer fields from the signed transaction payload, attribution is best-effort, and DynamoDB idempotency/first-touch locking is in place.

The biggest gaps are not "missing plumbing"; they are policy enforcement and edge-case correctness:

1. Code date windows are stored but not enforced.
2. Resolution tokens are not bound to product/platform/base plan.
3. Backend ledger credit does not require the verified store transaction to have the matching offer applied.
4. Android can fall back to a plain purchase while still sending a discount resolution token.
5. Apple redeem attribution is a module-level pending token that can attach to the wrong transaction.
6. Renewal ledger rows currently lose the original revenue share percentage.
7. The paywall looks premium overall, but the code affordance is visually secondary, mixed-language discount labels are possible, and localized subscription periods are still English.

## Current Architecture

### Frontend

- `SubscriptionOffer` renders the paywall plan selector, trial copy, CTA, restore/legal links, and the offer/affiliate field.
- The code field is always visible (`SHOW_AFFILIATE_CODE_FIELD = true`) after the primary CTA.
- On input, it normalizes the code and calls `resolveCode(code, selectedProductId)` after a 450 ms debounce.
- A resolved code returns:
  - `classification`: `discount`, `affiliate`, `discount+affiliate`, or `unknown`
  - `purchaseAction`: `REDEEM_APPLE_SHEET`, `USE_OFFER_TOKEN`, `ATTRIBUTE_ONLY`, or `ATTRIBUTE_UNVERIFIED`
  - `resolutionToken`
  - optional labels/offer hints
- Android `USE_OFFER_TOKEN` re-reads the live Play `offerToken` from the native product envelope before purchase.
- Apple `REDEEM_APPLE_SHEET` stashes the resolution token and presents the native redeem sheet; the resulting transaction arrives later via `purchaseUpdated`.

Key files:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:99`
- `corpan-app/src/contentPacks/purchase.ts:916`
- `corpan-app/src/contentPacks/purchase.ts:993`
- `corpan-app/src/contentPacks/purchase.ts:1092`

### Backend

- `POST /code/resolve` is routed to the existing verify Lambda.
- Code registry rows live in DynamoDB under `CODE#<CODE> / META`.
- The backend mints a 15-minute HS256 `resolutionToken`.
- `POST /verify-purchase` verifies the platform purchase first, then validates the resolution token and writes:
  - a `PURCHASE#<platform>#<txn>` row
  - a first-touch `ATTRIBUTION` lock
  - an initial partner ledger row when verified
- Renewal notifications extend entitlements and optionally credit renewal ledger rows.

Key files:
- `infra/terraform/lambda/codes.js:688`
- `infra/terraform/lambda/verify_purchase.js:324`
- `infra/terraform/lambda/verify_purchase.js:382`
- `infra/terraform/lambda/codes.js:448`
- `infra/terraform/lambda/codes.js:612`
- `infra/terraform/main.tf:281`

### Native

- iOS/macOS purchases can carry `appAccountToken`.
- Android purchases can carry `obfuscatedAccountId` and explicit `offerToken`.
- iOS offer-code redemption uses StoreKit's generic redemption sheet.
- Android explicit offer selection is implemented through Play Billing's `setOfferToken`.

Key files:
- `plugins/tauri-plugin-iap/ios/Sources/IapPlugin.swift:306`
- `plugins/tauri-plugin-iap/ios/Sources/IapPlugin.swift:547`
- `plugins/tauri-plugin-iap/android/src/main/java/app/tauri/iap/IapPlugin.kt:206`
- `plugins/tauri-plugin-iap/android/src/main/java/app/tauri/iap/IapPlugin.kt:223`

## P0 / P1 Findings

### P0: Store offer match does not gate partner credit

`verify_purchase.js` computes whether the verified store transaction had a matching offer:

- Apple: `result.offerIdentifier === claims.appleOfferId`
- Google: `result.offerId === claims.googleOfferId`

But `codes.attributePurchase()` decides `verified` only from `claims.classification !== "unknown"` and `claims.partnerId`. It writes the initial ledger row whenever `verified` is true, regardless of `offerApplied`.

References:
- `infra/terraform/lambda/verify_purchase.js:391`
- `infra/terraform/lambda/verify_purchase.js:410`
- `infra/terraform/lambda/codes.js:466`
- `infra/terraform/lambda/codes.js:525`

Why it matters:
- If Android fails to find the Play offer token, a plain purchase can still be attributed and credited as a discount+affiliate code.
- If Apple delivers a different transaction while a pending token exists, the partner can be credited even if the StoreKit offer identifier did not match.
- The row records `offerApplied: false`, but payout ledger credit still happens.

Recommended fix:
- Split "affiliate attribution" from "discount offer verified".
- For `discount` and `discount+affiliate`, require `offerApplied === true` before initial ledger credit and before returning a "redeemed" attribution.
- For pure `affiliate`, allow attribution without a store offer.
- Add tests:
  - discount+affiliate + mismatched Apple offer -> no ledger
  - discount+affiliate + missing Android offer -> no ledger
  - affiliate-only + no offer -> ledger allowed

### P0: Code validity windows are not enforced

Seed rows contain `validFrom` and optional `validTo`, and the loader writes them. The resolver only checks:

```js
const active = meta && meta.active !== false;
```

References:
- `infra/codes/seed.json:14`
- `infra/codes/load_seed.py:83`
- `infra/codes/load_seed.py:90`
- `infra/terraform/lambda/codes.js:722`

Why it matters:
- Pre-launch codes can be used early.
- Expired campaigns keep resolving unless someone manually flips `active`.
- This is especially risky for public creator/affiliate codes.

Recommended fix:
- Add `isCodeCurrentlyActive(meta, now)`:
  - `active !== false`
  - `validFrom` absent or `Date.parse(validFrom) <= now`
  - `validTo` absent or `now < Date.parse(validTo)`
- Return `unknown` or a structured expired/not-yet-valid error. Prefer a generic UI message but log exact reason server-side.
- Add unit tests for inactive, future, expired, and malformed date rows.

### P0: Resolution tokens are not bound to product, platform, or base plan

The frontend sends `productId` to `/code/resolve`, but the backend ignores it. The minted token stores code, subject, offer IDs, and classification, but not product/platform/base plan.

References:
- `corpan-app/src/contentPacks/purchase.ts:952`
- `infra/terraform/lambda/codes.js:689`
- `infra/terraform/lambda/codes.js:155`
- `infra/terraform/lambda/codes.js:773`

Why it matters:
- An annual-only campaign code can be resolved and then attached to a monthly purchase.
- If future campaigns have different offers per product, the current token cannot prove which offer/product was intended.
- Backend verification compares offer id but not product/base plan binding.

Recommended fix:
- Include `platform`, `productId`, and `basePlanId` in the token claims.
- Validate them in `/verify-purchase` against the verified transaction result.
- Reject or skip attribution when a mismatch is detected.
- Make `/code/resolve` actually use `productId` when selecting a store offer.

### P1: Android offer-token fallback can silently become plain purchase + credited code

`resolveOfferToken()` returns `undefined` when no matching live Play offer is found. The caller still proceeds with `purchaseAndVerify()` and still sends `resolutionToken`.

References:
- `corpan-app/src/contentPacks/purchase.ts:999`
- `corpan-app/src/contentPacks/purchase.ts:264`
- `corpan-app/src/contentPacks/purchase.ts:269`

Why it matters:
- A misconfigured Play Console offer can cause users to pay full price while the app says "Redeem code".
- The backend can still credit the affiliate unless P0 above is fixed.

Recommended fix:
- For `USE_OFFER_TOKEN`, fail closed if no offer token is found.
- Show a recoverable UI state: "This offer is temporarily unavailable. Try again or continue without the code."
- Only allow plain purchase after explicit user confirmation and without discount attribution.

### P1: Apple pending resolution can attach to the wrong transaction

Apple redemption is asynchronous. The app stores one module-level pending token, then attaches it to the next delivered `purchaseUpdated` transaction.

References:
- `corpan-app/src/contentPacks/purchase.ts:1099`
- `corpan-app/src/contentPacks/purchase.ts:1120`
- `corpan-app/src/contentPacks/purchase.ts:1226`
- `corpan-app/src/contentPacks/purchase.ts:1231`

Why it matters:
- The pending token is returned by `takePendingResolution()` but not cleared until after verification finishes.
- Two quick transaction updates can both see the same pending token.
- An unrelated transaction delivered within 15 minutes can receive the code token.

Recommended fix:
- Clear the pending token immediately when taking it.
- Store intended `productId`, `platform`, and `code` with the pending record.
- Verify the incoming transaction product before attaching the token.
- Add a one-shot local id or nonce to the pending flow so logging can prove which transaction consumed it.

### P1: Renewal ledger rows lose revenue share

Initial ledger rows carry `revenueSharePct` from the resolution token. The attribution lock does not store that percentage, and notification handlers do not pass it to `creditRenewal()`.

References:
- `infra/terraform/lambda/codes.js:536`
- `infra/terraform/lambda/codes.js:510`
- `infra/terraform/lambda/verify_purchase.js:576`
- `infra/terraform/lambda/verify_purchase.js:578`
- `infra/terraform/lambda/codes.js:620`

Why it matters:
- Renewal ledger rows currently default to `null` revenue share.
- Any payout job has to rediscover the rate from somewhere else or use a partner default, which can be wrong if campaign-specific shares exist.

Recommended fix:
- Store `revenueSharePct` on `ATTRIBUTION`.
- Return it from `getAttribution()` and `findSubjectByObfHash()`.
- Pass it into `creditRenewal()` for Apple and Google renewal events.
- Add tests asserting renewal ledger rows preserve the initial campaign share.

### P1: In-memory rate limiting is not durable

`/code/resolve` uses a process-local token bucket keyed by subject+IP.

References:
- `infra/terraform/lambda/codes.js:647`
- `infra/terraform/lambda/codes.js:700`

Why it matters:
- It only works per warm Lambda container.
- Parallel cold starts or distributed IPs can enumerate codes.
- The endpoint is public and CORS echoes arbitrary origins.

Recommended fix:
- Add durable counters with DynamoDB TTL, API Gateway usage plans, WAF rate limits, or CloudFront/WAF in front of the API.
- Log unknown-code rate by IP/subject.
- Keep client UI generic, but preserve exact server metrics.

## UI / UX Findings

### The paywall shell is strong

Observed in browser:
- Full-screen dark surface feels premium.
- Corpán mark, value headline, plan selector, trial panel, legal links, and restore are coherent.
- The annual savings chip works and the plan selector is readable.

What to keep:
- Dark full-screen paywall.
- Plan selector above CTA.
- Trial reassurance line and auto-renew notice.
- Restore and legal links in the same flow.

### Code field hierarchy is too low for campaign traffic

The code field appears after the primary CTA. This avoids training users to expect discounts, but for affiliate/campaign traffic it is easy to miss.

References:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:664`
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:673`

Recommended fix:
- Default direct organic paywall: keep a compact "Have a code?" affordance.
- Campaign/deep-link paywall: prefill the code, expand the field, and put the resolved offer above the CTA.
- Add support for `?code=IAN30` / campaign link handoff.
- When a valid discount resolves, move the success badge above the CTA or restyle CTA as the offer action.

### Input surface is too bright on the dark paywall

In the dark paywall, the input renders as a white field because it uses `bg-background` and the paywall palette does not override `--background`.

Reference:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:689`
- `corpan-app/src/components/paywall/PaywallSheet.tsx:38`

Recommended fix:
- In chromeless/dark paywall mode, make the input a dark translucent field with a light border.
- Alternatively set `--background` inside `PAYWALL_PALETTE`.
- Add focus and success states that feel native to the premium surface.

### Discount success copy can mix languages

The browser render was Korean UI with an English backend label: "30% off your first year". Backend only has a small built-in catalog.

References:
- `infra/terraform/lambda/codes.js:231`
- `infra/terraform/lambda/codes.js:262`
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:717`

Recommended fix:
- Return a stable `discountLabelKey` plus parameters from the backend and let app i18n render it.
- Or store 54-locale labels in the registry.
- Avoid server-side string assembly for user-visible paywall copy unless it uses the same locale catalog as the app.

### Subscription periods are not localized

The Korean screenshot still showed "7 days". `periodLabelFromIso()` returns English labels directly.

Reference:
- `corpan-app/src/contentPacks/purchase.ts:335`

Recommended fix:
- Return structured period data (`{ value: 7, unit: "day" }`) from the parser.
- Render with i18n pluralization in the component.
- This is point-of-sale copy, so it should get the same translation rigor as plan names and CTAs.

### "Redeem code" is wrong for affiliate-only codes

The CTA flips to "Redeem code" whenever classification is not `unknown`.

References:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:513`
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:520`

Why it matters:
- Pure affiliate codes do not redeem a discount or native offer.
- "Redeem" implies a price change or store redemption.

Recommended fix:
- Drive CTA by `purchaseAction` and whether a discount exists:
  - `REDEEM_APPLE_SHEET`: "Redeem code"
  - `USE_OFFER_TOKEN`: "Redeem offer"
  - `ATTRIBUTE_ONLY`: keep "Start Free Trial" / "Subscribe"; show "Partner credited"
  - `ATTRIBUTE_UNVERIFIED`: keep normal CTA

### Valid discount should affect price presentation, not just a small status line

Currently the resolved discount is tiny green text below the input. For a high-converting paywall, the discount should change the offer hierarchy.

Reference:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:717`

Recommended fix:
- Show a check icon or badge: "IAN30 applied".
- Show "30% off first year" near the annual plan.
- If store data can support it, show first-year price and renewal price:
  - "$27.99 first year"
  - "$39.99/year after"
- CTA: "Start 30% off" or "Redeem 30% off".

### Unknown code UI may validate typos psychologically

Unknown codes return `classification: "unknown"` and the UI says the code will be attached.

References:
- `infra/terraform/lambda/codes.js:722`
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:710`

Why it matters:
- A user with a mistyped affiliate code may think the discount worked.
- If unknown attribution is for manual support, it should not look like success.

Recommended fix:
- For unknown: "No discount found. You can still continue."
- If you want manual unverified attribution, keep it backend-only or behind muted copy.
- Do not use green/success styling for unknown.

### Apple redeem flow should explain re-entry

The native iOS command opens Apple's generic redeem sheet. The command does not prefill or use the code payload; the user may need to type the code again.

References:
- `corpan-app/src/contentPacks/purchase.ts:1041`
- `plugins/tauri-plugin-iap/src/commands.rs:55`
- `plugins/tauri-plugin-iap/src/mobile.rs:102`
- `plugins/tauri-plugin-iap/ios/Sources/IapPlugin.swift:547`

Recommended fix:
- Copy for Apple path: "Open App Store redeem screen" or "Redeem in App Store".
- Optionally show "You may need to enter IAN30 again."
- Keep the app field for attribution, but do not imply the app can force a specific StoreKit offer code into the native sheet.

## Frontend Implementation Findings

### Stale resolve responses are only guarded by code, not selected product

The resolve effect depends on `selectedProductId`, but the response guard only compares the typed code.

Reference:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:196`

Why it matters:
- If a user switches monthly/annual while a resolve request is in flight, a stale response can set status for the wrong product.

Recommended fix:
- Use a monotonically increasing request id.
- Or store `{ code, productId }` in status and compare both before setting resolved state.

### Code check errors lose useful distinction

The resolver returns exact errors such as rate limited, code check failed, and invalid format. The UI usually shows the same "That code doesn't unlock a discount" message.

References:
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:201`
- `corpan-app/src/components/packs/SubscriptionOffer.tsx:691`

Recommended fix:
- Keep invalid/unknown generic.
- Treat network/rate-limit/server errors as temporary:
  - "Could not check this code. Try again."
- Do not tell users a real code is invalid when the backend is down.

### `code_redeemed` analytics can fire for unknown codes

`trackCodeRedeemed()` fires when attribution is `verified` or `locked`. `attributePurchase()` returns `locked: true` even for unknown/unverified attribution.

References:
- `corpan-app/src/contentPacks/purchase.ts:1424`
- `infra/terraform/lambda/codes.js:543`
- `infra/terraform/lambda/codes.js:545`

Recommended fix:
- Return a real `locked` value.
- Track redeemed only when the backend says the code was verified and, for discount codes, the offer matched.
- Add `code_attached_unverified` if that state is valuable.

### Analytics includes raw codes

`trackSubscriptionPurchased()` sends the raw code string.

Reference:
- `corpan-app/src/util/analytics.ts:314`

Why it matters:
- Campaign codes can become high-cardinality analytics values.
- Some codes may be private or pre-release.

Recommended fix:
- Emit `had_code`, `classification`, `purchase_action`, and maybe a backend-provided low-cardinality campaign id.
- Avoid raw code values in analytics unless explicitly needed and governed.

### Dev listener install is not concurrency-safe

In the browser run under React StrictMode, the StoreKit purchase-updated listener installed twice. This is dev-only in the observed case, but the install guard is not promise-based.

References:
- `corpan-app/src/contentPacks/purchase.ts:1130`
- `corpan-app/src/contentPacks/purchase.ts:1142`
- `corpan-app/src/App.tsx:202`

Recommended fix:
- Store an in-flight install promise, not just the resolved listener.
- Make the disposer reference-counted or ignore StrictMode duplicate calls.

### Dev debug global is overwritten

`installDevDebug()` adds monetization helpers to `window.__corpanDebug`, then `main.tsx` later replaces the object with voice helpers.

References:
- `corpan-app/src/main.tsx:38`
- `corpan-app/src/main.tsx:48`
- `corpan-app/src/util/devDebug.ts:30`

Recommended fix:
- Change `main.tsx` to merge into the existing object:
  - `Object.assign(window.__corpanDebug ??= {}, { getVoices, ... })`
- This is not release-blocking, but it made browser inspection harder.

## Backend Findings

### Partner status is not enforced during resolve

The seed contains partner rows with `status`, but resolve only reads the code row and uses denormalized/fallback partner display data.

References:
- `infra/codes/seed.json:3`
- `infra/terraform/lambda/codes.js:765`
- `infra/terraform/lambda/codes.js:828`

Recommended fix:
- Read `PARTNER#<partnerId> / META` on verified code hits.
- Require partner status active before partner credit.
- Use partner row as display/payout source of truth, with optional denormalized cache for latency.

### No usage caps or redemption counters

Store-managed offer codes may have their own platform limits, but registry affiliate-only codes and attribution locks do not enforce campaign caps.

Recommended fix:
- Add optional fields: `maxInitialCredits`, `maxSubjects`, `maxPerSubject`, `campaignBudgetCents`.
- Enforce with conditional counters or transactional writes.
- Add admin reporting before public campaigns.

### JWT implementation should validate header and support rotation

The HS256 signature check is constant-time, but `verifyJwt()` does not validate header fields such as `alg` or `kid`, and there is only one active key.

References:
- `infra/terraform/lambda/codes.js:112`
- `infra/terraform/lambda/codes.js:123`

Recommended fix:
- Parse and validate header: `alg === "HS256"`, `typ === "JWT"`, expected/known `kid`.
- Support a key map for rotation: current signing key plus previous verification keys.
- Enforce a minimum decoded key length of at least 32 bytes.

### Attribution can run for verified but inactive subscriptions

`/verify-purchase` attributes whenever token validation succeeds, even if `result.subscriptionActive` is false. Apple/Google verification can return a verified transaction that is expired or inactive.

References:
- `infra/terraform/lambda/verify_purchase.js:347`
- `infra/terraform/lambda/verify_purchase.js:389`
- `infra/terraform/lambda/verify_purchase.js:399`

Recommended fix:
- Only write initial attribution/ledger for an active subscription or a fresh, non-expired initial purchase.
- Keep restore/entitlement behavior separate.

### `locked: attrRes.written || true` is always true

The attribution response always reports `locked: true`.

Reference:
- `infra/terraform/lambda/codes.js:545`

Recommended fix:
- Return `locked: attrRes.written === true || attrRes.conditional === true`.
- Better: return `lockWritten`, `lockExisting`, and `ledgerWritten` separately for analytics and support.

### CORS and public API posture should be intentional

The Lambda echoes any origin and the code resolve endpoint is public.

References:
- `infra/terraform/lambda/verify_purchase.js:20`
- `infra/terraform/lambda/verify_purchase.js:24`

Recommended fix:
- Keep permissive CORS if needed for custom schemes, but pair it with durable rate limiting and structured abuse logging.
- Consider requiring a low-friction app build token if enumeration becomes real.

### DynamoDB GSI projection includes `subjectId` that rows do not store

Rows derive subject from `PK`; the GSI projection lists `subjectId`.

References:
- `infra/terraform/main.tf:110`
- `infra/terraform/lambda/codes.js:397`

Recommended fix:
- Either store `subjectId` explicitly or remove it from the projection.
- Low severity; mostly cleanup/documentation consistency.

## Native IAP Findings

### Apple command payload mismatch

JS invokes `present_offer_code_redeem_sheet` with `payload: { appleOfferId }`, but the Rust/mobile/iOS command path takes no payload and opens a generic StoreKit sheet.

References:
- `corpan-app/src/contentPacks/purchase.ts:1048`
- `plugins/tauri-plugin-iap/src/commands.rs:55`
- `plugins/tauri-plugin-iap/src/mobile.rs:102`
- `plugins/tauri-plugin-iap/ios/Sources/IapPlugin.swift:547`

Recommended fix:
- Align the contract:
  - Either remove `appleOfferId` from the command call and document generic redemption.
  - Or implement a native path that actually uses a store-supported code/offer construct, if possible.

### Android native offer selection is good, but should fail louder on explicit offer failure

Android correctly prefers an explicit `offerToken` and falls back to trial/base-plan offers when no token is provided.

References:
- `plugins/tauri-plugin-iap/android/src/main/java/app/tauri/iap/IapPlugin.kt:206`
- `plugins/tauri-plugin-iap/android/src/main/java/app/tauri/iap/IapPlugin.kt:223`

Recommended fix:
- For explicit code purchases, make "no matching offer token" a frontend hard stop before native purchase.
- Log missing offer id/base plan/tag with enough metadata to catch Play Console drift.

## Observability / Operations

Add dashboard counters:
- code resolves by classification/action
- unknown code rate
- resolve errors by status
- offer-token lookup failures
- Apple pending-token consumed vs expired
- attribution skipped because offer mismatch
- ledger writes by partner/campaign
- renewal credits with null revenue share

Add support tools:
- lookup subject attribution by subject id / obfuscated hash
- lookup code metadata and active window
- dry-run resolve endpoint for a code/platform/product
- export partner ledger by month
- code deactivation script

Add alarms:
- code resolve 5xx spike
- code resolve 429 spike
- attribution non-fatal failure spike
- notification verification failures
- renewal credit failures

## Testing Gaps

Existing backend tests cover classification, resolve branches, token validation, idempotency, first-touch locks, entitlement rows, and renewals. Missing tests to add:

- `validFrom` future code does not resolve as active.
- `validTo` expired code does not resolve as active.
- `productId` is included in resolution claims.
- verify rejects or skips attribution on product mismatch.
- discount+affiliate with `offerApplied: false` writes no ledger.
- pure affiliate with no offer still attributes.
- Android `USE_OFFER_TOKEN` without a live offer token blocks purchase.
- Apple pending token is consumed once and cleared immediately.
- stale frontend resolve for old selected plan is ignored.
- unknown attribution does not emit `code_redeemed`.
- renewal ledger preserves `revenueSharePct`.

Browser/UI tests to add:

- paywall ready state in English and a long-locale language.
- resolved discount state.
- unknown-code state.
- server-error code state.
- Android missing-offer-token state.
- Apple redeem-sheet explanatory copy.
- dark-paywall input color contrast.

## Translation Follow-Up

Completed in this branch:
- Added translations for:
  - `settings.home`
  - `settings.developer`
  - `subscription.rate`
  - `home.packUpdates`
  - `home.updateAll`
- Removed unused rating keys from every locale's `rating` object:
  - `rating.remindLater`
  - `rating.noThanks`
- Left unrelated `update.remindLater` strings intact because they are a different namespace and still present.

Validation run:
- `npm run check:i18n` passed.
- Structured locale check passed across 54 locale files.

## Recommended Next Work

1. Fix backend enforcement first:
   - active windows
   - product/platform/base-plan token binding
   - ledger credit only when required offer matched
   - renewal revenue share preservation

2. Fix frontend purchase behavior:
   - fail closed on missing Android offer token
   - clear Apple pending token immediately
   - make CTA depend on `purchaseAction`, not only classification
   - suppress `code_redeemed` for unverified/unknown codes

3. Upgrade paywall code UX:
   - dark input surface
   - applied-offer badge
   - discount price treatment
   - campaign code prefill/deep-link flow
   - localized period labels and discount labels

4. Add operations:
   - durable rate limiting
   - metrics/alarms
   - partner ledger export
   - code active/deactivate tooling

