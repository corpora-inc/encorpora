// src/journey/feed/RareCard.tsx — shimmer reveal wrapper + variant dispatch
// (feed-ux §1.7). Tier-3 anticipation: shimmer PRE-animation on the card
// back, then flip reveal. Rules baked in: rarity never purchasable; every
// variant carries real learning value; reveal is manual (never rushed).

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Sparkles } from "lucide-react"
import { celebrate } from "../celebration/CelebrationLayer.tsx"
import type { RareVariant } from "../types.ts"

export function RareCard(props: {
  variant: RareVariant
  revealed: boolean
  onReveal: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const reduced = useReducedMotion()
  const [revealing, setRevealing] = useState(false)

  if (props.revealed) return <>{props.children}</>

  const reveal = () => {
    if (revealing) return
    setRevealing(true)
    void celebrate({ tier: 3 })
    setTimeout(() => props.onReveal(), reduced ? 0 : 650)
  }

  return (
    <button
      type="button"
      onClick={reveal}
      data-testid="journey-rare-back"
      className="relative flex min-h-64 w-full max-w-[26rem] flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-[hsl(var(--journey-accent,262_80%_58%)/0.4)] bg-gradient-to-br from-[hsl(var(--journey-accent,262_80%_58%)/0.2)] to-transparent p-8"
    >
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-24 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-150%" }}
          animate={{ x: "450%" }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        />
      )}
      <AnimatePresence>
        <motion.div
          key={revealing ? "spin" : "idle"}
          animate={revealing && !reduced ? { rotateY: 90, opacity: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <Sparkles className="h-10 w-10 text-[hsl(var(--journey-accent,262_80%_58%))]" />
          <div className="text-lg font-bold text-foreground">{t("journey.rare.reveal")}</div>
        </motion.div>
      </AnimatePresence>
    </button>
  )
}
