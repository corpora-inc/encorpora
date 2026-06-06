#!/usr/bin/env node
/**
 * Package world-plaza.zip — Corpan City code pack.
 *
 * Content (scenes/topologies/quests/etc.) is JSON-imported in src/ and inlined
 * by Vite into dist/app.js, so the shipped zip is just manifest + dist.
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

async function main() {
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  const zipPath = path.join(packRoot, "world-plaza.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating world-plaza.zip...")
  execSync("zip -r world-plaza.zip manifest.json dist/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! world-plaza.zip is ready.")
}

main()
