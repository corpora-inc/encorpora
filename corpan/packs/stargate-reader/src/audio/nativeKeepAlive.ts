/**
 * Thin wrapper around the tauri-plugin-audio-keepalive Tauri commands.
 * Graceful no-op when not running inside Tauri (dev mode / browser).
 */

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

function getTauriInvoke(): TauriInvoke | undefined {
  return (
    window as unknown as {
      __TAURI_INTERNALS__?: { invoke: TauriInvoke }
    }
  ).__TAURI_INTERNALS__?.invoke
}

export async function startNativeKeepAlive(
  title: string,
  artist: string,
  bookTitle: string
): Promise<void> {
  const invoke = getTauriInvoke()
  if (!invoke) return
  try {
    await invoke("plugin:audio-keepalive|start_audio_keepalive", {
      args: { title, artist, bookTitle },
    })
  } catch {
    // Plugin not available or call failed — non-fatal
  }
}

export async function stopNativeKeepAlive(): Promise<void> {
  const invoke = getTauriInvoke()
  if (!invoke) return
  try {
    await invoke("plugin:audio-keepalive|stop_audio_keepalive")
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
  const invoke = getTauriInvoke()
  if (!invoke) return
  try {
    await invoke("plugin:audio-keepalive|update_now_playing", {
      args: { title, artist, positionMs, durationMs },
    })
  } catch {
    // Non-fatal
  }
}
