/**
 * Haptics — fires native iOS/Android haptics via the `tauri-plugin-haptics`
 * plugin that shipped in Corpán 0.19.0 (native `plugin:haptics|impact`, granted
 * to the webview by the `haptics:default` capability).
 *
 * Two paths, tried in order, both best-effort no-ops on failure:
 *   1) `hostApi.haptic?.({ type })` — the clean seam, if a host wires it.
 *   2) DIRECT invoke of `plugin:haptics|impact` — works on 0.19.0 TODAY with no
 *      host rebuild, because the pack runs in the host's Tauri webview, so the
 *      IPC (`__TAURI_INTERNALS__.invoke`) is reachable.
 *
 * The plugin's native `style` is one of light/medium/heavy/success/warning, so we
 * map our richer HapticType onto those.
 */
import { useCallback } from "react"
import type { HostApi, HapticType } from "../sdk/types"

// HapticType → the plugin's accepted native style.
const STYLE: Record<HapticType, string> = {
  selection: "light",
  light: "light",
  medium: "medium",
  heavy: "heavy",
  success: "success",
  warning: "warning",
  error: "warning", // plugin has no "error"; the warning notification is closest
}

type TauriInvoke = (cmd: string, payload?: unknown) => Promise<unknown>

/** Reach the Tauri IPC from inside the host webview, without bundling the SDK. */
function getInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: TauriInvoke }
    __TAURI__?: { core?: { invoke?: TauriInvoke }; invoke?: TauriInvoke }
  }
  return (
    w.__TAURI_INTERNALS__?.invoke ??
    w.__TAURI__?.core?.invoke ??
    w.__TAURI__?.invoke ??
    null
  )
}

export function useHaptics(hostApi: HostApi) {
  const fire = useCallback(
    (type: HapticType) => {
      try {
        // Preferred seam, if the host exposes it.
        if (typeof hostApi.haptic === "function") {
          hostApi.haptic({ type })
          return
        }
        // Direct to the plugin (no host rebuild needed on 0.19.0+).
        const invoke = getInvoke()
        if (!invoke) return
        void Promise.resolve(
          invoke("plugin:haptics|impact", { args: { style: STYLE[type] ?? "medium" } })
        ).catch(() => undefined)
      } catch {
        // swallow — haptics are best-effort
      }
    },
    [hostApi]
  )
  return { fire }
}
