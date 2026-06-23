// MicInput — the reusable "speak instead of type" affordance.
//
// One call attaches a mic button to ANY text field. It opens an AsrSession
// on the provider you hand it (or that you resolve via host.asr.pick),
// streams partials into the field, shows a VU meter, and ALWAYS leaves the
// keyboard working underneath — the mic is additive, never a gate
// (STT_MASTERPLAN §8: keyboard is the permanent floor).
//
// Framework-agnostic vanilla DOM on purpose: Corpán packs are standalone
// IIFEs and the core app mounts this into React via a ref. No deps.
//
// Design rules baked in:
//  - Generous 44px hit zone around the button (not a bare icon) —
//    [[feedback_drawer_grab_area]] / commandDrawer's handle idiom.
//  - RTL: when `dir==="rtl"` the control flips side + text aligns right.
//  - Permission denied → an in-pack launchpad row (NO window.confirm/alert —
//    [[feedback_no_window_dialogs]]) with an "Open Settings" affordance the
//    host wires to openSettingsURLString (iOS Settings deep-links are
//    impossible — [[feedback_ios_settings_deeplink_impossible]]).
//  - Errors are surfaced, never swallowed — [[feedback_noisy_errors]].

import type { AsrProvider, AsrCaptureMode } from "./contract"

export type MicInputTarget = {
  /** The input/textarea whose `.value` we fill (partials live-update it). */
  field: HTMLInputElement | HTMLTextAreaElement
  /** Our language code to transcribe. */
  lang: string
  /** "ltr" | "rtl" — controls layout + text alignment. Default ltr. */
  dir?: "ltr" | "rtl"
  mode?: AsrCaptureMode
}

export type MicInputHost = {
  /** Resolve a provider for the field's language at press time. Return null
   *  to signal "no engine — keyboard only" (the button hides itself). */
  resolveProvider: (lang: string) => Promise<AsrProvider | null>
  /** Open the OS Settings to this app's page (the only thing that works on
   *  iOS). Host wires this to openSettingsURLString. Optional; when absent
   *  the launchpad just shows guidance text. */
  openAppSettings?: () => void
  /** Localized strings; English fallbacks below. */
  t?: (key: MicStringKey) => string
}

export type MicStringKey =
  | "mic.speak"
  | "mic.listening"
  | "mic.stop"
  | "mic.denied"
  | "mic.openSettings"
  | "mic.unavailable"

const EN: Record<MicStringKey, string> = {
  "mic.speak": "Speak",
  "mic.listening": "Listening…",
  "mic.stop": "Stop",
  "mic.denied": "Microphone access is off. Turn it on in Settings to dictate.",
  "mic.openSettings": "Open Settings",
  "mic.unavailable": "Voice input isn’t available for this language yet — type instead.",
}

const STYLE_ID = "corpan-mic-input-style"

function ensureStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return
  const el = document.createElement("style")
  el.id = STYLE_ID
  el.textContent = `
.corpan-mic { position: relative; display: inline-flex; align-items: center; }
.corpan-mic[dir="rtl"] { flex-direction: row-reverse; }
/* 44px hit band; the visible disc is centered inside. Grab anywhere. */
.corpan-mic-btn {
  flex-shrink: 0; width: 44px; height: 44px; padding: 0; border: 0;
  background: transparent; cursor: pointer; display: inline-flex;
  align-items: center; justify-content: center; -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.corpan-mic-disc {
  width: 30px; height: 30px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--corpan-mic-bg, rgba(0,0,0,0.06));
  color: var(--corpan-mic-fg, currentColor);
  transition: background .15s ease, transform .15s ease;
}
.corpan-mic-btn:active .corpan-mic-disc { transform: scale(0.92); }
.corpan-mic.is-live .corpan-mic-disc {
  background: var(--corpan-mic-live, #e5484d); color: #fff;
  box-shadow: 0 0 0 var(--corpan-mic-ring, 0px) rgba(229,72,77,0.35);
}
.corpan-mic-vu {
  position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
}
.corpan-mic-launchpad {
  position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 50;
  max-width: 260px; padding: 10px 12px; border-radius: 10px;
  background: var(--corpan-mic-pop-bg, #1c1c1e); color: #fff;
  font-size: 13px; line-height: 1.35; box-shadow: 0 8px 28px rgba(0,0,0,0.28);
}
.corpan-mic[dir="rtl"] .corpan-mic-launchpad { left: auto; right: 0; }
.corpan-mic-launchpad button {
  margin-top: 8px; padding: 6px 10px; border: 0; border-radius: 8px;
  background: #fff; color: #111; font-weight: 600; cursor: pointer;
}
`
  document.head.appendChild(el)
}

