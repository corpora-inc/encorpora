import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Button } from "@/components/ui/button"
import { OfflineNotice } from "@/components/OfflineNotice"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useEntitlementStore } from "@/store/entitlements"
import { trackPaidUnlockViewed } from "@/util/analytics"
import {
  fetchProducts,
  purchaseAndVerify,
  manageSubscription,
  findAndroidOfferToken,
  getProductStatus,
  isAffiliateCodeFormatValid,
  normalizeAffiliateCode,
  resolveCode,
  redeemOfferCode,
  syncAfterRedemption,
  restoreAndSync,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_ANNUAL,
  type CodeResolveResponse,
  type StoreProduct,
} from "@/contentPacks/purchase"

const TERMS_URL = "https://encorpora.io/terms"
const PRIVACY_URL = "https://encorpora.io/privacy"

/**
 * Subscription offer card — strict three-state component.
 *
 *   checking          → render skeleton (pre-allocated full height)
 *   subscribed        → "You're subscribed" + Manage + Restore link
 *   ready             → real Subscribe buttons + Restore link
 *   store_unreachable → "We couldn't reach the App Store" + Retry + Restore
 *   pending           → "Waiting for approval"
 *
 * The skeleton mirrors the ready-state vertical rhythm so transitions don't
 * shift the page. Card is capped at `max-w-md` and centered so the Subscribe
 * button doesn't stretch across an iPad-wide settings sheet.
 */

type PaywallState =
  | { kind: "checking" }
  | { kind: "subscribed"; plan: "monthly" | "annual" }
  | { kind: "ready"; products: StoreProduct[] }
  | { kind: "store_unreachable"; error: string }
  | { kind: "offline" }
  | { kind: "pending" }

// Cap the card so it doesn't stretch into a one-line-wide button on
// big iPads, but use a more generous max on tablet+ so it feels like a
// proper hero call-to-action instead of a phone-sized card floating in
// the middle of empty space.
const CARD_WRAPPER = "w-full max-w-md md:max-w-xl mx-auto"

