// src/journey/feed/BlockIntroCard.tsx — model-heavy block header (feed-ux
// §6.3). The runtime already kicked stt.prepare() on ARRIVAL; the Ready
// button shows a loading shimmer until prepare resolves so the wait overlaps
// the reading moment. Manual advance only (mic consent is deliberate).

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Mic } from "lucide-react"
import { useSttStore } from "../../store/stt"

export function BlockIntroCard(props: {
  blockLen: number
  /** Resolves when the model is warm; rejects/never = keep shimmering. */
  prepared?: Promise<void> | null
  onReady: () => void
}) {
  const { t } = useTranslation()
  const [warm, setWarm] = useState(props.prepared == null)

  // Mark the mic-priming card as SHOWN on its first impression, so it renders
  // AT MOST ONCE ever (R2). Idempotent: noteMicIntroShown only sets the stamp
  // when it's still null, so a scroll-back re-mount is a harmless no-op.
  useEffect(() => {
    useSttStore.getState().noteMicIntroShown()
  }, [])

  useEffect(() => {
    let alive = true
    props.prepared?.then(() => {
      if (alive) setWarm(true)
    }).catch(() => {
      if (alive) setWarm(true) // failure path is handled by the runtime swap
    })
    return () => {
      alive = false
    }
  }, [props.prepared])

  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-block-intro">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.14)] text-foreground"
      >
        <Mic className="h-8 w-8" />
      </motion.div>
      <div className="text-xl font-bold text-foreground">
        {t("journey.block.speakingIntro", { count: props.blockLen })}
      </div>
      <div className="text-sm text-muted-foreground">{t("journey.block.micPrompt")}</div>
      <button
        type="button"
        disabled={!warm}
        onClick={props.onReady}
        data-testid="journey-block-ready"
        className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] text-base font-semibold text-white disabled:opacity-60"
      >
        {warm ? (
          t("journey.block.ready")
        ) : (
          <span className="animate-pulse">{t("journey.block.loadingModel")}</span>
        )}
      </button>
    </div>
  )
}
