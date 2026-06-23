import type { AudioManifest, BookSegment } from "../core/types"
import { PRELOAD_AHEAD, OSCILLOSCOPE_SAMPLES } from "../core/constants"
import { packFetchArrayBuffer } from "../data/packFetch"

export type AudioEngine = {
  unlock: () => void
  play: () => void
  pause: () => void
  stop: () => void
  /** Ensure a live source exists when playback is expected (safe-point recovery only). */
  ensureSourceIfPlaying: (reason?: string) => void
  seekToSegment: (index: number) => void
  seekToMs: (targetMs: number) => void
  /** Update position state without starting audio — for scrub preview */
  seekToMsPreview: (targetMs: number) => void
  getCurrentTimeMs: () => number
  getCurrentSegmentIndex: () => number
  getTotalDurationMs: () => number
  getSegmentAbsoluteStartMs: () => number[]
  isPlaying: () => boolean
  getAnalyserData: () => Uint8Array
  getFloatTimeDomain: () => Float32Array
  getFrequencyData: () => Uint8Array
  /** Recover AudioContext after background suspension. Returns true if running. */
  recoverContext: () => Promise<boolean>
  /** Force close the AudioContext and create a fresh one. Use when the engine
   *  believes it's running but the OS audio session is dead (iOS deactivates
   *  AVAudioSession after idle lock-screen with paused playback — `recoverContext`
   *  can't detect this because the JS context still reports "running"). */
  recreateContext: () => Promise<boolean>
  getContextState: () => string
  dispose: () => void
}

/**
 * Create the audio engine for sequential segment playback with Web Audio API.
 *
 * Uses AudioContext → AudioBufferSourceNode → AnalyserNode → destination.
 * Pre-loads segments ahead of the current position.
 * Provides getCurrentTimeMs() for deterministic timeline sync.
 * AnalyserNode provides real-time waveform data for the oscilloscope.
 */
