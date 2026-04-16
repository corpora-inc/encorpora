import { invoke } from "@tauri-apps/api/core"
import { type as osType } from "@tauri-apps/plugin-os"
import { useEntitlementStore } from "@/store/entitlements"
import type { SubscriptionPlan } from "@/store/entitlements"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchasePlatform = "ios" | "android" | "macos" | "windows" | "desktop"

export type StoreProduct = {
  productId: string
  title: string
  description: string
  price: string
  currencyCode: string
  /** Raw price in micros (e.g., 3990000 = $3.99) */
  priceMicros?: number
}

export type PurchaseResult = {
  transactionId: string
  productId: string
  /** JWS receipt (iOS) or purchase token (Android) */
  receipt: string
  platform: PurchasePlatform
}

export type PurchaseVerificationResponse = {
  status: "verified" | "failed"
  transactionId?: string
  productId?: string
  signedUrl?: string
  subscriptionActive?: boolean
  expiresAt?: string | null
  error?: string
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const isTauriRuntime = () => {
  if (typeof window === "undefined") return false
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    (window as any).__TAURI_IPC__ !== undefined
  )
}

let detectedPlatform: PurchasePlatform | null = null

export async function getPlatform(): Promise<PurchasePlatform> {
  if (detectedPlatform) return detectedPlatform

  if (!isTauriRuntime()) {
    detectedPlatform = "desktop"
    useEntitlementStore.getState().setPlatform("desktop")
    return detectedPlatform
  }

  try {
    const os = osType()
    if (os === "ios") detectedPlatform = "ios"
    else if (os === "android") detectedPlatform = "android"
    else if (os === "macos") detectedPlatform = "macos"
    else if (os === "windows") detectedPlatform = "windows"
    else detectedPlatform = "desktop"
  } catch {
    detectedPlatform = "desktop"
  }

  useEntitlementStore.getState().setPlatform(detectedPlatform)
  return detectedPlatform
}

/** @deprecated Use `useEntitlementStore(s => s.iapAvailable)` in React components */
export function isIapAvailable(): boolean {
  const p = detectedPlatform
  return p === "ios" || p === "android" || p === "macos" || p === "windows"
}

// ---------------------------------------------------------------------------
// IAP Plugin wrappers
// ---------------------------------------------------------------------------

/**
 * Fetch product info (localized prices) from the platform store.
 */
export async function fetchProducts(
  productIds: string[],
  productType: "subs" | "inapp" = "inapp"
): Promise<StoreProduct[]> {
  if (!isTauriRuntime()) return []

  try {
    const result = await invoke<{ products: StoreProduct[] }>(
      "plugin:iap|get_products",
      { productIds, productType }
    )
    return result.products ?? []
  } catch (err) {
    console.error("[purchase] fetchProducts error:", err)
    return []
  }
}

/**
 * Initiate a purchase via the platform store (triggers Face ID / biometric).
 */
export async function purchaseProduct(
  productId: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<PurchaseResult | null> {
  if (!isTauriRuntime()) return null

  try {
    const purchase = await invoke<{
      id: string
      productId: string
      originalJson?: string
      signature?: string
      jwsRepresentation?: string
      purchaseToken?: string
    }>("plugin:iap|purchase", { productId, productType })

    const platform = await getPlatform()

    // Build receipt from platform-specific fields
    const receipt =
      purchase.jwsRepresentation ?? // iOS: JWS signed transaction
      purchase.purchaseToken ?? // Android: purchase token
      purchase.originalJson ?? // Android fallback
      ""

    return {
      transactionId: purchase.id,
      productId: purchase.productId,
      receipt,
      platform,
    }
  } catch (err) {
    console.error("[purchase] purchaseProduct error:", err)
    return null
  }
}

/**
 * Restore previous purchases from the platform (tied to Apple ID / Google account).
 */
export async function restorePurchases(): Promise<PurchaseResult[]> {
  if (!isTauriRuntime()) return []

  const results: PurchaseResult[] = []
  const platform = await getPlatform()

  // Restore one-time purchases
  try {
    const inappResult = await invoke<{ purchases: any[] }>(
      "plugin:iap|restore_purchases",
      { productType: "inapp" }
    )
    for (const p of inappResult.purchases ?? []) {
      results.push({
        transactionId: p.id ?? p.orderId ?? "",
        productId: p.productId ?? "",
        receipt: p.jwsRepresentation ?? p.purchaseToken ?? "",
        platform,
      })
    }
  } catch (err) {
    console.warn("[purchase] restore inapp error:", err)
  }

  // Restore subscriptions
  try {
    const subsResult = await invoke<{ purchases: any[] }>(
      "plugin:iap|restore_purchases",
      { productType: "subs" }
    )
    for (const p of subsResult.purchases ?? []) {
      results.push({
        transactionId: p.id ?? p.orderId ?? "",
        productId: p.productId ?? "",
        receipt: p.jwsRepresentation ?? p.purchaseToken ?? "",
        platform,
      })
    }
  } catch (err) {
    console.warn("[purchase] restore subs error:", err)
  }

  return results
}

/**
 * Acknowledge a purchase (required on Android within 3 days).
 */
export async function acknowledgePurchase(purchaseToken: string): Promise<void> {
  if (!isTauriRuntime()) return

  try {
    await invoke("plugin:iap|acknowledge_purchase", { purchaseToken })
  } catch (err) {
    console.warn("[purchase] acknowledgePurchase error:", err)
  }
}

/**
 * Check product ownership / subscription status via the IAP plugin.
 */
export async function getProductStatus(
  productId: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<{ owned: boolean; expiresAt?: string }> {
  if (!isTauriRuntime()) return { owned: false }

  try {
    const status = await invoke<{ owned: boolean; expiryDate?: string }>(
      "plugin:iap|get_product_status",
      { productId, productType }
    )
    return {
      owned: status.owned ?? false,
      expiresAt: status.expiryDate,
    }
  } catch {
    return { owned: false }
  }
}

// ---------------------------------------------------------------------------
// Backend verification
// ---------------------------------------------------------------------------

const getVerifyUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_VERIFY_URL
  if (typeof envUrl === "string" && envUrl.length > 0) return envUrl
  return null
}

/**
 * Verify a purchase receipt with the backend and get a signed download URL.
 */
export async function verifyPurchase(
  purchase: PurchaseResult,
  packId?: string
): Promise<PurchaseVerificationResponse> {
  const urlBase = getVerifyUrl()
  if (!urlBase) {
    return { status: "failed", error: "Verification endpoint not configured" }
  }

  try {
    const url = new URL("/verify-purchase", urlBase).toString()
    const body: Record<string, unknown> = {
      platform: purchase.platform,
      productId: purchase.productId,
      transactionId: purchase.transactionId,
    }

    // Platform-specific receipt fields
    if (purchase.platform === "ios" || purchase.platform === "macos") {
      body.receipt = purchase.receipt
    } else if (purchase.platform === "android") {
      body.purchaseToken = purchase.receipt
    }

    if (packId) body.packId = packId

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return {
        status: "failed",
        error: (data as any).error ?? `Verification failed (${res.status})`,
      }
    }

    return (await res.json()) as PurchaseVerificationResponse
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Verification failed",
    }
  }
}

