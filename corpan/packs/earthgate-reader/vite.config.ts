import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs"
import type { ViteDevServer } from "vite"

const BOOKS_DIR = path.resolve(__dirname, "../../../books/fascinating-curiosities")

const updateManifestPlugin = () => {
  let isProduction = false

  return {
    name: "update-manifest",
    configResolved(config: { command: string; build: { watch: unknown } }) {
      isProduction = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!isProduction) return

      try {
        const manifestPath = path.resolve(__dirname, "manifest.json")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[earthgate-reader] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[earthgate-reader] Failed to update manifest:", err)
      }
    },
  }
}

/**
 * Scan books directory and build bookId → directory name mapping.
 */
function scanBooks(): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(BOOKS_DIR)) return map

  for (const dirName of readdirSync(BOOKS_DIR)) {
    const manifestPath = path.join(BOOKS_DIR, dirName, "pack", "manifest.json")
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      if (manifest.id) {
        map.set(manifest.id, dirName)
      }
    } catch {
      // Not a book directory or missing manifest
    }
  }
  return map
}

/**
 * Detect available audio languages for a book by checking for audio_manifest_*.json files.
 */
function detectLanguages(dirName: string): string[] {
  const packDir = path.join(BOOKS_DIR, dirName, "pack")
  const languages: string[] = []
  try {
    for (const file of readdirSync(packDir)) {
      const match = file.match(/^audio_manifest_(\w+)\.json$/)
      if (match) languages.push(match[1])
    }
  } catch {
    // Directory read failure
  }
  return languages
}

/**
 * Vite plugin that proxies /data/books/{bookId}/* to the books directory
 * and serves /data/catalog.json with available books.
 */
const bookDataProxyPlugin = () => {
  let bookMap: Map<string, string>

  return {
    name: "book-data-proxy",
    configureServer(server: ViteDevServer) {
      bookMap = scanBooks()
      console.log(`[book-data-proxy] Found ${bookMap.size} books: ${[...bookMap.keys()].join(", ")}`)

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()

        // Serve catalog
        if (req.url === "/data/catalog.json") {
          const catalog = [...bookMap.entries()].map(([id, dirName]) => {
            const manifestPath = path.join(BOOKS_DIR, dirName, "pack", "manifest.json")
            try {
              const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
              const languages = detectLanguages(dirName)
              return {
                id,
                name: manifest.name || dirName,
                volume: manifest.metadata?.volume ?? 0,
                series: manifest.metadata?.series || "",
                hasAudio: languages.length > 0,
                availableLanguages: languages,
              }
            } catch {
              return { id, name: dirName, volume: 0, series: "", hasAudio: false, availableLanguages: [] }
            }
          })

          res.setHeader("Content-Type", "application/json")
          res.setHeader("Access-Control-Allow-Origin", "*")
          res.end(JSON.stringify(catalog))
          return
        }

        // Serve book data: /data/books/{bookId}/*
        const bookMatch = req.url.match(/^\/data\/books\/([^/]+)\/(.+)$/)
        if (!bookMatch) return next()

        const [, bookId, filePath] = bookMatch
        const dirName = bookMap.get(bookId)
        if (!dirName) {
          res.statusCode = 404
          res.end(`Book not found: ${bookId}`)
          return
        }

        const fullPath = path.join(BOOKS_DIR, dirName, "pack", filePath)

        // Security: prevent directory traversal
        const resolved = path.resolve(fullPath)
        const packDir = path.resolve(path.join(BOOKS_DIR, dirName, "pack"))
        if (!resolved.startsWith(packDir)) {
          res.statusCode = 403
          res.end("Forbidden")
          return
        }

        try {
          if (!existsSync(resolved) || !statSync(resolved).isFile()) {
            res.statusCode = 404
            res.end(`Not found: ${filePath}`)
            return
          }

          const data = readFileSync(resolved)

          // Set content type based on extension
          const ext = path.extname(resolved).toLowerCase()
          const contentTypes: Record<string, string> = {
            ".json": "application/json",
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
            ".aac": "audio/aac",
          }
          res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream")
          res.setHeader("Access-Control-Allow-Origin", "*")
          res.setHeader("Cache-Control", "public, max-age=3600")
          res.end(data)
        } catch (err) {
          res.statusCode = 500
          res.end(`Error reading file: ${err}`)
        }
      })
    },
  }
}

export default defineConfig({
  publicDir: false,
  define: {
    "process.env": {},
  },
  resolve: {
    alias: {
      "@shared/catalog": path.resolve(__dirname, "../shared/catalog"),
      "@shared/core": path.resolve(__dirname, "../shared/core"),
      "@shared/sdk": path.resolve(__dirname, "../shared/sdk"),
      "@shared/data": path.resolve(__dirname, "../shared/data"),
      "@shared/audio": path.resolve(__dirname, "../shared/audio"),
      "@shared/state": path.resolve(__dirname, "../shared/state"),
      "@shared/ui": path.resolve(__dirname, "../shared/ui"),
      "zustand/vanilla": path.resolve(__dirname, "node_modules/zustand/esm/vanilla.mjs"),
      "zustand/middleware": path.resolve(__dirname, "node_modules/zustand/esm/middleware.mjs"),
    },
  },
  plugins: [updateManifestPlugin(), bookDataProxyPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "EarthgateReader",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: {} };",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "app.css"
          }
          return "assets/[name][extname]"
        },
      },
    },
  },
})
