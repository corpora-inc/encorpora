/**
 * cityRadio — PROOF OF CONCEPT in-game radio for Corpan City.
 *
 * The simplest possible "can we stream a radio station inside the game?" probe,
 * built to be audible on ALL targets so the owner can test the radio-vs-TTS
 * audio-session interaction live on device:
 *   - iOS / Android  → the native `tauri-plugin-radio-stream` (ExoPlayer/AVPlayer,
 *     background + lock-screen, the SAME path the audiobook readers use).
 *   - Desktop (no native plugin) → a plain WebView `<audio>` element.
 *
 * Deliberately NOT in scope yet (deferred until the POC proves out on device):
 *   - software ducking under NPC TTS
 *   - the in-inventory "phone" UI + station browser
 *   - "Corpan City FM" original-track bundling/looping
 *
 * SINGLE INSTANCE (the "hum builds up" lesson, see soundscape.ts): only one radio
 * may ever play. We tear down any prior instance via a global slot — mirrors the
 * `__wpLiveGame` guard in main.ts — so HMR re-eval / re-mount can't stack two
 * native streams or duplicate event listeners.
 *
 * Console handle for on-device testing (CDP): `__cityRadio.start()`, `.stop()`,
 * `.setVolume(0.3)`, `.playStation(1)`, `.play(url, name)`, `.mode()`.
 */

import {
  probeNativeRadio,
  radioPlay,
  radioStop,
  radioSetVolume,
  listenForRadioEvents,
  type RadioStateChange,
} from "@shared/audio/nativeRadio"

const LOG = "[wp/cityRadio]"

export interface RadioChannel {
  id: string
  name: string
  url: string
}

/**
 * POC stations: free, no-auth icecast/mp3 streams that play through the native
 * player on mobile AND a WebView `<audio>` element on desktop. The first is the
 * default channel. "Corpan City FM" (our original tracks, hosted or bundled +
 * looped) replaces the default once the on-device proof-of-concept passes.
 */
