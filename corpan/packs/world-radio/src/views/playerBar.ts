/**
 * Persistent bottom player bar.
 *
 * 56px station artwork on the left, then play button, meta column, volume.
 * EQ glyph next to the title when playing. Tap meta column → onMetaTap so
 * the parent can navigate to that station's language detail.
 *
 * When the native streaming plugin is active (iOS/Android), the player also
 * surfaces ICY/Shoutcast `StreamTitle` updates as a subtle marquee strip
 * under the station name. Browser-dev mode never has this metadata, so the
 * strip is hidden there.
 */

import { el, clear } from "../ui/dom"
import { ICON_PAUSE, ICON_PLAY, ICON_SPINNER } from "../ui/icons"
import { createStationArt } from "../ui/stationArt"
import { createEqGlyph } from "../ui/eqGlyph"
import { countryCodeToFlag } from "../ui/flagEmoji"
import type { IcyInfo, PlayerState, RadioPlayer } from "../audio/radioPlayer"
import type { RadioStation } from "../api/radioBrowser"

export type PlayerBarView = {
  root: HTMLElement
  dispose: () => void
}

export function createPlayerBar(player: RadioPlayer, opts: {
  onMetaTap?: (station: RadioStation) => void
} = {}): PlayerBarView {
  const root = el("footer", { class: "wr-player", "aria-hidden": "true" })

  // Artwork slot — recreated on station change so the gradient hue updates.
  const artSlot = el("div", { class: "wr-player-art" })
  let artUuid: string | null = null

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
    } else if (state.kind === "error") {
      void player.play(state.station)
    }
  })

  const meta = el("div", { class: "wr-player-meta", role: "button", tabindex: "0" })
  const titleRow = el("div", { class: "wr-player-title" })
  const eq = createEqGlyph("idle")
  titleRow.appendChild(eq.root)
  const titleText = el("span", { class: "wr-player-title-text", dir: "ltr" }, ["—"])
  titleRow.appendChild(titleText)
  // ICY now-playing strip — hidden until the native plugin surfaces a
  // StreamTitle. Inside is a single moving span so we can fade-replace its
  // text on track changes (CSS handles the marquee on overflow).
  const icyStrip = el("div", { class: "wr-player-icy", "aria-live": "polite" })
  icyStrip.style.display = "none"
  const icyText = el("span", { class: "wr-player-icy-text" })
  icyStrip.appendChild(icyText)
  const sub = el("div", { class: "wr-player-sub" }, [""])
  meta.appendChild(titleRow)
  meta.appendChild(icyStrip)
  meta.appendChild(sub)

  let lastStation: RadioStation | null = null
  meta.addEventListener("click", () => {
    if (lastStation) opts.onMetaTap?.(lastStation)
  })
  meta.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault()
      if (lastStation) opts.onMetaTap?.(lastStation)
    }
  })

  // No in-app volume slider — device hardware volume is more ergonomic and
  // gives the title/meta column the space it deserves on phone widths.

  root.appendChild(artSlot)
  root.appendChild(button)
  root.appendChild(meta)

  function setArt(station: RadioStation) {
    if (artUuid === station.stationuuid) return
    artUuid = station.stationuuid
    clear(artSlot)
    artSlot.appendChild(createStationArt(station, 56))
  }

  function clearArt() {
    artUuid = null
    clear(artSlot)
  }

  function render(state: PlayerState) {
    if (state.kind === "idle") {
      root.setAttribute("aria-hidden", "true")
      root.classList.remove("is-active")
      lastStation = null
      eq.setMode("idle")
      clearArt()
      return
    }
    root.removeAttribute("aria-hidden")
    root.classList.add("is-active")

    const station = "station" in state ? state.station : null
    if (station) {
      lastStation = station
      setArt(station)
      titleText.textContent = station.name || "Unknown station"
    }

    if (state.kind === "loading") {
      clear(button)
      button.innerHTML = ICON_SPINNER
      button.setAttribute("aria-label", "Loading")
      sub.textContent = "Connecting…"
      eq.setMode("connecting")
    } else if (state.kind === "playing") {
      clear(button)
      button.innerHTML = ICON_PAUSE
      button.setAttribute("aria-label", "Pause")
      sub.textContent = stationLine(state.station)
      eq.setMode("playing")
    } else if (state.kind === "paused") {
      clear(button)
      button.innerHTML = ICON_PLAY
      button.setAttribute("aria-label", "Play")
      sub.textContent = stationLine(state.station)
      eq.setMode("idle")
    } else if (state.kind === "error") {
      clear(button)
      button.innerHTML = ICON_PLAY
      button.setAttribute("aria-label", "Retry")
      sub.textContent = `Couldn't play: ${state.message}`
      sub.classList.add("wr-player-sub--error")
      eq.setMode("idle")
      return
    }
    sub.classList.remove("wr-player-sub--error")
  }

  const unsub = player.subscribe(render)

  let lastIcyTitle: string | null = null
  function renderIcy(info: IcyInfo) {
    const title = info.title?.trim() || ""
    if (!title) {
      icyStrip.style.display = "none"
      icyText.textContent = ""
      lastIcyTitle = null
      return
    }
    if (title === lastIcyTitle) return
    lastIcyTitle = title
    icyStrip.style.display = ""
    // Brief fade so the text change feels intentional, not jittery. CSS
    // handles the actual transition; we just toggle a class.
    icyStrip.classList.remove("is-fresh")
    // Force a layout flush so the animation restarts on every change.
    void icyStrip.offsetWidth
    icyText.textContent = title
    icyStrip.classList.add("is-fresh")
  }
  const unsubIcy = player.subscribeIcy(renderIcy)

  return {
    root,
    dispose() {
      unsub()
      unsubIcy()
      eq.dispose()
      root.remove()
    },
  }
}

function stationLine(s: RadioStation): string {
  const parts: string[] = []
  const flag = countryCodeToFlag(s.countrycode)
  if (flag) parts.push(flag)
  if (s.country) parts.push(s.country)
  if (s.codec) parts.push(s.codec.toUpperCase())
  if (s.bitrate > 0) parts.push(`${s.bitrate} kbps`)
  return parts.join(" · ")
}
