import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

// Update manifest devRevision on production builds only.
// (dev mode uses the watcher in scripts/dev-corpan.mjs)
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
        console.log(`[juice-squeeze] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[juice-squeeze] Failed to update manifest:", err)
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
  resolve: {
    alias: {
      // Capability source imports (cap-squeeze) — see packs/shared/capabilities.
      "@shared/capabilities": path.resolve(__dirname, "../shared/capabilities"),
      // Capability sources live outside this package root; force their bare
      // framework imports to resolve from THIS pack's node_modules (§3.1:
      // frameworks come from the consumer).
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "@dnd-kit/core": path.resolve(__dirname, "node_modules/@dnd-kit/core"),
      zustand: path.resolve(__dirname, "node_modules/zustand"),
    },
  },
  // Use esbuild's automatic JSX runtime so we don't depend on a Vite React
  // plugin (keeps us compatible with any Vite version).
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
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
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "JuiceSqueeze",
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
