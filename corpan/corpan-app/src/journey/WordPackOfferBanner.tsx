// src/journey/WordPackOfferBanner.tsx
//
// Understated, consent-first inline offer for the (native→target) wordpan
// word-explanation pack. When a Journey learner's pair has a published pack
// that isn't installed, we ASK before downloading (~3–4 MB) — low-bandwidth
// users are never surprised. Accept → download with a real progress bar,
// then the resolver's word-enrichment lights up mid-session (via
// `onInstalled`). Decline → dismissed for this pair (no nagging); still
// re-offerable from Settings › Word explanations. Fully generic over the pair:
// availability is a pure index lookup (`matchWordPackOffer`).

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { useInstallProgress } from "@/contentPacks/installProgress"
import { resolveLocalized } from "@/contentPacks/wordPackCatalog"
import { useCatalogStore } from "@/store/catalog"
import { useWordPackCatalogStore } from "@/store/wordPackCatalog"
import { installWordPack, isWordPackInstalled } from "@/util/wordPack"
import { matchWordPackOffer } from "./wordPackProvision"

/** Data-saver / very-slow connections: don't nudge a download at all. The pack
 *  stays available from Settings › Word explanations, so nothing is lost — we
 *  just respect the signal and never prefetch or prompt. */
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

const DISMISS_KEY = "corpan-journey-wordpack-dismissed"

function isDismissed(pairId: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list) && list.includes(pairId)
  } catch {
    return false
  }
}

function dismiss(pairId: string): void {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    const next = Array.isArray(list) ? list.filter((x) => x !== pairId) : []
    next.push(pairId)
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next))
  } catch {
    // A full/blocked localStorage just means the offer may reappear later —
    // harmless.
  }
}

export function WordPackOfferBanner({
  nativeLang,
  targetLang,
  onInstalled,
}: {
  nativeLang?: string
  targetLang: string
  /** Called with the installed pack id once the download completes cleanly. */
  onInstalled: (packId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const catalog = useWordPackCatalogStore((s) => s.catalog)
  const fetchCatalog = useWordPackCatalogStore((s) => s.fetchCatalog)
  const appVersion = useCatalogStore((s) => s.appVersion)
  const { state, startListening, setError, reset } = useInstallProgress()

  const [hidden, setHidden] = useState(false)
  const [installedProbe, setInstalledProbe] = useState<boolean | null>(null)

  // The index is small; make sure we have it (App also fetches it at start).
  useEffect(() => {
    if (!catalog) void fetchCatalog()
  }, [catalog, fetchCatalog])

  const entry = useMemo(
    () =>
      nativeLang
        ? matchWordPackOffer(catalog, appVersion ?? "", nativeLang, targetLang)
        : null,
    [catalog, appVersion, nativeLang, targetLang],
  )

  // Disk truth: never offer a pack that is already installed.
  useEffect(() => {
    let alive = true
    if (!entry) {
      setInstalledProbe(null)
      return
    }
    void isWordPackInstalled(entry.id)
      .then((yes) => alive && setInstalledProbe(yes))
      .catch(() => alive && setInstalledProbe(false))
    return () => {
      alive = false
    }
  }, [entry])

  // On a clean completion, tell the runtime + retire the banner.
  useEffect(() => {
    if (entry && state.stage === "complete") {
      onInstalled(entry.id)
      setHidden(true)
    }
  }, [state.stage, entry, onInstalled])

  if (!entry || hidden) return null
  if (installedProbe !== false) return null // installed, or still probing
  if (isDismissed(entry.id)) return null
  // Data-saver / very slow link: stay quiet (only when not mid-install).
  if (!state.active && suppressForConnection()) return null

  const name = resolveLocalized(entry.nameLocalized, entry.name, i18n.language)
  const langName = t(`languages.${nativeLang}`, {
    defaultValue: t(`languages.${(nativeLang ?? "").split("-")[0]}`, {
      defaultValue: name,
    }),
  })
  const sizeLabel = entry.sizeMb > 0 ? `≈${entry.sizeMb.toFixed(1)} MB` : ""

  const installing = state.active && state.stage !== "error"
  const failed = state.stage === "error"
  const pct =
    state.total > 0
      ? Math.min(100, Math.round((state.progress / state.total) * 100))
      : null

  const doInstall = () => {
    reset()
    startListening(entry.id, name)
    // The Rust installer emits `pack-install-progress` (+ a final `complete`)
    // keyed by this packId — `useInstallProgress` is already listening.
    void installWordPack(entry.id, entry.zipUrl, entry.sha256 ?? undefined).catch(
      (err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      },
    )
  }

  const doDismiss = () => {
    dismiss(entry.id)
    setHidden(true)
  }

  return (
    <div
      className="pointer-events-auto mx-auto mb-3 w-full max-w-md rounded-lg border border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur"
      data-testid="journey-wordpack-offer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {t("journey.wordPack.title", { defaultValue: "Word meanings" })}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("journey.wordPack.body", {
              defaultValue: "Read what words mean in {{language}} as you go.",
              language: langName,
            })}
          </div>
        </div>
        {!installing && !failed ? (
          <button
            type="button"
            onClick={doDismiss}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("journey.wordPack.dismiss", { defaultValue: "Not now" })}
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
            {t("journey.wordPack.downloading", {
              defaultValue: "Adding… {{percent}}%",
              percent: pct != null ? String(pct) : "",
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" variant={failed ? "destructive" : "default"} onClick={doInstall}>
            {failed
              ? t("journey.wordPack.retry", { defaultValue: "Try again" })
              : t("journey.wordPack.add", {
                  defaultValue: "Add ({{size}})",
                  size: sizeLabel,
                })}
          </Button>
          {failed ? (
            <span className="text-xs text-muted-foreground">
              {t("journey.wordPack.failed", { defaultValue: "Couldn’t add" })}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
