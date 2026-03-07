import type { HostApi } from "./sdk/types"
import type { AudioManifest, BookSegment, TimelineWord } from "./core/types"
import { VOICE_NAMES, BOOK_NAMES } from "./core/constants"
import { buildTimeline, findCurrentWordIndex, buildChapterIndex } from "./core/timeline"
import type { ChapterInfo } from "./core/types"
import {
  createFetchDataProvider,
  createPreloadedDataProvider,
  type DataProvider,
} from "./data/dataProvider"
import { createAudioEngine, type AudioEngine } from "./audio/audioEngine"
import { createTransportBar } from "./ui/transportBar"
import { createChapterOverlay, type ChapterOverlay } from "./ui/chapterOverlay"
import { createParagraphView, type ParagraphView } from "./rendering/paragraphView"
import { loadBookmark, saveBookmark, type Bookmark } from "./state/bookmarkStore"
import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  pauseNativeKeepAlive,
  resumeNativeKeepAlive,
  updateNativeNowPlaying,
  listenForRemoteCommands,
} from "./audio/nativeKeepAlive"

type EarthgateRemoteCommand = "play" | "pause"

declare global {
  interface Window {
    __earthgateCmd?: (cmd: EarthgateRemoteCommand) => void
  }
}

/**
 * Create the Earthgate Reader experience.
 *
 * A calm, DOM-based audiobook reader with word-level highlighting
 * synced to audio. Earth tones, pure DOM/CSS paragraph view.
 */