export function createAudioEngine(
  segments: BookSegment[],
  manifest: AudioManifest,
  resolveAudioUrl: (relativePath: string) => string,
  onSegmentChange?: (index: number) => void,
  onPlaybackEnd?: () => void,
  onBufferDecoded?: (segmentId: string, buffer: AudioBuffer) => void
): AudioEngine {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : undefined

  // Short anti-click fade applied on pause / narration-switch / dispose, and
  // a symmetric fade-in on play. Anything above ~20ms starts feeling like a
  // fade; 15ms is imperceptible as such but kills the click.
  const FADE_MS = 15

  let ctx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let gainNode: GainNode | null = null
  let currentSource: AudioBufferSourceNode | null = null
  // Per-source gain node, inserted between each source and the master gainNode.
  // Gives every source an independent fade envelope so a seek/switch can fade
  // the outgoing source to 0 while the incoming source ramps up from 0 —
  // without the two ramps fighting over one shared gain param.
  let currentSourceGain: GainNode | null = null
  let playing = false
  // When set, the next source `playSegment` starts is a discontinuity (seek,
  // resume, language switch) rather than a smooth segment-to-segment handoff,
  // so it must ramp gain up from ~0 to avoid a click. Cleared once consumed.
  // Normal segment handoffs leave this false: gain stays pinned at 1.0 so we
  // don't chop a dip into the start of every segment.
  let fadeInNextStart = false
  let waitingForNextSegment = false
  let waitingOwnerGeneration: number | null = null
  let nextSegmentTimer: ReturnType<typeof setTimeout> | null = null
  let pendingNextSegmentStartMs: number | null = null
  let pendingNextSegmentFromCtxTime: number | null = null
  let disposed = false

  // Timing state
  let currentSegmentIndex = 0
  let segmentStartedAtCtxTime = 0  // ctx.currentTime when segment playback started
  let segmentPlaybackOffset = 0    // offset within the current segment (for resume)
  let accumulatedTimeMs = 0        // total time elapsed for all completed segments

  // Buffer cache
  const bufferCache = new Map<string, AudioBuffer>()
  const loadingPromises = new Map<string, Promise<AudioBuffer | null>>()

  // Precomputed segment start times (absolute ms)
  const segmentAbsoluteStartMs: number[] = []
  let totalDurationMs = 0
  {
    let cursor = 0
    for (const seg of segments) {
      segmentAbsoluteStartMs.push(cursor)
      const entry = manifest.segments[seg.id]
      if (entry) {
        cursor += entry.duration_ms + entry.pause_after_ms
      }
    }
    totalDurationMs = cursor
  }

  // Generation counter — incremented on every seek/stop/pause to invalidate
  // stale async playSegment calls and pending onended/setTimeout callbacks
  let playbackGeneration = 0

  // Track whether AudioContext has been fully unlocked on iOS
  let contextUnlocked = false

  // Analyser data buffers
  const timeDomainData = new Uint8Array(OSCILLOSCOPE_SAMPLES)
  const floatTimeDomainData = new Float32Array(OSCILLOSCOPE_SAMPLES)
  const frequencyData = new Uint8Array(OSCILLOSCOPE_SAMPLES)

  function ensureContext(): AudioContext | null {
    if (!AudioCtx) return null
    if (!ctx) {
      ctx = new AudioCtx()

      // Route Web Audio through media channel on iOS — bypasses mute switch
      if ("audioSession" in navigator) {
        ;(navigator as any).audioSession.type = "playback"
      }

      analyser = ctx.createAnalyser()
      analyser.fftSize = OSCILLOSCOPE_SAMPLES * 2
      analyser.smoothingTimeConstant = 0

      gainNode = ctx.createGain()
      gainNode.gain.value = 1.0
      gainNode.connect(analyser)
      analyser.connect(ctx.destination)
    }
    return ctx
  }

  // Close the given AudioContext, clear all context-bound state, then create a
  // fresh one and unlock it with the silent-buffer trick. Shared between
  // recoverContext() (on resume failure) and recreateContext() (always).
  async function closeAndRecreateCtx(deadCtx: AudioContext): Promise<boolean> {
    try { await deadCtx.close() } catch (e) { console.warn("[audio] context.close():", e) }
    ctx = null
    analyser = null
    gainNode = null
    // Invalidate stale source/state from dead context
    outputLatencyLoggedOnce = false
    currentSource = null
    currentSourceGain = null
    fadeInNextStart = false

    waitingForNextSegment = false
    waitingOwnerGeneration = null
    pendingNextSegmentStartMs = null
    pendingNextSegmentFromCtxTime = null
    if (nextSegmentTimer) {
      clearTimeout(nextSegmentTimer)
      nextSegmentTimer = null
    }
    bufferCache.clear()
    loadingPromises.clear()
    contextUnlocked = false

    const newCtx = ensureContext()
    if (!newCtx) return false

    // Play silent buffer to unlock the new context on iOS
    const buf = newCtx.createBuffer(1, 1, 22050)
    const src = newCtx.createBufferSource()
    src.buffer = buf
    src.connect(newCtx.destination)
    src.start(0)
    contextUnlocked = true

    if (newCtx.state === "suspended") {
      try { await newCtx.resume() } catch (e) { console.warn("[audio] new context resume:", e) }
    }

    return newCtx.state === "running"
  }

  async function loadBuffer(segmentId: string): Promise<AudioBuffer | null> {
    if (bufferCache.has(segmentId)) return bufferCache.get(segmentId)!

    const existing = loadingPromises.get(segmentId)
    if (existing) return existing

    const entry = manifest.segments[segmentId]
    if (!entry) return null

    const context = ensureContext()
    if (!context) return null

    const url = resolveAudioUrl(entry.file)
    const promise = packFetchArrayBuffer(url)
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        bufferCache.set(segmentId, buffer)
        loadingPromises.delete(segmentId)
        onBufferDecoded?.(segmentId, buffer)
        return buffer
      })
      .catch((err) => {
        console.warn(`[AudioEngine] Failed to load ${segmentId}:`, err)
        loadingPromises.delete(segmentId)
        return null
      })

    loadingPromises.set(segmentId, promise)
    return promise
  }

  function preloadAhead() {
    for (
      let i = currentSegmentIndex;
      i < Math.min(currentSegmentIndex + PRELOAD_AHEAD, segments.length);
      i++
    ) {
      loadBuffer(segments[i].id)
    }
  }

  /**
   * Map an absolute timeline time to a concrete segment+offset.
   *
   * If target falls into a segment's trailing pause_after_ms gap, snap to the
   * next segment start so chapter/title state updates immediately after scrub.
   */
  function resolveSeekTarget(targetMs: number): { index: number; offsetMs: number } {
    const clamped = Math.max(0, Math.min(targetMs, totalDurationMs))

    // Binary search for the segment start at or before clamped time
    let lo = 0
    let hi = segments.length - 1
    let segIdx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (segmentAbsoluteStartMs[mid] <= clamped) {
        segIdx = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    const entry = manifest.segments[segments[segIdx].id]
    if (!entry) return { index: segIdx, offsetMs: 0 }

    const segStartMs = segmentAbsoluteStartMs[segIdx]
    const segAudioEndMs = segStartMs + entry.duration_ms

    // In pause gap between this segment and the next: snap forward to next start.
    if (clamped >= segAudioEndMs && segIdx < segments.length - 1) {
      return { index: segIdx + 1, offsetMs: 0 }
    }

    const offsetMs = Math.max(0, Math.min(clamped - segStartMs, entry.duration_ms))
    return { index: segIdx, offsetMs }
  }

  /**
   * Stop the current source. With `fadeMs > 0` schedules a tiny gain ramp to
   * near-silence first, then stops the source at the ramp end — kills the
   * click/pop you'd otherwise get from cutting mid-waveform. Scheduled on the
   * live AudioContext so dispose() can still return synchronously; the fade
   * plays out in the background.
   */
  function stopSource(fadeMs = 0) {
    if (nextSegmentTimer) {
      clearTimeout(nextSegmentTimer)
      nextSegmentTimer = null
    }
    waitingForNextSegment = false
    waitingOwnerGeneration = null
    pendingNextSegmentStartMs = null
    pendingNextSegmentFromCtxTime = null

    if (!currentSource) return
    const source = currentSource
    const sourceGain = currentSourceGain
    currentSource = null  // release the reference immediately so callers see "not playing"
    currentSourceGain = null

    if (fadeMs > 0 && ctx && sourceGain) {
      const now = ctx.currentTime
      const end = now + fadeMs / 1000
      try {
        // Ramp this source's OWN gain to silence — independent of the master
        // gain and of any incoming source's fade-in, so a seek/switch can
        // overlap the two without one ramp clobbering the other.
        sourceGain.gain.cancelScheduledValues(now)
        sourceGain.gain.setValueAtTime(sourceGain.gain.value, now)
        // linearRampToValueAtTime requires a non-zero target.
        sourceGain.gain.linearRampToValueAtTime(0.0001, end)
        source.stop(end)
        // Don't disconnect yet — disconnect would cut the source off from the
        // graph before the ramp finishes. Let the source play through to `end`,
        // then detach it. setTimeout uses ms, Web Audio uses seconds.
        setTimeout(() => {
          try { source.disconnect() } catch { /* already gone */ }
          try { sourceGain.disconnect() } catch { /* already gone */ }
        }, fadeMs + 5)
      } catch (e) {
        console.warn("[audio] fade-stop failed, hard-stopping:", e)
        try { source.stop() } catch { /* already stopped */ }
        try { source.disconnect() } catch { /* already disconnected */ }
        try { sourceGain.disconnect() } catch { /* already disconnected */ }
      }
      return
    }

    try { source.stop() } catch (e) { console.warn("[audio] source.stop():", e) }
    try { source.disconnect() } catch (e) { console.warn("[audio] source.disconnect():", e) }
    if (sourceGain) {
      try { sourceGain.disconnect() } catch (e) { console.warn("[audio] sourceGain.disconnect():", e) }
    }
  }

  /**
   * Intentionally no-op: getters must be read-only and never mutate playback state.
   * Playback state transitions happen only through explicit engine commands.
   */
  function syncContextPlaybackState() {
    // no-op by design
  }

  /**
   * Get the audio output latency in seconds.
   * This is the delay between when audio is rendered (ctx.currentTime)
   * and when it actually reaches the speakers.
   */
  let lastOutputLatencyS = 0
  let outputLatencyLoggedOnce = false

  function getOutputLatencyS(): number {
    if (!ctx) return 0

    // Prefer getOutputTimestamp() — gives the exact context time being heard
    try {
      const ts = (ctx as any).getOutputTimestamp?.()
      if (ts && typeof ts.contextTime === "number" && ts.contextTime > 0) {
        const latency = ctx.currentTime - ts.contextTime
        if (latency >= 0 && latency < 5) {
          lastOutputLatencyS = latency
          if (!outputLatencyLoggedOnce) {
            outputLatencyLoggedOnce = true
          }
          return latency
        }
      }
    } catch (e) { console.warn("[audio] getOutputTimestamp not supported:", e) }

    // Fallback: use baseLatency + outputLatency properties
    const base = (ctx as any).baseLatency ?? 0
    const output = (ctx as any).outputLatency ?? 0
    const fallback = base + output
    if (fallback > 0) {
      lastOutputLatencyS = fallback
      if (!outputLatencyLoggedOnce) {
        outputLatencyLoggedOnce = true
      }
      return fallback
    }

    return lastOutputLatencyS
  }

  function ensureSourceIfPlaying(reason: string = "unknown") {
    if (disposed || !playing) return
    const context = ensureContext()
    if (!context) return
    if (context.state !== "running") return
    if (currentSource || waitingForNextSegment) return
    console.warn(
      `[audio] ensureSourceIfPlaying(${reason}) restarting seg=${currentSegmentIndex} offset=${segmentPlaybackOffset.toFixed(1)}`
    )
    void playSegment(currentSegmentIndex, segmentPlaybackOffset)
  }

  function scheduleNextSegment(nextIndex: number, delayMs: number, gen: number) {
    waitingForNextSegment = true
    waitingOwnerGeneration = gen
    pendingNextSegmentStartMs = segmentAbsoluteStartMs[nextIndex] ?? totalDurationMs
    pendingNextSegmentFromCtxTime = ctx ? ctx.currentTime : null
    if (nextSegmentTimer) {
      clearTimeout(nextSegmentTimer)
      nextSegmentTimer = null
    }

    const run = () => {
      nextSegmentTimer = null
      const shouldContinue = !disposed && playing && gen === playbackGeneration
      if (shouldContinue) {
        playSegment(nextIndex)
      } else {
        const ownsWaitingState = waitingOwnerGeneration === gen
        if (ownsWaitingState) {
          waitingForNextSegment = false
          waitingOwnerGeneration = null
          pendingNextSegmentStartMs = null
          pendingNextSegmentFromCtxTime = null
        }
      }
    }

    if (delayMs > 0) {
      nextSegmentTimer = setTimeout(run, delayMs)
      return
    }
    run()
  }

  async function playSegment(index: number, offset: number = 0) {
    const gen = ++playbackGeneration

    if (disposed || index >= segments.length) {
      playing = false
      onPlaybackEnd?.()
      return
    }

    stopSource()

    const context = ensureContext()
    if (!context || !gainNode) return

    // Resume context if suspended (browser autoplay policy, tab switch, etc.)
    if (context.state === "suspended") {
      void context.resume()
    }

    currentSegmentIndex = index
    onSegmentChange?.(index)

    const seg = segments[index]
    const entry = manifest.segments[seg.id]
    if (!entry) {
      // Skip segments without audio (e.g. image-only)
      accumulatedTimeMs = segmentAbsoluteStartMs[index + 1] ?? totalDurationMs
      waitingForNextSegment = false
      waitingOwnerGeneration = null
      playSegment(index + 1)
      return
    }

    // Segment handoff can involve timer waits and async buffer decode/fetch.
    // Keep timeline clamped during this phase to avoid visible rewind snaps.
    waitingForNextSegment = true
    waitingOwnerGeneration = gen
    pendingNextSegmentStartMs =
      (segmentAbsoluteStartMs[index] ?? totalDurationMs) + Math.max(0, Math.min(offset, entry.duration_ms))
    pendingNextSegmentFromCtxTime = context.currentTime

    const buffer = await loadBuffer(seg.id)
    if (!buffer) {
      if (!disposed && playing && gen === playbackGeneration) {
        // Skip corrupt/missing segment instead of stalling in a "playing but silent" state.
        accumulatedTimeMs = segmentAbsoluteStartMs[index] + entry.duration_ms
        segmentPlaybackOffset = 0
        scheduleNextSegment(index + 1, entry.pause_after_ms, gen)
      }
      return
    }
    if (disposed || gen !== playbackGeneration) {
      return
    }

    // Re-check after async — another seek may have started a new source
    stopSource()

    // Clamp offset against actual buffer duration (manifest duration_ms
    // can differ slightly from decoded buffer length)
    const bufferDurationMs = buffer.duration * 1000
    const clampedOffset = Math.min(offset, bufferDurationMs)

    // If less than 50ms of audio remains, skip to next segment
    // instead of playing a near-zero-length sound
    if (bufferDurationMs - clampedOffset < 50) {
      accumulatedTimeMs = segmentAbsoluteStartMs[index] + entry.duration_ms
      segmentPlaybackOffset = 0
      segmentStartedAtCtxTime = context.currentTime
      scheduleNextSegment(index + 1, entry.pause_after_ms, gen)
      return
    }

    const source = context.createBufferSource()
    source.buffer = buffer

    // Each source gets its own gain node so its fade envelope is independent of
    // any outgoing source still fading out (seek / switch overlap).
    const sourceGain = context.createGain()
    source.connect(sourceGain)
    sourceGain.connect(gainNode)

    // If this start follows a discontinuity (seek / resume / narration switch),
    // ramp this source up from near-silence so it doesn't pop in at full
    // amplitude mid-waveform. Smooth segment handoffs skip this (gain starts at
    // 1.0) so continuous playback isn't notched at every segment boundary.
    if (fadeInNextStart) {
      fadeInNextStart = false
      const now = context.currentTime
      try {
        sourceGain.gain.setValueAtTime(0.0001, now)
        sourceGain.gain.linearRampToValueAtTime(1.0, now + FADE_MS / 1000)
      } catch (e) { console.warn("[audio] seek/switch fade-in failed:", e) }
    } else {
      sourceGain.gain.value = 1.0
    }

    segmentStartedAtCtxTime = context.currentTime
    segmentPlaybackOffset = clampedOffset
    accumulatedTimeMs = segmentAbsoluteStartMs[index]

    source.onended = () => {
      // Detach this source's gain node from the graph so it doesn't leak.
      try { sourceGain.disconnect() } catch { /* already gone */ }
      if (currentSource === source) {
        currentSource = null
        currentSourceGain = null
      }
      if (disposed || !playing || gen !== playbackGeneration) return

      accumulatedTimeMs = segmentAbsoluteStartMs[index] + entry.duration_ms
      segmentPlaybackOffset = 0
      if (ctx) segmentStartedAtCtxTime = ctx.currentTime
      scheduleNextSegment(index + 1, entry.pause_after_ms, gen)
    }

    source.start(0, clampedOffset / 1000)
    currentSource = source
    currentSourceGain = sourceGain

    waitingForNextSegment = false
    waitingOwnerGeneration = null
    pendingNextSegmentStartMs = null
    pendingNextSegmentFromCtxTime = null

    preloadAhead()
  }

  return {
    unlock: () => {
      const context = ensureContext()
      if (!context) return
      if (context.state === "suspended") {
        void context.resume()
      }
      if (!contextUnlocked) {
        // Play silent buffer to fully unlock AudioContext on iOS
        const buf = context.createBuffer(1, 1, 22050)
        const src = context.createBufferSource()
        src.buffer = buf
        src.connect(context.destination)
        src.start(0)
        contextUnlocked = true
      }
      preloadAhead()
    },

    play: () => {
      if (playing) return

      const context = ensureContext()
      if (context && context.state === "suspended") {
        void context.resume()
      }

      // Symmetric fade-in to match the out-fade in stopSource — avoids the
      // click on resume/narration-switch that would otherwise pair with the
      // fade-out click we just eliminated. The per-source gain (set in
      // playSegment when fadeInNextStart is armed) carries the ramp; the master
      // gainNode stays pinned at 1.0.
      playing = true
      fadeInNextStart = true
      playSegment(currentSegmentIndex, segmentPlaybackOffset)
    },

    pause: () => {
      if (!playing) return
      playing = false

      // Capture accurate paused position
      if (ctx && currentSource) {
        const elapsed = (ctx.currentTime - segmentStartedAtCtxTime) * 1000
        segmentPlaybackOffset += Math.max(0, elapsed)
      }

      // Stop source but keep context running — WebKit drops the
      // Now Playing widget if the context is suspended.
      // 15ms fade kills the click pause used to make on some waveforms.
      playbackGeneration++
      stopSource(FADE_MS)
    },

    stop: () => {
      playing = false
      playbackGeneration++

      currentSegmentIndex = 0
      segmentPlaybackOffset = 0
      accumulatedTimeMs = 0
      stopSource()
    },

    seekToSegment: (index: number) => {
      const wasPlaying = playing
      playing = false
      playbackGeneration++

      // Fade the outgoing source to silence before stopping (anti-click on the
      // old position) and ramp the new one up from 0 (anti-click on the new
      // position). Without the fades a scrub cuts/starts mid-waveform → pop.
      stopSource(wasPlaying ? FADE_MS : 0)

      currentSegmentIndex = Math.max(0, Math.min(index, segments.length - 1))
      segmentPlaybackOffset = 0
      accumulatedTimeMs = segmentAbsoluteStartMs[currentSegmentIndex] ?? 0

      if (wasPlaying) {
        playing = true
        fadeInNextStart = true
        playSegment(currentSegmentIndex)
      }
    },

    seekToMs: (targetMs: number) => {
      const wasPlaying = playing

      playing = false
      playbackGeneration++

      // See seekToSegment — fade out the old source, ramp in the new one.
      stopSource(wasPlaying ? FADE_MS : 0)

      const { index: segIdx, offsetMs: offsetWithinSegment } = resolveSeekTarget(targetMs)

      currentSegmentIndex = segIdx
      segmentPlaybackOffset = offsetWithinSegment
      accumulatedTimeMs = segmentAbsoluteStartMs[segIdx]

      if (wasPlaying) {
        playing = true
        fadeInNextStart = true
        playSegment(segIdx, offsetWithinSegment)
      }
    },

    seekToMsPreview: (targetMs: number) => {
      // Invalidate any pending async playback
      playbackGeneration++

      // Paused-scrub preview: no audio is playing so a hard stop won't click,
      // but if a source is somehow live (race), fade it.
      stopSource(currentSource ? FADE_MS : 0)

      const { index: segIdx, offsetMs: offsetWithinSegment } = resolveSeekTarget(targetMs)

      currentSegmentIndex = segIdx
      segmentPlaybackOffset = offsetWithinSegment
      accumulatedTimeMs = segmentAbsoluteStartMs[segIdx]

      // Don't touch `playing` — don't start audio.
      // getCurrentTimeMs() will return the previewed position
      // because playing is false (caller paused before scrub).
    },

    ensureSourceIfPlaying: (reason?: string) => {
      ensureSourceIfPlaying(reason)
    },

    getCurrentTimeMs: (): number => {
      syncContextPlaybackState()
      if (!ctx || !playing) {
        return accumulatedTimeMs + segmentPlaybackOffset
      }
      // Compensate for audio pipeline latency so visuals match what's heard
      const latencyS = getOutputLatencyS()
      const outputCtxTime = ctx.currentTime - latencyS
      if (!currentSource) {
        const baseMs = accumulatedTimeMs + segmentPlaybackOffset
        if (
          waitingForNextSegment &&
          pendingNextSegmentStartMs !== null &&
          pendingNextSegmentFromCtxTime !== null
        ) {
          const elapsedMs = Math.max(0, (outputCtxTime - pendingNextSegmentFromCtxTime) * 1000)
          return Math.min(baseMs + elapsedMs, pendingNextSegmentStartMs)
        }
        return baseMs
      }
      const elapsed = Math.max(0, (outputCtxTime - segmentStartedAtCtxTime) * 1000)
      return accumulatedTimeMs + segmentPlaybackOffset + elapsed
    },

    getCurrentSegmentIndex: () => currentSegmentIndex,

    getTotalDurationMs: () => totalDurationMs,

    getSegmentAbsoluteStartMs: () => segmentAbsoluteStartMs,

    isPlaying: () => {
      syncContextPlaybackState()
      return (
        playing &&
        ctx?.state === "running" &&
        (currentSource !== null || waitingForNextSegment)
      )
    },

    getAnalyserData: (): Uint8Array => {
      if (analyser) {
        analyser.getByteTimeDomainData(timeDomainData)
      }
      return timeDomainData
    },

    getFloatTimeDomain: (): Float32Array => {
      if (analyser) {
        analyser.getFloatTimeDomainData(floatTimeDomainData)
      }
      return floatTimeDomainData
    },

    getFrequencyData: (): Uint8Array => {
      if (analyser) {
        analyser.getByteFrequencyData(frequencyData)
      }
      return frequencyData
    },

    recoverContext: async (): Promise<boolean> => {
      if (!AudioCtx) return false
      const context = ensureContext()
      if (!context) return false

      // Already running — no recovery needed
      if (context.state === "running") {
        return true
      }

      // Try to resume the existing context (500ms timeout)
      try {
        await Promise.race([
          context.resume(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 500)),
        ])
      } catch (e) {
        console.warn("[audio] recoverContext resume failed:", e)
      }

      if ((context.state as string) === "running") {
        return true
      }

      // Context is dead — close it and create a fresh one
      return closeAndRecreateCtx(context)
    },

    recreateContext: async (): Promise<boolean> => {
      if (!AudioCtx) return false
      const context = ensureContext()
      if (!context) return false
      return closeAndRecreateCtx(context)
    },

    getContextState: (): string => {
      return ctx?.state ?? "closed"
    },

    dispose: () => {
      disposed = true
      playing = false
      playbackGeneration++

      if (nextSegmentTimer) {
        clearTimeout(nextSegmentTimer)
        nextSegmentTimer = null
      }
      waitingForNextSegment = false

      // Fade before stop so switching narrations (which disposes the old
      // engine) doesn't click. Context close is deferred until the ramp
      // completes — closing too early kills the scheduled gain ramp and
      // we're back to a hard stop.
      const closingCtx = ctx
      stopSource(FADE_MS)
      if (closingCtx) {
        setTimeout(() => {
          closingCtx.close().catch((e) => { console.warn("[audio] dispose ctx.close():", e) })
        }, FADE_MS + 20)
      }
      ctx = null
      analyser = null
      gainNode = null
      contextUnlocked = false
      bufferCache.clear()
      loadingPromises.clear()
    },
  }
}
