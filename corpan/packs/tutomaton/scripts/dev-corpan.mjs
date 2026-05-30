/**
 * Tutomaton dev:corpan — serves the pack to a running corpan-app on a
 * real device, with live-reload via manifest.devRevision bumps.
 *
 * What it does:
 *   1. Spawns `vite build --watch` so `dist/chat.js` + `dist/chat.css` rebuild
 *      on every source change.
 *   2. Polls `dist/chat.js` mtime and bumps `manifest.devRevision` on rebuild
 *      (poll, not fs.watch, because vite's `emptyOutDir: true` invalidates
 *      directory watch handles on Linux).
 *   3. Runs an HTTP server on TUTOMATON_DEV_PORT (default 8991) that serves
 *      the pack tree (`manifest.json`, `dist/*`, `languages/*`, `prompts/*`)
 *      to the running corpan-app on the device.
 *
 * Port convention across packs (when running multiple dev:corpan at once):
 *     stargate-reader  → 8989
 *     earthgate-reader → 8990
 *     tutomaton        → 8991   (this one)
 * Override with: TUTOMATON_DEV_PORT=9001 npm run dev:corpan
 *
 * Startup banner prints the LAN URL for the pack manifest, e.g.:
 *
 *     ──────────────────────────────────────────────────────────────────
 *      Tutomaton dev:corpan ready
 *
 *      Manifest URL (point your corpan-app dev to this):
 *        http://10.0.0.49:8991/packs/tutomaton/manifest.json
 *
 *      Other entry points served:
 *        http://10.0.0.49:8991/packs/tutomaton/dist/chat.js
 *        http://10.0.0.49:8991/packs/tutomaton/languages/es/module.json
 *     ──────────────────────────────────────────────────────────────────
 */
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { readFile, writeFile, stat } from "node:fs/promises"
import { createReadStream } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import os from "node:os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const packsRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distJs = path.join(packRoot, "dist", "chat.js")

const PACK_ID = "tutomaton"
const PORT = Number(process.env.TUTOMATON_DEV_PORT || 8991)

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

// ───────────────────────────────────────────────────────────────────────
// 1. Manifest devRevision bumper
// ───────────────────────────────────────────────────────────────────────

let updateTimer = null
const scheduleManifestUpdate = () => {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(async () => {
    try {
      const raw = await readFile(manifestPath, "utf8")
      const manifest = JSON.parse(raw)
      manifest.devRevision = new Date().toISOString()
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`[${PACK_ID}] manifest.devRevision → ${manifest.devRevision}`)
    } catch (err) {
      console.error(`[${PACK_ID}] failed to update manifest:`, err)
    }
  }, 150)
}

let lastMtimeMs = 0
const pollDist = () => {
  setInterval(async () => {
    try {
      const s = await stat(distJs)
      if (s.mtimeMs !== lastMtimeMs) {
        if (lastMtimeMs !== 0) scheduleManifestUpdate()
        lastMtimeMs = s.mtimeMs
      }
    } catch { /* dist/chat.js not built yet */ }
  }, 500)
}

// ───────────────────────────────────────────────────────────────────────
// 2. HTTP server — serves the pack tree to the device
// ───────────────────────────────────────────────────────────────────────

const MIME = {
  ".json": "application/json; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
  ".sqlite3": "application/vnd.sqlite3",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const startServer = () => new Promise((resolve) => {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    res.setHeader("Cache-Control", "no-store, must-revalidate")

    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "")

    // Accept both /packs/tutomaton/foo  AND  /tutomaton/foo  AND  /foo
    if (rel.startsWith("packs/")) rel = rel.slice("packs/".length)
    if (rel.startsWith(`${PACK_ID}/`)) rel = rel.slice(PACK_ID.length + 1)
    if (rel === "") rel = "manifest.json"

    const filePath = path.join(packRoot, rel)

    // Refuse path traversal
    if (!filePath.startsWith(packRoot)) {
      res.writeHead(403).end("forbidden")
      return
    }

    try {
      const s = await stat(filePath)
      if (!s.isFile()) {
        res.writeHead(404).end("not found")
        return
      }
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Content-Length": s.size,
      })
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404).end(`not found: ${rel}`)
    }
  })

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[${PACK_ID}] PORT ${PORT} IN USE — another dev:corpan is probably running there.`)
      console.error(`[${PACK_ID}] Set TUTOMATON_DEV_PORT to a free port and retry, e.g.:`)
      console.error(`[${PACK_ID}]    TUTOMATON_DEV_PORT=9001 npm run dev:corpan`)
      process.exit(1)
    }
    throw err
  })

  server.listen(PORT, "0.0.0.0", () => {
    resolve(server)
  })
})

// ───────────────────────────────────────────────────────────────────────
// 3. Helpers — LAN IP detection + startup banner
// ───────────────────────────────────────────────────────────────────────

const detectLanIp = () => {
  const nets = os.networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address
      }
    }
  }
  return null
}

const printBanner = () => {
  const lan = detectLanIp()
  const host = lan || "localhost"
  const bar = "─".repeat(72)
  console.log("")
  console.log(bar)
  console.log(` Tutomaton dev:corpan ready on port ${PORT}`)
  console.log("")
  console.log(" Manifest URL (point your corpan-app dev to this):")
  console.log(`   http://${host}:${PORT}/packs/${PACK_ID}/manifest.json`)
  console.log("")
  console.log(" Other entry points served:")
  console.log(`   http://${host}:${PORT}/packs/${PACK_ID}/dist/chat.js`)
  console.log(`   http://${host}:${PORT}/packs/${PACK_ID}/languages/es/module.json`)
  console.log(`   http://${host}:${PORT}/packs/${PACK_ID}/languages/zh/module.json`)
  if (lan) {
    console.log("")
    console.log(` (localhost works on this machine; ${host} works for devices on the LAN)`)
  }
  console.log(bar)
  console.log("")
}

// ───────────────────────────────────────────────────────────────────────
// 4. Spawn + lifecycle
// ───────────────────────────────────────────────────────────────────────

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`[${PACK_ID}] ${name} exited with ${code}`)
    process.exit(code ?? 0)
  })
  return child
}

const buildWatcher = run(npmCmd, ["run", "build", "--", "--watch"], packRoot, "build:watch")
const server = await startServer()

pollDist()
scheduleManifestUpdate()
printBanner()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server.close()
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
