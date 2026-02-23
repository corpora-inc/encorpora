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
import { createStarfield, type Starfield } from "./rendering/starfield"
import { createTransportBar } from "./ui/transportBar"

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
  let oscilloscope: Oscilloscope | null = null
  let starfield: Starfield | null = null
  let audioEngine: AudioEngine | null = null
  let waveformCache: WaveformCache | null = null
  let timelineWords: TimelineWord[] = []
  let currentWordHint = 0

  // Create starfield immediately (doesn't need data)
  starfield = createStarfield(scene)

  // Playback state
  let isPlaying = false

  // --- Transport bar ---
  const transport = createTransportBar(ui)
  transport.setLanguages(availableLanguages, currentLanguage)

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

  transport.onLanguageChange((lang) => {
    void switchLanguage(lang)
  })

  // --- Screen lock behavior ---
  function handleVisibilityChange() {
    if (document.hidden) {
      // Screen locked / tab hidden: stop render loop but keep audio
      engine.stopRenderLoop()
    } else {
      // Screen visible: resume render loop
      engine.runRenderLoop(renderLoop)
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

      // Create oscilloscope — just a line, no ribbon
      oscilloscope = createOscilloscope(scene)

      transport.setChapter(segments[0]?.title || "Ready")
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

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0
    const totalMs = audioEngine?.getTotalDurationMs() ?? 0

    // Update time display
    transport.setTime(currentMs, totalMs)

    // Find current word
    if (timelineWords.length > 0) {
      const idx = findCurrentWordIndex(timelineWords, currentMs, currentWordHint)
      if (idx >= 0) currentWordHint = idx
    }

    // Update word stream
    if (wordStream && timelineWords.length > 0) {
      wordStream.update(currentMs, timelineWords, currentWordHint)
    }

    // Update oscilloscope
    if (oscilloscope && audioEngine) {
      const analyserData = audioEngine.getAnalyserData()
      // Calculate intensity from analyser data
      let sum = 0
      for (let i = 0; i < analyserData.length; i++) {
        const v = (analyserData[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / analyserData.length)
      const intensity = Math.max(Math.min(rms * 5, 1), 0.15)
      oscilloscope.update(analyserData, intensity)
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

  // --- Return dispose handle ---
  return {
    dispose: () => {
      disposed = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      resizeObserver.disconnect()

      transport.dispose()
      audioEngine?.dispose()
      waveformCache?.dispose()
      wordStream?.dispose()
      oscilloscope?.dispose()
      starfield?.dispose()
      glow.dispose()
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
      wrapper.remove()
    },
  }
}
