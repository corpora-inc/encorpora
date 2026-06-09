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
  /** "Production" / "Sandbox" / "Xcode" — emitted by the iOS plugin (iOS 16+) */
  environment?: string
  /** `appAccountToken` echoed back by StoreKit on the initial transaction (iOS/macOS). */
  appAccountToken?: string
  /** Offer id applied to this transaction, when the platform exposes it. */
  offerId?: string
  /** Offer type for the applied offer, when the platform exposes it. */
  offerType?: string
}

export type PurchaseVerificationResponse = {
  status: "verified" | "failed"
  transactionId?: string
  productId?: string
  signedUrl?: string
  subscriptionActive?: boolean
  expiresAt?: string | null
  subjectId?: string
  plus?: boolean
  entitlementToken?: string
  affiliateAttribution?: {
    code?: string
    partnerId?: string | null
    locked?: boolean
    verified?: boolean
    discountApplied?: boolean
    ledgerEventId?: string
    message?: string
  }
  error?: string
}

/**
 * Platform redemption mechanism the client must route to, decided SERVER-SIDE by
 * `/code/resolve`. Mirrors the backend `PURCHASE_ACTIONS` (codes.js):
 *
 *  - `normal`                      → full-price purchase; attach the code/token so
 *                                    the server records attribution (affiliate or
 *                                    unknown free-text).
 *  - `apple_offer_code`            → present Apple's offer-code redeem sheet.
 *  - `google_promo_code`           → open Play's redeem flow (usually a URL).
 *  - `android_subscription_offer`  → purchase with the resolved offer's offerToken.
 */
export type CodePurchaseActionType =
  | "normal"
  | "apple_offer_code"
  | "google_promo_code"
  | "android_subscription_offer"

export type CodeResolveResponse =
  | {
      status: "ok"
      code: string
      /** Registry classification: affiliate | affiliate+offer | appleOfferCode | playPromo | playOffer. */
      kind: string
      /** True only for a registry-backed partner code (revenue-share attribution). */
      verified: boolean
      purchaseAction: { type: CodePurchaseActionType }
      partnerName?: string
      /** Human, server-localized, e.g. "50% off first year". Present for discount kinds. */
      discountLabel?: string
      /** Apple offer id (REDEEM_APPLE_SHEET); informational. */
      appleOfferId?: string | null
      /** Apple redeem URL fallback when the in-app sheet is unavailable. */
      appleRedeemUrl?: string
      /** Android offer descriptor — client re-reads the offerToken from getProducts. */
      offer?: {
        playOfferId?: string | null
        playBasePlanId?: string | null
        offerToken?: string | null
      }
      /** A KNOWN code that is currently expired/paused (treated as free-text affiliate). */
      inactiveKnown?: boolean
      /** Short-lived signed token binding {code, subjectId, kind}; required for any attribution write. */
      resolutionToken: string
      expiresInSec?: number
    }
  // Format/validation rejection (4xx) — show inline, do NOT proceed with this code.
  | { status: "invalid"; code?: string; error: string }
  // Lookup/network failure — NO fail-open. Let the user retry or continue WITHOUT a code.
  | { status: "error"; code?: string; error: string }

export type EntitlementTokenResponse = {
  status: "ok" | "failed"
  subjectId?: string
  plus?: boolean
  expiresAt?: string | null
  entitlementToken?: string
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

const SUBJECT_ID_KEY = "corpan:subject-id:v1"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function randomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
}

export function getCorpanSubjectId(): string {
  const store = useEntitlementStore.getState()
  if (store.subjectId && UUID_RE.test(store.subjectId)) return store.subjectId
  try {
    const saved = localStorage.getItem(SUBJECT_ID_KEY)
    if (saved && UUID_RE.test(saved)) {
      store.setSubjectId(saved)
      return saved
    }
    const id = randomId()
    localStorage.setItem(SUBJECT_ID_KEY, id)
    store.setSubjectId(id)
    return id
  } catch {
    const id = randomId()
    store.setSubjectId(id)
    return id
  }
}

const APP_ACCOUNT_TOKEN_KEY = "corpan:app-account-token:v1"

