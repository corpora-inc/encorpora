/**
 * Shared vite helpers for a pack's `vite.config`. Two pieces that MUST be used
 * together to get a loop-safe dev:corpan build:
 *
 *   1. devManifestPlugin() — bumps `manifest.json`'s `devRevision` after every
 *      build (one-shot prod builds AND each --watch rebuild). corpan-app polls
 *      this field to know when to re-fetch the pack in dev.
 *
 *   2. packWatchOptions(argv) — when `--watch` is present, tells vite to ignore
 *      manifest.json / dist / node_modules. WITHOUT this, the bump in (1)
 *      retriggers the build (vite --watch watches the project root), and the
 *      overlapping rebuilds race `emptyOutDir` into an ENOENT mid-copy. Only
 *      source changes should rebuild.
 *
 * Usage in vite.config.ts:
 *
 *     import { devManifestPlugin, packWatchOptions } from "../../shared/dev/vite-pack-plugin.mjs"
 *
 *     export default defineConfig({
 *       plugins: [react(), devManifestPlugin()],
 *       build: {
 *         outDir: "dist",
 *         emptyOutDir: true,
 *         ...packWatchOptions(),   // adds `watch: {...}` only under --watch
 *       },
 *     })
 */
import path from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

/**
 * Vite plugin that stamps `manifest.json` `devRevision` with the current time
 * at the end of each build. `manifestDir` defaults to the vite project root.
 */
export function devManifestPlugin(options = {}) {
  let shouldBump = false
  let rootDir = options.manifestDir || ""
  return {
    name: "corpan-dev-manifest",
    configResolved(config) {
      // Bump on real builds only (both one-shot and --watch rebuilds);
      // never during `vite serve` (standalone dev).
      shouldBump = config.command === "build"
      if (!rootDir) rootDir = config.root || process.cwd()
    },
    closeBundle() {
      if (!shouldBump) return
      try {
        const manifestPath = path.resolve(rootDir, "manifest.json")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
        manifest.devRevision = new Date().toISOString()
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
        console.log(`[dev-manifest] devRevision → ${manifest.devRevision}`)
      } catch (err) {
        console.error("[dev-manifest] failed to update manifest:", err)
      }
    },
  }
}

/** Files whose changes must NOT retrigger a --watch rebuild. */
export const PACK_WATCH_EXCLUDE = ["manifest.json", "dist/**", "node_modules/**", ".git/**"]

/**
 * Returns `{ watch: { exclude } }` when running under `vite build --watch`,
 * and `{}` otherwise — so one-shot production builds are unaffected. Spread
 * into the vite `build` config.
 *
 * @param {string[]} [argv] defaults to process.argv
 */
export function packWatchOptions(argv = process.argv) {
  if (!argv.includes("--watch")) return {}
  return { watch: { exclude: PACK_WATCH_EXCLUDE } }
}
