// The one place the shell crosses into native.
//
// It exists to prove the boundary is wired: if the capability grant, the CSP
// or the IPC bridge were wrong, this call is what fails, and it fails on the
// first screen instead of at M3 when a plugin lands on top of it. It rejects
// rather than swallowing the error — the caller decides what a child sees, and
// `Settings.tsx` logs the failure and falls back to the build-time constant so
// the line is never blank.
//
// Every call made from here must be declared in `permissions.ts` and granted
// in `src-tauri/capabilities/default.json`; `capabilities.test.ts` fails the
// build if the three ever disagree.

import { getVersion } from "@tauri-apps/api/app"
import { invoke } from "@tauri-apps/api/core"

import type { HapticPorts, HapticStyle } from "../packs/haptics.ts"

declare const __APP_VERSION__: string

/** The version compiled into this bundle, from `package.json` via Vite. */
export const BUILD_VERSION: string = __APP_VERSION__

/** Tauri injects its internals before any app script runs. */
export const isNative = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window

/**
 * The running build's version.
 *
 * Native: asked of the Rust side, so it reflects the binary a parent actually
 * installed rather than whatever the bundle was compiled against. In a plain
 * browser (`npm run dev` without Tauri) there is no IPC, so the build-time
 * constant answers instead.
 */
export async function appVersion(): Promise<string> {
  if (!isNative) return BUILD_VERSION
  return await getVersion()
}

/**
 * The two haptic back-ends this device actually has.
 *
 * Built once, at module load, because both answers are properties of the build
 * and the platform rather than of the moment: whether Tauri injected its IPC,
 * and whether this WebView implements `navigator.vibrate`. The second is the
 * one that matters — it is `undefined` in WKWebView, so on iOS the web port is
 * `null` and the native one is the only thing that will ever fire.
 *
 * The invoke is written out here rather than in `packs/haptics.ts` for the
 * usual reason: that module decides *what* a cue should feel like, and this one
 * is the only file allowed to reach the bridge. The command name and payload
 * shape are the plugin's: a single `args` struct, because Tauri maps the JS
 * payload keys onto the Rust function's parameters and `impact` takes one
 * parameter called `args`.
 */
export const hapticPorts: HapticPorts = {
  native: isNative
    ? (style: HapticStyle) => invoke("plugin:haptics|impact", { args: { style } })
    : null,
  web:
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
      ? navigator.vibrate.bind(navigator)
      : null,
}
