import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const gamesRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distDir = path.join(packRoot, "dist")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

let updateTimer = null
const scheduleManifestUpdate = () => {
  if (updateTimer) {
    clearTimeout(updateTimer)
  }
  updateTimer = setTimeout(async () => {
    try {
      const raw = await readFile(manifestPath, "utf8")
      const manifest = JSON.parse(raw)
      manifest.devRevision = new Date().toISOString()
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    } catch (err) {
      console.error("[endless-learner] Failed to update dev manifest:", err)
    }
  }, 150)
}

const watchDist = () => {
  try {
    watch(distDir, { recursive: true }, (_event, filename) => {
      if (!filename) {
        return
      }
      if (filename.endsWith(".js") || filename.endsWith(".css")) {
        scheduleManifestUpdate()
      }
    })
  } catch (err) {
    console.warn("[endless-learner] Dist watcher unavailable:", err)
  }
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[endless-learner] ${name} exited with ${code}`)
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

const server = run("python3", ["-m", "http.server", "8989"], gamesRoot, "server")

watchDist()
scheduleManifestUpdate()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server.kill("SIGINT")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
