import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

const updateManifestPlugin = () => {
  let isProduction = false

  return {
    name: "update-manifest",
    configResolved(config: { command: string; build: { watch?: boolean } }) {
      isProduction = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!isProduction) return

      try {
        const manifestPath = path.resolve(__dirname, "manifest.json")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[tts-sequencer] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[tts-sequencer] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  root: "./",
  publicDir: "public",
  define: {
    "process.env": {},
  },
  plugins: [updateManifestPlugin()],
  server: {
    port: 5177,
    open: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "TtsSequencer",
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
