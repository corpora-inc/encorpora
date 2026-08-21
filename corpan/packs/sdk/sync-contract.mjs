#!/usr/bin/env node
// Sync the Journey activity contract from its ONE authoritative source into
// every generated copy. Zero dependencies; node >= 18.
//
//   Authoritative: corpan-app/src/contentPacks/activityContract.ts
//   Generated:     packs/sdk/activityContract.ts                       (always)
//                  packs/shared/capabilities/core/src/activityContract.ts (always)
//                  packs/*/src/sdk/activityContract.ts                 (opt-in)
//
// A pack opts in by creating `src/sdk/activityContract.ts` once (empty is
// fine) — the script overwrites existing files but never invents new files in
// packs that don't use the contract.
//
// Usage:
//   node packs/sdk/sync-contract.mjs           # write all copies
//   node packs/sdk/sync-contract.mjs --check   # CI: exit 1 listing stale copies
//
// Spec: corpan/docs/journey/specs/activity-contract.md §5.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url)) // corpan/packs/sdk
const packsDir = path.dirname(here)                       // corpan/packs
const corpanDir = path.dirname(packsDir)                  // corpan

const SOURCE = path.join(corpanDir, "corpan-app", "src", "contentPacks", "activityContract.ts")

const HEADER =
  "// GENERATED from corpan-app/src/contentPacks/activityContract.ts — DO NOT EDIT. Run: node packs/sdk/sync-contract.mjs\n\n"

/** Fixed targets, always written (created if absent). */
const fixedTargets = [
  path.join(here, "activityContract.ts"),
  path.join(packsDir, "shared", "capabilities", "core", "src", "activityContract.ts"),
]

// Vendored opt-in targets: any EXISTING packs/<pack>/src/sdk/activityContract.ts.
const vendoredTargets = () => {
  const out = []
  for (const name of readdirSync(packsDir)) {
    const candidate = path.join(packsDir, name, "src", "sdk", "activityContract.ts")
    try {
      if (statSync(path.join(packsDir, name)).isDirectory() && existsSync(candidate)) {
        out.push(candidate)
      }
    } catch {
      // unreadable entry — skip
    }
  }
  return out
}

const rel = (p) => path.relative(corpanDir, p)

const main = () => {
  const check = process.argv.includes("--check")
  const expected = HEADER + readFileSync(SOURCE, "utf8")
  const targets = [...fixedTargets, ...vendoredTargets()]

  const stale = []
  for (const target of targets) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : null
    if (current === expected) continue
    if (check) {
      stale.push(target)
      continue
    }
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, expected)
    console.log(`synced ${rel(target)}`)
  }

  if (check) {
    if (stale.length > 0) {
      console.error("Journey contract copies are STALE (edit the authoritative file, then run `node packs/sdk/sync-contract.mjs`):")
      for (const t of stale) console.error(`  ${rel(t)}`)
      process.exit(1)
    }
    console.log(`sync-contract: ${targets.length} copies in sync with ${rel(SOURCE)}`)
    return
  }
  console.log(`sync-contract: ${targets.length} copies up to date`)
}

main()