export function createEarthgateReader(
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
  let mediaArtworkUrl: string | undefined

  // --- Background recovery timing ---
  let backgroundedAt = 0
  let backgroundedAudioMs = 0

  function startBackgroundTimers() {
    if (!bgNowPlayingTimer) {
      bgNowPlayingTimer = setInterval(() => {
        if (!audioEngine || !isPlaying) return
        syncNativeNowPlaying()
        persistBookmark()
      }, 10000)
    }
  }

  function stopBackgroundTimers() {
    if (bgNowPlayingTimer) {
      clearInterval(bgNowPlayingTimer)
      bgNowPlayingTimer = null
    }
  }

  function syncNativeNowPlaying() {
    syncMediaSessionNowPlaying()
    if (isPlaying) return
    if (!nativeSessionActive || !audioEngine) return
    void updateNativeNowPlaying(
      segments[audioEngine.getCurrentSegmentIndex()]?.title || "Earthgate Reader",
      VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
      audioEngine.getCurrentTimeMs(),
      audioEngine.getTotalDurationMs(),
      isPlaying
    )
  }

  function syncMediaSessionPlaybackState(state: MediaSessionPlaybackState) {
    if (!("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.playbackState = state
    } catch { /* Best effort */ }
  }

  function syncMediaSessionNowPlaying() {
    if (!("mediaSession" in navigator) || !audioEngine) return
    const seg = segments[audioEngine.getCurrentSegmentIndex()]
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: seg?.title || "Earthgate Reader",
        artist: VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
        album: bookDisplayName,
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
    } catch { /* Best effort */ }
  }

  // --- Centralized play/pause helpers ---
  async function doPlay() {
    if (!audioEngine || isPlaying || playInFlight) return
    playInFlight = true

    try {
      if (!nativeSessionActive) {
        await startNativeKeepAlive(
          segments[audioEngine.getCurrentSegmentIndex()]?.title || "Earthgate Reader",
          VOICE_NAMES[voiceMap[currentLanguage] || ""] || "Narrator",
          bookDisplayName,
          audioEngine.getCurrentTimeMs(),
          audioEngine.getTotalDurationMs()
        )
        nativeSessionActive = true
      } else {
        await resumeNativeKeepAlive()
      }

      await audioEngine.recoverContext()
      audioEngine.unlock()
      audioEngine.play()

      isPlaying = true
      transport.setPlaying(true)
      syncMediaSessionPlaybackState("playing")
      void requestWakeLock()
      syncNativeNowPlaying()

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
    if (!audioEngine || !isPlaying) return
    audioEngine.pause()
    isPlaying = false
    transport.setPlaying(false)
    syncMediaSessionPlaybackState("paused")
    persistBookmark()
    releaseWakeLock()
    void pauseNativeKeepAlive()
    syncNativeNowPlaying()
    stopBackgroundTimers()
    if (document.hidden) backgroundedAt = 0
  }

  // Module-level state
  let dataProvider: DataProvider
  let segments: BookSegment[] = []
  let manifest: AudioManifest | null = null
  let chapters: ChapterInfo[] = []
  let currentLanguage = "en"
  let availableLanguages = (initialState?.availableLanguages as string[]) || ["en"]
  const voiceMap: Record<string, string> = {}

  const bookId =
    (initialState?.bookId as string) ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("book") || "book_monte_alban"
      : "unknown")

  const bookDisplayName = BOOK_NAMES[bookId] || bookId

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

  // --- DOM structure ---
  const wrapper = document.createElement("div")
  wrapper.className = "earthgate-reader"
  container.appendChild(wrapper)

  const ui = document.createElement("div")
  ui.className = "earthgate-ui"
  wrapper.appendChild(ui)

  // Rendering + UI
  let audioEngine: AudioEngine | null = null
  let timelineWords: TimelineWord[] = []
  let currentWordHint = 0
  let isPlaying = false
  let lastSegmentIndex = -1

  // Paragraph view
  const paragraphView: ParagraphView = createParagraphView(ui)

  // Chapter overlay
  let chapterOverlay: ChapterOverlay = createChapterOverlay(ui)
  let lastChapterIndex = -1

  // Transport bar
  const transport = createTransportBar(ui)
  transport.setLanguages(availableLanguages, currentLanguage)

  // --- Swipe navigation ---
  paragraphView.onNext(() => {
    if (!audioEngine) return
    const nextSeg = audioEngine.getCurrentSegmentIndex() + 1
    if (nextSeg < segments.length) {
      audioEngine.seekToSegment(nextSeg)
      syncNativeNowPlaying()
    }
  })

  paragraphView.onPrev(() => {
    if (!audioEngine) return
    const prevSeg = Math.max(0, audioEngine.getCurrentSegmentIndex() - 1)
    audioEngine.seekToSegment(prevSeg)
    syncNativeNowPlaying()
  })

  // --- Transport callbacks ---
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

  transport.onLanguageChange((lang) => {
    void switchLanguage(lang)
  })

  window.__earthgateCmd = (cmd: EarthgateRemoteCommand) => {
    if (cmd === "play") {
      void doPlay()
      return
    }
    if (cmd === "pause") {
      doPause()
    }
  }

  // --- Native remote command listeners ---
  removeRemoteListeners = listenForRemoteCommands({
    onPlay: () => { void doPlay() },
    onPause: () => { doPause() },
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

  // --- Media Session API ---
  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return
    syncMediaSessionNowPlaying()

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { void doPlay() }],
      ["pause", () => { doPause() }],
      ["seekbackward", () => {
        if (!audioEngine) return
        audioEngine.seekToMs(Math.max(0, audioEngine.getCurrentTimeMs() - 30000))
        syncNativeNowPlaying()
      }],
      ["seekforward", () => {
        if (!audioEngine) return
        audioEngine.seekToMs(Math.min(audioEngine.getTotalDurationMs(), audioEngine.getCurrentTimeMs() + 30000))
        syncNativeNowPlaying()
      }],
    ]

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch { /* iOS/WebKit support differs */ }
    }
  }

  // --- Periodic bookmark autosave ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000

  // --- Visibility change ---
  function handleVisibilityChange() {
    if (document.hidden) {
      if (audioEngine && isPlaying) {
        backgroundedAt = Date.now()
        backgroundedAudioMs = audioEngine.getCurrentTimeMs()
      }
      persistBookmark()
      if (audioEngine && isPlaying) {
        startBackgroundTimers()
      }
    } else {
      stopBackgroundTimers()

      if (audioEngine) {
        void audioEngine.recoverContext().then(() => {
          if (!audioEngine) return

          if (isPlaying) {
            if (backgroundedAt > 0) {
              const wallElapsed = Date.now() - backgroundedAt
              const expectedMs = backgroundedAudioMs + wallElapsed
              const actualMs = audioEngine.getCurrentTimeMs()
              const totalMs = audioEngine.getTotalDurationMs()
              if (Math.abs(expectedMs - actualMs) > 2000 && expectedMs < totalMs) {
                audioEngine.seekToMs(Math.min(expectedMs, totalMs))
              }
            }
            if (!audioEngine.isPlaying()) {
              audioEngine.play()
            }
            audioEngine.unlock()
            void requestWakeLock()
          }

          syncNativeNowPlaying()
        })
      }

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

  // --- Helper: update paragraph view for current segment ---
  function updateParagraphForSegment(segIndex: number) {
    const seg = segments[segIndex]
    if (!seg || !manifest) return
    const manifestSeg = manifest.segments[seg.id]
    paragraphView.setSegment(seg, manifestSeg)
    lastSegmentIndex = segIndex
  }

  // --- Data loading & initialization ---
  async function initialize() {
    try {
      const bookmark = loadBookmark(bookId)

      const preloadedSegments = initialState?.segmentsData as { segments: BookSegment[] } | undefined
      const preloadedManifest = initialState?.audioManifest as AudioManifest | undefined
      const resolveAssetUrl = initialState?.resolveAssetUrl as ((path: string) => string) | undefined
      const baseUrl = initialState?.baseUrl as string | undefined
      mediaArtworkUrl = resolveAssetUrl
        ? resolveAssetUrl("earthgate-reader-avatar.png")
        : (baseUrl ? `${baseUrl.replace(/\/$/, "")}/earthgate-reader-avatar.png` : "earthgate-reader-avatar.png")

      if (preloadedSegments && preloadedManifest && resolveAssetUrl) {
        dataProvider = createPreloadedDataProvider(
          { version: "2.0.0", book_id: "", total_segments: preloadedSegments.segments.length, segments: preloadedSegments.segments },
          preloadedManifest,
          resolveAssetUrl
        )
        segments = preloadedSegments.segments
        manifest = preloadedManifest
      } else {
        const dataUrl =
          (initialState?.dataUrl as string) ||
          detectDataUrl()
        const contentRevision = initialState?.contentRevision as string | undefined
        dataProvider = createFetchDataProvider(dataUrl, contentRevision)

        if (availableLanguages.length <= 1 && dataProvider.detectLanguages) {
          const detected = await dataProvider.detectLanguages()
          if (detected.length > 1) {
            availableLanguages = detected
          }
        }

        if (bookmark && availableLanguages.includes(bookmark.language)) {
          currentLanguage = bookmark.language
        }

        const segData = await dataProvider.loadSegments(currentLanguage)
        segments = segData.segments
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

      voiceMap[currentLanguage] = manifest.voice
      transport.setLanguages(availableLanguages, currentLanguage)

      // Background fetch other language voice info
      for (const lang of availableLanguages) {
        if (lang !== currentLanguage) {
          dataProvider.loadAudioManifest(lang).then(m => {
            voiceMap[lang] = m.voice
            transport.setLanguages(availableLanguages, currentLanguage)
          }).catch(() => {})
        }
      }

      chapters = buildChapterIndex(segments)

      const timeline = buildTimeline(segments, manifest)
      timelineWords = timeline.words

      audioEngine = createAudioEngine(
        segments,
        manifest,
        dataProvider.resolveAudioUrl,
        (index) => {
          const seg = segments[index]
          if (seg) {
            transport.setChapter(seg.title)
            syncNativeNowPlaying()
            // Update paragraph view when segment changes
            updateParagraphForSegment(index)
          }
        },
        () => {
          // Playback ended
          isPlaying = false
          transport.setPlaying(false)
          syncMediaSessionPlaybackState("paused")
          releaseWakeLock()
          stopBackgroundTimers()
          backgroundedAt = 0
          void stopNativeKeepAlive()
          nativeSessionActive = false
        },
        () => {
          // No waveform extraction needed for DOM rendering
        }
      )

      transport.setChapter(segments[0]?.title || "Ready")

      // Set chapter markers
      if (audioEngine && chapters.length > 0) {
        const starts = audioEngine.getSegmentAbsoluteStartMs()
        const total = audioEngine.getTotalDurationMs()
        if (total > 0) {
          transport.setChapterMarkers(
            chapters.map(c => starts[c.firstSegmentIndex] / total)
          )
        }
      }

      // Show initial segment text
      const initialSegIndex = bookmark ? Math.min(bookmark.segmentIndex, segments.length - 1) : 0
      updateParagraphForSegment(initialSegIndex)

      // Restore bookmark position
      if (bookmark && audioEngine) {
        audioEngine.seekToMs(bookmark.timeMs)
      }

      setupMediaSession()
      syncNativeNowPlaying()
    } catch (err) {
      console.error("[EarthgateReader] Failed to initialize:", err)
      transport.setChapter("Failed to load book data")
    }
  }

  function detectDataUrl(): string {
    if (typeof window === "undefined") return "."

    const params = new URLSearchParams(window.location.search)
    const bid = params.get("book") || "book_monte_alban"

    const baseUrl = initialState?.baseUrl as string | undefined

    if (baseUrl?.startsWith("corpan-pack://")) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    return `/data/books/${bid}`
  }

  async function switchLanguage(newLang: string) {
    if (newLang === currentLanguage || !dataProvider) return

    try {
      const wasPlaying = isPlaying
      const savedSegmentIndex = audioEngine?.getCurrentSegmentIndex() ?? 0

      audioEngine?.dispose()
      audioEngine = null

      currentLanguage = newLang

      const [segData, newManifest] = await Promise.all([
        dataProvider.loadSegments(newLang),
        dataProvider.loadAudioManifest(newLang),
      ])
      if (disposed) return

      segments = segData.segments
      manifest = newManifest
      voiceMap[newLang] = newManifest.voice
      transport.setLanguages(availableLanguages, newLang)
      chapters = buildChapterIndex(segments)

      const timeline = buildTimeline(segments, newManifest)
      timelineWords = timeline.words
      currentWordHint = 0

      audioEngine = createAudioEngine(
        segments,
        newManifest,
        dataProvider.resolveAudioUrl,
        (index) => {
          const seg = segments[index]
          if (seg) {
            transport.setChapter(seg.title)
            syncNativeNowPlaying()
            updateParagraphForSegment(index)
          }
        },
        () => {
          isPlaying = false
          transport.setPlaying(false)
          syncMediaSessionPlaybackState("paused")
          releaseWakeLock()
          stopBackgroundTimers()
          backgroundedAt = 0
          void stopNativeKeepAlive()
          nativeSessionActive = false
        },
        () => {}
      )

      lastChapterIndex = -1
      lastSegmentIndex = -1

      if (chapters.length > 0) {
        const starts = audioEngine.getSegmentAbsoluteStartMs()
        const total = audioEngine.getTotalDurationMs()
        if (total > 0) {
          transport.setChapterMarkers(
            chapters.map(c => starts[c.firstSegmentIndex] / total)
          )
        }
      }

      audioEngine.seekToSegment(savedSegmentIndex)
      updateParagraphForSegment(savedSegmentIndex)

      if (wasPlaying) {
        audioEngine.unlock()
        audioEngine.play()
        isPlaying = true
        transport.setPlaying(true)
      }
    } catch (err) {
      console.error("[EarthgateReader] Failed to switch language:", err)
    }
  }

  // --- Render loop (RAF-based, no Babylon) ---
  let rafId: number | null = null

  function renderLoop() {
    if (disposed) return
    rafId = requestAnimationFrame(renderLoop)

    // Reconcile play state with engine
    if (audioEngine) {
      const enginePlaying = audioEngine.isPlaying()
      if (enginePlaying !== isPlaying) {
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

    const currentMs = audioEngine?.getCurrentTimeMs() ?? 0
    const totalMs = audioEngine?.getTotalDurationMs() ?? 0

    transport.setTime(currentMs, totalMs)
    if (totalMs > 0) {
      transport.setProgress(currentMs / totalMs)
    }

    // Autosave bookmark
    if (isPlaying && currentMs - lastAutosaveMs > AUTOSAVE_INTERVAL_MS) {
      lastAutosaveMs = currentMs
      persistBookmark()
      syncNativeNowPlaying()
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

    // Update segment text if changed (catch cases not caught by onSegmentChange callback)
    if (audioEngine) {
      const segIdx = audioEngine.getCurrentSegmentIndex()
      if (segIdx !== lastSegmentIndex) {
        updateParagraphForSegment(segIdx)
      }
    }

    // Find current word and highlight
    if (timelineWords.length > 0 && audioEngine && manifest) {
      const idx = findCurrentWordIndex(timelineWords, currentMs, currentWordHint)
      if (idx >= 0) {
        currentWordHint = idx
        const tw = timelineWords[idx]
        // Convert global word index to local word index within current segment
        paragraphView.highlightWord(tw.wordIndex)
      }
    }
  }

  // Start render loop
  rafId = requestAnimationFrame(renderLoop)

  // Kick off data loading
  void initialize()

  // --- Dispose ---
  function dispose() {
    if (disposed) return
    disposed = true

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    releaseWakeLock()
    void stopNativeKeepAlive()
    nativeSessionActive = false
    if (removeRemoteListeners) { removeRemoteListeners(); removeRemoteListeners = null }
    if (window.__earthgateCmd) {
      delete window.__earthgateCmd
    }
    stopBackgroundTimers()

    document.removeEventListener("visibilitychange", handleVisibilityChange)

    persistBookmark()
    chapterOverlay.dispose()
    transport.dispose()
    paragraphView.dispose()
    audioEngine?.dispose()
    wrapper.remove()
  }

  return { dispose }
}
