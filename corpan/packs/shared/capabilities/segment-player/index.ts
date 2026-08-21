// cap-segment-player — word-sync segment-range playback as a capability
// module (capability-modules.md §4.3). Composes the shared machinery
// (@shared/data provider → @shared/core buildTimeline → @shared/audio
// createAudioEngine → paragraphView → segmentSession) behind the §2
// capability contract. A FOREGROUND micro-player: screen-on, card-sized,
// no lock-screen / background-audio integration (that machinery stays in
// the earthgate pack shell).
import "./styles.css"
import type {
  ActivityItemResult,
  ActivityResult,
  ActivitySpec,
  CapabilityAvailability,
  CapabilityHandle,
  CapabilityHostApi,
  CapabilityModule,
} from "@shared/capabilities/core"
import {
  clamp01,
  createActiveClock,
  createSettleOnce,
  makeAbandonedResult,
} from "@shared/capabilities/core"
import { buildTimeline, findCurrentWordIndex } from "@shared/core"
import type { BookSegment, TimelineWord } from "@shared/core"
import { createAudioEngine, type AudioEngine } from "@shared/audio"
import { createParagraphView, type ParagraphView } from "./src/paragraphView"
import { createSegmentSession, type SegmentSession } from "./src/segmentSession"
import {
  loadSegmentPlayerData,
  type SegmentPlayerPreloaded,
} from "./src/dataSource"

export { createParagraphView, type ParagraphView, type ParagraphViewOptions } from "./src/paragraphView"
export {
  createSegmentSession,
  type SegmentSession,
  type SegmentSessionEngine,
  type SegmentRange,
  type SegmentSessionCallbacks,
} from "./src/segmentSession"
export { loadSegmentPlayerData, type SegmentPlayerPreloaded, type SegmentPlayerSource } from "./src/dataSource"

export interface CapSegmentPlayerParams {
  bookId: string
  language: string
  /** Segment ids (`ch01-004`) or an index range. REQUIRED, non-empty. */
  segments: string[] | { fromIndex: number; toIndex: number }
  /** Root URL of the INSTALLED narration pack (consumer resolves via
   *  `@shared/catalog` getPackUrl). Mutually exclusive with preloaded. */
  baseUrl?: string
  /** Preloaded-data path (earthgate initialState precedent): lets the
   *  Journey feed run synthetic mini-books with no installed pack. */
  preloaded?: SegmentPlayerPreloaded
  autoPlay?: boolean // default true (after resume when startPaused)
  showText?: boolean // default true; false = pure listening card
  /** Require every segment fully heard for pass (default true). */
  requireFullListen?: boolean
  startPaused?: boolean
}

const readParams = (spec: ActivitySpec): CapSegmentPlayerParams =>
  (spec.params ?? {}) as unknown as CapSegmentPlayerParams

