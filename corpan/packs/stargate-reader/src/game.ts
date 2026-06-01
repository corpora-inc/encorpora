import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GlowLayer,
  HemisphericLight,
  Scene,
  Vector3,
} from "@babylonjs/core"
import type { HostApi } from "@shared/sdk"
import type { AudioManifest, BookSegment, TimelineWord, ChapterInfo } from "@shared/core"
import { CAMERA_FOV, CAMERA_Z, GLOW_INTENSITY, BOOK_NAMES } from "@shared/core"
import { buildTimeline, findCurrentWordIndex, buildChapterIndex } from "@shared/core"
import { createFetchDataProvider, createPreloadedDataProvider, type DataProvider } from "@shared/data"
import { createAudioEngine, type AudioEngine, createMediaSessionAnchor, type MediaSessionAnchor, getMediaSessionArtworkUrl } from "@shared/audio"
import { createWaveformCache, type WaveformCache } from "@shared/audio"
import { createTransportBar } from "@shared/ui"
import { createChapterOverlay, type ChapterOverlay } from "@shared/ui"
import { createBookmarkStore, createBookMetaStore, type Bookmark, drawerStore } from "@shared/state"
import { createPrefsStore } from "@shared/state"
import * as analytics from "@shared/analytics"
import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  pauseNativeKeepAlive,
  resumeNativeKeepAlive,
  updateNativeNowPlaying,
  listenForRemoteCommands,
} from "@shared/audio"
import { createWordStream, type WordStream } from "./rendering/wordStream"
import { createOscilloscope, type Oscilloscope } from "./rendering/oscilloscope"
import { createWaveformStream, type WaveformStream } from "./rendering/waveformStream"
import { createPulseRing, type PulseRing } from "./rendering/pulseRing"
import type { Starfield } from "./rendering/starfield"
import { renderStargateDisplaySettings, type OscilloscopeConfig, type WaveformConfig, type PulseRingConfig, type WordHoldConfig } from "./ui/settingsPanel"
import type { DrawerSectionDef } from "@shared/ui"
import { srTrace, type TraceFields } from "./diagnostics/trace"

// Stargate-specific display preferences
type DisplayPrefs = {
  oscilloscope: boolean
  waveform: boolean
  pulseRing: boolean
  wordHold: boolean
  oscilloscopeConfig: OscilloscopeConfig
  waveformConfig: WaveformConfig
  pulseRingConfig: PulseRingConfig
  wordHoldConfig: WordHoldConfig
}

const STARGATE_PREFS_DEFAULTS: DisplayPrefs = {
  oscilloscope: true,
  waveform: true,
  pulseRing: true,
  wordHold: true,
  oscilloscopeConfig: { amplitude: 5, width: 2, alpha: 0.35 },
  waveformConfig: { maxRadius: 1, alpha: 0.005, minRadius: 0, reversed: false },
  pulseRingConfig: { maxRadius: 0.2, fadeMs: 200 },
  wordHoldConfig: { holdY: 0, zPull: 0.4 },
}

const bookmarks = createBookmarkStore("stargate-reader")
const bookMeta = createBookMetaStore("stargate-reader")
const prefsStore = createPrefsStore("stargate-reader-prefs", STARGATE_PREFS_DEFAULTS)

type ReaderNativeCommand = "play" | "pause" | "skipForward" | "skipBack" | "seek" | "prevChapter" | "nextChapter"
type RemotePlayPauseSource = "window" | "native" | "webms"
type NowPlayingMetadata = {
  title: string
  artist: string
  album: string
}
type TauriBridgeWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

declare global {
  interface Window {
    __readerCmd?: (cmd: ReaderNativeCommand, data?: { positionMs?: number }) => void
  }
}

/**
 * Create the Stargate Reader experience.
 *
 * Renders words streaming toward the camera along the z-axis,
 * deterministically synchronized to audio via precomputed word timestamps,
 * passing through an oscilloscope at the "now" plane.
 */
