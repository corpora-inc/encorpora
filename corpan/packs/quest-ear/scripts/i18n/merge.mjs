// Merge scripts/i18n/parts/*.json into a single translations.json.
// Each part is { "<en source>": { "<lang>": "<text>", ... }, ... }.
// Later parts override earlier ones per (source, lang). Reports duplicates.
import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const partsDir = path.join(__dirname, "parts")

const files = (await readdir(partsDir)).filter((f) => f.endsWith(".json")).sort()
const merged = {}
let conflicts = 0

for (const f of files) {
  const data = JSON.parse(await readFile(path.join(partsDir, f), "utf8"))
  for (const [src, byLang] of Object.entries(data)) {
    merged[src] = merged[src] || {}
    for (const [lang, text] of Object.entries(byLang)) {
      if (merged[src][lang] !== undefined && merged[src][lang] !== text) {
        conflicts += 1
        console.warn(`conflict: "${src}" [${lang}] "${merged[src][lang]}" -> "${text}" (${f})`)
      }
      merged[src][lang] = text
    }
  }
}

const sorted = {}
for (const k of Object.keys(merged).sort((a, b) => a.localeCompare(b))) {
  sorted[k] = merged[k]
}

await writeFile(
  path.join(__dirname, "translations.json"),
  JSON.stringify(sorted, null, 2) + "\n"
)
console.log(`Merged ${files.length} part(s) -> translations.json`)
console.log(`Source strings covered: ${Object.keys(sorted).length}`)
if (conflicts) console.log(`Conflicts: ${conflicts}`)
