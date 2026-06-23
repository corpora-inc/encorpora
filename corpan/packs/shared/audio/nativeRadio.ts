/**
 * JS bridge to `tauri-plugin-radio-stream`.
 *
 * Mirrors the shape of `nativeKeepAlive.ts` (Tauri 2 mobile plugin via
 * `__TAURI_INTERNALS__.invoke` + `transformCallback` channels). When
 * `hasNativeRadio()` returns true, the World Radio pack hands all playback
 * to ExoPlayer (Android) / AVPlayer (iOS) via this bridge instead of the
 * WebView's `<audio>` element.
 *
 * Plugin command/event surface (kept in sync with the Rust/Kotlin/Swift
 * sides):
 *   commands: play, pause, resume, stop, set_volume,
 *             register_listener, remove_listener
 *   events:   state-changed, icy-metadata, remote-command, interruption
 *
 * Graceful no-op when not running inside Tauri (browser dev): every command
 * resolves silently and the listener registration returns null. Callers
 * decide what to do (the pack falls back to its WebView `<audio>` path).
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

/** True iff the Tauri runtime is present. Says nothing about whether the
 *  `radio-stream` plugin itself is registered — older Corpan hosts (≤ 0.11.x)
 *  ship Tauri but no plugin. Use `probeNativeRadio()` for the real check. */
export function hasNativeRadio(): boolean {
  return getTauriInternals() !== undefined
}

// ────────────────────────────────────────────────────────────────────────────
// Plugin availability probe
//
// Older Corpan apps run a Tauri runtime but don't have `tauri-plugin-radio-
// stream` compiled in (it shipped in 0.12.0). On those hosts every command
// rejects with "Unknown command: plugin:radio-stream|*". Detect this once at
// startup so the pack can fall back to the WebView `<audio>` path cleanly
// instead of every play attempt erroring out.
//
// Probe shape: a single `stop` invoke. Stop is idempotent on the new host
// (no station playing → no-op) and rejects synchronously on the old host
// (command not found). One round-trip, cached forever after.

let probePromise: Promise<boolean> | null = null

/** Returns true iff the native `radio-stream` plugin is registered with the
 *  Tauri host. Cached after first call. Resolves to `false` outside Tauri. */
export function probeNativeRadio(): Promise<boolean> {
  if (probePromise) return probePromise
  const internals = getTauriInternals()
  if (!internals) {
    probePromise = Promise.resolve(false)
    return probePromise
  }
  probePromise = internals
    .invoke("plugin:radio-stream|stop")
    .then(() => {
      console.info("[native-radio] probe succeeded — using native player")
      return true
    })
    .catch((err) => {
      console.warn(
        "[native-radio] probe failed → falling back to WebView player",
        err,
      )
      return false
    })
  return probePromise
}

// ────────────────────────────────────────────────────────────────────────────
// Direct WebView-eval bridge.
//
// The Tauri Channel mechanism (transformCallback + register_listener +
// Plugin.trigger → channel.send → JNI sendChannelData → JS callback) silently
// no-ops on the Android 14 / Media3 1.4 build we use. We reproduce
// audio-keepalive's belt-and-braces pattern: the plugin also calls
// webView.evaluateJavascript("window.__radioStreamEvent(event, payload)")
// for every event. Whichever path wins, JS gets the data.
//
// This module installs the global handler and dispatches to a shared listener
// registry the same listenForRadioEvents() consumers subscribe to.

type DirectListener = (payload: unknown) => void
const directListeners: Map<string, Set<DirectListener>> = new Map()

declare global {
  interface Window {
    __radioStreamEvent?: (event: string, payload: unknown) => void
  }
}

if (typeof window !== "undefined") {
  window.__radioStreamEvent = (event: string, payload: unknown) => {
    const listeners = directListeners.get(event)
    if (!listeners || listeners.size === 0) return
    for (const listener of listeners) {
      try {
        listener(payload)
      } catch (err) {
        console.error(`[native-radio] direct listener for ${event} threw:`, err)
      }
    }
  }
}

function addDirectListener(event: string, listener: DirectListener): () => void {
  let set = directListeners.get(event)
  if (!set) {
    set = new Set()
    directListeners.set(event, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Commands

export type RadioPlayMeta = {
  url: string
  stationName?: string
  country?: string
  language?: string
  faviconUrl?: string
}

export async function radioPlay(args: RadioPlayMeta): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:radio-stream|play", { args })
  } catch (err) {
    // The native side rejects with a string message; surface it loudly so
    // device logs catch it.
    console.error("[native-radio] play failed:", err)
    throw err
  }
}

export async function radioPause(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:radio-stream|pause")
  } catch (err) {
    console.error("[native-radio] pause failed:", err)
  }
}

