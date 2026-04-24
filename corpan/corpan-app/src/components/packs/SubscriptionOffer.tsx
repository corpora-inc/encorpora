import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Button } from "@/components/ui/button"
import {
  useEntitlementStore,
  isSubscriptionCurrentlyActive,
} from "@/store/entitlements"
import {
  fetchProducts,
  purchaseAndVerify,
  manageSubscription,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_ANNUAL,
  type StoreProduct,
} from "@/contentPacks/purchase"
import { DiagnosticsStrip } from "@/components/packs/DiagnosticsStrip"

const TERMS_URL = "https://encorpora.io/terms"
const PRIVACY_URL = "https://encorpora.io/privacy"

/**
 * Subscription offer banner in the packs browser.
 * - Non-subscriber with IAP: shows monthly/annual selector + Subscribe button.
 * - Active subscriber: shows subscribed status + Manage Subscription button.
 * - Non-IAP platforms: hidden entirely.
 */
export function SubscriptionOffer() {
  const { t } = useTranslation()
  const subscription = useEntitlementStore((s) => s.subscription)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual")
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Expiry-aware — `active: true` alone is not enough; if `expiresAt` is past
  // we must fall through to the Subscribe CTA until refreshEntitlements clears
  // the stale flag. Belt-and-suspenders against any refresh-timing gap.
  const subscriptionActive = isSubscriptionCurrentlyActive(subscription)
  const platform = useEntitlementStore((s) => s.platform)
  const storeLabel =
    platform === "android"
      ? t("subscription.storeGoogle", "Google Play")
      : t("subscription.storeApple", "Apple ID")

  const legalLinks = (
    <div className="flex items-center justify-center gap-4 pt-1 text-[11px]">
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

  useEffect(() => {
    if (!iapAvailable || subscriptionActive) return
    fetchProducts(
      [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL],
      "subs"
    ).then(setProducts)
  }, [iapAvailable, subscriptionActive])

  if (!iapAvailable) return null

  // Active subscriber — confirmation + manage button.
  if (subscriptionActive) {
    const planLabel =
      subscription.plan === "annual"
        ? t("subscription.annual", "Annual")
        : t("subscription.monthly", "Monthly")

    return (
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
          className="w-full"
          size="sm"
        >
          {t("subscription.manage", "Manage subscription")}
        </Button>

        <DiagnosticsStrip onRetry={() => void refetchProducts()} />

        {legalLinks}
      </div>
    )
  }

  const monthlyProduct = products.find((p) => p.productId === SUBSCRIPTION_MONTHLY)
  const annualProduct = products.find((p) => p.productId === SUBSCRIPTION_ANNUAL)

  // Leave blank during the initial fetch — store (Apple/Google) returns the
  // localized price within a few hundred ms. Hardcoded fallbacks would show
  // iOS-style prices briefly on Android (wrong).
  const monthlyPrice = monthlyProduct?.price ?? ""
  const annualPrice = annualProduct?.price ?? ""

  const refetchProducts = async () => {
    const fresh = await fetchProducts(
      [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL],
      "subs"
    )
    if (fresh.length > 0) setProducts(fresh)
    return fresh
  }

  const handleSubscribe = async () => {
    const productId =
      selectedPlan === "annual" ? SUBSCRIPTION_ANNUAL : SUBSCRIPTION_MONTHLY
    setIsPurchasing(true)
    setError(null)

    try {
      // If products weren't loaded on mount (transient StoreKit empty,
      // reviewer's device in a funny state, etc.), try once more on tap
      // before going to the native purchase. The native purchase call
      // does its own Product.products(for:) internally, so we can proceed
      // regardless of the preflight's outcome — but the fresh fetch
      // often succeeds where the initial one failed, and either way
      // it's logged in the diagnostics buffer.
      if (products.length === 0) {
        await refetchProducts()
      }

      const result = await purchaseAndVerify(productId, undefined, "subs")
      if (result.error) {
        setError(result.error)
      }
      // cancelled / alreadyOwned / verifyFailed all result in the subscribed
      // card re-rendering via the entitlement store (no error shown).
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
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
        <button
          type="button"
          onClick={() => setSelectedPlan("annual")}
          className={`flex-1 rounded-lg border p-2 text-center text-xs transition-colors ${
            selectedPlan === "annual"
              ? "border-primary bg-primary/10 font-medium"
              : "border-border"
          }`}
        >
          <div className="font-medium">{annualPrice}</div>
          <div className="text-muted-foreground mt-0.5">
            {t("subscription.annual", "Annual")}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPlan("monthly")}
          className={`flex-1 rounded-lg border p-2 text-center text-xs transition-colors ${
            selectedPlan === "monthly"
              ? "border-primary bg-primary/10 font-medium"
              : "border-border"
          }`}
        >
          <div className="font-medium">{monthlyPrice}</div>
          <div className="text-muted-foreground mt-0.5">
            {t("subscription.monthly", "Monthly")}
          </div>
        </button>
      </div>

      <Button
        onClick={handleSubscribe}
        disabled={isPurchasing}
        className="w-full"
        size="sm"
      >
        {isPurchasing
          ? t("subscription.subscribing", "Subscribing...")
          : t("subscription.subscribe", "Subscribe")}
      </Button>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}

      <DiagnosticsStrip onRetry={() => void refetchProducts()} />

      <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
        {t(
          "subscription.autoRenewNotice",
          "Subscriptions renew automatically. Cancel anytime in your {{store}} account.",
          { store: storeLabel }
        )}
      </p>

      {legalLinks}
    </div>
  )
}
