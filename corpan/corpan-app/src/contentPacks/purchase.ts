import { invoke } from "@tauri-apps/api/core"
import { type as osType } from "@tauri-apps/plugin-os"
import { openUrl } from "@tauri-apps/plugin-opener"
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
      { payload: { productIds, productType } }
    )
    return result.products ?? []
  } catch (err) {
    console.error("[purchase] fetchProducts error:", err)
    return []
  }
}

/** Wrap a promise with a timeout that rejects with TimeoutError after ms. */
class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`)
    this.name = "TimeoutError"
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/** Heuristic: does this error look like the user cancelled the purchase? */
function isCancellationError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes("cancel") ||
    msg.includes("userdenied") ||
    msg.includes("user_denied")
  )
}

/** Heuristic: user already owns / is already subscribed to this product. */
function isAlreadyOwnedError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes("already") ||
    msg.includes("already_owned") ||
    msg.includes("alreadypurchased") ||
    msg.includes("already_subscribed")
  )
}

/** Purchase flow outcome — distinguishes cancel vs timeout vs error. */
export type PurchaseOutcome =
  | { kind: "ok"; result: PurchaseResult }
  | { kind: "cancelled" }
  | { kind: "timeout" }
  | { kind: "alreadyOwned" }
  | { kind: "error"; message: string }

/** 60s timeout for platform store response — plenty for legitimate flows. */
const PURCHASE_TIMEOUT_MS = 60_000

/**
 * Initiate a purchase via the platform store (triggers Face ID / biometric).
 * Times out after 60s so the UI doesn't hang if StoreKit never responds.
 */
export async function purchaseProduct(
  productId: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<PurchaseOutcome> {
  if (!isTauriRuntime()) {
    return { kind: "error", message: "IAP unavailable in this environment" }
  }

  try {
    const purchase = await withTimeout(
      invoke<{
        id: string
        productId: string
        originalJson?: string
        signature?: string
        jwsRepresentation?: string
        purchaseToken?: string
      }>("plugin:iap|purchase", { payload: { productId, productType } }),
      PURCHASE_TIMEOUT_MS
    )

    const platform = await getPlatform()

    const receipt =
      purchase.jwsRepresentation ?? // iOS: JWS signed transaction
      purchase.purchaseToken ?? // Android: purchase token
      purchase.originalJson ?? // Android fallback
      ""

    return {
      kind: "ok",
      result: {
        transactionId: purchase.id,
        productId: purchase.productId,
        receipt,
        platform,
      },
    }
  } catch (err) {
    if (err instanceof TimeoutError) {
      console.warn("[purchase] purchaseProduct timed out:", err.message)
      return { kind: "timeout" }
    }
    if (isCancellationError(err)) {
      console.warn("[purchase] purchaseProduct cancelled by user")
      return { kind: "cancelled" }
    }
    if (isAlreadyOwnedError(err)) {
      console.warn("[purchase] purchaseProduct reported already owned — treating as success")
      return { kind: "alreadyOwned" }
    }
    console.error("[purchase] purchaseProduct error:", err)
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    }
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
      { payload: { productType: "inapp" } }
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
      { payload: { productType: "subs" } }
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
    await invoke("plugin:iap|acknowledge_purchase", { payload: { purchaseToken } })
  } catch (err) {
    console.warn("[purchase] acknowledgePurchase error:", err)
  }
}

/**
 * Tri-state product status. `unknown` (plugin error / timeout) must be
 * distinguished from `not_owned` so callers don't mistakenly clear local
 * entitlement state when the store is merely unreachable.
 */
export type ProductStatus =
  | { state: "owned"; expiresAt?: string }
  | { state: "not_owned" }
  | { state: "unknown"; reason: string }

/**
 * Check product ownership / subscription status via the IAP plugin.
 */
export async function getProductStatus(
  productId: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<ProductStatus> {
  if (!isTauriRuntime()) return { state: "not_owned" }

  try {
    // 10s timeout — at app startup we shouldn't block the UI waiting for StoreKit
    const status = await withTimeout(
      invoke<{ isOwned: boolean; expirationTime?: number }>(
        "plugin:iap|get_product_status",
        { payload: { productId, productType } }
      ),
      10_000
    )
    if (status.isOwned) {
      return {
        state: "owned",
        expiresAt: status.expirationTime
          ? new Date(status.expirationTime).toISOString()
          : undefined,
      }
    }
    return { state: "not_owned" }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    if (err instanceof TimeoutError) {
      console.warn("[purchase] getProductStatus timed out for", productId)
    } else {
      console.warn("[purchase] getProductStatus error for", productId, err)
    }
    return { state: "unknown", reason }
  }
}

// ---------------------------------------------------------------------------
// Backend verification
// ---------------------------------------------------------------------------

/**
 * Production purchase-verify endpoint. Public URL (auth is by platform receipt,
 * not URL obscurity) — hardcoded so CI builds don't need a per-machine .env.
 * Override with `VITE_GAME_VERIFY_URL` for staging.
 */
const DEFAULT_VERIFY_URL = "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod"

const getVerifyUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_VERIFY_URL
  if (typeof envUrl === "string" && envUrl.length > 0) return envUrl
  return DEFAULT_VERIFY_URL
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
    // Concat instead of `new URL("/verify-purchase", urlBase)` — the latter
    // STRIPS the stage path: `new URL("/verify-purchase", "https://x/prod")`
    // resolves to "https://x/verify-purchase" (no /prod), which 404s.
    const url = urlBase.replace(/\/+$/, "") + "/verify-purchase"
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
 * Full purchase flow.
 *
 * Platform (StoreKit/PlayBilling) is the source of truth for entitlement.
 * We set local entitlement as soon as the platform confirms the purchase.
 * Backend verification runs to get a signed URL for premium content — a
 * backend failure does NOT roll back the entitlement.
 */
export async function purchaseAndVerify(
  productId: string,
  packId?: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<{
  signedUrl?: string
  error?: string
  cancelled?: boolean
  alreadyOwned?: boolean
  verifyFailed?: boolean
}> {
  const outcome = await purchaseProduct(productId, productType)

  if (outcome.kind === "cancelled") return { cancelled: true }
  if (outcome.kind === "timeout") {
    return { error: "Purchase timed out. Please try again." }
  }
  if (outcome.kind === "alreadyOwned") {
    // Platform says the user already has this. Trust it, refresh state.
    await refreshEntitlements()
    return { alreadyOwned: true }
  }
  if (outcome.kind === "error") {
    return { error: outcome.message || "Purchase failed" }
  }
  const purchase = outcome.result

  // Platform confirmed purchase — update local entitlement immediately.
  // (Don't gate on backend verification.)
  const store = useEntitlementStore.getState()
  if (productType === "subs") {
    const plan: SubscriptionPlan =
      productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
    store.setSubscription({
      active: true,
      plan,
      expiresAt: null, // updated on next refreshEntitlements
      autoRenew: true,
    })
  } else {
    store.addPurchasedProduct(productId)
  }
  store.setLastRefreshed(Date.now())

  // Acknowledge on Android (required within 3 days).
  if (purchase.platform === "android" && purchase.receipt) {
    await acknowledgePurchase(purchase.receipt)
  }

  // Backend verification — for signed URL (premium content) + server-side
  // subscription tracking. Non-blocking for the entitlement itself.
  const verification = await verifyPurchase(purchase, packId)
  if (verification.status !== "verified") {
    console.warn(
      "[purchase] backend verification failed (entitlement still set locally):",
      verification.error
    )
    return { verifyFailed: true }
  }

  // Prefer backend's expiry info if available.
  if (productType === "subs" && verification.expiresAt) {
    store.setSubscription({
      active: true,
      plan: productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly",
      expiresAt: verification.expiresAt,
      autoRenew: true,
    })
  }

  return { signedUrl: verification.signedUrl }
}

/**
 * Refresh entitlements from the IAP plugin (local, no network on iOS).
 * Call on app launch, on foreground/resume, and near subscription expiry.
 *
 * Moves subscription state in BOTH directions via StoreKit 2's silent
 * `Transaction.currentEntitlements` query: if the platform authoritatively
 * says no subscription is owned, stale local state (e.g. `active: true` for
 * a subscription that has since lapsed or been cancelled) is cleared so the
 * paywall reappears. If the plugin is unreachable, existing state is kept.
 *
 * Does NOT call restorePurchases() on iOS — that can trigger an Apple ID
 * sign-in prompt and per Apple HIG must be user-initiated. Book-purchase
 * restoration after reinstall/device-switch is handled by the explicit
 * "Restore Purchases" button. On Android restorePurchases() is silent and
 * is required here to acknowledge unack'd purchases within Google's 3-day
 * window.
 */
export async function refreshEntitlements(): Promise<void> {
  if (!isTauriRuntime()) return

  const store = useEntitlementStore.getState()

  // Check subscription status. We need to distinguish "platform says not
  // subscribed" from "couldn't reach platform": clearing stale active-sub
  // state on error would wrongly hide real subscribers' content whenever
  // the IAP plugin hiccups.
  let activeSub: { plan: SubscriptionPlan; expiresAt: string | null } | null =
    null
  let anyStatusUnknown = false

  for (const subId of [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL]) {
    const status = await getProductStatus(subId, "subs")
    if (status.state === "owned") {
      activeSub = {
        plan: subId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly",
        expiresAt: status.expiresAt ?? null,
      }
      break
    }
    if (status.state === "unknown") anyStatusUnknown = true
  }

  if (activeSub) {
    store.setSubscription({
      active: true,
      plan: activeSub.plan,
      expiresAt: activeSub.expiresAt,
      autoRenew: true,
    })
  } else if (!anyStatusUnknown) {
    // Platform confirms no subscription is active. Clear any stale local
    // state so the Subscribe CTA reappears — this is the critical path for
    // sandbox expiry (5 min monthly / 1 hr annual) and for real users whose
    // subscription has lapsed or been cancelled.
    if (store.subscription.active) {
      console.info(
        "[purchase] refreshEntitlements: platform reports no active subscription — clearing stale local state"
      )
      store.clearSubscription()
    }
  } else {
    console.warn(
      "[purchase] refreshEntitlements: subscription status unknown (plugin error) — keeping existing local state"
    )
  }

  // One-time book purchase recovery is platform-specific:
  //
  // iOS/macOS: we deliberately do NOT call restorePurchases() here. Apple's
  // HIG requires restore to be a user-initiated action (the explicit
  // "Restore Purchases" button in Settings → Packs), because calling
  // AppStore.sync() can prompt for Apple ID authentication when StoreKit's
  // session has expired — hostile UX at launch, and App Review actively
  // dings apps that auto-prompt. Users who reinstall or switch devices tap
  // the button once; thereafter localStorage + in-session purchase events
  // keep state consistent.
  //
  // Android: we DO call it. Play Billing's restorePurchases is silent (no
  // user auth required) and is how we pick up any unacknowledged purchases
  // so the plugin can ack them. Google auto-refunds purchases not
  // acknowledged within 3 days, so we can't wait for the user to tap a
  // button — the reader-pack flow acks post-purchase, but this is the
  // recovery path for acks that failed at purchase time.
  const platform = await getPlatform()
  if (platform === "android") {
    try {
      const restored = await restorePurchases()
      for (const r of restored) {
        if (r.productId.startsWith("corpan.book.")) {
          store.addPurchasedProduct(r.productId)
        }
      }
    } catch (err) {
      console.warn("[purchase] restore inside refreshEntitlements failed:", err)
    }
  }

  store.setLastRefreshed(Date.now())
}

/**
 * Open the platform's native subscription-management UI.
 *
 * Preferred path — the local `tauri-plugin-subscriptions` plugin:
 *   - iOS: `StoreKit.AppStore.showManageSubscriptions(in:)` renders inline
 *     over the app. Works identically in TestFlight and production (the
 *     StoreKit environment tracks the running build). Apple-recommended
 *     per App Review guideline 3.1.2.
 *   - Android: deep-links to the Play Store subscriptions page for this
 *     app so the user lands on Corpan's sub, not the generic account page.
 *
 * Fallback — `openUrl` to the web subscription page. Used on desktop, on
 * iOS < 15, or if the plugin invoke fails for any reason.
 */
export async function manageSubscription(): Promise<void> {
  const platform = await getPlatform()

  if (isTauriRuntime() && (platform === "ios" || platform === "android")) {
    try {
      await invoke("plugin:subscriptions|show_manage_subscriptions")
      return
    } catch (err) {
      console.warn(
        "[purchase] show_manage_subscriptions failed, falling back to openUrl:",
        err
      )
    }
  }

  let url: string
  if (platform === "ios" || platform === "macos") {
    url = "https://apps.apple.com/account/subscriptions"
  } else if (platform === "android") {
    url = "https://play.google.com/store/account/subscriptions"
  } else {
    return
  }
  try {
    await openUrl(url)
  } catch (err) {
    console.error("[purchase] manageSubscription openUrl failed:", err)
    if (typeof window !== "undefined") window.open(url, "_blank")
  }
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