const MIC_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
  'stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>' +
  '<path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/></svg>'

/** Attach a mic affordance next to a text field. Returns a teardown fn. */
export function attachMicInput(
  target: MicInputTarget,
  host: MicInputHost,
): () => void {
  ensureStyle()
  const t = host.t ?? ((k: MicStringKey) => EN[k])
  const dir = target.dir ?? "ltr"
  const mode: AsrCaptureMode = target.mode ?? "push_to_talk"

  const root = document.createElement("span")
  root.className = "corpan-mic"
  root.setAttribute("dir", dir)

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "corpan-mic-btn"
  btn.setAttribute("aria-label", t("mic.speak"))
  const disc = document.createElement("span")
  disc.className = "corpan-mic-disc"
  disc.innerHTML = MIC_SVG
  btn.appendChild(disc)
  root.appendChild(btn)

  // Insert after the field.
  target.field.insertAdjacentElement("afterend", root)

  let session: Awaited<ReturnType<AsrProvider["transcribe"]>> | null = null
  let live = false
  let launchpad: HTMLElement | null = null
  let destroyed = false

  function clearLaunchpad() {
    launchpad?.remove()
    launchpad = null
  }

  function showLaunchpad(message: string, withSettings: boolean) {
    clearLaunchpad()
    launchpad = document.createElement("div")
    launchpad.className = "corpan-mic-launchpad"
    launchpad.textContent = message
    if (withSettings && host.openAppSettings) {
      const b = document.createElement("button")
      b.type = "button"
      b.textContent = t("mic.openSettings")
      b.addEventListener("click", () => {
        host.openAppSettings?.()
        clearLaunchpad()
      })
      launchpad.appendChild(b)
    }
    root.appendChild(launchpad)
  }

  function setLive(on: boolean) {
    live = on
    root.classList.toggle("is-live", on)
    btn.setAttribute("aria-label", on ? t("mic.stop") : t("mic.speak"))
    disc.innerHTML = on ? "■" : MIC_SVG
  }

  async function start() {
    clearLaunchpad()
    let provider: AsrProvider | null
    try {
      provider = await host.resolveProvider(target.lang)
    } catch (err) {
      // Noisy, not silent.
      console.error("[mic] resolveProvider failed:", err)
      provider = null
    }
    if (!provider) {
      // No engine for this language → keyboard floor. Hide the button so the
      // field is plainly type-only, and tell the user once.
      showLaunchpad(t("mic.unavailable"), false)
      btn.style.display = "none"
      return
    }
    try {
      session = await provider.transcribe({ lang: target.lang, mode })
    } catch (err) {
      console.error("[mic] transcribe() failed:", err)
      showLaunchpad(t("mic.denied"), true)
      return
    }
    setLive(true)
    session.onPartial((text) => {
      if (destroyed) return
      target.field.value = text
      target.field.dispatchEvent(new Event("input", { bubbles: true }))
    })
    session.onLevel((rms) => {
      if (destroyed) return
      // Drive the ring radius off RMS for a live VU pulse (0..1 → 0..8px).
      root.style.setProperty("--corpan-mic-ring", `${Math.round(rms * 8)}px`)
    })
    session.onError((code, message) => {
      // INTERRUPTED (call / Control-Center) is a clean stop, not an error UI.
      if (code === "INTERRUPTED" || code === "CANCELLED") {
        finishUI()
        return
      }
      console.error(`[mic] session error ${code}:`, message ?? "")
      if (code === "MIC_DENIED") showLaunchpad(t("mic.denied"), true)
      finishUI()
    })
  }

  function finishUI() {
    setLive(false)
    root.style.removeProperty("--corpan-mic-ring")
  }

  async function stop() {
    if (!session) return finishUI()
    try {
      const out = await session.stop()
      if (!destroyed && out.text) {
        target.field.value = out.text
        target.field.dispatchEvent(new Event("input", { bubbles: true }))
      }
    } catch (err) {
      console.error("[mic] stop() failed:", err)
    } finally {
      session = null
      finishUI()
    }
  }

  btn.addEventListener("click", () => {
    if (live) void stop()
    else void start()
  })

  return () => {
    destroyed = true
    try {
      session?.cancel()
    } catch (err) {
      console.error("[mic] cancel on teardown failed:", err)
    }
    clearLaunchpad()
    root.remove()
  }
}
