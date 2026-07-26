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
  /**
   * The single command permission it requires, or `null` for a command this
   * application defines itself.
   *
   * Tauri's ACL gates plugin commands — `core:*` and every `tauri-plugin-*` —
   * and says nothing about commands registered by the app's own
   * `generate_handler!`. A capability entry for one is not merely unnecessary,
   * it is unexpressible. `null` records that fact rather than leaving the row
   * out, because a row that is not here is a native call nobody declared.
   */
  permission: string | null
  /**
   * The Rust command, for a `null` permission. `packs/native.test.ts` asserts
   * every one of these is registered in `src-tauri/src/lib.rs` — the check that
   * stands in for the grant the ACL cannot give.
   */
  command?: string
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
