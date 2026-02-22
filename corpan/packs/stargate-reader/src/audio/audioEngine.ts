import type { AudioManifest, BookSegment } from "../core/types"
import { resolveAudioUrl } from "../data/segmentLoader"
import { PRELOAD_AHEAD, OSCILLOSCOPE_SAMPLES } from "../core/constants"

export type AudioEngine = {
  unlock: () => void
  play: () => void
  pause: () => void
  stop: () => void
  seekToSegment: (index: number) => void
  getCurrentTimeMs: () => number
  isPlaying: () => boolean
  getAnalyserData: () => Uint8Array
  getFrequencyData: () => Uint8Array
  dispose: () => void
}

const isIOS =
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)

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
  onSegmentChange?: (index: number) => void,
  onPlaybackEnd?: () => void
): AudioEngine {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : undefined

  let ctx: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let gainNode: GainNode | null = null
  let currentSource: AudioBufferSourceNode | null = null
  let playing = false
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

  // Analyser data buffers
  const timeDomainData = new Uint8Array(OSCILLOSCOPE_SAMPLES)
  const frequencyData = new Uint8Array(OSCILLOSCOPE_SAMPLES)

  function ensureContext(): AudioContext | null {
    if (!AudioCtx) return null
    if (!ctx) {
      ctx = new AudioCtx()
      analyser = ctx.createAnalyser()
      analyser.fftSize = OSCILLOSCOPE_SAMPLES * 2
      analyser.smoothingTimeConstant = 0.8

      gainNode = ctx.createGain()
      gainNode.gain.value = isIOS ? 1.5 : 1.0
      gainNode.connect(analyser)
      analyser.connect(ctx.destination)
    }
    return ctx
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
    const promise = fetch(url)
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        return resp.arrayBuffer()
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        bufferCache.set(segmentId, buffer)
        loadingPromises.delete(segmentId)
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

  async function playSegment(index: number, offset: number = 0) {
    if (disposed || index >= segments.length) {
      playing = false
      onPlaybackEnd?.()
      return
    }

    const context = ensureContext()
    if (!context || !gainNode) return

    currentSegmentIndex = index
    onSegmentChange?.(index)

    const seg = segments[index]
    const entry = manifest.segments[seg.id]
    if (!entry) {
      // Skip segments without audio (e.g. image-only)
      accumulatedTimeMs = segmentAbsoluteStartMs[index + 1] ?? totalDurationMs
      playSegment(index + 1)
      return
    }

    const buffer = await loadBuffer(seg.id)
    if (!buffer || disposed) return

    // Stop previous source
    if (currentSource) {
      try { currentSource.stop() } catch { /* already stopped */ }
      currentSource.disconnect()
      currentSource = null
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gainNode)

    segmentStartedAtCtxTime = context.currentTime
    segmentPlaybackOffset = offset
    accumulatedTimeMs = segmentAbsoluteStartMs[index]

    source.onended = () => {
      if (disposed || !playing) return
      // Add this segment's duration + pause to accumulated time
      accumulatedTimeMs += entry.duration_ms + entry.pause_after_ms

      // Schedule next segment after pause
      if (entry.pause_after_ms > 0) {
        setTimeout(() => {
          if (!disposed && playing) {
            playSegment(index + 1)
          }
        }, entry.pause_after_ms)
      } else {
        playSegment(index + 1)
      }
    }

    source.start(0, offset / 1000)
    currentSource = source

    // Preload upcoming segments
    preloadAhead()
  }

  return {
    unlock: () => {
      const context = ensureContext()
      if (context && context.state === "suspended") {
        void context.resume()
      }
      preloadAhead()
    },

    play: () => {
      if (playing) return
      playing = true

      const context = ensureContext()
      if (context && context.state === "suspended") {
        void context.resume()
      }

      playSegment(currentSegmentIndex, segmentPlaybackOffset)
    },

    pause: () => {
      if (!playing) return
      playing = false

      // Calculate how far into the current segment we are
      if (ctx && currentSource) {
        const elapsed = (ctx.currentTime - segmentStartedAtCtxTime) * 1000
        segmentPlaybackOffset += elapsed
      }

      if (currentSource) {
        try { currentSource.stop() } catch { /* already stopped */ }
        currentSource.disconnect()
        currentSource = null
      }
    },

    stop: () => {
      playing = false
      currentSegmentIndex = 0
      segmentPlaybackOffset = 0
      accumulatedTimeMs = 0

      if (currentSource) {
        try { currentSource.stop() } catch { /* already stopped */ }
        currentSource.disconnect()
        currentSource = null
      }
    },

    seekToSegment: (index: number) => {
      const wasPlaying = playing
      if (currentSource) {
        try { currentSource.stop() } catch { /* already stopped */ }
        currentSource.disconnect()
        currentSource = null
      }
      playing = false
      currentSegmentIndex = Math.max(0, Math.min(index, segments.length - 1))
      segmentPlaybackOffset = 0
      accumulatedTimeMs = segmentAbsoluteStartMs[currentSegmentIndex] ?? 0

      if (wasPlaying) {
        playing = true
        playSegment(currentSegmentIndex)
      }
    },

    getCurrentTimeMs: (): number => {
      if (!ctx || !playing) {
        return accumulatedTimeMs + segmentPlaybackOffset
      }
      const elapsed = (ctx.currentTime - segmentStartedAtCtxTime) * 1000
      return accumulatedTimeMs + segmentPlaybackOffset + elapsed
    },

    isPlaying: () => playing,

    getAnalyserData: (): Uint8Array => {
      if (analyser) {
        analyser.getByteTimeDomainData(timeDomainData)
      }
      return timeDomainData
    },

    getFrequencyData: (): Uint8Array => {
      if (analyser) {
        analyser.getByteFrequencyData(frequencyData)
      }
      return frequencyData
    },

    dispose: () => {
      disposed = true
      playing = false

      if (currentSource) {
        try { currentSource.stop() } catch { /* already stopped */ }
        currentSource.disconnect()
        currentSource = null
      }
      if (ctx) {
        void ctx.close().catch(() => {})
      }
      ctx = null
      analyser = null
      gainNode = null
      bufferCache.clear()
      loadingPromises.clear()
    },
  }
}
