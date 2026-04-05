import type { HostApi } from "@shared/sdk"
import type { AudioManifest, BookSegment, TimelineWord, ChapterInfo } from "@shared/core"
import { BOOK_NAMES, resolveVoiceName } from "@shared/core"
import { buildTimeline, findCurrentWordIndex, buildChapterIndex } from "@shared/core"
import { createFetchDataProvider, createPreloadedDataProvider, type DataProvider } from "@shared/data"
import { createAudioEngine, type AudioEngine, createMediaSessionAnchor, type MediaSessionAnchor, getMediaSessionArtworkUrl } from "@shared/audio"
import { createTransportBar } from "@shared/ui"
import { createChapterOverlay, type ChapterOverlay } from "@shared/ui"
import { createBookmarkStore, type Bookmark, drawerStore } from "@shared/state"
import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  pauseNativeKeepAlive,
  resumeNativeKeepAlive,
  updateNativeNowPlaying,
  listenForRemoteCommands,
} from "@shared/audio"
import { createParagraphView, type ParagraphView } from "./rendering/paragraphView"

const bookmarks = createBookmarkStore("earthgate-reader")

type TauriBridgeWindow = Window & {
  __TAURI_INTERNALS__?: unknown
}

type ReaderNativeCommand = "play" | "pause" | "skipForward" | "skipBack" | "seek" | "prevChapter" | "nextChapter"

