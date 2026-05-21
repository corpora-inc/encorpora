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
  restoreAndSync,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_ANNUAL,
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

export function SubscriptionOffer() {
  const { t } = useTranslation()
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const platform = useEntitlementStore((s) => s.platform)
  const isOnline = useOnlineStatus()

  const [state, setState] = useState<PaywallState>({ kind: "checking" })
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual")
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null)

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

  const handleSubscribe = async () => {
    if (state.kind !== "ready") return
    const productId =
      selectedPlan === "annual" ? SUBSCRIPTION_ANNUAL : SUBSCRIPTION_MONTHLY
    setIsPurchasing(true)
    try {
      const result = await purchaseAndVerify(productId, undefined, "subs")
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
      <div className={CARD_WRAPPER}>
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
      <div className={CARD_WRAPPER}>
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
      <div className={CARD_WRAPPER}>
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
      <div className={CARD_WRAPPER}>
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
      <div className={CARD_WRAPPER}>
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

  return (
    <div className={CARD_WRAPPER}>
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
              className={`flex-1 rounded-lg border p-2 text-center text-xs transition-colors ${
                selectedPlan === "annual"
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border"
              }`}
            >
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

        <Button
          onClick={() => void handleSubscribe()}
          disabled={isPurchasing}
          className="w-full !h-11 md:!h-14"
          size="sm"
        >
          {isPurchasing
            ? t("subscription.subscribing", "Subscribing...")
            : t("subscription.subscribe", "Subscribe")}
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
