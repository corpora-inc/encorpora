/**
 * musicApp — the Phone's "Music" app: a Now-Playing + transport + station browser
 * over the city radio (`cityRadio`), fronted by an explicit MUSIC ON/OFF switch.
 *
 * Owner direction (world-plaza-onboarding-music-consent): music must NEVER come
 * out of nowhere. So this app does NOT auto-play — it reflects + drives a persisted
 * profile (`musicProfileStore`: {enabled, stationId, volume}). The big switch is
 * the consent: ON starts the chosen station and remembers it; OFF stops it and
 * remembers THAT. Station + volume changes persist too, so a restart resumes the
 * player's exact choice rather than a default blast.
 *
 * Its home-grid ICON is the Corpán brand mark (the all-hearing ear ↔ listening ↔
 * radio). It OWNS no playback logic — it drives the `CityRadio` handle and writes
 * the profile; it SUBSCRIBES to the radio's reactive state so the Now-Playing
 * label, transport icon, volume slider, and current-station highlight stay
 * truthful (incl. the live ICY title on device).
 *
 * Single-language safe + no-radio safe: when `mode === "unavailable"` it shows a
 * quiet dignified line, never a dead end. Every catch logs (never silent).
 */

import type { PhoneApp, PhoneAppContext, PhoneAppInstance, PhoneT } from "./phoneApp"
import type { CityRadio, RadioState, RadioChannel } from "../../audio/cityRadio"
import type { MusicProfileStore } from "../../audio/musicProfile"
import { corpanMarkTile } from "./appIcons"

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

export interface MusicAppDeps {
  /** Read LAZILY — `cityRadio` probes async at boot, so a slightly-late handle still wires up. */
  getRadio: () => CityRadio | null
  /** The persisted {enabled, stationId, volume} the switch reflects + writes. */
  profile: MusicProfileStore
}

/** Build the Music Phone app (icon = the Corpán brand mark). */
export function createMusicApp(deps: MusicAppDeps): PhoneApp {
  return {
    id: "music",
    title: (t) => t("phone.tab.music"),
    // The Music tile carries the brand mark on a terracotta squircle (the signature
    // app) — same jewel-tile treatment as the other icons (PHONE_DESIGN §5.2).
    icon: corpanMarkTile(),
    mount(body, ctx: PhoneAppContext): PhoneAppInstance {
      return mountMusic(body, ctx, deps)
    },
  }
}

