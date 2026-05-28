/**
 * Purchase manager for reader catalog (zero-cache, live-query rewrite).
 *
 * Bridges the reader (running inside the main app's WebView) to the platform
 * IAP plugin. Every entitlement / pricing / status check is a live call —
 * no localStorage snapshots, no in-memory caches.
 *
 * The reader can't import the main app's modules directly, so we talk to
 * Tauri via raw `invoke` and to the main app's React state via custom
 * events:
 *   - `corpan:purchase-recorded`            (productId)
 *   - `corpan:subscription-recorded`        (plan)
 *   - `corpan:restore-purchases-requested`  (no payload)
 *
 * All three are transient signals — the main app re-queries StoreKit /
 * Play Billing on receipt; nothing is stored on the reader side.
 */

import type { CatalogNarrationEntry } from "./types"

/** Canonical subscription product IDs — must match Corpan.storekit. */
export const SUBSCRIPTION_MONTHLY_ID = "corpan.sub.monthly"
export const SUBSCRIPTION_ANNUAL_ID = "corpan.sub.annual"

const PURCHASE_RECORDED_EVENT = "corpan:purchase-recorded"
const SUBSCRIPTION_RECORDED_EVENT = "corpan:subscription-recorded"
const RESTORE_REQUESTED_EVENT = "corpan:restore-purchases-requested"

export type SubscriptionPlan = "monthly" | "annual"

export type StoreProduct = {
  productId: string
  title: string
  description: string
  price: string
  currencyCode: string
  priceMicros?: number
}

type TauriInternals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals
}

type PurchasePlatform = "ios" | "android" | "macos" | "windows" | "desktop"

export type NarrationPurchaseReceipt = {
  transactionId: string
  receipt: string
  platform: PurchasePlatform
}

export type PurchaseOutcome =
  | { kind: "ok"; receipt: NarrationPurchaseReceipt }
  | { kind: "cancelled" }
  | { kind: "alreadyOwned" }
  | { kind: "pending" }
  | { kind: "error"; code: string; message: string }

/**
 * Tri-state result for live entitlement queries. `unknown` is distinct from
 * `false` so the UI can show a "couldn't reach the App Store" message
 * instead of silently hiding the paywall.
 */
export type EntitlementCheck =
  | { ok: true; entitled: boolean }
  | { ok: false; error: string }

function getInvoke(): TauriInternals["invoke"] | null {
  const w = window as TauriWindow
  return w.__TAURI_INTERNALS__?.invoke ?? null
}

// -----------------------------------------------------------------------------
// Platform detection — synchronous, from the OS plugin's window-global.
// -----------------------------------------------------------------------------
//
// `@tauri-apps/plugin-os` does NOT expose invokable Tauri commands. Its JS
// API reads synchronously from `window.__TAURI_OS_PLUGIN_INTERNALS__`,
// which Tauri populates at WebView init. The reader runs in the same
// WebView (the dev game-proxy or the corpan-pack:// scheme), so the global
// is available there too.
//
// Fallback: read what the main app persisted on first launch into
// `corpan-entitlements-v1` localStorage. The main app's `getPlatform()`
// calls `osType()` from the npm package and writes the result via
// `setPlatform(...)`. Reading it from localStorage is fine — platform is
// a device fact, not entitlement state, and we kept it in `partialize`.

type OsPluginWindow = Window & {
  __TAURI_OS_PLUGIN_INTERNALS__?: { os_type?: string; platform?: string }
}

const ENTITLEMENT_LS_KEY = "corpan-entitlements-v1"

export function getReaderPlatform(): PurchasePlatform | null {
  const w = window as OsPluginWindow
  const t = w.__TAURI_OS_PLUGIN_INTERNALS__?.os_type
  if (t === "ios" || t === "android" || t === "macos" || t === "windows") return t

  try {
    const raw = localStorage.getItem(ENTITLEMENT_LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { platform?: string } }
      const p = parsed?.state?.platform
      if (p === "ios" || p === "android" || p === "macos" || p === "windows") return p
    }
  } catch {
    /* ignore */
  }
  return null
}

/** True iff the reader can invoke the IAP plugin on this device. */
export function isIapAvailable(): boolean {
  const p = getReaderPlatform()
  return p === "ios" || p === "android" || p === "macos" || p === "windows"
}

