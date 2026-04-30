#!/usr/bin/env node
/**
 * Package world-radio.zip — code-only pack.
 *
 * Usage:
 *   node scripts/pack.mjs    # zip only (dist/ must exist)
 *   npm run pack:all         # build + zip
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

  const zipPath = path.join(packRoot, "world-radio.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating world-radio.zip...")
  execSync("zip -r world-radio.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! world-radio.zip is ready.")
}

main()
