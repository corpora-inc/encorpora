// src/journey/ImagePackOfferBanner.tsx
//
// Understated, consent-first inline offer for the language-neutral
// concept-picture pack (imagepan). imagepan is NEVER auto-downloaded (the
// owner's standing rule + the pack is planned to grow to thousands of images):
// when a compatible pack is available in the index but not installed, we ASK.
// Accept → download with a real progress bar, register in the dataPacks store,
// and picture exercises start appearing mid-session (via `onInstalled`, which
// invalidates the resolver). Decline → remembered persistently in the dataPacks
// store so we don't nag again.
//
// GRACEFUL DEGRADE: unreachable index / no compatible entry / already installed
// ⇒ renders nothing ⇒ exactly today's text-only Journey. Never throws.
//
// Size is shown DYNAMICALLY from the catalog entry (`sizeMb`) — as imagepan
// grows, the offer reflects the real download size with no code change.

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  fetchImagePackCatalog,
  resolveLocalized,
  type ImagePackCatalog,
} from "@/contentPacks/imagePackCatalog"
import { useInstallProgress } from "@/contentPacks/installProgress"
import { getAppVersion } from "@/lib/appVersion"
import { useCatalogStore } from "@/store/catalog"
import { useDataPacksStore } from "@/store/dataPacks"
import {
  IMAGE_PACK_ID,
  installImagePack,
  isImagePackInstalled,
  registerInstalledImagePack,
} from "@/util/imagePack"
import { matchImagePackOffer } from "./imagePackProvision"

/** Data-saver / very-slow connections: don't nudge a download at all. The pack
 *  stays offerable later, so nothing is lost — we just respect the signal. */
function suppressForConnection(): boolean {
  const c = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  if (!c) return false
  if (c.saveData) return true
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g"
}

export function ImagePackOfferBanner({
  onInstalled,
}: {
  /** Called with the installed pack version once the download completes. */
  onInstalled: (version: string) => void
}) {
  const { t, i18n } = useTranslation()
  const devMode = useCatalogStore((s) => s.devMode)
  const declined = useDataPacksStore((s) => s.isDeclined(IMAGE_PACK_ID))
  const installedRegistered = useDataPacksStore((s) => s.has(IMAGE_PACK_ID))
  const { state, startListening, setError, reset } = useInstallProgress()

  const [hidden, setHidden] = useState(false)
  const [catalog, setCatalog] = useState<ImagePackCatalog | null>(null)
  const [appVersion, setAppVersion] = useState<string>("")
  const [installedProbe, setInstalledProbe] = useState<boolean | null>(null)

  // Resolve the (small) image-pack index + app version once. Both fail soft:
  // a null catalog / empty version just means "nothing to offer".
  useEffect(() => {
    let alive = true
    // Never prompt when we can't offer or shouldn't: declined, already
    // installed, or data-saver. Skip the network entirely in those cases.
    if (declined || installedRegistered) return
    void fetchImagePackCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setCatalog(null))
    void getAppVersion()
      .then((v) => alive && setAppVersion(v))
      .catch(() => alive && setAppVersion(""))
    return () => {
      alive = false
    }
  }, [declined, installedRegistered])

  const entry = useMemo(
    () => matchImagePackOffer(catalog, appVersion, devMode),
    [catalog, appVersion, devMode],
  )

  // Disk truth: never offer a pack already installed (survived a restart).
  useEffect(() => {
    let alive = true
    if (!entry) {
      setInstalledProbe(null)
      return
    }
    void isImagePackInstalled()
      .then((yes) => alive && setInstalledProbe(yes))
      .catch(() => alive && setInstalledProbe(false))
    return () => {
      alive = false
    }
  }, [entry])

  // On a clean completion: register + tell the runtime + retire the banner.
  useEffect(() => {
    if (entry && state.stage === "complete") {
      registerInstalledImagePack(entry.version)
      onInstalled(entry.version)
      setHidden(true)
    }
  }, [state.stage, entry, onInstalled])

  if (!entry || hidden) return null
  if (declined || installedRegistered) return null
  if (installedProbe !== false) return null // installed, or still probing
  // Data-saver / very slow link: stay quiet (only when not mid-install).
  if (!state.active && suppressForConnection()) return null

  const name = resolveLocalized(entry.nameLocalized, entry.name, i18n.language)
  const sizeLabel = entry.sizeMb > 0 ? `≈${entry.sizeMb.toFixed(1)} MB` : ""

  const installing = state.active && state.stage !== "error"
  const failed = state.stage === "error"
  const pct =
    state.total > 0
      ? Math.min(100, Math.round((state.progress / state.total) * 100))
      : null

  const doInstall = () => {
    reset()
    startListening(IMAGE_PACK_ID, name)
    // The Rust installer emits `pack-install-progress` (+ a final `complete`)
    // keyed by IMAGE_PACK_ID — `useInstallProgress` is already listening.
    void installImagePack(entry.zipUrl, entry.sha256 ?? null).catch(
      (err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      },
    )
  }

  const doDismiss = () => {
    useDataPacksStore.getState().decline(IMAGE_PACK_ID)
    setHidden(true)
  }

  return (
    <div
      className="pointer-events-auto mx-auto mb-3 w-full max-w-md rounded-lg border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur"
      data-testid="journey-imagepack-offer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t("journey.imagePack.title", { defaultValue: "Add pictures" })}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("journey.imagePack.body", {
              defaultValue: "Learn some words with pictures instead of text.",
            })}
          </div>
        </div>
        {!installing && !failed ? (
          <button
            type="button"
            onClick={doDismiss}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("journey.imagePack.dismiss", { defaultValue: "Not now" })}
          </button>
        ) : null}
      </div>

      {installing ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary transition-[width] duration-300"
              style={{ width: pct != null ? `${pct}%` : "40%" }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("journey.imagePack.downloading", {
              defaultValue: "Adding… {{percent}}%",
              percent: pct != null ? String(pct) : "",
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant={failed ? "destructive" : "default"} onClick={doInstall}>
            {failed
              ? t("journey.imagePack.retry", { defaultValue: "Try again" })
              : t("journey.imagePack.add", {
                  defaultValue: "Add ({{size}})",
                  size: sizeLabel,
                })}
          </Button>
          {failed ? (
            <span className="text-xs text-muted-foreground">
              {t("journey.imagePack.failed", { defaultValue: "Couldn’t add" })}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
