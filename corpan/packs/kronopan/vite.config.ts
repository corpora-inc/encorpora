import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
// Shared pack-dev helpers: loop-safe manifest bump + --watch exclude.
// See corpan/packs/shared/dev/README.md.
import { devManifestPlugin, packWatchOptions } from "../shared/dev/vite-pack-plugin.mjs"

export default defineConfig({
  publicDir: "public",
  define: {
    "process.env": {},
  },
  plugins: [react(), devManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    ...packWatchOptions(),
    lib: {
      entry: path.resolve(__dirname, "src/main.tsx"),
      name: "Kronopan",
      formats: ["iife"],
      fileName: () => "app.js",
    },
    rollupOptions: {
      output: {
        banner:
          "globalThis.process = globalThis.process || { env: { NODE_ENV: 'production' } };",
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
