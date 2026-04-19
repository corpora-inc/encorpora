# IAP Implementation State — 2026-04-18

## What's Done (Code Complete)

### Phase 0A: IAP Plugin Integration
- `tauri-plugin-iap = "0.8"` added to `corpan-app/src-tauri/Cargo.toml`
- Plugin registered in `corpan-app/src-tauri/src/lib.rs` (`.plugin(tauri_plugin_iap::init())`)
- `"iap:default"` added to `corpan-app/src-tauri/capabilities/default.json`
- iOS deployment target bumped 14.0 → 15.0 in `src-tauri/ios/project.yml`
- `StoreKit.framework` added to iOS dependencies in `project.yml`
- Entitlements file created: `src-tauri/ios/corpan_iOS/corpan_iOS.entitlements`
- NPM package installed: `@choochmeque/tauri-plugin-iap-api` v0.8.2
- StoreKit test config: `src-tauri/ios/Corpan.storekit` (subscriptions + sample product)

### Phase 0B: CloudFront Signed URL Infrastructure
- `infra/terraform/main.tf` updated:
  - `aws_cloudfront_public_key` + `aws_cloudfront_key_group` resources (gated by `enable_premium_content` var)
  - `ordered_cache_behavior` for `narrations/premium/*` with `trusted_key_groups`
  - Secrets Manager schema updated with `cloudfront.signingPrivateKey`, `apple.bundleId`, `google.packageName`
  - Lambda env vars: `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CATALOG_URL`
  - New API Gateway routes: `/subscription-status`, `/apple-notifications`, `/google-notifications`
  - Lambda IAM policy updated with S3 ListBucket for premium prefix
- `infra/terraform/variables.tf`: added `enable_premium_content`, `cloudfront_signing_public_key_pem`
- `infra/terraform/outputs.tf`: added `premium_key_group_id`, `premium_public_key_id`

### Phase 1: Lambda Backend
- `infra/terraform/lambda/verify_purchase.js` — COMPLETE REWRITE from 501 stub to:
  - Apple receipt verification via App Store Server API v2 (JWS signed transactions)
  - Google receipt verification via Play Developer API (products + subscriptions)
  - CloudFront signed URL generation (1-hour expiry)
  - Routes: `/verify-purchase`, `/subscription-status`, `/apple-notifications`, `/google-notifications`
  - Dev bypass via `x-dev-bypass` header
  - CORS headers included
- `infra/terraform/lambda/package.json` + `node_modules/` installed:
  - `@apple/app-store-server-library`, `googleapis`, `@aws-sdk/client-secrets-manager`, `@aws-sdk/cloudfront-signer`

### Phase 2: Frontend
- **`src/store/entitlements.ts`** — NEW Zustand store:
  - `purchasedProducts: string[]` — product IDs of individually purchased items
  - `subscription: { active, plan, expiresAt, autoRenew }`
  - `isEntitled(productId)` — returns true if purchased OR subscribed
  - Persisted to localStorage as `corpan-entitlements-v1`

- **`src/contentPacks/purchase.ts`** — REWRITTEN from 63-line stub to full IAP orchestration:
  - `fetchProducts(ids[], type)` — get localized prices from store
  - `purchaseProduct(productId, type)` — triggers Face ID / biometric
  - `restorePurchases()` — restores from Apple ID / Google account
  - `getProductStatus(productId, type)` — check ownership
  - `verifyPurchase(purchase, packId?)` — calls Lambda backend
  - `purchaseAndVerify(productId, packId?, type)` — full orchestrated flow: purchase → verify → acknowledge → update entitlements → return signedUrl
  - `refreshEntitlements()` — on-device check via IAP plugin (no network)
  - `restoreAndSync()` — restore + verify each with backend
  - Constants: `SUBSCRIPTION_MONTHLY = "corpan.sub.monthly"`, `SUBSCRIPTION_ANNUAL = "corpan.sub.annual"`
  - Platform detection: `getPlatform()`, `isIapAvailable()`

- **`packs/shared/catalog/src/installManager.ts`** — UPDATED:
  - `installNarration()` now accepts optional `purchaseInfo` param
  - For premium packs (`tier === "premium"` && `purchase.type === "iap"`), requests signed URL from backend before downloading
  - Free packs unchanged

- **`src/components/packs/PackActions.tsx`** — UPDATED:
  - Imports `useEntitlementStore` and `purchaseAndVerify`
  - Premium + not entitled + IAP available → "Buy $X.XX" button
  - Premium + not entitled + no IAP → "Available on iOS & Android" disabled button
  - Premium + entitled → normal download button
  - Free → unchanged