export const POC_STATIONS: RadioChannel[] = [
  // CURATED, AD-FREE dial. SomaFM is listener-supported & commercial-free by
  // mission (no ad spots, no station-ID breaks) — its ~30 channels give us a
  // diverse ad-free backbone. Radio Paradise is also listener-supported/ad-free.
  // (The open radio-browser catalog is full of ad-laden stations, so we curate
  // rather than open-search.) TODO: add the Bangla al-Quran station once we have
  // its stream URL (owner confirms it's ad-free / no station ID).
  { id: "groovesalad", name: "SomaFM · Groove Salad", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
  { id: "dronezone", name: "SomaFM · Drone Zone", url: "https://ice1.somafm.com/dronezone-128-mp3" },
  { id: "lush", name: "SomaFM · Lush", url: "https://ice1.somafm.com/lush-128-mp3" },
  { id: "indiepop", name: "SomaFM · Indie Pop Rocks", url: "https://ice1.somafm.com/indiepop-128-mp3" },
  { id: "beatblender", name: "SomaFM · Beat Blender", url: "https://ice1.somafm.com/beatblender-128-mp3" },
  { id: "secretagent", name: "SomaFM · Secret Agent", url: "https://ice1.somafm.com/secretagent-128-mp3" },
  { id: "u80s", name: "SomaFM · Underground 80s", url: "https://ice1.somafm.com/u80s-128-mp3" },
  { id: "bootliquor", name: "SomaFM · Boot Liquor", url: "https://ice1.somafm.com/bootliquor-128-mp3" },
  { id: "seventies", name: "SomaFM · Left Coast 70s", url: "https://ice1.somafm.com/seventies-128-mp3" },
  { id: "fluid", name: "SomaFM · Fluid", url: "https://ice1.somafm.com/fluid-128-mp3" },
  { id: "poptron", name: "SomaFM · PopTron", url: "https://ice1.somafm.com/poptron-128-mp3" },
  { id: "sonicuniverse", name: "SomaFM · Sonic Universe (jazz)", url: "https://ice1.somafm.com/sonicuniverse-128-mp3" },
  { id: "deepspaceone", name: "SomaFM · Deep Space One", url: "https://ice1.somafm.com/deepspaceone-128-mp3" },
  { id: "spacestation", name: "SomaFM · Space Station", url: "https://ice1.somafm.com/spacestation-128-mp3" },
  { id: "radioparadise", name: "Radio Paradise (eclectic)", url: "https://stream.radioparadise.com/mp3-192" },
]

export type RadioMode = "native" | "webaudio" | "unavailable"

export interface CityRadio {
  /** Play the default channel. */
  start: () => Promise<void>
  /** Play a specific channel (stops whatever is playing). */
  play: (channel: RadioChannel) => Promise<void>
  /** Stop playback. */
  stop: () => Promise<void>
  /** 0..1 (clamped). */
  setVolume: (v: number) => void
  /** Where playback is routed on this platform. */
  mode: () => RadioMode
  /** Stop + release; also clears the global single-instance slot. */
  dispose: () => void
}

const clamp = (v: number): number => Math.max(0, Math.min(1, v))

interface Slot {
  current?: CityRadio
}
const slot: Slot = ((globalThis as unknown as { __wpCityRadioSlot?: Slot }).__wpCityRadioSlot ??= {})

export async function createCityRadio(opts: { volume?: number } = {}): Promise<CityRadio> {
  // Single-instance: never stack two streams (HMR / re-mount → the "hum" failure).
  slot.current?.dispose()

  let volume = clamp(opts.volume ?? 0.5)
  let disposed = false
  let unlisten: (() => void) | null = null
  let el: HTMLAudioElement | null = null

  const native = await probeNativeRadio()
  const mode: RadioMode = native ? "native" : typeof Audio !== "undefined" ? "webaudio" : "unavailable"
  console.info(`${LOG} mode=${mode} (native plugin ${native ? "present" : "absent"})`)

  if (native) {
    // Surface state + interruptions loudly — interruptions are exactly the
    // radio-vs-TTS signal we want to read in the device logs.
    unlisten = listenForRadioEvents({
      onState: (s: RadioStateChange) => console.info(`${LOG} state=${s.kind}${s.message ? " — " + s.message : ""}`),
      onInterruption: (i) => console.info(`${LOG} interruption began=${i.began} shouldResume=${i.shouldResume}`),
    })
  }

  const play = async (ch: RadioChannel): Promise<void> => {
    if (disposed) return
    try {
      if (mode === "native") {
        await radioPlay({ url: ch.url, stationName: ch.name })
        await radioSetVolume(volume)
      } else if (mode === "webaudio") {
        // NB: do NOT set crossOrigin — most icecast streams send no CORS headers,
        // and crossOrigin="anonymous" would then BLOCK playback. We only need to
        // hear it, not process samples.
        if (!el) {
          el = new Audio()
          el.preload = "none"
        }
        el.src = ch.url
        el.volume = volume
        await el.play()
      }
      console.info(`${LOG} playing "${ch.name}" @ vol ${volume.toFixed(2)}`)
    } catch (e) {
      console.error(`${LOG} play failed ("${ch.name}"):`, e)
    }
  }

  const api: CityRadio = {
    mode: () => mode,
    start: () => play(POC_STATIONS[0]),
    play,
    stop: async () => {
      if (mode === "native") await radioStop()
      el?.pause()
    },
    setVolume: (v: number) => {
      volume = clamp(v)
      if (mode === "native") void radioSetVolume(volume)
      if (el) el.volume = volume
    },
    dispose: () => {
      disposed = true
      unlisten?.()
      unlisten = null
      if (mode === "native") void radioStop()
      if (el) {
        el.pause()
        el.src = ""
        el = null
      }
      if (slot.current === api) slot.current = undefined
    },
  }
  slot.current = api

  // On-device console handle (CDP): poke the radio without rebuilding.
  ;(globalThis as unknown as { __cityRadio?: unknown }).__cityRadio = {
    start: api.start,
    stop: api.stop,
    setVolume: api.setVolume,
    mode: api.mode,
    stations: POC_STATIONS,
    playStation: (i: number) => play(POC_STATIONS[i] ?? POC_STATIONS[0]),
    play: (url: string, name = "custom") => play({ id: "custom", name, url }),
  }

  return api
}
