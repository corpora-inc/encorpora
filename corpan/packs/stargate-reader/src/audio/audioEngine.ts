import type { AudioManifest, BookSegment } from "../core/types"
import { PRELOAD_AHEAD, OSCILLOSCOPE_SAMPLES } from "../core/constants"
import { packFetchArrayBuffer } from "../data/packFetch"

export type AudioEngine = {
  unlock: () => void
  play: () => void
  pause: () => void
  stop: () => void
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
  resolveAudioUrl: (relativePath: string) => string,
  onSegmentChange?: (index: number) => void,
  onPlaybackEnd?: () => void,
  onBufferDecoded?: (segmentId: string, buffer: AudioBuffer) => void
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

  /** Inject a hidden <audio> element to force WKWebView media channel on older iOS */
  function ensureMediaChannel() {
    if (!isIOS) return
    if (document.getElementById("sr-silent-audio")) return
    const audio = document.createElement("audio")
    audio.id = "sr-silent-audio"
    // Tiny silent MP3 (~100 bytes) — forces iOS audio session to media channel
    audio.src =
      "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwAAAAAAAAAAAAAAAAD/+0DEAAAA0gAl6AAACAAADSAMAAATIAXB7wAAMAAAAA/8+D5B0Hw/BAMf/Lh/5cEAQBAEAQ/lg+X////8uCAIAgCH/y4f//5cEAQBAEP/Lh/////+XBAMf/Lg//8uD///5cH///////+XBAEAQBD/5cP////8uCAIAh/8uH//+XB/8uH/////////////8AAAAAAAAAAAAAAAAAAAAAAA=="
    audio.loop = true
    audio.volume = 0.01
    audio.setAttribute("playsinline", "")
    document.body.appendChild(audio)
    audio.play().catch(() => {})
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

  function stopSource() {
    if (currentSource) {
      try { currentSource.stop() } catch { /* already stopped */ }
      try { currentSource.disconnect() } catch { /* already disconnected */ }
      currentSource = null
    }
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
      playSegment(index + 1)
      return
    }

    const buffer = await loadBuffer(seg.id)
    if (!buffer || disposed || gen !== playbackGeneration) return

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
      if (entry.pause_after_ms > 0) {
        segmentStartedAtCtxTime = context.currentTime
        setTimeout(() => {
          if (!disposed && playing && gen === playbackGeneration) {
            playSegment(index + 1)
          }
        }, entry.pause_after_ms)
      } else {
        playSegment(index + 1)
      }
      return
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gainNode)

    segmentStartedAtCtxTime = context.currentTime
    segmentPlaybackOffset = clampedOffset
    accumulatedTimeMs = segmentAbsoluteStartMs[index]

    source.onended = () => {
      if (disposed || !playing || gen !== playbackGeneration) return

      accumulatedTimeMs = segmentAbsoluteStartMs[index] + entry.duration_ms
      segmentPlaybackOffset = 0
      if (ctx) segmentStartedAtCtxTime = ctx.currentTime

      if (entry.pause_after_ms > 0) {
        setTimeout(() => {
          if (!disposed && playing && gen === playbackGeneration) {
            playSegment(index + 1)
          }
        }, entry.pause_after_ms)
      } else {
        playSegment(index + 1)
      }
    }

    source.start(0, clampedOffset / 1000)
    currentSource = source

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
      playing = true

      const context = ensureContext()
      if (context && context.state === "suspended") {
        void context.resume()
      }

      ensureMediaChannel()
      playSegment(currentSegmentIndex, segmentPlaybackOffset)
    },

    pause: () => {
      if (!playing) return
      playing = false
      playbackGeneration++

      // Calculate how far into the current segment we are
      if (ctx && currentSource) {
        const elapsed = (ctx.currentTime - segmentStartedAtCtxTime) * 1000
        segmentPlaybackOffset += elapsed
      }

      stopSource()
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
      stopSource()

      currentSegmentIndex = Math.max(0, Math.min(index, segments.length - 1))
      segmentPlaybackOffset = 0
      accumulatedTimeMs = segmentAbsoluteStartMs[currentSegmentIndex] ?? 0

      if (wasPlaying) {
        playing = true
        playSegment(currentSegmentIndex)
      }
    },

    seekToMs: (targetMs: number) => {
      const clamped = Math.max(0, Math.min(targetMs, totalDurationMs))
      const wasPlaying = playing

      playing = false
      playbackGeneration++
      stopSource()

      // Binary search for the segment containing targetMs
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

      // Calculate offset within the segment
      const entry = manifest.segments[segments[segIdx].id]
      let offsetWithinSegment = clamped - segmentAbsoluteStartMs[segIdx]
      if (entry) {
        offsetWithinSegment = Math.min(offsetWithinSegment, entry.duration_ms)
      }

      currentSegmentIndex = segIdx
      segmentPlaybackOffset = offsetWithinSegment
      accumulatedTimeMs = segmentAbsoluteStartMs[segIdx]

      if (wasPlaying) {
        playing = true
        playSegment(segIdx, offsetWithinSegment)
      }
    },

    seekToMsPreview: (targetMs: number) => {
      const clamped = Math.max(0, Math.min(targetMs, totalDurationMs))

      // Invalidate any pending async playback
      playbackGeneration++
      stopSource()

      // Binary search for the segment containing targetMs
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
      let offsetWithinSegment = clamped - segmentAbsoluteStartMs[segIdx]
      if (entry) {
        offsetWithinSegment = Math.min(offsetWithinSegment, entry.duration_ms)
      }

      currentSegmentIndex = segIdx
      segmentPlaybackOffset = offsetWithinSegment
      accumulatedTimeMs = segmentAbsoluteStartMs[segIdx]

      // Don't touch `playing` — don't start audio.
      // getCurrentTimeMs() will return the previewed position
      // because playing is false (caller paused before scrub).
    },

    getCurrentTimeMs: (): number => {
      if (!ctx || !playing) {
        return accumulatedTimeMs + segmentPlaybackOffset
      }
      const elapsed = (ctx.currentTime - segmentStartedAtCtxTime) * 1000
      return accumulatedTimeMs + segmentPlaybackOffset + elapsed
    },

    getCurrentSegmentIndex: () => currentSegmentIndex,

    getTotalDurationMs: () => totalDurationMs,

    getSegmentAbsoluteStartMs: () => segmentAbsoluteStartMs,

    isPlaying: () => playing,

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

    dispose: () => {
      disposed = true
      playing = false
      playbackGeneration++
      stopSource()
      if (ctx) {
        void ctx.close().catch(() => {})
      }
      ctx = null
      analyser = null
      gainNode = null
      contextUnlocked = false
      bufferCache.clear()
      loadingPromises.clear()
      // Clean up hidden audio element
      const silentAudio = document.getElementById("sr-silent-audio")
      if (silentAudio) silentAudio.remove()
    },
  }
}
