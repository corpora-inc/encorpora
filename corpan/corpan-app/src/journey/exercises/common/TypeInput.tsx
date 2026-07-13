// src/journey/exercises/common/TypeInput.tsx — dictation/cloze input with a
// diacritic-tolerant compare (normalize.ts owns the normalizer — one source).

import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { isRTL } from "../../../util/convert"

export function TypeInput(props: {
  lang: string
  disabled?: boolean
  /** First-word / first-letter reveal from the retry scaffold. */
  hint?: string | null
  onSubmit: (typed: string) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const submit = () => {
    const typed = value.trim()
    if (!typed || props.disabled) return
    props.onSubmit(typed)
  }
  return (
    <div className="flex w-full flex-col gap-2">
      {/* No-reflow (ReservedSlot.tsx): the scaffold's first-letter hint fills a
          reserved line held from mount, so revealing it never pushes the input
          down. */}
      <div className="min-h-5 text-sm text-muted-foreground" data-testid="journey-type-hint">
        {props.hint ? (
          <>
            {t("journey.exercise.hint")}: <span lang={props.lang}>{props.hint}</span>
          </>
        ) : null}
      </div>
      {/* Stack input over the Check button, both full-width: a side-by-side row
          clipped the button off the right edge on a phone. */}
      <div className="flex w-full flex-col gap-2" dir={isRTL(props.lang) ? "rtl" : "ltr"}>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit()
          }}
          disabled={props.disabled}
          lang={props.lang}
          dir={isRTL(props.lang) ? "rtl" : "ltr"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("journey.exercise.typeHere")}
          data-testid="journey-type-input"
          className="min-h-12 w-full min-w-0 rounded-xl border border-border bg-card px-4 text-base text-foreground outline-none focus:border-[hsl(var(--journey-accent,262_80%_58%))]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={props.disabled || value.trim().length === 0}
          data-testid="journey-type-submit"
          className="min-h-12 w-full rounded-xl bg-[hsl(var(--journey-accent,262_80%_58%))] px-5 text-base font-semibold text-white disabled:opacity-40"
        >
          {t("journey.exercise.check")}
        </button>
      </div>
    </div>
  )
}
