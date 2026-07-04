// src/journey/feed/rare/TimeCapsuleCard.tsx — "you worked hard on this a
// while back — look at you now" (feed-ux §1.7). Scored normally: it wraps
// the replayed exercise with a banner.

import { useTranslation } from "react-i18next"

export function TimeCapsuleCard(props: { when?: string; children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full flex-col items-center gap-4" data-testid="journey-rare-capsule">
      <div className="flex flex-col items-center gap-1 rounded-xl bg-muted px-4 py-2.5 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("journey.rare.timeCapsule.title")}
        </div>
        <div className="text-sm text-foreground">
          {t("journey.rare.timeCapsule.body", { when: props.when ?? "" })}
        </div>
      </div>
      {props.children}
    </div>
  )
}