const mount = (
  container: HTMLElement,
  hostApi: CapabilityHostApi,
  spec: ActivitySpec,
): CapabilityHandle => {
  void hostApi // core-only slice; narration audio is pre-rendered
  const params = readParams(spec)
  const settle = createSettleOnce()
  const clock = createActiveClock(undefined, params.startPaused === true)

  const root = document.createElement("div")
  root.className = "capSeg-root"
  root.innerHTML = `
    <div class="capSeg-stage"></div>
    <div class="capSeg-controls">
      <button class="capSeg-playBtn" type="button" aria-label="Play">▶</button>
      <div class="capSeg-progress" aria-hidden="true"></div>
    </div>
  `
  container.appendChild(root)
  const stage = root.querySelector<HTMLDivElement>(".capSeg-stage")!
  const playBtn = root.querySelector<HTMLButtonElement>(".capSeg-playBtn")!
  const progressEl = root.querySelector<HTMLDivElement>(".capSeg-progress")!

  let paragraphView: ParagraphView | null = null
  let engine: AudioEngine | null = null
  let session: SegmentSession | null = null
  let rafId: number | null = null
  let disposed = false
  let paused = params.startPaused === true
  let playing = false
  let interacted = false

  // Range-local playback model: the engine is built over ONLY the requested
  // segments (sliced), so index 0..n-1 is the range and engine end == range
  // end. Per-segment completion evidence:
  let rangeSegments: BookSegment[] = []
  let segDurations: Array<number | null> = []
  let timelineWords: TimelineWord[] = []
  let currentWordHint = 0
  let lastSegmentIndex = -1
  let completedFlags: boolean[] = []
  let maxReachedMs = 0

  const requireFull = params.requireFullListen !== false

  const setPlayUi = (isPlaying: boolean) => {
    playing = isPlaying
    playBtn.textContent = isPlaying ? "❚❚" : "▶"
    playBtn.setAttribute("aria-label", isPlaying ? "Pause" : "Play")
  }

  const listenedFractionFor = (i: number): number => {
    if (!engine) return 0
    if (completedFlags[i]) return 1
    const starts = engine.getSegmentAbsoluteStartMs()
    const dur = segDurations[i]
    if (dur === null || dur <= 0 || i >= starts.length) return 0
    return clamp01((maxReachedMs - starts[i]) / dur)
  }

  const buildResult = (abandoned: boolean): ActivityResult => {
    const perItem: ActivityItemResult[] = rangeSegments.map((seg, i) => {
      const fraction = listenedFractionFor(i)
      const pass = requireFull ? completedFlags[i] === true : fraction >= 0.5
      const outcome: ActivityItemResult["outcome"] = pass
        ? "pass"
        : fraction >= 0.5
          ? "partial"
          : "fail"
      return {
        itemRef: { kind: "segment", source: params.bookId, id: seg.id },
        outcome,
      }
    })
    const fractions = rangeSegments.map((_, i) => listenedFractionFor(i))
    const score = fractions.length
      ? clamp01(fractions.reduce((a, b) => a + b, 0) / fractions.length)
      : 0
    return {
      specId: spec.specId,
      score,
      perItem,
      durationMs: Math.round(clock.activeMs()),
      detail: {
        numbers: {
          listenedMs: Math.round(maxReachedMs),
          replays: session?.getReplays() ?? 0,
          segmentsCompleted: completedFlags.filter(Boolean).length,
          totalSegments: rangeSegments.length,
        },
      },
      ...(abandoned ? { abandoned: true } : {}),
    }
  }

  const settleNow = (abandoned: boolean) => {
    if (settle.settled()) return
    if (abandoned && !interacted && maxReachedMs <= 0) {
      settle.settle(
        makeAbandonedResult(spec, clock.activeMs(), {
          numbers: { totalSegments: rangeSegments.length },
        }),
      )
      return
    }
    settle.settle(buildResult(abandoned))
    // Freeze the final frame (§2.3 rule 5): stop playback, keep the DOM.
    engine?.pause()
    setPlayUi(false)
  }

  const timeboxMs =
    typeof spec.timeboxSec === "number" && spec.timeboxSec > 0
      ? spec.timeboxSec * 1000
      : null

  const renderLoop = () => {
    if (disposed) return
    rafId = requestAnimationFrame(renderLoop)
    if (!engine) return
    session?.tick()
    const currentMs = engine.getCurrentTimeMs()
    if (currentMs > maxReachedMs) maxReachedMs = currentMs

    // Segment change → swap paragraph text.
    const segIdx = engine.getCurrentSegmentIndex()
    if (segIdx !== lastSegmentIndex) {
      lastSegmentIndex = segIdx
      currentWordHint = 0
      updateParagraph(segIdx)
      updateProgress(segIdx)
    }

    // Word highlight.
    if (timelineWords.length > 0 && paragraphView) {
      const idx = findCurrentWordIndex(timelineWords, currentMs, currentWordHint)
      if (idx >= 0) {
        currentWordHint = idx
        paragraphView.highlightWord(timelineWords[idx].wordIndex)
      }
    }

    // Soft timebox (§1): auto-settle with whatever was measured.
    if (timeboxMs !== null && !settle.settled() && clock.activeMs() >= timeboxMs) {
      settleNow(!interacted && maxReachedMs <= 0)
    }
  }

  let manifestSegments: Record<string, { duration_ms: number; words: unknown[] } | undefined> = {}

  function updateParagraph(segIdx: number) {
    const seg = rangeSegments[segIdx]
    if (!seg || !paragraphView) return
    paragraphView.setSegment(
      seg,
      manifestSegments[seg.id] as Parameters<ParagraphView["setSegment"]>[1],
    )
  }

  function updateProgress(segIdx: number) {
    const dots = rangeSegments
      .map((_, i) => {
        const cls =
          i < segIdx || completedFlags[i]
            ? "capSeg-dot capSeg-dot--done"
            : i === segIdx
              ? "capSeg-dot capSeg-dot--active"
              : "capSeg-dot"
        return `<span class="${cls}"></span>`
      })
      .join("")
    progressEl.innerHTML = dots
  }

  const startPlayback = () => {
    if (!engine || !session || settle.settled()) return
    interacted = true
    if (rangeSegments.length === 0) return
    session.playRange(0, rangeSegments.length - 1, { countReplay: false })
    setPlayUi(true)
  }

  playBtn.addEventListener("click", () => {
    if (!engine || settle.settled() || paused) return
    interacted = true
    if (playing) {
      engine.pause()
      setPlayUi(false)
    } else if (session?.isActive()) {
      engine.unlock()
      engine.play()
      setPlayUi(true)
    } else {
      startPlayback()
    }
  })

  // Async boot: load data, build engine + views. Mount itself stays cheap;
  // the skeleton (empty stage + controls) is visible immediately (§2.3.1).
  void (async () => {
    try {
      const source = await loadSegmentPlayerData({
        language: params.language,
        baseUrl: params.baseUrl,
        preloaded: params.preloaded,
      })
      if (disposed) return
      manifestSegments = source.manifest.segments as typeof manifestSegments

      // Resolve the requested range → a sliced segment list.
      const all = source.segments
      let picked: BookSegment[]
      if (Array.isArray(params.segments)) {
        const wanted = new Set(params.segments)
        picked = all.filter((s) => wanted.has(s.id))
      } else if (
        params.segments &&
        typeof params.segments.fromIndex === "number" &&
        typeof params.segments.toIndex === "number"
      ) {
        picked = all.slice(params.segments.fromIndex, params.segments.toIndex + 1)
      } else {
        picked = []
      }
      if (picked.length === 0) {
        settle.settle(
          makeAbandonedResult(spec, clock.activeMs(), {
            flags: { noSegments: true },
          }),
        )
        return
      }
      rangeSegments = picked
      completedFlags = picked.map(() => false)
      segDurations = picked.map(
        (s) => source.manifest.segments[s.id]?.duration_ms ?? null,
      )

      const timeline = buildTimeline(picked, source.manifest)
      timelineWords = timeline.words

      if (params.showText !== false) {
        paragraphView = createParagraphView(stage)
        paragraphView.onTap(() => {
          // Replay affordance: tap the text to replay the CURRENT segment.
          if (!engine || !session || settle.settled() || paused) return
          interacted = true
          const idx = engine.getCurrentSegmentIndex()
          session.playRange(idx, idx, { countReplay: true })
          setPlayUi(true)
        })
      }

      engine = createAudioEngine(
        picked,
        source.manifest,
        source.provider.resolveAudioUrl,
      )
      session = createSegmentSession(
        engine,
        (i) => segDurations[i] ?? null,
        {
          onSegmentComplete: (i) => {
            if (i >= 0 && i < completedFlags.length) completedFlags[i] = true
            updateProgress(engine ? engine.getCurrentSegmentIndex() : i)
          },
          onRangeEnd: (range) => {
            setPlayUi(false)
            // Natural completion boundary: the requested range fully played.
            if (range.from === 0 && range.to === rangeSegments.length - 1) {
              settleNow(false)
            }
          },
        },
      )

      updateParagraph(0)
      updateProgress(0)
      lastSegmentIndex = 0
      rafId = requestAnimationFrame(renderLoop)

      if (!paused && params.autoPlay !== false) {
        startPlayback()
        // Autoplay is exposure, not user interaction — timebox with zero
        // taps still counts the audio actually heard via maxReachedMs.
        interacted = false
      }
    } catch (err) {
      console.error("[cap-segment-player] boot failed:", err)
      if (!settle.settled()) {
        settle.settle(
          makeAbandonedResult(spec, clock.activeMs(), {
            flags: { loadFailed: true },
          }),
        )
      }
    }
  })()

  return {
    result: settle.promise,
    pause() {
      if (paused) return
      paused = true
      clock.pause()
      engine?.pause()
      setPlayUi(false)
    },
    resume() {
      if (!paused) return
      paused = false
      clock.resume()
      if (settle.settled()) return
      if (params.autoPlay !== false) {
        if (session?.isActive() && engine) {
          engine.unlock()
          engine.play()
          setPlayUi(true)
        } else {
          startPlayback()
          interacted = false
        }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (!settle.settled()) settleNow(true)
      if (rafId !== null) cancelAnimationFrame(rafId)
      session?.cancel(false)
      paragraphView?.dispose()
      engine?.dispose()
      root.remove()
    },
  }
}

const checkAvailability = async (
  _hostApi: CapabilityHostApi,
  spec?: ActivitySpec,
): Promise<CapabilityAvailability> => {
  const params = spec ? readParams(spec) : undefined
  if (!params) return { state: "ready" }
  if (params.preloaded) return { state: "ready" }
  if (params.baseUrl) return { state: "ready" }
  return {
    state: "needs-content",
    kind: "narration",
    packId: params.bookId ?? "",
  }
}

export const capability: CapabilityModule = {
  meta: {
    id: "cap-segment-player",
    version: "0.1.0",
    modelNeeds: [],
    cssPrefix: "capSeg",
    usesHostApis: [],
  },
  mount,
  checkAvailability,
}
