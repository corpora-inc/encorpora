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
        console.log(`[world-plaza] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[world-plaza] Failed to update manifest:", err)
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
      "@world-plaza/contracts": path.resolve(__dirname, "contracts/src/index.ts"),
    },
  },
  define: {
    "process.env": {},
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
      name: "WorldPlaza",
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
