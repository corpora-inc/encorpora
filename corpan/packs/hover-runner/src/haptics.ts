/**
 * Haptics — fires native iOS/Android haptics via the `tauri-plugin-haptics`
 * plugin that shipped in Corpán 0.19.0 (native `plugin:haptics|impact`, granted
 * to the webview by the `haptics:default` capability).
 *
 * Adapted from `juice-squeeze/src/hooks/useHaptics.ts`. Hover Runner is NOT a
 * React app and its `HostApi` exposes no `haptic` seam, so this is a plain
 * singleton — `triggerHaptic(style)` — rather than a hook. It reaches the host's
 * Tauri IPC directly (no host rebuild needed on 0.19.0+, because the pack runs
 * inside the host's webview) and falls back to `navigator.vibrate`.
 *
 * Everything here is best-effort and SILENT on failure:
 *   - Off-device / desktop / mock (no Tauri IPC, no Vibration API) → no-op.
 *   - `hapticsEnabled` setting OFF → no-op.
 *
 * The plugin's native `style` is one of light/medium/heavy/success/warning, so we
 * map our richer HapticStyle onto those.
 */
import { tuningStore } from "./tuningStore"

export type HapticStyle =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"

// HapticStyle → the plugin's accepted native style.
const NATIVE_STYLE: Record<HapticStyle, string> = {
  selection: "light",
  light: "light",
  medium: "medium",
  heavy: "heavy",
  success: "success",
  warning: "warning",
}

// HapticStyle → `navigator.vibrate` pattern (ms), used only when the native
// plugin IPC is unavailable but the Vibration API is (e.g. Android Chrome).
const VIBRATE_MS: Record<HapticStyle, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 20,
  heavy: 32,
  success: [12, 40, 18],
  warning: [22, 50, 22],
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

/**
 * Fire a haptic of the given style. Respects the `hapticsEnabled` setting and is
 * a silent no-op everywhere it can't run. Never throws.
 */
export function triggerHaptic(style: HapticStyle): void {
  try {
    if (!tuningStore.getState().settings.hapticsEnabled) return

    // Preferred: native plugin (no host rebuild needed on 0.19.0+).
    const invoke = getInvoke()
    if (invoke) {
      void Promise.resolve(
        invoke("plugin:haptics|impact", {
          args: { style: NATIVE_STYLE[style] ?? "medium" },
        })
      ).catch(() => undefined)
      return
    }

    // Fallback: Web Vibration API (Android browsers / some WebViews).
    const nav =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean })
        : undefined
    if (nav && typeof nav.vibrate === "function") {
      nav.vibrate(VIBRATE_MS[style])
    }
  } catch {
    // swallow — haptics are best-effort
  }
}
