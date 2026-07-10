// src/journey/feed/PackActivityCard.tsx — shared poster/launch/return frame
// (feed-ux §1.7/§6) used by MiniGameRound + StoryChapter rares AND scheduled
// anchor cards. Never auto-launches: the learner taps Play (a pack mount is
// a commitment; abandon = swipe past the poster).
//
// Poster art rides <OfflineImage> (offline-cache spec, R15) — cached pixels,
// remote pixels, or the glyph fallback, never a broken image. The poster
// name/art are enriched from the installed-games registry + catalog entry
// (the engine only knows the provider id).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import { OfflineImage } from "@/components/ui/OfflineImage"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore } from "@/store/games"
import { InterludePoster } from "./InterludePoster.tsx"
import type { FeedCard, PackPoster } from "../types.ts"

/** Poster identity: installed-game name → catalog (localized) name → the
 *  engine's provider id; artwork from the poster itself, else the catalog. */
function usePosterIdentity(packId: string, poster: PackPoster): PackPoster {
  const { i18n } = useTranslation()
  const installed = useGamesStore((s) => s.games[packId])
  const catalogEntry = useCatalogStore((s) =>
    s.getCatalog().find((g) => g.id === packId),
  )
  const localizedName =
    catalogEntry?.nameLocalized?.[i18n.language] ??
    catalogEntry?.nameLocalized?.[i18n.language.split("-")[0]] ??
    catalogEntry?.name
  return {
    name: localizedName ?? installed?.name ?? poster.name,
    imageUrl: poster.imageUrl ?? catalogEntry?.imageUrl ?? installed?.imageUrl,
  }
}

export function PackActivityCard(props: {
  card: Extract<FeedCard, { kind: "packActivity" }>
  pending: boolean
  onPlay: () => void
}) {
  const { t } = useTranslation()
  const { card } = props
  const poster = usePosterIdentity(card.packId, card.poster)

  // A "sip"-sized interlude (PREMIUM_SCROLL §2.2) renders as the compact
  // InterludePoster — a quick drop-in, not a full-height game launch. The heavy
  // full poster below stays for the §2.4 3D tent-poles + non-interlude anchors.
  if (card.interlude) {
    return (
      <InterludePoster
        poster={poster}
        rare={card.rare}
        pending={props.pending}
        onPlay={props.onPlay}
      />
    )
  }

  const title =
    card.rare === "storyChapter"
      ? t("journey.rare.story.unlocked")
      : t("journey.rare.miniGame.title")
  const cta = card.rare === "storyChapter" ? t("journey.rare.story.read") : t("journey.rare.miniGame.play")

  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-pack-poster">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[hsl(var(--journey-accent,262_80%_58%)/0.25)] to-[hsl(var(--journey-accent,262_80%_58%)/0.05)]"
      >
        {poster.imageUrl ? (
          <OfflineImage
            src={poster.imageUrl}
            alt={poster.name}
            className="h-48 w-full object-cover"
            fallback={
              <div className="flex h-48 w-full items-center justify-center text-5xl">🎮</div>
            }
          />
        ) : (
          <div className="flex h-48 w-full items-center justify-center text-5xl">🎮</div>
        )}
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
          <div className="mt-1 text-lg font-bold text-foreground">{poster.name}</div>
        </div>
      </motion.div>
      <button
        type="button"
        disabled={props.pending}
        onClick={props.onPlay}
        data-testid="journey-pack-play"
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white disabled:opacity-60"
      >
        <Play className="h-5 w-5" />
        {cta}
      </button>
      <div className="text-xs text-muted-foreground">{t("journey.exercise.skipHint")}</div>
    </div>
  )
}
