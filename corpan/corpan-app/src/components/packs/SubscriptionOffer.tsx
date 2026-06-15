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
  getProductStatus,
  isAffiliateCodeFormatValid,
  normalizeAffiliateCode,
  resolveCode,
  resolveOfferToken,
  presentAppleOfferRedeemSheet,
  restoreAndSync,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_ANNUAL,
  type CodeResolveResponse,
  type CodePurchaseAction,
  type StoreProduct,
  type IntroOffer,
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
  // Offer / affiliate code entry. The server is the only authority (Phase 3
  // codes backend) — the field resolves against /code/resolve and branches the
  // CTA by the returned purchaseAction. It sits AFTER the plan + primary CTA as
  // a secondary affordance, so we don't train discount expectation.
  const SHOW_AFFILIATE_CODE_FIELD = true
  const [affiliateCode, setAffiliateCode] = useState("")
  const [codeStatus, setCodeStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking"; code: string }
    | { kind: "resolved"; code: string; response: Extract<CodeResolveResponse, { status: "ok" }> }
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

  const selectedProductId =
    selectedPlan === "annual" ? SUBSCRIPTION_ANNUAL : SUBSCRIPTION_MONTHLY

  useEffect(() => {
    const code = normalizeAffiliateCode(affiliateCode)
    if (!code) {
      setCodeStatus({ kind: "idle" })
      return
    }
    if (!isAffiliateCodeFormatValid(code)) {
      setCodeStatus({
        kind: "error",
        code,
        error: t("subscription.affiliateInvalidFormat", "Use letters, numbers, dashes, or underscores."),
      })
      return
    }
    setCodeStatus({ kind: "checking", code })
    const timer = window.setTimeout(() => {
      void resolveCode(code, selectedProductId).then((result) => {
        if (normalizeAffiliateCode(affiliateCode) !== code) return
        if (result.status === "ok") {
          setCodeStatus({ kind: "resolved", code: result.code, response: result })
        } else {
          // NEVER surface an error as "valid" (contract §0.2).
          setCodeStatus({
            kind: "error",
            code,
            error: result.error,
          })
        }
      })
    }, 450)
    return () => window.clearTimeout(timer)
  }, [affiliateCode, selectedProductId, t])

  const handleSubscribe = async () => {
    if (state.kind !== "ready") return
    const productId = selectedProductId
    setIsPurchasing(true)
    try {
      const code = normalizeAffiliateCode(affiliateCode)
      const validCode = isAffiliateCodeFormatValid(code) ? code : undefined
      const resolved =
        codeStatus.kind === "resolved" && codeStatus.code === code
          ? codeStatus.response
          : null
      const resolutionToken = resolved?.resolutionToken
      const action = resolved?.purchaseAction

      // Apple offer-code redemption: present the StoreKit sheet (or fall back
      // to the redeem URL). The redeemed transaction flows back through the
      // plugin's transaction listener; we then refresh so verification (which
      // carries the resolutionToken on the next verify) and entitlement sync
      // pick it up.
      if (action === "REDEEM_APPLE_SHEET") {
        const presented = await presentAppleOfferRedeemSheet({
          appleOfferId: resolved?.appleOfferId,
          appleRedeemUrl: resolved?.appleRedeemUrl,
        })
        if (!presented) {
          setState({
            kind: "store_unreachable",
            error: t(
              "code.redeemUnavailable",
              "Couldn't open the redeem screen. Please try again."
            ),
          })
          return
        }
        await refresh()
        return
      }

      // Android per-code offer: re-read the live, session-bound offerToken from
      // the store by matching the resolved offerId; never trust a backend token.
      let offerToken: string | undefined
      if (action === "USE_OFFER_TOKEN" && resolved?.offerTokenHint) {
        offerToken = await resolveOfferToken(productId, resolved.offerTokenHint)
      }

      const result = await purchaseAndVerify(productId, undefined, "subs", {
        affiliateCode: validCode,
        offerToken,
        resolutionToken,
      })
      if (result.cancelled) return
      if (result.alreadyOwned) {
        await refresh()
        return
      }
      if (result.pending) {
        setState({ kind: "pending" })
        return
      }
      if (result.timeout) {
        setState({ kind: "store_unreachable", error: "TIMEOUT: Purchase timed out. Please try again." })
        return
      }
      if (result.error) {
        setState({
          kind: "store_unreachable",
          error: `${result.error.code}: ${result.error.message}`,
        })
        return
      }
      await refresh()
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

  // Intro / free-trial framing for the CURRENTLY SELECTED plan. `null` (no
  // offer configured / store gave none) → the card renders exactly as before.
  const selectedProduct = selectedPlan === "annual" ? annualProduct : monthlyProduct
  const selectedRecurringPrice = selectedProduct?.price ?? ""
  const selectedPeriodLabel =
    selectedPlan === "annual"
      ? t("subscription.perYear", "year")
      : t("subscription.perMonth", "month")
  const intro: IntroOffer | null = selectedProduct?.introOffer ?? null
  const hasFreeTrial = intro?.kind === "free_trial"
  const hasIntroPrice = intro?.kind === "intro_price"

  // A resolved code (matching the typed code) drives the discount UI + the CTA.
  const resolvedCode =
    codeStatus.kind === "resolved" &&
    codeStatus.code === normalizeAffiliateCode(affiliateCode)
      ? codeStatus.response
      : null
  const resolvedAction: CodePurchaseAction | null =
    resolvedCode?.purchaseAction ?? null
  const resolvedDiscountLabel = resolvedCode?.discountLabel ?? null

  // CTA label: branch by the resolved code's purchaseAction (contract §9), then
  // fall back to free-trial / plain Subscribe copy. Never "Continue".
  const ctaLabel = isPurchasing
    ? resolvedAction === "REDEEM_APPLE_SHEET"
      ? t("code.redeeming", "Opening redeem…")
      : t("subscription.subscribing", "Subscribing...")
    : resolvedAction === "REDEEM_APPLE_SHEET"
      ? t("code.redeemWithApple", "Redeem with Apple")
      : resolvedAction === "USE_OFFER_TOKEN"
        ? resolvedDiscountLabel
          ? t("code.subscribeWithDiscount", "Subscribe ({{discount}})", {
              discount: resolvedDiscountLabel,
            })
          : t("subscription.subscribe", "Subscribe")
        : hasFreeTrial
          ? t("subscription.startFreeTrial", "Start Free Trial")
          : t("subscription.subscribe", "Subscribe")

  // Annual savings vs paying monthly × 12 — computed from raw micros so it's
  // accurate and currency-agnostic (it's a ratio). Shown as a quiet, language-
  // neutral "−N%" badge to nudge the higher-LTV annual plan. Only when the
  // store gives both numeric prices and annual is meaningfully cheaper.
  const annualSavingsPct =
    annualProduct?.priceMicros && monthlyProduct?.priceMicros && monthlyProduct.priceMicros > 0
      ? Math.round((1 - annualProduct.priceMicros / (monthlyProduct.priceMicros * 12)) * 100)
      : 0

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

        {intro && intro.periodLabel ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
            {hasFreeTrial ? (
              <>
                <p className="text-sm font-semibold leading-snug">
                  {t("subscription.trialHeadline", "{{period}} free", {
                    period: intro.periodLabel,
                  })}
                  {selectedRecurringPrice ? (
                    <span className="font-normal text-muted-foreground">
                      {t("subscription.trialThenPrice", ", then {{price}}/{{period}}", {
                        price: selectedRecurringPrice,
                        period: selectedPeriodLabel,
                      })}
                    </span>
                  ) : null}
                </p>
                {/* Calm reassurance line — no payment now, cancel anytime. */}
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t(
                    "subscription.trialReassurance",
                    "No payment due now · cancel anytime"
                  )}
                </p>
                {/* Tiny visual timeline: start today → first charge → cancel. */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {t("subscription.trialToday", "Today: start")}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    {t("subscription.trialFirstCharge", "{{period}}: first charge", {
                      period: intro.periodLabel,
                    })}
                  </span>
                </div>
              </>
            ) : hasIntroPrice ? (
              <p className="text-sm font-semibold leading-snug">
                {t(
                  "subscription.introPriceHeadline",
                  "{{introPrice}} for {{period}}",
                  {
                    introPrice: intro.priceFormatted ?? "",
                    period: intro.periodLabel,
                  }
                )}
                {selectedRecurringPrice ? (
                  <span className="font-normal text-muted-foreground">
                    {t("subscription.introPriceThen", ", then {{price}}/{{period}}", {
                      price: selectedRecurringPrice,
                      period: selectedPeriodLabel,
                    })}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          onClick={() => void handleSubscribe()}
          disabled={isPurchasing || codeStatus.kind === "checking"}
          className="w-full !h-11 md:!h-14"
          size="sm"
        >
          {ctaLabel}
        </Button>

        {/* Offer / affiliate code — a SECONDARY affordance placed AFTER the
            plan + primary CTA so we don't train discount expectation. The
            server is the only authority (Phase 3 codes backend). */}
        {SHOW_AFFILIATE_CODE_FIELD ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("code.fieldLabel", "Offer or affiliate code")}
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
            {codeStatus.kind === "error" ? (
              // NEVER show "valid" on error — offer a retry instead.
              <span className="flex items-center gap-2 text-[11px] text-destructive">
                {t("code.checkFailed", "Couldn't check")}
                <button
                  type="button"
                  onClick={() => setAffiliateCode((c) => c.trim())}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t("code.retry", "Retry")}
                </button>
              </span>
            ) : codeStatus.kind === "checking" ? (
              <span className="block min-h-4 text-[11px] text-muted-foreground">
                {t("code.checking", "Checking code…")}
              </span>
            ) : resolvedCode ? (
              resolvedCode.classification === "unknown" ? (
                // Attributed but unverified — no discount claim, may proceed.
                <span className="block min-h-4 text-[11px] text-muted-foreground">
                  {t("code.attributedUnverified", "Code will be attached to your subscription.")}
                </span>
              ) : (
                // Verified — show the discount + partner credit, never "valid".
                <span className="block min-h-4 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {[
                    resolvedCode.discountLabel,
                    resolvedCode.partnerName
                      ? t("code.creditedTo", "credited to {{partner}}", {
                          partner: resolvedCode.partnerName,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )
            ) : (
              <span className="block min-h-4 text-[11px] text-muted-foreground">
                {t("code.help", "Have a code? Enter it to apply your offer.")}
              </span>
            )}
          </label>
        ) : null}

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
