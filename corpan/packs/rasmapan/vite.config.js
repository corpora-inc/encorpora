import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.resolve(__dirname, "manifest.json")

// Bumps manifest.devRevision on production builds only — dev/watch mode
// is handled by scripts/dev-corpan.mjs (which watches dist/ directly so
// the host detects updates without us touching manifest.json on every
// rebuild and adding it to the watch graph).
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
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[rasmapan] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[rasmapan] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  publicDir: false,
  define: {
    "process.env": {},
  },
  plugins: [updateManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.js"),
      name: "Rasmapan",
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