// -----------------------------------------------------------------------------
// Live entitlement queries (NO snapshot fallback)
// -----------------------------------------------------------------------------

type RawProductStatus = {
  isOwned?: boolean
  expirationTime?: number
  environment?: string
}

async function getProductStatus(
  productId: string,
  productType: "subs" | "inapp"
): Promise<{ ok: true; owned: boolean } | { ok: false; error: string }> {
  const invoke = getInvoke()
  if (!invoke) return { ok: false, error: "IAP unavailable in this environment" }
  try {
    const status = (await invoke("plugin:iap|get_product_status", {
      payload: { productId, productType },
    })) as RawProductStatus
    return { ok: true, owned: status?.isOwned === true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Live subscription check — calls the plugin for both sub product IDs in
 * parallel. Returns `entitled: true` if either returns owned. Returns an
 * error if BOTH calls failed; if one succeeded, we trust its answer.
 */
export async function isCurrentlySubscribed(): Promise<EntitlementCheck> {
  const [m, a] = await Promise.all([
    getProductStatus(SUBSCRIPTION_MONTHLY_ID, "subs"),
    getProductStatus(SUBSCRIPTION_ANNUAL_ID, "subs"),
  ])
  if (m.ok && a.ok) {
    return { ok: true, entitled: m.owned || a.owned }
  }
  if (m.ok) return { ok: true, entitled: m.owned }
  if (a.ok) return { ok: true, entitled: a.owned }
  // Both failed — surface the first error.
  return { ok: false, error: !m.ok ? m.error : (a as { ok: false; error: string }).error }
}

/** Live per-book entitlement check. */
export async function hasPurchasedBook(productId: string): Promise<EntitlementCheck> {
  if (!productId) return { ok: true, entitled: false }
  const status = await getProductStatus(productId, "inapp")
  if (status.ok) return { ok: true, entitled: status.owned }
  return { ok: false, error: status.error }
}

/**
 * Composed live check — true iff (free narration) OR (active sub) OR
 * (book purchased). Order: free first, then subscription, then per-book —
 * we want one call when the cheap one resolves.
 */
export async function isEntitledToNarration(
  narration: CatalogNarrationEntry
): Promise<EntitlementCheck> {
  if (narration.purchase.type === "free") return { ok: true, entitled: true }
  if (narration.purchase.type !== "iap") return { ok: true, entitled: false }

  const subCheck = await isCurrentlySubscribed()
  if (subCheck.ok && subCheck.entitled) return { ok: true, entitled: true }

  const productId = narration.purchase.productId
  if (!productId) return subCheck.ok ? { ok: true, entitled: false } : subCheck

  const bookCheck = await hasPurchasedBook(productId)
  if (bookCheck.ok && bookCheck.entitled) return { ok: true, entitled: true }

  // Neither sub nor book entitled. If both checks succeeded → not entitled.
  // If either failed → propagate the error so the UI shows the truth.
  if (subCheck.ok && bookCheck.ok) return { ok: true, entitled: false }
  return { ok: false, error: !subCheck.ok ? subCheck.error : (bookCheck as { ok: false; error: string }).error }
}

// -----------------------------------------------------------------------------
// Cross-WebView signaling (transient, not stored)
// -----------------------------------------------------------------------------

function dispatchPurchaseRecorded(productId: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(PURCHASE_RECORDED_EVENT, { detail: { productId } })
    )
  } catch (err) {
    console.warn("[purchaseManager] failed to dispatch purchase event", err)
  }
}

function dispatchSubscriptionRecorded(plan: SubscriptionPlan): void {
  try {
    window.dispatchEvent(
      new CustomEvent(SUBSCRIPTION_RECORDED_EVENT, { detail: { plan } })
    )
  } catch (err) {
    console.warn("[purchaseManager] failed to dispatch subscription event", err)
  }
}

/**
 * Ask the main app to run a Restore Purchases. The main app listens for
 * this event in App.tsx and runs `restoreAndSync()`. After it completes,
 * the main app's normal entitlement-refresh flow updates StoreKit's
 * unfinished transactions, and any visible reader paywalls re-query
 * `isCurrentlySubscribed` / `hasPurchasedBook` to reflect the new state.
 */
export function requestRestorePurchases(): void {
  try {
    window.dispatchEvent(new CustomEvent(RESTORE_REQUESTED_EVENT))
  } catch (err) {
    console.warn("[purchaseManager] failed to dispatch restore request", err)
  }
}

// -----------------------------------------------------------------------------
// Live product fetch (no cache; retry budget for transient empties)
// -----------------------------------------------------------------------------

/**
 * Retry schedule for the JS preflight. The Swift plugin retries internally
 * with the same shape; the JS schedule is here so non-iOS callers (Android
 * Play Billing, etc.) get the same resilience.
 */
const FETCH_RETRY_DELAYS_MS: readonly number[] = [0, 500, 1500, 3500, 6500]

export type FetchProductsResult =
  | { ok: true; products: StoreProduct[] }
  | { ok: false; error: string }

/**
 * Wire shape from the native plugin. iOS plugin emits top-level
 * `formattedPrice` for every product. Android Play Billing only emits it
 * top-level for one-time products — for subscriptions, it lives inside
 * `subscriptionOfferDetails[].pricingPhases[]`, and the recurring price is
 * the LAST phase.
 */
type RawPricingPhase = {
  formattedPrice?: string
  priceCurrencyCode?: string
  priceAmountMicros?: number
  recurrenceMode?: number
}

type RawSubscriptionOffer = {
  offerToken?: string
  pricingPhases?: RawPricingPhase[]
}

type RawProduct = {
  productId?: string
  title?: string
  description?: string
  formattedPrice?: string
  priceCurrencyCode?: string
  priceAmountMicros?: number
  subscriptionOfferDetails?: RawSubscriptionOffer[]
}

function recurringPhaseFromOffers(p: RawProduct): RawPricingPhase | undefined {
  const offer = p.subscriptionOfferDetails?.[0]
  const phases = offer?.pricingPhases
  if (!phases || phases.length === 0) return undefined
  return phases[phases.length - 1]
}

function normalizeProduct(p: RawProduct): StoreProduct {
  const recurring = recurringPhaseFromOffers(p)
  return {
    productId: p.productId ?? "",
    title: p.title ?? "",
    description: p.description ?? "",
    price: p.formattedPrice ?? recurring?.formattedPrice ?? "",
    currencyCode: p.priceCurrencyCode ?? recurring?.priceCurrencyCode ?? "",
    priceMicros: p.priceAmountMicros ?? recurring?.priceAmountMicros,
  }
}

export async function fetchStoreProducts(
  productIds: string[],
  productType: "subs" | "inapp" = "inapp"
): Promise<FetchProductsResult> {
  const invoke = getInvoke()
  if (!invoke) return { ok: false, error: "IAP unavailable in this environment" }
  if (productIds.length === 0) return { ok: true, products: [] }

  let lastError = ""
  for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt++) {
    const delay = FETCH_RETRY_DELAYS_MS[attempt]
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))

    try {
      const result = (await invoke("plugin:iap|get_products", {
        payload: { productIds, productType },
      })) as { products?: RawProduct[] }
      const raw = result.products ?? []
      if (raw.length > 0) {
        const products = raw.map(normalizeProduct)
        if (attempt > 0) {
          console.warn(
            `[purchaseManager] fetchStoreProducts succeeded on attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} for`,
            productIds
          )
        }
        console.info(
          "[purchaseManager] fetchStoreProducts → ",
          products.length,
          "products:",
          products.map((p) => ({ id: p.productId, price: p.price }))
        )
        return { ok: true, products }
      }
      lastError = "App Store returned no products"
      console.warn(
        `[purchaseManager] fetchStoreProducts attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} returned empty for`,
        productIds
      )
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(
        `[purchaseManager] fetchStoreProducts attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} failed:`,
        err
      )
    }
  }

  return { ok: false, error: lastError || "App Store unreachable" }
}