/**
 * Stable per-install `appAccountToken` (UUID) for StoreKit purchases.
 *
 * This is THE durable attribution key on Apple: it's echoed back on the initial
 * transaction and persists across renewals, so renewals stay credited to the
 * same subject via our ledger. Generated once and persisted (localStorage +
 * the entitlement store), then reused for EVERY purchase.
 *
 * Seeded from the `subjectId` so the two line up (the backend's renewal
 * fallback reads the attribution lock directly when `appAccountToken ===
 * subjectId`), but stored independently so a later subjectId change can't
 * silently break renewal crediting of an already-locked purchase.
 */
export function getAppAccountToken(): string {
  const store = useEntitlementStore.getState()
  if (store.appAccountToken && UUID_RE.test(store.appAccountToken)) {
    return store.appAccountToken
  }
  try {
    const saved = localStorage.getItem(APP_ACCOUNT_TOKEN_KEY)
    if (saved && UUID_RE.test(saved)) {
      store.setAppAccountToken(saved)
      return saved
    }
    // Seed from the subjectId (itself a UUID) so the keys align; fall back to a
    // fresh UUID only if the subjectId is somehow unusable.
    const subjectId = getCorpanSubjectId()
    const token = UUID_RE.test(subjectId) ? subjectId : randomId()
    localStorage.setItem(APP_ACCOUNT_TOKEN_KEY, token)
    store.setAppAccountToken(token)
    return token
  } catch {
    const subjectId = getCorpanSubjectId()
    const token = UUID_RE.test(subjectId) ? subjectId : randomId()
    store.setAppAccountToken(token)
    return token
  }
}

export function normalizeAffiliateCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "")
}

export function isAffiliateCodeFormatValid(code: string): boolean {
  return code.length > 0 && code.length <= 32 && /^[A-Z0-9_-]+$/.test(code)
}

async function sha256Hex(value: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(value)
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  } catch {
    return value
  }
}

// ---------------------------------------------------------------------------
// IAP plugin wrappers — every call hits the platform fresh, NO caching
// ---------------------------------------------------------------------------

/**
 * Retry schedule for transient empty / network failures from the platform.
 * Each attempt is a fresh plugin invoke; we never cache the result of any
 * attempt. The Swift plugin retries internally too (belt-and-suspenders).
 *
 * `[0, 500, 1500, 3500, 6500]` = 5 attempts in ~12s worst-case. The
 * skeleton stays on screen throughout.
 */
const FETCH_RETRY_DELAYS_MS = [0, 500, 1500, 3500, 6500] as const

export type FetchProductsResult =
  | { ok: true; products: StoreProduct[] }
  | { ok: false; error: string }

/**
 * Wire shape from the native plugin. iOS plugin emits top-level
 * `formattedPrice` for every product. Android Play Billing only emits it
 * top-level for one-time products — for auto-renewable subscriptions, the
 * price lives inside `subscriptionOfferDetails[].pricingPhases[]` and the
 * recurring price is the LAST phase (intro phases come first if any).
 */
type RawPricingPhase = {
  formattedPrice?: string
  priceCurrencyCode?: string
  priceAmountMicros?: number
  recurrenceMode?: number
}

