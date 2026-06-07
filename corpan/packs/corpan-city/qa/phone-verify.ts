/**
 * Standalone phone-verify harness — mounts the Phone (FAB + sheet) over a faux
 * world with a MOCK city radio so we can eyeball the chrome (ear FAB, music tab,
 * station browser, responsiveness) without booting Babylon. Driven by
 * `qa/phone-verify.mjs`.
 */
import "../src/styles.css"
import { createPhoneSheet, createPhoneFab, createInventoryApp, createMusicApp } from "../src/shell/phone"
import { createInventorySection } from "../src/inventory/inventoryPanel"
import { inventory } from "../src/economy/inventory"
import type { CityRadio, RadioChannel, RadioState } from "../src/audio/cityRadio"

// Seed the wallet/bag so the Things tab has something to show.
const inv = inventory()
inv.addCoins(1840)
inv.credit("jpy-yen", 3000)

// A mock radio that satisfies the CityRadio control seam (no real audio).
function mockRadio(): CityRadio {
  const stations: RadioChannel[] = [
    { id: "groovesalad", name: "SomaFM · Groove Salad", url: "x" },
    { id: "dronezone", name: "SomaFM · Drone Zone", url: "x" },
    { id: "radioparadise", name: "Radio Paradise (eclectic)", url: "x" },
  ]
  let idx = 0
  let playing = true
  let volume = 0.5
  let ducked = false
  let now = "Tycho — Awake"
  const subs = new Set<(s: RadioState) => void>()
  const snap = (): RadioState => ({
    mode: "webaudio",
    playing,
    channel: stations[idx],
    nowPlaying: playing ? now : null,
    volume,
    ducked,
  })
  const emit = () => subs.forEach((f) => f(snap()))
  const at = (i: number) => {
    idx = ((i % stations.length) + stations.length) % stations.length
    now = `${stations[idx].name.split("·").pop()?.trim()} — live set`
    playing = true
    emit()
  }
  return {
    start: async () => at(0),
    play: async (ch) => at(stations.findIndex((s) => s.id === ch.id)),
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
    next: async () => at(idx + 1),
    prev: async () => at(idx - 1),
    playIndex: async (i) => at(i),
    channels: () => stations,
    setVolume: (v) => {
      volume = Math.max(0, Math.min(1, v))
      emit()
    },
    mode: () => "webaudio",
    duck: () => {
      ducked = true
      emit()
    },
    unduck: () => {
      ducked = false
      emit()
    },
    getState: snap,
    subscribe: (f) => {
      subs.add(f)
      f(snap())
      return () => subs.delete(f)
    },
    dispose: () => subs.clear(),
  }
}

const overlay = document.getElementById("overlay")!
const radio = mockRadio()

const section = createInventorySection({
  store: inv,
  accent: "#c46b4a",
  locale: "en",
})

let fab: ReturnType<typeof createPhoneFab>
const phone = createPhoneSheet({
  overlay,
  accent: "#c46b4a",
  locale: "en",
  apps: [createInventoryApp(section), createMusicApp(() => radio)],
  onOpen: () => fab?.hide(),
  onClose: () => fab?.show(),
})
fab = createPhoneFab({ parent: overlay, accent: "#c46b4a", label: "Phone", onOpen: () => phone.open() })

// Expose to the driver.
;(window as unknown as { __phone: unknown }).__phone = { phone, fab }
