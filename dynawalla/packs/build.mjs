#!/usr/bin/env node
// One command that builds and validates every pack in this repository.
//
//     node packs/build.mjs            build them all
//     node packs/build.mjs fuse       build the ones whose id or directory matches
//
// This is the pipeline. It is written for a thousand packs rather than for two,
// which means exactly three things:
//
//   1. **Discovery is a glob, not a list.** A pack is any directory under
//      `games/` with a `pack.json` in it. Adding the thousandth pack is adding a
//      directory; there is no register to forget to edit.
//   2. **The manifest is generated, never hand-written.** `assets.files`,
//      `assets.bytes` and the integrity digest are facts about the built output,
//      and a hand-maintained copy of a fact is a copy that goes stale. What a
//      pack author writes is `pack.json` — the things the builder cannot know.
//   3. **`dw-pack check` is the gate, and it runs on every pack, every time.**
//      A pack that does not pass is a failed build, not a warning.
//
// The output goes to two places, on purpose:
//
//   * `dynawalla-app/src-tauri/packs/<id>/` — where the app finds them. Tauri
//     bundles that directory as a resource, and the Rust side syncs it into the
//     pack root at launch, so `npm run tauri dev` has every pack installed with
//     no network round trip and no manual install step.
//   * `dist-packs/` — the publishable form, plus `catalog.json`.
//
// **What is deliberately not here: publishing.** Turning `dist-packs/` into
// signed archives at `https://encorpora.io/dynawalla/packs/` is a release step
// against an origin that has nothing on it yet. The catalogue written here has
// no `download.url` for that reason, which is exactly what the schema means by
// "a pack that ships with the app".

import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { manifestFrom } from "./authoring.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const GAMES = path.join(root, "games")
const STAGE = path.join(root, "dynawalla-app", "src-tauri", "packs")
const DIST = path.join(root, "dist-packs")
const CHECK = path.join(here, "sdk", "bin", "dw-pack.mjs")

const filters = process.argv.slice(2)

/** Every file under `dir`, relative and sorted. Sorted so a digest is stable. */
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"))
  }
  return out.sort()
}

function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true })
  fs.mkdirSync(to, { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

/**
 * The integrity digest of a built pack.
 *
 * Over the content, with `manifest.json` excluded — the manifest carries the
 * digest, so including it would be a fixed point nothing can compute. Path and
 * length go into the hash alongside the bytes, so a file renamed or truncated
 * changes it as surely as a byte flipped.
 */
function digestOf(dir, files) {
  const hash = crypto.createHash("sha256")
  for (const file of files) {
    if (file === "manifest.json") continue
    const bytes = fs.readFileSync(path.join(dir, file))
    hash.update(`${file}\0${bytes.length}\0`)
    hash.update(bytes)
  }
  return hash.digest("hex")
}

function bytesOf(dir, files) {
  return files.reduce((total, file) => total + fs.statSync(path.join(dir, file)).size, 0)
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" })
}

function discover() {
  if (!fs.existsSync(GAMES)) return []
  const packs = []
  for (const entry of fs.readdirSync(GAMES, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(GAMES, entry.name)
    const meta = path.join(dir, "pack.json")
    if (!fs.existsSync(meta)) continue
    const source = JSON.parse(fs.readFileSync(meta, "utf8"))
    if (filters.length > 0 && !filters.some((f) => entry.name.includes(f) || source.id.includes(f))) {
      continue
    }
    packs.push({ dir, name: entry.name, source })
  }
  return packs.sort((a, b) => (a.source.id < b.source.id ? -1 : 1))
}

function buildOne(pack) {
  const { dir, name, source } = pack
  console.log(`\n── ${source.id}@${source.version}  (games/${name})`)

  if (!fs.existsSync(path.join(dir, "node_modules"))) {
    console.log("   installing dependencies")
    run("npm", [fs.existsSync(path.join(dir, "package-lock.json")) ? "ci" : "install"], dir)
  }

  run("npm", ["run", "build:pack"], dir)

  const built = path.join(dir, source.build?.out ?? "dist-pack")
  if (!fs.existsSync(path.join(built, source.entry))) {
    throw new Error(`${source.id}: the build produced no ${source.entry} in ${built}`)
  }

  const staged = path.join(STAGE, source.id)
  copyTree(built, staged)

  // Two passes: the manifest is itself a file in the directory it measures, so
  // its own size has to be inside the totals it declares. `assets.bytes` is
  // rounded up to the next kilobyte, which the schema permits (it is a ceiling
  // shown to a parent, and `dw-pack check` fails only when the directory is
  // *bigger* than declared) and which keeps a one-byte edit from failing a
  // build for a reason nobody would guess.
  const content = walk(staged)
  const contentBytes = bytesOf(staged, content)
  const manifest = manifestFrom(
    source,
    {
      files: content.length + 1,
      bytes: Math.ceil((contentBytes + 4096) / 1024) * 1024,
    },
    {
      bytes: Math.max(1, contentBytes),
      sha256: digestOf(staged, content),
    },
  )
  fs.writeFileSync(path.join(staged, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)

  // The gate. Not advisory: a pack that does not pass does not ship, and the
  // build stops here rather than staging something the host would refuse.
  run(process.execPath, ["--experimental-strip-types", "--no-warnings=ExperimentalWarning", CHECK, "check", staged], root)

  copyTree(staged, path.join(DIST, source.id))
  return manifest
}

fs.rmSync(DIST, { recursive: true, force: true })
fs.mkdirSync(DIST, { recursive: true })
fs.mkdirSync(STAGE, { recursive: true })

const packs = discover()
if (packs.length === 0) {
  console.error("no packs found — a pack is a directory under games/ with a pack.json")
  process.exit(1)
}

const manifests = []
for (const pack of packs) manifests.push(buildOne(pack))

// Anything staged that is no longer a pack is removed, so a renamed id does not
// leave the old one installed on every device that ever ran a dev build.
const live = new Set(manifests.map((manifest) => manifest.id))
for (const entry of fs.readdirSync(STAGE, { withFileTypes: true })) {
  if (entry.isDirectory() && !live.has(entry.name) && filters.length === 0) {
    fs.rmSync(path.join(STAGE, entry.name), { recursive: true, force: true })
  }
}

fs.writeFileSync(
  path.join(DIST, "catalog.json"),
  `${JSON.stringify({ schema: 1, packs: manifests }, null, 2)}\n`,
)

console.log(`\n${String(manifests.length)} pack(s) built, checked and staged into src-tauri/packs/`)
