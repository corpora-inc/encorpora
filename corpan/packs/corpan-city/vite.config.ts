import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

// Bump manifest.devRevision on production builds only (dev uses the watcher).
const updateManifestPlugin = () => {
  let isProduction = false
  return {
    name: "update-manifest",
    configResolved(config) {
      isProduction = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!isProduction) return
      try {
        const manifestPath = path.resolve(__dirname, "manifest.json")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[corpan-city] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[corpan-city] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  root: "./",
  publicDir: "public",
  assetsInclude: ["**/*.glb", "**/*.mp3", "**/*.webp", "**/*.png"],
  resolve: {
    alias: {
      "@corpan-city/contracts": path.resolve(__dirname, "contracts/src/index.ts"),
      "@shared/audio": path.resolve(__dirname, "../shared/audio"),
    },
  },
  define: {
    "process.env": {},
  },
  // Stage 3: the façade painter Web Worker (src/world/painter.worker.ts). Emit it
  // as a self-contained IIFE worker chunk so it loads in the packaged single-file
  // IIFE pack too; if it ever fails to load in a host WebView, the façade painter
  // feature-detects + falls back to a main-thread paint (see facadePainter.ts).
  worker: {
    format: "iife",
  },
  plugins: [updateManifestPlugin()],
  server: {
    port: 5174,
    open: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "CorpanCity",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: {} };",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "app.css"
          return "assets/[name][extname]"
        },
      },
    },
  },
})
