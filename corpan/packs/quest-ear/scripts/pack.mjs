#!/usr/bin/env node
/**
 * Package quest-ear.zip — code-only game pack.
 *
 * The pack contains only manifest.json + dist/ (app.js, app.css).
 * NPC dialog + TTS are driven by the bundled corpus and the corpan host SDK.
 *
 * Usage:
 *   node scripts/pack.mjs          # package only (assumes dist/ exists)
 *   npm run pack:all               # build + package
 */
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

async function main() {
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  const zipPath = path.join(packRoot, "quest-ear.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating quest-ear.zip...")
  execSync("zip -r quest-ear.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! quest-ear.zip is ready.")
}

main()
