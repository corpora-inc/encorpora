/**
 * Persistent bottom player bar.
 *
 * Idle: hidden. As soon as the user picks a station, slides up.
 * States: loading (spinner), playing (pause btn), paused (play btn), error (banner).
 */

import { el, clear } from "../ui/dom"
import { ICON_PAUSE, ICON_PLAY, ICON_SPINNER } from "../ui/icons"
import type { PlayerState, RadioPlayer } from "../audio/radioPlayer"

export type PlayerBarView = {
  root: HTMLElement
  dispose: () => void
}

export function createPlayerBar(player: RadioPlayer): PlayerBarView {
  const root = el("footer", { class: "wr-player", "aria-hidden": "true" })

  const button = el("button", {
    class: "wr-player-btn",
    type: "button",
    "aria-label": "Play",
  })
  button.addEventListener("click", () => {
    const state = player.getState()
    if (state.kind === "playing" || state.kind === "loading") {
      player.pause()
    } else if (state.kind === "paused") {
      void player.resume()
    }
  })

  const meta = el("div", { class: "wr-player-meta" })
  const title = el("div", { class: "wr-player-title" }, ["—"])
  const sub = el("div", { class: "wr-player-sub" }, [""])
  meta.appendChild(title)
  meta.appendChild(sub)

  const volume = el("input", {
    class: "wr-volume",
    type: "range",
    min: "0",
    max: "100",
    step: "1",
    value: String(Math.round(player.getVolume() * 100)),
    "aria-label": "Volume",
  }) as HTMLInputElement
  volume.addEventListener("input", () => {
    player.setVolume(Number(volume.value) / 100)
  })

  root.appendChild(button)
  root.appendChild(meta)
  root.appendChild(volume)

  function render(state: PlayerState) {
    if (state.kind === "idle") {
      root.setAttribute("aria-hidden", "true")
      root.classList.remove("is-active")
      return
    }
    root.removeAttribute("aria-hidden")
    root.classList.add("is-active")

    const station = "station" in state ? state.station : null
    title.textContent = station?.name ?? "—"

    if (state.kind === "loading") {
      clear(button)
      button.innerHTML = ICON_SPINNER
      button.setAttribute("aria-label", "Loading")
      sub.textContent = "Connecting…"
    } else if (state.kind === "playing") {
      clear(button)
      button.innerHTML = ICON_PAUSE
      button.setAttribute("aria-label", "Pause")
      sub.textContent = stationLine(state.station)
    } else if (state.kind === "paused") {
      clear(button)
      button.innerHTML = ICON_PLAY
      button.setAttribute("aria-label", "Play")
      sub.textContent = stationLine(state.station)
    } else if (state.kind === "error") {
      clear(button)
      button.innerHTML = ICON_PLAY
      button.setAttribute("aria-label", "Retry")
      sub.textContent = `Error: ${state.message}`
      sub.classList.add("wr-player-sub--error")
      return
    }
    sub.classList.remove("wr-player-sub--error")
  }

  const unsub = player.subscribe(render)

  return {
    root,
    dispose() {
      unsub()
      root.remove()
    },
  }
}

function stationLine(s: { country: string; codec: string; bitrate: number; language: string }): string {
  const parts: string[] = []
  if (s.country) parts.push(s.country)
  if (s.codec) parts.push(s.codec.toUpperCase())
  if (s.bitrate > 0) parts.push(`${s.bitrate} kbps`)
  return parts.join(" · ")
}
