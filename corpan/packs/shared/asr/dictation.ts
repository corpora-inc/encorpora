// Dictation controller + `wireDictation` — drive an EXISTING mic button.
//
// `attachMicInput` (micInput.ts) builds its own button + launchpad for fields
// that don't have one. But some surfaces already ship a mic button in their
// composer (e.g. Corpan City's `.wp-npc-mic`, Tutomaton's chat). For those we
// reuse THAT button instead of injecting a second one. Both paths share the
// same session lifecycle: this module is the DOM-light core.
//
// Resolution model (per STT_MASTERPLAN §5): the host picks a provider for the
// field's language via `host.asr.pick({lang, goal:"dictation"})`. If it returns
// null → no engine transcribes this language → the mic is HIDDEN and the field
// is plainly type-only (keyboard floor). So the button only appears where it
// works, per-language — exactly the requirement.

import type { AsrProvider, AsrSession, AsrCaptureMode } from "./contract"
import type { AsrApi } from "./host"

export type DictationStrings = {
  /** mic idle label/aria. */ speak: string
  /** mic recording label/aria. */ stop: string
  /** permission-denied guidance. */ denied: string
}

const EN: DictationStrings = {
  speak: "Speak",
  stop: "Stop",
  denied: "Microphone access is off. Turn it on in Settings to dictate.",
}

export type WireDictationOpts = {
  /** The existing mic button to drive (its disabled/hidden state is managed). */
  button: HTMLButtonElement
  /** The text field partials/finals fill. */
  field: HTMLInputElement | HTMLTextAreaElement
  /** Resolve a provider for `lang` at press time; null → keyboard floor. */
  resolveProvider: (lang: string) => Promise<AsrProvider | null>
  /** Language to dictate. May be read lazily via a function for surfaces whose
   *  target language changes (e.g. Tutomaton switching tutors). */
  lang: string | (() => string)
  mode?: AsrCaptureMode
  /** Localized strings (English fallback). */
  strings?: Partial<DictationStrings>
  /** Open the app's OS Settings page (iOS: openSettingsURLString). Optional. */
  openAppSettings?: () => void
  /** Called when the live state flips, so the host can toggle a CSS class. */
  onLiveChange?: (live: boolean) => void
  /** Called with VU rms 0..1 each level event (for a meter, optional). */
  onLevel?: (rms: number) => void
}

/**
 * Convenience: resolve a provider via `host.asr.pick` for dictation. Surfaces
 * pass `host.asr` and we do the standard pick. Returns null (→ keyboard) when
 * `host.asr` is absent or nothing transcribes the language.
 */
export function dictationResolver(asr: AsrApi | undefined) {
  return async (lang: string): Promise<AsrProvider | null> => {
    if (!asr) return null
    try {
      return await asr.pick({ lang, goal: "dictation" })
    } catch (err) {
      console.error("[dictation] host.asr.pick failed:", err)
      return null
    }
  }
}

/**
 * Wire an existing mic button to dictate into a field. Returns a teardown fn.
 *
 * On attach it probes availability ONCE (resolveProvider for the current lang):
 * if no provider, the button is hidden (keyboard floor) and we're done. If a
 * provider exists, the button is enabled and toggles a capture session.
 */
export function wireDictation(opts: WireDictationOpts): () => void {
  const t = (k: keyof DictationStrings) => opts.strings?.[k] ?? EN[k]
  const mode: AsrCaptureMode = opts.mode ?? "push_to_talk"
  const langOf = () => (typeof opts.lang === "function" ? opts.lang() : opts.lang)

  let session: AsrSession | null = null
  let live = false
  let destroyed = false

  const setLive = (on: boolean) => {
    live = on
    opts.button.setAttribute("aria-label", on ? t("stop") : t("speak"))
    opts.button.classList.toggle("is-live", on)
    opts.onLiveChange?.(on)
  }

  async function start() {
    const lang = langOf()
    let provider: AsrProvider | null
    try {
      provider = await opts.resolveProvider(lang)
    } catch (err) {
      console.error("[dictation] resolveProvider failed:", err)
      provider = null
    }
    if (!provider) {
      // Lost availability (e.g. lang changed) → hide + bail to keyboard.
      opts.button.style.display = "none"
      return
    }
    try {
      session = await provider.transcribe({ lang, mode })
    } catch (err) {
      console.error("[dictation] transcribe() failed:", err)
      opts.openAppSettings ? promptSettings() : void 0
      return
    }
    setLive(true)
    session.onPartial((text) => {
      if (destroyed) return
      opts.field.value = text
      opts.field.dispatchEvent(new Event("input", { bubbles: true }))
    })
    session.onLevel((rms) => {
      if (destroyed) return
      opts.onLevel?.(rms)
    })
    session.onError((code, message) => {
      // INTERRUPTED / CANCELLED = clean stop, not an error surface.
      if (code === "INTERRUPTED" || code === "CANCELLED") {
        finishUI()
        return
      }
      console.error(`[dictation] session error ${code}:`, message ?? "")
      if (code === "MIC_DENIED") promptSettings()
      finishUI()
    })
  }

  async function stop() {
    if (!session) return finishUI()
    try {
      const out = await session.stop()
      if (!destroyed && out.text) {
        opts.field.value = out.text
        opts.field.dispatchEvent(new Event("input", { bubbles: true }))
      }
    } catch (err) {
      console.error("[dictation] stop() failed:", err)
    } finally {
      session = null
      finishUI()
    }
  }

  function finishUI() {
    setLive(false)
  }

  function promptSettings() {
    // Minimal, dependency-free: log + (if provided) offer the Settings jump.
    // The richer launchpad lives in MicInput; surfaces with their own chrome
    // (NPC chat) can show `denied` text themselves via onLiveChange if wanted.
    console.warn("[dictation]", t("denied"))
    opts.openAppSettings?.()
  }

  const onClick = () => {
    if (live) void stop()
    else void start()
  }

  // Probe availability once; only reveal/enable the button where it works.
  let attached = false
  ;(async () => {
    const provider = await opts.resolveProvider(langOf()).catch(() => null)
    if (destroyed) return
    if (!provider) {
      // Keyboard floor: hide the mic so the field is plainly type-only.
      opts.button.style.display = "none"
      return
    }
    opts.button.disabled = false
    opts.button.style.display = ""
    opts.button.setAttribute("aria-label", t("speak"))
    opts.button.addEventListener("click", onClick)
    attached = true
  })()

  return () => {
    destroyed = true
    if (attached) opts.button.removeEventListener("click", onClick)
    try {
      session?.cancel()
    } catch (err) {
      console.error("[dictation] cancel on teardown failed:", err)
    }
  }
}
