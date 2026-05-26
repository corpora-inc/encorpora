// Merge family-parts/*.json + the English baseline into src/data/familyLines.json,
// then assert every line covers all 51 canonical languages, non-empty.
import { readFile, writeFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { CANONICAL_ORDER } from "./langs.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(__dirname, "../../src/data/familyLines.json")
const partsDir = path.join(__dirname, "family-parts")

const merged = JSON.parse(await readFile(out, "utf8"))
const files = (await readdir(partsDir)).filter((f) => f.endsWith(".json")).sort()
for (const f of files) {
  const data = JSON.parse(await readFile(path.join(partsDir, f), "utf8"))
  for (const [src, byLang] of Object.entries(data)) {
    merged[src] = merged[src] || {}
    for (const [lang, text] of Object.entries(byLang)) merged[src][lang] = text
  }
}

const ordered = {}
for (const src of Object.keys(merged)) {
  const m = merged[src]
  const o = {}
  for (const l of CANONICAL_ORDER) if (m[l] !== undefined) o[l] = m[l]
  ordered[src] = o
}
await writeFile(out, JSON.stringify(ordered, null, 2) + "\n")

let bad = 0
for (const [src, m] of Object.entries(ordered)) {
  const missing = CANONICAL_ORDER.filter((l) => !m[l] || !String(m[l]).trim())
  if (missing.length) {
    bad++
    console.log(`"${src.slice(0, 40)}…" missing ${missing.length}: ${missing.join(",")}`)
  }
}
console.log(`lines: ${Object.keys(ordered).length}, langs/line target: ${CANONICAL_ORDER.length}`)
if (bad) {
  console.error(`FAIL: ${bad} line(s) incomplete`)
  process.exit(1)
}
console.log("OK: every family line has all 51 languages")
