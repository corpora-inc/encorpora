import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifestPath = path.resolve(__dirname, "manifest.json")
const hanziwriterPath = path.resolve(__dirname, "hanziwriter.min.js")
const distAppJs = path.resolve(__dirname, "dist/app.js")

// Prepend hanziwriter.min.js to dist/app.js so `window.HanziWriter` is
// populated before main.js's IIFE runs. Preserves the pre-Vite runtime
// contract (the old hand-build did `cat hanziwriter.min.js + index.js`),
// which lets `ensureHanziWriter()` short-circuit on the in-memory global
// instead of fetching a separate file at runtime.
const inlineHanziwriterPlugin = () => ({
  name: "inline-hanziwriter",
  closeBundle() {
    if (!existsSync(distAppJs) || !existsSync(hanziwriterPath)) return
    const lib = readFileSync(hanziwriterPath, "utf8")
    const built = readFileSync(distAppJs, "utf8")
    writeFileSync(distAppJs, lib + "\n;" + built)
    console.log("[hanzipan] Inlined hanziwriter.min.js into dist/app.js")
  },
})

// Bumps manifest.devRevision on production builds only — dev/watch mode
// is handled by scripts/dev-corpan.mjs (which watches dist/ directly so
// the host detects updates without us touching manifest.json on every
// rebuild and adding it to the watch graph).
const updateManifestPlugin = () => {
  let isProduction = false
  return {
    name: "update-manifest",
    configResolved(config) {
      isProduction = config.command === "build" && !config.build.watch
    },
    closeBundle() {
      if (!isProduction) return
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[hanzipan] Updated manifest devRevision: ${manifest.devRevision}`)
      } catch (err) {
        console.error("[hanzipan] Failed to update manifest:", err)
      }
    },
  }
}

export default defineConfig({
  publicDir: false,
  define: {
    "process.env": {},
  },
  plugins: [updateManifestPlugin(), inlineHanziwriterPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "src/main.js"),
      name: "Hanzipan",
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
