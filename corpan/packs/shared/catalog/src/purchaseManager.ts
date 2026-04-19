/**
 * Purchase manager for reader catalog.
 *
 * Bridges the reader (running inside the main app's WebView) to the platform
 * IAP plugin and the main app's entitlement store. The reader can't import
 * the main app's modules directly, so we talk to Tauri via raw invoke and
 * to the entitlement store via its persisted localStorage key.
 *
 * The main app's entitlement store is zustand/persist with key
 * "corpan-entitlements-v1" and shape:
 *   { state: { subscription: {active, plan, ...}, purchasedProducts: [], ... },
 *     version: 0 }
 *
 * We read it to gate UI (Buy vs Download vs Included) and write purchases
 * back via a CustomEvent the main app listens for. Direct localStorage write
 * is a safety net for when the event listener isn't registered.
 */

import type { CatalogNarrationEntry } from "./types"

const ENTITLEMENT_KEY = "corpan-entitlements-v1"
const PURCHASE_RECORDED_EVENT = "corpan:purchase-recorded"
const SUBSCRIPTION_RECORDED_EVENT = "corpan:subscription-recorded"

/** Canonical subscription product IDs — must match Corpan.storekit. */
export const SUBSCRIPTION_MONTHLY_ID = "corpan.sub.monthly"
export const SUBSCRIPTION_ANNUAL_ID = "corpan.sub.annual"

export type SubscriptionPlan = "monthly" | "annual"

type EntitlementSnapshot = {
  subscription?: {
    active?: boolean
    plan?: string | null
    expiresAt?: string | null
    autoRenew?: boolean
  }
  purchasedProducts?: string[]
  platform?: string | null
  iapAvailable?: boolean
}

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
  | { kind: "error"; message: string }

function getInvoke(): TauriInternals["invoke"] | null {
  const w = window as TauriWindow
  return w.__TAURI_INTERNALS__?.invoke ?? null
}

function readEntitlementSnapshot(): EntitlementSnapshot | null {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: EntitlementSnapshot }
    return parsed?.state ?? null
  } catch {
    return null
  }
}

/** Best-effort persisted write so reopening the reader still knows the product is owned. */
function appendPurchasedProduct(productId: string): void {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_KEY)
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    const state = (parsed.state ?? {}) as EntitlementSnapshot
    const arr = Array.isArray(state.purchasedProducts) ? state.purchasedProducts : []
    if (!arr.includes(productId)) {
      arr.push(productId)
      state.purchasedProducts = arr
      parsed.state = state
      localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(parsed))
    }
  } catch (err) {
    console.warn("[purchaseManager] failed to append purchased product", err)
  }
}

/** Reactive path: main app listens for this and calls addPurchasedProduct on the zustand store. */
function dispatchPurchaseRecorded(productId: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(PURCHASE_RECORDED_EVENT, { detail: { productId } })
    )
  } catch (err) {
    console.warn("[purchaseManager] failed to dispatch purchase event", err)
  }
}

/** Persist subscription state so the reader still shows "Included" after a reload. */
function setSubscriptionActive(plan: SubscriptionPlan): void {
  try {
    const raw = localStorage.getItem(ENTITLEMENT_KEY)
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    const state = (parsed.state ?? {}) as EntitlementSnapshot
    state.subscription = {
      active: true,
      plan,
      expiresAt: null,
      autoRenew: true,
    }
    parsed.state = state
    localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(parsed))
  } catch (err) {
    console.warn("[purchaseManager] failed to set subscription active", err)
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

export function iapAvailableFromSnapshot(): boolean {
  const s = readEntitlementSnapshot()
  return s?.iapAvailable === true
}

export function platformFromSnapshot(): PurchasePlatform {
  const s = readEntitlementSnapshot()
  const p = (s?.platform ?? "desktop") as string
  if (p === "ios" || p === "android" || p === "macos" || p === "windows") return p
  return "desktop"
}

export function isSubscriberFromSnapshot(): boolean {
  const s = readEntitlementSnapshot()
  return s?.subscription?.active === true
}

export function hasPurchasedFromSnapshot(productId: string): boolean {
  const s = readEntitlementSnapshot()
  return Array.isArray(s?.purchasedProducts)
    ? s!.purchasedProducts!.includes(productId)
    : false
}

/** True if the user already has access to this narration (subscription or individual purchase). */
export function isEntitledToNarration(narration: CatalogNarrationEntry): boolean {
  if (narration.purchase.type === "free") return true
  if (narration.purchase.type !== "iap") return false
  if (isSubscriberFromSnapshot()) return true
  const productId = narration.purchase.productId
  if (!productId) return false
  return hasPurchasedFromSnapshot(productId)
}

function looksLikeCancel(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return msg.includes("cancel") || msg.includes("user_denied") || msg.includes("userdenied")
}

function looksLikeAlreadyOwned(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes("already_owned") ||
    msg.includes("alreadypurchased") ||
    msg.includes("already_subscribed") ||
    msg.includes("already owned")
  )
}

