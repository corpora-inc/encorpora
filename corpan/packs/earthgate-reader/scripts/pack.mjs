#!/usr/bin/env node
/**
 * Package earthgate-reader.zip with all available book data.
 *
 * Scans books/fascinating-curiosities/ for books with segments + audio,
 * copies them into data/books/{bookId}/, generates data/catalog.json,
 * and zips manifest.json + dist/ + data/ into earthgate-reader.zip.
 *
 * Usage:
 *   node scripts/pack.mjs          # package only (assumes dist/ exists)
 *   npm run pack:all               # build + package
 */
import { readFile, readdir, mkdir, cp, writeFile, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const booksDir = path.resolve(packRoot, "../../../books/fascinating-curiosities")
const dataDir = path.join(packRoot, "data")

async function scanBooks() {
  const books = []
  let entries
  try {
    entries = await readdir(booksDir)
  } catch {
    console.error(`Books directory not found: ${booksDir}`)
    process.exit(1)
  }

  for (const dirName of entries.sort()) {
    const packDir = path.join(booksDir, dirName, "pack")
    const manifestFile = path.join(packDir, "manifest.json")
    if (!existsSync(manifestFile)) continue

    let manifest
    try {
      manifest = JSON.parse(await readFile(manifestFile, "utf8"))
    } catch {
      continue
    }
    if (!manifest.id) continue

    // Detect available languages from audio_manifest_*.json files
    const languages = []
    try {
      for (const file of await readdir(packDir)) {
        const match = file.match(/^audio_manifest_(\w+)\.json$/)
        if (match) languages.push(match[1])
      }
    } catch { /* ignore */ }

    // Only include books that have segments + audio
    const hasSegments = existsSync(path.join(packDir, "segments.json"))
    if (!hasSegments || languages.length === 0) {
      console.log(`  skip ${dirName} (no segments/audio)`)
      continue
    }

    books.push({
      dirName,
      packDir,
      id: manifest.id,
      name: manifest.name || dirName,
      volume: manifest.metadata?.volume ?? 0,
      series: manifest.metadata?.series || "",
      languages,
    })
  }

  return books
}

async function copyBookData(book) {
  const destDir = path.join(dataDir, "books", book.id)
  await mkdir(path.join(destDir, "audio"), { recursive: true })

  // Copy English segments (always present)
  await cp(
    path.join(book.packDir, "segments.json"),
    path.join(destDir, "segments.json"),
  )

  for (const lang of book.languages) {
    // Copy translated segments if they exist
    const segFile = `segments_${lang}.json`
    const segPath = path.join(book.packDir, segFile)
    if (existsSync(segPath)) {
      await cp(segPath, path.join(destDir, segFile))
    }

    // Copy audio manifest
    const manifestFile = `audio_manifest_${lang}.json`
    await cp(
      path.join(book.packDir, manifestFile),
      path.join(destDir, manifestFile),
    )

    // Copy audio directory
    const audioSrc = path.join(book.packDir, "audio", lang)
    if (existsSync(audioSrc)) {
      await cp(audioSrc, path.join(destDir, "audio", lang), { recursive: true })
    }
  }

  return {
    id: book.id,
    name: book.name,
    volume: book.volume,
    series: book.series,
    hasAudio: true,
    availableLanguages: book.languages,
  }
}

async function main() {
  console.log("Scanning books...")
  const books = await scanBooks()

  if (books.length === 0) {
    console.error("No books with segments + audio found.")
    process.exit(1)
  }

  console.log(`Found ${books.length} book(s) with audio:`)
  for (const b of books) {
    console.log(`  ${b.id}: ${b.name} [${b.languages.join(", ")}]`)
  }

  // Verify dist/ exists
  if (!existsSync(path.join(packRoot, "dist", "app.js"))) {
    console.error("dist/app.js not found. Run 'npm run build' first.")
    process.exit(1)
  }

  // Clean previous data dir
  if (existsSync(dataDir)) {
    await rm(dataDir, { recursive: true })
  }

  // Copy book data
  console.log("\nCopying book data...")
  const catalog = []
  for (const book of books) {
    console.log(`  ${book.id}...`)
    const entry = await copyBookData(book)
    catalog.push(entry)
  }

  // Write catalog
  await writeFile(
    path.join(dataDir, "catalog.json"),
    JSON.stringify(catalog, null, 2) + "\n",
  )
  console.log(`\nWrote catalog.json with ${catalog.length} book(s)`)

  // Clean previous zip
  const zipPath = path.join(packRoot, "earthgate-reader.zip")
  if (existsSync(zipPath)) {
    await rm(zipPath)
  }

  // Create zip
  console.log("Creating earthgate-reader.zip...")
  execSync("zip -r earthgate-reader.zip manifest.json dist/ data/", {
    cwd: packRoot,
    stdio: "inherit",
  })

  console.log("\nDone! earthgate-reader.zip is ready.")
}

main()
