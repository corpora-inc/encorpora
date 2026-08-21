// The retirement ledger, checked from the app's own suite.
//
// `remove_retired` and its Rust tests are the mechanism. Until this change no
// workflow in this repository ran `cargo test` at all — PR 749's additive-sync
// regression test had never executed on a pull request — and the `native` job
// now does, so those tests are gated too.
//
// This file is not a duplicate of them. It is the second reader of the same
// two files, and it runs in a different job on a different filter: a change to
// `retired-packs.json` alone would run the Rust tests, and a change to
// `mod.rs`'s call sites would run both, but only this suite is gated on the
// app's own path and only this one keeps a ledger edit from ever being a
// one-gate change.
//
// This is the same shape as `native.test.ts`, which reads `lib.rs` for exactly
// the same reason: the thing that goes wrong is two files disagreeing, and only
// reading both catches it.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const srcTauri = path.resolve(here, "../../src-tauri")
const games = path.resolve(here, "../../../games")

const ledgerText = fs.readFileSync(path.join(srcTauri, "retired-packs.json"), "utf8")
const modRs = fs.readFileSync(path.join(srcTauri, "src/packs/mod.rs"), "utf8")

interface Ledger {
  readonly schema: number
  readonly retired: readonly { readonly id: string; readonly name?: string }[]
}

const ledger = JSON.parse(ledgerText) as Ledger

/** The same rule `valid_pack_id` states in Rust, which is what turns an id into a directory name. */
function validPackId(id: string): boolean {
  return /^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/.test(id) && id.length <= 64
}

test("the ledger names every pack that has been pulled from the fleet", () => {
  const ids = ledger.retired.map((entry) => entry.id)
  // Named one at a time rather than counted: a count goes green the day
  // someone deletes a line, and a deleted line is a retired game coming back
  // to life on every device that still has it.
  for (const id of ["dynawalla.foundry", "dynawalla.gavel", "dynawalla.street"]) {
    assert.ok(ids.includes(id), `${id} is not in retired-packs.json, so every device that has it keeps it`)
  }
  assert.equal(new Set(ids).size, ids.length, "retired-packs.json lists a duplicate id")
  for (const id of ids) {
    assert.ok(validPackId(id), `${id} is not a pack id, so no directory can ever match it`)
  }
})

test("no retired id is also a game built from this repository", () => {
  const shipped: string[] = []
  for (const entry of fs.readdirSync(games, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const meta = path.join(games, entry.name, "pack.json")
    if (!fs.existsSync(meta)) continue
    shipped.push((JSON.parse(fs.readFileSync(meta, "utf8")) as { id: string }).id)
  }
  // Proof the walk found the games directory. Without it every assertion below
  // passes over an empty list and this test asserts nothing at all.
  assert.ok(shipped.length >= 20, `found only ${String(shipped.length)} packs under ${games}`)

  for (const entry of ledger.retired) {
    assert.ok(
      !shipped.includes(entry.id),
      `${entry.id} is retired AND built — every device deletes it at the launch after it installs`,
    )
  }
})

test("the launch sequence retires before it installs, and does it unconditionally", () => {
  // The call site, not the function. `remove_retired` existing while nothing
  // calls it is the exact failure this repository already has one instance of:
  // `packs_remove` is written, registered, exported — and invoked by nothing.
  const sequence = /fn sync_into\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(modRs)
  assert.ok(sequence, "mod.rs has no sync_into")
  const body = sequence[1] ?? ""
  assert.match(body, /remove_retired\(root, &retired_ids\(\)\)/, "sync_into does not retire anything")
  assert.ok(
    body.indexOf("remove_retired") < body.indexOf("match locate()"),
    "retirement must run before the bundle is even located, so a build that cannot find its packs still honours it",
  )
  assert.match(modRs, /sync_into\(&root, \|\| bundled_source\(app\)\)/, "sync_bundled does not run the launch sequence")
})

test("nothing in the launch path enumerates the pack root", () => {
  // The destructive rule this whole design exists to avoid: "delete whatever
  // the bundle does not carry". The pack root is not a mirror of the bundle —
  // it is also where `packs_install` puts every download — so a rule shaped
  // that way uninstalls a child's downloaded packs at every launch, silently.
  //
  // Its signature in source is a walk of the *root* inside a function whose job
  // is the *bundle*. `sync_from_directory` reads `source`, `sync_from_zip`
  // reads the archive, and `remove_retired` joins names it was handed; none of
  // the three may ever read the destination directory.
  for (const walker of ["sync_from_directory", "sync_from_zip", "remove_retired"]) {
    const fn = new RegExp(`\\nfn ${walker}[\\s\\S]*?\\n\\}\\n`).exec(modRs)
    assert.ok(fn, `mod.rs has no ${walker}`)
    assert.ok(fn[0].length > 200, `the match for ${walker} is too short to be its body`)
    assert.doesNotMatch(
      fn[0],
      /read_dir\(root\)|read_dir\(&root\)|read_dir\(destination\)|read_dir\(&destination\)/,
      `${walker} enumerates the directory it writes into — that is the rule that deletes downloads`,
    )
  }
})
