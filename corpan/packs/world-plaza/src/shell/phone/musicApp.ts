/**
 * musicApp — the Phone's "Music" app: a Now-Playing + transport + station browser
 * over the city radio (`cityRadio`). It OWNS no playback logic — it drives the
 * `CityRadio` handle (toggle / next / prev / play / setVolume) and SUBSCRIBES to
 * its reactive state so the Now-Playing label, transport icon, volume slider, and
 * current-station highlight stay truthful (incl. the live ICY title on device).
 *
 * Single-language safe + no-radio safe: when `mode === "unavailable"` it shows a
 * quiet dignified line, never a dead end. Every catch logs (never silent).
 */

import type { PhoneApp, PhoneAppContext, PhoneAppInstance, PhoneT } from "./phoneApp"
import type { CityRadio, RadioState } from "../../audio/cityRadio"

const LOG = "[wp/phone/musicApp]"

/* Inline SVG transport glyphs (fill/stroke currentColor → inherit accent/ink). */
const ICON_PLAY =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>'
const ICON_PAUSE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>'
const ICON_PREV =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6a1 1 0 0 1 2 0v12a1 1 0 0 1-2 0V6z"/><path d="M19 5.4v13.2a1 1 0 0 1-1.55.83l-8.2-6.6a1 1 0 0 1 0-1.66l8.2-6.6A1 1 0 0 1 19 5.4z"/></svg>'
const ICON_NEXT =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 6a1 1 0 0 0-2 0v12a1 1 0 0 0 2 0V6z"/><path d="M5 5.4v13.2a1 1 0 0 0 1.55.83l8.2-6.6a1 1 0 0 0 0-1.66l-8.2-6.6A1 1 0 0 0 5 5.4z"/></svg>'
const ICON_VOL =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>'

function elt(tag: string, cls?: string): HTMLElement {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  return n
}

/**
 * Build the Music Phone app. `getRadio` is read LAZILY on mount so a slightly-late
 * radio handle (it probes async at boot) still wires up when the phone opens.
 */
export function createMusicApp(getRadio: () => CityRadio | null): PhoneApp {
  return {
    id: "music",
    tabLabel: (t) => t("phone.tab.music"),
    mount(body, ctx: PhoneAppContext): PhoneAppInstance {
      return mountMusic(body, ctx, getRadio)
    },
  }
}

