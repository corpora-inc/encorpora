import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
// Shared pack-dev helpers: loop-safe manifest bump + --watch exclude.
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
      name: "Beatlounge",
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
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
