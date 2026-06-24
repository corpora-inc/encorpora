#!/usr/bin/env node
/**
 * Package wordpan-es-en.zip — the es→en word-explanation data pack.
 *
 * This is a DATA-ONLY pack: it ships no JS/CSS experience. The built-in
 * Phrase Flip experience (corpan-app `MainExperience.tsx`) queries it via
 * `hostApi.queryPackDb` on long-press, exactly the way Hanzipan queries its
 * `hanzi_etymology` table.
 *
 * Layout inside the zip (mirrors `packs/hanzipan/scripts/pack.mjs`):
 *   manifest.json
 *   data/word.sqlite3              (en + es word_explanation rows)
 *
 * Build the DB first with the Python generator:
 *   python3 corpan/dja/word_pack/build_word_pack.py \
 *     --explanations /path/to/english_verified.json --include-seed-words \
 *     --out corpan/packs/wordpan/data/word.sqlite3
 *   # then strip to en+es:
 *   sqlite3 word.sqlite3 "DELETE FROM word_explanation \
 *     WHERE language_code NOT IN ('en','es'); VACUUM;"
 *
 * Usage:
 *   node scripts/pack.mjs           # package (assumes data/word.sqlite3 exists)
 */
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

async function main() {
  if (!existsSync(path.join(packRoot, "data", "word.sqlite3"))) {
    console.error("data/word.sqlite3 not found. Build the DB first (see header).")
    process.exit(1)
  }

  const zipPath = path.join(packRoot, "wordpan-es-en.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  console.log("Creating wordpan-es-en.zip...")
  execSync("zip -r wordpan-es-en.zip manifest.json data/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! wordpan-es-en.zip is ready.")
}

main()