- **`src/components/packs/SubscriptionOffer.tsx`** — NEW:
  - Subscription banner with monthly/annual toggle
  - Fetches localized prices via `fetchProducts()`
  - Calls `purchaseAndVerify()` on subscribe
  - Only renders if not subscribed and IAP available

- **`src/components/packs/RestorePurchases.tsx`** — NEW:
  - "Restore Purchases" button (Apple requires this for App Store approval)
  - Calls `restoreAndSync()`
  - Shows restored count or error

- **`src/App.tsx`** — UPDATED:
  - Added `import { refreshEntitlements, getPlatform } from "@/contentPacks/purchase"`
  - On mount: `getPlatform().then(() => refreshEntitlements())` alongside catalog fetch

### Phase 3: ttsctl Publisher
- `projects/ttsctl/ttsctl/cli.py` — UPDATED publish command:
  - New flags: `--price` (float), `--product-id` (string)
  - Validation: `--tier premium` requires both `--price` and `--product-id`
  - S3 key: premium packs go to `artifacts/narrations/premium/{zip}` instead of `artifacts/narrations/{zip}`
  - Catalog entry: `purchase.type` = "iap", includes `productId` and `priceLabel`

### TypeScript passes clean
- `npx tsc --noEmit` — 0 errors

---

## What's NOT Done (Store Console Setup)

> **Infrastructure is complete.** Lambda, CloudFront signing, Secrets Manager — all live and verified.
> What remains is Apple/Google store console configuration and app submission.

### Apple App Store Connect (NEEDS VERIFICATION)
- [x] Subscription group created: "Corpan Premium"
- [x] `corpan.sub.monthly` created ($15.99/month)
- [x] `corpan.sub.annual` created ($99.99/year)
- [x] `corpan.book.fascinating_science_volcanoes` created (non-consumable, $4.99)
- [x] Product metadata believed complete (localization, pricing, descriptions) — **verify in ASC console**
- [ ] Paid Apps agreement — may need banking + tax setup — **verify in ASC console**
- [ ] App Store Server Notifications V2 webhook URL: `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/apple-notifications`
- [ ] Build app v0.11.3 IPA and upload — **in progress on build machine**
- [ ] **Attach all 3 IAP products to the 0.11.3 version page** — required before submission
- [ ] Submit for review (Apple reviews app + IAP + subscriptions together)
- [ ] Apply for Small Business Program (15% commission)

### Google Play Console (NEEDS VERIFICATION)
- [x] Service account JSON in Secrets Manager — verified (Lambda reaches API)
- [ ] Verify products created and activated: `corpan.sub.monthly`, `corpan.sub.annual`, `corpan.book.*`
- [ ] Set up Real-Time Developer Notifications webhook: `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/google-notifications`
- [ ] Add license test accounts
- [ ] Build AAB and upload

### Infrastructure (COMPLETE)
- [x] Generate CloudFront signing key pair (RSA 2048) — public key ID: `K2RX7CC6JLAZPW`
- [x] Run `terraform apply` with `enable_cdn=true` and `enable_premium_content=true` — all resources live
- [x] Populate Secrets Manager (`corpan/content-packs/verify`) with:
  - [x] Apple: App Store Connect API key (.p8), key_id, issuer_id — verified via Lambda (API responds, not "credentials not configured")
  - [x] Google: service account JSON — verified via Lambda (API responds with "Invalid Value" for fake token, not "credentials not configured")
  - [x] CloudFront: signing private key PEM — verified via Lambda dev bypass (returns valid signed URL with real signature)
- [x] Test Lambda with dev bypass token — confirmed working (returns `status: "verified"` + `signedUrl`)

**Verified 2026-04-18** by hitting the Lambda endpoint:
- Dev bypass: `POST /verify-purchase` with `x-dev-bypass` header → returns signed CloudFront URL
- Apple path: reaches Apple API (credentials loaded), fails on fake transaction (expected)
- Google path: reaches Google API (credentials loaded), fails on fake token (expected)

> **Note**: `terraform.tfstate` is stale (serial 56, 2026-04-16) — it shows empty secret values because the secrets were populated directly in AWS after the last `terraform apply`. Running `terraform plan` may show drift on the secret version resource. This is expected — Secrets Manager values are managed out-of-band from Terraform.

---

## Key Architecture Decisions

