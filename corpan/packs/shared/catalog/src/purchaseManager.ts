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
