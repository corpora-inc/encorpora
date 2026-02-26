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
import { CAMERA_FOV, CAMERA_Z, GLOW_INTENSITY } from "./core/constants"
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
import { createSettingsPanel } from "./ui/settingsPanel"
import { loadBookmark, saveBookmark, type Bookmark } from "./state/bookmarkStore"
import { loadPrefs, savePrefs, type DisplayPrefs } from "./state/prefsStore"

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

  // Module-level state for language/book switching
  let dataProvider: DataProvider
  let segments: BookSegment[] = []
  let chapters: ChapterInfo[] = []
  let currentLanguage = "en"
  const availableLanguages = (initialState?.availableLanguages as string[]) || ["en"]

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
  settings.setLanguages(availableLanguages, currentLanguage)

  transport.onPlay(() => {
    if (!audioEngine) return
    audioEngine.unlock()
    audioEngine.play()
    isPlaying = true
    transport.setPlaying(true)
  })

  transport.onPause(() => {
    if (!audioEngine) return
    audioEngine.pause()
    isPlaying = false
    transport.setPlaying(false)
    persistBookmark()
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
    if (pulseRing) pulseRing.setVisible(visible)
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

  // --- Periodic bookmark autosave (every 15s during playback) ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000

  // --- Audio health check counter ---
  let frameCount = 0

  // --- Screen lock behavior ---
  function handleVisibilityChange() {
    if (document.hidden) {
      // Screen locked / tab hidden: save bookmark, stop render loop but keep audio
      persistBookmark()
      engine.stopRenderLoop()
    } else {
      // Screen visible: resume render loop
      engine.runRenderLoop(renderLoop)
      // Nudge audio context back to life after screen unlock
      if (audioEngine && isPlaying) {
        audioEngine.checkHealth()
      }
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange)

  // --- Data loading & initialization ---
  async function initialize() {
    try {
      let manifest: AudioManifest

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
        // Dev mode: fetch via HTTP
        const dataUrl =
          (initialState?.dataUrl as string) ||
          detectDataUrl()
        dataProvider = createFetchDataProvider(dataUrl)

        const segData = await dataProvider.loadSegments()
        segments = segData.segments
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

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

      // Restore bookmark (resume where the user left off)
      const bookmark = loadBookmark(bookId)
      if (bookmark && audioEngine) {
        if (bookmark.language !== currentLanguage && availableLanguages.includes(bookmark.language)) {
          currentLanguage = bookmark.language
          settings.setLanguages(availableLanguages, currentLanguage)
          // Language switch will be handled on first play; for now just seek
        }
        audioEngine.seekToMs(bookmark.timeMs)
      }
    } catch (err) {
      console.error("[StargateReader] Failed to initialize:", err)
      transport.setChapter("Failed to load book data")
    }
  }

  /**
   * Detect the data URL for dev mode.
   *
   * - Standalone dev (npm run dev): Vite proxy at localhost:5173
   * - Corpan dev (npm run dev:corpan): book data server at localhost:8990
   * - Production: should never be called (preloaded data path)
   */
  function detectDataUrl(): string {
    if (typeof window === "undefined") return "."

    const params = new URLSearchParams(window.location.search)
    const bookId = params.get("book") || "book_monte_alban"

    if (window.location.hostname === "localhost") {
      // Vite dev server: use book data proxy
      return `/data/books/${bookId}`
    }

    // Corpan dev mode (Tauri webview) — fall back to book data HTTP server
    return `http://localhost:8990/data/books/${bookId}`
  }

  /**
   * Switch audio language: reload manifest, rebuild timeline and audio engine.
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

      // Load new manifest
      const manifest = await dataProvider.loadAudioManifest(newLang)
      if (disposed) return

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

    // Periodic audio health check (~once per second at 60fps)
    frameCount++
    if (audioEngine && isPlaying && frameCount % 60 === 0) {
      audioEngine.checkHealth()
    }

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0
    const totalMs = audioEngine?.getTotalDurationMs() ?? 0

    // Update time display and scrub bar progress
    transport.setTime(currentMs, totalMs)
    if (totalMs > 0) {
      transport.setProgress(currentMs / totalMs)
    }

    // Autosave bookmark during playback
    if (isPlaying && currentMs - lastAutosaveMs > AUTOSAVE_INTERVAL_MS) {
      lastAutosaveMs = currentMs
      persistBookmark()
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