1. **Native IAP** — StoreKit 2 (iOS) + Google Play Billing v8. No login system. Apple ID / Google account = identity.
2. **Book-level purchases** — product ID is per-book, not per-narration. One purchase unlocks all narrations (languages/voices) for that book. Convention: `corpan.book.{bookId}`
3. **Generous lapse** — downloaded content stays accessible forever, even if subscription lapses. Only new downloads require active subscription.
4. **Content gating** — free at `narrations/`, premium at `narrations/premium/` (CloudFront signed URL required, 1hr expiry)
5. **Plugin** — `tauri-plugin-iap` v0.8.2 (community, crates.io). Supports StoreKit 2, Play Billing v8.3, macOS, Windows.
6. **Pricing** — $15.99/month, $99.99/year subscription. Books $3.99-$12.99.

## Product ID Convention
| Product | ID | Type |
|---------|-----|------|
| Monthly sub | `corpan.sub.monthly` | auto-renewable |
| Annual sub | `corpan.sub.annual` | auto-renewable |
| Per-book | `corpan.book.{bookId}` | non-consumable |

## Key File Paths
| File | What |
|------|------|
| `corpan-app/src-tauri/Cargo.toml` | IAP plugin dependency |
| `corpan-app/src-tauri/src/lib.rs` | Plugin registration |
| `corpan-app/src-tauri/capabilities/default.json` | IAP permissions |
| `corpan-app/src-tauri/ios/project.yml` | iOS 15.0, StoreKit framework |
| `corpan-app/src-tauri/ios/corpan_iOS/corpan_iOS.entitlements` | IAP entitlement |
| `corpan-app/src-tauri/ios/Corpan.storekit` | StoreKit test config |
| `corpan-app/src/store/entitlements.ts` | Zustand entitlement store |
| `corpan-app/src/contentPacks/purchase.ts` | IAP orchestration service |
| `corpan-app/src/components/packs/PackActions.tsx` | Buy button + entitlement gating |
| `corpan-app/src/components/packs/SubscriptionOffer.tsx` | Subscription banner |
| `corpan-app/src/components/packs/RestorePurchases.tsx` | Restore button |
| `packs/shared/catalog/src/installManager.ts` | Premium download gating |
| `infra/terraform/main.tf` | CloudFront signed URLs, Lambda, API routes |
| `infra/terraform/lambda/verify_purchase.js` | Receipt verification + signed URL gen |
| `infra/terraform/lambda/package.json` | Lambda dependencies |
| `infra/IAP_SETUP_RUNBOOK.md` | Full manual setup runbook |
| `projects/ttsctl/ttsctl/cli.py` | --price, --product-id publish flags |

## Verify API Endpoint
- Base: `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod`
- Routes: `/verify-purchase`, `/subscription-status`, `/apple-notifications`, `/google-notifications`

## Infrastructure Verification Commands

Test CloudFront signing (dev bypass — returns signed URL if private key is wired):
```bash
curl -s -X POST "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/verify-purchase" \
  -H "Content-Type: application/json" \
  -H "x-dev-bypass: $DEV_BYPASS_TOKEN" \
  -d '{"platform":"ios","productId":"corpan.book.test","packId":"zheng-yi-sao-ian-en"}' | python3 -m json.tool
```
Expected: `"signedUrl": "https://d38iwc9748jekz.cloudfront.net/narrations/premium/..."` with `Key-Pair-Id` and `Signature` params.

Test Apple credentials are loaded (will fail on fake transaction, but error should NOT be "Apple credentials not configured"):
```bash
curl -s -X POST "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/verify-purchase" \
  -H "Content-Type: application/json" \
  -d '{"platform":"ios","productId":"corpan.book.test","transactionId":"fake","receipt":"fake"}' | python3 -m json.tool
```
Expected: `"error": "Apple verification failed: ..."` (NOT "Apple credentials not configured").

Test Google credentials are loaded:
```bash
curl -s -X POST "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/verify-purchase" \
  -H "Content-Type: application/json" \
  -d '{"platform":"android","productId":"corpan.book.test","purchaseToken":"fake"}' | python3 -m json.tool
```
Expected: `"error": "Google verification failed: Invalid Value"` (NOT "Google credentials not configured").

## Versioning Convention

**Book version** (`manifest.json` `"version"` field): Tracks book content (manuscript, segments). Rarely changes.

**Narration version** (`ttsctl publish --version`): Tracks audio narration artifacts. Bumped on any audio republish (fixed segments, re-mastered audio, voice change). Each language can have its own narration version. Shows up in `catalog.json`.

These are separate version spaces. Never conflate them.
