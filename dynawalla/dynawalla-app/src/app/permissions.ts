// The native boundary, declared.
//
// Every Tauri command this app may invoke is listed here with the permission
// that authorises it, and `capabilities.test.ts` asserts the list and
// `src-tauri/capabilities/default.json` are the same set — in both directions.
// A new native call with no grant fails the build; a grant nothing uses fails
// it too, because a live app cannot narrow its permissions afterwards without
// breaking installed clients (ADR-0005).
//
// No imports: this module is read by a Node test with no DOM and no Tauri.

export interface NativeCall {
  /** The `@tauri-apps/api` entry point the call comes from. */
  module: string
  /** The exported function. */
  fn: string
  /** The single command permission it requires. */
  permission: string
  /** Why the app needs it. */
  why: string
}

export const NATIVE_CALLS: readonly NativeCall[] = [
  {
    module: "@tauri-apps/api/app",
    fn: "getVersion",
    permission: "core:app:allow-version",
    why: "The settings screen shows the installed build, which is the first thing a parent reporting a problem is asked for.",
  },
]
