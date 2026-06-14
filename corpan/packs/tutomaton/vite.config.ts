import { defineConfig } from "vite"
import path from "node:path"
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs"

// Inline the pack manifest + every language's prompt files INTO the bundle at
// build time. The pack used to `fetch("corpan-pack://…/manifest.json")` (and
// the prompt files) at runtime, but on-device the WebView is on `tauri://`
// while the installed pack is served from the `corpan-pack://` origin — so
// WebKit CORS-blocks the cross-origin fetch and `mount()` throws (black
// screen). Inlining mirrors how this pack already inlines its logo and how the
// reader packs receive host-preloaded data: zero runtime cross-origin fetches,
// fully offline. Prompts total ~65 KB, manifest ~20 KB — trivial bundle cost.
function readInlinedManifest(): string {
  return readFileSync(path.resolve(__dirname, "manifest.json"), "utf8")
}

function readInlinedPrompts(): Record<string, { system: string; grounding: string }> {
  const langsDir = path.resolve(__dirname, "languages")
  const out: Record<string, { system: string; grounding: string }> = {}
  for (const code of readdirSync(langsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)) {
    const sys = path.join(langsDir, code, "prompts/system_prompt.txt")
    const grd = path.join(langsDir, code, "prompts/grounding_instruction.txt")
    if (!existsSync(sys) && !existsSync(grd)) continue
    out[code] = {
      system: existsSync(sys) ? readFileSync(sys, "utf8") : "",
      grounding: existsSync(grd) ? readFileSync(grd, "utf8") : "",
    }
  }
  return out
}

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
  resolve: {
    alias: {
      "@shared/monetization": path.resolve(__dirname, "../shared/monetization/index.ts"),
    },
  },
  define: {
    // Embedded as JS string literals; parsed once at runtime (see chat.ts).
    __TUTOMATON_MANIFEST_JSON__: JSON.stringify(readInlinedManifest()),
    __TUTOMATON_PROMPTS_JSON__: JSON.stringify(JSON.stringify(readInlinedPrompts())),
  },
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
