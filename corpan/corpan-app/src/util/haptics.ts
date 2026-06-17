// src/util/haptics.ts
//
// Thin cross-platform haptics wrapper. Prefers the native bridge
// (`tauri-plugin-haptics` → iOS UIImpactFeedbackGenerator / Android Vibrator);
// on web/dev or any failure it falls back to `navigator.vibrate` (works in
// Android WebView, silently no-ops on iOS WKWebView). Fire-and-forget — never
// throws, never blocks the caller.

import { invoke } from "@tauri-apps/api/core"

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning"

/** navigator.vibrate fallback patterns (ms) — roughly matched to each style. */
const VIBRATE_FALLBACK: Record<HapticStyle, number | number[]> = {
  light: 12,
  medium: 22,
  heavy: 40,
  success: [0, 18, 50, 18],
  warning: [0, 28, 70, 28],
}

function webVibrate(style: HapticStyle): void {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    nav?.vibrate?.(VIBRATE_FALLBACK[style])
  } catch {
    /* unsupported — silent */
  }
}

/**
 * Trigger a haptic. Safe to call anywhere (no-op when no haptic surface is
 * available). Defaults to "medium".
 */
export function triggerHaptic(style: HapticStyle = "medium"): void {
  try {
    // The native command takes a single `args` struct ({ style }); Tauri maps the
    // JS payload keys to the Rust fn params, so it must be wrapped as `{ args }`.
    // Resolves immediately on a supported device; on web/dev `invoke` rejects →
    // fall back to navigator.vibrate.
    void invoke("plugin:haptics|impact", { args: { style } }).catch(() => webVibrate(style))
  } catch {
    webVibrate(style)
  }
}
