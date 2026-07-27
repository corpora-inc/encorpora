import { settingsStore } from "../core/settingsStore"

export type AudioManager = {
  playShoot: () => void
  playHit: () => void
  playExplosion: () => void
  playDeath: () => void
  playLevelUp: () => void
  playCombo: () => void
}

export const createAudioManager = (): AudioManager => {
  let ctx: AudioContext | null = null

  const getCtx = (): AudioContext | null => {
    if (!settingsStore.getState().sfxEnabled) return null
    if (!ctx) {
      try {
        ctx = new AudioContext()
      } catch {
        return null
      }
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    return ctx
  }

  const playTone = (freq: number, duration: number, type: OscillatorType = "sine", volume = 0.15) => {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime)
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration)
  }

  const playNoise = (duration: number, volume = 0.1) => {
    const c = getCtx()
    if (!c) return
    const bufferSize = Math.floor(c.sampleRate * duration)
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume
    }
    const source = c.createBufferSource()
    source.buffer = buffer

    const gain = c.createGain()
    gain.gain.setValueAtTime(volume, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)

    const filter = c.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.setValueAtTime(4000, c.currentTime)
    filter.frequency.exponentialRampToValueAtTime(200, c.currentTime + duration)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(c.destination)
    source.start(c.currentTime)
    source.stop(c.currentTime + duration)
  }

  const playShoot = () => {
    playTone(800, 0.05, "sine", 0.08)
  }

  const playHit = () => {
    playNoise(0.03, 0.12)
    playTone(200, 0.04, "square", 0.06)
  }

  const playExplosion = () => {
    playNoise(0.2, 0.15)
    playTone(80, 0.15, "sawtooth", 0.08)
  }

  const playDeath = () => {
    const c = getCtx()
    if (!c) return
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = "sawtooth"
    osc.frequency.setValueAtTime(500, c.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.4)
    gain.gain.setValueAtTime(0.15, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + 0.4)
  }

  const playLevelUp = () => {
    const c = getCtx()
    if (!c) return
    // Major chord swell
    const freqs = [523, 659, 784] // C5, E5, G5
    for (let i = 0; i < freqs.length; i++) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(freqs[i], c.currentTime + i * 0.08)
      gain.gain.setValueAtTime(0, c.currentTime)
      gain.gain.linearRampToValueAtTime(0.1, c.currentTime + i * 0.08 + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(c.currentTime + i * 0.08)
      osc.stop(c.currentTime + 0.5)
    }
  }

  const playCombo = () => {
    // Ascending arpeggio
    const c = getCtx()
    if (!c) return
    const freqs = [440, 554, 659] // A4, C#5, E5
    for (let i = 0; i < freqs.length; i++) {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = "triangle"
      osc.frequency.setValueAtTime(freqs[i], c.currentTime + i * 0.06)
      gain.gain.setValueAtTime(0.08, c.currentTime + i * 0.06)
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.06 + 0.12)
      osc.connect(gain)
      gain.connect(c.destination)
      osc.start(c.currentTime + i * 0.06)
      osc.stop(c.currentTime + i * 0.06 + 0.12)
    }
  }

  return { playShoot, playHit, playExplosion, playDeath, playLevelUp, playCombo }
}