function mountMusic(
  body: HTMLElement,
  ctx: PhoneAppContext,
  getRadio: () => CityRadio | null,
): PhoneAppInstance {
  const t: PhoneT = ctx.t

  const radio = (): CityRadio | null => {
    try {
      return getRadio()
    } catch (err) {
      console.error(`${LOG} getRadio threw:`, err)
      return null
    }
  }

  const root = elt("div", "wp-phone-music")
  body.appendChild(root)

  // Now-playing card.
  const nowCard = elt("div", "wp-phone-now")
  const nowLabel = elt("div", "wp-phone-now-label")
  const nowTitle = elt("div", "wp-phone-now-title")
  const nowStation = elt("div", "wp-phone-now-station")
  const nowDuck = elt("div", "wp-phone-now-duck")
  nowCard.append(nowLabel, nowTitle, nowStation, nowDuck)

  // Transport row.
  const transport = elt("div", "wp-phone-transport")
  const btnPrev = document.createElement("button")
  btnPrev.type = "button"
  btnPrev.className = "wp-phone-tbtn"
  btnPrev.innerHTML = ICON_PREV
  const btnPlay = document.createElement("button")
  btnPlay.type = "button"
  btnPlay.className = "wp-phone-tbtn wp-phone-tbtn--play"
  const btnNext = document.createElement("button")
  btnNext.type = "button"
  btnNext.className = "wp-phone-tbtn"
  btnNext.innerHTML = ICON_NEXT
  transport.append(btnPrev, btnPlay, btnNext)

  // Volume row.
  const volRow = elt("div", "wp-phone-volume")
  const volIcon = elt("div", "wp-phone-volume-icon")
  volIcon.innerHTML = ICON_VOL
  const volInput = document.createElement("input")
  volInput.type = "range"
  volInput.min = "0"
  volInput.max = "100"
  volInput.step = "1"
  volRow.append(volIcon, volInput)

  // Station browser.
  const stationsHeading = elt("div", "wp-phone-music-heading")
  const stations = elt("div", "wp-phone-stations")

  // Unavailable line (no audio path at all).
  const unavailable = elt("div", "wp-phone-empty")

  // Guarded transport handlers (never silent).
  const guard = (fn: (r: CityRadio) => unknown, what: string) => () => {
    const r = radio()
    if (!r) {
      console.warn(`${LOG} ${what}: no radio handle yet`)
      return
    }
    try {
      void fn(r)
    } catch (err) {
      console.error(`${LOG} ${what} failed:`, err)
    }
  }
  btnPlay.addEventListener("click", guard((r) => r.toggle(), "toggle"))
  btnPrev.addEventListener("click", guard((r) => r.prev(), "prev"))
  btnNext.addEventListener("click", guard((r) => r.next(), "next"))
  volInput.addEventListener("input", () => {
    const r = radio()
    if (!r) return
    try {
      r.setVolume(Number(volInput.value) / 100)
    } catch (err) {
      console.error(`${LOG} setVolume failed:`, err)
    }
  })

  const renderStations = (state: RadioState) => {
    const r = radio()
    const list = r?.channels() ?? []
    stations.replaceChildren()
    for (const ch of list) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "wp-phone-station"
      btn.setAttribute("aria-current", String(state.channel?.id === ch.id))
      const dot = elt("span", "wp-phone-station-dot")
      dot.setAttribute("aria-hidden", "true")
      const name = elt("span", "wp-phone-station-name")
      name.textContent = ch.name
      btn.append(dot, name)
      btn.addEventListener(
        "click",
        guard((rr) => rr.play(ch), `play ${ch.id}`),
      )
      stations.append(btn)
    }
  }

  const render = (state: RadioState | null) => {
    // Static labels.
    stationsHeading.textContent = t("phone.music.browse")
    nowLabel.textContent = t("phone.music.nowPlaying")
    const playing = state?.playing ?? false
    btnPlay.setAttribute("aria-label", t(playing ? "phone.music.pause" : "phone.music.play"))
    btnPlay.title = btnPlay.getAttribute("aria-label") ?? ""
    btnPlay.innerHTML = playing ? ICON_PAUSE : ICON_PLAY
    btnPrev.setAttribute("aria-label", t("phone.music.prev"))
    btnNext.setAttribute("aria-label", t("phone.music.next"))
    volInput.setAttribute("aria-label", t("phone.music.volume"))

    if (!state || state.mode === "unavailable") {
      unavailable.textContent = t("phone.music.unavailable")
      root.replaceChildren(unavailable)
      return
    }

    // Now-playing: ICY title when present, else the quiet "Live stream" line; the
    // station name sits under it. When stopped, one calm "radio is off" line.
    if (state.playing) {
      nowTitle.textContent = state.nowPlaying || t("phone.music.offAir")
      nowStation.textContent = state.channel?.name ?? ""
      nowStation.style.display = ""
    } else {
      nowTitle.textContent = t("phone.music.silent")
      nowStation.style.display = "none"
    }
    nowDuck.textContent = state.ducked ? t("phone.music.ducked") : ""
    nowDuck.style.display = state.ducked ? "" : "none"

    // Volume reflects the USER volume (not the ducked value). Don't stomp the
    // slider while the user is actively dragging it.
    if (document.activeElement !== volInput) {
      volInput.value = String(Math.round(state.volume * 100))
    }

    renderStations(state)
    root.replaceChildren(nowCard, transport, volRow, stationsHeading, stations)
  }

  // Subscribe (fires immediately) → live Now-Playing; fall back to a one-shot
  // render if there's no radio handle yet.
  let unsub: (() => void) | null = null
  const r = radio()
  if (r) {
    try {
      unsub = r.subscribe(render)
    } catch (err) {
      console.error(`${LOG} subscribe failed:`, err)
      render(null)
    }
  } else {
    render(null)
  }

  return {
    dispose() {
      try {
        unsub?.()
      } catch (err) {
        console.error(`${LOG} unsubscribe failed:`, err)
      }
      root.remove()
    },
  }
}
