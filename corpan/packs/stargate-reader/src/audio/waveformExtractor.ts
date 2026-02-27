import type { WordTimestamp } from "../core/types"
import { ENVELOPE_BINS } from "../core/constants"

export type WaveformCache = {
  extractFromBuffer: (
    segmentId: string,
    buffer: AudioBuffer,
    words: WordTimestamp[]
  ) => void
  getEnvelope: (segmentId: string, wordIndex: number) => Float32Array | null
  dispose: () => void
}

/**
 * Create a cache of per-word amplitude envelopes extracted from decoded AudioBuffers.
 *
 * Each word gets ENVELOPE_BINS amplitude values (RMS per bin, peak-normalized to 1.0).
 * ~1MB total for 16k words at 16 bins * 4 bytes each.
 */
export function createWaveformCache(): WaveformCache {
  const cache = new Map<string, Float32Array>()

  function cacheKey(segmentId: string, wordIndex: number): string {
    return `${segmentId}:${wordIndex}`
  }

  return {
    extractFromBuffer(
      segmentId: string,
      buffer: AudioBuffer,
      words: WordTimestamp[]
    ) {
      const pcm = buffer.getChannelData(0)
      const sampleRate = buffer.sampleRate

      for (let wi = 0; wi < words.length; wi++) {
        const key = cacheKey(segmentId, wi)
        if (cache.has(key)) continue

        const w = words[wi]
        const startSample = Math.floor((sampleRate * w.start_ms) / 1000)
        const endSample = Math.min(
          Math.ceil((sampleRate * w.end_ms) / 1000),
          pcm.length
        )
        const totalSamples = endSample - startSample

        if (totalSamples <= 0) {
          // Zero-length word: uniform envelope
          const envelope = new Float32Array(ENVELOPE_BINS)
          envelope.fill(0.5)
          cache.set(key, envelope)
          continue
        }

        const envelope = new Float32Array(ENVELOPE_BINS)
        const samplesPerBin = totalSamples / ENVELOPE_BINS

        let peak = 0
        for (let bin = 0; bin < ENVELOPE_BINS; bin++) {
          const binStart = startSample + Math.floor(bin * samplesPerBin)
          const binEnd = startSample + Math.floor((bin + 1) * samplesPerBin)
          let sumSq = 0
          const count = binEnd - binStart
          for (let s = binStart; s < binEnd; s++) {
            const v = pcm[s]
            sumSq += v * v
          }
          const rms = count > 0 ? Math.sqrt(sumSq / count) : 0
          envelope[bin] = rms
          if (rms > peak) peak = rms
        }

        // Normalize so peak = 1.0
        if (peak > 0) {
          for (let bin = 0; bin < ENVELOPE_BINS; bin++) {
            envelope[bin] /= peak
          }
        } else {
          envelope.fill(0.5)
        }

        cache.set(key, envelope)
      }
    },

    getEnvelope(segmentId: string, wordIndex: number): Float32Array | null {
      return cache.get(cacheKey(segmentId, wordIndex)) ?? null
    },

    dispose() {
      cache.clear()
    },
  }
}
