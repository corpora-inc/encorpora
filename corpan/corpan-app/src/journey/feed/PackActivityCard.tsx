// src/journey/feed/PackActivityCard.tsx — shared poster/launch/return frame
// (feed-ux §1.7/§6) used by MiniGameRound + StoryChapter rares AND scheduled
// anchor cards. Never auto-launches: the learner taps Play (a pack mount is
// a commitment; abandon = swipe past the poster).
//
// Poster art must ride <OfflineImage> when a URL is present (offline-cache
// spec, R15). W2's component is not in this tree yet — W10: swap the <img>
// below for <OfflineImage> at integration (one-line change, marked TODO).

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import type { FeedCard } from "../types.ts"

export function PackActivityCard(props: {
  card: Extract<FeedCard, { kind: "packActivity" }>
  pending: boolean
  onPlay: () => void
}) {
  const { t } = useTranslation()
  const { card } = props
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
        {card.poster.imageUrl ? (
          // TODO(W10): replace with <OfflineImage> once W2 merges (R15).
          <img src={card.poster.imageUrl} alt={card.poster.name} className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-48 w-full items-center justify-center text-5xl">🎮</div>
        )}
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
          <div className="mt-1 text-lg font-bold text-foreground">{card.poster.name}</div>
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