export function createStargateReader(
  container: HTMLElement,
  _hostApi: HostApi,
  initialState?: Record<string, unknown>
) {
  let disposed = false

  // --- Screen Wake Lock ---
  let wakeLock: WakeLockSentinel | null = null

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return
    try {
      wakeLock = await navigator.wakeLock.request("screen")
      wakeLock.addEventListener("release", () => { wakeLock = null })
    } catch (e) { console.warn("[SR] wakeLock request:", e) }
  }

  function releaseWakeLock() {
    wakeLock?.release()
    wakeLock = null
  }

  // --- Background audio keepalive ---
  let bgNowPlayingTimer: ReturnType<typeof setInterval> | null = null
  let nativeSessionActive = false
  let removeRemoteListeners: (() => void) | null = null
  let mediaAnchor: MediaSessionAnchor | null = null
  let playInFlight = false
  let desiredPlaying = false
  let playRequestSeq = 0
  let mediaArtworkUrl: string | undefined
  let lastMediaSessionSyncAt = 0
  let lastMediaMetadataKey = ""
  let lastNowPlayingToken = 0
  let nativePlaybackStateHint: MediaSessionPlaybackState | "unknown" = "unknown"
  let pendingEngineState: MediaSessionPlaybackState | null = null
  let pendingEngineStateSince = 0
  let suppressExternalReconcileUntil = 0
  const hasNativeBridge = Boolean((window as TauriBridgeWindow).__TAURI_INTERNALS__)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const nativeOwnsMediaSession = hasNativeBridge && isAndroid
  const MEDIA_SESSION_RESYNC_INTERVAL_MS = 1000
  const EXTERNAL_STATE_DEBOUNCE_MS = 900

  function tracePlayback(event: string, fields: TraceFields = {}, native = false) {
    const base: TraceFields = {
      appPlaying: isPlaying,
      desiredPlaying,
      playInFlight,
      nativeSessionActive,
      nativeHint: nativePlaybackStateHint,
    }
    if (audioEngine) {
      base.enginePlaying = audioEngine.isPlaying()
      base.ctx = audioEngine.getContextState()
      base.seg = audioEngine.getCurrentSegmentIndex()
      base.posMs = Math.round(audioEngine.getCurrentTimeMs())
    }
    srTrace(event, { ...base, ...fields }, { native })
  }

  function nextNowPlayingToken(): number {
    const now = Date.now()
    lastNowPlayingToken = Math.max(now, lastNowPlayingToken + 1)
    return lastNowPlayingToken
  }

  // --- Background recovery timing ---
  let backgroundedAt = 0        // wall-clock ms when app went to background
  let backgroundedAudioMs = 0   // audio position ms when app went to background

  // True if the app has been in the hidden+paused state since the last play.
  // On iOS, AVAudioSession can silently deactivate in this state — next doPlay
  // will do a pre-emptive session rebuild (recoverContext can't detect this
  // because the JS AudioContext still reports "running").
  let audioSessionMayBeStale = false

  // --- Background timer management ---
  function startBackgroundTimers() {
    if (!bgNowPlayingTimer) {
      console.log("[SR:bg] start background now-playing timer")
      bgNowPlayingTimer = setInterval(() => {
        if (!audioEngine || !isPlaying) return
        syncNativeNowPlaying("periodic")
        persistBookmark()
      }, 3000)
    }
  }

  function stopBackgroundTimers() {
    if (bgNowPlayingTimer) {
      console.log("[SR:bg] stop background now-playing timer")
      clearInterval(bgNowPlayingTimer)
      bgNowPlayingTimer = null
    }
  }

  // --- Single source of truth for native now-playing sync ---
  function syncNativeNowPlaying(_mode: "state" | "periodic" = "state") {
    syncMediaSessionNowPlaying()
    if (!nativeSessionActive || !audioEngine) return
    const metadata = getNowPlayingMetadata()
    const nowPlayingToken = nextNowPlayingToken()
    void updateNativeNowPlaying(
      metadata.title,
      metadata.artist,
      audioEngine.getCurrentTimeMs(),
      audioEngine.getTotalDurationMs(),
      isPlaying,
      nowPlayingToken
    )
  }

  function syncMediaSessionPlaybackState(state: MediaSessionPlaybackState) {
    if (nativeOwnsMediaSession) return
    if (!("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.playbackState = state
    } catch (err) {
      console.error("[MS] playbackState set failed:", err)
    }
  }

  function syncNativePlaybackState(playing: boolean) {
    if (!nativeSessionActive) return
    const target: MediaSessionPlaybackState = playing ? "playing" : "paused"
    if (nativePlaybackStateHint === target) return
    nativePlaybackStateHint = target
    if (playing) {
      void resumeNativeKeepAlive("syncNativePlaybackState")
    } else {
      void pauseNativeKeepAlive("syncNativePlaybackState")
    }
  }

  function syncMediaSessionNowPlaying() {
    if (nativeOwnsMediaSession) return
    if (!("mediaSession" in navigator) || !audioEngine) return
    const metadata = getNowPlayingMetadata()
    try {
      const metadataKey = `${metadata.title}|${metadata.artist}|${metadata.album}|${mediaArtworkUrl ?? ""}`
      if (metadataKey !== lastMediaMetadataKey) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          artwork: mediaArtworkUrl
            ? [{ src: mediaArtworkUrl, sizes: "434x434", type: "image/webp" }]
            : undefined,
        })
        lastMediaMetadataKey = metadataKey
      }

      const durationS = audioEngine.getTotalDurationMs() / 1000
      if (Number.isFinite(durationS) && durationS > 0) {
        const positionS = Math.max(0, Math.min(audioEngine.getCurrentTimeMs() / 1000, durationS))
        navigator.mediaSession.setPositionState({
          duration: durationS,
          playbackRate: 1,
          position: positionS,
        })
      }
    } catch (err) {
      console.error("[MS] syncMediaSessionNowPlaying failed:", err)
    }
  }

  // --- Centralized play/pause helpers (background-aware) ---
  async function doPlay() {
    desiredPlaying = true
    const requestId = ++playRequestSeq
    if (!audioEngine || playInFlight) return
    tracePlayback("doPlay:start", { requestId }, true)
    const shouldCancelPlayRequest = (): { canceled: boolean; staleSuperseded: boolean } => {
      const staleSuperseded = requestId !== playRequestSeq && desiredPlaying && !disposed
      const canceled = staleSuperseded || !desiredPlaying || disposed
      return { canceled, staleSuperseded }
    }

    // Pre-emptive session rebuild: iOS may have silently killed AVAudioSession
    // during a paused-hidden interval. recoverContext() can't detect this
    // (JS context still reports "running"), so tear everything down and rebuild
    // before the normal play path. See audioSessionMayBeStale declaration.
    if (audioSessionMayBeStale) {
      console.log("[SR:stale] pre-emptive audio session rebuild")
      audioSessionMayBeStale = false
      try { await stopNativeKeepAlive() } catch (e) { console.warn("[SR:stale] stopNativeKeepAlive:", e) }
      nativeSessionActive = false
      nativePlaybackStateHint = "unknown"
      mediaAnchor?.dispose()
      mediaAnchor = null
      try { await audioEngine.recreateContext() } catch (e) { console.error("[SR:stale] recreateContext:", e) }
      if (shouldCancelPlayRequest().canceled) return
    }

    const engineAlreadyPlaying = audioEngine.isPlaying()
    if (engineAlreadyPlaying) {
      isPlaying = true
      transport.setPlaying(true)
      syncMediaSessionPlaybackState("playing")
      lastMediaSessionSyncAt = performance.now()
      if (!nativeOwnsMediaSession && !mediaAnchor) {
        mediaAnchor = createMediaSessionAnchor()
      }
      mediaAnchor?.play()
      void requestWakeLock()
      syncNativePlaybackState(true)
      syncNativeNowPlaying()
      if (document.hidden) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
        startBackgroundTimers()
      }
      return
    }
    playInFlight = true
    const t0 = performance.now()
    console.log(`[SR:doPlay] start — ctx.state=${audioEngine.getContextState()}`)

    // Configure native audio session FIRST — before any AudioContext exists.
    // Swift's AVAudioSession.setCategory + setActive interrupts any running
    // AudioContext, so the session must be stable before we create/resume one.
    try {
      if (!nativeSessionActive) {
        const metadata = getNowPlayingMetadata()
        console.log(`[SR:doPlay] awaiting startNativeKeepAlive +${(performance.now() - t0).toFixed(1)}ms`)
        await startNativeKeepAlive(
          metadata.title,
          metadata.artist,
          metadata.album,
          audioEngine.getCurrentTimeMs(),
          audioEngine.getTotalDurationMs()
        )
        nativeSessionActive = true
        nativePlaybackStateHint = "playing"
        console.log(`[SR:doPlay] startNativeKeepAlive resolved +${(performance.now() - t0).toFixed(1)}ms`)
        const afterStart = shouldCancelPlayRequest()
        if (afterStart.canceled) {
          console.log("[SR:doPlay] canceled after startNativeKeepAlive")
          tracePlayback("doPlay:canceled-after-start", {
            requestId,
            staleSuperseded: afterStart.staleSuperseded,
          }, true)
          if (afterStart.staleSuperseded) {
            return
          }
          syncMediaSessionPlaybackState("paused")
          syncNativePlaybackState(false)
          syncNativeNowPlaying()
          return
        }
      } else {
        console.log(`[SR:doPlay] awaiting resumeNativeKeepAlive +${(performance.now() - t0).toFixed(1)}ms`)
        await resumeNativeKeepAlive("doPlay")
        nativePlaybackStateHint = "playing"
        console.log(`[SR:doPlay] resumeNativeKeepAlive resolved +${(performance.now() - t0).toFixed(1)}ms`)
        const afterResume = shouldCancelPlayRequest()
        if (afterResume.canceled) {
          console.log("[SR:doPlay] canceled after resumeNativeKeepAlive")
          tracePlayback("doPlay:canceled-after-resume", {
            requestId,
            staleSuperseded: afterResume.staleSuperseded,
          }, true)
          if (afterResume.staleSuperseded) {
            return
          }
          syncMediaSessionPlaybackState("paused")
          syncNativePlaybackState(false)
          syncNativeNowPlaying()
          return
        }
      }

      // NOW create/resume AudioContext — native session is stable
      await audioEngine.recoverContext()
      console.log(`[SR:doPlay] recoverContext done +${(performance.now() - t0).toFixed(1)}ms ctx.state=${audioEngine.getContextState()}`)
      const afterRecover = shouldCancelPlayRequest()
      if (afterRecover.canceled) {
        console.log("[SR:doPlay] canceled after recoverContext")
        tracePlayback("doPlay:canceled-after-recover", {
          requestId,
          staleSuperseded: afterRecover.staleSuperseded,
        }, true)
        if (afterRecover.staleSuperseded) {
          return
        }
        syncMediaSessionPlaybackState("paused")
        syncNativePlaybackState(false)
        syncNativeNowPlaying()
        return
      }

      // Re-register after context/session churn.
      setupMediaSession()
      if (!nativeOwnsMediaSession && !mediaAnchor) {
        mediaAnchor = createMediaSessionAnchor()
      }
      mediaAnchor?.play()
      audioEngine.unlock()
      console.log(`[SR:doPlay] unlock done +${(performance.now() - t0).toFixed(1)}ms`)

      audioEngine.play()
      console.log(`[SR:doPlay] audioEngine.play() done +${(performance.now() - t0).toFixed(1)}ms ctx.state=${audioEngine.getContextState()}`)
      const afterPlay = shouldCancelPlayRequest()
      if (afterPlay.canceled) {
        console.log("[SR:doPlay] canceled after audioEngine.play(); forcing pause")
        tracePlayback("doPlay:canceled-after-engine-play", {
          requestId,
          staleSuperseded: afterPlay.staleSuperseded,
        }, true)
        if (afterPlay.staleSuperseded) {
          return
        }
        audioEngine.pause()
        syncMediaSessionPlaybackState("paused")
        syncNativePlaybackState(false)
        syncNativeNowPlaying()
        return
      }

      isPlaying = audioEngine.isPlaying()
      transport.setPlaying(isPlaying)
      syncMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
      lastMediaSessionSyncAt = performance.now()
      if (isPlaying) {
        void requestWakeLock()
        syncNativePlaybackState(true)
      } else {
        releaseWakeLock()
        syncNativePlaybackState(false)
      }

      // Fire-and-forget — just metadata, no audio session changes
      syncNativeNowPlaying()

      // Background timers
      if (document.hidden) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
        startBackgroundTimers()
      }
      tracePlayback("doPlay:done", { requestId, latencyMs: Math.round(performance.now() - t0) }, true)
    } finally {
      playInFlight = false
      tracePlayback("doPlay:finally", { requestId }, false)
    }
  }

  function doPause() {
    desiredPlaying = false
    playRequestSeq += 1
    // Pausing while the app is hidden (e.g. lock-screen pause routed through
    // listenForRemoteCommands) means iOS may now quietly kill the audio
    // session — flag for pre-emptive rebuild on the next play.
    if (document.hidden) {
      audioSessionMayBeStale = true
    }
    if (!audioEngine) return
    const requestId = playRequestSeq
    tracePlayback("doPause:start", { requestId }, true)
    const enginePlaying = audioEngine.isPlaying()
    if (!isPlaying && !enginePlaying) {
      transport.setPlaying(false)
      syncMediaSessionPlaybackState("paused")
      lastMediaSessionSyncAt = 0
      releaseWakeLock()
      syncNativePlaybackState(false)
      syncNativeNowPlaying()
      stopBackgroundTimers()
      if (document.hidden) backgroundedAt = 0
      tracePlayback("doPause:no-op", { requestId }, true)
      return
    }
    if (enginePlaying) {
      audioEngine.pause()
    }
    mediaAnchor?.pause()
    isPlaying = false
    transport.setPlaying(false)
    syncMediaSessionPlaybackState("paused")
    lastMediaSessionSyncAt = 0
    persistBookmark()
    releaseWakeLock()
    syncNativePlaybackState(false)
    syncNativeNowPlaying()
    stopBackgroundTimers()
    if (document.hidden) backgroundedAt = 0
    tracePlayback("doPause:done", { requestId }, true)
  }

  // Module-level state for language/book switching
  let dataProvider: DataProvider
  let segments: BookSegment[] = []
  let chapters: ChapterInfo[] = []
  let currentLanguage = (initialState?.language as string) || "en"
  // Corpán Plus: true when the installed pack is a truncated free preview.
  let isPreview = false

  // Book ID for bookmark namespacing
  const bookId =
    (initialState?.bookId as string) ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("book") || "book_monte_alban"
      : "unknown")

  const bookDisplayName =
    (initialState?.bookTitle as string) || BOOK_NAMES[bookId] || bookId

  // Corpán Plus: ask the host to open the paywall after a finished preview.
  function maybeOfferPlus() {
    try {
      window.dispatchEvent(
        new CustomEvent("corpan:request-unlock", {
          detail: {
            surface: "reader_eof_free",
            bookTitle: bookDisplayName,
            bookId,
            language: currentLanguage,
            // Skin the host paywall to match this reader (accent + bg).
            theme: "stargate",
          },
        })
      )
    } catch (err) {
      console.warn("[StargateReader] request-unlock dispatch failed:", err)
    }
  }

  // Corpán Plus: report deepest segment reached for the host progress store.
  function reportSegmentProgress(index: number) {
    try {
      window.dispatchEvent(
        new CustomEvent("corpan:segment-progress", {
          detail: {
            bookId,
            language: currentLanguage,
            segmentsReached: index + 1,
            totalSegments: segments.length,
          },
        })
      )
    } catch {
      /* non-fatal */
    }
  }

  function getResolvedBookTitle(): string {
    return bookDisplayName
  }

  function getNowPlayingMetadata(): NowPlayingMetadata {
    const resolvedBookTitle = getResolvedBookTitle()
    const segTitle = audioEngine
      ? segments[audioEngine.getCurrentSegmentIndex()]?.title
      : undefined
    return {
      title: segTitle || resolvedBookTitle,
      artist: resolvedBookTitle,
      album: resolvedBookTitle,
    }
  }

  function syncChapterFromEnginePosition() {
    if (!audioEngine) return
    const seg = segments[audioEngine.getCurrentSegmentIndex()]
    if (seg) {
      transport.setChapter(seg.title)
    }
  }

  function seekToMsAndSync(targetMs: number) {
    if (!audioEngine) return
    playRequestSeq += 1
    tracePlayback("seek:ms", { targetMs: Math.round(targetMs), requestId: playRequestSeq }, true)
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    if (isPlaying) {
      audioEngine.seekToMs(targetMs)
      audioEngine.ensureSourceIfPlaying("seekToMsAndSync")
    } else {
      audioEngine.seekToMsPreview(targetMs)
    }
    syncChapterFromEnginePosition()
    syncNativeNowPlaying()
  }

  function seekToSegmentAndSync(index: number) {
    if (!audioEngine) return
    playRequestSeq += 1
    tracePlayback("seek:segment", { targetSeg: index, requestId: playRequestSeq }, true)
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    audioEngine.seekToSegment(index)
    syncChapterFromEnginePosition()
    syncNativeNowPlaying()
    audioEngine.ensureSourceIfPlaying("seekToSegmentAndSync")
  }

  // Bookmark persistence
  function persistBookmark() {
    if (!audioEngine) return
    const bm: Bookmark = {
      timeMs: audioEngine.getCurrentTimeMs(),
      segmentIndex: audioEngine.getCurrentSegmentIndex(),
      language: currentLanguage,
      savedAt: Date.now(),
    }
    bookmarks.save(bookId, bm)
  }

  // Create wrapper
  const wrapper = document.createElement("div")
  wrapper.className = "stargate-reader"
  container.appendChild(wrapper)

  // Create canvas
  const canvas = document.createElement("canvas")
  canvas.className = "stargate-canvas"
  wrapper.appendChild(canvas)

  // Create UI overlay
  const ui = document.createElement("div")
  ui.className = "stargate-ui"
  wrapper.appendChild(ui)

  // Babylon.js engine — cap pixel ratio at 2 to avoid 3x rendering on high-DPI phones
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const engine = new Engine(canvas, true, {
    antialias: dpr >= 2,   // skip AA on low-DPI (already sharp enough)
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  })
  engine.setHardwareScalingLevel(1 / dpr)

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.03, 0.06, 1)
  scene.skipPointerMovePicking = true

  // Camera — looking down the z-axis
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2, // alpha (rotation around y)
    Math.PI / 2,  // beta (elevation — looking straight)
    Math.abs(CAMERA_Z),
    Vector3.Zero(),
    scene
  )
  camera.fov = CAMERA_FOV
  camera.minZ = 0.1
  camera.maxZ = 50  // text is never far — tighter frustum saves GPU fill
  // Position camera behind the now-plane, looking forward
  camera.position = new Vector3(0, 0, CAMERA_Z)
  camera.setTarget(new Vector3(0, 0, 20))
  // Disable user camera controls (this is a player, not an editor)
  camera.inputs.clear()

  // Lighting — subtle ambient
  const light = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene)
  light.intensity = 0.3
  light.diffuse = new Color3(0.6, 0.7, 0.9)
  light.groundColor = new Color3(0.1, 0.1, 0.2)

  // Glow layer for neon effects — use smaller kernel for performance
  const glow = new GlowLayer("glow", scene, { mainTextureSamples: 1, blurKernelSize: 16 })
  glow.intensity = GLOW_INTENSITY

  // Rendering systems (initialized after data loads)
  let wordStream: WordStream | null = null
  let waveformStream: WaveformStream | null = null
  let oscilloscope: Oscilloscope | null = null
  let pulseRing: PulseRing | null = null
  let starfield: Starfield | null = null
  let audioEngine: AudioEngine | null = null
  let waveformCache: WaveformCache | null = null
  let timelineWords: TimelineWord[] = []
  let currentWordHint = 0

  // --- Swipe-to-navigate segment gesture ---
  let swipeStartY = 0
  let swipeStartX = 0
  let swipeDeltaY = 0
  let swipeActive = false
  let swipeLocked = false          // true once we confirm vertical intent
  let swipeVisualOffsetMs = 0      // visual time shift during drag + ease-out
  let swipeAnimating = false
  let swipeAnimStart = 0
  let swipeAnimFrom = 0
  const SWIPE_MS_PER_PX = 50
  const SWIPE_THRESHOLD_PX = 30
  const SWIPE_LOCK_PX = 10        // min movement before locking direction
  const SWIPE_ANIM_DURATION_MS = 300

  function onSwipeTouchStart(e: TouchEvent) {
    if (!audioEngine || e.touches.length !== 1) return
    swipeStartY = e.touches[0].clientY
    swipeStartX = e.touches[0].clientX
    swipeDeltaY = 0
    swipeActive = true
    swipeLocked = false
    // Cancel any in-progress ease-out so finger takes over
    if (swipeAnimating) {
      swipeAnimating = false
      swipeVisualOffsetMs = 0
    }
  }

  function onSwipeTouchMove(e: TouchEvent) {
    if (!swipeActive || !audioEngine || e.touches.length !== 1) return
    const dy = e.touches[0].clientY - swipeStartY
    const dx = e.touches[0].clientX - swipeStartX

    // Lock direction once movement exceeds threshold
    if (!swipeLocked) {
      if (Math.abs(dy) < SWIPE_LOCK_PX && Math.abs(dx) < SWIPE_LOCK_PX) return
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe — abandon
        swipeActive = false
        return
      }
      swipeLocked = true
    }

    e.preventDefault()
    swipeDeltaY = dy
    swipeVisualOffsetMs = dy * SWIPE_MS_PER_PX
  }

  function onSwipeTouchEnd(_e: TouchEvent) {
    if (!swipeActive || !audioEngine) {
      swipeActive = false
      return
    }
    swipeActive = false

    const absDelta = Math.abs(swipeDeltaY)
    if (!swipeLocked || absDelta < SWIPE_THRESHOLD_PX) {
      // Below threshold — snap back
      if (Math.abs(swipeVisualOffsetMs) > 0.5) {
        swipeAnimFrom = swipeVisualOffsetMs
        swipeAnimating = true
        swipeAnimStart = performance.now()
      } else {
        swipeVisualOffsetMs = 0
      }
      return
    }

    // Determine target segment — always round in direction of travel
    const currentIdx = audioEngine.getCurrentSegmentIndex()
    const segStarts = audioEngine.getSegmentAbsoluteStartMs()
    const beforeMs = audioEngine.getCurrentTimeMs()
    const visualMs = beforeMs + swipeVisualOffsetMs

    let targetIdx: number
    if (swipeDeltaY > 0) {
      // Scrolling forward — ceil: first segment boundary at or past visual position
      targetIdx = segments.length - 1
      for (let i = currentIdx + 1; i < segments.length; i++) {
        if (segStarts[i] >= visualMs) {
          targetIdx = i
          break
        }
      }
    } else {
      // Scrolling backward — floor: last segment boundary at or before visual position
      targetIdx = 0
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (segStarts[i] <= visualMs) {
          targetIdx = i
          break
        }
      }
    }
    targetIdx = Math.max(0, Math.min(segments.length - 1, targetIdx))

    if (targetIdx === currentIdx) {
      // At boundary — snap back (unavoidable at first/last segment)
      swipeAnimFrom = swipeVisualOffsetMs
      swipeAnimating = true
      swipeAnimStart = performance.now()
      return
    }

    const afterMs = segStarts[targetIdx] ?? beforeMs
    const jumpMs = afterMs - beforeMs

    // After seekToSegmentAndSync, currentMs will jump by jumpMs instantly.
    // To make words appear to scroll smoothly, set the visual offset so the
    // total visual position stays the same, then ease it to 0.
    // The ceil/floor logic above guarantees swipeAnimFrom has the right sign
    // so the animation always continues in the swipe direction.
    swipeAnimFrom = swipeVisualOffsetMs - jumpMs
    seekToSegmentAndSync(targetIdx)
    swipeAnimating = true
    swipeAnimStart = performance.now()
  }

  canvas.addEventListener("touchstart", onSwipeTouchStart, { passive: true })
  canvas.addEventListener("touchmove", onSwipeTouchMove, { passive: false })
  canvas.addEventListener("touchend", onSwipeTouchEnd, { passive: true })
  canvas.addEventListener("touchcancel", onSwipeTouchEnd, { passive: true })

  // Starfield disabled for performance (STARFIELD_COUNT = 0)

  // Playback state
  let isPlaying = false
  let lastRemotePlayPauseCmd: "play" | "pause" | null = null
  let lastRemotePlayPauseAt = 0
  const REMOTE_PLAY_PAUSE_DEDUPE_MS = 250

  function dispatchRemotePlayPause(cmd: "play" | "pause", source: RemotePlayPauseSource) {
    const now = performance.now()
    if (
      lastRemotePlayPauseCmd === cmd &&
      now - lastRemotePlayPauseAt < REMOTE_PLAY_PAUSE_DEDUPE_MS
    ) {
      tracePlayback("cmd:deduped", {
        cmd,
        source,
        deltaMs: Math.round(now - lastRemotePlayPauseAt),
      }, true)
      return
    }
    lastRemotePlayPauseCmd = cmd
    lastRemotePlayPauseAt = now
    tracePlayback("cmd:dispatch", { cmd, source }, true)
    if (cmd === "play") {
      void doPlay()
      return
    }
    doPause()
  }

  // --- Display preferences (persisted per book) ---
  const prefs: DisplayPrefs = prefsStore.load(bookId)

  // --- Language/settings change callbacks (set by appShell) ---

  // --- Chapter overlay ---
  let chapterOverlay: ChapterOverlay = createChapterOverlay(ui, "stargate")
  let lastChapterIndex = -1

  // --- Transport bar ---
  const transport = createTransportBar(ui, "stargate")
  transport.setBookTitle(bookDisplayName)
  // Reserve a line for the chapter title if we've seen this book
  // before and know it's chaptered, so the transport doesn't jerk
  // when the async-loaded chapter title arrives. First-ever read of a
  // brand-new book has no cache and accepts one small shift; every
  // subsequent mount (notably language switches) is stable from
  // frame one.
  const cachedMeta = bookMeta.load(bookId)
  if (cachedMeta?.hasChapters) {
    transport.setHasChapters(true)
  }

  transport.onPlay(() => {
    void doPlay()
  })

  transport.onPause(() => {
    doPause()
  })

  transport.onPrevChapter(() => {
    if (!audioEngine || chapters.length === 0) return
    const currentIdx = audioEngine.getCurrentSegmentIndex()
    let chapterIdx = 0
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentIdx >= chapters[i].firstSegmentIndex) {
        chapterIdx = i
        break
      }
    }
    const threshold = chapters[chapterIdx].firstSegmentIndex + 2
    const targetChapter = currentIdx > threshold ? chapterIdx : Math.max(0, chapterIdx - 1)
    seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
  })

  transport.onNextChapter(() => {
    if (!audioEngine || chapters.length === 0) return
    const currentIdx = audioEngine.getCurrentSegmentIndex()
    let chapterIdx = 0
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentIdx >= chapters[i].firstSegmentIndex) {
        chapterIdx = i
        break
      }
    }
    const targetChapter = Math.min(chapters.length - 1, chapterIdx + 1)
    seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
  })

  transport.onSkipBack(() => {
    if (!audioEngine) return
    seekToMsAndSync(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
  })

  transport.onSkipForward(() => {
    if (!audioEngine) return
    seekToMsAndSync(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
  })

  // --- Scrub lifecycle ---
  let wasPlayingBeforeScrub = false

  transport.onScrubStart(() => {
    wasPlayingBeforeScrub = audioEngine?.isPlaying() ?? isPlaying
    tracePlayback("scrub:start", { wasPlayingBeforeScrub }, true)
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    // Do not pause/resume around scrub while playing.
    // The pause/play round-trip is race-prone on iOS and can strand audio.
  })

  transport.onScrubMove((fraction) => {
    if (!audioEngine) return
    const targetMs = fraction * audioEngine.getTotalDurationMs()
    // Preview-only seek is for paused mode. While playing, defer real seek to scrub end.
    if (!wasPlayingBeforeScrub) {
      audioEngine.seekToMsPreview(targetMs)
    }
  })

  transport.onScrubEnd((fraction) => {
    if (!audioEngine) return
    const targetMs = fraction * audioEngine.getTotalDurationMs()
    tracePlayback("scrub:end", { fraction: fraction.toFixed(3), targetMs: Math.round(targetMs), wasPlayingBeforeScrub }, true)
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    seekToMsAndSync(targetMs)
    // Keep state stable: if scrub started while playing, stay playing.
    // If scrub started paused, stay paused.
    if (wasPlayingBeforeScrub && !isPlaying) {
      void doPlay()
      return
    }
  })

  // Language switching is triggered by the command drawer via appShell

  window.__readerCmd = (cmd: ReaderNativeCommand, data?: { positionMs?: number }) => {
    console.log(`[SR:cmd] __readerCmd(${cmd})`)
    switch (cmd) {
      case "play":
      case "pause":
        dispatchRemotePlayPause(cmd, "native")
        break
      case "skipForward":
        if (!audioEngine) return
        seekToMsAndSync(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
        break
      case "skipBack":
        if (!audioEngine) return
        seekToMsAndSync(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
        break
      case "seek":
        if (!audioEngine || data?.positionMs == null) return
        seekToMsAndSync(data.positionMs)
        break
      case "nextChapter":
        if (!audioEngine || chapters.length === 0) return
        {
          const currentIdx = audioEngine.getCurrentSegmentIndex()
          let chapterIdx = 0
          for (let i = chapters.length - 1; i >= 0; i--) {
            if (currentIdx >= chapters[i].firstSegmentIndex) { chapterIdx = i; break }
          }
          const targetChapter = Math.min(chapters.length - 1, chapterIdx + 1)
          seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
        }
        break
      case "prevChapter":
        if (!audioEngine || chapters.length === 0) return
        {
          const currentIdx = audioEngine.getCurrentSegmentIndex()
          let chapterIdx = 0
          for (let i = chapters.length - 1; i >= 0; i--) {
            if (currentIdx >= chapters[i].firstSegmentIndex) { chapterIdx = i; break }
          }
          const threshold = chapters[chapterIdx].firstSegmentIndex + 2
          const targetChapter = currentIdx > threshold ? chapterIdx : Math.max(0, chapterIdx - 1)
          seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
        }
        break
    }
  }

  let wordHoldEnabled = prefs.wordHold

  // Display settings callbacks — used by the drawer's Display section
  const displaySettingsCallbacks = {
    onToggleWordHold: (enabled: boolean) => {
      wordHoldEnabled = enabled
      prefs.wordHold = enabled
      prefsStore.save(bookId, prefs)
    },
    onWordHoldConfig: (key: string, value: number) => {
      wordStream?.configure({ [key]: value })
      ;(prefs.wordHoldConfig as Record<string, number>)[key] = value
      prefsStore.save(bookId, prefs)
    },
    onToggleOscilloscope: (visible: boolean) => {
      if (oscilloscope) oscilloscope.mesh.isVisible = visible
      prefs.oscilloscope = visible
      prefsStore.save(bookId, prefs)
    },
    onToggleWaveform: (visible: boolean) => {
      if (waveformStream) waveformStream.mesh.isVisible = visible
      prefs.waveform = visible
      prefsStore.save(bookId, prefs)
    },
    onTogglePulseRing: (visible: boolean) => {
      pulseRing?.setVisible(visible)
      prefs.pulseRing = visible
      prefsStore.save(bookId, prefs)
    },
    onOscilloscopeConfig: (key: string, value: number) => {
      oscilloscope?.configure({ [key]: value })
      ;(prefs.oscilloscopeConfig as Record<string, number>)[key] = value
      prefsStore.save(bookId, prefs)
    },
    onWaveformConfig: (key: string, value: number) => {
      if (key === "reversed") {
        const rev = value === 1
        waveformStream?.configure({ reversed: rev })
        prefs.waveformConfig.reversed = rev
      } else {
        waveformStream?.configure({ [key]: value })
        ;(prefs.waveformConfig as Record<string, number>)[key] = value
        // Link maxRadius to pulse ring
        if (key === "maxRadius") {
          pulseRing?.configure({ maxRadius: value })
          prefs.pulseRingConfig.maxRadius = value
        }
      }
      prefsStore.save(bookId, prefs)
    },
    onPulseRingConfig: (key: string, value: number) => {
      pulseRing?.configure({ [key]: value })
      ;(prefs.pulseRingConfig as Record<string, number>)[key] = value
      // Link maxRadius to waveform
      if (key === "maxRadius") {
        waveformStream?.configure({ maxRadius: value })
        prefs.waveformConfig.maxRadius = value
      }
      prefsStore.save(bookId, prefs)
    },
  }

  // --- Native remote command listeners (lock screen / notification) ---
  removeRemoteListeners = listenForRemoteCommands({
    onPlay: () => {
      console.log("[SR:cmd] native listener onPlay")
      dispatchRemotePlayPause("play", "native")
    },
    onPause: () => {
      console.log("[SR:cmd] native listener onPause")
      dispatchRemotePlayPause("pause", "native")
    },
    onSkipForward: () => {
      if (!audioEngine) return
      seekToMsAndSync(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
    },
    onSkipBack: () => {
      if (!audioEngine) return
      seekToMsAndSync(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
    },
    onNextChapter: () => {
      if (!audioEngine || chapters.length === 0) return
      const currentIdx = audioEngine.getCurrentSegmentIndex()
      let chapterIdx = 0
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (currentIdx >= chapters[i].firstSegmentIndex) {
          chapterIdx = i
          break
        }
      }
      const targetChapter = Math.min(chapters.length - 1, chapterIdx + 1)
      seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
    },
    onPrevChapter: () => {
      if (!audioEngine || chapters.length === 0) return
      const currentIdx = audioEngine.getCurrentSegmentIndex()
      let chapterIdx = 0
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (currentIdx >= chapters[i].firstSegmentIndex) {
          chapterIdx = i
          break
        }
      }
      const threshold = chapters[chapterIdx].firstSegmentIndex + 2
      const targetChapter = currentIdx > threshold ? chapterIdx : Math.max(0, chapterIdx - 1)
      seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
    },
    onSeek: (positionMs: number) => {
      if (!audioEngine) return
      seekToMsAndSync(positionMs)
    },
    onInterruptionBegan: () => {
      console.log("[SR:int] interruptionBegan ignored")
    },
    onInterruptionEnded: (shouldResume: boolean) => {
      console.log(`[SR:int] interruptionEnded(shouldResume=${shouldResume}) ignored`)
    },
  })

  // --- Media Session API (lock screen controls) ---
  // On iOS/macOS/browser: WebKit owns MPNowPlayingInfoCenter via navigator.mediaSession.
  // On Android: native MediaSession is sole owner (unchanged).
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return
    if (nativeOwnsMediaSession) return  // Android: native Kotlin service handles everything
    syncMediaSessionNowPlaying()

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => {
        dispatchRemotePlayPause("play", "webms")
      }],
      ["pause", () => {
        dispatchRemotePlayPause("pause", "webms")
      }],
      ["seekto", (details) => {
        if (!audioEngine || details?.seekTime == null) return
        seekToMsAndSync(details.seekTime * 1000)
      }],
      ["seekforward", () => {
        if (!audioEngine) return
        seekToMsAndSync(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
      }],
      ["seekbackward", () => {
        if (!audioEngine) return
        seekToMsAndSync(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
      }],
      ["nexttrack", () => {
        if (!audioEngine || chapters.length === 0) return
        const currentIdx = audioEngine.getCurrentSegmentIndex()
        let chapterIdx = 0
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (currentIdx >= chapters[i].firstSegmentIndex) { chapterIdx = i; break }
        }
        const targetChapter = Math.min(chapters.length - 1, chapterIdx + 1)
        seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
      }],
      ["previoustrack", () => {
        if (!audioEngine || chapters.length === 0) return
        const currentIdx = audioEngine.getCurrentSegmentIndex()
        let chapterIdx = 0
        for (let i = chapters.length - 1; i >= 0; i--) {
          if (currentIdx >= chapters[i].firstSegmentIndex) { chapterIdx = i; break }
        }
        const threshold = chapters[chapterIdx].firstSegmentIndex + 2
        const targetChapter = currentIdx > threshold ? chapterIdx : Math.max(0, chapterIdx - 1)
        seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
      }],
    ]

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch (err) {
        console.error(`[MS] setActionHandler(${action}) failed:`, err)
      }
    }
  }

  // --- Periodic bookmark autosave (every 15s during playback) ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000
  const SEEK_RECONCILE_SUPPRESSION_MS = 2000
  const DRIFT_CORRECTION_MIN_BACKGROUND_MS = 5000

  // --- Screen lock behavior ---
  function handleVisibilityChange() {
    if (document.hidden) {
      console.log(`[SR:vis] hidden (isPlaying=${isPlaying})`)
      tracePlayback("visibility:hidden", {}, true)
      // Screen locked / tab hidden: save bookmark, stop render loop but keep audio
      if (audioEngine && isPlaying) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
      }
      persistBookmark()
      engine.stopRenderLoop()
      // Keep AudioContext alive and sync now-playing in background
      if (audioEngine && isPlaying) {
        startBackgroundTimers()
      }
      if (!desiredPlaying) {
        audioSessionMayBeStale = true
      }
    } else {
      console.log(`[SR:vis] visible (isPlaying=${isPlaying})`)
      tracePlayback("visibility:visible", {}, true)
      // Foregrounded
      stopBackgroundTimers()
      engine.runRenderLoop(renderLoop)

      const wasBackgroundedAt = backgroundedAt
      const hiddenDurationMs =
        wasBackgroundedAt > 0 ? Math.max(0, Date.now() - wasBackgroundedAt) : 0
      const shouldApplyDriftCorrection =
        isPlaying &&
        wasBackgroundedAt > 0 &&
        hiddenDurationMs >= DRIFT_CORRECTION_MIN_BACKGROUND_MS
      const expectedMsAfterBackground = backgroundedAudioMs + hiddenDurationMs
      backgroundedAt = 0

      if (audioEngine && isPlaying) {
        void audioEngine.recoverContext().then(() => {
          if (!audioEngine) return

          audioEngine.ensureSourceIfPlaying("visibility:recover")
          // Drift detection
          if (shouldApplyDriftCorrection) {
            const actualMs = audioEngine.getCurrentTimeMs()
            const totalMs = audioEngine.getTotalDurationMs()
            if (
              Math.abs(expectedMsAfterBackground - actualMs) > 2000 &&
              expectedMsAfterBackground < totalMs
            ) {
              seekToMsAndSync(Math.min(expectedMsAfterBackground, totalMs))
            }
          }
          // Ensure recovery flows through one top-level orchestration path.
          if (!audioEngine.isPlaying()) {
            console.log("[SR:vis] engine paused while app expects playing; routing through doPlay()")
            tracePlayback("visibility:recover-route-doPlay", {}, true)
            void doPlay()
            return
          }
          void requestWakeLock()
          syncNativePlaybackState(true)
          syncNativeNowPlaying()
        })
      } else if (audioEngine) {
        // Paused: just sync native state, do NOT recoverContext
        syncNativeNowPlaying()
      }

      // Force transport UI sync (eliminates any single-frame inconsistency)
      transport.setPlaying(isPlaying)
      if (audioEngine) {
        const ms = audioEngine.getCurrentTimeMs()
        const total = audioEngine.getTotalDurationMs()
        transport.setTime(ms, total)
        if (total > 0) transport.setProgress(ms / total)
      }

    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  // --- Data loading & initialization ---
  async function initialize() {
    try {
      tracePlayback("session:initialize:start", { bookId, language: currentLanguage }, true)
      let manifest: AudioManifest

      // Load bookmark early so persisted language is used for initial data load
      const bookmark = bookmarks.load(bookId)

      const preloadedSegments = initialState?.segmentsData as { segments: BookSegment[] } | undefined
      const preloadedManifest = initialState?.audioManifest as AudioManifest | undefined
      const resolveAssetUrl = initialState?.resolveAssetUrl as ((path: string) => string) | undefined
      mediaArtworkUrl = getMediaSessionArtworkUrl()

      if (preloadedSegments && preloadedManifest && resolveAssetUrl) {
        // Production: host provides preloaded data
        dataProvider = createPreloadedDataProvider(
          { version: "2.0.0", book_id: "", total_segments: preloadedSegments.segments.length, segments: preloadedSegments.segments },
          preloadedManifest,
          resolveAssetUrl
        )
        segments = preloadedSegments.segments
        manifest = preloadedManifest
      } else {
        // Fetch via HTTP (dev mode or manifest.json install)
        const dataUrl =
          (initialState?.dataUrl as string) ||
          detectDataUrl()
        const contentRevision = initialState?.contentRevision as string | undefined
        dataProvider = createFetchDataProvider(dataUrl, contentRevision)

        const segData = await dataProvider.loadSegments(currentLanguage)
        segments = segData.segments
        isPreview =
          segData.is_preview === true ||
          (typeof segData.total_segments === "number" &&
            segData.segments.length < segData.total_segments)
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

      // Only set nowPlaying — languages/currentLanguage are managed by appShell
      drawerStore.setState({ nowPlaying: { bookTitle: bookDisplayName } })

      // Build chapter index
      chapters = buildChapterIndex(segments)

      // Update the per-book hasChapters cache so the *next* mount of
      // this book reserves (or doesn't) the chapter title row before
      // segments load.
      const hasChapters = chapters.length > 1
      transport.setHasChapters(hasChapters)
      if (cachedMeta?.hasChapters !== hasChapters) {
        bookMeta.save(bookId, { ...cachedMeta, hasChapters })
      }

      // Build timeline
      const timeline = buildTimeline(segments, manifest)
      timelineWords = timeline.words

      // Create waveform cache
      waveformCache = createWaveformCache()

      // Create audio engine with waveform extraction callback
      audioEngine = createAudioEngine(
        segments,
        manifest,
        dataProvider.resolveAudioUrl,
        (index) => {
          const seg = segments[index]
          if (seg) {
            transport.setChapter(seg.title)
            reportSegmentProgress(index)
            // Avoid native bridge work on every segment boundary; it can hitch playback.
            // Play/pause/seek/chapter controls still trigger explicit now-playing updates.
            if (audioEngine?.isPlaying()) {
              analytics.track("segment_play", { segment_index: index })
            }
          }
        },
        () => {
          // Playback ended
          isPlaying = false
          desiredPlaying = false
          transport.setPlaying(false)
          syncMediaSessionPlaybackState("paused")
          releaseWakeLock()
          stopBackgroundTimers()
          backgroundedAt = 0
          void stopNativeKeepAlive()
          nativeSessionActive = false
          nativePlaybackStateHint = "unknown"
          // Corpán Plus: finished preview → ask host to surface the paywall.
          if (isPreview) {
            maybeOfferPlus()
          }
        },
        (segmentId, buffer) => {
          // Extract waveform envelopes as audio buffers are decoded
          const entry = manifest.segments[segmentId]
          if (entry && waveformCache) {
            waveformCache.extractFromBuffer(segmentId, buffer, entry.words)
          }
        }
      )

      // Create word stream (flat planes, no waveform shaping)
      wordStream = createWordStream(scene)
      wordStream.configure(prefs.wordHoldConfig)

      // Create waveform stream (arch ribbon showing audio envelope along Z)
      waveformStream = createWaveformStream(scene)
      waveformStream.mesh.isVisible = prefs.waveform
      waveformStream.configure(prefs.waveformConfig)

      // Create oscilloscope — just a line, no ribbon
      oscilloscope = createOscilloscope(scene)
      oscilloscope.mesh.isVisible = prefs.oscilloscope
      oscilloscope.configure(prefs.oscilloscopeConfig)

      // Create pulse ring — amplitude circle at the NOW plane
      pulseRing = createPulseRing(scene)
      pulseRing.configure(prefs.pulseRingConfig)
      pulseRing.setVisible(prefs.pulseRing)

      // Rendering group depth clearing: words on top of stream, oscilloscope on top of all
      scene.setRenderingAutoClearDepthStencil(1, true, true, true)
      scene.setRenderingAutoClearDepthStencil(2, true, true, true)

      // Empty for chapterless books — `.stargate-chapter-title:empty`
      // collapses the row so the book title stays vertically centered
      // against the time. Don't fall back to a status string like
      // "Ready"; it would flicker on language switches and shrink to
      // empty on first play.
      transport.setChapter(segments[0]?.title || "")

      // Set chapter markers on scrub bar
      if (audioEngine && chapters.length > 0) {
        const starts = audioEngine.getSegmentAbsoluteStartMs()
        const total = audioEngine.getTotalDurationMs()
        if (total > 0) {
          transport.setChapterMarkers(
            chapters.map(c => starts[c.firstSegmentIndex] / total)
          )
        }
      }

      // Restore bookmark position (language already applied before data load)
      if (initialState?.startAtSegmentStart && bookmark && audioEngine) {
        audioEngine.seekToSegment(bookmark.segmentIndex)
      } else if (bookmark && audioEngine) {
        audioEngine.seekToMs(bookmark.timeMs)
      }

      setupMediaSession()
      syncNativeNowPlaying()
      tracePlayback("session:initialize:ready", { segments: segments.length, language: currentLanguage }, true)

      // Auto-play if requested (after all setup is complete)
      if (initialState?.autoPlay) {
        void doPlay()
      }
    } catch (err) {
      console.error("[StargateReader] Failed to initialize:", err)
      tracePlayback("session:initialize:error", { error: String(err) }, true)
      transport.setChapter("Failed to load book data")
    }
  }

  /**
   * Detect the data URL based on runtime context.
   *
   * Priority:
   * 1. baseUrl from host with corpan-pack:// scheme (on-device production)
   * 2. baseUrl from host with HTTP scheme — local = dev, remote = production
   * 3. Vite dev server proxy (localhost standalone dev)
   */
  function detectDataUrl(): string {
    if (typeof window === "undefined") return "."

    const params = new URLSearchParams(window.location.search)
    const bid = params.get("book") || "book_monte_alban"

    const baseUrl = initialState?.baseUrl as string | undefined

    // On-device production (zip install) — pack root IS the data directory
    if (baseUrl?.startsWith("corpan-pack://")) {
      return baseUrl.replace(/\/$/, "")
    }

    // HTTP base (manifest.json install — local dev server or remote)
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    // Standalone dev mode (npm run dev): Vite proxy handles /data/books/
    return `/data/books/${bid}`
  }

  // --- Render loop ---
  function renderLoop() {
    if (disposed) return

    // Lockscreen controls can pause/resume WebAudio via WebKit without
    // delivering JS action handlers. Reconcile app state with engine state.
    if (audioEngine) {
      const now = performance.now()
      if (now < suppressExternalReconcileUntil) {
        pendingEngineState = null
      } else {
        const enginePlaying = audioEngine.isPlaying()
        if (enginePlaying !== isPlaying) {
          const nextState: MediaSessionPlaybackState = enginePlaying ? "playing" : "paused"
          if (pendingEngineState !== nextState) {
            pendingEngineState = nextState
            pendingEngineStateSince = now
          }
          if (now - pendingEngineStateSince >= EXTERNAL_STATE_DEBOUNCE_MS) {
            pendingEngineState = null

            if (!enginePlaying && desiredPlaying) {
              const ctxState = audioEngine.getContextState()
              if (ctxState === "suspended") {
                // Native/OS pause can suspend context without delivering JS
                // action handlers. Treat it as authoritative pause.
                tracePlayback("reconcile:external-pause-detected", {
                  enginePlaying,
                  appPlayingBefore: isPlaying,
                  pendingState: nextState,
                  ctxState,
                }, true)
                if (!playInFlight) {
                  doPause()
                }
              } else {
                // Running context + no source is a recoverable seam hole.
                tracePlayback("reconcile:hold-desired-playing", {
                  enginePlaying,
                  appPlayingBefore: isPlaying,
                  pendingState: nextState,
                  ctxState,
                }, true)
                audioEngine.ensureSourceIfPlaying("reconcile:hold-desired-playing")
              }
            } else {
              console.log(`[SR:sync] reconciled engine/app mismatch -> engine=${enginePlaying} app=${isPlaying}`)
              tracePlayback("reconcile:mismatch", {
                enginePlaying,
                appPlayingBefore: isPlaying,
                pendingState: nextState,
              }, true)
              isPlaying = enginePlaying
              transport.setPlaying(isPlaying)
              syncMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
              if (isPlaying) {
                void requestWakeLock()
              } else {
                releaseWakeLock()
                stopBackgroundTimers()
                if (document.hidden) backgroundedAt = 0
              }
              syncNativeNowPlaying()
            }
          }
        } else {
          pendingEngineState = null
        }
      }
    }

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0
    const totalMs = audioEngine?.getTotalDurationMs() ?? 0

    // Apply swipe visual offset (drag preview + ease-out animation)
    if (swipeAnimating) {
      const elapsed = performance.now() - swipeAnimStart
      if (elapsed >= SWIPE_ANIM_DURATION_MS) {
        swipeVisualOffsetMs = 0
        swipeAnimating = false
      } else {
        const t = elapsed / SWIPE_ANIM_DURATION_MS
        const ease = 1 - (1 - t) * (1 - t) // ease-out quadratic
        swipeVisualOffsetMs = swipeAnimFrom * (1 - ease)
      }
    }
    const visualMs = currentMs + swipeVisualOffsetMs

    // Update time display and scrub bar progress
    transport.setTime(currentMs, totalMs)
    if (totalMs > 0) {
      transport.setProgress(currentMs / totalMs)
    }

    // Autosave bookmark + update lock screen metadata during playback
    if (isPlaying && currentMs - lastAutosaveMs > AUTOSAVE_INTERVAL_MS) {
      lastAutosaveMs = currentMs
      persistBookmark()
      syncNativeNowPlaying("periodic")
    }

    // Keep active WebKit card pinned to the app's timeline/metadata.
    if (isPlaying && performance.now() - lastMediaSessionSyncAt > MEDIA_SESSION_RESYNC_INTERVAL_MS) {
      lastMediaSessionSyncAt = performance.now()
      syncMediaSessionNowPlaying()
    }

    // Chapter transition detection
    if (audioEngine && chapters.length > 0) {
      const segIdx = audioEngine.getCurrentSegmentIndex()
      let chapterIdx = 0
      for (let i = chapters.length - 1; i >= 0; i--) {
        if (segIdx >= chapters[i].firstSegmentIndex) {
          chapterIdx = i
          break
        }
      }
      if (chapterIdx !== lastChapterIndex) {
        lastChapterIndex = chapterIdx
        chapterOverlay.show(chapters[chapterIdx].title)
      }
    }

    // Find current word (use visualMs so highlight tracks the visual position)
    if (timelineWords.length > 0) {
      const idx = findCurrentWordIndex(timelineWords, visualMs, currentWordHint)
      if (idx >= 0) currentWordHint = idx
    }

    // Update word stream (visualMs for smooth swipe animation)
    if (wordStream && timelineWords.length > 0) {
      wordStream.update(visualMs, timelineWords, currentWordHint, wordHoldEnabled)
    }

    // Update waveform stream (visualMs for smooth swipe animation)
    if (waveformStream && waveformStream.mesh.isVisible && timelineWords.length > 0 && waveformCache) {
      waveformStream.update(visualMs, timelineWords, waveformCache, currentWordHint)
    }

    // Update oscilloscope + pulse ring
    if (audioEngine && (oscilloscope?.mesh.isVisible || pulseRing?.mesh.isVisible)) {
      const analyserData = audioEngine.getAnalyserData()

      // Byte-based intensity for oscilloscope
      const instant = Math.abs(analyserData[analyserData.length - 1] - 128) / 128

      if (oscilloscope?.mesh.isVisible) {
        oscilloscope.update(analyserData, Math.max(instant, 0.15))
      }
      if (pulseRing?.mesh.isVisible) {
        // Float32 time domain — full precision, no 8-bit quantization
        const floatData = audioEngine.getFloatTimeDomain()
        const sample = Math.abs(floatData[floatData.length - 1])
        pulseRing.update(Math.min(sample * 5, 1))
      }
    }

    scene.render()
  }

  // Start render loop
  engine.runRenderLoop(renderLoop)

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    engine.resize()
  })
  resizeObserver.observe(canvas as unknown as Element)

  // Kick off data loading
  void initialize()

  // --- Dispose (named so we can late-bind to the close button) ---
  function dispose() {
    if (disposed) return
    disposed = true

    // Stop audio immediately — before any other cleanup
    doPause()

    releaseWakeLock()
    void stopNativeKeepAlive()
    nativeSessionActive = false
    nativePlaybackStateHint = "unknown"
    if (removeRemoteListeners) { removeRemoteListeners(); removeRemoteListeners = null }
    if (window.__readerCmd) {
      delete window.__readerCmd
    }
    stopBackgroundTimers()

    document.removeEventListener("visibilitychange", handleVisibilityChange)
    canvas.removeEventListener("touchstart", onSwipeTouchStart)
    canvas.removeEventListener("touchmove", onSwipeTouchMove)
    canvas.removeEventListener("touchend", onSwipeTouchEnd)
    canvas.removeEventListener("touchcancel", onSwipeTouchEnd)
    resizeObserver.disconnect()

    // Clear MediaSession so lock screen doesn't show stale player
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null
        for (const action of ["play", "pause", "seekto", "seekforward", "seekbackward", "nexttrack", "previoustrack"] as MediaSessionAction[]) {
          try { navigator.mediaSession.setActionHandler(action, null) } catch (e) { console.warn("[SR] clearActionHandler:", e) }
        }
      } catch (e) { console.warn("[SR] dispose mediaSession cleanup:", e) }
    }

    persistBookmark()
    chapterOverlay.dispose()
    transport.dispose()
    mediaAnchor?.dispose()
    mediaAnchor = null
    audioEngine?.dispose()
    waveformCache?.dispose()
    wordStream?.dispose()
    waveformStream?.dispose()
    oscilloscope?.dispose()
    pulseRing?.dispose()
    starfield?.dispose()
    glow.dispose()
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    wrapper.remove()
  }

  return {
    dispose,
    /** Persist bookmark (called by appShell before exit) */
    persistBookmark,
    /** Whether audio is currently playing */
    isPlaying: () => isPlaying,
    /** Get display settings DrawerSectionDef for injection into command drawer */
    getDisplaySection(): DrawerSectionDef {
      return {
        id: "display",
        title: "Display",
        priority: 40,
        render: (container) => {
          renderStargateDisplaySettings(container, {
            initialOscilloscope: prefs.oscilloscope,
            initialWaveform: prefs.waveform,
            initialPulseRing: prefs.pulseRing,
            initialWordHold: prefs.wordHold,
            initialWordHoldConfig: prefs.wordHoldConfig,
            initialOscilloscopeConfig: prefs.oscilloscopeConfig,
            initialWaveformConfig: prefs.waveformConfig,
            initialPulseRingConfig: prefs.pulseRingConfig,
            callbacks: displaySettingsCallbacks,
          })
        },
      }
    },
  }
}
