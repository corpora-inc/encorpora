import type { HostApi } from "@shared/sdk"
import type { AudioManifest, BookSegment, TimelineWord, ChapterInfo } from "@shared/core"
import { BOOK_NAMES } from "@shared/core"
import { buildTimeline, findCurrentWordIndex, buildChapterIndex } from "@shared/core"
import { createFetchDataProvider, createPreloadedDataProvider, type DataProvider } from "@shared/data"
import { createAudioEngine, type AudioEngine, createMediaSessionAnchor, type MediaSessionAnchor, getMediaSessionArtworkUrl } from "@shared/audio"
import { createTransportBar } from "@shared/ui"
import { createChapterOverlay, type ChapterOverlay } from "@shared/ui"
import { createBookmarkStore, createBookMetaStore, type Bookmark, drawerStore } from "@shared/state"
import * as analytics from "@shared/analytics"
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
const bookMeta = createBookMetaStore("earthgate-reader")

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

  // True if the app has been in the hidden+paused state since the last play.
  // On iOS, AVAudioSession can silently deactivate in this state — next doPlay
  // will do a pre-emptive session rebuild (recoverContext can't detect this
  // because the JS AudioContext still reports "running").
  let audioSessionMayBeStale = false

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
    endPreview(false)
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
    endPreview(false)
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

    // Pre-emptive session rebuild: iOS may have silently killed AVAudioSession
    // during a paused-hidden interval. recoverContext() can't detect this
    // (JS context still reports "running"), so tear everything down and rebuild
    // before the normal play path. See audioSessionMayBeStale declaration.
    if (audioSessionMayBeStale) {
      console.log("[ER:stale] pre-emptive audio session rebuild")
      audioSessionMayBeStale = false
      try { await stopNativeKeepAlive() } catch (e) { console.warn("[ER:stale] stopNativeKeepAlive:", e) }
      nativeSessionActive = false
      nativePlaybackStateHint = "unknown"
      mediaAnchor?.dispose()
      mediaAnchor = null
      try { await audioEngine.recreateContext() } catch (e) { console.error("[ER:stale] recreateContext:", e) }
      if (shouldCancelPlayRequest()) return
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
    endPreview(false)
    // Pausing while the app is hidden (e.g. lock-screen pause routed through
    // listenForRemoteCommands) means iOS may now quietly kill the audio
    // session — flag for pre-emptive rebuild on the next play.
    if (document.hidden) {
      audioSessionMayBeStale = true
    }
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
  // Corpán Plus: true when the installed pack is a truncated free preview.
  let isPreview = false

  const bookId =
    (initialState?.bookId as string) ||
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("book") || "book_monte_alban"
      : "unknown")

  const bookDisplayName =
    (initialState?.bookTitle as string) || BOOK_NAMES[bookId] || bookId

  // Corpán Plus: ask the host to open the paywall after a finished preview.
  // The main app listens for this window event (same channel the purchase
  // manager uses) and opens PaywallSheet with this book's context.
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
            theme: "earthgate",
          },
        })
      )
    } catch (err) {
      console.warn("[EarthgateReader] request-unlock dispatch failed:", err)
    }
  }

  // Corpán Plus: report deepest segment reached so the host's progress store
  // can power the Library "Continue" shelf + streaks. Fire-and-forget.
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

  // Tap-to-replay "preview": play one segment from start, then auto-pause
  // and snap back. During a preview the external play state (isPlaying,
  // transport button, wake lock, media session, native keep-alive) stays
  // in the paused state so language switches, scroll, scrubs, etc. all see
  // a paused reader. Any interruption ends the preview without side effects.
  let previewActive = false
  let oneShotTargetSegment: number | null = null
  let oneShotSegmentEndMs: number | null = null
  function endPreview(snapBack: boolean) {
    if (!previewActive) {
      oneShotTargetSegment = null
      oneShotSegmentEndMs = null
      return
    }
    const target = oneShotTargetSegment
    previewActive = false
    oneShotTargetSegment = null
    oneShotSegmentEndMs = null
    if (!audioEngine) return
    audioEngine.pause()
    if (snapBack && target !== null) {
      audioEngine.seekToSegment(target)
    }
  }

  // Paragraph view
  const paragraphView: ParagraphView = createParagraphView(ui)

  // Chapter overlay
  let chapterOverlay: ChapterOverlay = createChapterOverlay(ui, "earthgate")
  let lastChapterIndex = -1

  // Transport bar
  const transport = createTransportBar(ui, "earthgate")
  transport.setBookTitle(bookDisplayName)
  // Reserve a line for the chapter title if we've seen this book
  // before and know it's chaptered. Without this, the transport's
  // layout shifts when the async-loaded chapter title arrives — most
  // noticeably on language switches, where the controls visibly jerk.
  // First-ever read of a brand-new book has no cache and accepts one
  // small shift; subsequent mounts are stable from frame one.
  const cachedMeta = bookMeta.load(bookId)
  if (cachedMeta?.hasChapters) {
    transport.setHasChapters(true)
  }

  // --- Swipe navigation ---
  paragraphView.onNext(() => {
    if (!audioEngine) return
    endPreview(false)
    const nextSeg = audioEngine.getCurrentSegmentIndex() + 1
    if (nextSeg < segments.length) {
      audioEngine.seekToSegment(nextSeg)
      syncNativeNowPlaying()
    }
  })

  paragraphView.onPrev(() => {
    if (!audioEngine) return
    endPreview(false)
    const prevSeg = Math.max(0, audioEngine.getCurrentSegmentIndex() - 1)
    audioEngine.seekToSegment(prevSeg)
    syncNativeNowPlaying()
  })

  // --- Tap-to-replay segment ---
  // When paused, tapping the visible paragraph replays that one segment from
  // its start and snaps back so the listener can repeat it (or switch
  // language/narration and replay in the new voice).
  paragraphView.onTap(() => {
    if (!audioEngine || !manifest) return
    if (isPlaying) return
    // Restart preview if one is already running
    endPreview(false)
    const segIdx = audioEngine.getCurrentSegmentIndex()
    const seg = segments[segIdx]
    if (!seg) return
    const mseg = manifest.segments[seg.id]
    if (!mseg) return
    analytics.track("segment_play_one", { segment_index: segIdx })
    const starts = audioEngine.getSegmentAbsoluteStartMs()
    const endMs = starts[segIdx] + mseg.duration_ms
    // Position at segment start without touching external state.
    audioEngine.seekToSegment(segIdx)
    oneShotTargetSegment = segIdx
    oneShotSegmentEndMs = endMs
    previewActive = true
    // Drive the audio engine directly — no transport/wake-lock/media-session
    // side effects. Language switches, scrubs, etc. still see isPlaying=false.
    audioEngine.unlock()
    audioEngine.play()
  })

  // --- Transport callbacks ---
  transport.onPlay(() => {
    endPreview(false)
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
      if (!desiredPlaying) {
        audioSessionMayBeStale = true
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
        // Corpán Plus: explicit flag, or infer from a truncated segment list.
        isPreview =
          segData.is_preview === true ||
          (typeof segData.total_segments === "number" &&
            segData.segments.length < segData.total_segments)
        manifest = await dataProvider.loadAudioManifest(currentLanguage)
      }

      if (disposed) return

      // Only set nowPlaying — languages/currentLanguage are managed by appShell
      drawerStore.setState({ nowPlaying: { bookTitle: bookDisplayName } })

      chapters = buildChapterIndex(segments)

      // Update the per-book hasChapters cache so the *next* mount of
      // this book reserves (or doesn't) the chapter title row before
      // segments load.
      const hasChapters = chapters.length > 1
      transport.setHasChapters(hasChapters)
      if (cachedMeta?.hasChapters !== hasChapters) {
        bookMeta.save(bookId, { ...cachedMeta, hasChapters })
      }

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
            reportSegmentProgress(index)
            if (audioEngine?.isPlaying()) {
              analytics.track("segment_play", { segment_index: index })
            }
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
          // Corpán Plus: a finished preview is the conversion moment. Ask the
          // host to surface the paywall (subscription-only). The host opens
          // PaywallSheet; if the user subscribes, the full pack replaces this
          // preview on next install.
          if (isPreview) {
            maybeOfferPlus()
          }
        },
        () => {
          // No waveform extraction needed for DOM rendering
        }
      )

      // Empty string for chapterless books — the `:empty { display: none }`
      // rule on `.earthgate-chapter-title` collapses the row, keeping the
      // book title vertically centered against the time on the right.
      // Don't fall back to a status string like "Ready" — it would vanish
      // on first play (when the audio engine fires the segment callback
      // with the real empty title) and visibly shrink the transport bar.
      transport.setChapter(segments[0]?.title || "")

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
      if (previewActive || now < suppressExternalReconcileUntil) {
        // Suppressed during tap-to-replay preview, seeks, scrubs, and visibility recovery
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

    // Tap-to-replay auto-pause: segment's audio just ended → snap back to start.
    if (
      previewActive &&
      oneShotSegmentEndMs !== null &&
      currentMs >= oneShotSegmentEndMs
    ) {
      endPreview(true)
    }

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
