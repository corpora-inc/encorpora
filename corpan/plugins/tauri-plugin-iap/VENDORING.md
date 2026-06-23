# Vendoring

This directory is a vendored copy of [Choochmeque/tauri-plugin-iap](https://github.com/Choochmeque/tauri-plugin-iap).

## Pinned version

- **Upstream tag:** `v0.8.2`
- **Upstream commit:** `21e1916e6bea6489626107e102438910bbd64c27`
- **Vendored on:** 2026-04-23

## Why vendored

The upstream plugin has no retry logic around StoreKit's
`Product.products(for:)`, which is known to transiently return empty
sets in sandbox. Vendoring gives us the option to patch Swift/Kotlin
directly (e.g. add retry at the native layer, expose richer errors,
add logging hooks) without waiting on upstream.

Today we are carrying **no local patches** — the vendored source
is an unmodified snapshot of `v0.8.2`. Any divergence should be
documented in this file under "Local patches" below as it accrues.

## Wire-up

`corpan/corpan-app/src-tauri/Cargo.toml` references this directory
via a path dependency:

```toml
tauri-plugin-iap = { path = "../../plugins/tauri-plugin-iap" }
```

JS side: the app uses raw `invoke("plugin:iap|...")` calls against the
plugin's Tauri commands — it does NOT import from the
`@choochmeque/tauri-plugin-iap-api` npm package. No JS wire-up needed
here.

## Re-syncing from upstream

```sh
cd corpan/plugins
rm -rf tauri-plugin-iap
git clone --depth 1 --branch v<next-tag> https://github.com/Choochmeque/tauri-plugin-iap.git
cd tauri-plugin-iap && rm -rf .git .github .gitignore
# Re-apply any entries from "Local patches" below.
# Update this file's pinned version.
```

## Local patches

- **0.11.7 (2026-04-26)** — `android/src/main/java/app/tauri/iap/IapPlugin.kt`:
  Cross-platform parity + missing-state handling.
  - `handlePurchase` now explicitly handles `Purchase.PurchaseState.PENDING`
    (slow payment methods like carrier billing) by rejecting with
    `PURCHASE_PENDING:` — without this branch the pending invoke stayed
    set forever and JS hung. Matches iOS `.pending` behaviour.
  - `onPurchasesUpdated` now distinguishes more
    `BillingClient.BillingResponseCode` cases and prefixes every reject
    with a stable error code so the JS classifier (`classifyError` in
    `purchase.ts`) treats Android and iOS errors symmetrically:
    `USER_CANCELLED`, `ALREADY_OWNED` (ITEM_ALREADY_OWNED),
    `PRODUCT_UNAVAILABLE` (ITEM_UNAVAILABLE),
    `PURCHASE_NOT_ALLOWED` (BILLING_UNAVAILABLE / FEATURE_NOT_SUPPORTED),
    `NETWORK_ERROR` (SERVICE_DISCONNECTED / SERVICE_UNAVAILABLE /
    NETWORK_ERROR), `STOREKIT_UNKNOWN` (catch-all).
  - "OK with empty purchases list" (Google emits this on some sheet
    dismissals) now rejects with `USER_CANCELLED:` instead of leaving
    the invoke pending.
  - All other rejects in the file (`Billing client not ready`,
    `Failed to fetch products`, `Product not found`, restore /
    acknowledge / status failures) now prefix with the matching code
    so JS error classification works the same on both platforms.

- **0.11.7 (2026-04-25)** — `ios/Sources/IapPlugin.swift`:
  Complete StoreKit 2 spec coverage and resilience patch.
  - Internal retry on `Product.products(for:)` with 0/0.5/1.5/3.5s
    backoff (transient empty + StoreKitError thrown). Applied in
    `getProducts`, `purchase`, and `getProductStatus`.
  - `isProductCurrentlyOwned()` pre-failure check — if the product
    is in `Transaction.currentEntitlements`, surface
    `ALREADY_OWNED` instead of misleading `PRODUCT_UNAVAILABLE`.
  - `AppStore.canMakePayments` guard at start of `purchase` (SK2
    native; replaces what would have been `SKPaymentQueue.canMakePayments()`).
  - Exhaustive `Product.PurchaseError` mapping (8 cases) and
    `StoreKitError` mapping (7 cases). Every reject from the
    plugin now starts with a stable error code:
    `INVALID_QUANTITY`, `PRODUCT_UNAVAILABLE`,
    `PURCHASE_NOT_ALLOWED`, `INELIGIBLE_FOR_OFFER`,
    `INVALID_OFFER_ID`, `INVALID_OFFER_PRICE`, `INVALID_OFFER_SIG`,
    `MISSING_OFFER_PARAMS`, `STOREKIT_UNKNOWN`, `USER_CANCELLED`,
    `NETWORK_ERROR:<URLError code>`, `SYSTEM_ERROR`,
    `NOT_IN_STOREFRONT`, `NOT_ENTITLED`, `VERIFICATION_FAILED`,
    `PURCHASE_PENDING`, `PURCHASE_UNKNOWN`, `ALREADY_OWNED`,
    `INVALID_APP_ACCOUNT_TOKEN`, `UNKNOWN`.
  - `.pending` (Ask-to-Buy / SCA) treated as `PURCHASE_PENDING`,
    not a generic error — JS surfaces a "waiting for approval"
    state.
  - `Transaction.unfinished` drained at plugin load before the
    `Transaction.updates` listener takes over — prevents stale
    confirmations from replaying after a kill-and-relaunch.
  - `Transaction.environment` (iOS 16+) logged on every verified
    purchase and emitted to JS in the purchase object.
  - `RenewalState` exhaustively mapped (subscribed,
    inGracePeriod, inBillingRetryPeriod → owned; expired,
    revoked → not owned; future cases default to not owned).
  - `Transaction.latest(for:)` used in `getProductStatus` instead
    of iterating `currentEntitlements`.
  - `restorePurchases` no longer uses `try?` to swallow per-product
    fetch errors — logs each and continues (best-effort across
    products).