// -----------------------------------------------------------------------------
// Error classification (matches plugin error codes)
// -----------------------------------------------------------------------------

function looksLikeCancel(err: unknown): boolean {
  const msg = errorMessage(err).toUpperCase()
  return msg.startsWith("USER_CANCELLED") || msg.includes("CANCEL")
}

function looksLikeAlreadyOwned(err: unknown): boolean {
  const msg = errorMessage(err).toUpperCase()
  return msg.startsWith("ALREADY_OWNED") || msg.includes("ALREADYPURCHASED") || msg.includes("ALREADY_SUBSCRIBED")
}

function looksLikePending(err: unknown): boolean {
  return errorMessage(err).toUpperCase().startsWith("PURCHASE_PENDING")
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function errorCode(err: unknown): string {
  const msg = errorMessage(err)
  const colon = msg.indexOf(":")
  if (colon > 0 && colon < 64) return msg.slice(0, colon)
  return msg.length < 64 ? msg : "UNKNOWN"
}

// -----------------------------------------------------------------------------
// Acknowledge (Android only)
// -----------------------------------------------------------------------------

async function acknowledgeAndroidPurchase(receipt: string): Promise<void> {
  if (!receipt) return
  const invoke = getInvoke()
  if (!invoke) return
  try {
    await invoke("plugin:iap|acknowledge_purchase", {
      payload: { purchaseToken: receipt },
    })
  } catch (err) {
    console.warn("[purchaseManager] acknowledge_purchase failed:", err)
  }
}

// -----------------------------------------------------------------------------
// Native purchase invocation
// -----------------------------------------------------------------------------

type RawPurchase = {
  id?: string
  jwsRepresentation?: string
  purchaseToken?: string
  originalJson?: string
  environment?: string
}

async function runIapPurchase(
  productId: string,
  productType: "subs" | "inapp"
): Promise<PurchaseOutcome | { kind: "raw"; purchase: RawPurchase }> {
  const invoke = getInvoke()
  if (!invoke) {
    return { kind: "error", code: "NO_RUNTIME", message: "IAP unavailable in this environment" }
  }

  try {
    const purchase = (await invoke("plugin:iap|purchase", {
      payload: { productId, productType },
    })) as RawPurchase
    return { kind: "raw", purchase }
  } catch (err) {
    if (looksLikeCancel(err)) return { kind: "cancelled" }
    if (looksLikeAlreadyOwned(err)) return { kind: "alreadyOwned" }
    if (looksLikePending(err)) return { kind: "pending" }

    // Defensive: on rare paths StoreKit rejects but the transaction
    // actually completed (Already Purchased → Get again for free →
    // Transaction.updates finishes the txn behind us). Re-check
    // ownership before reporting failure.
    const status = await getProductStatus(productId, productType)
    if (status.ok && status.owned) {
      console.warn(
        `[purchaseManager] purchase rejected but product is owned — treating as alreadyOwned:`,
        err
      )
      return { kind: "alreadyOwned" }
    }

    console.error("[purchaseManager] purchase failed for", productId, err)
    return {
      kind: "error",
      code: errorCode(err),
      message: errorMessage(err),
    }
  }
}

// -----------------------------------------------------------------------------
// Buy a one-time book product
// -----------------------------------------------------------------------------

export async function purchaseBookProduct(productId: string): Promise<PurchaseOutcome> {
  if (!productId) return { kind: "error", code: "MISSING_ID", message: "Missing product ID" }

  const result = await runIapPurchase(productId, "inapp")
  if (result.kind !== "raw") {
    if (result.kind === "alreadyOwned") {
      dispatchPurchaseRecorded(productId)
    }
    return result
  }

  const platform = getReaderPlatform() ?? "desktop"
  const { purchase } = result
  const receipt =
    purchase.jwsRepresentation ?? purchase.purchaseToken ?? purchase.originalJson ?? ""
  dispatchPurchaseRecorded(productId)
  if (platform === "android") {
    await acknowledgeAndroidPurchase(receipt)
  }
  return {
    kind: "ok",
    receipt: {
      transactionId: purchase.id ?? "",
      receipt,
      platform,
    },
  }
}

// -----------------------------------------------------------------------------
// Buy a subscription product
// -----------------------------------------------------------------------------

export async function purchaseSubscriptionProduct(
  productId: string
): Promise<PurchaseOutcome> {
  if (productId !== SUBSCRIPTION_MONTHLY_ID && productId !== SUBSCRIPTION_ANNUAL_ID) {
    return { kind: "error", code: "UNKNOWN_SUB", message: "Unknown subscription product" }
  }
  const plan: SubscriptionPlan =
    productId === SUBSCRIPTION_ANNUAL_ID ? "annual" : "monthly"

  const result = await runIapPurchase(productId, "subs")
  if (result.kind !== "raw") {
    if (result.kind === "alreadyOwned") {
      dispatchSubscriptionRecorded(plan)
    }
    return result
  }

  const platform = getReaderPlatform() ?? "desktop"
  const { purchase } = result
  const receipt =
    purchase.jwsRepresentation ?? purchase.purchaseToken ?? purchase.originalJson ?? ""
  dispatchSubscriptionRecorded(plan)
  if (platform === "android") {
    await acknowledgeAndroidPurchase(receipt)
  }
  return {
    kind: "ok",
    receipt: {
      transactionId: purchase.id ?? "",
      receipt,
      platform,
    },
  }
}

// -----------------------------------------------------------------------------
// Receipt restore — used when downloading premium narration content
// -----------------------------------------------------------------------------

type RawRestoredPurchase = {
  id?: string
  orderId?: string
  productId?: string
  jwsRepresentation?: string
  purchaseToken?: string
  originalJson?: string
}

async function restorePurchasesOfType(
  productType: "inapp" | "subs"
): Promise<RawRestoredPurchase[]> {
  const invoke = getInvoke()
  if (!invoke) return []
  try {
    const res = (await invoke("plugin:iap|restore_purchases", {
      payload: { productType },
    })) as { purchases?: RawRestoredPurchase[] }
    return res.purchases ?? []
  } catch (err) {
    console.error("[purchaseManager] restore_purchases failed:", productType, err)
    return []
  }
}

function receiptFromRaw(p: RawRestoredPurchase): string {
  return p.jwsRepresentation ?? p.purchaseToken ?? p.originalJson ?? ""
}

/**
 * Find a receipt that authorises downloading this premium narration.
 * Each call is fresh — no cache.
 *
 * Preference: book-specific non-consumable, then any active subscription.
 */
export async function resolveReceiptForEntry(
  entry: CatalogNarrationEntry
): Promise<NarrationPurchaseReceipt | null> {
  if (entry.purchase.type !== "iap") return null
  const platform = getReaderPlatform() ?? "desktop"
  const productId = entry.purchase.productId

  if (productId) {
    const inapp = await restorePurchasesOfType("inapp")
    const match = inapp.find((p) => p.productId === productId)
    if (match) {
      const receipt = receiptFromRaw(match)
      if (receipt) {
        return {
          transactionId: match.id ?? match.orderId ?? "",
          receipt,
          platform,
        }
      }
    }
  }

  const subs = await restorePurchasesOfType("subs")
  const sub = subs.find(
    (p) =>
      p.productId === SUBSCRIPTION_MONTHLY_ID ||
      p.productId === SUBSCRIPTION_ANNUAL_ID
  )
  if (sub) {
    const receipt = receiptFromRaw(sub)
    if (receipt) {
      return {
        transactionId: sub.id ?? sub.orderId ?? "",
        receipt,
        platform,
      }
    }
  }

  return null
}

/**
 * Resolve an active subscription receipt (Corpán Plus). Used by the two-ZIP
 * install path to authorise the full ZIP download. No book product involved.
 */
export async function resolveSubscriptionReceipt(): Promise<NarrationPurchaseReceipt | null> {
  const platform = getReaderPlatform() ?? "desktop"
  const subs = await restorePurchasesOfType("subs")
  const sub = subs.find(
    (p) =>
      p.productId === SUBSCRIPTION_MONTHLY_ID ||
      p.productId === SUBSCRIPTION_ANNUAL_ID
  )
  if (sub) {
    const receipt = receiptFromRaw(sub)
    if (receipt) {
      return { transactionId: sub.id ?? sub.orderId ?? "", receipt, platform }
    }
  }
  return null
}

// -----------------------------------------------------------------------------
// Narration purchase (legacy alias) — book purchase by narration object
// -----------------------------------------------------------------------------

export async function purchaseNarration(
  narration: CatalogNarrationEntry
): Promise<PurchaseOutcome> {
  const productId = narration.purchase.productId
  if (!productId) {
    return { kind: "error", code: "MISSING_ID", message: "Narration is missing a product ID" }
  }
  return purchaseBookProduct(productId)
}
