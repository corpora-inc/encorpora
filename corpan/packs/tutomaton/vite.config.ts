import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

// Bump manifest.devRevision on production builds so corpan-app picks up the
// new bundle. Dev:corpan does this via its own watcher (see scripts/dev-corpan.mjs).
const updateManifestPlugin = () => {
  let isProduction = false
  return {
    name: "update-manifest",
    configResolved(config: { command: string; build: { watch?: unknown } }) {
      isProduction = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!isProduction) return
      try {
        const manifestPath = path.resolve(__dirname, "manifest.json")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[tutomaton] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[tutomaton] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  plugins: [updateManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/chat.ts"),
      name: "Tutomaton",
      formats: ["iife"],
      fileName: () => "chat.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: {} };",
        assetFileNames: (assetInfo: { name?: string }) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) return "chat.css"
          return "assets/[name][extname]"
        },
      },
    },
  },
})
