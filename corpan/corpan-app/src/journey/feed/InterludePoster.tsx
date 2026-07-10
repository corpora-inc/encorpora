// src/journey/feed/InterludePoster.tsx — the compact "sip"-sized interlude
// visual (PREMIUM_SCROLL §2.2/§3.7). A game/reader interlude drops the learner
// in for ONE phrase, then scrolls on — so its poster is deliberately NOT a
// full-height game launch. It is a small, squared-off, premium card: a glyph/
// art chip, the pack name, a one-line "quick game · one phrase" cue, and a
// single Play affordance. The heavy full-height poster (PackActivityCard) is
// reserved for the §2.4 3D tent-poles.
//
// Squared-off design standard: 8px (rounded-lg) corners on the frame + button,
// compact on mobile, no accumulating rows, no jolting read-back copy.

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import { OfflineImage } from "@/components/ui/OfflineImage"
import type { PackPoster } from "../types.ts"

export function InterludePoster(props: {
  poster: PackPoster
  /** "miniGame" | "storyChapter" — a reader interlude reads "one passage". */
  rare?: "miniGame" | "storyChapter"
  pending: boolean
  onPlay: () => void
}) {
  const { t } = useTranslation()
  const { poster, rare } = props
  const isReader = rare === "storyChapter"
  // One-line cue, never layout-jolting (fixed within the card, not in-flow).
  const cue = isReader
    ? t("journey.interlude.readerCue")
    : t("journey.interlude.gameCue")
  const cta = isReader
    ? t("journey.rare.story.read")
    : t("journey.rare.miniGame.play")

  return (
    <div
      className="flex w-full max-w-[22rem] flex-col items-center gap-3 text-center"
      data-testid="journey-interlude-poster"
    >
      <motion.button
        type="button"
        disabled={props.pending}
        onClick={props.onPlay}
        data-testid="journey-interlude-play"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.98 }}
        className="group relative flex w-full items-center gap-3 rounded-lg border border-border bg-gradient-to-br from-[hsl(var(--journey-accent,262_80%_58%)/0.22)] to-[hsl(var(--journey-accent,262_80%_58%)/0.06)] p-3 text-left disabled:opacity-60"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
          {poster.imageUrl ? (
            <OfflineImage
              src={poster.imageUrl}
              alt={poster.name}
              className="h-14 w-14 object-cover"
              fallback={
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[hsl(var(--journey-accent,262_80%_58%)/0.18)] text-2xl">
                  {isReader ? "📖" : "🎮"}
                </div>
              }
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[hsl(var(--journey-accent,262_80%_58%)/0.18)] text-2xl">
              {isReader ? "📖" : "🎮"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-foreground">
            {poster.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {cue}
          </div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--journey-accent,262_80%_58%))] text-white">
          <Play className="h-4 w-4" aria-label={cta} />
        </div>
      </motion.button>
      <div className="text-xs text-muted-foreground">
        {t("journey.exercise.skipHint")}
      </div>
    </div>
  )
}