// ---------------------------------------------------------------------------
// High-level orchestration
// ---------------------------------------------------------------------------

/** Subscription product IDs */
export const SUBSCRIPTION_MONTHLY = "corpan.sub.monthly"
export const SUBSCRIPTION_ANNUAL = "corpan.sub.annual"

/**
 * Full purchase flow: purchase → verify → update entitlements → return signed URL.
 */
export async function purchaseAndVerify(
  productId: string,
  packId?: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<{ signedUrl?: string; error?: string }> {
  // Step 1: Platform purchase
  const purchase = await purchaseProduct(productId, productType)
  if (!purchase) {
    return { error: "Purchase cancelled or failed" }
  }

  // Step 2: Verify with backend
  const verification = await verifyPurchase(purchase, packId)
  if (verification.status !== "verified") {
    return { error: verification.error ?? "Verification failed" }
  }

  // Step 3: Acknowledge on Android
  if (purchase.platform === "android" && purchase.receipt) {
    await acknowledgePurchase(purchase.receipt)
  }

  // Step 4: Update local entitlements
  const store = useEntitlementStore.getState()

  if (verification.subscriptionActive) {
    const plan: SubscriptionPlan =
      productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
    store.setSubscription({
      active: true,
      plan,
      expiresAt: verification.expiresAt ?? null,
      autoRenew: true,
    })
  } else {
    store.addPurchasedProduct(productId)
  }

  store.setLastRefreshed(Date.now())

  return { signedUrl: verification.signedUrl }
}

/**
 * Refresh entitlements from the IAP plugin (local, no network).
 * Call on app launch and periodically.
 */
export async function refreshEntitlements(): Promise<void> {
  if (!isTauriRuntime()) return

  const store = useEntitlementStore.getState()

  // Check subscription status
  for (const subId of [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL]) {
    const status = await getProductStatus(subId, "subs")
    if (status.owned) {
      const plan: SubscriptionPlan =
        subId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
      store.setSubscription({
        active: true,
        plan,
        expiresAt: status.expiresAt ?? null,
        autoRenew: true,
      })
      break
    }
  }

  store.setLastRefreshed(Date.now())
}

/**
 * Restore purchases and sync entitlements with backend.
 */
export async function restoreAndSync(): Promise<{
  restoredCount: number
  error?: string
}> {
  const purchases = await restorePurchases()
  if (purchases.length === 0) {
    return { restoredCount: 0 }
  }

  const store = useEntitlementStore.getState()
  let restoredCount = 0

  for (const purchase of purchases) {
    const verification = await verifyPurchase(purchase)
    if (verification.status === "verified") {
      if (verification.subscriptionActive) {
        const plan: SubscriptionPlan =
          purchase.productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
        store.setSubscription({
          active: true,
          plan,
          expiresAt: verification.expiresAt ?? null,
          autoRenew: true,
        })
      } else if (verification.productId) {
        store.addPurchasedProduct(verification.productId)
      }
      restoredCount++
    }
  }

  store.setLastRefreshed(Date.now())
  return { restoredCount }
}
