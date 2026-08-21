#!/usr/bin/env node
/**
 * Package drift.zip — a code-only reader/interlude pack.
 *
 * Drift contains only manifest.json + dist/. It composes its micro-stories
 * from the learner's live corpus at runtime (pair-agnostic), so there is no
 * bundled content payload.
 *
 * Usage:
 *   node scripts/pack.mjs      # package only (assumes dist/ exists)
 *   npm run pack:all           # build + package
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
  const zipPath = path.join(packRoot, "drift.zip")
  if (existsSync(zipPath)) await rm(zipPath)

  console.log("Creating drift.zip...")
  execSync("zip -r drift.zip manifest.json dist/", { cwd: packRoot, stdio: "inherit" })
  console.log("\nDone! drift.zip is ready.")
}

main()
