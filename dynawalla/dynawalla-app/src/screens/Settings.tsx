import { useEffect, useState } from "react"

import { Destination } from "./Destination.tsx"
import { IndexMark } from "../design/IndexMark.tsx"
import { useThemeStore, type ThemeMode } from "../app/theme.ts"
import { appVersion } from "../app/platform.ts"
import { strings } from "../app/strings.ts"

const MODES: ThemeMode[] = ["system", "light", "dark"]

function ThemeControl() {
  const mode = useThemeStore((state) => state.mode)
  const setMode = useThemeStore((state) => state.setMode)

  return (
    <fieldset>
      <legend className="text-ink-muted mb-2 text-sm tracking-wide uppercase">
        {strings.theme.label}
      </legend>

      <div className="border-line-cut rounded-cut-sm flex overflow-hidden border">
        {MODES.map((candidate) => {
          const active = mode === candidate
          return (
            <button
              key={candidate}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(candidate)}
              className={[
                "border-line-cut flex min-h-11 flex-1 items-center justify-center gap-2 border-r px-4 text-sm last:border-r-0",
                "transition-colors duration-[var(--dw-motion-quick)]",
                active ? "bg-ground text-ink" : "bg-ground-raised text-ink-muted",
              ].join(" ")}
            >
              {active ? <IndexMark className="text-index" /> : null}
              {strings.theme[candidate]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * The version is read across the native boundary on device, which is the one
 * place this shell touches Rust — and therefore the one place a wrong
 * capability grant or a too-tight CSP shows up as something a person can see.
 */
function Version() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void appVersion().then((value) => {
      if (live) setVersion(value)
    })
    return () => {
      live = false
    }
  }, [])

  return (
    <p className="numeral text-ink-muted mt-6 text-xs">{version ?? " "}</p>
  )
}

export function SettingsScreen() {
  return (
    <Destination>
      <ThemeControl />
      <Version />
    </Destination>
  )
}
