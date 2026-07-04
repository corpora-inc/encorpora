import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { LucideIcon } from "lucide-react"
import {
  Settings as SettingsIcon,
  Brain,
  Mic,
  BookOpen,
  Radio,
  Gamepad2,
  PenTool,
  Sparkles,
  Citrus,
  Package,
  ArrowRight,
  ArrowUpCircle,
  Download,
  RefreshCw,
  Heart,
  Route,
  X,
} from "lucide-react"
import { useSettingsStore } from "@/store/settings"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore, type InstalledGame } from "@/store/games"
import { useRecentNativeStore } from "@/store/recentNative"
import { useInstallContext } from "@/contentPacks/InstallContext"
import { useUpdateAll } from "@/hooks/useUpdateAll"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { usePaywallStore } from "@/store/paywall"
import { useEntitlementStore } from "@/store/entitlements"
import { usePackRatingStore, ratingSignals } from "@/store/packRating"
import { trackCycleAdvanced, trackPackKept, trackPackDiscarded } from "@/util/analytics"
import { StreakChip } from "@/components/StreakChip"
import { RecentsSection } from "@/components/packs/RecentsSection"
import { PhrasePackDrawerTrigger } from "@/components/packs/PhrasePackDrawerTrigger"
import { PacksSection } from "./PacksSection"
import { Button } from "@/components/ui/button"
import { OfflineImage } from "@/components/ui/OfflineImage"
import { getTopBarPaddingTop, glass } from "@/util/browser"
import corpanMark from "@/assets/corpan-mark-trim.png"
import { rankHomeExperiences } from "./recommend"
import { PHRASE_PACK_ID, PHRASE_FLIP_IMAGE } from "@/experiences/phraseFlip"
import { useJourneyPacksStore } from "@/store/journeyPacks"
import { useJourneyStore, courseKeyOf } from "@/store/journey"
import { packIdForTarget } from "@/util/journeyPack"
import {
  fetchJourneyPackCatalog,
  findJourneyPackForTarget,
  visibleJourneyPacks,
} from "@/contentPacks/journeyPackCatalog"
import { getAppVersion } from "@/lib/appVersion"

/** Per-experience icon — fallback when the catalog has no artwork. */
const EXP_ICON: Record<string, LucideIcon> = {
  phrase_main: Brain,
  pronunciation_coach: Mic,
  earthgate_reader: BookOpen,
  stargate_reader: Sparkles,
  world_radio: Radio,
  hover_runner: Gamepad2,
  hanzipan: PenTool,
  juice_squeeze: Citrus,
}

/** Catalog artwork (preferred, offline-cached) or a lucide glyph fallback.
 *  <OfflineImage> renders the cached copy when the remote pixels are
 *  unreachable (D12) — the glyph shows only on a true never-seen miss. */
function Glyph({
  imageUrl,
  Icon,
  glyphClass,
}: {
  imageUrl?: string
  Icon: LucideIcon
  glyphClass: string
}) {
  return (
    <OfflineImage
      src={imageUrl}
      fallback={<Icon className={glyphClass} />}
      aria-hidden="true"
      draggable={false}
      className="h-full w-full rounded-[inherit] object-cover"
    />
  )
}

type ExpCard = {
  id: string
  name: string
  blurb: string
  imageUrl?: string
  Icon: LucideIcon
  installed: boolean
  onClick: () => void
}

/**
 * The Home hub — post-onboarding root. Crowned by the cycling "For you"
 * recommendation (the magic-suggestion star), then quick re-entry (Recent),
 * the ranked Experiences grid, a phrase-pack browser, and the spacious
 * all-packs listing (install / update / get). Monetization is NOT a static
 * card here — just a tiny Plus chip; the rest is well-timed interstitials.
 */
