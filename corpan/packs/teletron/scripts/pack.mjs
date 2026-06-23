#!/usr/bin/env node
/**
 * Package teletron.zip — Teletron code pack.
 *
 * Includes the brand avatar (teletron-avatar.png) alongside manifest + dist,
 * because main.ts references it at the pack root via packAssetUrl(). Without
 * it in the zip, the icon shows as a broken image on platforms that resolve
 * pack assets from the downloaded zip (e.g. Android).
 *
 * Usage:
 *   node scripts/pack.mjs    # zip only (dist/ must exist)
 */
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

const ASSETS = ["manifest.json", "dist/", "teletron-avatar.png"]

async function main() {
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  for (const asset of ASSETS) {
    const trimmed = asset.replace(/\/$/, "")
    if (!existsSync(path.join(packRoot, trimmed))) {
      console.error(`Required pack asset missing: ${asset}`)
      process.exit(1)
    }
  }

  const zipPath = path.join(packRoot, "teletron.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating teletron.zip...")
  execSync(`zip -r teletron.zip ${ASSETS.join(" ")}`, {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! teletron.zip is ready.")
}

main()
