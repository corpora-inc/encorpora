import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

const isWin = process.platform === "win32"
const npmCmd = isWin ? "npm.cmd" : "npm"

console.log(`
---------------------------------------------------------
[Lingo Hero] Starting Build Watcher...
---------------------------------------------------------
`)

// Run "npm run build -- --watch"
const buildWatcher = spawn(npmCmd, ["run", "build", "--", "--watch"], {
  cwd: packRoot,
  stdio: "inherit"
})

console.log(`
---------------------------------------------------------
[Lingo Hero] Ready for Corpan!

1. Ensure the Corpan App is running (npm run tauri dev)
2. In App Settings -> Packs -> Manifest URL:
   
   /packs/lingo-hero/manifest.json

   (Note: Use the relative path starting with /)
---------------------------------------------------------
`)

// Handle cleanup
const shutdown = () => {
  buildWatcher.kill("SIGINT")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
