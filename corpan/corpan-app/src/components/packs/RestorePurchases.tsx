import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { restoreAndSync } from "@/contentPacks/purchase"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useEntitlementStore } from "@/store/entitlements"

/**
 * Restore Purchases button for settings.
 * Apple requires this to be accessible for App Store approval.
 */
export function RestorePurchases() {
  const { t } = useTranslation()
  const [isRestoring, setIsRestoring] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const isOnline = useOnlineStatus()

  if (!iapAvailable) return null

  const handleRestore = async () => {
    setIsRestoring(true)
    setResult(null)

    try {
      const { restoredCount, error } = await restoreAndSync()
      if (error) {
        setResult(error)
      } else if (restoredCount === 0) {
        setResult(t("restore.noPurchases", "No previous purchases found."))
      } else {
        setResult(
          t("restore.success", "Restored {{count}} purchase(s).", {
            count: restoredCount,
          })
        )
      }
    } catch {
      setResult(t("restore.error", "Failed to restore purchases."))
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    // Match the SubscriptionOffer card width — on a wide iPad the bare
    // "Restore Purchases" button stretched edge-to-edge and didn't line
    // up with the subscription hero above. `max-w-md md:max-w-xl mx-auto`
    // keeps both surfaces visually aligned at every breakpoint.
    <div className="space-y-2 w-full max-w-md md:max-w-xl mx-auto">
      <Button
        variant="outline"
        onClick={handleRestore}
        disabled={isRestoring || !isOnline}
        className="w-full"
        size="sm"
      >
        {isRestoring
          ? t("restore.restoring", "Restoring...")
          : t("restore.button", "Restore Purchases")}
      </Button>
      {!isOnline ? (
        <p className="text-xs text-muted-foreground text-center">
          {t("offline.restoreSubtitle", {
            defaultValue: "Reconnect to restore purchases.",
          })}
        </p>
      ) : result ? (
        <p className="text-xs text-muted-foreground text-center">{result}</p>
      ) : null}
    </div>
  )
}
