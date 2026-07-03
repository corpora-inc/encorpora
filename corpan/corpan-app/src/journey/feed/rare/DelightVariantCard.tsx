// src/journey/feed/rare/DelightVariantCard.tsx — the delight face (feed-ux
// §1.7): same exercise, framed as a treat ("a different voice" / micro-
// pattern callout). Scored normally — the wrapped exercise renders below.

import { useTranslation } from "react-i18next"

export function DelightVariantCard(props: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full flex-col items-center gap-4" data-testid="journey-rare-delight">
      <div className="rounded-full bg-[hsl(var(--journey-accent,262_80%_58%)/0.14)] px-3.5 py-1.5 text-xs font-semibold text-foreground">
        ✨ {t("journey.rare.delight.didYouNotice")}
      </div>
      {props.children}
    </div>
  )
}
