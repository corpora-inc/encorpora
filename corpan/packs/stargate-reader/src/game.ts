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
import type { HostApi } from "./sdk/types"
import type { AudioManifest, BookSegment, TimelineWord } from "./core/types"
import { CAMERA_FOV, CAMERA_Z, GLOW_INTENSITY, LANGUAGE_NAMES, VOICE_NAMES, BOOK_NAMES } from "./core/constants"
import { buildTimeline, findCurrentWordIndex, buildChapterIndex } from "./core/timeline"
import type { ChapterInfo } from "./core/types"
import {
  createFetchDataProvider,
  createPreloadedDataProvider,
  type DataProvider,
} from "./data/dataProvider"
import { createAudioEngine, type AudioEngine } from "./audio/audioEngine"
import { createWaveformCache, type WaveformCache } from "./audio/waveformExtractor"
import { createWordStream, type WordStream } from "./rendering/wordStream"
import { createOscilloscope, type Oscilloscope } from "./rendering/oscilloscope"
import { createWaveformStream, type WaveformStream } from "./rendering/waveformStream"
import { createPulseRing, type PulseRing } from "./rendering/pulseRing"
import { createStarfield, type Starfield } from "./rendering/starfield"
import { createTransportBar } from "./ui/transportBar"
import { createChapterOverlay, type ChapterOverlay } from "./ui/chapterOverlay"
import { createSettingsPanel, type LanguageInfo } from "./ui/settingsPanel"
import { loadBookmark, saveBookmark, type Bookmark } from "./state/bookmarkStore"
import { loadPrefs, savePrefs, type DisplayPrefs } from "./state/prefsStore"
import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  pauseNativeKeepAlive,
  resumeNativeKeepAlive,
  updateNativeNowPlaying,
  listenForRemoteCommands,
} from "./audio/nativeKeepAlive"

type StargateRemoteCommand = "play" | "pause"
type NowPlayingMetadata = {
  title: string
  artist: string
  album: string
}

