// src/journey/placement/PlacementCard.tsx — probe-mode reuse of the native
// renderers (feed-ux §1.9): no hints, no retry, no celebration beyond the
// tier-0 stamp, muted "skip if unsure" (counts as a miss). Progress is thin
// dots, never a numbered bar.

import { useTranslation } from "react-i18next"
import type { ActivityResult } from "../../contentPacks/activityContract"
import { ActivityCardHost } from "../feed/ActivityCardHost.tsx"
import type { SpeakFn } from "../exercises/types.ts"
import type { FeedCard } from "../types.ts"

export function PlacementCard(props: {
  card: Extract<FeedCard, { kind: "exercise" }>
  asked: number
  speak: SpeakFn
  showRomanization: boolean
  onResult: (r: ActivityResult) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full max-w-[26rem] flex-col items-center gap-6" data-testid="journey-placement-card">
      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: Math.min(props.asked + 1, 12) }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i <= props.asked ? "bg-[hsl(var(--journey-accent,262_80%_58%))]" : "bg-muted"}`}
          />
        ))}
      </div>
      <ActivityCardHost
        key={props.card.cardId}
        card={props.card}
        mode="probe"
        combo={0}
        speak={props.speak}
        showRomanization={props.showRomanization}
        active
        onResult={props.onResult}
        onRequestAdvance={() => {}}
      />
      <button
        type="button"
        data-testid="journey-placement-skip"
        onClick={() =>
          props.onResult({
            specId: props.card.spec.specId,
            score: 0,
            perItem: props.card.prepared.items.map((i) => ({ itemRef: i.ref, outcome: "fail" })),
            durationMs: 0,
          })
        }
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {t("journey.placement.skipItem")}
      </button>
    </div>
  )
}
