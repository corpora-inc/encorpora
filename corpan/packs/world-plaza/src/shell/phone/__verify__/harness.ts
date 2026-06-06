/**
 * Standalone verification harness for the PHONE simulator (NOT shipped). It mounts
 * the REAL `createPhoneSheet` + `createPhoneFab` with stub apps (Map / Things /
 * Quest / Badges + the real Music app over a mock radio) inside a real
 * `.wp-overlay`, so a headless WebKit driver can screenshot the home grid, an open
 * app, and the Music app's on/off switch at phone / tablet / desktop widths.
 *
 * No Babylon, no host — DOM only. `window.__wpPhone` exposes open/openApp/close so
 * the driver can flip screens. `?dir=rtl` mirrors the root for the RTL check.
 */

import { createPhoneSheet, createPhoneFab, createSectionApp, createMusicApp, APP_ICONS } from "../index"
import type { CityRadio, RadioState } from "../../../audio/cityRadio"
import { createMusicProfileStore } from "../../../audio/musicProfile"

const accent = "#c46b4a"

const root = document.createElement("div")
root.className = "wp-root"
root.style.cssText = "position:fixed;inset:0;background:linear-gradient(160deg,#cfe6ec,#bcd7c9);"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
overlay.style.cssText = "position:absolute;inset:0;z-index:10;"
root.appendChild(overlay)
document.body.appendChild(root)

const params = new URLSearchParams(location.search)
if (params.get("dir") === "rtl") {
  document.documentElement.setAttribute("dir", "rtl")
  overlay.setAttribute("dir", "rtl")
}

/* A stub section: a heading + a few paper rows, so the app screen looks alive. */
const stubSection = (label: string) => (body: HTMLElement) => {
  const wrap = document.createElement("div")
  wrap.style.cssText = "display:flex;flex-direction:column;gap:10px;"
  const h = document.createElement("div")
  h.textContent = label
  h.style.cssText = "font:800 12px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:#9a8868;"
  wrap.appendChild(h)
  for (let i = 0; i < 4; i++) {
    const row = document.createElement("div")
    row.textContent = `${label} item ${i + 1}`
    row.style.cssText =
      "padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.5);border:1px solid rgba(120,100,70,.16);font:600 14px/1.3 system-ui;color:#3a2f25;"
    wrap.appendChild(row)
  }
  body.appendChild(wrap)
  return () => wrap.remove()
}

/* A mock CityRadio so the Music app renders its full UI (switch + transport + dial). */
function mockRadio(): CityRadio {
  const channels = [
    { id: "groovesalad", name: "SomaFM · Groove Salad", url: "" },
    { id: "dronezone", name: "SomaFM · Drone Zone", url: "" },
    { id: "radioparadise", name: "Radio Paradise (eclectic)", url: "" },
  ]
  let playing = false
  let idx = 0
  let volume = 0.5
  const subs = new Set<(s: RadioState) => void>()
  const state = (): RadioState => ({
    mode: "webaudio",
    playing,
    channel: channels[idx],
    nowPlaying: playing ? "Stub Track — Demo Artist" : null,
    volume,
    ducked: false,
  })
  const emit = () => subs.forEach((f) => f(state()))
  const r: Partial<CityRadio> = {
    start: async () => {
      playing = true
      emit()
    },
    play: async (ch) => {
      idx = Math.max(0, channels.findIndex((c) => c.id === ch.id))
      playing = true
      emit()
    },
    stop: async () => {
      playing = false
      emit()
    },
    pause: async () => {
      playing = false
      emit()
    },
    resume: async () => {
      playing = true
      emit()
    },
    toggle: async () => {
      playing = !playing
      emit()
    },
    next: async () => {
      idx = (idx + 1) % channels.length
      emit()
    },
    prev: async () => {
      idx = (idx - 1 + channels.length) % channels.length
      emit()
    },
    playIndex: async () => {},
    channels: () => channels,
    setVolume: (v) => {
      volume = v
      emit()
    },
    mode: () => "webaudio",
    duck: () => {},
    unduck: () => {},
    getState: state,
    subscribe: (fn) => {
      subs.add(fn)
      fn(state())
      return () => subs.delete(fn)
    },
    dispose: () => {},
  }
  return r as CityRadio
}

const radio = mockRadio()
const profile = createMusicProfileStore()

const phone = createPhoneSheet({
  overlay,
  accent,
  locale: "en",
  apps: [
    createSectionApp({ id: "map", titleKey: "phone.tab.map", icon: APP_ICONS.map, section: stubSection("Map") }),
    createSectionApp({ id: "things", titleKey: "phone.tab.things", icon: APP_ICONS.things, section: stubSection("Things") }),
    createSectionApp({ id: "quest", titleKey: "phone.tab.quest", icon: APP_ICONS.quest, section: stubSection("Quest") }),
    createSectionApp({ id: "badges", titleKey: "phone.tab.badges", icon: APP_ICONS.badges, section: stubSection("Badges") }),
    createMusicApp({ getRadio: () => radio, profile }),
  ],
  objective: () => ({ title: "Find the café", done: 2, total: 3, appId: "quest" }),
  onLeave: () => console.log("[verify] leave"),
})

const fab = createPhoneFab({
  parent: overlay,
  accent,
  label: "Phone",
  onOpen: () => phone.open(),
})

;(window as unknown as { __wpPhone: unknown }).__wpPhone = {
  open: (id?: string) => phone.open(id),
  close: () => phone.close(),
  fab,
}
;(window as unknown as { __wpVerifyReady?: boolean }).__wpVerifyReady = true
console.log("[verify] phone harness ready")
