import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useEntitlementStore } from "@/store/entitlements"
import type { CatalogGame } from "@/contentPacks/catalog"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { getProductStatus } from "@/contentPacks/purchase"
import { usePaywallStore } from "@/store/paywall"

export type PackActionState = "available" | "installed" | "update" | "offline"

export function PackActions({
  pack,
  state,
  installedGame,
  isOffline,
  onLaunch,
  updateVersion,
  removable = true,
}: {
  pack: CatalogGame
  state: PackActionState
  installedGame?: InstalledGame
  isOffline: boolean
  onLaunch?: (game: InstalledGame) => void
  updateVersion?: string
  /** Built-in/pre-installed experiences (e.g. Phrase Flip) can't be removed. */
  removable?: boolean
}) {
  const { t } = useTranslation()
  const removeGame = useGamesStore((s) => s.removeGame)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const subscriptionActive = useEntitlementStore((s) => s.subscription.active)
  const openPaywall = usePaywallStore((s) => s.openPaywall)
  const { installCatalogPack, isInstalling } = useInstallContext()

  const isPremium = pack.purchase?.type === "iap"
  const productId = pack.purchase?.productId

  // Live entitlement check. Per-book IAP is retired — new unlocks come via
  // Corpán Plus. A premium pack is entitled if the user is subscribed OR (for
  // legacy buyers) still owns the per-book product. `null` while pending.
  const [entitled, setEntitled] = useState<boolean | null>(
    isPremium ? null : true
  )
  useEffect(() => {
    if (!isPremium) {
      setEntitled(true)
      return
    }
    if (subscriptionActive) {
      setEntitled(true)
      return
    }
    if (!productId) {
      setEntitled(false)
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
  }, [isPremium, productId, subscriptionActive])

  const handleInstall = () => {
    installCatalogPack(pack)
  }

  const handleUnlock = () => {
    openPaywall({ surface: "library_unlock", bookId: pack.id })
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
        <Button disabled className="w-full !h-11 md:!h-14" size="sm">
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
            className="flex-1 !h-11 md:!h-14"
            size="sm"
          >
            {isInstalling
              ? t("packs.updating")
              : t("packs.update")}
          </Button>
          <Button
            variant="outline"
            onClick={handleLaunch}
            className="!h-11 md:!h-14"
            size="sm"
          >
            {t("packs.open")}
          </Button>
          {removable && (
            <Button
              variant="ghost"
              onClick={handleRemove}
              className="!h-11 md:!h-14"
              size="sm"
            >
              {t("packs.remove")}
            </Button>
          )}
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
          className="flex-1 !h-11 md:!h-14"
          size="sm"
        >
          {t("packs.open")}
        </Button>
        {removable && (
          <Button
            variant="ghost"
            onClick={handleRemove}
            className="!h-11 md:!h-14"
            size="sm"
          >
            {t("packs.remove")}
          </Button>
        )}
      </div>
    )
  }

  // While entitlement is being checked for a premium pack, show a
  // placeholder rather than flashing a Buy or Install button based on
  // stale data.
  if (isPremium && entitled === null) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full !h-11 md:!h-14" size="sm">
          {t("packs.checking", "Checking…")}
        </Button>
      </div>
    )
  }

  // Available (not installed)
  // Premium + not entitled + IAP available → Corpán Plus unlock (no per-book buy)
  if (isPremium && !entitled && iapAvailable) {
    return (
      <div className="space-y-2">
        <Button
          onClick={handleUnlock}
          disabled={isOffline}
          className="w-full !h-11 md:!h-14"
          size="sm"
        >
          {t("packs.unlockWithPlus", "Unlock with Corpán Plus")}
        </Button>
        {isOffline ? (
          <p className="text-xs text-muted-foreground">
            {t("offline.purchaseNeedsInternet", {
              defaultValue: "Reconnect to subscribe.",
            })}
          </p>
        ) : null}
      </div>
    )
  }

  // Premium + not entitled + no IAP → Plus unavailable on this platform
  if (isPremium && !entitled && !iapAvailable) {
    return (
      <div className="space-y-2">
        <Button disabled className="w-full !h-11 md:!h-14" size="sm">
          {t("packs.plus", "Corpán Plus")}
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
        className="w-full !h-11 md:!h-14"
        size="sm"
      >
        {isInstalling
          ? t("packs.installing")
          : t("packs.get")}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{isPremium ? t("packs.includedWithPlus", "Included with Plus") : t("packs.free")}</span>
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
