#!/usr/bin/env node
// The pack author's two commands.
//
//   dw-pack check <dir>    validate a pack directory against the schema
//   dw-pack serve <dir>    run it in a browser, against a mock host
//
// `serve` exists so that building a pack does not require building, signing,
// publishing and installing one. It serves the pack under the same Content
// Security Policy the shipped runtime serves it under, and frames it with the
// same `sandbox="allow-scripts"` — so the two failures that would otherwise be
// discovered only on a device (an inline script the policy refuses, and code
// that assumes `window.parent` is reachable) happen on the first run here.
//
// What it is NOT: the mock host answers the protocol, it does not enforce it.
// Capability denial, rate limiting and parameter validation live in the app's
// `bridge.ts` and are tested there. A pack that works here can still be refused
// by a real host, which is why `check` is the gate and this is the workbench.

import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseManifest, isSafeRelativePath } from "../src/manifest.ts"
import { CAPABILITIES, SESSION_METHODS } from "../src/capabilities.ts"
import { PROTOCOL_VERSION, SDK_VERSION } from "../src/protocol.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * The policy the pack document is served under, mirroring `pack_csp()` in
 * `src-tauri/src/packs/mod.rs`.
 *
 * The origin is named rather than written `'self'` for the same reason it is
 * there: the frame is sandboxed without `allow-same-origin`, so its origin is
 * opaque and `'self'` matches nothing at all. Getting this wrong produces a
 * policy that looks strict and refuses the pack's own scripts.
 */
const packCsp = (port) => {
  const origin = `http://127.0.0.1:${port}`
  return [
    "default-src 'none'",
    `script-src ${origin} 'wasm-unsafe-eval'`,
    `style-src ${origin} 'unsafe-inline'`,
    `img-src ${origin} data: blob:`,
    `media-src ${origin} blob:`,
    `font-src ${origin}`,
    `connect-src ${origin}`,
    `worker-src ${origin} blob:`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ")
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".woff2": "font/woff2",
}

/** Every file under `dir`, relative, sorted. */
function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, base, out)
    else if (entry.isFile()) out.push(path.relative(base, full))
  }
  return out.sort()
}

function loadPack(dir) {
  const manifestPath = path.join(dir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, problems: [`no manifest.json in ${dir}`] }
  }
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  } catch (error) {
    return { ok: false, problems: [`manifest.json is not JSON: ${error.message}`] }
  }
  const parsed = parseManifest(raw)
  if (!parsed.ok) return { ok: false, problems: [...parsed.problems] }

  const problems = []
  const manifest = parsed.manifest
  if (!isSafeRelativePath(manifest.entry) || !fs.existsSync(path.join(dir, manifest.entry))) {
    problems.push(`entry ${manifest.entry} does not exist`)
  }

  // The declared sizes are what a parent is shown before agreeing to a
  // download. A manifest that understates them is not a rounding error.
  const files = walk(dir)
  const bytes = files.reduce((total, file) => total + fs.statSync(path.join(dir, file)).size, 0)
  if (files.length !== manifest.assets.files) {
    problems.push(`assets.files says ${manifest.assets.files}, the directory has ${files.length}`)
  }
  if (bytes > manifest.assets.bytes) {
    problems.push(`assets.bytes says ${manifest.assets.bytes}, the directory is ${bytes}`)
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, manifest, files, bytes }
}

function check(dir) {
  const result = loadPack(dir)
  if (!result.ok) {
    console.error(`${dir} is not a valid pack:`)
    for (const problem of result.problems) console.error(`  · ${problem}`)
    process.exitCode = 1
    return
  }
  const { manifest, files, bytes } = result
  console.log(`${manifest.id}@${manifest.version} — ${manifest.name}`)
  console.log(`  entry        ${manifest.entry}`)
  console.log(`  host         ${manifest.host.min}${manifest.host.max ? ` … <${manifest.host.max}` : " and later"}`)
  console.log(`  sdk          ${manifest.sdk} (this SDK is ${SDK_VERSION})`)
  console.log(`  capabilities ${manifest.capabilities.join(", ") || "none"}`)
  console.log(`  covers       ${manifest.covers.skills.length} skills, grades ${manifest.covers.grades.join("–")}`)
  console.log(`  on disk      ${files.length} files, ${bytes} bytes`)
}

function serve(dir, port) {
  const result = loadPack(dir)
  if (!result.ok) {
    console.error(`${dir} is not a valid pack — fix it before serving:`)
    for (const problem of result.problems) console.error(`  · ${problem}`)
    process.exitCode = 1
    return
  }
  const manifest = result.manifest

  // The method table is read from the SDK rather than restated, so the mock
  // host cannot drift from the contract it is standing in for.
  const surface = JSON.stringify({
    methods: [...SESSION_METHODS, ...CAPABILITIES.flatMap((entry) => entry.methods)],
    granted: manifest.capabilities,
    packId: manifest.id,
    entry: manifest.entry,
    protocol: PROTOCOL_VERSION,
    sdk: SDK_VERSION,
  })

  const harness = fs.readFileSync(path.join(here, "harness.html"), "utf8")
  const mock = fs.readFileSync(path.join(here, "harness.js"), "utf8")

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost")
    const send = (status, type, body, extra = {}) => {
      response.writeHead(status, { "Content-Type": type, "X-Content-Type-Options": "nosniff", ...extra })
      response.end(body)
    }

    if (url.pathname === "/") return send(200, TYPES[".html"], harness)
    if (url.pathname === "/__dev/host.js") {
      return send(200, TYPES[".js"], `globalThis.__DW_SURFACE = ${surface};\n${mock}`)
    }

    const relative = url.pathname.replace(/^\/+/, "")
    if (relative === "" || !isSafeRelativePath(relative)) return send(404, "text/plain", "not found")
    const file = path.join(dir, relative)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, "text/plain", "not found")

    const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream"
    const headers = path.extname(file) === ".html" ? { "Content-Security-Policy": packCsp(port) } : {}
    send(200, type, fs.readFileSync(file), headers)
  })

  server.listen(port, "127.0.0.1", () => {
    console.log(`${manifest.id}@${manifest.version} on http://127.0.0.1:${port}`)
    console.log(`granting ${manifest.capabilities.join(", ") || "nothing but the session"}`)
  })
}

const [command, target = ".", ...rest] = process.argv.slice(2)
const portFlag = rest.indexOf("--port")
const port = portFlag >= 0 ? Number(rest[portFlag + 1]) : 1425

if (command === "check") check(path.resolve(target))
else if (command === "serve") serve(path.resolve(target), port)
else {
  console.error("usage: dw-pack check <dir> | dw-pack serve <dir> [--port 1425]")
  process.exitCode = 1
}
