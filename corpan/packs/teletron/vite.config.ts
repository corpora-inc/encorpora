import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

const updateManifestPlugin = () => {
  let production = false
  return {
    name: "update-manifest",
    configResolved(config: { command: string; build: { watch?: unknown } }) {
      production = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!production) return
      const manifestPath = path.resolve(__dirname, "manifest.json")
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      manifest.devRevision = new Date().toISOString()
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@corpan-city/contracts": path.resolve(__dirname, "../corpan-city/contracts/src/index.ts"),
      "@shared/asr": path.resolve(__dirname, "../shared/asr/index.ts"),
      "@shared/moderation": path.resolve(__dirname, "../shared/moderation/index.ts"),
      "@shared/net": path.resolve(__dirname, "../shared/net"),
      "colyseus.js": path.resolve(__dirname, "node_modules/colyseus.js"),
      "zod": path.resolve(__dirname, "node_modules/zod"),
    },
  },
  define: {
    "process.env": {},
  },
  plugins: [updateManifestPlugin()],
  server: {
    port: 5176,
    open: false,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: path.resolve(__dirname, "src/main.ts"),
      name: "Teletron",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner: "globalThis.process = globalThis.process || { env: {} };",
        assetFileNames: (asset: { name?: string }) =>
          asset.name?.endsWith(".css") ? "app.css" : "assets/[name][extname]",
      },
    },
  },
})
