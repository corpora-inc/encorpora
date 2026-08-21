// src/journey/feed/JumpOfferCard.tsx — the engine's jump_offer card
// (engine §5.9): a cruising learner may attempt a gauntlet to skip ahead.
// Manual only; declining is a first-class equal choice.

import { useTranslation } from "react-i18next"
import { Rocket } from "lucide-react"

export function JumpOfferCard(props: { onAccept: () => void; onDecline: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-5 text-center" data-testid="journey-jump-offer">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.14)]">
        <Rocket className="h-7 w-7 text-foreground" />
      </div>
      <div className="text-xl font-bold text-foreground">{t("journey.jump.title")}</div>
      <div className="text-sm text-muted-foreground">{t("journey.jump.body")}</div>
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={props.onDecline}
          data-testid="journey-jump-decline"
          className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
        >
          {t("journey.jump.decline")}
        </button>
        <button
          type="button"
          onClick={props.onAccept}
          data-testid="journey-jump-accept"
          className="min-h-12 flex-1 rounded-xl border border-border bg-card text-base font-semibold text-foreground hover:bg-muted"
        >
          {t("journey.jump.accept")}
        </button>
      </div>
    </div>
  )
}
