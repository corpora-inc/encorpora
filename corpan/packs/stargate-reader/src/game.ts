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
import { buildTimeline, findCurrentWordIndex } from "./core/timeline"
import {
  loadSegments,
  loadAudioManifest,
  setDataBaseUrl,
} from "./data/segmentLoader"
import { createAudioEngine, type AudioEngine } from "./audio/audioEngine"
import { createWordStream, type WordStream } from "./rendering/wordStream"
import { createOscilloscope, type Oscilloscope } from "./rendering/oscilloscope"
import { createStarfield, type Starfield } from "./rendering/starfield"

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
  let timelineWords: TimelineWord[] = []
  let currentWordHint = 0

  // Create starfield immediately (doesn't need data)
  starfield = createStarfield(scene)

  // Playback state
  let isPlaying = false

  // --- UI Controls ---
  const playBtn = document.createElement("button")
  playBtn.className = "stargate-play-btn"
  playBtn.textContent = "\u25B6"
  playBtn.title = "Play / Pause"
  ui.appendChild(playBtn)

  const chapterLabel = document.createElement("div")
  chapterLabel.className = "stargate-chapter"
  chapterLabel.textContent = "Loading..."
  ui.appendChild(chapterLabel)

  const timeLabel = document.createElement("div")
  timeLabel.className = "stargate-time"
  timeLabel.textContent = "0:00"
  ui.appendChild(timeLabel)

  playBtn.addEventListener("click", () => {
    if (!audioEngine) return

    audioEngine.unlock()

    if (isPlaying) {
      audioEngine.pause()
      isPlaying = false
      playBtn.textContent = "\u25B6"
    } else {
      audioEngine.play()
      isPlaying = true
      playBtn.textContent = "\u275A\u275A"
    }
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
      let segments: BookSegment[]
      let manifest: AudioManifest

      const preloadedSegments = initialState?.segmentsData as { segments: BookSegment[] } | undefined
      const preloadedManifest = initialState?.audioManifest as AudioManifest | undefined

      if (preloadedSegments && preloadedManifest) {
        segments = preloadedSegments.segments
        manifest = preloadedManifest
      } else {
        const dataUrl =
          (initialState?.dataUrl as string) ||
          detectDataUrl()
        setDataBaseUrl(dataUrl)

        const segData = await loadSegments()
        segments = segData.segments
        manifest = await loadAudioManifest("en")
      }

      if (disposed) return

      // Build timeline
      const timeline = buildTimeline(segments, manifest)
      timelineWords = timeline.words

      // Create audio engine
      audioEngine = createAudioEngine(
        segments,
        manifest,
        (index) => {
          // Update chapter label
          const seg = segments[index]
          if (seg) {
            chapterLabel.textContent = seg.title
          }
        },
        () => {
          // Playback ended
          isPlaying = false
          playBtn.textContent = "\u25B6"
        }
      )

      // Create word stream
      wordStream = createWordStream(scene)

      // Create oscilloscope
      oscilloscope = createOscilloscope(scene)

      chapterLabel.textContent = segments[0]?.title || "Ready"
    } catch (err) {
      console.error("[StargateReader] Failed to initialize:", err)
      chapterLabel.textContent = "Failed to load book data"
    }
  }

  /**
   * Try to detect the data URL from the current page location.
   * In dev mode, we serve mock data from public/.
   * In production, data comes from the pack's content directory.
   */
  function detectDataUrl(): string {
    // Dev mode: serve from public/mock-data/
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return "/mock-data"
    }
    return "."
  }

  // --- Render loop ---
  function renderLoop() {
    if (disposed) return

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0

    // Update time display
    const totalSeconds = Math.floor(currentMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    timeLabel.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`

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
      const intensity = Math.min(rms * 3, 1)
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

      audioEngine?.dispose()
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
