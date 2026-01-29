import { spawn } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { networkInterfaces } from "node:os"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const packsRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distDir = path.join(packRoot, "dist")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

// --- IP Detection Helper ---
const getLocalIp = () => {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-ipv4
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}
const LOCAL_IP = getLocalIp();
// ---------------------------

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
      console.error("[lingo-hero] Failed to update dev manifest:", err)
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
    console.warn("[lingo-hero] Dist watcher unavailable:", err)
  }
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[lingo-hero] ${name} exited with ${code}`)
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

const PORT = 8990

const server = run(
  "python3",
  ["-m", "http.server", String(PORT), "--bind", "0.0.0.0"],
  packsRoot,
  "server"
)

console.log(`
---------------------------------------------------------
[lingo-hero] Pack Server Running!

For Desktop App:
  http://localhost:${PORT}/lingo-hero/manifest.json

For iOS/Android (Simulator or Device):
  http://${LOCAL_IP}:${PORT}/lingo-hero/manifest.json
---------------------------------------------------------
`)

watchDist()
scheduleManifestUpdate()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server.kill("SIGINT")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

