/**
 * Thin wrapper around the tauri-plugin-audio-keepalive Tauri commands.
 * Graceful no-op when not running inside Tauri (dev mode / browser).
 */

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
type TauriTransformCallback = (callback: (response: unknown) => void) => number

interface TauriInternals {
  invoke: TauriInvoke
  transformCallback?: TauriTransformCallback
}

function getTauriInternals(): TauriInternals | undefined {
  return (
    window as unknown as {
      __TAURI_INTERNALS__?: TauriInternals
    }
  ).__TAURI_INTERNALS__
}

export async function startNativeKeepAlive(
  title: string,
  artist: string,
  bookTitle: string
): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:audio-keepalive|start_audio_keepalive", {
      args: { title, artist, bookTitle },
    })
  } catch {
    // Plugin not available or call failed — non-fatal
  }
}

export async function stopNativeKeepAlive(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:audio-keepalive|stop_audio_keepalive")
  } catch {
    // Non-fatal
  }
}

export async function pauseNativeKeepAlive(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:audio-keepalive|pause_audio_keepalive")
  } catch {
    // Non-fatal
  }
}

export async function resumeNativeKeepAlive(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:audio-keepalive|resume_audio_keepalive")
  } catch {
    // Non-fatal
  }
}

export async function updateNativeNowPlaying(
  title: string,
  artist: string,
  positionMs: number,
  durationMs: number
): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:audio-keepalive|update_now_playing", {
      args: { title, artist, positionMs, durationMs },
    })
  } catch {
    // Non-fatal
  }
}

/**
 * Listen for remote media commands from native lock screen / notification controls.
 * Uses the Tauri Plugin registerListener mechanism (Channel protocol).
 *
 * Returns a cleanup function, or null if not running in Tauri.
 */
export function listenForRemoteCommands(handlers: {
  onPlay?: () => void
  onPause?: () => void
  onSkipForward?: () => void
  onSkipBack?: () => void
  onNextChapter?: () => void
  onPrevChapter?: () => void
}): (() => void) | null {
  const internals = getTauriInternals()
  if (!internals?.transformCallback) return null

  const eventMap: Record<string, (() => void) | undefined> = {
    "audio-keepalive:play": handlers.onPlay,
    "audio-keepalive:pause": handlers.onPause,
    "audio-keepalive:skipForward": handlers.onSkipForward,
    "audio-keepalive:skipBack": handlers.onSkipBack,
    "audio-keepalive:nextChapter": handlers.onNextChapter,
    "audio-keepalive:prevChapter": handlers.onPrevChapter,
  }

  const registeredChannels: { event: string; channelId: number }[] = []

  for (const [event, handler] of Object.entries(eventMap)) {
    if (!handler) continue

    const channelId = internals.transformCallback(() => {
      handler()
    })

    internals.invoke("plugin:audio-keepalive|registerListener", {
      event,
      handler: `__CHANNEL__:${channelId}`,
    }).catch(() => {
      // Non-fatal: plugin may not support registerListener
    })

    registeredChannels.push({ event, channelId })
  }

  // Return cleanup function
  return () => {
    for (const { event, channelId } of registeredChannels) {
      internals.invoke("plugin:audio-keepalive|removeListener", {
        event,
        channelId,
      }).catch(() => {})
    }
  }
}
