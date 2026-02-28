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
import { CAMERA_FOV, CAMERA_Z, GLOW_INTENSITY, LANGUAGE_NAMES, VOICE_NAMES } from "./core/constants"
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
  let bgKeepAlive: ReturnType<typeof setInterval> | null = null
  let nativeSessionActive = false
  let removeRemoteListeners: (() => void) | null = null

  // --- Background recovery timing ---
  let backgroundedAt = 0        // wall-clock ms when app went to background
  let backgroundedAudioMs = 0   // audio position ms when app went to background

  // --- Centralized play/pause helpers (background-aware) ---
  function doPlay() {
    if (!audioEngine) return
    audioEngine.unlock()
    audioEngine.play()
    isPlaying = true
    transport.setPlaying(true)
    void requestWakeLock()
    // If backgrounded, reset tracking baseline and ensure keepalive
    if (document.hidden) {
      backgroundedAt = Date.now()
      backgroundedAudioMs = audioEngine.getCurrentTimeMs()
      if (!bgKeepAlive) {
        bgKeepAlive = setInterval(() => { audioEngine?.unlock() }, 5000)
      }
    }
  }

  function doPause() {
    if (!audioEngine) return
    audioEngine.pause()
    isPlaying = false
    transport.setPlaying(false)
    persistBookmark()
    releaseWakeLock()
    // If backgrounded, clear keepalive and reset tracking
    if (document.hidden) {
      if (bgKeepAlive) { clearInterval(bgKeepAlive); bgKeepAlive = null }
      backgroundedAt = 0
    }
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
    doPlay()
    setupMediaSession()
    if (nativeSessionActive) {
      void resumeNativeKeepAlive()
    } else {
      if (audioEngine) {
        void startNativeKeepAlive(
          segments[audioEngine.getCurrentSegmentIndex()]?.title || "Stargate Reader",
          VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
          bookId
        )
        nativeSessionActive = true
      }
    }
  })

  transport.onPause(() => {
    doPause()
    void pauseNativeKeepAlive()
  })

  transport.onPrevChapter(() => {
    if (!audioEngine || chapters.length === 0) return
    const currentIdx = audioEngine.getCurrentSegmentIndex()
    // Find current chapter
    let chapterIdx = 0
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (currentIdx >= chapters[i].firstSegmentIndex) {
        chapterIdx = i
        break
      }
    }
    // If we're more than 2 segments into the chapter, go to start of current
    // Otherwise go to previous chapter
    const threshold = chapters[chapterIdx].firstSegmentIndex + 2
    const targetChapter = currentIdx > threshold ? chapterIdx : Math.max(0, chapterIdx - 1)
    audioEngine.seekToSegment(chapters[targetChapter].firstSegmentIndex)
    transport.setChapter(chapters[targetChapter].title)
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
  })

  transport.onSkipBack(() => {
    if (!audioEngine) return
    const target = Math.max(0, audioEngine.getCurrentTimeMs() - 30000)
    audioEngine.seekToMs(target)
  })

  transport.onSkipForward(() => {
    if (!audioEngine) return
    const target = Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000)
    audioEngine.seekToMs(target)
  })

  // --- Scrub lifecycle ---
  let wasPlayingBeforeScrub = false

  transport.onScrubStart(() => {
    wasPlayingBeforeScrub = audioEngine?.isPlaying() ?? false
    if (wasPlayingBeforeScrub && audioEngine) {
      audioEngine.pause()
      isPlaying = false
    }
  })

  transport.onScrubMove((fraction) => {
    if (!audioEngine) return
    audioEngine.seekToMsPreview(fraction * audioEngine.getTotalDurationMs())
  })

  transport.onScrubEnd((fraction) => {
    if (!audioEngine) return
    audioEngine.seekToMsPreview(fraction * audioEngine.getTotalDurationMs())
    if (wasPlayingBeforeScrub) {
      audioEngine.play()
      isPlaying = true
      transport.setPlaying(true)
    }
  })

  settings.onLanguageChange((lang) => {
    void switchLanguage(lang)
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
    onPlay: () => { doPlay(); void resumeNativeKeepAlive() },
    onPause: () => { doPause(); void pauseNativeKeepAlive() },
    onSkipForward: () => {
      if (!audioEngine) return
      const target = Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000)
      audioEngine.seekToMs(target)
    },
    onSkipBack: () => {
      if (!audioEngine) return
      const target = Math.max(0, audioEngine.getCurrentTimeMs() - 30000)
      audioEngine.seekToMs(target)
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
    },
  })

  // --- Media Session API (lock screen controls) ---
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: segments[0]?.title || "Stargate Reader",
      artist: VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
      album: bookId,
    })

    navigator.mediaSession.setActionHandler("play", () => { doPlay() })
    navigator.mediaSession.setActionHandler("pause", () => { doPause() })
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      if (!audioEngine) return
      audioEngine.seekToMs(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
    })
    navigator.mediaSession.setActionHandler("seekforward", () => {
      if (!audioEngine) return
      audioEngine.seekToMs(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
    })
  }

  function updateMediaSessionPosition() {
    if (!("mediaSession" in navigator) || !audioEngine) return
    const seg = segments[audioEngine.getCurrentSegmentIndex()]
    if (seg) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: seg.title || "Stargate Reader",
        artist: VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
        album: bookId,
      })
    }
    navigator.mediaSession.setPositionState({
      duration: audioEngine.getTotalDurationMs() / 1000,
      playbackRate: 1.0,
      position: audioEngine.getCurrentTimeMs() / 1000,
    })
  }

  // --- Periodic bookmark autosave (every 15s during playback) ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000

  // --- Audio health check counter ---
  let frameCount = 0

  // --- Screen lock behavior ---
  function handleVisibilityChange() {
    if (document.hidden) {
      // Screen locked / tab hidden: save bookmark, stop render loop but keep audio
      if (audioEngine && isPlaying) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
      }
      persistBookmark()
      engine.stopRenderLoop()
      // Keep AudioContext alive in background
      if (audioEngine && isPlaying) {
        bgKeepAlive = setInterval(() => { audioEngine?.unlock() }, 5000)
      }
    } else {
      // Screen visible: clear keepalive, resume render loop
      if (bgKeepAlive) { clearInterval(bgKeepAlive); bgKeepAlive = null }
      engine.runRenderLoop(renderLoop)

      // Recovery: if playing, check for audio drift from OS suspension
      if (audioEngine && isPlaying) {
        if (backgroundedAt > 0) {
          const wallElapsed = Date.now() - backgroundedAt
          const expectedMs = backgroundedAudioMs + wallElapsed
          const actualMs = audioEngine.getCurrentTimeMs()
          const totalMs = audioEngine.getTotalDurationMs()
          if (Math.abs(expectedMs - actualMs) > 2000 && expectedMs < totalMs) {
            audioEngine.seekToMs(Math.min(expectedMs, totalMs))
            audioEngine.play()
          }
        }
        // Always unlock and re-acquire wake lock when foregrounding while playing
        audioEngine.unlock()
        void requestWakeLock()
        // Refresh native metadata (recovers from OS teardown under memory pressure)
        if (nativeSessionActive) {
          void updateNativeNowPlaying(
            segments[audioEngine.getCurrentSegmentIndex()]?.title || "Stargate Reader",
            VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
            audioEngine.getCurrentTimeMs(),
            audioEngine.getTotalDurationMs()
          )
        }
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
          // Update chapter label
          const seg = segments[index]
          if (seg) {
            transport.setChapter(seg.title)
          }
        },
        () => {
          // Playback ended
          isPlaying = false
          transport.setPlaying(false)
          releaseWakeLock()
          if (bgKeepAlive) { clearInterval(bgKeepAlive); bgKeepAlive = null }
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

    // Remote HTTP base (manifest.json install, e.g. GitHub Pages)
    // Detect dev mode: localhost/127.0.0.1 = dev, anything else = production HTTP
    if (baseUrl) {
      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseUrl)
      if (isLocal) {
        // Corpan dev mode: book data served separately on port 8990
        return `http://127.0.0.1:8990/data/books/${bid}`
      }
      // Production HTTP: data lives alongside pack assets
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
          if (seg) transport.setChapter(seg.title)
        },
        () => {
          isPlaying = false
          transport.setPlaying(false)
          releaseWakeLock()
          if (bgKeepAlive) { clearInterval(bgKeepAlive); bgKeepAlive = null }
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

    // Periodic audio context resume (~once per second at 60fps)
    // Some browsers suspend the AudioContext after inactivity
    frameCount++
    if (audioEngine && isPlaying && frameCount % 60 === 0) {
      audioEngine.unlock()
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
      updateMediaSessionPosition()
      void updateNativeNowPlaying(
        segments[audioEngine?.getCurrentSegmentIndex() ?? 0]?.title || "Stargate Reader",
        VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
        currentMs,
        totalMs
      )
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
      wordStream.update(currentMs, timelineWords, currentWordHint)
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
    if (bgKeepAlive) { clearInterval(bgKeepAlive); bgKeepAlive = null }

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
