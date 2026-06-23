/**
 * Voice preview clip player.
 *
 * One global HTMLAudioElement plays at a time. Calling play() on a different
 * url stops any in-flight preview. Hosts (the reader) can subscribe to lifecycle
 * events so they can pause their own audio engine while a preview is active.
 */

export type VoicePreviewState =
  | { status: "idle" }
  | { status: "loading"; voiceProfileId: string; url: string }
  | { status: "playing"; voiceProfileId: string; url: string }
  | { status: "error"; voiceProfileId: string; url: string; error: string }

export type VoicePreviewListener = (state: VoicePreviewState) => void

const audio = typeof Audio !== "undefined" ? new Audio() : (null as HTMLAudioElement | null)
let state: VoicePreviewState = { status: "idle" }
let currentVoiceId: string | null = null
const listeners = new Set<VoicePreviewListener>()

function setState(next: VoicePreviewState): void {
  state = next
  for (const fn of listeners) {
    try {
      fn(state)
    } catch (err) {
      console.warn("[voicePreview] listener threw:", err)
    }
  }
}

if (audio) {
  audio.addEventListener("playing", () => {
    if (currentVoiceId && state.status !== "idle") {
      setState({ status: "playing", voiceProfileId: currentVoiceId, url: audio.src })
    }
  })
  audio.addEventListener("ended", () => {
    currentVoiceId = null
    setState({ status: "idle" })
  })
  audio.addEventListener("pause", () => {
    // Manual pause / external interrupt — treat as stop.
    if (audio.ended) return
    if (state.status === "idle") return
    currentVoiceId = null
    setState({ status: "idle" })
  })
  audio.addEventListener("error", () => {
    const url = audio.src
    const voiceProfileId = currentVoiceId ?? ""
    currentVoiceId = null
    const msg = audio.error
      ? `media error code ${audio.error.code}`
      : "unknown audio error"
    console.warn(`[voicePreview] error playing ${url}: ${msg}`)
    setState({ status: "error", voiceProfileId, url, error: msg })
  })
}

/** Subscribe to preview state changes. Returns an unsubscribe function. */
export function subscribePreview(fn: VoicePreviewListener): () => void {
  listeners.add(fn)
  fn(state)
  return () => {
    listeners.delete(fn)
  }
}

/** Get current preview state synchronously. */
export function getPreviewState(): VoicePreviewState {
  return state
}

/**
 * Play a preview clip for a voice profile. If a different clip is already
 * playing it will be stopped first. Calling play() on the currently-playing
 * voice toggles it off.
 */
export function playPreview(voiceProfileId: string, url: string): void {
  if (!audio) {
    console.warn("[voicePreview] Audio API unavailable in this environment")
    return
  }
  if (!url) {
    console.warn(`[voicePreview] No previewClipUrl for voice ${voiceProfileId}`)
    return
  }
  // Toggle off if already playing this voice
  if (
    currentVoiceId === voiceProfileId &&
    (state.status === "playing" || state.status === "loading")
  ) {
    stopPreview()
    return
  }
  currentVoiceId = voiceProfileId
  setState({ status: "loading", voiceProfileId, url })
  try {
    audio.src = url
    const promise = audio.play()
    if (promise && typeof promise.then === "function") {
      promise.catch((err: unknown) => {
        console.warn(`[voicePreview] play() rejected for ${url}:`, err)
        const msg = err instanceof Error ? err.message : String(err)
        currentVoiceId = null
        setState({ status: "error", voiceProfileId, url, error: msg })
      })
    }
  } catch (err) {
    console.warn(`[voicePreview] play() threw for ${url}:`, err)
    const msg = err instanceof Error ? err.message : String(err)
    currentVoiceId = null
    setState({ status: "error", voiceProfileId, url, error: msg })
  }
}

/** Stop any active preview. No-op if nothing is playing. */
export function stopPreview(): void {
  if (!audio) return
  currentVoiceId = null
  try {
    audio.pause()
    audio.currentTime = 0
  } catch {
    /* ignore */
  }
  setState({ status: "idle" })
}

/** True when a preview is loading or playing for the given voice profile id. */
export function isPreviewing(voiceProfileId: string): boolean {
  return (
    (state.status === "playing" || state.status === "loading") &&
    state.voiceProfileId === voiceProfileId
  )
}
