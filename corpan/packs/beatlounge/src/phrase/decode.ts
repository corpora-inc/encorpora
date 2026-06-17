/**
 * beatlounge — decode rendered fragment bytes into an AudioBuffer. Shared by the
 * ttsFragment instrument (grid playback) and the audition path (preview), so the
 * decode logic can't drift. WAV containers go through decodeAudioData; raw PCM is
 * wrapped directly.
 */

import type { FragmentAudioBytes } from "./audioSource"

export const decodeFragmentBytes = async (
  ctx: BaseAudioContext,
  audio: FragmentAudioBytes
): Promise<AudioBuffer | null> => {
  if (!audio.bytes || audio.bytes.byteLength === 0) return null
  try {
    if (audio.codec === "wav") {
      return await ctx.decodeAudioData(audio.bytes.slice(0))
    }
    const sr = audio.sampleRate || ctx.sampleRate
    const sampleCount =
      audio.codec === "pcm-f32" ? audio.bytes.byteLength / 4 : audio.bytes.byteLength / 2
    const buf = ctx.createBuffer(1, Math.max(1, sampleCount), sr)
    const channel = buf.getChannelData(0)
    if (audio.codec === "pcm-f32") {
      channel.set(new Float32Array(audio.bytes).subarray(0, channel.length))
    } else {
      const i16 = new Int16Array(audio.bytes)
      const n = Math.min(i16.length, channel.length)
      for (let i = 0; i < n; i++) channel[i] = i16[i] / 0x8000
    }
    return buf
  } catch (err) {
    console.warn("[beatlounge/decode] failed:", err)
    return null
  }
}
