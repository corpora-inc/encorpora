import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

// Plugin to update manifest devRevision on production builds only
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
        console.log(`[juice-squeeze2] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[juice-squeeze2] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  root: "./",
  publicDir: "public",
  assetsInclude: ["**/*.mp3"],
  define: {
    "process.env": {},
  },
  plugins: [react(), updateManifestPlugin()],
  server: {
    port: 5174,
    open: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "JuiceSqueeze2",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: {} }; var require$$0 = require$$0 || {};",
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
