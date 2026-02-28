import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { readFile, readdir, writeFile, stat } from "node:fs/promises"
import { watch } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const packsRoot = path.resolve(packRoot, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distDir = path.join(packRoot, "dist")
const booksDir = path.resolve(packRoot, "../../../books/fascinating-curiosities")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

// --- Manifest update on dist changes ---

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
      console.error("[stargate-reader] Failed to update dev manifest:", err)
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
    console.warn("[stargate-reader] Dist watcher unavailable:", err)
  }
}

// --- Book data scanning ---

async function scanBooks() {
  const map = new Map()
  try {
    const entries = await readdir(booksDir)
    for (const dirName of entries) {
      const manifestFile = path.join(booksDir, dirName, "pack", "manifest.json")
      try {
        const raw = await readFile(manifestFile, "utf8")
        const manifest = JSON.parse(raw)
        if (manifest.id) map.set(manifest.id, dirName)
      } catch {
        // Not a book or missing manifest
      }
    }
  } catch {
    console.warn("[stargate-reader] Books directory not found:", booksDir)
  }
  return map
}

async function detectLanguages(dirName) {
  const packDir = path.join(booksDir, dirName, "pack")
  const languages = []
  try {
    for (const file of await readdir(packDir)) {
      const match = file.match(/^audio_manifest_(\w+)\.json$/)
      if (match) languages.push(match[1])
    }
  } catch { /* ignore */ }
  return languages
}

// --- Book data HTTP server on port 8990 ---

async function startBookDataServer() {
  const bookMap = await scanBooks()
  console.log(`[book-data] Found ${bookMap.size} books: ${[...bookMap.keys()].join(", ")}`)

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url || "/"

    // Catalog
    if (url === "/data/catalog.json") {
      const catalog = []
      for (const [id, dirName] of bookMap) {
        const manifestFile = path.join(booksDir, dirName, "pack", "manifest.json")
        try {
          const raw = await readFile(manifestFile, "utf8")
          const manifest = JSON.parse(raw)
          const languages = await detectLanguages(dirName)
          catalog.push({
            id,
            name: manifest.name || dirName,
            volume: manifest.metadata?.volume ?? 0,
            series: manifest.metadata?.series || "",
            hasAudio: languages.length > 0,
            availableLanguages: languages,
          })
        } catch {
          catalog.push({ id, name: dirName, volume: 0, series: "", hasAudio: false, availableLanguages: [] })
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify(catalog))
      return
    }

    // Book data: /data/books/{bookId}/*
    const bookMatch = url.match(/^\/data\/books\/([^/]+)\/(.+)$/)
    if (!bookMatch) {
      res.writeHead(404)
      res.end("Not found")
      return
    }

    const [, bookId, filePath] = bookMatch
    const dirName = bookMap.get(bookId)
    if (!dirName) {
      res.writeHead(404)
      res.end(`Book not found: ${bookId}`)
      return
    }

    const fullPath = path.join(booksDir, dirName, "pack", filePath)
    const resolved = path.resolve(fullPath)
    const packDir = path.resolve(path.join(booksDir, dirName, "pack"))

    if (!resolved.startsWith(packDir)) {
      res.writeHead(403)
      res.end("Forbidden")
      return
    }

    try {
      const fileStat = await stat(resolved)
      if (!fileStat.isFile()) {
        res.writeHead(404)
        res.end("Not found")
        return
      }

      const data = await readFile(resolved)
      const ext = path.extname(resolved).toLowerCase()
      const contentTypes = {
        ".json": "application/json",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
      }
      res.writeHead(200, {
        "Content-Type": contentTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end("Not found")
    }
  })

  server.listen(8990, "0.0.0.0", () => {
    console.log("[book-data] Serving book data on http://localhost:8990")
  })

  return server
}

// --- Spawn processes ---

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[stargate-reader] ${name} exited with ${code}`)
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

const packsServer = run(
  "python3",
  ["-m", "http.server", "8989", "--bind", "0.0.0.0"],
  packsRoot,
  "packs-server"
)

const bookDataServer = await startBookDataServer()

watchDist()
scheduleManifestUpdate()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  packsServer.kill("SIGINT")
  bookDataServer.close()
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
