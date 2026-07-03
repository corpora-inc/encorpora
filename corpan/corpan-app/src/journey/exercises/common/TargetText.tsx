// src/journey/exercises/common/TargetText.tsx — the hero target-language
// text block (feed-ux §9 typography): correct lang/dir, romanization per
// stack setting (italic, muted, always LTR), and the phrase pop-in long-press
// binding (capability-modules.md §5 — every native card that displays a
// target-language phrase binds usePhrasePopIn).

import { isRTL } from "../../../util/convert"
import type { ResolvedItem } from "../../content/resolve.ts"
import { usePhrasePopIn } from "../../popin/usePhrasePopIn.ts"

export function TargetText(props: {
  item: ResolvedItem
  lang: string
  showRomanization: boolean
  size?: "md" | "lg"
  hidden?: boolean
}) {
  const bind = usePhrasePopIn(() => ({
    text: props.item.target.text,
    lang: props.lang,
    romanization: props.item.target.romanization,
    nativeText: props.item.native?.text,
    itemRef: props.item.ref,
  }))
  if (props.hidden) return null
  const big = props.size !== "md"
  return (
    <div className="flex flex-col items-center gap-1 text-center" {...bind}>
      <div
        lang={props.lang}
        dir={isRTL(props.lang) ? "rtl" : "ltr"}
        data-testid="journey-target-text"
        className={`${big ? "text-3xl sm:text-4xl" : "text-xl"} font-semibold leading-snug text-foreground`}
      >
        {props.item.target.text}
      </div>
      {props.showRomanization && props.item.target.romanization ? (
        <div dir="ltr" className="text-sm italic text-muted-foreground">
          {props.item.target.romanization}
        </div>
      ) : null}
    </div>
  )
}