export function HomeHub({
  onSettings,
  onLaunchPhrase,
  onLaunchGame,
  onLaunchJourney,
}: {
  onSettings: () => void
  onLaunchPhrase: () => void
  onLaunchGame?: (game: InstalledGame) => void
  /** Open the Journey feed overlay (App owns the state machine). */
  onLaunchJourney?: () => void
}) {
  const { t, i18n } = useTranslation()
  const dir = useSettingsStore((s) => s.dir)
  const userClass = useSettingsStore((s) => s.userClass)
  const ageBand = useSettingsStore((s) => s.ageBand)
  const interests = useSettingsStore((s) => s.interests)
  const languages = useSettingsStore((s) => s.languages)
  const catalog = useCatalogStore((s) => s.getCatalog())
  const games = useGamesStore((s) => s.games)
  const { installCatalogPack, launchGame } = useInstallContext()
  const isOnline = useOnlineStatus()
  const openPaywall = usePaywallStore((s) => s.openPaywall)
  const iapAvailable = useEntitlementStore((s) => s.iapAvailable)
  const subscribed = useEntitlementStore((s) => s.subscription.active)
  const ratings = usePackRatingStore((s) => s.ratings)
  const rate = usePackRatingStore((s) => s.rate)
  const ratingSig = useMemo(() => ratingSignals(ratings), [ratings])

  const installedIds = useMemo(() => new Set(Object.keys(games)), [games])
  const installedGames = useMemo(() => Object.values(games), [games])
  const catalogById = useMemo(() => new Map(catalog.map((g) => [g.id, g])), [catalog])

  // ── Journey hero (flagship placement, W10 item 10) ──
  // Shown only when a course pack for the user's target language is
  // installed OR published in the journey-pack index — never a dead-end CTA.
  const activeStackId = useSettingsStore((s) => s.activeStackId)
  const journeyTarget = languages[1] ?? languages[0] ?? "en"
  const journeyPackId = packIdForTarget(journeyTarget)
  const journeyInstalled = useJourneyPacksStore((s) =>
    Object.values(s.installed).some(
      (p) => p.targetLang.toLowerCase() === journeyTarget.toLowerCase(),
    ),
  )
  const journeyEnrolled = useJourneyStore(
    (s) => !!s.byCourse[courseKeyOf(activeStackId, journeyPackId)],
  )
  const [journeyInCatalog, setJourneyInCatalog] = useState(false)
  useEffect(() => {
    if (journeyInstalled) return
    let cancelled = false
    void (async () => {
      try {
        const cat = await fetchJourneyPackCatalog()
        if (!cat || cancelled) return
        const appVersion = await getAppVersion()
        const devMode = useCatalogStore.getState().devMode
        const entry = findJourneyPackForTarget(
          visibleJourneyPacks(cat, appVersion, devMode),
          journeyTarget,
        )
        if (!cancelled) setJourneyInCatalog(!!entry)
      } catch {
        /* offline / index unreachable — installed-only gating stands */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [journeyInstalled, journeyTarget])
  const showJourneyHero = !!onLaunchJourney && (journeyInstalled || journeyInCatalog)

  // Phrase Flip is a native experience (not a games-store entry), so synthesize
  // a Recent tile from its own last-launch timestamp and merge it in — it
  // should appear in "Recent" just like any pack the user has opened.
  const phraseLastLaunchedAt = useRecentNativeStore((s) => s.phraseLastLaunchedAt)
  const recentGames = useMemo<InstalledGame[]>(() => {
    if (typeof phraseLastLaunchedAt !== "number") return installedGames
    const phraseTile: InstalledGame = {
      id: "phrase_main",
      name: t("experiences.phrase_main.name", { defaultValue: "Phrase Flip" }),
      manifestUrl: "",
      installedAt: 0,
      lastLaunchedAt: phraseLastLaunchedAt,
    }
    return [...installedGames, phraseTile]
  }, [installedGames, phraseLastLaunchedAt, t])

  // Recent launches route through the normal pack launcher, except Phrase Flip
  // (the native experience) which opens via its own handler.
  const launchRecent = (game: InstalledGame) => {
    if (game.id === "phrase_main") onLaunchPhrase()
    else onLaunchGame?.(game)
  }
  const { updates, updateAll } = useUpdateAll()

  // Resolve a localized catalog string (exact locale → base language → bare).
  const loc = (m: Record<string, string> | undefined, fallback: string | undefined) =>
    m?.[i18n.language] ?? m?.[i18n.language.split("-")[0]] ?? fallback
  // Loose translate for the registry's dynamic experience keys.
  const tk = t as unknown as (key: string, opts?: Record<string, unknown>) => string

  // Ranked experiences → cards. Copy/blurb/icon catalog-first; registry + lucide fallback.
  const cards: ExpCard[] = useMemo(() => {
    const ranked = rankHomeExperiences(
      { interests, userClass, ageBand, ratings: ratingSig, userLanguages: languages },
      catalog,
      installedIds,
    )
    return ranked.map<ExpCard>((meta) => {
      const cg = catalogById.get(meta.id)
      const installedGame = games[meta.id] as InstalledGame | undefined
      const installed = meta.id === "phrase_main" || !!installedGame
      const name = loc(cg?.nameLocalized, cg?.name) ?? tk(meta.nameKey)
      // Catalog-first blurb (lets us re-author Home copy via web/data/packs.json
      // without an app release; see CHANGELOG 0.16.1 and the plan in
      // experiences/registry.ts header). Tagline is the short Home-recommendation
      // copy; description is the longer landing-page copy — fall through tagline
      // → description → the i18n key only as a defensive in-binary fallback.
      const blurb =
        loc(cg?.taglineLocalized, cg?.tagline)
          ?? loc(cg?.descriptionLocalized, cg?.description)
          ?? tk(meta.blurbKey, { defaultValue: "" })
      const onClick =
        meta.id === "phrase_main"
          ? onLaunchPhrase
          : installedGame
            ? () => launchGame?.(installedGame)
            : cg
              ? () => void installCatalogPack(cg)
              : () => {}
      const imageUrl = cg?.imageUrl ?? (meta.id === PHRASE_PACK_ID ? PHRASE_FLIP_IMAGE : undefined)
      return { id: meta.id, name, blurb, imageUrl, Icon: EXP_ICON[meta.id] ?? Package, installed, onClick }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, catalogById, games, installedIds, interests, userClass, ageBand, languages, i18n.language, ratingSig])

  // Top-level "pack updates" CTA — in-flight guard so a double-tap can't fire
  // two update-all passes; the CTA self-hides once `updates` empties.
  const [updating, setUpdating] = useState(false)
  const runUpdateAll = async () => {
    if (updating) return
    setUpdating(true)
    try {
      await updateAll()
    } finally {
      setUpdating(false)
    }
  }

  // The cycling recommendation index (the "star"). Clamp if the list shrinks.
  const [heroIdx, setHeroIdx] = useState(0)
  const idx = cards.length ? heroIdx % cards.length : 0
  const hero = cards[idx]
  const rest = cards.filter((_, i) => i !== idx)
  const HeroIcon = hero?.Icon ?? Package
  const heroLiked = hero ? ratings[hero.id] === "like" : false

  const cycleNext = () => {
    if (hero && cards.length > 1) trackCycleAdvanced(hero.id, cards[(idx + 1) % cards.length].id)
    setHeroIdx((i) => i + 1)
  }
  const likeHero = () => {
    if (!hero) return
    rate(hero.id, heroLiked ? "dismiss" : "like")
    if (!heroLiked) trackPackKept(hero.id, "home")
  }
  const dismissHero = () => {
    if (!hero) return
    rate(hero.id, "dismiss")
    trackPackDiscarded(hero.id, "home")
    cycleNext()
  }

  return (
    <div
      data-home-scroll
      className="fixed inset-0 overflow-y-auto overscroll-contain bg-background"
      style={{
        WebkitOverflowScrolling: "touch",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      dir={dir()}
    >
      {/* Chrome */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 ${glass("bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60", "bg-background/90")}`}
        style={{
          // Push the WHOLE header row down together so the mark + the gear
          // both clear the window "stoplight" controls (Stage Manager / macOS)
          // and stay vertically aligned via items-center. Shared with the
          // settings header (getTopBarPaddingTop) so the gear + close-X match.
          paddingTop: getTopBarPaddingTop(),
          paddingBottom: "0.5rem",
        }}
      >
        <div className="flex items-center gap-2">
          <img src={corpanMark} alt="" aria-hidden="true" draggable={false} style={{ height: 26, width: "auto" }} />
          <span className="font-semibold text-foreground" style={{ letterSpacing: "0.03em" }}>Corpán</span>
        </div>
        <div className="flex items-center gap-2">
          <StreakChip />
          <Button
            variant="default"
            size="lg"
            className="h-10 w-12 rounded-md shadow-sm bg-background border border-border hover:bg-accent transition"
            aria-label="Settings"
            onClick={onSettings}
          >
            <SettingsIcon className="text-muted-foreground h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-24 pt-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
        {/* Pack updates — a single quiet line, above everything. Exists ONLY
            when an installed pack has an update; renders nothing otherwise
            (no reserved space, no layout jolt). */}
        {updates.length > 0 ? (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-purple-400/40 bg-purple-500/[0.06] px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {t("home.packUpdates", { defaultValue: "You have pack updates" })}
            </span>
            <Button
              size="sm"
              className="h-9 shrink-0 rounded-md"
              data-testid="home-update-all"
              onClick={() => void runUpdateAll()}
              disabled={updating}
            >
              <ArrowUpCircle className={`mr-1.5 h-4 w-4${updating ? " animate-spin" : ""}`} />
              {t("home.updateAll", { defaultValue: "Update all" })}
            </Button>
          </div>
        ) : null}

        {/* Journey — the flagship guided path (above "For you"). Copy rides
            the existing journey.* i18n keys (all ~54 locales, W4). */}
        {showJourneyHero ? (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("journey.heroCard.title")}
            </h2>
            <div className="w-full overflow-hidden rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.18] to-purple-500/[0.04] p-5 md:p-7">
              <div className="flex items-start gap-4 md:gap-5">
                <span className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-purple-500/15">
                  <Route className="h-7 w-7 md:h-8 md:w-8 text-purple-400" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xl md:text-2xl font-bold text-foreground">
                    {t("journey.name")}
                  </div>
                  <div className="mt-0.5 text-sm md:text-base text-muted-foreground">
                    {t("journey.tagline")}
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Button className="!h-11 px-6" data-testid="journey-hero-cta" onClick={onLaunchJourney}>
                  {journeyEnrolled ? t("journey.heroCta.continue") : t("journey.heroCta.start")}
                  <ArrowRight className="ml-1.5 h-4 w-4 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {/* "For you" — the cycling recommendation star. */}
        {hero ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("home.forYou", { defaultValue: "For you" })}
              </h2>
              {cards.length > 1 ? (
                <button
                  type="button"
                  onClick={cycleNext}
                  data-testid="hero-cycle"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition hover:border-purple-400/60 hover:text-foreground active:scale-[0.98]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t("home.showAnother", { defaultValue: "Show me another" })}
                </button>
              ) : null}
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.14] to-purple-500/[0.03] p-5 md:p-7">
              <div className="flex items-start gap-4 md:gap-5">
                <span className="flex h-14 w-14 md:h-16 md:w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-purple-500/15">
                  <Glyph imageUrl={hero.imageUrl} Icon={HeroIcon} glyphClass="h-7 w-7 md:h-8 md:w-8 text-purple-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xl md:text-2xl font-bold text-foreground">{hero.name}</div>
                  {hero.blurb ? (
                    <div className="mt-0.5 text-sm md:text-base text-muted-foreground">{hero.blurb}</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button className="!h-11 px-6" data-testid="hero-cta" onClick={hero.onClick}>
                  {hero.installed
                    ? t("home.tryIt", { defaultValue: "Try it" })
                    : t("home.get", { defaultValue: "Get" })}
                  {hero.installed ? (
                    <ArrowRight className="ml-1.5 h-4 w-4 rtl:rotate-180" />
                  ) : (
                    <Download className="ml-1.5 h-4 w-4" />
                  )}
                </Button>
                <button
                  type="button"
                  onClick={likeHero}
                  aria-label={t("home.like", { defaultValue: "Like" })}
                  aria-pressed={heroLiked}
                  className={`flex h-11 w-11 items-center justify-center rounded-md border transition ${heroLiked ? "border-purple-500 bg-purple-500/15 text-purple-500" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}
                >
                  <Heart className="h-5 w-5" fill={heroLiked ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={dismissHero}
                  aria-label={t("home.notForMe", { defaultValue: "Not for me" })}
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Recent — terse name-only quick re-entry; self-hides when empty. */}
        <div className="mt-8">
          <RecentsSection
            installedGames={recentGames}
            updates={updates}
            isOnline={isOnline}
            onLaunchGame={launchRecent}
          />
        </div>

        {/* Recommended — ONE featured/quick row (a carousel), not the full
            listing (that lives spaciously below). */}
        {rest.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("home.recommended", { defaultValue: "Recommended" })}
            </h2>
            <div className="no-scrollbar -mx-1 flex gap-3 md:gap-4 overflow-x-auto px-1 pb-1">
              {rest.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={e.onClick}
                  className="group flex w-36 md:w-44 shrink-0 flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 md:p-5 text-start transition hover:border-purple-400/50 hover:bg-accent/30 active:scale-[0.98]"
                >
                  <span className="flex h-11 w-11 md:h-12 md:w-12 items-center justify-center overflow-hidden rounded-xl bg-purple-500/10">
                    <Glyph imageUrl={e.imageUrl} Icon={e.Icon} glyphClass="h-5 w-5 md:h-6 md:w-6 text-purple-400" />
                  </span>
                  <span className="line-clamp-2 min-h-[2.5rem] w-full text-sm md:text-base font-semibold text-foreground">
                    {e.name}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    {e.installed ? (
                      <>{t("home.open")} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></>
                    ) : (
                      <>{t("home.get")} <Download className="h-3.5 w-3.5" /></>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Browse phrase packs — opens the shared drawer; self-hides when none. */}
        <div className="mt-8">
          <PhrasePackDrawerTrigger />
        </div>

        {/* All packs — spacious listing: manage installed (update/remove) +
            discover available. */}
        <section className="mt-8">
          {/* `launchRecent` (not the raw onLaunchGame) so the built-in Phrase
              Flip card routes to onLaunchPhrase, like the Recent tile does. */}
          <PacksSection onLaunchGame={launchRecent} />
        </section>

        {/* Tiny Plus chip — no drab card; self-hides when subscribed / no IAP. */}
        {iapAvailable && !subscribed ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => openPaywall({ surface: "home_chip" })}
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/40 bg-purple-500/[0.06] px-4 py-1.5 text-xs font-medium text-purple-500 transition hover:border-purple-400/70 hover:bg-purple-500/[0.1] active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.plusChip", { defaultValue: "Corpán Plus — unlock everything" })}
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export type { InstalledGame }
