/**
 * Tutomaton dev:corpan — Spark-side live-reload pipeline.
 *
 * What it does:
 *   1. Spawns `vite build --watch` so `dist/chat.js` + `dist/chat.css` rebuild
 *      on every source change in `src/` or `languages/<code>/retrieval/`.
 *   2. Watches `dist/` and bumps `manifest.devRevision` on each rebuild —
 *      the corpan-app dev server polls this and reloads the pack module.
 *
 * Used together with `corpan-app/`'s vite dev server (which serves
 * `/packs/tutomaton/*` from the repo path) so the frontend agent can iterate
 * on chat UI / language picker / styles without touching the native plugin.
 *
 *   Spark terminal A:  cd corpan-app && npm run dev -- --port 5274 --host 0.0.0.0
 *   Spark terminal B:  cd packs/tutomaton && npm run dev:corpan
 *   Frontend agent:    http://spark-f62c:5274/  (or 100.99.83.64:5274)
 *
 * Modeled on `packs/hover-runner/scripts/dev-corpan.mjs`.
 */
import { spawn } from "node:child_process"
import { readFile, writeFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const manifestPath = path.join(packRoot, "manifest.json")
const distJs = path.join(packRoot, "dist", "chat.js")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

let updateTimer = null
const scheduleManifestUpdate = () => {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(async () => {
    try {
      const raw = await readFile(manifestPath, "utf8")
      const manifest = JSON.parse(raw)
      manifest.devRevision = new Date().toISOString()
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
      console.log(`[tutomaton] manifest.devRevision → ${manifest.devRevision}`)
    } catch (err) {
      console.error("[tutomaton] Failed to update dev manifest:", err)
    }
  }, 150)
}

// Poll dist/chat.js mtime — robust to vite's emptyOutDir rebuilds (which
// would invalidate any fs.watch handle on the directory).
let lastMtimeMs = 0
const pollDist = () => {
  setInterval(async () => {
    try {
      const s = await stat(distJs)
      if (s.mtimeMs !== lastMtimeMs) {
        if (lastMtimeMs !== 0) scheduleManifestUpdate()
        lastMtimeMs = s.mtimeMs
      }
    } catch { /* dist/chat.js not built yet */ }
  }, 500)
  console.log(`[tutomaton] polling ${distJs} for rebuild events`)
}

const run = (cmd, args, cwd, name) => {
  const child = spawn(cmd, args, { cwd, stdio: "inherit" })
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[tutomaton] ${name} exited with ${code}`)
    }
    process.exit(code ?? 0)
  })
  return child
}

const buildWatcher = run(npmCmd, ["run", "build", "--", "--watch"], packRoot, "build:watch")

pollDist()
scheduleManifestUpdate()

const shutdown = () => {
  buildWatcher.kill("SIGINT")
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