type RawSubscriptionOffer = {
  offerToken?: string
  offerId?: string
  basePlanId?: string
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

/**
 * Pick the recurring (post-intro) pricing phase. iOS doesn't use this path
 * (top-level fields are populated). On Android we walk the offer details
 * and take the last pricing phase, which is the recurring one per Google's
 * documented ordering.
 */
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

/**
 * Fetch product info (localized prices) from the platform store.
 *
 * Retries up to FETCH_RETRY_DELAYS_MS.length attempts. Returns
 * `{ ok: false, error }` only if every attempt failed or returned empty.
 */
export async function fetchProducts(
  productIds: string[],
  productType: "subs" | "inapp" = "inapp"
): Promise<FetchProductsResult> {
  if (!isTauriRuntime()) return { ok: false, error: "IAP unavailable in this environment" }
  if (productIds.length === 0) return { ok: true, products: [] }

  let lastError = ""
  for (let attempt = 0; attempt < FETCH_RETRY_DELAYS_MS.length; attempt++) {
    const delay = FETCH_RETRY_DELAYS_MS[attempt]
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))

    try {
      const result = await invoke<{ products: RawProduct[] }>(
        "plugin:iap|get_products",
        { payload: { productIds, productType } }
      )
      const raw = result.products ?? []
      if (raw.length > 0) {
        const products = raw.map(normalizeProduct)
        if (attempt > 0) {
          console.warn(
            `[purchase] fetchProducts succeeded on attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} for`,
            productIds
          )
        }
        console.info(
          "[purchase] fetchProducts → ",
          products.length,
          "products:",
          products.map((p) => ({ id: p.productId, price: p.price }))
        )
        return { ok: true, products }
      }
      lastError = "App Store returned no products"
      console.warn(
        `[purchase] fetchProducts attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} returned empty for`,
        productIds
      )
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(
        `[purchase] fetchProducts attempt ${attempt + 1}/${FETCH_RETRY_DELAYS_MS.length} failed:`,
        err
      )
    }
  }

  return { ok: false, error: lastError || "App Store unreachable" }
}

/**
 * Re-read the Android subscription offerToken for a product, matched by the
 * resolved offer's `playOfferId` / `playBasePlanId`. The server returns offer
 * IDs (stable), never the token (device/session-specific), so the client must
 * re-fetch `getProducts` and select the matching offer's `offerToken`.
 *
 * Returns `undefined` when not on Android, the plugin is unavailable, or no
 * matching offer exists (caller falls back to a full-price purchase).
 */
