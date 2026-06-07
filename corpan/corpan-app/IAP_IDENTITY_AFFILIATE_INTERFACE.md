# IAP Identity And Affiliate Interface

This app release locks the client-side contract for later server and pack work. It is intentionally backward-compatible with the current purchase verification backend: unknown request fields can be ignored, and new client lookups tolerate missing server routes.

## Anonymous Subject

- The app creates one per-install UUID subject ID with `getCorpanSubjectId()`.
- The UUID is persisted locally under `corpan:subject-id:v1` and in the entitlement store.
- iOS/macOS purchases send this UUID as StoreKit `appAccountToken`.
- Android purchases send `SHA-256(subjectId)` as `obfuscatedAccountId`.
- The subject is not a login, email, or UGC identifier.

## Purchase Verification

`verifyPurchase()` now includes:

```json
{
  "platform": "ios",
  "productId": "corpan.sub.annual",
  "transactionId": "...",
  "subjectId": "uuid-v4",
  "affiliateCode": "OPTIONAL_CODE"
}
```

Expected future response fields:

```json
{
  "status": "verified",
  "subscriptionActive": true,
  "expiresAt": "2026-07-07T00:00:00.000Z",
  "subjectId": "uuid-v4",
  "plus": true,
  "entitlementToken": "short-lived-token",
  "affiliateAttribution": {
    "code": "SCHOOL_A",
    "locked": true,
    "message": "Code applied"
  }
}
```

The app stores `entitlementToken` in memory only. It persists `subjectId`.

## Affiliate Codes

- The subscription UI accepts an optional affiliate code before purchase.
- Client-side format is uppercase `A-Z`, `0-9`, `_`, `-`, max length 32.
- `/affiliate/resolve` is optional for this release. A missing route is treated as "send the code with purchase later" so old backends do not block subscriptions.

## Pack Entitlement Bridge

`ContentPackHost` now passes:

```ts
{
  plus: boolean
  subjectId: string | null
  entitlementToken: string | null
  subscription: {
    active: boolean
    plan: "monthly" | "annual" | null
    expiresAt: string | null
    autoRenew: boolean | null
    lastRefreshed: number | null
  }
}
```

This snapshot is passed as the pack `entitlement` init field and also published through `globalThis.__CORPAN_ENTITLEMENT`.
