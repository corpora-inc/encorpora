// Emit per-language review inputs for the 24 NEW languages:
// scripts/i18n/review-input/<lang>.json = { "<English source>": "<current translation>" }
// Reviewers read these, judge quality, and write corrections to parts/rev-<lang>.json.
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { NEW } from "./langs.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sources = JSON.parse(await readFile(path.join(__dirname, "sources.json"), "utf8"))
const tr = JSON.parse(await readFile(path.join(__dirname, "translations.json"), "utf8"))

const outDir = path.join(__dirname, "review-input")
await mkdir(outDir, { recursive: true })

for (const lang of NEW) {
  const obj = {}
  for (const en of sources) obj[en] = tr[en]?.[lang] ?? ""
  await writeFile(path.join(outDir, `${lang}.json`), JSON.stringify(obj, null, 2) + "\n")
}
console.log(`Wrote ${NEW.length} review-input files for: ${NEW.join(", ")}`)
