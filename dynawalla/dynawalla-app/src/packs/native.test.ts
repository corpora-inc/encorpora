// The command list, checked against the backend that has to answer it.
//
// This is the test that exists because of a specific bug in the other app in
// this repository: `corpan-app`'s install manager invokes `content_packs_delete`,
// which is not among the commands `corpan_lib` registers. Uninstalling a pack
// therefore leaves its files on the device permanently, and nothing fails —
// not the build, not the types, not a review. The only thing that catches it is
// reading both lists and comparing them.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { PACK_COMMANDS } from "./native.ts"
import { NATIVE_CALLS } from "../app/permissions.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const packsDir = here
const libRs = fs.readFileSync(path.resolve(here, "../../src-tauri/src/lib.rs"), "utf8")

/** The names inside `tauri::generate_handler![ ... ]`, module path stripped. */
function registeredCommands(source: string): string[] {
  const block = /generate_handler!\s*\[([^\]]*)\]/.exec(source)
  assert.ok(block, "lib.rs has no generate_handler! block")
  return (block[1] ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith("//"))
    .map((entry) => entry.split("::").pop() ?? entry)
}

test("every command the frontend invokes is registered in Rust, and none is stranded", () => {
  const registered = [...registeredCommands(libRs)].sort()
  const invoked = [...PACK_COMMANDS].sort()
  assert.deepEqual(
    registered,
    invoked,
    "the command list in native.ts and the handlers in lib.rs have diverged",
  )
})

test("removal is one of them", () => {
  // Stated separately, because this is the one that was missing elsewhere and a
  // set comparison would go green the day someone deletes both sides of it.
  assert.ok(PACK_COMMANDS.includes("packs_remove"))
  assert.ok(registeredCommands(libRs).includes("packs_remove"))
})

test("every pack command is declared in the native-call table", () => {
  const declared = NATIVE_CALLS.filter((call) => call.command !== undefined).map(
    (call) => call.command,
  )
  for (const command of PACK_COMMANDS) {
    assert.ok(declared.includes(command), `${command} is invoked but not declared`)
  }
  for (const command of declared) {
    assert.ok(
      (PACK_COMMANDS as readonly string[]).includes(command as string),
      `${command} is declared but no longer invoked`,
    )
  }
})

test("an application command declares no permission, because none can exist", () => {
  for (const call of NATIVE_CALLS) {
    if (call.command === undefined) continue
    assert.equal(call.permission, null, `${call.command} claims an ACL permission`)
    assert.ok(call.why.length > 40, `${call.command} has no real justification`)
  }
})

test("native.ts is the only module in src/packs that reaches the bridge", () => {
  // The port in `native.ts` is what makes the install state machine testable in
  // Node. A second module importing `@tauri-apps/*` would quietly reintroduce
  // the coupling — and would be authorised by the declaration above, which is
  // written as though there is exactly one such file.
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (entry.name === "native.ts") continue
      // Tests name the module scope in prose, and this one has to.
      if (entry.name.endsWith(".test.ts")) continue
      if (/@tauri-apps\//.test(fs.readFileSync(full, "utf8"))) {
        offenders.push(path.relative(packsDir, full))
      }
    }
  }
  walk(packsDir)
  assert.deepEqual(offenders, [])
})

test("the pack scheme name is the same string on both sides of the boundary", () => {
  // It is baked into every published pack's built JavaScript on every device.
  // Renaming it compiles cleanly and breaks every installed pack at runtime.
  const packsRs = fs.readFileSync(path.resolve(here, "../../src-tauri/src/packs/mod.rs"), "utf8")
  assert.match(packsRs, /pub const PACK_SCHEME: &str = "dynawalla-pack";/)

  const config = JSON.parse(
    fs.readFileSync(path.resolve(here, "../../src-tauri/tauri.conf.json"), "utf8"),
  ) as { app: { security: { csp: string } } }
  assert.match(config.app.security.csp, /frame-src [^;]*dynawalla-pack:/)
})
