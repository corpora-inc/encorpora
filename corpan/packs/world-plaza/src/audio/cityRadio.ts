/**
 * cityRadio — the in-game radio for Corpan City + the seam the Phone UI drives.
 *
 * Audible on ALL targets so the radio-vs-TTS audio-session interaction works live
 * on device:
 *   - iOS / Android  → the native `tauri-plugin-radio-stream` (ExoPlayer/AVPlayer,
 *     background + lock-screen, the SAME path the audiobook readers use).
 *   - Desktop (no native plugin) → a plain WebView `<audio>` element.
 *
 * NOW WIRED (was deferred — see the Phone UI `src/shell/phone/phoneSheet.ts`):
 *   - software DUCKING under NPC TTS (`duck()`/`unduck()`, ref-counted so two
 *     overlapping speak()s don't fight; volume eases down to ~30% then restores),
 *   - a reactive STATE model + `subscribe()` the Phone's Now-Playing tab reads
 *     (playing/paused, the current channel, the live ICY "now playing" title),
 *   - `pause()`/`resume()`/`next()`/`prev()`/`playIndex()` + `channels()` so the
 *     Phone is a real transport + station browser.
 *
 * Still deferred: "Corpan City FM" original-track bundling/looping.
 *
 * SINGLE INSTANCE (the "hum builds up" lesson, see soundscape.ts): only one radio
 * may ever play. We tear down any prior instance via a global slot — mirrors the
 * `__wpLiveGame` guard in main.ts — so HMR re-eval / re-mount can't stack two
 * native streams or duplicate event listeners.
 *
 * Console handle for on-device testing (CDP): `__cityRadio.start()`, `.stop()`,
 * `.setVolume(0.3)`, `.playStation(1)`, `.play(url, name)`, `.mode()`, `.duck()`.
 */

import {
  probeNativeRadio,
  radioPlay,
  radioStop,
  radioSetVolume,
  listenForRadioEvents,
  type RadioStateChange,
  type RadioIcyMetadata,
} from "../../../shared/audio/nativeRadio"

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

/**
 * The reactive snapshot the Phone's Now-Playing tab renders. Pushed to every
 * `subscribe()` listener whenever anything changes (play/pause, channel switch,
 * volume, a new ICY title, ducking). A pure value object — no DOM, no Babylon.
 */
export interface RadioState {
  /** Where playback is routed on this platform. */
  mode: RadioMode
  /** True while a stream is actively playing (not paused/stopped). */
  playing: boolean
  /** The channel currently selected (the last one `play`/`start` chose). */
  channel: RadioChannel | null
  /** The live "now playing" track title from ICY metadata (native only), if any. */
  nowPlaying: string | null
  /** The base (un-ducked) volume 0..1 the user set. */
  volume: number
  /** True while TTS has ducked the music (volume temporarily lowered). */
  ducked: boolean
}

export interface CityRadio {
  /** Play the default channel. */
  start: () => Promise<void>
  /** Play a specific channel (stops whatever is playing). */
  play: (channel: RadioChannel) => Promise<void>
  /** Stop playback. */
  stop: () => Promise<void>
  /** Pause the current stream (keeps the channel selected; `resume()` resumes it). */
  pause: () => Promise<void>
  /** Resume after `pause()` (or start the selected/default channel if none). */
  resume: () => Promise<void>
  /** Toggle play/pause — the Phone's big transport button. */
  toggle: () => Promise<void>
  /** Advance to the next station in the dial (wraps). */
  next: () => Promise<void>
  /** Step to the previous station in the dial (wraps). */
  prev: () => Promise<void>
  /** Play the station at `index` in `channels()` (clamped/wrapped). */
  playIndex: (index: number) => Promise<void>
  /** The station dial (read-only) the Phone's browser lists. */
  channels: () => readonly RadioChannel[]
  /** 0..1 (clamped). This is the USER volume; ducking layers under it. */
  setVolume: (v: number) => void
  /** Where playback is routed on this platform. */
  mode: () => RadioMode
  /**
   * DUCK the music (lower it to ~30% of the user volume) while an NPC speaks via
   * TTS. Ref-counted: two overlapping speak()s each `duck()` then `unduck()` and
   * the music only restores once the LAST one finishes. Safe to over-call.
   */
  duck: () => void
  /** Release one duck reference; restores the user volume when the count hits 0. */
  unduck: () => void
  /** The current reactive snapshot (for an initial render before the first event). */
  getState: () => RadioState
  /** Subscribe to state changes; returns an unsubscribe. Fires immediately once. */
  subscribe: (fn: (s: RadioState) => void) => () => void
  /** Stop + release; also clears the global single-instance slot. */
  dispose: () => void
}

const clamp = (v: number): number => Math.max(0, Math.min(1, v))