function mountMusic(body: HTMLElement, ctx: PhoneAppContext, deps: MusicAppDeps): PhoneAppInstance {
  const t: PhoneT = ctx.t
  const { profile } = deps

  const radio = (): CityRadio | null => {
    try {
      return deps.getRadio()
    } catch (err) {
      console.error(`${LOG} getRadio threw:`, err)
      return null
    }
  }

  const root = elt("div", "wp-phone-music")
  body.appendChild(root)

  /* ── Consent switch: MUSIC ON / OFF ──────────────────────────────────────── */
  const switchRow = elt("div", "wp-phone-music-switch")
  const switchText = elt("div", "wp-phone-music-switch-text")
  const switchTitle = elt("div", "wp-phone-music-switch-title")
  const switchSub = elt("div", "wp-phone-music-switch-sub")
  switchText.append(switchTitle, switchSub)
  const toggle = document.createElement("button")
  toggle.type = "button"
  toggle.className = "wp-phone-switch"
  toggle.setAttribute("role", "switch")
  const knob = elt("span", "wp-phone-switch-knob")
  toggle.append(knob)
  switchRow.append(switchText, toggle)

  // Now-playing card — a real "Now Playing" screen: album-art-sized artwork (the
  // brand mark on a terracotta wash) over the labels (PHONE_DESIGN §7).
  const nowCard = elt("div", "wp-phone-now")
  const nowArt = elt("div", "wp-phone-now-art")
  nowArt.innerHTML = corpanMarkTile()
  const nowMeta = elt("div", "wp-phone-now-meta")
  const nowLabel = elt("div", "wp-phone-now-label")
  const nowTitle = elt("div", "wp-phone-now-title")
  const nowStation = elt("div", "wp-phone-now-station")
  const nowDuck = elt("div", "wp-phone-now-duck")
  nowMeta.append(nowLabel, nowTitle, nowStation, nowDuck)
  nowCard.append(nowArt, nowMeta)

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

  // The transport + browser live in one block we hide while music is OFF.
  const player = elt("div", "wp-phone-music-player")
  player.append(nowCard, transport, volRow, stationsHeading, stations)

  // Unavailable line (no audio path at all).
  const unavailable = elt("div", "wp-phone-empty")

  /* ── Helpers ─────────────────────────────────────────────────────────────── */
  const stationById = (id: string | null): RadioChannel | null => {
    if (!id) return null
    return radio()?.channels().find((c) => c.id === id) ?? null
  }

  // Guarded radio actions (never silent).
  const withRadio = (fn: (r: CityRadio) => unknown, what: string): void => {
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

  /** Turn music ON: persist consent + (re)start the chosen station at the saved volume. */
  const enableMusic = () => {
    profile.set({ enabled: true })
    withRadio((r) => {
      r.setVolume(profile.get().volume)
      const ch = stationById(profile.get().stationId)
      return ch ? r.play(ch) : r.start()
    }, "enable")
  }
  /** Turn music OFF: persist + stop playback (the deliberate, remembered "off"). */
  const disableMusic = () => {
    profile.set({ enabled: false })
    withRadio((r) => r.stop(), "disable")
  }

  toggle.addEventListener("click", () => {
    if (profile.get().enabled) disableMusic()
    else enableMusic()
  })

  btnPlay.addEventListener("click", () => {
    // The big transport toggles play/pause but NEVER turns the feature off — the
    // switch owns consent. Pausing keeps `enabled` true (you tuned in, just paused).
    if (!profile.get().enabled) {
      enableMusic()
      return
    }
    withRadio((r) => r.toggle(), "toggle")
  })
  btnPrev.addEventListener("click", () => {
    withRadio((r) => r.prev(), "prev")
    persistStationSoon()
  })
  btnNext.addEventListener("click", () => {
    withRadio((r) => r.next(), "next")
    persistStationSoon()
  })
  volInput.addEventListener("input", () => {
    const v = Number(volInput.value) / 100
    profile.set({ volume: v })
    withRadio((r) => r.setVolume(v), "setVolume")
  })

  // prev/next change the dial via the radio; read the resulting station back off
  // the next emitted state and persist it (so a restart resumes the same dial).
  let pendingStationPersist = false
  const persistStationSoon = () => {
    pendingStationPersist = true
  }

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
      btn.addEventListener("click", () => {
        // Picking a station IS opting in (and the remembered station + ON state).
        profile.set({ enabled: true, stationId: ch.id })
        withRadio((rr) => rr.play(ch), `play ${ch.id}`)
      })
      stations.append(btn)
    }
  }

  const render = (state: RadioState | null) => {
    const enabled = profile.get().enabled

    // Switch chrome (always present, even when unavailable, so the choice is clear).
    switchTitle.textContent = t("phone.music.title")
    switchSub.textContent = enabled ? t("phone.music.on") : t("phone.music.off")
    toggle.setAttribute("aria-checked", String(enabled))
    toggle.setAttribute("aria-label", t("phone.music.toggle"))
    toggle.classList.toggle("wp-phone-switch--on", enabled)

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
      root.replaceChildren(switchRow, unavailable)
      return
    }

    // While OFF, hide the player chrome entirely — a calm "music is off" state with
    // just the switch (so the world is silent until the player opts in).
    if (!enabled) {
      root.replaceChildren(switchRow)
      return
    }

    // Persist the station the dial landed on after a prev/next step.
    if (pendingStationPersist && state.channel) {
      pendingStationPersist = false
      profile.set({ stationId: state.channel.id })
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
    root.replaceChildren(switchRow, player)
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
  // Also re-render if the profile changes from elsewhere (defensive; mostly self-driven).
  const unsubProfile = profile.subscribe(() => render(radio()?.getState() ?? null))

  return {
    dispose() {
      try {
        unsub?.()
      } catch (err) {
        console.error(`${LOG} unsubscribe failed:`, err)
      }
      try {
        unsubProfile()
      } catch (err) {
        console.error(`${LOG} profile unsubscribe failed:`, err)
      }
      root.remove()
    },
  }
}