/**
 * Trigger a StoreKit / Play Billing purchase for a one-time narration product.
 * Returns a PurchaseOutcome — no side effects beyond the platform sheet.
 */
export async function purchaseNarration(
  narration: CatalogNarrationEntry
): Promise<PurchaseOutcome> {
  const invoke = getInvoke()
  if (!invoke) return { kind: "error", message: "IAP unavailable in this environment" }

  const productId = narration.purchase.productId
  if (!productId) {
    return { kind: "error", message: "Narration is missing a product ID" }
  }

  try {
    const purchase = await invoke("plugin:iap|purchase", {
      payload: { productId, productType: "inapp" },
    }) as {
      id?: string
      productId?: string
      jwsRepresentation?: string
      purchaseToken?: string
      originalJson?: string
    }

    const platform = platformFromSnapshot()
    const receipt =
      purchase.jwsRepresentation ??
      purchase.purchaseToken ??
      purchase.originalJson ??
      ""

    appendPurchasedProduct(productId)
    dispatchPurchaseRecorded(productId)

    return {
      kind: "ok",
      receipt: {
        transactionId: purchase.id ?? "",
        receipt,
        platform,
      },
    }
  } catch (err) {
    if (looksLikeCancel(err)) return { kind: "cancelled" }
    if (looksLikeAlreadyOwned(err)) {
      appendPurchasedProduct(productId)
      dispatchPurchaseRecorded(productId)
      return { kind: "alreadyOwned" }
    }
    console.error("[purchaseManager] purchase failed for", productId, err)
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Fetch localized store products (titles, prices, currency) from the platform IAP plugin.
 * Returns [] if IAP isn't available. Used to render real prices in CTAs.
 */
export async function fetchStoreProducts(
  productIds: string[],
  productType: "subs" | "inapp" = "inapp"
): Promise<StoreProduct[]> {
  const invoke = getInvoke()
  if (!invoke) return []
  try {
    const result = await invoke("plugin:iap|get_products", {
      payload: { productIds, productType },
    }) as { products?: StoreProduct[] }
    return result.products ?? []
  } catch (err) {
    console.error("[purchaseManager] fetchStoreProducts failed:", err)
    return []
  }
}

async function runIapPurchase(
  productId: string,
  productType: "subs" | "inapp"
): Promise<PurchaseOutcome | { kind: "raw"; purchase: { id?: string; jwsRepresentation?: string; purchaseToken?: string; originalJson?: string } }> {
  const invoke = getInvoke()
  if (!invoke) return { kind: "error", message: "IAP unavailable in this environment" }
  try {
    const purchase = await invoke("plugin:iap|purchase", {
      payload: { productId, productType },
    }) as {
      id?: string
      jwsRepresentation?: string
      purchaseToken?: string
      originalJson?: string
    }
    return { kind: "raw", purchase }
  } catch (err) {
    if (looksLikeCancel(err)) return { kind: "cancelled" }
    if (looksLikeAlreadyOwned(err)) return { kind: "alreadyOwned" }
    console.error("[purchaseManager] purchase failed for", productId, err)
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Buy a book by its product ID (e.g. `corpan.book.fascinating_science_volcanoes`).
 * A single purchase unlocks every narration of that book.
 */
export async function purchaseBookProduct(productId: string): Promise<PurchaseOutcome> {
  if (!productId) return { kind: "error", message: "Missing product ID" }

  const result = await runIapPurchase(productId, "inapp")
  if (result.kind !== "raw") {
    if (result.kind === "alreadyOwned") {
      appendPurchasedProduct(productId)
      dispatchPurchaseRecorded(productId)
    }
    return result as PurchaseOutcome
  }

  const platform = platformFromSnapshot()
  const { purchase } = result
  const receipt =
    purchase.jwsRepresentation ?? purchase.purchaseToken ?? purchase.originalJson ?? ""
  appendPurchasedProduct(productId)
  dispatchPurchaseRecorded(productId)
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
// Receipt restore — for subscribers/owners redeeming access without a fresh buy
// -----------------------------------------------------------------------------

type RawRestoredPurchase = {
  id?: string
  orderId?: string
  productId?: string
  jwsRepresentation?: string  // iOS
  purchaseToken?: string       // Android
  originalJson?: string        // Android fallback
}

type RestoreCacheEntry = {
  purchases: RawRestoredPurchase[]
  at: number
}
const RESTORE_CACHE_TTL_MS = 60_000
const restoreCache = new Map<"inapp" | "subs", RestoreCacheEntry>()

async function restorePurchasesOfType(
  productType: "inapp" | "subs"
): Promise<RawRestoredPurchase[]> {
  const cached = restoreCache.get(productType)
  if (cached && Date.now() - cached.at < RESTORE_CACHE_TTL_MS) {
    return cached.purchases
  }
  const invoke = getInvoke()
  if (!invoke) return []
  try {
    const res = await invoke("plugin:iap|restore_purchases", {
      payload: { productType },
    }) as { purchases?: RawRestoredPurchase[] }
    const purchases = res.purchases ?? []
    restoreCache.set(productType, { purchases, at: Date.now() })
    return purchases
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
 *
 * Preference order:
 *   1. The book's own non-consumable purchase (if the user bought this book).
 *   2. Any active subscription (subscriber path).
 *
 * Returns null if neither is available — the caller should surface the error.
 * Results are cached per productType for 60s so rapid-fire downloads don't
 * hammer StoreKit / Play Billing.
 */
export async function resolveReceiptForEntry(
  entry: CatalogNarrationEntry
): Promise<NarrationPurchaseReceipt | null> {
  if (entry.purchase.type !== "iap") return null
  const platform = platformFromSnapshot()
  const productId = entry.purchase.productId

  // 1) Book-specific non-consumable
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

  // 2) Active subscription fallback
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
 * Buy a subscription (`corpan.sub.monthly` or `corpan.sub.annual`). On success,
 * marks the subscription active in localStorage and fires a corpan:subscription-recorded
 * event so the main app's zustand store picks up the change.
 */
export async function purchaseSubscriptionProduct(
  productId: string
): Promise<PurchaseOutcome> {
  if (productId !== SUBSCRIPTION_MONTHLY_ID && productId !== SUBSCRIPTION_ANNUAL_ID) {
    return { kind: "error", message: "Unknown subscription product" }
  }
  const plan: SubscriptionPlan =
    productId === SUBSCRIPTION_ANNUAL_ID ? "annual" : "monthly"

  const result = await runIapPurchase(productId, "subs")
  if (result.kind !== "raw") {
    if (result.kind === "alreadyOwned") {
      setSubscriptionActive(plan)
      dispatchSubscriptionRecorded(plan)
    }
    return result as PurchaseOutcome
  }

  const platform = platformFromSnapshot()
  const { purchase } = result
  const receipt =
    purchase.jwsRepresentation ?? purchase.purchaseToken ?? purchase.originalJson ?? ""
  setSubscriptionActive(plan)
  dispatchSubscriptionRecorded(plan)
  return {
    kind: "ok",
    receipt: {
      transactionId: purchase.id ?? "",
      receipt,
      platform,
    },
  }
}
