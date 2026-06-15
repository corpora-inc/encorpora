import { invoke } from "@tauri-apps/api/core"
import { type as osType } from "@tauri-apps/plugin-os"
import { openUrl } from "@tauri-apps/plugin-opener"
import { useEntitlementStore } from "@/store/entitlements"
import type { SubscriptionPlan } from "@/store/entitlements"
import {
  trackSubscriptionPurchased,
  trackTrialStarted,
  trackSubscriptionRestored,
  trackCodeResolved,
  trackCodeRedeemed,
} from "@/util/analytics"

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
  /**
   * Normalized introductory / free-trial offer the store attached to this
   * base plan, or `null` when none is configured. The UI lights up trial
   * framing when present and degrades to plain pricing when absent.
   */
  introOffer?: IntroOffer | null
}

export type PurchaseResult = {
  transactionId: string
  productId: string
  /** JWS receipt (iOS) or purchase token (Android) */
  receipt: string
  platform: PurchasePlatform
  /** "Production" / "Sandbox" / "Xcode" — emitted by the iOS plugin (iOS 16+) */
  environment?: string
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
    locked?: boolean
    verified?: boolean
    partnerName?: string
    message?: string
  }
  error?: string
}

// ---------------------------------------------------------------------------
// Code resolution (POST /code/resolve) — Phase 3 codes backend (contract §2)
// ---------------------------------------------------------------------------

/**
 * How the server classifies a code (contract §2.2). The server is the ONLY
 * classifier — the open-source client never decides this.
 */
export type CodeClassification =
  | "discount"
  | "affiliate"
  | "discount+affiliate"
  | "unknown"

/**
 * Platform mechanic the client must drive for this code (contract §2.2).
 *  • REDEEM_APPLE_SHEET    — present the StoreKit offer-code redeem sheet
 *  • USE_OFFER_TOKEN       — re-read the live Play offerToken + purchase with it
 *  • ATTRIBUTE_ONLY        — registry affiliate, no platform offer; plain buy
 *  • ATTRIBUTE_UNVERIFIED  — unknown code; plain buy, tracked unverified
 */
export type CodePurchaseAction =
  | "REDEEM_APPLE_SHEET"
  | "USE_OFFER_TOKEN"
  | "ATTRIBUTE_ONLY"
  | "ATTRIBUTE_UNVERIFIED"

/**
 * Hint the client uses to re-read the SESSION-BOUND Play `offerToken` from
 * `getProducts()`. Tokens are never returned by the backend — the client
 * matches `subscriptionOfferDetails[].offerId === googleOfferId`.
 */
export type OfferTokenHint = {
  googleOfferId: string
  basePlanId?: string
  offerTags?: string[]
}

/**
 * Response from `POST /code/resolve` (contract §2.3). There is NO fail-open:
 * an HTTP error, a network failure, or `status:"error"` surfaces as
 * `status:"error"` — NEVER as `"ok"`.
 */
export type CodeResolveResponse =
  | {
      status: "ok"
      code: string
      classification: CodeClassification
      purchaseAction: CodePurchaseAction
      /** null when classification is `discount` or `unknown`. */
      partnerName: string | null
      /** Localized server-side; null when there's no discount. */
      discountLabel: string | null
      /** = registry googleOfferId (Android USE_OFFER_TOKEN); null otherwise. */
      offerId: string | null
      /** Android USE_OFFER_TOKEN only; null otherwise. */
      offerTokenHint: OfferTokenHint | null
      /** = registry appleOfferIdentifier (Apple REDEEM_APPLE_SHEET); null otherwise. */
      appleOfferId: string | null
      /** Pre-iOS16 fallback deep link for the Apple redeem path. */
      appleRedeemUrl?: string | null
      /** Subject-bound JWT that gates the attribution write at verify time. */
      resolutionToken: string
      expiresInSec: number
    }
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
  /** ISO-8601 period for this phase, e.g. "P7D", "P1W", "P1M". */
  billingPeriod?: string
  /** How many cycles this phase repeats (Play `billingCycleCount` / iOS `periodCount`). */
  billingCycleCount?: number
  recurrenceMode?: number
}

