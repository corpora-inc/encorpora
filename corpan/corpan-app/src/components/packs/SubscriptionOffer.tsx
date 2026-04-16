import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useEntitlementStore } from "@/store/entitlements"
import {
  fetchProducts,
  purchaseAndVerify,
  SUBSCRIPTION_MONTHLY,
  SUBSCRIPTION_ANNUAL,
  type StoreProduct,
} from "@/contentPacks/purchase"

/**
 * Subscription offer banner shown in the catalog browser.
 * Only visible to non-subscribers on platforms with IAP support.
 */
export function SubscriptionOffer() {
  const { t } = useTranslation()
  const subscriptionActive = useEntitlementStore((s) => s.subscription.active)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual")
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch subscription product prices from the store
  useEffect(() => {
    if (!iapAvailable || subscriptionActive) return
    fetchProducts(
      [SUBSCRIPTION_MONTHLY, SUBSCRIPTION_ANNUAL],
      "subs"
    ).then(setProducts)
  }, [iapAvailable, subscriptionActive])

  // Don't render if already subscribed or IAP not available
  if (subscriptionActive || !iapAvailable) return null

  const monthlyProduct = products.find((p) => p.productId === SUBSCRIPTION_MONTHLY)
  const annualProduct = products.find((p) => p.productId === SUBSCRIPTION_ANNUAL)

  const monthlyPrice = monthlyProduct?.price ?? "$15.99/mo"
  const annualPrice = annualProduct?.price ?? "$100/yr"

  const handleSubscribe = async () => {
    const productId =
      selectedPlan === "annual" ? SUBSCRIPTION_ANNUAL : SUBSCRIPTION_MONTHLY
    setIsPurchasing(true)
    setError(null)

    try {
      const result = await purchaseAndVerify(productId, undefined, "subs")
      if (result.error) {
        setError(result.error)
      }
    } finally {
      setIsPurchasing(false)
    }
  }

  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">
          {t("subscription.title", "Unlock all books")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "subscription.description",
            "Get unlimited access to every narrated book with a subscription."
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
    </div>
  )
}