declare global {
  interface Window {
    __stargateCmd?: (cmd: StargateRemoteCommand) => void
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
    } catch { /* user denied or API unsupported */ }
  }

  function releaseWakeLock() {
    wakeLock?.release()
    wakeLock = null
  }

  // --- Background audio keepalive ---
  let bgNowPlayingTimer: ReturnType<typeof setInterval> | null = null
  let nativeSessionActive = false
  let removeRemoteListeners: (() => void) | null = null
  let playInFlight = false
  let desiredPlaying = false
  let playRequestSeq = 0
  let mediaArtworkUrl: string | undefined
  let lastMediaSessionSyncAt = 0
  const MEDIA_SESSION_RESYNC_INTERVAL_MS = 1000

  // --- Background recovery timing ---
  let backgroundedAt = 0        // wall-clock ms when app went to background
  let backgroundedAudioMs = 0   // audio position ms when app went to background

  // --- Background timer management ---
  function startBackgroundTimers() {
    if (!bgNowPlayingTimer) {
      console.log("[SR:bg] start background now-playing timer")
      bgNowPlayingTimer = setInterval(() => {
        if (!audioEngine || !isPlaying) return
        syncNativeNowPlaying("periodic")
        persistBookmark()
      }, 10000)
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
  function syncNativeNowPlaying(mode: "state" | "periodic" = "state") {
    syncMediaSessionNowPlaying()
    if (!nativeSessionActive || !audioEngine) return
    // Avoid high-frequency dual-writer contention while active playback is ongoing.
    // Still allow state transitions (play/pause/seek/chapter changes) to update native.
    if (mode === "periodic" && isPlaying) return
    const metadata = getNowPlayingMetadata()
    void updateNativeNowPlaying(
      metadata.title,
      metadata.artist,
      audioEngine.getCurrentTimeMs(),
      audioEngine.getTotalDurationMs(),
      isPlaying
    )
  }

  function syncMediaSessionPlaybackState(state: MediaSessionPlaybackState) {
    if (!("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.playbackState = state
    } catch {
      // Best effort only
    }
  }

  function syncMediaSessionNowPlaying() {
    if (!("mediaSession" in navigator) || !audioEngine) return
    const metadata = getNowPlayingMetadata()
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        artwork: mediaArtworkUrl
          ? [{ src: mediaArtworkUrl, sizes: "200x200", type: "image/png" }]
          : undefined,
      })

      const durationS = audioEngine.getTotalDurationMs() / 1000
      if (Number.isFinite(durationS) && durationS > 0) {
        const positionS = Math.max(0, Math.min(audioEngine.getCurrentTimeMs() / 1000, durationS))
        navigator.mediaSession.setPositionState({
          duration: durationS,
          playbackRate: 1,
          position: positionS,
        })
      }
    } catch {
      // Best effort only
    }
  }

  // --- Centralized play/pause helpers (background-aware) ---
  async function doPlay() {
    desiredPlaying = true
    const requestId = ++playRequestSeq
    if (!audioEngine || isPlaying || playInFlight) return
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
        console.log(`[SR:doPlay] startNativeKeepAlive resolved +${(performance.now() - t0).toFixed(1)}ms`)
        if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
          console.log("[SR:doPlay] canceled after startNativeKeepAlive")
          syncMediaSessionPlaybackState("paused")
          if (nativeSessionActive) void pauseNativeKeepAlive()
          syncNativeNowPlaying()
          return
        }
      } else {
        console.log(`[SR:doPlay] awaiting resumeNativeKeepAlive +${(performance.now() - t0).toFixed(1)}ms`)
        await resumeNativeKeepAlive()
        console.log(`[SR:doPlay] resumeNativeKeepAlive resolved +${(performance.now() - t0).toFixed(1)}ms`)
        if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
          console.log("[SR:doPlay] canceled after resumeNativeKeepAlive")
          syncMediaSessionPlaybackState("paused")
          if (nativeSessionActive) void pauseNativeKeepAlive()
          syncNativeNowPlaying()
          return
        }
      }

      // NOW create/resume AudioContext — native session is stable
      await audioEngine.recoverContext()
      console.log(`[SR:doPlay] recoverContext done +${(performance.now() - t0).toFixed(1)}ms ctx.state=${audioEngine.getContextState()}`)
      if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
        console.log("[SR:doPlay] canceled after recoverContext")
        syncMediaSessionPlaybackState("paused")
        if (nativeSessionActive) void pauseNativeKeepAlive()
        syncNativeNowPlaying()
        return
      }

      // Re-register after context/session churn.
      setupMediaSession()
      audioEngine.unlock()
      console.log(`[SR:doPlay] unlock done +${(performance.now() - t0).toFixed(1)}ms`)

      audioEngine.play()
      console.log(`[SR:doPlay] audioEngine.play() done +${(performance.now() - t0).toFixed(1)}ms ctx.state=${audioEngine.getContextState()}`)
      if (requestId !== playRequestSeq || !desiredPlaying || disposed) {
        console.log("[SR:doPlay] canceled after audioEngine.play(); forcing pause")
        audioEngine.pause()
        syncMediaSessionPlaybackState("paused")
        if (nativeSessionActive) void pauseNativeKeepAlive()
        syncNativeNowPlaying()
        return
      }

      isPlaying = audioEngine.isPlaying()
      transport.setPlaying(isPlaying)
      syncMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
      lastMediaSessionSyncAt = performance.now()
      if (isPlaying) {
        void requestWakeLock()
      } else {
        releaseWakeLock()
      }

      // Fire-and-forget — just metadata, no audio session changes
      syncNativeNowPlaying()

      // Background timers
      if (document.hidden) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
        startBackgroundTimers()
      }
    } finally {
      playInFlight = false
    }
  }

  function doPause() {
    desiredPlaying = false
    playRequestSeq += 1
    if (!audioEngine) return
    if (!isPlaying) {
      transport.setPlaying(false)
      syncMediaSessionPlaybackState("paused")
      lastMediaSessionSyncAt = 0
      releaseWakeLock()
      void pauseNativeKeepAlive()
      syncNativeNowPlaying()
      stopBackgroundTimers()
      if (document.hidden) backgroundedAt = 0
      return
    }
    audioEngine.pause()
    isPlaying = false
    transport.setPlaying(false)
    syncMediaSessionPlaybackState("paused")
    lastMediaSessionSyncAt = 0
    persistBookmark()
    releaseWakeLock()
    void pauseNativeKeepAlive()
    syncNativeNowPlaying()
    stopBackgroundTimers()
    if (document.hidden) backgroundedAt = 0
  }

  // Module-level state for language/book switching
  let dataProvider: DataProvider
  let segments: BookSegment[] = []
  let chapters: ChapterInfo[] = []
  let currentLanguage = "en"
  let availableLanguages = (initialState?.availableLanguages as string[]) || ["en"]
  const voiceMap: Record<string, string> = {}

  function buildLanguageInfos(): LanguageInfo[] {
    return availableLanguages.map(code => ({
      code,
      displayName: LANGUAGE_NAMES[code] || code.toUpperCase(),
      narrator: VOICE_NAMES[voiceMap[code] || ""] || "",
    }))
  }

  // Book ID for bookmark namespacing
  const bookId =
    (initialState?.bookId as string) ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("book") || "book_monte_alban"
      : "unknown")

  const bookDisplayName = BOOK_NAMES[bookId] || bookId

  function getResolvedBookTitle(): string {
    // Prefer explicit display name, but avoid exposing raw IDs as metadata.
    if (bookDisplayName && bookDisplayName !== bookId) return bookDisplayName
    return BOOK_NAMES.book_monte_alban || "The Mystery of Monte Albán"
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

  // Bookmark persistence
  function persistBookmark() {
    if (!audioEngine) return
    const bm: Bookmark = {
      timeMs: audioEngine.getCurrentTimeMs(),
      segmentIndex: audioEngine.getCurrentSegmentIndex(),
      language: currentLanguage,
      savedAt: Date.now(),
    }
    saveBookmark(bookId, bm)
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

  // Babylon.js engine
  const engine = new Engine(canvas, true, {
    antialias: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
  })

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.03, 0.06, 1)

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
  camera.maxZ = 200
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

  // Glow layer for neon effects
  const glow = new GlowLayer("glow", scene)
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

  // Create starfield immediately (doesn't need data)
  starfield = createStarfield(scene)

  // Playback state
  let isPlaying = false

  // --- Display preferences (persisted per book) ---
  const prefs: DisplayPrefs = loadPrefs(bookId)

  // --- Settings panel (gear dropdown) ---
  // Late-bound reference so the exit button can call full dispose
  let disposeFn: (() => void) | null = null
  const settings = createSettingsPanel(ui, {
    initialOscilloscope: prefs.oscilloscope,
    initialWaveform: prefs.waveform,
    initialPulseRing: prefs.pulseRing,
    initialWordHold: prefs.wordHold,
    initialWordHoldConfig: prefs.wordHoldConfig,
    initialOscilloscopeConfig: prefs.oscilloscopeConfig,
    initialWaveformConfig: prefs.waveformConfig,
    initialPulseRingConfig: prefs.pulseRingConfig,
    onBeforeClose: () => disposeFn?.(),
  })

  // --- Chapter overlay ---
  let chapterOverlay: ChapterOverlay = createChapterOverlay(ui)
  let lastChapterIndex = -1

  // --- Transport bar ---
  const transport = createTransportBar(ui)
  settings.setLanguages(buildLanguageInfos(), currentLanguage)

  transport.onPlay(() => {
    void doPlay()
    setupMediaSession()
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
    audioEngine.seekToSegment(chapters[targetChapter].firstSegmentIndex)
    transport.setChapter(chapters[targetChapter].title)
    syncNativeNowPlaying()
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
    audioEngine.seekToSegment(chapters[targetChapter].firstSegmentIndex)
    transport.setChapter(chapters[targetChapter].title)
    syncNativeNowPlaying()
  })

  transport.onSkipBack(() => {
    if (!audioEngine) return
    audioEngine.seekToMs(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
    syncNativeNowPlaying()
  })

  transport.onSkipForward(() => {
    if (!audioEngine) return
    audioEngine.seekToMs(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
    syncNativeNowPlaying()
  })

  // --- Scrub lifecycle ---
  let wasPlayingBeforeScrub = false

  transport.onScrubStart(() => {
    wasPlayingBeforeScrub = isPlaying
    if (wasPlayingBeforeScrub) doPause()
  })

  transport.onScrubMove((fraction) => {
    if (!audioEngine) return
    audioEngine.seekToMsPreview(fraction * audioEngine.getTotalDurationMs())
  })

  transport.onScrubEnd((fraction) => {
    if (!audioEngine) return
    audioEngine.seekToMsPreview(fraction * audioEngine.getTotalDurationMs())
    if (wasPlayingBeforeScrub) void doPlay()
    else syncNativeNowPlaying()
  })

  settings.onLanguageChange((lang) => {
    void switchLanguage(lang)
  })

  window.__stargateCmd = (cmd: StargateRemoteCommand) => {
    console.log(`[SR:cmd] window.__stargateCmd(${cmd})`)
    if (cmd === "play") {
      void doPlay()
      return
    }
    if (cmd === "pause") {
      doPause()
    }
  }

  let wordHoldEnabled = prefs.wordHold

  settings.onToggleWordHold((enabled) => {
    wordHoldEnabled = enabled
    prefs.wordHold = enabled
    savePrefs(bookId, prefs)
  })

  settings.onWordHoldConfig((key, value) => {
    wordStream?.configure({ [key]: value })
    ;(prefs.wordHoldConfig as Record<string, number>)[key] = value
    savePrefs(bookId, prefs)
  })

  settings.onToggleOscilloscope((visible) => {
    if (oscilloscope) oscilloscope.mesh.isVisible = visible
    prefs.oscilloscope = visible
    savePrefs(bookId, prefs)
  })

  settings.onToggleWaveform((visible) => {
    if (waveformStream) waveformStream.mesh.isVisible = visible
    prefs.waveform = visible
    savePrefs(bookId, prefs)
  })

  settings.onTogglePulseRing((visible) => {
    pulseRing?.setVisible(visible)
    prefs.pulseRing = visible
    savePrefs(bookId, prefs)
  })

  settings.onOscilloscopeConfig((key, value) => {
    oscilloscope?.configure({ [key]: value })
    ;(prefs.oscilloscopeConfig as Record<string, number>)[key] = value
    savePrefs(bookId, prefs)
  })

  settings.onWaveformConfig((key, value) => {
    waveformStream?.configure({ [key]: value })
    ;(prefs.waveformConfig as Record<string, number>)[key] = value
    savePrefs(bookId, prefs)
  })

  settings.onPulseRingConfig((key, value) => {
    pulseRing?.configure({ [key]: value })
    ;(prefs.pulseRingConfig as Record<string, number>)[key] = value
    savePrefs(bookId, prefs)
  })

  // --- Native remote command listeners (lock screen / notification) ---
  removeRemoteListeners = listenForRemoteCommands({
    onPlay: () => {
      console.log("[SR:cmd] native listener onPlay")
      void doPlay()
    },
    onPause: () => {
      console.log("[SR:cmd] native listener onPause")
      doPause()
    },
    onSkipForward: () => {
      if (!audioEngine) return
      audioEngine.seekToMs(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
      syncNativeNowPlaying()
    },
    onSkipBack: () => {
      if (!audioEngine) return
      audioEngine.seekToMs(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
      syncNativeNowPlaying()
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
      audioEngine.seekToSegment(chapters[targetChapter].firstSegmentIndex)
      transport.setChapter(chapters[targetChapter].title)
      syncNativeNowPlaying()
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
      audioEngine.seekToSegment(chapters[targetChapter].firstSegmentIndex)
      transport.setChapter(chapters[targetChapter].title)
      syncNativeNowPlaying()
    },
    onSeek: (positionMs: number) => {
      if (!audioEngine) return
      audioEngine.seekToMs(positionMs)
      syncNativeNowPlaying()
    },
    onInterruptionBegan: () => {
      if (!audioEngine || !isPlaying) return
      doPause()
    },
    onInterruptionEnded: (shouldResume: boolean) => {
      if (!audioEngine) return
      if (shouldResume) void doPlay()
    },
  })

  // --- Media Session API (lock screen controls) ---
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return
    syncMediaSessionNowPlaying()

    const disabledActions: MediaSessionAction[] = [
      "seekbackward",
      "seekforward",
      "seekto",
      "nexttrack",
      "previoustrack",
    ]
    for (const action of disabledActions) {
      try {
        navigator.mediaSession.setActionHandler(action, null)
      } catch {
        // Best effort: unsupported action on this platform.
      }
    }

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { void doPlay() }],
      ["pause", () => { doPause() }],
    ]

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // iOS/WebKit support differs by action and version.
      }
    }
  }

  // --- Periodic bookmark autosave (every 15s during playback) ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000

  // --- Screen lock behavior ---
  function handleVisibilityChange() {
    if (document.hidden) {
      console.log(`[SR:vis] hidden (isPlaying=${isPlaying})`)
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
    } else {
      console.log(`[SR:vis] visible (isPlaying=${isPlaying})`)
      // Foregrounded
      stopBackgroundTimers()
      engine.runRenderLoop(renderLoop)

      if (audioEngine) {
        // ALWAYS attempt recovery, not just when isPlaying
        void audioEngine.recoverContext().then(() => {
          if (!audioEngine) return

          if (isPlaying) {
            // Drift detection
            if (backgroundedAt > 0) {
              const wallElapsed = Date.now() - backgroundedAt
              const expectedMs = backgroundedAudioMs + wallElapsed
              const actualMs = audioEngine.getCurrentTimeMs()
              const totalMs = audioEngine.getTotalDurationMs()
              if (Math.abs(expectedMs - actualMs) > 2000 && expectedMs < totalMs) {
                audioEngine.seekToMs(Math.min(expectedMs, totalMs))
              }
            }
            // Ensure audio is actually playing after recovery
            if (!audioEngine.isPlaying()) {
              audioEngine.play()
            }
            audioEngine.unlock()
            void requestWakeLock()
          }

          // Sync native with actual state
          syncNativeNowPlaying()
        })
      }

      // Force transport UI sync (eliminates any single-frame inconsistency)
      transport.setPlaying(isPlaying)
      if (audioEngine) {
        const ms = audioEngine.getCurrentTimeMs()
        const total = audioEngine.getTotalDurationMs()
        transport.setTime(ms, total)
        if (total > 0) transport.setProgress(ms / total)
      }

      backgroundedAt = 0
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  // --- Data loading & initialization ---
  async function initialize() {
    try {
      let manifest: AudioManifest

      // Load bookmark early so persisted language is used for initial data load
      const bookmark = loadBookmark(bookId)

      const preloadedSegments = initialState?.segmentsData as { segments: BookSegment[] } | undefined
      const preloadedManifest = initialState?.audioManifest as AudioManifest | undefined
      const resolveAssetUrl = initialState?.resolveAssetUrl as ((path: string) => string) | undefined
      const baseUrl = initialState?.baseUrl as string | undefined
      mediaArtworkUrl = resolveAssetUrl
        ? resolveAssetUrl("stargate-reader-avatar.png")
        : (baseUrl ? `${baseUrl.replace(/\/$/, "")}/stargate-reader-avatar.png` : "stargate-reader-avatar.png")

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

        // Auto-detect available languages in dev mode
        if (availableLanguages.length <= 1 && dataProvider.detectLanguages) {
          const detected = await dataProvider.detectLanguages()
          if (detected.length > 1) {
            availableLanguages = detected
          }
        }

        // Apply bookmarked language now that available languages are known
        if (bookmark && availableLanguages.includes(bookmark.language)) {
          currentLanguage = bookmark.language
        }

        const segData = await dataProvider.loadSegments(currentLanguage)
        segments = segData.segments
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

      // Record voice for current language and update settings display
      voiceMap[currentLanguage] = manifest.voice
      settings.setLanguages(buildLanguageInfos(), currentLanguage)

      // Fire background fetches for other languages to populate voiceMap
      for (const lang of availableLanguages) {
        if (lang !== currentLanguage) {
          dataProvider.loadAudioManifest(lang).then(m => {
            voiceMap[lang] = m.voice
            settings.setLanguages(buildLanguageInfos(), currentLanguage)
          }).catch(() => {})
        }
      }

      // Build chapter index
      chapters = buildChapterIndex(segments)

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
            syncNativeNowPlaying()
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

      transport.setChapter(segments[0]?.title || "Ready")

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
      if (bookmark && audioEngine) {
        audioEngine.seekToMs(bookmark.timeMs)
      }

      setupMediaSession()
      syncNativeNowPlaying()
    } catch (err) {
      console.error("[StargateReader] Failed to initialize:", err)
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

    // On-device production (zip install)
    if (baseUrl?.startsWith("corpan-pack://")) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    // HTTP base (manifest.json install — local dev server or remote)
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    // Standalone dev mode (npm run dev): Vite proxy handles /data/books/
    return `/data/books/${bid}`
  }

  /**
   * Switch audio language: reload segments + manifest, rebuild timeline and audio engine.
   */
  async function switchLanguage(newLang: string) {
    if (newLang === currentLanguage || !dataProvider) return

    try {
      const wasPlaying = isPlaying
      const savedSegmentIndex = audioEngine?.getCurrentSegmentIndex() ?? 0

      // Dispose current audio
      audioEngine?.dispose()
      audioEngine = null
      waveformCache?.dispose()
      waveformCache = null

      currentLanguage = newLang

      // Load new segments and manifest in parallel
      const [segData, manifest] = await Promise.all([
        dataProvider.loadSegments(newLang),
        dataProvider.loadAudioManifest(newLang),
      ])
      if (disposed) return

      segments = segData.segments
      voiceMap[newLang] = manifest.voice
      settings.setLanguages(buildLanguageInfos(), newLang)
      chapters = buildChapterIndex(segments)

      // Rebuild timeline
      const timeline = buildTimeline(segments, manifest)
      timelineWords = timeline.words
      currentWordHint = 0

      // Recreate waveform cache + audio engine
      waveformCache = createWaveformCache()
      audioEngine = createAudioEngine(
        segments,
        manifest,
        dataProvider.resolveAudioUrl,
        (index) => {
          const seg = segments[index]
          if (seg) {
            transport.setChapter(seg.title)
            syncNativeNowPlaying()
          }
        },
        () => {
          isPlaying = false
          desiredPlaying = false
          transport.setPlaying(false)
          syncMediaSessionPlaybackState("paused")
          releaseWakeLock()
          stopBackgroundTimers()
          backgroundedAt = 0
          void stopNativeKeepAlive()
          nativeSessionActive = false
        },
        (segmentId, buffer) => {
          const entry = manifest.segments[segmentId]
          if (entry && waveformCache) {
            waveformCache.extractFromBuffer(segmentId, buffer, entry.words)
          }
        }
      )

      // Reset chapter tracking
      lastChapterIndex = -1

      // Update chapter markers for new manifest
      if (chapters.length > 0) {
        const starts = audioEngine.getSegmentAbsoluteStartMs()
        const total = audioEngine.getTotalDurationMs()
        if (total > 0) {
          transport.setChapterMarkers(
            chapters.map(c => starts[c.firstSegmentIndex] / total)
          )
        }
      }

      // Seek to approximate position
      audioEngine.seekToSegment(savedSegmentIndex)

      // Resume if was playing
      if (wasPlaying) {
        audioEngine.unlock()
        audioEngine.play()
        isPlaying = true
        transport.setPlaying(true)
      }
    } catch (err) {
      console.error("[StargateReader] Failed to switch language:", err)
    }
  }

  // --- Render loop ---
  function renderLoop() {
    if (disposed) return

    // Lockscreen controls can pause/resume WebAudio via WebKit without
    // delivering JS action handlers. Reconcile app state with engine state.
    if (audioEngine) {
      const enginePlaying = audioEngine.isPlaying()
      if (enginePlaying !== isPlaying) {
        console.log(`[SR:sync] engine/app mismatch -> engine=${enginePlaying} app=${isPlaying}`)
        isPlaying = enginePlaying
        desiredPlaying = enginePlaying
        transport.setPlaying(isPlaying)
        syncMediaSessionPlaybackState(isPlaying ? "playing" : "paused")
        if (isPlaying) {
          void requestWakeLock()
          if (nativeSessionActive) void resumeNativeKeepAlive()
        } else {
          releaseWakeLock()
          stopBackgroundTimers()
          if (nativeSessionActive) void pauseNativeKeepAlive()
          if (document.hidden) backgroundedAt = 0
        }
        syncNativeNowPlaying()
      }
    }

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0
    const totalMs = audioEngine?.getTotalDurationMs() ?? 0

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

    // Find current word
    if (timelineWords.length > 0) {
      const idx = findCurrentWordIndex(timelineWords, currentMs, currentWordHint)
      if (idx >= 0) currentWordHint = idx
    }

    // Update word stream
    if (wordStream && timelineWords.length > 0) {
      wordStream.update(currentMs, timelineWords, currentWordHint, wordHoldEnabled)
    }

    // Update waveform stream
    if (waveformStream && waveformStream.mesh.isVisible && timelineWords.length > 0 && waveformCache) {
      waveformStream.update(currentMs, timelineWords, waveformCache, currentWordHint)
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

    releaseWakeLock()
    void stopNativeKeepAlive()
    nativeSessionActive = false
    if (removeRemoteListeners) { removeRemoteListeners(); removeRemoteListeners = null }
    if (window.__stargateCmd) {
      delete window.__stargateCmd
    }
    stopBackgroundTimers()

    document.removeEventListener("visibilitychange", handleVisibilityChange)
    resizeObserver.disconnect()

    persistBookmark()
    settings.dispose()
    chapterOverlay.dispose()
    transport.dispose()
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

  // Wire close button to full dispose
  disposeFn = dispose

  return { dispose }
}