export async function radioResume(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:radio-stream|resume")
  } catch (err) {
    console.error("[native-radio] resume failed:", err)
  }
}

export async function radioStop(): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  try {
    await internals.invoke("plugin:radio-stream|stop")
  } catch (err) {
    console.error("[native-radio] stop failed:", err)
  }
}

export async function radioSetVolume(volume: number): Promise<void> {
  const internals = getTauriInternals()
  if (!internals) return
  const clamped = Math.max(0, Math.min(1, volume))
  try {
    await internals.invoke("plugin:radio-stream|set_volume", {
      args: { volume: clamped },
    })
  } catch (err) {
    console.error("[native-radio] set_volume failed:", err)
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Events

export type RadioStateKind =
  | "idle"
  | "loading"
  | "buffering"
  | "playing"
  | "paused"
  | "error"

export type RadioStateChange = {
  kind: RadioStateKind
  message?: string
}

export type RadioIcyMetadata = {
  streamTitle?: string
  streamUrl?: string
  name?: string
  genre?: string
  bitrate?: number
}

export type RadioRemoteCommand =
  | "play"
  | "pause"
  | "stop"
  | "headphones-noisy"

export type RadioInterruption = {
  began: boolean
  shouldResume?: boolean
}

export type RadioListeners = {
  onState?: (state: RadioStateChange) => void
  onIcyMetadata?: (meta: RadioIcyMetadata) => void
  onRemoteCommand?: (cmd: RadioRemoteCommand) => void
  onInterruption?: (info: RadioInterruption) => void
}

/**
 * Subscribe to native player events. Returns a cleanup function (or null when
 * not running inside Tauri). Uses two parallel paths so a flake on either one
 * doesn't lose us the event:
 *   - window.__radioStreamEvent → direct listeners (the path that actually
 *     delivers in production; see comment at top of this module)
 *   - register_listener / Channel → kept registered so the framework can
 *     also deliver if/when the binder bridge wakes up
 */
export function listenForRadioEvents(handlers: RadioListeners): (() => void) | null {
  const internals = getTauriInternals()
  if (!internals) {
    return null
  }

  const cleanups: Array<() => void> = []

  function subscribe(event: string, callback: (response: unknown) => void) {
    cleanups.push(addDirectListener(event, callback))

    if (internals!.transformCallback) {
      const channelId = internals!.transformCallback(callback)
      internals!
        .invoke("plugin:radio-stream|register_listener", {
          args: { event, handler: `__CHANNEL__:${channelId}` },
        })
        .catch((err) => {
          console.error(`[native-radio] FAILED to register ${event}:`, err)
        })
      cleanups.push(() => {
        internals!
          .invoke("plugin:radio-stream|remove_listener", {
            args: { event, channelId },
          })
          .catch(() => {})
      })
    }
  }

  if (handlers.onState) {
    const onState = handlers.onState
    subscribe("state-changed", (response) => {
      const data = response as { kind?: string; message?: string } | undefined
      if (!data?.kind) return
      onState({
        kind: (data.kind as RadioStateKind),
        message: data.message,
      })
    })
  }

  if (handlers.onIcyMetadata) {
    const onMeta = handlers.onIcyMetadata
    subscribe("icy-metadata", (response) => {
      const data = (response as RadioIcyMetadata) ?? {}
      onMeta(data)
    })
  }

  if (handlers.onRemoteCommand) {
    const onCmd = handlers.onRemoteCommand
    subscribe("remote-command", (response) => {
      const data = response as { command?: string } | undefined
      const cmd = data?.command
      if (cmd === "play" || cmd === "pause" || cmd === "stop" || cmd === "headphones-noisy") {
        onCmd(cmd)
      }
    })
  }

  if (handlers.onInterruption) {
    const onInt = handlers.onInterruption
    subscribe("interruption", (response) => {
      const data = response as { began?: boolean; shouldResume?: boolean } | undefined
      if (typeof data?.began !== "boolean") return
      onInt({ began: data.began, shouldResume: data.shouldResume })
    })
  }

  return () => {
    for (const fn of cleanups) {
      try {
        fn()
      } catch {
        // best-effort cleanup
      }
    }
  }
}