export function SubscriptionOffer({ wrapperClassName }: { wrapperClassName?: string } = {}) {
  // Width override for contexts (e.g. the Home hub) where the card should span
  // the surrounding grid instead of the default centered cap.
  const wrapper = wrapperClassName ?? CARD_WRAPPER
  const { t } = useTranslation()
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const platform = useEntitlementStore((s) => s.platform)
  const isOnline = useOnlineStatus()

  const [state, setState] = useState<PaywallState>({ kind: "checking" })
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual")
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)
  // Affiliate / offer code entry — ENABLED on the 0.17.4 codes branch
  // (server-side resolve + in-app StoreKit/Billing redemption). Stays HIDDEN on
  // f17 / 0.17.3 where the field would only record an unverified string. See
  // corpan/infra/AFFILIATE_CODES_PLAN.md.
  const SHOW_AFFILIATE_CODE_FIELD = true
  const [affiliateCode, setAffiliateCode] = useState("")
  // The full server resolution is kept so handleSubscribe can branch on
  // `purchaseAction.type`. NO fail-open: an unreachable check is `error`, never
  // `resolved` — we never claim a code is applied unless the server said so.
  const [affiliateStatus, setAffiliateStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking"; code: string }
    | { kind: "resolved"; code: string; resolution: Extract<CodeResolveResponse, { status: "ok" }> }
    | { kind: "invalid"; code: string; error: string }
    | { kind: "error"; code: string; error: string }
  >({ kind: "idle" })

  const storeLabel =
    platform === "android"
      ? t("subscription.storeGoogle", "Google Play")
      : t("subscription.storeApple", "Apple ID")

  const refresh = useCallback(async () => {
    if (!iapAvailable) return
    setState({ kind: "checking" })

    // `getProductStatus` reads the platform's cached entitlement and works
    // offline — surface "subscribed" calmly even in airplane mode so the
    // user isn't pushed to a confusing "store unreachable" state.
    const [m, a] = await Promise.all([
      getProductStatus(SUBSCRIPTION_MONTHLY, "subs"),
      getProductStatus(SUBSCRIPTION_ANNUAL, "subs"),
    ])
    if (m.state === "owned") {
      setState({ kind: "subscribed", plan: "monthly" })
      return
    }
    if (a.state === "owned") {
      setState({ kind: "subscribed", plan: "annual" })
      return
    }

    // Not subscribed — fetching prices needs internet. Short-circuit to a
    // calm offline state instead of hitting the store and rendering the
    // generic amber "We couldn't reach the App Store" card.
    if (!isOnline) {
      setState({ kind: "offline" })
      return
    }

    const fetched = await fetchProducts(
      [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL],
      "subs"
    )
    if (fetched.ok) {
      setState({ kind: "ready", products: fetched.products })
    } else {
      setState({ kind: "store_unreachable", error: fetched.error })
    }
  }, [iapAvailable, isOnline])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Anonymous analytics: paywall surface viewed. Skipped when IAP isn't
  // available (component returns null), so this only fires when the user
  // could actually see the paywall.
  useEffect(() => {
    if (!iapAvailable) return
    trackPaidUnlockViewed("subscription_offer")
  }, [iapAvailable])

  useEffect(() => {
    const code = normalizeAffiliateCode(affiliateCode)
    if (!code) {
      setAffiliateStatus({ kind: "idle" })
      return
    }
    if (!isAffiliateCodeFormatValid(code)) {
      setAffiliateStatus({
        kind: "invalid",
        code,
        error: t("subscription.affiliateInvalidFormat", "Use letters, numbers, dashes, or underscores."),
      })
      return
    }
    setAffiliateStatus({ kind: "checking", code })
    const timer = window.setTimeout(() => {
      void resolveCode(code).then((result: CodeResolveResponse) => {
        if (normalizeAffiliateCode(affiliateCode) !== code) return
        if (result.status === "ok") {
          setAffiliateStatus({ kind: "resolved", code: result.code, resolution: result })
        } else if (result.status === "invalid") {
          setAffiliateStatus({ kind: "invalid", code, error: result.error })
        } else {
          // NO fail-open: a lookup/network error does NOT become "applied".
          setAffiliateStatus({ kind: "error", code, error: result.error })
        }
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [affiliateCode, t])

  /**
   * Map the result of `purchaseAndVerify` onto the paywall state. Shared by the
   * normal and offer-token (Android paid-discount) branches.
   */
  const applyPurchaseResult = async (
    result: Awaited<ReturnType<typeof purchaseAndVerify>>
  ): Promise<boolean> => {
    if (result.cancelled) return false
    if (result.alreadyOwned) {
      await refresh()
      return true
    }
    if (result.pending) {
      setState({ kind: "pending" })
      return true
    }
    if (result.timeout) {
      setState({ kind: "store_unreachable", error: "TIMEOUT: Purchase timed out. Please try again." })
      return true
    }
    if (result.error) {
      setState({ kind: "store_unreachable", error: `${result.error.code}: ${result.error.message}` })
      return true
    }
    await refresh()
    return true
  }

  /**
   * Subscribe. The branch is driven SERVER-SIDE by `purchaseAction.type` from
   * `/code/resolve` — the client only routes. (Plan §2.2 / §5.)
   *
   *   no code / format-invalid    → normal purchase, no token.
   *   normal                      → normal purchase + affiliateCode + resolutionToken.
   *   apple_offer_code (iOS)      → present Apple sheet, then restore-on-return + verify.
   *   google_promo_code (Android) → open Play redeem URL, then restore-on-return + verify.
   *   android_subscription_offer  → purchase with the resolved offer's offerToken.
   *
   * In every store-offer branch that is ALSO an affiliate kind, the
   * affiliateCode + resolutionToken still ride along so attribution is recorded
   * alongside the discount.
   */
  const handleSubscribe = async () => {
    if (state.kind !== "ready") return
    const productId =
      selectedPlan === "annual" ? SUBSCRIPTION_ANNUAL : SUBSCRIPTION_MONTHLY
    setIsPurchasing(true)
    try {
      const resolved =
        affiliateStatus.kind === "resolved" ? affiliateStatus.resolution : null
      const code = resolved?.code
      const resolutionToken = resolved?.resolutionToken
      const action = resolved?.purchaseAction.type ?? "normal"

      // --- Apple offer-code redemption sheet (iOS/macOS) ---
      if (action === "apple_offer_code") {
        const res = await redeemOfferCode(code)
        if (res.outcome === "useUrl" && res.url) {
          await openUrl(res.url)
        } else if (res.outcome === "unsupported") {
          // No in-app sheet path — fall through to a normal full-price purchase
          // so the user can still subscribe (attribution still attaches).
          console.warn("[subscribe] offer-code redemption unsupported:", res.message)
          const result = await purchaseAndVerify(productId, undefined, "subs", {
            affiliateCode: code,
            resolutionToken,
          })
          await applyPurchaseResult(result)
          return
        }
        // "presented" or "useUrl": the sheet/URL is now in front of the user. On
        // return, observe the discounted entitlement + record attribution.
        await syncAfterRedemption({ affiliateCode: code, resolutionToken })
        await refresh()
        return
      }

      // --- Google Play promo code (Android) — typically a redeem URL ---
      if (action === "google_promo_code") {
        const res = await redeemOfferCode(code)
        if (res.outcome === "useUrl" && res.url) {
          await openUrl(res.url)
        } else if (res.outcome === "unsupported") {
          console.warn("[subscribe] promo-code redemption unsupported:", res.message)
        }
        await syncAfterRedemption({ affiliateCode: code, resolutionToken })
        await refresh()
        return
      }

      // --- Android paid subscription offer (offerToken) ---
      if (action === "android_subscription_offer") {
        // Re-read the offerToken from getProducts, matched by the resolved
        // offer's playOfferId / playBasePlanId (the server returns ids, not the
        // token — the token is device/session-specific).
        const offerToken = await findAndroidOfferToken(productId, resolved?.offer)
        if (!offerToken) {
          console.warn(
            "[subscribe] resolved android offer not found on product; subscribing at full price",
            resolved?.offer
          )
        }
        const result = await purchaseAndVerify(productId, undefined, "subs", {
          offerToken,
          affiliateCode: code,
          resolutionToken,
        })
        await applyPurchaseResult(result)
        return
      }

      // --- Normal purchase (no code, affiliate, or unknown free-text) ---
      const result = await purchaseAndVerify(productId, undefined, "subs", {
        affiliateCode: code,
        resolutionToken,
      })
      await applyPurchaseResult(result)
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRestore = async () => {
    setIsRestoring(true)
    setRestoreMessage(null)
    try {
      const { restoredCount, error } = await restoreAndSync()
      if (error) {
        setRestoreMessage(error)
      } else if (restoredCount === 0) {
        setRestoreMessage(t("restore.noPurchases", "No previous purchases found."))
      } else {
        setRestoreMessage(
          t("restore.success", "Restored {{count}} purchase(s).", { count: restoredCount })
        )
        await refresh()
      }
    } catch {
      setRestoreMessage(t("restore.error", "Failed to restore purchases."))
    } finally {
      setIsRestoring(false)
    }
  }

  const legalLinks = (
    <div className="flex items-center justify-center gap-3 pt-1 text-[11px]">
      <button
        type="button"
        onClick={() => void openUrl(TERMS_URL)}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {t("subscription.termsOfUse", "Terms of Use")}
      </button>
      <span className="text-muted-foreground">·</span>
      <button
        type="button"
        onClick={() => void openUrl(PRIVACY_URL)}
        className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {t("subscription.privacyPolicy", "Privacy Policy")}
      </button>
    </div>
  )

  const restoreInline = (
    <div className="space-y-1 text-center">
      <button
        type="button"
        onClick={() => void handleRestore()}
        disabled={isRestoring}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
      >
        {isRestoring
          ? t("restore.restoring", "Restoring...")
          : t("restore.button", "Restore Purchases")}
      </button>
      {restoreMessage ? (
        <p className="text-[11px] text-muted-foreground">{restoreMessage}</p>
      ) : null}
    </div>
  )

  if (!iapAvailable) return null

  // ---------------------------------------------------------------------
  // Skeleton — mirrors the ready-state vertical rhythm so the card
  // doesn't change height when the platform query resolves.
  // ---------------------------------------------------------------------
  if (state.kind === "checking") {
    return (
      <div className={wrapper}>
        <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
          {/* Heading + description (~50px) */}
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-full rounded bg-muted/60 animate-pulse" />
          </div>
          {/* Plan selector (two side-by-side, ~64px tall) */}
          <div className="flex gap-2">
            <div className="flex-1 h-14 rounded-lg bg-muted/60 animate-pulse" />
            <div className="flex-1 h-14 rounded-lg bg-muted/60 animate-pulse" />
          </div>
          {/* Subscribe button (h-8 = 32px from size="sm") */}
          <div className="h-8 w-full rounded-md bg-muted/60 animate-pulse" />
          {/* Restore link */}
          <div className="h-3 w-32 rounded bg-muted/60 animate-pulse mx-auto" />
          {/* Auto-renew notice (~28px, 2 lines) */}
          <div className="space-y-1">
            <div className="h-2.5 w-full rounded bg-muted/60 animate-pulse" />
            <div className="h-2.5 w-3/4 rounded bg-muted/60 animate-pulse mx-auto" />
          </div>
          {/* Legal links */}
          <div className="h-2.5 w-40 rounded bg-muted/60 animate-pulse mx-auto" />
        </div>
      </div>
    )
  }

  if (state.kind === "subscribed") {
    const planLabel =
      state.plan === "annual"
        ? t("subscription.annual", "Annual")
        : t("subscription.monthly", "Monthly")
    return (
      <div className={wrapper}>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">
                {t("subscription.subscribed", "You're subscribed")}
              </h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-1">
                {t("subscription.subscribedDescription", "{{plan}} plan active. Thanks for supporting Corpán.", { plan: planLabel })}
              </p>
            </div>
          </div>
          <Button
            onClick={() => void manageSubscription()}
            variant="outline"
            className="w-full !h-11 md:!h-14"
            size="sm"
          >
            {t("subscription.manage", "Manage subscription")}
          </Button>
          {restoreInline}
          {legalLinks}
        </div>
      </div>
    )
  }

  if (state.kind === "store_unreachable") {
    return (
      <div className={wrapper}>
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
              {t("subscription.storeUnreachable", "We couldn't reach the App Store right now.")}
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1 break-words">
              {state.error}
            </p>
          </div>
          <Button
            onClick={() => void refresh()}
            variant="outline"
            className="w-full !h-11 md:!h-14"
            size="sm"
          >
            {t("subscription.tryAgain", "Try again")}
          </Button>
          {restoreInline}
        </div>
      </div>
    )
  }

  if (state.kind === "offline") {
    return (
      <div className={wrapper}>
        <OfflineNotice
          title={t("offline.subscriptionTitle", {
            defaultValue: "Subscriptions need internet",
          })}
          subtitle={t("offline.subscriptionSubtitle", {
            defaultValue:
              "Reconnect to subscribe. Your installed packs and bundled phrases still work.",
          })}
        />
      </div>
    )
  }

  if (state.kind === "pending") {
    return (
      <div className={wrapper}>
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 space-y-2">
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
            {t("subscription.pendingHeading", "Waiting for approval")}
          </h3>
          <p className="text-xs text-blue-800/80 dark:text-blue-200/80">
            {t(
              "subscription.pendingDetail",
              "Your subscription is awaiting approval (Ask to Buy or bank verification). It will activate automatically once approved."
            )}
          </p>
          {restoreInline}
        </div>
      </div>
    )
  }

  // state.kind === "ready"
  const monthlyProduct = state.products.find((p) => p.productId === SUBSCRIPTION_MONTHLY)
  const annualProduct = state.products.find((p) => p.productId === SUBSCRIPTION_ANNUAL)

  // Annual savings vs paying monthly × 12 — computed from raw micros so it's
  // accurate and currency-agnostic (it's a ratio). Shown as a quiet, language-
  // neutral "−N%" badge to nudge the higher-LTV annual plan. Only when the
  // store gives both numeric prices and annual is meaningfully cheaper.
  const annualSavingsPct =
    annualProduct?.priceMicros && monthlyProduct?.priceMicros && monthlyProduct.priceMicros > 0
      ? Math.round((1 - annualProduct.priceMicros / (monthlyProduct.priceMicros * 12)) * 100)
      : 0

  // ---------------------------------------------------------------------
  // Honest code states (NO fail-open). The resolved purchaseAction decides
  // both the helper copy and the CTA verb (Subscribe vs Redeem).
  // ---------------------------------------------------------------------
  const resolvedAction =
    affiliateStatus.kind === "resolved"
      ? affiliateStatus.resolution.purchaseAction.type
      : null
  const isRedeemAction =
    resolvedAction === "apple_offer_code" || resolvedAction === "google_promo_code"

  const subscribeCtaLabel = isRedeemAction
    ? platform === "android"
      ? t("subscription.redeemGoogle", "Redeem with Google Play")
      : t("subscription.redeemApple", "Redeem with Apple")
    : t("subscription.subscribe", "Subscribe")
  const subscribeBusyLabel = isRedeemAction
    ? t("subscription.redeeming", "Redeeming...")
    : t("subscription.subscribing", "Subscribing...")

  let codeStatusMessage: string
  if (affiliateStatus.kind === "checking") {
    codeStatusMessage = t("subscription.codeChecking", "Checking code...")
  } else if (affiliateStatus.kind === "invalid") {
    codeStatusMessage = affiliateStatus.error
  } else if (affiliateStatus.kind === "error") {
    codeStatusMessage = t(
      "subscription.codeUnverified",
      "Couldn't verify this code. Try again, or continue without it."
    )
  } else if (affiliateStatus.kind === "resolved") {
    const r = affiliateStatus.resolution
    if (r.discountLabel) {
      // Confirmed platform discount.
      codeStatusMessage = r.partnerName
        ? t("subscription.codeDiscountPartner", "{{discount}} · from {{partner}}", {
            discount: r.discountLabel,
            partner: r.partnerName,
          })
        : t("subscription.codeDiscount", "{{discount}} applied at checkout.", {
            discount: r.discountLabel,
          })
    } else if (r.verified && r.partnerName) {
      // Verified affiliate, no discount.
      codeStatusMessage = t("subscription.codeAffiliatePartner", "Code recorded · {{partner}}", {
        partner: r.partnerName,
      })
    } else {
      // Unknown free-text — recorded, unverified. Honest copy.
      codeStatusMessage = t(
        "subscription.codeRecorded",
        "We'll record this code with your purchase."
      )
    }
  } else {
    codeStatusMessage = t(
      "subscription.affiliateCodeHelp",
      "If someone sent you here, enter their code before subscribing."
    )
  }

  return (
    <div className={wrapper}>
      <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">
            {t("subscription.title", "Unlock everything")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "subscription.description",
              "Unlimited access to every narrated book and premium pack with a subscription."
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {annualProduct ? (
            <button
              type="button"
              onClick={() => setSelectedPlan("annual")}
              className={`relative flex-1 rounded-lg border p-2 text-center text-xs transition-colors ${
                selectedPlan === "annual"
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border"
              }`}
            >
              {annualSavingsPct >= 5 ? (
                <span className="absolute -top-2 right-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">
                  −{annualSavingsPct}%
                </span>
              ) : null}
              <div className="font-medium">{annualProduct.price}</div>
              <div className="text-muted-foreground mt-0.5">
                {t("subscription.annual", "Annual")}
              </div>
            </button>
          ) : null}
          {monthlyProduct ? (
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`flex-1 rounded-lg border p-2 text-center text-xs transition-colors ${
                selectedPlan === "monthly"
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border"
              }`}
            >
              <div className="font-medium">{monthlyProduct.price}</div>
              <div className="text-muted-foreground mt-0.5">
                {t("subscription.monthly", "Monthly")}
              </div>
            </button>
          ) : null}
        </div>

        {SHOW_AFFILIATE_CODE_FIELD ? (
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">
            {t("subscription.codeLabel", "Affiliate or offer code")}
          </span>
          <input
            value={affiliateCode}
            onChange={(event) => setAffiliateCode(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            placeholder={t("subscription.affiliateCodePlaceholder", "Optional")}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm uppercase placeholder:normal-case placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary"
          />
          <span
            className={`block min-h-4 text-[11px] ${
              affiliateStatus.kind === "invalid" || affiliateStatus.kind === "error"
                ? "text-destructive"
                : affiliateStatus.kind === "resolved"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
            }`}
          >
            {codeStatusMessage}
          </span>
        </label>
        ) : null}

        <Button
          onClick={() => void handleSubscribe()}
          disabled={isPurchasing || affiliateStatus.kind === "checking"}
          className="w-full !h-11 md:!h-14"
          size="sm"
        >
          {isPurchasing
            ? subscribeBusyLabel
            : subscribeCtaLabel}
        </Button>

        {restoreInline}

        <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
          {t(
            "subscription.autoRenewNotice",
            "Subscriptions renew automatically. Cancel anytime in your {{store}} account.",
            { store: storeLabel }
          )}
        </p>

        {legalLinks}
      </div>
    </div>
  )
}
