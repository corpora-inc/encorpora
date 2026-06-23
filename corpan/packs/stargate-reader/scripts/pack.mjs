#!/usr/bin/env node
/**
 * Package stargate-reader.zip — code-only reader pack.
 *
 * Reader packs contain only manifest.json + dist/.
 * Narration audio is served from CloudFront and downloaded separately by the app.
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
const dataDir = path.join(packRoot, "data")

async function main() {
  // Verify dist/ exists
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  // Clean legacy data dir if it exists
  if (existsSync(dataDir)) {
    console.log("Removing legacy data/ directory...")
    await rm(dataDir, { recursive: true })
  }

  // Clean previous zip
  const zipPath = path.join(packRoot, "stargate-reader.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  // Create zip — code only
  console.log("Creating stargate-reader.zip...")
  execSync("zip -r stargate-reader.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! stargate-reader.zip is ready.")
}

main()