declare global {
  interface Window {
    __readerCmd?: (cmd: ReaderNativeCommand, data?: { positionMs?: number }) => void
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
  const hasNativeBridge = Boolean((window as TauriBridgeWindow).__TAURI_INTERNALS__)
  const isAndroid = /Android/i.test(navigator.userAgent)
  const nativeOwnsMediaSession = hasNativeBridge && isAndroid

  let disposed = false

  // --- Screen Wake Lock ---
  let wakeLock: WakeLockSentinel | null = null

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return
    try {
      wakeLock = await navigator.wakeLock.request("screen")
      wakeLock.addEventListener("release", () => { wakeLock = null })
    } catch (e) { console.warn("[ER] wakeLock request:", e) }
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
  let lastNowPlayingToken = 0
  let lastMediaMetadataKey = ""
  let nativePlaybackStateHint: MediaSessionPlaybackState | "unknown" = "unknown"
  let mediaArtworkUrl: string | undefined
  let lastRemotePlayPauseCmd: "play" | "pause" | null = null
  let lastRemotePlayPauseAt = 0
  const REMOTE_PLAY_PAUSE_DEDUPE_MS = 250
  let pendingEngineState: MediaSessionPlaybackState | null = null
  let pendingEngineStateSince = 0
  const EXTERNAL_STATE_DEBOUNCE_MS = 900
  let suppressExternalReconcileUntil = 0
  const SEEK_RECONCILE_SUPPRESSION_MS = 2000
  const DRIFT_CORRECTION_MIN_BACKGROUND_MS = 5000

  // --- Background recovery timing ---
  let backgroundedAt = 0
  let backgroundedAudioMs = 0

  function startBackgroundTimers() {
    if (!bgNowPlayingTimer) {
      bgNowPlayingTimer = setInterval(() => {
        if (!audioEngine || !isPlaying) return
        syncNativeNowPlaying("periodic")
        persistBookmark()
      }, 3000)
    }
  }

  function stopBackgroundTimers() {
    if (bgNowPlayingTimer) {
      clearInterval(bgNowPlayingTimer)
      bgNowPlayingTimer = null
    }
  }

  function syncNativeNowPlaying(_mode: "state" | "periodic" = "state") {
    syncMediaSessionNowPlaying()
    if (!nativeSessionActive || !audioEngine) return
    const nowPlayingToken = nextNowPlayingToken()
    void updateNativeNowPlaying(
      segments[audioEngine.getCurrentSegmentIndex()]?.title || "Earthgate Reader",
      bookDisplayName,
      audioEngine.getCurrentTimeMs(),
      audioEngine.getTotalDurationMs(),
      isPlaying,
      nowPlayingToken
    )
  }

  function nextNowPlayingToken(): number {
    const now = Date.now()
    lastNowPlayingToken = Math.max(now, lastNowPlayingToken + 1)
    return lastNowPlayingToken
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

  function seekToMsAndSync(targetMs: number) {
    if (!audioEngine) return
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    if (isPlaying) {
      audioEngine.seekToMs(targetMs)
      audioEngine.ensureSourceIfPlaying("seekToMsAndSync")
    } else {
      audioEngine.seekToMsPreview(targetMs)
    }
    syncNativeNowPlaying()
  }

  function seekToSegmentAndSync(index: number) {
    if (!audioEngine) return
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    audioEngine.seekToSegment(index)
    syncNativeNowPlaying()
    audioEngine.ensureSourceIfPlaying("seekToSegmentAndSync")
  }

  function dispatchRemotePlayPause(cmd: "play" | "pause", _source: string) {
    const now = performance.now()
    if (lastRemotePlayPauseCmd === cmd && now - lastRemotePlayPauseAt < REMOTE_PLAY_PAUSE_DEDUPE_MS) return
    lastRemotePlayPauseCmd = cmd
    lastRemotePlayPauseAt = now
    if (cmd === "play") { void doPlay(); return }
    doPause()
  }

  function syncMediaSessionNowPlaying() {
    if (nativeOwnsMediaSession) return
    if (!("mediaSession" in navigator) || !audioEngine) return
    const seg = segments[audioEngine.getCurrentSegmentIndex()]
    try {
      const metadataKey = `${seg?.title}|${bookDisplayName}|${mediaArtworkUrl ?? ""}`
      if (metadataKey !== lastMediaMetadataKey) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: seg?.title || "Earthgate Reader",
          artist: bookDisplayName,
          album: bookDisplayName,
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

  // --- Centralized play/pause helpers ---
  async function doPlay() {
    desiredPlaying = true
    const requestId = ++playRequestSeq
    if (!audioEngine || playInFlight) return
    const shouldCancelPlayRequest = (): boolean => {
      const staleSuperseded = requestId !== playRequestSeq && desiredPlaying && !disposed
      return staleSuperseded || !desiredPlaying || disposed
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

    try {
      if (!nativeSessionActive) {
        await startNativeKeepAlive(
          segments[audioEngine.getCurrentSegmentIndex()]?.title || "Earthgate Reader",
          bookDisplayName,
          bookDisplayName,
          audioEngine.getCurrentTimeMs(),
          audioEngine.getTotalDurationMs()
        )
        nativeSessionActive = true
        nativePlaybackStateHint = "playing"
        if (shouldCancelPlayRequest()) {
          syncMediaSessionPlaybackState("paused")
          syncNativePlaybackState(false)
          syncNativeNowPlaying()
          return
        }
      } else {
        await resumeNativeKeepAlive("doPlay")
        nativePlaybackStateHint = "playing"
        if (shouldCancelPlayRequest()) {
          syncMediaSessionPlaybackState("paused")
          syncNativePlaybackState(false)
          syncNativeNowPlaying()
          return
        }
      }

      await audioEngine.recoverContext()
      if (shouldCancelPlayRequest()) {
        syncMediaSessionPlaybackState("paused")
        syncNativePlaybackState(false)
        syncNativeNowPlaying()
        return
      }

      setupMediaSession()
      if (!nativeOwnsMediaSession && !mediaAnchor) {
        mediaAnchor = createMediaSessionAnchor()
      }
      mediaAnchor?.play()
      audioEngine.unlock()
      audioEngine.play()

      if (shouldCancelPlayRequest()) {
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
    desiredPlaying = false
    playRequestSeq += 1
    if (!audioEngine) return
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
  }

  // Module-level state
  let dataProvider: DataProvider
  let segments: BookSegment[] = []
  let manifest: AudioManifest | null = null
  let chapters: ChapterInfo[] = []
  let currentLanguage = (initialState?.language as string) || "en"

  const bookId =
    (initialState?.bookId as string) ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("book") || "book_monte_alban"
      : "unknown")

  const bookDisplayName =
    (initialState?.bookTitle as string) || BOOK_NAMES[bookId] || bookId

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
  let chapterOverlay: ChapterOverlay = createChapterOverlay(ui, "earthgate")
  let lastChapterIndex = -1

  // Transport bar
  const transport = createTransportBar(ui, "earthgate")

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
    seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
    transport.setChapter(chapters[targetChapter].title)
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
    suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS
    wasPlayingBeforeScrub = isPlaying
    if (wasPlayingBeforeScrub) doPause()
  })

  transport.onScrubMove((fraction) => {
    if (!audioEngine) return
    audioEngine.seekToMsPreview(fraction * audioEngine.getTotalDurationMs())
  })

  transport.onScrubEnd((fraction) => {
    if (!audioEngine) return
    seekToMsAndSync(fraction * audioEngine.getTotalDurationMs())
    if (wasPlayingBeforeScrub) void doPlay()
  })

  // Language switching is triggered by the command drawer via appShell

  window.__readerCmd = (cmd: ReaderNativeCommand, data?: { positionMs?: number }) => {
    console.log(`[ER:cmd] __readerCmd(${cmd})`)
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
          transport.setChapter(chapters[targetChapter].title)
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
          transport.setChapter(chapters[targetChapter].title)
        }
        break
    }
  }

  // --- Native remote command listeners ---
  removeRemoteListeners = listenForRemoteCommands({
    onPlay: () => { dispatchRemotePlayPause("play", "native") },
    onPause: () => { dispatchRemotePlayPause("pause", "native") },
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
      seekToSegmentAndSync(chapters[targetChapter].firstSegmentIndex)
      transport.setChapter(chapters[targetChapter].title)
    },
    onSeek: (positionMs: number) => {
      if (!audioEngine) return
      seekToMsAndSync(positionMs)
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
        transport.setChapter(chapters[targetChapter].title)
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
        transport.setChapter(chapters[targetChapter].title)
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

  // --- Periodic bookmark autosave ---
  let lastAutosaveMs = 0
  const AUTOSAVE_INTERVAL_MS = 15000

  // --- Periodic MediaSession resync (matches stargate pattern) ---
  let lastMediaSessionSyncAt = 0
  const MEDIA_SESSION_RESYNC_INTERVAL_MS = 1000

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
      suppressExternalReconcileUntil = performance.now() + SEEK_RECONCILE_SUPPRESSION_MS

      const wasBackgroundedAt = backgroundedAt
      backgroundedAt = 0

      if (audioEngine && isPlaying) {
        void audioEngine.recoverContext().then(() => {
          if (!audioEngine) return

          audioEngine.ensureSourceIfPlaying("visibility:recover")
          const hiddenDurationMs = wasBackgroundedAt > 0 ? Math.max(0, Date.now() - wasBackgroundedAt) : 0
          const shouldApplyDriftCorrection =
            wasBackgroundedAt > 0 &&
            hiddenDurationMs >= DRIFT_CORRECTION_MIN_BACKGROUND_MS
          if (shouldApplyDriftCorrection) {
            const wallElapsed = Date.now() - wasBackgroundedAt
            const expectedMs = backgroundedAudioMs + wallElapsed
            const actualMs = audioEngine.getCurrentTimeMs()
            const totalMs = audioEngine.getTotalDurationMs()
            if (Math.abs(expectedMs - actualMs) > 2000 && expectedMs < totalMs) {
              seekToMsAndSync(Math.min(expectedMs, totalMs))
            }
          }
          if (!audioEngine.isPlaying()) {
            console.log("[ER:vis] engine paused while app expects playing; routing through doPlay()")
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
      const bookmark = bookmarks.load(bookId)

      const preloadedSegments = initialState?.segmentsData as { segments: BookSegment[] } | undefined
      const preloadedManifest = initialState?.audioManifest as AudioManifest | undefined
      const resolveAssetUrl = initialState?.resolveAssetUrl as ((path: string) => string) | undefined
      mediaArtworkUrl = getMediaSessionArtworkUrl()

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

        const segData = await dataProvider.loadSegments(currentLanguage)
        segments = segData.segments
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

      // Only set nowPlaying — languages/currentLanguage are managed by appShell
      drawerStore.setState({ nowPlaying: { bookTitle: bookDisplayName } })

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
          desiredPlaying = false
          isPlaying = false
          transport.setPlaying(false)
          syncMediaSessionPlaybackState("paused")
          releaseWakeLock()
          stopBackgroundTimers()
          backgroundedAt = 0
          void stopNativeKeepAlive()
          nativeSessionActive = false
          nativePlaybackStateHint = "unknown"
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
      if (initialState?.startAtSegmentStart && bookmark && audioEngine) {
        audioEngine.seekToSegment(bookmark.segmentIndex)
      } else if (bookmark && audioEngine) {
        audioEngine.seekToMs(bookmark.timeMs)
      }

      setupMediaSession()
      syncNativeNowPlaying()

      // Auto-play if requested (after all setup is complete)
      if (initialState?.autoPlay) {
        void doPlay()
      }
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

    // On-device production (zip install) — pack root IS the data directory
    if (baseUrl?.startsWith("corpan-pack://")) {
      return baseUrl.replace(/\/$/, "")
    }

    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, "")}/data/books/${bid}`
    }

    return `/data/books/${bid}`
  }

  // --- Render loop (RAF-based, no Babylon) ---
  let rafId: number | null = null

  function renderLoop() {
    if (disposed) return
    rafId = requestAnimationFrame(renderLoop)

    // Reconcile play state with engine (debounced to avoid transient mismatches)
    if (audioEngine) {
      const now = performance.now()
      if (now < suppressExternalReconcileUntil) {
        // Suppressed during seeks, scrubs, and visibility recovery
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
                if (!playInFlight) {
                  doPause()
                }
              } else {
                // Running context + no source is a recoverable seam hole.
                audioEngine.ensureSourceIfPlaying("reconcile:hold-desired-playing")
              }
            } else {
              console.log(`[ER:sync] reconciled engine/app mismatch -> engine=${enginePlaying} app=${isPlaying}`)
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
              syncNativePlaybackState(isPlaying)
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

    transport.setTime(currentMs, totalMs)
    if (totalMs > 0) {
      transport.setProgress(currentMs / totalMs)
    }

    // Autosave bookmark
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

    // Update segment text if changed (catch cases not caught by onSegmentChange callback)
    if (audioEngine) {
      const segIdx = audioEngine.getCurrentSegmentIndex()
      if (segIdx !== lastSegmentIndex) {
        updateParagraphForSegment(segIdx)
        currentWordHint = 0
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

    // Stop audio immediately — before any other cleanup
    doPause()

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

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

    // Clear MediaSession so lock screen doesn't show stale player
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null
        for (const action of ["play", "pause", "seekto", "seekforward", "seekbackward", "nexttrack", "previoustrack"] as MediaSessionAction[]) {
          try { navigator.mediaSession.setActionHandler(action, null) } catch (e) { console.warn("[ER] clearActionHandler:", e) }
        }
      } catch (e) { console.warn("[ER] dispose mediaSession cleanup:", e) }
    }

    persistBookmark()
    chapterOverlay.dispose()
    transport.dispose()
    paragraphView.dispose()
    mediaAnchor?.dispose()
    mediaAnchor = null
    audioEngine?.dispose()
    wrapper.remove()
  }

  return {
    dispose,
    /** Persist bookmark (called by appShell before exit) */
    persistBookmark,
    /** Whether audio is currently playing */
    isPlaying: () => isPlaying,
  }
}
