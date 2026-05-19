import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useEntitlementStore } from "@/store/entitlements"
import type { CatalogGame } from "@/contentPacks/catalog"
import { useInstallContext } from "@/contentPacks/InstallContext"
import {
  getProductStatus,
  purchaseAndVerify,
} from "@/contentPacks/purchase"

export type PackActionState = "available" | "installed" | "update" | "offline"

export function PackActions({
  pack,
  state,
  installedGame,
  isOffline,
  onLaunch,
  updateVersion,
}: {
  pack: CatalogGame
  state: PackActionState
  installedGame?: InstalledGame
  isOffline: boolean
  onLaunch?: (game: InstalledGame) => void
  updateVersion?: string
}) {
  const { t } = useTranslation()
  const removeGame = useGamesStore((s) => s.removeGame)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const { installCatalogPack, isInstalling } = useInstallContext()
  const [isPurchasing, setIsPurchasing] = useState(false)

  const isPremium = pack.purchase?.type === "iap"
  const productId = pack.purchase?.productId

  // Live entitlement check via the platform plugin — no persisted snapshot.
  // `null` while pending; we treat that as "not yet entitled" for rendering
  // purposes so we don't flash an Install button on a premium pack.
  const [entitled, setEntitled] = useState<boolean | null>(
    isPremium ? null : true
  )
  useEffect(() => {
    if (!isPremium || !productId) {
      setEntitled(true)
      return
    }
    let cancelled = false
    void getProductStatus(productId, "inapp").then((status) => {
      if (cancelled) return
      setEntitled(status.state === "owned")
    })
    return () => {
      cancelled = true
    }
  }, [isPremium, productId])

  const handleInstall = () => {
    installCatalogPack(pack)
  }

  const handlePurchase = async () => {
    if (!productId) return
    setIsPurchasing(true)
    try {
      const result = await purchaseAndVerify(productId, pack.id)
      if (result.cancelled) {
        // User dismissed the purchase sheet — no-op, no error UI
        return
      }
      if (result.error) {
        console.error("[PackActions] purchase error:", result.error)
        return
      }
      // Purchase succeeded — trigger install
      installCatalogPack(pack)
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleRemove = () => {
    if (installedGame) {
      removeGame(installedGame.id)
    }
  }

  const handleLaunch = () => {
    if (installedGame) {
      onLaunch?.(installedGame)
    }
  }

  if (state === "offline") {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full" size="sm">
          {t("packs.get")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("offline.installNeedsInternet", {
            defaultValue: "Reconnect to download.",
          })}
        </p>
      </div>
    )
  }

  if (state === "update" && updateVersion) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={handleInstall}
            disabled={isInstalling || isOffline}
            className="flex-1"
            size="sm"
          >
            {isInstalling
              ? t("packs.updating")
              : t("packs.update")}
          </Button>
          <Button
            variant="outline"
            onClick={handleLaunch}
            size="sm"
          >
            {t("packs.open")}
          </Button>
          <Button
            variant="ghost"
            onClick={handleRemove}
            size="sm"
          >
            {t("packs.remove")}
          </Button>
        </div>
        {isOffline ? (
          <p className="text-xs text-muted-foreground">
            {t("offline.installNeedsInternet", {
              defaultValue: "Reconnect to download.",
            })}
          </p>
        ) : null}
      </div>
    )
  }

  if (state === "installed" && installedGame) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={handleLaunch}
          className="flex-1"
          size="sm"
        >
          {t("packs.open")}
        </Button>
        <Button
          variant="ghost"
          onClick={handleRemove}
          size="sm"
        >
          {t("packs.remove")}
        </Button>
      </div>
    )
  }

  // While entitlement is being checked for a premium pack, show a
  // placeholder rather than flashing a Buy or Install button based on
  // stale data.
  if (isPremium && entitled === null) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full" size="sm">
          {t("packs.checking", "Checking…")}
        </Button>
      </div>
    )
  }

  // Available (not installed)
  // Premium + not entitled + IAP available → show buy button
  if (isPremium && !entitled && iapAvailable) {
    return (
      <div className="space-y-2">
        <Button
          onClick={handlePurchase}
          disabled={isPurchasing || isOffline}
          className="w-full"
          size="sm"
        >
          {isPurchasing
            ? t("packs.purchasing", "Purchasing...")
            : t("packs.buy", "Buy {{price}}", {
                price: pack.purchase?.priceLabel ?? "",
              })}
        </Button>
        {isOffline ? (
          <p className="text-xs text-muted-foreground">
            {t("offline.purchaseNeedsInternet", {
              defaultValue: "Reconnect to purchase.",
            })}
          </p>
        ) : null}
      </div>
    )
  }

  // Premium + not entitled + no IAP → show unavailable
  if (isPremium && !entitled && !iapAvailable) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full" size="sm">
          {pack.purchase?.priceLabel ?? t("packs.premium", "Premium")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("packs.availableOnMobile", "Available on iOS & Android")}
        </p>
      </div>
    )
  }

  // Free or entitled — normal install button
  return (
    <div className="space-y-2">
      <Button
        onClick={handleInstall}
        disabled={isInstalling || isOffline}
        className="w-full"
        size="sm"
      >
        {isInstalling
          ? t("packs.installing")
          : t("packs.get")}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{pack.purchase?.priceLabel ?? t("packs.free")}</span>
        {isOffline ? (
          <span>
            {t("offline.installNeedsInternet", {
              defaultValue: "Reconnect to download.",
            })}
          </span>
        ) : null}
      </div>
    </div>
  )
}
