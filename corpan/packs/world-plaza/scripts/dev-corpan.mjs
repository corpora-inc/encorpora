import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Dev harness: builds the pack in watch mode and serves the packs/ dir over
 * http://localhost:8989 so the running Corpán app can dev-load
 * world_plaza from http://localhost:8989/world-plaza/manifest.json.
 * Bumps manifest.devRevision on each dist change to trigger a host reload.
 */
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
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
      manifest.devRevision = new Date().toISOString()
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    } catch (err) {
      console.error("[world-plaza] Failed to update dev manifest:", err)
    }
  }, 150)
}

const watchDist = () => {
  try {
    watch(distDir, { recursive: true }, (_e, filename) => {
      if (filename && (filename.endsWith(".js") || filename.endsWith(".css"))) {
        scheduleManifestUpdate()
      }
    })
  } catch (err) {
    console.warn("[world-plaza] Dist watcher unavailable:", err)
  }
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`[world-plaza] ${name} exited with ${code}`)
    process.exit(code ?? 0)
  })
  return child
}

const buildWatcher = run(npmCmd, ["run", "build", "--", "--watch"], packRoot, "build:watch")
const server = run("python3", ["-m", "http.server", "8989", "--bind", "0.0.0.0"], packsRoot, "server")

watchDist()
scheduleManifestUpdate()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server.kill("SIGINT")
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
