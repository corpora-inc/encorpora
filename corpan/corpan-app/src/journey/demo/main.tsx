// src/journey/demo/main.tsx — the Journey browser demo page entry
// (journey-demo.html, dev-server only; NOT part of the app build).
//
// REAL feed + REAL engine + REAL journey_en course content in a plain
// browser: fetches the precomputed /journey-demo/course.json
// (scripts/journey-demo/precompute.ts) and mounts the REAL JourneySurface
// over JSON-backed ports (wiring.ts). No Tauri: persistence is IN-MEMORY
// (refresh = restart), pack launches + STT are stubbed, TTS rides
// window.speechSynthesis when a voice is available.

import { StrictMode, useCallback, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../i18n"
import "../../index.css"
import { JourneySurface } from "../JourneySurface.tsx"
import type { SpeakFn } from "../exercises/types.ts"
import { buildDemoDeps, type DemoCourseData } from "./wiring.ts"

// ------------------------------------------------------- speech synthesis

/** Best-effort browser TTS: pick a voice matching the language, silently
 *  no-op when speechSynthesis / a voice is unavailable. */
const speak: SpeakFn = async (lang, text, opts) => {
  try {
    const synth = window.speechSynthesis
    if (!synth || !text) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    if (opts?.rate) u.rate = opts.rate
    const base = lang.toLowerCase().split("-")[0]
    const voice =
      synth.getVoices().find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
      synth.getVoices().find((v) => v.lang.toLowerCase().split("-")[0] === base)
    if (voice) u.voice = voice
    await new Promise<void>((resolve) => {
      u.onend = () => resolve()
      u.onerror = () => resolve()
      synth.speak(u)
      // safety valve: never wedge a card on a stuck utterance
      setTimeout(resolve, 15_000)
    })
  } catch {
    // silent no-op — TTS is best-effort in the demo
  }
}

// ---------------------------------------------------------------- demo app

function DemoApp() {
  const [data, setData] = useState<DemoCourseData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mountKey, setMountKey] = useState(1)
  const [dir, setDir] = useState<"ltr" | "rtl">("ltr")
  const [showRomanization, setShowRomanization] = useState(true)

  useEffect(() => {
    void fetch("/journey-demo/course.json")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as DemoCourseData
      })
      .then(setData)
      .catch((e) =>
        setError(
          `course.json missing (${String(e)}) — run: node --experimental-strip-types scripts/journey-demo/precompute.ts`,
        ),
      )
  }, [])

  // Fresh engine + in-memory persistence per mountKey: "simulate placement"
  // bumps the key, giving a cold start (placement offer) without a reload.
  const deps = useMemo(
    () => (data ? buildDemoDeps(data) : null),
    [data, mountKey],
  )

  const reset = useCallback(() => {
    // In-memory engine state dies with the reload; localStorage carries the
    // journey store meta (cards-today, streak) — clear it for a true cold start.
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
    window.location.reload()
  }, [])

  const btn =
    "rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="z-[1200] flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          Journey demo — es→en · real engine · real course content · browser
          mode (no Tauri: packs/STT/persistence are stubbed) · in-memory
          (refresh = restart)
        </span>
        <span className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => setMountKey((k) => k + 1)}>
            Simulate placement
          </button>
          <button type="button" className={btn} onClick={reset}>
            Reset
          </button>
          <button type="button" className={btn} onClick={() => setDir((d) => (d === "ltr" ? "rtl" : "ltr"))}>
            dir: {dir}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setShowRomanization((v) => !v)}
          >
            romanization: {showRomanization ? "on" : "off"}
          </button>
        </span>
      </header>
      {/* transform creates a containing block so the surface's fixed inset-0
          fills THIS pane instead of covering the demo header (demo-only). */}
      <div className="relative min-h-0 flex-1" style={{ transform: "translate(0, 0)" }}>
        {error ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-red-500">
            {error}
          </div>
        ) : !deps ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading course.json…
          </div>
        ) : (
          <JourneySurface
            key={mountKey}
            deps={deps}
            speak={speak}
            dir={dir}
            showRomanization={showRomanization}
            dailyGoal={20}
            targetLangName="English"
          />
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
)