type RawSubscriptionOffer = {
  offerToken?: string
  /** Play: the per-code offer id, e.g. "code-ian30". Empty on iOS/macOS. */
  offerId?: string
  /** Play: the base plan this offer attaches to, e.g. "annual". */
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

// ---------------------------------------------------------------------------
// Introductory / free-trial offer detection
// ---------------------------------------------------------------------------

/**
 * Normalized intro offer surfaced to the UI. `null` when the store offers no
 * intro for this product (the common case until a trial is configured in App
 * Store Connect / Play Console). The UI must degrade to plain pricing.
 */
export type IntroOffer = {
  kind: "free_trial" | "intro_price"
  /** Human period for one intro cycle, e.g. "7 days", "1 week", "3 months". */
  periodLabel: string
  /** Localized intro price for a paid intro. Absent for a free trial. */
  priceFormatted?: string
  /** How many billing cycles the intro lasts (StoreKit `periodCount` / Play `billingCycleCount`). */
  cycles: number
}

/**
 * Parse an ISO-8601 subscription period (P7D / P1W / P1M / P1Y / P3M…) into a
 * human label. Both StoreKit (via the iOS plugin's `formatSubscriptionPeriod`)
 * and Play Billing emit this `P<n><unit>` form. We deliberately keep this to
 * the single-unit periods stores actually use for subscriptions.
 */
export function periodLabelFromIso(iso: string | undefined): string {
  if (!iso) return ""
  const m = /^P(\d+)([DWMY])$/.exec(iso.trim())
  if (!m) return iso
  const n = Number(m[1])
  const plural = n === 1 ? "" : "s"
  switch (m[2]) {
    case "D":
      return `${n} day${plural}`
    case "W":
      return `${n} week${plural}`
    case "M":
      return `${n} month${plural}`
    case "Y":
      return `${n} year${plural}`
    default:
      return iso
  }
}

/**
 * A display price string represents "free" when it has no digits (e.g. "Free",
 * "Gratis", "$0.00" → has digits so excluded). Used as the iOS fallback signal
 * because the native plugin currently hardcodes `priceAmountMicros: 0` for
 * every phase and does NOT surface StoreKit's `introOffer.paymentMode`
 * (`.freeTrial`/`.payAsYouGo`/`.payUpFront`) — the canonical free-trial flag.
 * See the iOS gap note in the task report.
 */
function isFreeDisplayPrice(formatted: string | undefined): boolean {
  if (!formatted) return false
  return !/\d/.test(formatted)
}

/**
 * Extract a normalized intro offer from a raw store product, or `null`.
 *
 * Two wire shapes are handled (the native plugins normalize to a shared
 * `subscriptionOfferDetails[].pricingPhases[]` envelope):
 *
 *  • Android (Play Billing): ONE offer whose `pricingPhases[]` lists intro
 *    phase(s) FIRST and the recurring phase LAST. A phase with
 *    `priceAmountMicros === 0` is a free trial; a cheaper-than-recurring paid
 *    phase is an intro price. `priceAmountMicros` is authoritative.
 *
 *  • iOS (StoreKit, via tauri-plugin-iap): the intro lands in a SEPARATE
 *    offer object (`subscriptionOfferDetails[0]`) ahead of the regular offer.
 *    The plugin hardcodes `priceAmountMicros: 0` everywhere, so we fall back
 *    to the `formattedPrice` string: a no-digit price ("Free") → free_trial,
 *    otherwise intro_price. (Heuristic; see iOS gap note.)
 */
export function introOfferFromProduct(p: RawProduct): IntroOffer | null {
  const offers = p.subscriptionOfferDetails
  if (!offers || offers.length === 0) return null

  // Flatten all phases across all offers in store order. Android packs them
  // into offers[0] (intro phases first, recurring last); iOS splits intro
  // (offers[0]) and regular (offers[1]). In BOTH shapes the recurring phase
  // is the LAST phase overall, so we use that as the reference — NOT
  // `recurringPhaseFromOffers` (offers[0].last), which would mistake the iOS
  // intro phase for the recurring one.
  const phases = offers.flatMap((o) => o.pricingPhases ?? [])
  if (phases.length === 0) return null
  const recurring = phases[phases.length - 1]

  const recurringMicros = recurring?.priceAmountMicros
  const recurringFormatted = recurring?.formattedPrice

  // Candidate intro phases: anything that isn't the recurring phase and looks
  // cheaper/free. We scan every phase except the final recurring one.
  for (const phase of phases) {
    if (phase === recurring) continue

    const microsKnown = typeof phase.priceAmountMicros === "number"
    const micros = phase.priceAmountMicros ?? 0

    // Free trial: explicit zero micros (Android) OR a no-digit display price
    // when micros are unreliable (iOS, which sends 0 for every phase).
    const isFreeByMicros = microsKnown && micros === 0 && isFreeDisplayPrice(phase.formattedPrice)
    const isFreeByDisplay = isFreeDisplayPrice(phase.formattedPrice)
    if (isFreeByMicros || isFreeByDisplay) {
      return {
        kind: "free_trial",
        periodLabel: periodLabelFromIso(phase.billingPeriod),
        cycles: phase.billingCycleCount ?? 1,
      }
    }

    // Paid intro: a priced phase that is strictly cheaper than the recurring
    // price. On Android this is a clean micros compare. On iOS micros are 0
    // for everything, so we additionally accept a phase whose formatted price
    // differs from the recurring formatted price (the intro offer object).
    const cheaperByMicros =
      microsKnown &&
      typeof recurringMicros === "number" &&
      recurringMicros > 0 &&
      micros > 0 &&
      micros < recurringMicros
    const differsByDisplay =
      !!phase.formattedPrice &&
      !!recurringFormatted &&
      phase.formattedPrice !== recurringFormatted &&
      !isFreeDisplayPrice(phase.formattedPrice)
    // iOS: an intro phase living in its own (non-last) offer object is an
    // intro by construction; trust the display price when micros are absent.
    const isIosIntroObject = !microsKnown || (micros === 0 && recurringMicros === 0)
    if (cheaperByMicros || (differsByDisplay && isIosIntroObject)) {
      return {
        kind: "intro_price",
        periodLabel: periodLabelFromIso(phase.billingPeriod),
        priceFormatted: phase.formattedPrice,
        cycles: phase.billingCycleCount ?? 1,
      }
    }
  }

  return null
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
    introOffer: introOfferFromProduct(p),
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
    if ((platform === "ios" || platform === "macos") && subjectId) {
      payload.appAccountToken = subjectId
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
  options: { subjectId?: string; affiliateCode?: string; resolutionToken?: string } = {}
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
    const affiliateCode = options.affiliateCode
      ? normalizeAffiliateCode(options.affiliateCode)
      : ""
    if (affiliateCode && isAffiliateCodeFormatValid(affiliateCode)) {
      body.affiliateCode = affiliateCode
    }
    // The resolutionToken (minted by /code/resolve) gates the server-side
    // attribution write. Best-effort: omit it and the purchase still verifies,
    // attribution is simply skipped (contract §5.1, §3).
    if (options.resolutionToken) {
      body.resolutionToken = options.resolutionToken
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
 * Resolve an offer/affiliate code against the server (contract §2.1, §2.3).
 *
 * The server is the only classifier and authority. There is **NO fail-open**:
 * a format-invalid code, an HTTP error, or a network failure returns
 * `status:"error"` — it must NEVER surface as `"ok"` (contract §0.2). The only
 * `"ok"` result is one the server explicitly returned with a `resolutionToken`.
 *
 * @param raw       the raw code as typed by the user
 * @param productId optional — lets the server pick the right platform offer
 */
export async function resolveCode(
  raw: string,
  productId?: string
): Promise<CodeResolveResponse> {
  const code = normalizeAffiliateCode(raw)
  if (!code) {
    return { status: "error", error: "Enter a code." }
  }
  if (!isAffiliateCodeFormatValid(code)) {
    return {
      status: "error",
      code,
      error: "Use letters, numbers, dashes, or underscores.",
    }
  }

  const urlBase = getVerifyUrl()
  if (!urlBase) {
    return { status: "error", code, error: "Code check unavailable." }
  }

  try {
    const platform = await getPlatform()
    // "macos" resolves against the Apple ("ios") branch (contract §2.1).
    const resolvePlatform = platform === "android" ? "android" : "ios"

    const res = await fetch(urlBase.replace(/\/+$/, "") + "/code/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        subjectId: getCorpanSubjectId(),
        platform: resolvePlatform,
        ...(productId ? { productId } : {}),
      }),
    })

    if (!res.ok) {
      // NO fail-open — any non-2xx (incl. 404 / 502 / 429) is an error.
      const data = await res.json().catch(() => ({}))
      return {
        status: "error",
        code,
        error: (data as any).error ?? `Code check failed (${res.status})`,
      }
    }

    const data = (await res.json()) as CodeResolveResponse
    // Trust the server's own status field; a malformed body without a token is
    // treated as an error rather than silently accepted.
    if (data.status === "ok" && typeof data.resolutionToken === "string") {
      // Funnel: code_resolved — the server (the only classifier) accepted the
      // code. Low-cardinality classification + the platform mechanic to drive.
      trackCodeResolved(data.classification, data.purchaseAction)
      return data
    }
    if (data.status === "error") return data
    return { status: "error", code, error: "Code check failed." }
  } catch (err) {
    return {
      status: "error",
      code,
      error: err instanceof Error ? err.message : "Code check failed.",
    }
  }
}

/**
 * Re-read the live, session-bound Play `offerToken` for a resolved code
 * (contract §2.3 branch B). Offer tokens are NEVER returned by the backend —
 * the client matches the per-code `offerId` (and base plan, when present)
 * inside the freshly fetched `getProducts()` envelope.
 *
 * Returns `undefined` when no matching live offer is found (e.g. the Play
 * offer hasn't been created yet) — the caller then falls back to a plain
 * attributed purchase.
 */
export async function resolveOfferToken(
  productId: string,
  hint: OfferTokenHint
): Promise<string | undefined> {
  if (!isTauriRuntime()) return undefined
  try {
    const result = await invoke<{ products: RawProduct[] }>(
      "plugin:iap|get_products",
      { payload: { productIds: [productId], productType: "subs" } }
    )
    const product = (result.products ?? []).find(
      (p) => p.productId === productId
    )
    const offers = product?.subscriptionOfferDetails ?? []
    const match =
      offers.find(
        (o) =>
          o.offerId === hint.googleOfferId &&
          (!hint.basePlanId || o.basePlanId === hint.basePlanId)
      ) ?? offers.find((o) => o.offerId === hint.googleOfferId)
    return match?.offerToken || undefined
  } catch (err) {
    console.warn("[purchase] resolveOfferToken failed:", err)
    return undefined
  }
}

/**
 * Present the StoreKit offer-code redeem sheet (contract §9.3). The command
 * itself is owned by the iOS plugin (WS-D) and may not exist yet — guard the
 * invoke and fall back to opening the `appleRedeemUrl` deep link.
 *
 * After the sheet, the redeemed transaction is delivered through the plugin's
 * existing `Transaction.updates` listener; the caller verifies the resulting
 * purchase carrying the `resolutionToken`.
 *
 * @returns true if the sheet (or the URL fallback) was presented.
 */
export async function presentAppleOfferRedeemSheet(opts: {
  appleOfferId?: string | null
  appleRedeemUrl?: string | null
}): Promise<boolean> {
  if (isTauriRuntime()) {
    try {
      // FROZEN command name + arg shape (contract §9.3).
      await invoke("plugin:iap|present_offer_code_redeem_sheet", {
        payload: { appleOfferId: opts.appleOfferId ?? undefined },
      })
      return true
    } catch (err) {
      console.warn(
        "[purchase] present_offer_code_redeem_sheet unavailable, falling back to redeem URL:",
        err
      )
    }
  }
  // Fallback: open the App Store redeem deep link (pre-iOS16 / command absent).
  if (opts.appleRedeemUrl) {
    try {
      await openUrl(opts.appleRedeemUrl)
      return true
    } catch (err) {
      console.error("[purchase] openUrl(appleRedeemUrl) failed:", err)
    }
  }
  return false
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
    // Funnel: subscription_purchased (+ trial_started when an explicit intro/
    // offer path was used — Android offerToken signals the per-offer purchase).
    // Emitted on PLATFORM confirmation (the source of truth), so it fires even
    // if backend verification later fails. Code is the applied offer/affiliate.
    const validCode =
      options.affiliateCode &&
      isAffiliateCodeFormatValid(normalizeAffiliateCode(options.affiliateCode))
        ? normalizeAffiliateCode(options.affiliateCode)
        : undefined
    trackSubscriptionPurchased(plan, purchase.platform, validCode)
    if (options.offerToken) trackTrialStarted(plan)
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

  // Funnel: code_redeemed — the server confirmed an affiliate/offer
  // attribution write for this purchase (the authoritative redemption signal).
  const attribution = verification.affiliateAttribution
  if (attribution && (attribution.verified || attribution.locked)) {
    trackCodeRedeemed(attribution.partnerName ?? "")
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
        // Funnel: subscription_restored — a prior subscription was re-verified.
        trackSubscriptionRestored()
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
