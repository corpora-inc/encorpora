// The one module in the app that speaks to the pack runtime in Rust.
//
// Every native command the pack system uses is named here exactly once, and
// `native.test.ts` reads `src-tauri/src/lib.rs` and asserts that this list and
// the registered handlers are the same set in both directions. That is not
// ceremony: Corpán's install manager invokes a `content_packs_delete` command
// its backend never registered, so every uninstalled pack's data stays on the
// device forever and nothing reports a problem. A command list that only exists
// in one of the two languages is the shape of that bug.
//
// These are application commands rather than plugin commands, so Tauri's ACL
// does not gate them and `capabilities/default.json` cannot express them. The
// declaration in `src/app/permissions.ts` and this test are what stands in for
// a grant.

import { Channel, invoke } from "@tauri-apps/api/core"

/** The commands `src-tauri/src/lib.rs` registers. Kept in one place. */
export const PACK_COMMANDS = [
  "packs_list",
  "packs_catalog",
  "packs_install",
  "packs_remove",
  "packs_entry_url",
] as const

export type PackCommand = (typeof PACK_COMMANDS)[number]

/** One installed pack, as Rust found it on disk. */
export type InstalledPackRow = {
  readonly id: string
  readonly version: string
  /** The manifest verbatim. Parsed by the SDK, never by Rust. */
  readonly manifest: string
  readonly bytes: number
}

export type InstallProgress =
  | { readonly phase: "downloading"; readonly received: number; readonly total: number }
  | { readonly phase: "verifying" }
  | { readonly phase: "extracting" }
  | { readonly phase: "installing" }

export type InstallArgs = {
  readonly packId: string
  readonly version: string
  readonly url: string
  readonly sha256: string
  readonly bytes: number
}

/**
 * The native surface, as an interface.
 *
 * Everything above this line is IO; everything below it in `install.ts` is a
 * decision. Splitting them at a port is what lets the install state machine —
 * the part with the version comparisons, the refusals and the failure paths —
 * be tested in Node without a WebView, a device or a network.
 */
export type PackNative = {
  list(): Promise<InstalledPackRow[]>
  catalog(): Promise<string>
  install(args: InstallArgs, onProgress: (progress: InstallProgress) => void): Promise<InstalledPackRow>
  remove(packId: string): Promise<void>
  entryUrl(packId: string, entry: string): Promise<string>
}

export const tauriNative: PackNative = {
  list: () => invoke<InstalledPackRow[]>("packs_list"),
  catalog: () => invoke<string>("packs_catalog"),
  install: (args, onProgress) => {
    const progress = new Channel<InstallProgress>()
    progress.onmessage = onProgress
    return invoke<InstalledPackRow>("packs_install", { request: args, progress })
  },
  remove: (packId) => invoke<void>("packs_remove", { packId }),
  entryUrl: (packId, entry) => invoke<string>("packs_entry_url", { packId, entry }),
}
