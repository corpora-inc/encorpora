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

interface Call {
  /** The `@tauri-apps/api` entry point the call comes from. */
  module: string
  /** The exported function. */
  fn: string
  /** Why the app needs it. */
  why: string
}

/** A plugin command. Tauri's ACL gates it, so a capability entry names it. */
export interface PluginCall extends Call {
  /** The single command permission it requires. */
  permission: string
  command?: undefined
}

/**
 * A command this application registers itself.
 *
 * Tauri's ACL gates plugin commands — `core:*` and every `tauri-plugin-*` — and
 * says nothing about commands registered by the app's own `generate_handler!`.
 * A capability entry for one is not merely unnecessary, it is unexpressible.
 * `null` records that fact rather than leaving the row out, because a row that
 * is not here is a native call nobody declared.
 */
export interface ApplicationCall extends Call {
  permission: null
  /**
   * The Rust command. `packs/native.test.ts` asserts every one of these is
   * registered in `src-tauri/src/lib.rs` — the check that stands in for the
   * grant the ACL cannot give.
   */
  command: string
}

/**
 * A declared native call: gated by a permission, or registered by this app.
 *
 * The two are a union rather than one shape with both fields optional, so that
 * "neither a permission nor a command" is a state nobody can write down. Every
 * call therefore has *something* that names it, which is what lets `grantOf`
 * below be total — a reader with no fallback and no `?.`.
 */
export type NativeCall = PluginCall | ApplicationCall

/**
 * What names a call: its ACL permission, or, when the ACL cannot express one,
 * the command it registers. Never empty, by construction.
 */
export function grantOf(call: NativeCall): string {
  return call.permission === null ? call.command : call.permission
}

/**
 * A call's identity, unique across the table.
 *
 * The grant is not enough on its own: `invoke` and `Channel` both reach
 * `packs_install`, so two rows would collide on it. Two rows sharing a key is a
 * row React is entitled to drop, which is the diagnostics screen quietly
 * missing a line about what the app may ask the operating system for.
 */
export function callId(call: NativeCall): string {
  return `${call.fn}:${grantOf(call)}`
}

export const NATIVE_CALLS: readonly NativeCall[] = [
  {
    module: "@tauri-apps/api/app",
    fn: "getVersion",
    permission: "core:app:allow-version",
    why: "The settings screen shows the installed build, which is the first thing a parent reporting a problem is asked for.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: "haptics:allow-impact",
    why: "Real haptics. `navigator.vibrate` does not exist in iOS WKWebView, so a WebView-only implementation is a silent no-op on every iPhone and iPad; the plugin reaches UIImpactFeedbackGenerator and friends. One command, never haptics:default.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: null,
    command: "packs_list",
    why: "The pack runtime reads what is installed. Packs are the product; the shell is what installs and serves them.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: null,
    command: "packs_catalog",
    why: "Fetching the catalogue natively is what lets the WebView's connect-src stay closed: the app's own document never talks to the network.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: null,
    command: "packs_install",
    why: "Download, verify against the manifest's sha256, and extract. All three are native so no pack archive is ever handled in the WebView.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: null,
    command: "packs_remove",
    why: "Uninstall. Registered, and asserted to be registered: Corpán's delete command is not, and its uninstalled packs stay on disk forever.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "invoke",
    permission: null,
    command: "packs_entry_url",
    why: "The pack-scheme URL the frame loads, built natively so the platform difference between the custom scheme and the localhost form is decided once.",
  },
  {
    module: "@tauri-apps/api/core",
    fn: "Channel",
    permission: null,
    command: "packs_install",
    why: "Install progress. A channel argument rather than a global event so no listen permission is needed and no other window can hear it.",
  },
]
