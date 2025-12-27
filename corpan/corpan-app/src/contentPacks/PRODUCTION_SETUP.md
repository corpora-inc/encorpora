# Production content packs: external setup checklist

This document lists **manual/out-of-repo** setup required to make production content packs work end‑to‑end across iOS, Android, and desktop. Everything here is intentionally minimal and should only be done once per environment.

## 1) AWS (S3 + Lambda + IAM)
- Create AWS account (org root + billing).
- Create an S3 bucket for pack artifacts (immutable versioned paths).
  - Enable versioning and default encryption.
  - Block public access; prefer pre‑signed URLs from Lambda.
- Create Lambda (or API Gateway + Lambda) for `/verify-purchase`.
  - Store platform credentials (Apple/Google) in AWS Secrets Manager.
  - Lambda returns `{ manifestUrl, manifestHash, version }` on success.
- Create IAM roles:
  - CI publish role (write to S3 + update catalog if used).
  - Lambda role (read S3 + read Secrets Manager).
- Optional: create CloudWatch logs + alarms.

## 2) Apple App Store Connect
- Create App Store Connect account and app record.
- Create in‑app purchase product (non‑consumable) for `hover_runner`.
- Configure StoreKit testing (sandbox test users).
- Generate App Store Server API key (for receipt validation if used).
- Ensure app bundle ID + Team ID match iOS build.

## 3) Google Play Console
- Create Play Console account and app listing.
- Create in‑app product (one‑time purchase) for `hover_runner`.
- Configure Play Console licensing / test accounts.
- Create Google Play Developer API credentials (for purchase verification).
- Ensure Android package name matches build (`com.corpora.corpan`).

## 4) Domain + TLS (if using hosted catalog)
- Buy/assign a domain for catalog/verify endpoints.
- Configure TLS (ACM or equivalent) so iOS ATS allows HTTPS.

## 5) Signing keys
- Generate an Ed25519 (or ECDSA) keypair for pack signing.
  - Keep private key in CI secret store.
  - Bake public key into the app.
- Decide on key rotation policy (annual or on compromise).

## 6) Store distribution assets
- Upload store screenshots, description, privacy policy, support URL.
- Configure age rating + data safety disclosures.

## Assumptions the repo expects
- `VITE_GAME_VERIFY_URL` points to `/verify-purchase` in prod.
- `VITE_ENABLE_GAMES` enables the in-app games panel (default: hidden in prod).
- Pack bundles are uploaded to S3 with immutable versioned URLs.
- Packs include `manifest.json` and are zipped for download.
- The app has internet access and can write to app data dir.
- Store product IDs are stable and mapped to pack IDs in backend.

## Verify-purchase contract (MVP)
Request:
```json
{
  "platform": "ios|android",
  "productId": "corpan.pack.hover_runner",
  "receipt": "BASE64_APPLE_RECEIPT",
  "purchaseToken": "ANDROID_PURCHASE_TOKEN"
}
```

Response (success):
```json
{
  "status": "verified",
  "transactionId": "string",
  "manifestUrl": "https://...",
  "manifestHash": "sha256-hex",
  "version": "0.1.0"
}
```

Response (failure):
```json
{
  "status": "failed",
  "error": "string"
}
```

## Secrets Manager schema (expected)
```json
{
  "apple": {
    "issuerId": "",
    "keyId": "",
    "privateKeyPem": ""
  },
  "google": {
    "serviceAccountJson": ""
  }
}
```

## S3 object layout (recommended)
- `s3://corpan-prod/packs/hover_runner/<version>/manifest.json`
- `s3://corpan-prod/packs/hover_runner/<version>/pack.zip`

## Optional (defer for MVP)
- Hosted catalog `/catalog` endpoint.
- ODR/PAD delivery (platform asset packs).
- Background download + resumable transfer.
