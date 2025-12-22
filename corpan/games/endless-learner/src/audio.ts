import affirmativeUrl from "./assets/sfx/affirmative.wav"
import nopeUrl from "./assets/sfx/nope.wav"

type SfxKey = "success" | "fail"

type SfxHandle = {
  unlock: () => void
  playSuccess: () => void
  playFail: () => void
}

type AudioPoolEntry = {
  url: string
  pool: HTMLAudioElement[]
}

const MAX_POOL = 4
const SFX_VOLUME = 0.07

const createHtmlAudio = (url: string) => {
  const audio = new Audio(url)
  audio.preload = "auto"
  audio.volume = SFX_VOLUME
  return audio
}

const createPool = (url: string): AudioPoolEntry => ({
  url,
  pool: [createHtmlAudio(url)],
})

const getPoolAudio = (entry: AudioPoolEntry) => {
  const existing = entry.pool.find((audio) => audio.paused || audio.ended)
  if (existing) {
    existing.currentTime = 0
    return existing
  }
  if (entry.pool.length < MAX_POOL) {
    const next = createHtmlAudio(entry.url)
    entry.pool.push(next)
    return next
  }
  const fallback = entry.pool[0]
  fallback.currentTime = 0
  return fallback
}

const createSfxHandle = (): SfxHandle => {
  const urls: Record<SfxKey, string> = {
    success: affirmativeUrl,
    fail: nopeUrl,
  }
  const htmlPools = new Map<SfxKey, AudioPoolEntry>([
    ["success", createPool(urls.success)],
    ["fail", createPool(urls.fail)],
  ])
  const AudioCtx =
    typeof window !== "undefined"
      ? (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  const buffers = new Map<SfxKey, AudioBuffer>()
  const bufferPromises = new Map<SfxKey, Promise<AudioBuffer>>()

  const ensureContext = () => {
    if (!AudioCtx) {
      return null
    }
    if (!ctx) {
      ctx = new AudioCtx()
      master = ctx.createGain()
      master.gain.value = SFX_VOLUME
      master.connect(ctx.destination)
    }
    return ctx
  }

  const ensureBuffer = (key: SfxKey) => {
    if (buffers.has(key) || bufferPromises.has(key)) {
      return
    }
    const context = ensureContext()
    if (!context) {
      return
    }
    const url = urls[key]
    const promise = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(key, buffer)
        bufferPromises.delete(key)
        return buffer
      })
      .catch(() => {
        bufferPromises.delete(key)
        throw new Error("Failed to decode audio")
      })
    bufferPromises.set(key, promise)
  }

  const playHtml = (key: SfxKey) => {
    const entry = htmlPools.get(key)
    if (!entry) {
      return
    }
    const audio = getPoolAudio(entry)
    void audio.play().catch(() => { })
  }

  const playWebAudio = (key: SfxKey) => {
    const context = ensureContext()
    if (!context || !master) {
      playHtml(key)
      return
    }
    const buffer = buffers.get(key)
    if (!buffer) {
      playHtml(key)
      return
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(master)
    source.start()
  }

  const unlock = () => {
    const context = ensureContext()
    if (!context) {
      return
    }
    if (context.state === "suspended") {
      void context.resume()
    }
    ensureBuffer("success")
    ensureBuffer("fail")
  }

  return {
    unlock,
    playSuccess: () => playWebAudio("success"),
    playFail: () => playWebAudio("fail"),
  }
}

let cached: SfxHandle | null = null

export const getSfx = () => {
  if (!cached) {
    cached = createSfxHandle()
  }
  return cached
}
