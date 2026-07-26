// The dev server's filesystem reach, as a gate rather than a comment.
//
// `server.fs` decides which files `npm run dev` will hand out over HTTP. It has
// no effect on `npm run build`, on `vite preview`, or on the shipped Tauri
// bundle — Rollup has no fs guard and the production app loads from the bundle,
// not from a server. So nothing here protects a user. What it protects is the
// developer's own machine, and only while the dev server is running.
//
// That window is not hypothetical for this app. `TAURI_DEV_HOST` is how you run
// on a phone, and setting it takes the server off loopback and onto the LAN
// (see `vite.config.ts`), where every file the fs guard allows is readable by
// any host on the network. The repository is public, so its source is not the
// concern; the concern is the material that is deliberately NOT in it.
//
// Two rules, both of which a code change could quietly break and neither of
// which any other test would notice:
//
//   1. The allow list stays at Vite's default. Widening it is the thing that
//      has to stay hard.
//   2. The deny list keeps every one of Vite's defaults. Vite REPLACES this
//      array rather than extending it, so restating five of six silently drops
//      the sixth — a config that looks like hardening and is the opposite.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.resolve(here, "../../vite.config.ts")
const config = fs.readFileSync(configPath, "utf8")

/**
 * The config's executable lines, so the prose in it may freely name `fs.allow`
 * without tripping the check below.
 *
 * Whole comment LINES are dropped rather than comment SYNTAX stripped, because
 * this file is full of globs and a glob is indistinguishable from a comment
 * delimiter: `"**\/.git/**"` contains `/*` and `"**\/src-tauri/**"` contains
 * the matching `*\/`, so the usual block-comment regex deletes the entire
 * `server` block between them and every assertion here passes vacuously. That
 * happened while writing this test.
 *
 * The technique is exact only while every comment occupies its own line, so
 * that is asserted rather than assumed.
 */
const lines = config.split("\n")
const executable = lines.filter((line) => !line.trim().startsWith("//")).join("\n")

test("this file can still read vite.config.ts", () => {
  // A guard on the parsing technique above, not on the config. Without it, a
  // trailing comment or a real block comment would quietly turn every
  // assertion below into a tautology.
  const trailing = lines.filter((line) => !line.trim().startsWith("//") && line.includes("//"))
  assert.deepEqual(
    trailing,
    [],
    "vite.config.ts has a trailing comment — this test strips whole comment lines only",
  )
  assert.ok(
    !/^\s*\/\*/m.test(config),
    "vite.config.ts has a block comment — this test strips whole comment lines only",
  )
  assert.ok(executable.includes("server:"), "the server block did not survive comment stripping")
})

/** Vite 8's `serverConfigDefaults.server.fs.deny`, verbatim. */
const VITE_DEFAULT_DENY = [
  ".env",
  ".env.*",
  "*.{crt,pem,key,p12,pfx,cer,der}",
  ".npmrc",
  ".yarnrc.yml",
  "**/.git/**",
]

/**
 * Signing material this repo's own ignore rules anticipate in the app tree, and
 * which Vite's defaults do not cover. `.p12` is already a Vite default; these
 * three are not.
 */
const SIGNING_MATERIAL = ["jks", "p8", "mobileprovision"]

function denyPatterns(): string[] {
  const block = /deny:\s*\[([^\]]*)\]/.exec(executable)
  assert.ok(block, "server.fs.deny is not an array literal in vite.config.ts")
  return [...(block[1] ?? "").matchAll(/"([^"]*)"/g)].map(([, pattern]) => pattern ?? "")
}

test("the dev server does not widen its allow list past Vite's default", () => {
  // Vite's default is the workspace root, which for this app is its own
  // directory: `searchForWorkspaceRoot` walks up looking for a `package.json`
  // with a `workspaces` field, a `pnpm-workspace.yaml` or a `lerna.json`, finds
  // none, and falls back to the nearest package root — which is here.
  //
  // Nothing under `src/` imports across that boundary any more: the host ships
  // no content, and `boundary.test.ts` fails the build if it starts to
  // (ADR-0022). So the allow list has nothing left to widen *for*, and this
  // test is now the cheap way to notice if something has reached out again —
  // a 403 in `npm run dev` is the symptom, and re-widening is the wrong fix.
  assert.ok(
    !/\ballow\s*:/.test(executable),
    "vite.config.ts sets server.fs.allow — the dev server's reach has been widened",
  )
})

test("the deny list keeps every Vite default", () => {
  const patterns = denyPatterns()
  const missing = VITE_DEFAULT_DENY.filter((pattern) => !patterns.includes(pattern))
  assert.deepEqual(
    missing,
    [],
    "restating server.fs.deny dropped a Vite default — the array is replaced, not merged",
  )
})

test("the deny list covers the signing material the repo tells you to create here", () => {
  // `src-tauri/.gitignore` ignores these because the repo is public;
  // `RELEASE_SETUP.md` instructs you to generate an upload keystore in this
  // tree. Being un-committed keeps them out of GitHub, not off the LAN. They
  // live inside the allowed root, so narrowing `allow` cannot reach them —
  // only `deny` can, and deny is checked first.
  const patterns = denyPatterns()
  const uncovered = SIGNING_MATERIAL.filter(
    (extension) => !patterns.some((pattern) => pattern.includes(extension)),
  )
  assert.deepEqual(uncovered, [], "signing material is servable by the dev server")
})

test("the server is on loopback unless TAURI_DEV_HOST is set", () => {
  // The one switch that puts this server on the network. It should stay
  // explicit: an unconditional `host: true` would bind every interface for
  // every developer, all the time, which is what makes the fs guard load-bearing
  // rather than theoretical.
  assert.ok(
    /host:\s*devHost\s*\|\|\s*"127\.0\.0\.1"/.test(executable),
    "the dev server no longer defaults to loopback",
  )
  assert.ok(
    /const devHost = process\.env\.TAURI_DEV_HOST/.test(executable),
    "TAURI_DEV_HOST is no longer the only thing that takes the server off loopback",
  )
})
