import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
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
        console.log(`[melopan] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[melopan] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  publicDir: "public",
  define: {
    "process.env": {},
  },
  plugins: [react(), updateManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "Melopan",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: { NODE_ENV: 'production' } };",
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
