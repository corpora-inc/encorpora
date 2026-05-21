#!/usr/bin/env node
/**
 * Package melopan.zip — code + bundled voice kit.
 *
 * Includes manifest.json and dist/ (which contains app.js, app.css, and
 * voice-kit/{voice}/{word}.ogg samples copied from public/voice-kit/).
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

  const zipPath = path.join(packRoot, "melopan.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating melopan.zip...")
  execSync("zip -r melopan.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! melopan.zip is ready.")
}

main()
