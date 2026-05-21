import * as Tone from "tone"

export type SampleLoadResult = { ok: boolean; error?: string }

export type VoicePad = {
  /** Trigger the voice with current pitch + velocity, at a given audio time. */
  trigger: (time: number, velocity: number) => void
  /** Load a sample WAV/OGG; falls back to synth-vox if loading fails or url is null. */
  loadSample: (url: string | null) => Promise<SampleLoadResult>
  /** Set pitch shift in semitones. */
  setPitch: (semis: number) => void
  /** Whether a real sample is loaded (vs the synth fallback). */
  isSampleLoaded: () => boolean
  volume: Tone.Volume
  dispose: () => void
}

/**
 * Voice pad: loads a sample into a GrainPlayer, or falls back to an AMSynth
 * with vibrato (which has a vocal-ish character) when no sample is available.
 * The synth fallback lets the pack ship before the Chatterbox voice kit is rendered.
 */
export const createVoicePad = (destination: Tone.InputNode): VoicePad => {
  const volume = new Tone.Volume(0).connect(destination)

  // ---- Synth fallback ----
  // AMSynth with a slow vibrato — sounds like a hum. Pitched down from the
  // GrainPlayer's note so it carries low-frequency energy on beat 1.
  const synthVox = new Tone.AMSynth({
    oscillator: { type: "sine" },
    modulation: { type: "triangle" },
    harmonicity: 1.5,
    envelope: { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.4 },
    modulationEnvelope: { attack: 0.04, decay: 0.1, sustain: 0.8, release: 0.4 },
    volume: -4,
  })
  const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.06 })
  synthVox.chain(vibrato, volume)

  // ---- Grain player (loaded on demand) ----
  let player: Tone.GrainPlayer | null = null
  let sampleLoaded = false
  let pitchSemis = -7

  const ensurePlayer = () => {
    if (!player) {
      player = new Tone.GrainPlayer({
        grainSize: 0.12,
        overlap: 0.05,
        loop: false,
        playbackRate: 1,
        detune: pitchSemis * 100,
      }).connect(volume)
    }
    return player
  }

  const loadSample = async (url: string | null): Promise<SampleLoadResult> => {
    if (!url) {
      sampleLoaded = false
      return { ok: true }
    }
    try {
      const p = ensurePlayer()
      p.detune = pitchSemis * 100
      await new Promise<void>((resolve, reject) => {
        p.buffer = new Tone.ToneAudioBuffer(url, () => resolve(), reject)
      })
      sampleLoaded = true
      return { ok: true }
    } catch (err) {
      console.warn("[melopan voicePad] Failed to load sample:", url, err)
      sampleLoaded = false
      const message =
        err instanceof Error ? err.message :
        typeof err === "string" ? err :
        err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) :
        "unknown error"
      return { ok: false, error: message }
    }
  }

  const setPitch = (semis: number) => {
    pitchSemis = Math.max(-24, Math.min(24, semis))
    if (player) player.detune = pitchSemis * 100
  }

  const trigger = (time: number, velocity: number) => {
    if (sampleLoaded && player && player.buffer && player.buffer.loaded) {
      try {
        player.start(time)
      } catch {
        // GrainPlayer can throw if re-triggered too fast; ignore
      }
    } else {
      // Synth fallback. Use a low note so it sits under the kick.
      // Pitch knob shifts an A2 reference up or down.
      const baseMidi = 45 + pitchSemis // A2 = 45
      const note = Tone.Frequency(baseMidi, "midi").toNote()
      synthVox.triggerAttackRelease(note, "8n", time, velocity)
    }
  }

  return {
    trigger,
    loadSample,
    setPitch,
    isSampleLoaded: () => sampleLoaded,
    volume,
    dispose: () => {
      synthVox.dispose()
      vibrato.dispose()
      if (player) player.dispose()
      volume.dispose()
    },
  }
}
