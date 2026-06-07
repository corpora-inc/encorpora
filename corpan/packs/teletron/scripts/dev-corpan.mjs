import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { watch } from "node:fs"
import { networkInterfaces } from "node:os"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const packsRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distDir = path.join(packRoot, "dist")
const port = 8989

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
      console.error("[teletron] Failed to update dev manifest:", err)
    }
  }, 150)
}

const watchDist = async () => {
  try {
    await mkdir(distDir, { recursive: true })
    watch(distDir, { recursive: true }, (_event, filename) => {
      if (!filename) return
      if (filename.endsWith(".js") || filename.endsWith(".css")) {
        scheduleManifestUpdate()
      }
    })
  } catch (err) {
    console.warn("[teletron] Dist watcher unavailable:", err)
  }
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[teletron] ${name} exited with ${code}`)
    }
    process.exit(code ?? 0)
  })
  return child
}

const canBind = () =>
  new Promise((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, "0.0.0.0")
  })

const existingServerServesTeletron = async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/teletron/manifest.json`, {
      cache: "no-store",
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const lanUrls = () => {
  const urls = [`http://localhost:${port}/teletron/manifest.json`]
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        urls.push(`http://${entry.address}:${port}/teletron/manifest.json`)
      }
    }
  }
  return Array.from(new Set(urls))
}

const printUrls = () => {
  console.log("\n[teletron] dev manifest URLs:")
  for (const url of lanUrls()) console.log(`  ${url}`)
  console.log("")
}

const buildWatcher = run(
  npmCmd,
  ["run", "build", "--", "--watch"],
  packRoot,
  "build:watch",
)

let server = null
if (await canBind()) {
  server = run(
    "python3",
    ["-m", "http.server", String(port), "--bind", "0.0.0.0"],
    packsRoot,
    "server",
  )
} else if (await existingServerServesTeletron()) {
  console.log(`[teletron] Reusing existing pack server on :${port}`)
} else {
  console.warn(
    `[teletron] Port ${port} is busy, but it does not appear to serve /teletron/manifest.json.`,
  )
}

await watchDist()
scheduleManifestUpdate()
printUrls()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  server?.kill("SIGINT")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