/** How far we drop the music under TTS — 30% of the user volume (the spec's ask). */
const DUCK_FACTOR = 0.3

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

  // Reactive state the Phone's Now-Playing tab renders. `index` tracks the dial
  // position so next/prev wrap; `playing` is the transport state; `nowPlaying` is
  // the live ICY title (native only); `duckDepth` ref-counts overlapping TTS ducks.
  let index = 0
  let playing = false
  let nowPlaying: string | null = null
  let duckDepth = 0

  const native = await probeNativeRadio()
  const mode: RadioMode = native ? "native" : typeof Audio !== "undefined" ? "webaudio" : "unavailable"
  console.info(`${LOG} mode=${mode} (native plugin ${native ? "present" : "absent"})`)

  const listeners = new Set<(s: RadioState) => void>()
  const snapshot = (): RadioState => ({
    mode,
    playing,
    channel: POC_STATIONS[index] ?? null,
    nowPlaying,
    volume,
    ducked: duckDepth > 0,
  })
  const emit = () => {
    const s = snapshot()
    for (const fn of listeners) {
      try {
        fn(s)
      } catch (err) {
        console.error(`${LOG} subscriber threw:`, err)
      }
    }
  }

  // The volume actually sent to the player = user volume, lowered while ducked.
  const effectiveVolume = (): number => (duckDepth > 0 ? volume * DUCK_FACTOR : volume)
  const applyVolume = () => {
    const v = effectiveVolume()
    if (mode === "native") void radioSetVolume(v)
    if (el) el.volume = v
  }

  if (native) {
    // Surface state + interruptions loudly — interruptions are exactly the
    // radio-vs-TTS signal we want to read in the device logs. We also fold the
    // native playing/idle state + ICY "now playing" title into our reactive model
    // so the Phone's transport + Now-Playing label stay truthful on device.
    unlisten = listenForRadioEvents({
      onState: (s: RadioStateChange) => {
        console.info(`${LOG} state=${s.kind}${s.message ? " — " + s.message : ""}`)
        const next = s.kind === "playing" || s.kind === "loading" || s.kind === "buffering"
        if (next !== playing) {
          playing = next
          emit()
        }
      },
      onIcyMetadata: (meta: RadioIcyMetadata) => {
        const title = (meta.streamTitle ?? "").trim() || null
        if (title !== nowPlaying) {
          nowPlaying = title
          emit()
        }
      },
      onInterruption: (i) => console.info(`${LOG} interruption began=${i.began} shouldResume=${i.shouldResume}`),
    })
  }

  const play = async (ch: RadioChannel): Promise<void> => {
    if (disposed) return
    // Track the dial position (so next/prev wrap from here); custom URLs leave the
    // index where it is. A fresh channel clears any stale ICY title.
    const at = POC_STATIONS.findIndex((s) => s.id === ch.id)
    if (at >= 0) index = at
    nowPlaying = null
    try {
      if (mode === "native") {
        await radioPlay({ url: ch.url, stationName: ch.name })
        await radioSetVolume(effectiveVolume())
      } else if (mode === "webaudio") {
        // NB: do NOT set crossOrigin — most icecast streams send no CORS headers,
        // and crossOrigin="anonymous" would then BLOCK playback. We only need to
        // hear it, not process samples.
        if (!el) {
          el = new Audio()
          el.preload = "none"
        }
        el.src = ch.url
        el.volume = effectiveVolume()
        await el.play()
      }
      // Optimistic on web (<audio> has no event wired here); native confirms via
      // onState above, but we flip eagerly so the Phone's button feels instant.
      playing = mode !== "unavailable"
      console.info(`${LOG} playing "${ch.name}" @ vol ${effectiveVolume().toFixed(2)}`)
    } catch (e) {
      playing = false
      console.error(`${LOG} play failed ("${ch.name}"):`, e)
    }
    emit()
  }

  const stop = async (): Promise<void> => {
    if (mode === "native") {
      try {
        await radioStop()
      } catch (e) {
        console.error(`${LOG} stop failed:`, e)
      }
    }
    el?.pause()
    playing = false
    emit()
  }

  const playIndex = (i: number): Promise<void> => {
    if (POC_STATIONS.length === 0) return Promise.resolve()
    // Wrap so the dial is a ring (no dead ends at either end).
    const n = POC_STATIONS.length
    const idx = ((i % n) + n) % n
    return play(POC_STATIONS[idx])
  }

  const api: CityRadio = {
    mode: () => mode,
    start: () => play(POC_STATIONS[index] ?? POC_STATIONS[0]),
    play,
    stop,
    pause: async () => {
      // Native has no explicit pause command in this seam — stop releases the
      // stream; resume() re-opens it. On web we can truly pause the element.
      if (mode === "native") {
        try {
          await radioStop()
        } catch (e) {
          console.error(`${LOG} pause(stop) failed:`, e)
        }
      } else {
        el?.pause()
      }
      playing = false
      emit()
    },
    resume: () => play(POC_STATIONS[index] ?? POC_STATIONS[0]),
    toggle: () => (playing ? api.pause() : api.resume()),
    next: () => playIndex(index + 1),
    prev: () => playIndex(index - 1),
    playIndex,
    channels: () => POC_STATIONS,
    setVolume: (v: number) => {
      volume = clamp(v)
      applyVolume()
      emit()
    },
    duck: () => {
      duckDepth++
      // Only the 0→1 transition changes the actual gain; further ducks just count.
      if (duckDepth === 1) {
        applyVolume()
        emit()
      }
    },
    unduck: () => {
      if (duckDepth === 0) return // over-unduck guard (never go negative)
      duckDepth--
      if (duckDepth === 0) {
        applyVolume()
        emit()
      }
    },
    getState: snapshot,
    subscribe: (fn) => {
      listeners.add(fn)
      try {
        fn(snapshot()) // fire immediately so the UI paints without waiting for an event
      } catch (err) {
        console.error(`${LOG} subscriber threw on subscribe:`, err)
      }
      return () => listeners.delete(fn)
    },
    dispose: () => {
      disposed = true
      unlisten?.()
      unlisten = null
      listeners.clear()
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
    pause: api.pause,
    resume: api.resume,
    next: api.next,
    prev: api.prev,
    setVolume: api.setVolume,
    duck: api.duck,
    unduck: api.unduck,
    state: api.getState,
    mode: api.mode,
    stations: POC_STATIONS,
    playStation: (i: number) => play(POC_STATIONS[i] ?? POC_STATIONS[0]),
    play: (url: string, name = "custom") => play({ id: "custom", name, url }),
  }

  return api
}
