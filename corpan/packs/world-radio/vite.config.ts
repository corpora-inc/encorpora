import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

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
        console.log(`[world-radio] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[world-radio] Failed to update manifest:", err)
      }
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
      "@shared/audio": path.resolve(__dirname, "../shared/audio/nativeKeepAlive.ts"),
      "@shared/analytics": path.resolve(__dirname, "../shared/analytics/index.ts"),
    },
  },
  plugins: [updateManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "WorldRadio",
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
