/**
 * Dev workflow for loading Rasmapan inside a running corpan-app dev session.
 *
 *   1. `npm run dev:corpan` (this script) starts:
 *        - vite build --watch        → rebuilds dist/ on every save
 *        - static HTTP server :8989  → serves packsRoot/rasmapan/{manifest.json,dist/...}
 *        - dist watcher              → bumps manifest.json devRevision so the host
 *                                      detects updates without a manual refresh.
 *
 *   2. In the corpan-app dev UI, install the dev pack with manifest URL:
 *        http://localhost:8989/rasmapan/manifest.json
 *
 *   Mirrors the hanzipan / world-radio / pronunciation-coach pattern.
 *   `data/arabic.sqlite3` and `assets/` are served from the pack root by
 *   the same static server.
 */
import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const packsRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distDir = path.join(packRoot, "dist")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

let updateTimer = null
const scheduleManifestUpdate = () => {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(async () => {
    try {
      const raw = await readFile(manifestPath, "utf8")
      const manifest = JSON.parse(raw)
      manifest.devRevision = new Date().toISOString()
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    } catch (err) {
      console.error("[rasmapan] Failed to update dev manifest:", err)
    }
  }, 150)
}

const watchDist = () => {
  try {
    watch(distDir, { recursive: true }, (_event, filename) => {
      if (!filename) return
      if (filename.endsWith(".js") || filename.endsWith(".css")) {
        scheduleManifestUpdate()
      }
    })
  } catch (err) {
    console.warn("[rasmapan] Dist watcher unavailable:", err)
  }
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[rasmapan] ${name} exited with ${code}`)
    }
    process.exit(code ?? 0)
  })
  return child
}

const buildWatcher = run(
  npmCmd,
  ["run", "build", "--", "--watch"],
  packRoot,
  "build:watch"
)

const server = run(
  "python3",
  ["-m", "http.server", "8989", "--bind", "0.0.0.0"],
  packsRoot,
  "server"
)

watchDist()
scheduleManifestUpdate()

console.log("\n[rasmapan] dev URL: http://localhost:8989/rasmapan/manifest.json\n")

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server.kill("SIGINT")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
