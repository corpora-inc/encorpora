/**
 * Silent audio anchor for WebKit MediaSession.
 *
 * WebKit requires an actively-playing HTMLMediaElement for the MediaSession API
 * to accept setPositionState() values and fire seek action handlers. Without one,
 * only play/pause work and the elapsed time extrapolates from the first call.
 *
 * This module creates a hidden <audio loop> element playing a 2-second silent WAV.
 * The WAV PCM data is all zeros — no audible output.
 */

export type MediaSessionAnchor = {
  play(): void
  pause(): void
  dispose(): void
}

/** Build a 2-second silent WAV: 8000 Hz, mono, 16-bit PCM (all zeros). */
function generateSilentWav(): Blob {
  const sampleRate = 8000
  const numChannels = 1
  const bitsPerSample = 16
  const durationSec = 2
  const numSamples = sampleRate * durationSec
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = numSamples * numChannels * (bitsPerSample / 8)
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, "WAVE")

  // fmt chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true)           // chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk — PCM samples are already zero (ArrayBuffer is zero-initialized)
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  return new Blob([buffer], { type: "audio/wav" })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

export function createMediaSessionAnchor(): MediaSessionAnchor {
  let el: HTMLAudioElement | null = null
  let blobUrl: string | null = null

  function ensureElement(): HTMLAudioElement {
    if (el) return el
    const blob = generateSilentWav()
    blobUrl = URL.createObjectURL(blob)
    el = new Audio(blobUrl)
    el.loop = true
    console.log("[MS:anchor] created silent audio element")
    return el
  }

  return {
    play() {
      const audio = ensureElement()
      audio.play().then(() => {
        // Crawl: takes 2000s to finish the 2s clip.
        // Prevents timeupdate / loop events from feeding WebKit
        // a conflicting currentTime that overrides setPositionState().
        audio.playbackRate = 0.001
      }).catch((err) => {
        console.warn("[MS:anchor] play failed:", err)
      })
    },

    pause() {
      el?.pause()
    },

    dispose() {
      if (el) {
        el.pause()
        el.src = ""
        el.load() // release resources
        el = null
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        blobUrl = null
      }
      console.log("[MS:anchor] disposed")
    },
  }
}
