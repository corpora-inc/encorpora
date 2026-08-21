#!/usr/bin/env node
/**
 * Package kronopan.zip, code only. Kronopán synthesizes its own metronome, so
 * it has no bundled audio kit. The zip holds manifest.json, dist/, and the
 * avatar png when one is present.
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

  const zipPath = path.join(packRoot, "kronopan.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  const avatar = "kronopan-avatar.png"
  const hasAvatar = existsSync(path.join(packRoot, avatar))
  const targets = ["manifest.json", "dist/", ...(hasAvatar ? [avatar] : [])]

  console.log("Creating kronopan.zip...")
  execSync(`zip -r kronopan.zip ${targets.join(" ")}`, {
    cwd: packRoot,
    stdio: "inherit",
  })

  if (!hasAvatar) {
    console.log("(no kronopan-avatar.png yet; add one before listing in the catalog)")
  }
  console.log("\nDone! kronopan.zip is ready.")
}

main()
