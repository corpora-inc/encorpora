// Segment-range playback session — the "missing primitive is segment-range
// addressing" (experiences-readers.md §7.1). Generalized from
// packs/earthgate-reader/src/game.ts one-shot replay logic
// (`oneShotTargetSegment` / `oneShotSegmentEndMs` / tap-to-replay / the
// end-of-segment stop check in the render loop): play segments [from..to],
// stop at `to`'s end, count replays, report per-segment completion.
//
// The session does NOT own the render loop — the consumer calls `tick()`
// every frame (earthgate: its RAF loop; the capability mount: its own RAF).

/** The slice of AudioEngine the session drives (structural — earthgate's
 *  `@shared/audio` engine satisfies it directly). */
export type SegmentSessionEngine = {
  seekToSegment(index: number): void
  play(): void
  pause(): void
  unlock(): void
  getCurrentTimeMs(): number
  getSegmentAbsoluteStartMs(): number[]
}

export type SegmentRange = { from: number; to: number }

export type SegmentSessionCallbacks = {
  /** Playback crossed the end of segment `index` (fires once per segment per
   *  playRange run, in order). */
  onSegmentComplete?: (index: number) => void
  /** The range's final segment finished. Fires after the engine is paused
   *  (and snapped back when requested). */
  onRangeEnd?: (range: SegmentRange) => void
}

export type PlayRangeOptions = {
  /** Seek back to the range start when the range finishes (earthgate
   *  tap-to-replay preview behavior). Default false. */
  snapBackOnEnd?: boolean
  /** Count this playRange as a replay (same range re-played). Managed
   *  automatically; set false to suppress (initial autoplay). */
  countReplay?: boolean
}

export type SegmentSession = {
  /** Seek to `from`, unlock + play, stop after `to` finishes. */
  playRange(from: number, to: number, opts?: PlayRangeOptions): void
  /** Arm the range WITHOUT driving the engine (consumer resumes playback
   *  through its own transport path). Boundary detection starts from the
   *  engine's current position. */
  armRange(from: number, to: number, opts?: Pick<PlayRangeOptions, "snapBackOnEnd">): void
  /** Frame driver. Detects segment-boundary crossings and range end. */
  tick(): void
  /** Abort the active range without firing onRangeEnd. */
  cancel(snapBack: boolean): void
  isActive(): boolean
  getRange(): SegmentRange | null
  getReplays(): number
  /** Highest absolute ms reached while a range was active (listen evidence). */
  getMaxReachedMs(): number
}

export function createSegmentSession(
  engine: SegmentSessionEngine,
  /** Duration of segment `index` in ms (from the audio manifest), or null
   *  when unknown (segment skipped for completion purposes). */
  segmentDurationMs: (index: number) => number | null,
  callbacks?: SegmentSessionCallbacks,
): SegmentSession {
  let range: SegmentRange | null = null
  let snapBackOnEnd = false
  let nextBoundaryIdx = 0 // next segment index awaiting completion
  let endMs: number | null = null
  let replays = 0
  let lastRangeKey = ""
  let maxReachedMs = 0

  const segmentEndMs = (index: number): number | null => {
    const starts = engine.getSegmentAbsoluteStartMs()
    const dur = segmentDurationMs(index)
    if (index < 0 || index >= starts.length || dur === null) return null
    return starts[index] + dur
  }

  const clear = () => {
    range = null
    endMs = null
    snapBackOnEnd = false
  }

  const arm = (from: number, to: number, snapBack: boolean) => {
    range = { from, to }
    snapBackOnEnd = snapBack
    endMs = segmentEndMs(to)
    // Boundary detection starts at the first segment whose end is still
    // ahead of the engine's current position.
    const currentMs = engine.getCurrentTimeMs()
    let idx = from
    while (idx <= to) {
      const boundary = segmentEndMs(idx)
      if (boundary !== null && currentMs < boundary) break
      idx += 1
    }
    nextBoundaryIdx = idx
  }

  return {
    playRange(from, to, opts) {
      const key = `${from}-${to}`
      const shouldCount = opts?.countReplay ?? key === lastRangeKey
      if (shouldCount) replays += 1
      lastRangeKey = key
      engine.seekToSegment(from)
      arm(from, to, opts?.snapBackOnEnd ?? false)
      nextBoundaryIdx = from
      engine.unlock()
      engine.play()
    },

    armRange(from, to, opts) {
      lastRangeKey = `${from}-${to}`
      arm(from, to, opts?.snapBackOnEnd ?? false)
    },

    tick() {
      if (!range) return
      const currentMs = engine.getCurrentTimeMs()
      if (currentMs > maxReachedMs) maxReachedMs = currentMs

      // Per-segment boundary crossings (in order, once each).
      while (nextBoundaryIdx <= range.to) {
        const boundary = segmentEndMs(nextBoundaryIdx)
        if (boundary === null) {
          nextBoundaryIdx += 1
          continue
        }
        if (currentMs >= boundary) {
          const idx = nextBoundaryIdx
          nextBoundaryIdx += 1
          callbacks?.onSegmentComplete?.(idx)
        } else {
          break
        }
      }

      // Range end: the final segment's audio just finished.
      if (endMs !== null && currentMs >= endMs) {
        const finished = range
        const snap = snapBackOnEnd
        clear()
        engine.pause()
        if (snap) engine.seekToSegment(finished.from)
        callbacks?.onRangeEnd?.(finished)
      }
    },

    cancel(snapBack) {
      if (!range) {
        clear()
        return
      }
      const target = range.from
      clear()
      engine.pause()
      if (snapBack) engine.seekToSegment(target)
    },

    isActive: () => range !== null,
    getRange: () => (range ? { ...range } : null),
    getReplays: () => replays,
    getMaxReachedMs: () => maxReachedMs,
  }
}
