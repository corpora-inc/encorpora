/**
 * 3-bar EQ glyph — three CSS-driven states, no JS animation loop.
 *
 *   idle       — element invisible
 *   connecting — synchronized "breathing" pulse (all three bars together)
 *   playing    — independent per-bar bouncing (canned animation)
 *
 * Honest about state, dishonest about reactivity: it doesn't actually read
 * the audio — radio streams + WKWebView CORS makes Web Audio analyser
 * unreliable enough that we'd rather have a clean canned animation than
 * a "sometimes reactive, sometimes flat" hybrid.
 */

import { el } from "./dom"

export type EqMode = "idle" | "connecting" | "playing"

export type EqGlyph = {
  root: HTMLElement
  setMode: (mode: EqMode) => void
  dispose: () => void
}

export function createEqGlyph(initialMode: EqMode = "idle"): EqGlyph {
  const root = el("span", { class: "wr-eq", "aria-hidden": "true" })
  for (let i = 0; i < 3; i++) root.appendChild(el("span"))

  function applyClass(mode: EqMode) {
    root.classList.toggle("is-idle", mode === "idle")
    root.classList.toggle("is-connecting", mode === "connecting")
    // "playing" is the default class-less state — CSS animation runs by default
  }

  applyClass(initialMode)

  return {
    root,
    setMode(next: EqMode) {
      applyClass(next)
    },
    dispose() {
      // Nothing to clean up — purely declarative.
    },
  }
}
