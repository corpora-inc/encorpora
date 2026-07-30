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
import type { OrientationPorts, RawOrientation } from "../packs/orientation.ts"

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

/* ─── orientation ──────────────────────────────────────────────────────────── */
//
// The only source of a tilt reading this build has, and it is a WEB API rather
// than a plugin. That is a deliberate first step and not the finished shape:
// `OrientationPorts` is what a `tauri-plugin-orientation` reading CoreMotion and
// Android's `SensorManager` implements, and nothing above this file changes when
// it lands. See `docs/NATIVE_CAPABILITIES.md`.
//
// What it means today, stated plainly because nobody here can run a phone:
//
//   * **Desktop and Android WebView.** `deviceorientation` fires with numbers in
//     it where there is a sensor, and with `null`s where there is not. Neither
//     needs a permission. The `null` case is why `orientation.ts` has a warm-up
//     rather than trusting `typeof DeviceOrientationEvent`.
//   * **iOS WKWebView.** Unverified, and quite possibly `null` forever:
//     `DeviceOrientationEvent.requestPermission` may be absent, may resolve
//     `denied` regardless, and motion in a WKWebView has historically needed app
//     configuration Tauri does not expose. Every branch below therefore treats a
//     refusal, a throw and a silence as the same answer — this device cannot —
//     and the capability degrades to absent rather than to broken.

/** `DeviceOrientationEvent` with the iOS-only static that gates it. */
type PermissionGate = {
  requestPermission?: () => Promise<"granted" | "denied" | "prompt">
}

const orientationEvent: (typeof DeviceOrientationEvent & PermissionGate) | null =
  typeof window !== "undefined" && typeof DeviceOrientationEvent !== "undefined"
    ? (DeviceOrientationEvent as typeof DeviceOrientationEvent & PermissionGate)
    : null

const needsPermission = typeof orientationEvent?.requestPermission === "function"

/**
 * The permission decision for this app install, asked at most once.
 *
 * Memoised at module scope rather than per launch, because it is a fact about
 * the app and the person holding it and not about a game: prompting once per
 * game would be a prompt a child learns to dismiss.
 */
let orientationPermission: Promise<boolean> | null = null

function askOrientationPermission(): Promise<boolean> {
  orientationPermission ??= (async () => {
    const ask = orientationEvent?.requestPermission
    if (!ask) return true
    try {
      return (await ask.call(orientationEvent)) === "granted"
    } catch {
      // Thrown when there is no user activation, and on any platform where the
      // static exists but does not work. The answer is "no", and a game plays
      // without it.
      return false
    }
  })()
  return orientationPermission
}

/**
 * Ask for the motion permission now, from inside a real user gesture.
 *
 * **This is the whole answer to "some native features need a gesture and a
 * per-origin grant, which an opaque origin cannot hold."** iOS requires
 * transient user activation for `DeviceOrientationEvent.requestPermission()`,
 * and it remembers the grant per origin. A pack has neither: activation does not
 * cross a `postMessage`, and a pack's origin is opaque and therefore not
 * something a grant can be remembered against.
 *
 * So the host asks, in the host's own document, on the tap that launched the
 * game — the last real gesture before a pack exists. The grant is then the
 * app's, held against the app's origin, and the pack is only ever told the
 * outcome as `available`.
 *
 * Fire and forget: the answer is memoised, and whoever needs it awaits the same
 * promise later.
 */
export function primeOrientationPermission(): void {
  if (!needsPermission) return
  void askOrientationPermission()
}

export const orientationPorts: OrientationPorts = {
  present: orientationEvent !== null,
  requestPermission: needsPermission ? askOrientationPermission : null,
  subscribe: (onRaw) => {
    if (typeof window === "undefined") return () => {}
    const listener = (event: DeviceOrientationEvent) => {
      const raw: RawOrientation = { beta: event.beta, gamma: event.gamma }
      onRaw(raw)
    }
    window.addEventListener("deviceorientation", listener)
    return () => window.removeEventListener("deviceorientation", listener)
  },
  screenAngle: () => {
    // Guarded rather than optional-chained: `screen.orientation` is
    // non-optional in the DOM types and absent in older WebViews, and a throw
    // here would stop a sample instead of straightening one.
    if (typeof screen === "undefined") return 0
    const angle: unknown = (screen as { orientation?: { angle?: unknown } }).orientation?.angle
    return typeof angle === "number" && Number.isFinite(angle) ? angle : 0
  },
}
