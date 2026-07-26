// The one place the shell crosses into native.
//
// It exists to prove the boundary is wired: if the capability grant, the CSP
// or the IPC bridge were wrong, this call is what fails, and it fails on the
// first screen instead of at M3 when a plugin lands on top of it.
//
// Every call made from here must be declared in `permissions.ts` and granted
// in `src-tauri/capabilities/default.json`; `capabilities.test.ts` fails the
// build if the three ever disagree.

import { getVersion } from "@tauri-apps/api/app"

declare const __APP_VERSION__: string

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
  if (!isNative) return __APP_VERSION__
  return await getVersion()
}
