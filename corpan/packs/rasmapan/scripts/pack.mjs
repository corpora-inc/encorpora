#!/usr/bin/env node
/**
 * Package rasmapan.zip — Arabic writing pack with bundled sqlite + Amiri font.
 *
 * Layout inside the zip:
 *   manifest.json
 *   dist/app.js, dist/app.css       (vite output)
 *   data/arabic.sqlite3              (letter + lesson + word + style data)
 *   assets/fonts/Amiri-Regular.woff2 (SIL OFL 1.1)
 *   assets/styles/*.png              (calligraphic-style sample images)
 *   OFL.txt                          (Amiri license)
 *   LICENSES.md                      (third-party attributions)
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

  const zipPath = path.join(packRoot, "rasmapan.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating rasmapan.zip...")
  const entries = [
    "manifest.json",
    "dist/",
    "data/",
    "assets/",
    "OFL.txt",
    "LICENSES.md",
  ].filter((p) => existsSync(path.join(packRoot, p.replace(/\/$/, ""))))

  execSync(`zip -r rasmapan.zip ${entries.join(" ")}`, {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! rasmapan.zip is ready.")
}

main()
