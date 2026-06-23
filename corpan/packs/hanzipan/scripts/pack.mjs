#!/usr/bin/env node
/**
 * Package hanzipan.zip — character studio pack with bundled sqlite.
 *
 * Layout inside the zip:
 *   manifest.json
 *   dist/app.js, dist/app.css       (vite output;
 *                                    hanziwriter.min.js is prepended
 *                                    into app.js by vite plugin —
 *                                    see vite.config.js)
 *   data/hanzi.sqlite3              (~52 MB, character + stroke + etymology)
 *   HANZIWRITER_LICENSE.txt         (license required to redistribute)
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

  const zipPath = path.join(packRoot, "hanzipan.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating hanzipan.zip...")
  execSync(
    "zip -r hanzipan.zip manifest.json dist/ data/ HANZIWRITER_LICENSE.txt",
    { cwd: packRoot, stdio: "inherit" }
  )

  console.log("\nDone! hanzipan.zip is ready.")
}

main()
