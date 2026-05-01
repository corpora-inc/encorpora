import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

const manifestPath = path.resolve(__dirname, "manifest.json")
// Read at config-load time so the version is injected as a build-time constant
// rather than imported into source — that would put manifest.json in the watch
// graph and conflict with dev-corpan.mjs's devRevision bumper.
const packManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string }

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
    __WORLD_RADIO_VERSION__: JSON.stringify(packManifest.version),
  },
  resolve: {
    alias: {
      "@shared/audio": path.resolve(__dirname, "../shared/audio/index.ts"),
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
