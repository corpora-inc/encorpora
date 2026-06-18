#!/usr/bin/env node
/**
 * Package juice-squeeze-fire.zip — a code-only game pack (manifest.json + dist/).
 *
 * The zip is the canonical sideload artifact: it's uploaded as a GitHub release
 * asset on Umanistan/encorpora and loaded in corpan-app developer mode (Settings
 * → tap "Corpan" 7× → Packs → paste the release download URL). The app extracts
 * it to ~app-data/corpan-packs/juice_squeeze_fire/ and serves it via corpan-pack://.
 *
 * Usage:
 *   node scripts/pack.mjs    # package only (assumes dist/ exists)
 *   npm run pack:all         # build + package
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

  const zipPath = path.join(packRoot, "juice-squeeze-fire.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating juice-squeeze-fire.zip...")
  execSync("zip -r juice-squeeze-fire.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! juice-squeeze-fire.zip is ready.")
}

main()
