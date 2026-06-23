/**
 * Shared pack dev server — the ONE static server every pack's `dev:corpan`
 * should use. Do not hand-roll a `python3 -m http.server` or a per-pack
 * `http.createServer` again; import this instead.
 *
 * Why a dedicated server (vs corpan-app's own vite `/packs` middleware on
 * :1421): on-device testing. A phone/tablet on the LAN can't reach the dev
 * Mac's localhost-bound vite, and the corpan-app WebView (origin
 * `tauri://localhost`) fetches pack assets cross-origin via the Fetch API —
 * which a bare `python3 -m http.server` blocks because it sends no
 * `Access-Control-Allow-Origin` header. This server always sends `*`.
 *
 * What it does:
 *   1. (optional) spawns `vite build --watch` so `dist/*` rebuilds on save.
 *   2. serves the pack tree with CORS at `/packs/<id>/…`, `/<id>/…`, or `/…`
 *      (all three resolve to the pack root, matching corpan-app's `:1421`
 *      `/packs/<id>/…` URL shape so the manifest URL is identical either way).
 *   3. prints the LAN manifest URL to paste into corpan-app's dev pack field.
 *
 * It does NOT touch manifest.json. The `devRevision` cache-buster is bumped by
 * vite itself via `devManifestPlugin()` in ./vite-pack-plugin.mjs — keeping a
 * single process responsible for that file avoids the infinite rebuild loop an
 * external writer causes (vite --watch watches the project root, so an outside
 * manifest write retriggers the build, and the overlapping rebuilds race
 * `emptyOutDir` into an ENOENT mid-copy). See ./README.md.
 *
 * Usage (a pack's scripts/dev-corpan.mjs is then ~3 lines):
 *
 *     import { startPackDevServer } from "../../shared/dev/serve-pack.mjs"
 *     startPackDevServer({ packDir: new URL("..", import.meta.url) })
 *
 * Port: pass `port`, or set the documented env var, or rely on the per-pack
 * default. See the PORT REGISTRY in ./README.md — pick a unique one so two
 * packs can run `dev:corpan` side by side.
 */
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { stat, readFile } from "node:fs/promises"
import { createReadStream } from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"

const MIME = {
  ".json": "application/json; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/mp4",
  ".sqlite3": "application/vnd.sqlite3",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const toDir = (dirish) => {
  if (dirish instanceof URL) return fileURLToPath(dirish)
  if (typeof dirish === "string" && dirish.startsWith("file:")) return fileURLToPath(new URL(dirish))
  return dirish
}

const lanAddress = () => {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address
    }
  }
  return "localhost"
}

/**
 * @param {object} opts
 * @param {string|URL} opts.packDir   Absolute path (or file: URL) to the pack root
 *                                    — the dir containing manifest.json + package.json.
 * @param {string} [opts.packId]      Pack id for logs/URL. Defaults to manifest.json `id`,
 *                                    falling back to the pack dir name.
 * @param {number} [opts.port]        Listen port. Defaults to 8989. Use a unique one per
 *                                    pack (see PORT REGISTRY in README).
 * @param {boolean} [opts.build]      Spawn `npm run build -- --watch`? Default true.
 *                                    Set false if you run the build watcher separately.
 */
export async function startPackDevServer(opts) {
  const packRootRaw = toDir(opts.packDir)
  if (!packRootRaw) throw new Error("startPackDevServer: packDir is required")
  // path.resolve strips any trailing slash (new URL("..", …) leaves one), so the
  // `packRoot + path.sep` traversal guard below doesn't see a double separator.
  const packRoot = path.resolve(packRootRaw)

  let packId = opts.packId
  if (!packId) {
    try {
      packId = JSON.parse(await readFile(path.join(packRoot, "manifest.json"), "utf8")).id
    } catch {
      /* fall through */
    }
    packId = packId || path.basename(packRoot)
  }

  const port = Number(opts.port ?? process.env.PACK_DEV_PORT ?? 8989)
  const tag = `[${packId}]`

  // 1. Build watcher (loop-safe bump lives in the vite plugin, not here).
  if (opts.build !== false) {
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"
    const child = spawn(npmCmd, ["run", "build", "--", "--watch"], {
      cwd: packRoot,
      stdio: "inherit",
    })
    child.on("exit", (code) => {
      if (code && code !== 0) console.error(`${tag} build:watch exited with ${code}`)
      process.exit(code ?? 0)
    })
    const shutdown = () => {
      child.kill("SIGINT")
      process.exit(0)
    }
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)
  }

  // 2. CORS static server, rooted at the pack dir.
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "*")
    res.setHeader("Cache-Control", "no-store")
    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }
    try {
      const { pathname } = new URL(req.url, `http://localhost:${port}`)
      let rel = decodeURIComponent(pathname).replace(/^\/+/, "")
      // Accept /packs/<id>/foo  AND  /<id>/foo  AND  /foo — all → pack root.
      if (rel.startsWith("packs/")) rel = rel.slice("packs/".length)
      if (rel === packId || rel.startsWith(`${packId}/`)) rel = rel.slice(packId.length).replace(/^\/+/, "")
      if (rel === "") rel = "manifest.json"

      const filePath = path.normalize(path.join(packRoot, rel))
      if (filePath !== packRoot && !filePath.startsWith(packRoot + path.sep)) {
        res.writeHead(403).end("forbidden")
        return
      }
      const info = await stat(filePath).catch(() => null)
      if (!info?.isFile()) {
        res.writeHead(404).end(`not found: ${rel}`)
        return
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Content-Length": info.size,
      })
      if (req.method === "HEAD") {
        res.end()
        return
      }
      createReadStream(filePath).pipe(res)
    } catch (err) {
      console.error(`${tag} server error:`, err)
      res.writeHead(500).end("server error")
    }
  })

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`${tag} PORT ${port} IN USE — another dev:corpan is probably running there.`)
      console.error(`${tag} Set PACK_DEV_PORT to a free port and retry, e.g. PACK_DEV_PORT=9001 npm run dev:corpan`)
      process.exit(1)
    }
    throw err
  })

  server.listen(port, "0.0.0.0", () => {
    const ip = lanAddress()
    const url = `http://${ip}:${port}/packs/${packId}/manifest.json`
    const line = "─".repeat(68)
    console.log(`\n${line}`)
    console.log(` ${packId} dev:corpan ready (CORS enabled)`)
    console.log("")
    console.log(" Manifest URL (paste into corpan-app dev pack field):")
    console.log(`   ${url}`)
    console.log(`${line}\n`)
  })

  return server
}