export async function findAndroidOfferToken(
  productId: string,
  offer: { playOfferId?: string | null; playBasePlanId?: string | null } | undefined | null
): Promise<string | undefined> {
  if (!isTauriRuntime() || !offer) return undefined
  try {
    const result = await invoke<{ products: RawProduct[] }>("plugin:iap|get_products", {
      payload: { productIds: [productId], productType: "subs" },
    })
    const product = (result.products ?? []).find((p) => p.productId === productId)
    const offers = product?.subscriptionOfferDetails ?? []
    if (offers.length === 0) return undefined

    // Prefer an exact offerId match, then basePlanId, so a paid-discount offer
    // is selected over the bare base plan.
    const wantOfferId = offer.playOfferId ?? undefined
    const wantBasePlan = offer.playBasePlanId ?? undefined
    const byOfferId = wantOfferId
      ? offers.find((o) => o.offerId === wantOfferId)
      : undefined
    if (byOfferId?.offerToken) return byOfferId.offerToken
    const byBasePlan = wantBasePlan
      ? offers.find((o) => o.basePlanId === wantBasePlan)
      : undefined
    if (byBasePlan?.offerToken) return byBasePlan.offerToken
    return undefined
  } catch (err) {
    console.warn("[purchase] findAndroidOfferToken failed:", err)
    return undefined
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

// ---------------------------------------------------------------------------
// Plugin error code mapping (matches IapPlugin.swift / Android plugin reject
// strings — every reject starts with `<CODE>: <message>`).
// ---------------------------------------------------------------------------

export type PurchaseFailureKind =
  | "USER_CANCELLED"
  | "ALREADY_OWNED"
  | "PURCHASE_PENDING"
  | "PURCHASE_NOT_ALLOWED"
  | "PRODUCT_UNAVAILABLE"
  | "VERIFICATION_FAILED"
  | "NETWORK_ERROR"
  | "NOT_IN_STOREFRONT"
  | "NOT_ENTITLED"
  | "TIMEOUT"
  | "UNKNOWN"

function classifyError(err: unknown): { code: PurchaseFailureKind; message: string } {
  if (err instanceof TimeoutError) {
    return { code: "TIMEOUT", message: err.message }
  }
  const raw = err instanceof Error ? err.message : String(err)
  const upper = raw.toUpperCase()
  if (upper.startsWith("USER_CANCELLED") || upper.includes("CANCEL")) {
    return { code: "USER_CANCELLED", message: raw }
  }
  if (upper.startsWith("ALREADY_OWNED") || upper.includes("ALREADYPURCHASED") || upper.includes("ALREADY_SUBSCRIBED")) {
    return { code: "ALREADY_OWNED", message: raw }
  }
  if (upper.startsWith("PURCHASE_PENDING")) {
    return { code: "PURCHASE_PENDING", message: raw }
  }
  if (upper.startsWith("PURCHASE_NOT_ALLOWED")) {
    return { code: "PURCHASE_NOT_ALLOWED", message: raw }
  }
  if (upper.startsWith("PRODUCT_UNAVAILABLE")) {
    return { code: "PRODUCT_UNAVAILABLE", message: raw }
  }
  if (upper.startsWith("VERIFICATION_FAILED")) {
    return { code: "VERIFICATION_FAILED", message: raw }
  }
  if (upper.startsWith("NETWORK_ERROR")) {
    return { code: "NETWORK_ERROR", message: raw }
  }
  if (upper.startsWith("NOT_IN_STOREFRONT")) {
    return { code: "NOT_IN_STOREFRONT", message: raw }
  }
  if (upper.startsWith("NOT_ENTITLED")) {
    return { code: "NOT_ENTITLED", message: raw }
  }
  return { code: "UNKNOWN", message: raw }
}

// ---------------------------------------------------------------------------
// Purchase flow
// ---------------------------------------------------------------------------

export type PurchaseOutcome =
  | { kind: "ok"; result: PurchaseResult }
  | { kind: "cancelled" }
  | { kind: "timeout" }
  | { kind: "alreadyOwned" }
  | { kind: "pending" }
  | { kind: "error"; code: PurchaseFailureKind; message: string }

export type PurchaseProductOptions = {
  subjectId?: string
  /** Android subscription offer token (selects a specific paid-discount offer). */
  offerToken?: string
}

const PURCHASE_TIMEOUT_MS = 60_000

/**
 * Initiate a purchase via the platform store (triggers Face ID / biometric).
 * Times out after 60s so the UI doesn't hang if StoreKit never responds.
 */
export async function purchaseProduct(
  productId: string,
  productType: "subs" | "inapp" = "inapp",
  options: PurchaseProductOptions = {}
): Promise<PurchaseOutcome> {
  if (!isTauriRuntime()) {
    return { kind: "error", code: "UNKNOWN", message: "IAP unavailable in this environment" }
  }

  try {
    const platform = await getPlatform()
    const subjectId = options.subjectId ?? getCorpanSubjectId()
    const payload: Record<string, unknown> = { productId, productType }
    if (options.offerToken) payload.offerToken = options.offerToken
    if (platform === "ios" || platform === "macos") {
      // Stable per-install UUID → keeps renewals attributed (see getAppAccountToken).
      payload.appAccountToken = getAppAccountToken()
    } else if (platform === "android" && subjectId) {
      payload.obfuscatedAccountId = await sha256Hex(subjectId)
    }

    const purchase = await withTimeout(
      invoke<{
        id: string
        productId: string
        originalJson?: string
        signature?: string
        jwsRepresentation?: string
        purchaseToken?: string
        environment?: string
        appAccountToken?: string
        offerId?: string
        offerType?: string
      }>("plugin:iap|purchase", { payload }),
      PURCHASE_TIMEOUT_MS
    )

    const receipt =
      purchase.jwsRepresentation ??
      purchase.purchaseToken ??
      purchase.originalJson ??
      ""

    return {
      kind: "ok",
      result: {
        transactionId: purchase.id,
        productId: purchase.productId,
        receipt,
        platform,
        environment: purchase.environment,
        appAccountToken: purchase.appAccountToken,
        offerId: purchase.offerId,
        offerType: purchase.offerType,
      },
    }
  } catch (err) {
    const cls = classifyError(err)

    if (cls.code === "USER_CANCELLED") return { kind: "cancelled" }
    if (cls.code === "ALREADY_OWNED") return { kind: "alreadyOwned" }
    if (cls.code === "PURCHASE_PENDING") return { kind: "pending" }
    if (cls.code === "TIMEOUT") return { kind: "timeout" }

    // Defensive: StoreKit sometimes rejects even when the transaction
    // actually completed (Already Purchased → Get again for free →
    // Transaction.updates listener finishes the txn behind our backs).
    // Re-check authoritative product status before reporting failure.
    try {
      const status = await getProductStatus(productId, productType)
      if (status.state === "owned") {
        console.warn(
          "[purchase] purchaseProduct rejected but product is owned — treating as alreadyOwned:",
          err
        )
        return { kind: "alreadyOwned" }
      }
    } catch (statusErr) {
      console.warn("[purchase] post-error status check failed:", statusErr)
    }

    console.error("[purchase] purchaseProduct error:", err)
    return { kind: "error", code: cls.code, message: cls.message }
  }
}

/**
 * Restore previous purchases from the platform (tied to Apple ID / Google
 * account). Each call is a fresh plugin invoke — no cache.
 */
export async function restorePurchases(): Promise<PurchaseResult[]> {
  if (!isTauriRuntime()) return []

  const results: PurchaseResult[] = []
  const platform = await getPlatform()
  const t0 = Date.now()
  console.info("[purchase] restorePurchases START platform=", platform)

  // Restore one-time purchases
  try {
    const inappResult = await invoke<{ purchases: any[] }>(
      "plugin:iap|restore_purchases",
      { payload: { productType: "inapp" } }
    )
    const arr = inappResult.purchases ?? []
    console.info(
      "[purchase] restorePurchases(inapp) →",
      arr.length,
      "items:",
      arr.map((p) => ({ productId: p.productId, env: p.environment }))
    )
    for (const p of arr) {
      results.push({
        transactionId: p.id ?? p.orderId ?? "",
        productId: p.productId ?? "",
        receipt: p.jwsRepresentation ?? p.purchaseToken ?? "",
        platform,
        environment: p.environment,
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
    const arr = subsResult.purchases ?? []
    console.info(
      "[purchase] restorePurchases(subs) →",
      arr.length,
      "items:",
      arr.map((p) => ({ productId: p.productId, env: p.environment }))
    )
    for (const p of arr) {
      results.push({
        transactionId: p.id ?? p.orderId ?? "",
        productId: p.productId ?? "",
        receipt: p.jwsRepresentation ?? p.purchaseToken ?? "",
        platform,
        environment: p.environment,
      })
    }
  } catch (err) {
    console.warn("[purchase] restore subs error:", err)
  }

  console.info(
    "[purchase] restorePurchases DONE — total=",
    results.length,
    `${Date.now() - t0}ms`,
    "productIds=",
    results.map((r) => r.productId)
  )
  return results
}

/** Acknowledge a purchase (required on Android within 3 days). */
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

/** Check product ownership via the IAP plugin. No cache. */
export async function getProductStatus(
  productId: string,
  productType: "subs" | "inapp" = "inapp"
): Promise<ProductStatus> {
  if (!isTauriRuntime()) return { state: "not_owned" }

  try {
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

const DEFAULT_VERIFY_URL = "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod"

const getVerifyUrl = () => {
  const envUrl = import.meta.env.VITE_GAME_VERIFY_URL
  if (typeof envUrl === "string" && envUrl.length > 0) return envUrl
  return DEFAULT_VERIFY_URL
}

export async function verifyPurchase(
  purchase: PurchaseResult,
  packId?: string,
  options: {
    subjectId?: string
    affiliateCode?: string
    /** Signed token from `/code/resolve`; required for the server to record attribution. */
    resolutionToken?: string
  } = {}
): Promise<PurchaseVerificationResponse> {
  const urlBase = getVerifyUrl()
  if (!urlBase) {
    return { status: "failed", error: "Verification endpoint not configured" }
  }

  try {
    // Concat instead of `new URL(...)` — that strips the stage path.
    const url = urlBase.replace(/\/+$/, "") + "/verify-purchase"
    const body: Record<string, unknown> = {
      platform: purchase.platform,
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      subjectId: options.subjectId ?? getCorpanSubjectId(),
    }

    if (purchase.platform === "ios" || purchase.platform === "macos") {
      body.receipt = purchase.receipt
    } else if (purchase.platform === "android") {
      body.purchaseToken = purchase.receipt
    }

    if (packId) body.packId = packId

    // `appAccountToken` is the durable attribution key for renewals (iOS/macOS):
    // it's echoed back on the initial transaction and rides every renewal in our
    // ledger. Send it so the backend's reverse-map is seeded.
    if (purchase.platform === "ios" || purchase.platform === "macos") {
      body.appAccountToken = purchase.appAccountToken ?? getAppAccountToken()
    }

    const affiliateCode = options.affiliateCode
      ? normalizeAffiliateCode(options.affiliateCode)
      : ""
    if (affiliateCode && isAffiliateCodeFormatValid(affiliateCode)) {
      body.affiliateCode = affiliateCode
      // The resolutionToken is only meaningful alongside a code; the server
      // requires it to write a VERIFIED partner attribution (else: unverified).
      if (options.resolutionToken) body.resolutionToken = options.resolutionToken
    }

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

    const data = (await res.json()) as PurchaseVerificationResponse
    if (data.entitlementToken) {
      useEntitlementStore.getState().setEntitlementToken(data.entitlementToken)
    }
    if (data.subjectId) {
      useEntitlementStore.getState().setSubjectId(data.subjectId)
    }
    return data
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Verification failed",
    }
  }
}

/**
 * Resolve an affiliate / offer code SERVER-SIDE via `POST /code/resolve`.
 *
 * The client never classifies — it sends the raw code and acts on the returned
 * `kind` + `purchaseAction.type`. There is NO fail-open: a `status:"error"`
 * (HTTP 502) or any network failure returns an explicit `error` state so the UI
 * can let the user retry or continue WITHOUT a code. We never claim a code is
 * "applied" just because the check was unreachable.
 *
 * A 4xx format/validation rejection maps to `status:"invalid"` (show inline,
 * don't proceed with this code).
 */
export async function resolveCode(raw: string): Promise<CodeResolveResponse> {
  const code = normalizeAffiliateCode(raw)
  if (!code) return { status: "invalid", error: "Enter a code." }
  if (!isAffiliateCodeFormatValid(code)) {
    return { status: "invalid", code, error: "Use letters, numbers, dashes, or underscores." }
  }
  const urlBase = getVerifyUrl()
  if (!urlBase) {
    return { status: "error", code, error: "Couldn't check the code." }
  }
  try {
    const platform = await getPlatform()
    const res = await fetch(urlBase.replace(/\/+$/, "") + "/code/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        subjectId: getCorpanSubjectId(),
        platform,
        productId: undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      // 4xx → a real validation rejection (bad format / missing field). 5xx /
      // 502 → lookup failure: NO fail-open, surface as a retryable error.
      if (res.status >= 400 && res.status < 500) {
        return {
          status: "invalid",
          code,
          error: (data as any).error ?? `Code check failed (${res.status})`,
        }
      }
      console.error("[purchase] resolveCode lookup failed:", res.status, (data as any).error)
      return {
        status: "error",
        code,
        error: (data as any).error ?? `Couldn't check the code (${res.status}).`,
      }
    }
    const data = (await res.json()) as CodeResolveResponse
    // The server returns status:"error" with HTTP 502 on a lookup failure; if it
    // ever returns it with 200, honor it as an error (never auto-promote).
    return data
  } catch (err) {
    console.error("[purchase] resolveCode network error:", err)
    return {
      status: "error",
      code,
      error: err instanceof Error ? err.message : "Couldn't check the code.",
    }
  }
}

/**
 * Present the native offer-code / promo-code redemption flow (iOS sheet or a
 * Play / Apple redeem URL). The sheet only *presents* — it never reports whether
 * a code was redeemed. The caller MUST follow up with {@link syncAfterRedemption}
 * once the user returns, to observe the discounted entitlement + attribution.
 */
export async function redeemOfferCode(
  code?: string
): Promise<{ outcome: "presented" | "useUrl" | "unsupported"; url?: string; message?: string }> {
  if (!isTauriRuntime()) {
    return { outcome: "unsupported", message: "IAP unavailable in this environment" }
  }
  try {
    return await invoke<{
      outcome: "presented" | "useUrl" | "unsupported"
      url?: string
      message?: string
    }>("plugin:iap|redeem_offer_code", { payload: { code } })
  } catch (err) {
    console.error("[purchase] redeemOfferCode error:", err)
    return {
      outcome: "unsupported",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * After launching a redemption (Apple sheet / Play or Apple redeem URL), sync the
 * new entitlement + attribution once the user returns. Restores purchases, runs
 * `verifyPurchase` (carrying the `resolutionToken` so attribution is recorded on
 * the redemption path that has no Subscribe button), and refreshes the
 * entitlement token. Returns whether any active subscription was observed.
 */
export async function syncAfterRedemption(options: {
  affiliateCode?: string
  resolutionToken?: string
} = {}): Promise<{ observedActive: boolean }> {
  console.info("[purchase] syncAfterRedemption START")
  const subjectId = getCorpanSubjectId()
  let observedActive = false

  let restored: PurchaseResult[] = []
  try {
    restored = await restorePurchases()
  } catch (err) {
    console.warn("[purchase] syncAfterRedemption restore failed:", err)
  }

  const store = useEntitlementStore.getState()
  for (const purchase of restored) {
    if (purchase.productId !== SUBSCRIPTION_MONTHLY && purchase.productId !== SUBSCRIPTION_ANNUAL) {
      continue
    }
    const verification = await verifyPurchase(purchase, undefined, {
      subjectId,
      // Attach code + token so the redeemed offer is attributed (the redemption
      // path never went through the Subscribe button / purchaseAndVerify).
      affiliateCode: options.affiliateCode,
      resolutionToken: options.resolutionToken,
    })
    if (verification.status === "verified" && verification.subscriptionActive) {
      observedActive = true
      const plan: SubscriptionPlan =
        purchase.productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
      store.setSubscription({
        active: true,
        plan,
        expiresAt: verification.expiresAt ?? null,
        autoRenew: true,
      })
    }
  }

  // Pick up entitlement even if the restore didn't surface it (platform cache).
  await refreshEntitlements()
  await refreshEntitlementToken()
  store.setLastRefreshed(Date.now())
  console.info("[purchase] syncAfterRedemption DONE — observedActive=", observedActive)
  return { observedActive }
}

export async function refreshEntitlementToken(): Promise<EntitlementTokenResponse> {
  const urlBase = getVerifyUrl()
  const subjectId = getCorpanSubjectId()
  try {
    const res = await fetch(urlBase.replace(/\/+$/, "") + "/entitlement-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subjectId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      useEntitlementStore.getState().setEntitlementToken(null)
      return {
        status: "failed",
        subjectId,
        error: (data as any).error ?? `Entitlement token failed (${res.status})`,
      }
    }
    const data = (await res.json()) as EntitlementTokenResponse
    useEntitlementStore.getState().setEntitlementToken(data.entitlementToken ?? null)
    if (data.subjectId) useEntitlementStore.getState().setSubjectId(data.subjectId)
    return data
  } catch (err) {
    useEntitlementStore.getState().setEntitlementToken(null)
    return {
      status: "failed",
      subjectId,
      error: err instanceof Error ? err.message : "Entitlement token failed",
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
  productType: "subs" | "inapp" = "inapp",
  options: { affiliateCode?: string; offerToken?: string; resolutionToken?: string } = {}
): Promise<{
  signedUrl?: string
  error?: { code: PurchaseFailureKind; message: string }
  cancelled?: boolean
  alreadyOwned?: boolean
  pending?: boolean
  timeout?: boolean
  verifyFailed?: boolean
}> {
  const subjectId = getCorpanSubjectId()
  const outcome = await purchaseProduct(productId, productType, {
    subjectId,
    offerToken: options.offerToken,
  })

  if (outcome.kind === "cancelled") return { cancelled: true }
  if (outcome.kind === "timeout") return { timeout: true }
  if (outcome.kind === "pending") return { pending: true }
  if (outcome.kind === "alreadyOwned") {
    await refreshEntitlements()
    return { alreadyOwned: true }
  }
  if (outcome.kind === "error") {
    return { error: { code: outcome.code, message: outcome.message } }
  }
  const purchase = outcome.result

  // Platform confirmed purchase — update local entitlement immediately.
  // (This is in-memory state for the session; not persisted.)
  const store = useEntitlementStore.getState()
  if (productType === "subs") {
    const plan: SubscriptionPlan =
      productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly"
    store.setSubscription({
      active: true,
      plan,
      expiresAt: null,
      autoRenew: true,
    })
  } else {
    store.addPurchasedProduct(productId)
  }
  store.setLastRefreshed(Date.now())

  if (purchase.platform === "android" && purchase.receipt) {
    await acknowledgePurchase(purchase.receipt)
  }

  const verification = await verifyPurchase(purchase, packId, {
    subjectId,
    affiliateCode: options.affiliateCode,
    resolutionToken: options.resolutionToken,
  })
  if (verification.status !== "verified") {
    console.warn(
      "[purchase] backend verification failed (entitlement still set locally):",
      verification.error
    )
    return { verifyFailed: true }
  }

  if (productType === "subs" && verification.expiresAt) {
    store.setSubscription({
      active: true,
      plan: productId === SUBSCRIPTION_ANNUAL ? "annual" : "monthly",
      expiresAt: verification.expiresAt,
      autoRenew: true,
    })
  }
  if (verification.entitlementToken) {
    store.setEntitlementToken(verification.entitlementToken)
  }

  return { signedUrl: verification.signedUrl }
}

/**
 * Refresh entitlements from the IAP plugin (local query — no network on iOS
 * via Transaction.currentEntitlements).
 */
export async function refreshEntitlements(): Promise<void> {
  if (!isTauriRuntime()) return

  const store = useEntitlementStore.getState()

  let activeSub: { plan: SubscriptionPlan; expiresAt: string | null } | null = null
  let anyStatusUnknown = false

  for (const subId of [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL]) {
    const status = await getProductStatus(subId, "subs")
    console.info("[purchase] refreshEntitlements:", subId, "→", status)
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
    void refreshEntitlementToken()
  } else if (!anyStatusUnknown) {
    if (store.subscription.active) {
      console.info("[purchase] refreshEntitlements: clearing stale local sub state")
      store.clearSubscription()
    }
    store.setEntitlementToken(null)
  } else {
    console.warn("[purchase] refreshEntitlements: subscription status unknown — keeping in-memory state")
  }

  // Android: silent restore so we can ack any unack'd purchases (Google
  // auto-refunds within 3 days). iOS: deliberately NOT calling restore here
  // (HIG forbids auto-sync; reviewers ding apps that prompt for Apple ID
  // at launch).
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
 * Open the platform's native subscription-management UI. Falls back to the
 * web subscription page if the plugin isn't available.
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
 * Restore purchases and sync entitlements with backend. User-initiated;
 * called by the Restore Purchases button.
 */
export async function restoreAndSync(): Promise<{
  restoredCount: number
  error?: string
}> {
  console.info("[purchase] restoreAndSync START")
  const purchases = await restorePurchases()
  if (purchases.length === 0) {
    console.info("[purchase] restoreAndSync — no purchases to restore")
    return { restoredCount: 0 }
  }

  const store = useEntitlementStore.getState()
  let restoredCount = 0

  for (const purchase of purchases) {
    console.info(
      "[purchase] restoreAndSync verifying:",
      purchase.productId,
      "txn=",
      purchase.transactionId
    )
    const verification = await verifyPurchase(purchase)
    console.info(
      "[purchase] restoreAndSync verify result for",
      purchase.productId,
      "→",
      {
        status: verification.status,
        subscriptionActive: verification.subscriptionActive,
        expiresAt: verification.expiresAt,
        productId: verification.productId,
        error: verification.error,
      }
    )
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

  console.info(
    "[purchase] restoreAndSync DONE — restoredCount=",
    restoredCount,
    "out of",
    purchases.length,
    "candidates"
  )

  // Notify reader paywalls so they re-query the plugin on the next
  // entitlement refresh (the reader listens for this event).
  try {
    window.dispatchEvent(new CustomEvent("corpan:restore-purchases-completed"))
    console.info("[purchase] dispatched corpan:restore-purchases-completed")
  } catch (err) {
    console.warn("[purchase] failed to dispatch restore-completed event:", err)
  }

  return { restoredCount }
}
