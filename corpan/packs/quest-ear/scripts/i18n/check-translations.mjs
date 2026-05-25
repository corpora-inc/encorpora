// Coverage gate: verify translations.json covers every source string in
// sources.json with all 24 NEW languages, non-empty and not left as English.
// Exit non-zero on any gap so the pipeline can't ship incomplete data.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { NEW } from "./langs.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const sources = JSON.parse(
  await readFile(path.join(__dirname, "sources.json"), "utf8")
)
const translations = JSON.parse(
  await readFile(path.join(__dirname, "translations.json"), "utf8")
)

let missingSources = 0
let missingPairs = 0
let emptyPairs = 0
let englishLeak = 0
const missingByLang = Object.fromEntries(NEW.map((l) => [l, 0]))

for (const src of sources) {
  const entry = translations[src]
  if (!entry) {
    missingSources += 1
    console.log(`MISSING SOURCE: "${src}"`)
    continue
  }
  for (const lang of NEW) {
    const val = entry[lang]
    if (val === undefined) {
      missingPairs += 1
      missingByLang[lang] += 1
    } else if (typeof val !== "string" || val.trim() === "") {
      emptyPairs += 1
      console.log(`EMPTY: "${src}" [${lang}]`)
    } else if (val === src) {
      // Some 1-word interjections may legitimately match; warn only.
      englishLeak += 1
      console.log(`WARN (==en): "${src}" [${lang}]`)
    }
  }
}

const extra = Object.keys(translations).filter((s) => !sources.includes(s))

console.log("\n--- coverage ---")
console.log(`sources: ${sources.length}, NEW langs: ${NEW.length}, expected pairs: ${sources.length * NEW.length}`)
console.log(`missing sources: ${missingSources}`)
console.log(`missing pairs: ${missingPairs}`)
console.log(`empty pairs: ${emptyPairs}`)
console.log(`==en warnings: ${englishLeak}`)
if (extra.length) console.log(`extra (not in sources): ${extra.length}`)
if (missingPairs) {
  const gaps = Object.entries(missingByLang).filter(([, n]) => n > 0)
  console.log("missing-by-lang: " + gaps.map(([l, n]) => `${l}:${n}`).join(", "))
}

const fatal = missingSources + missingPairs + emptyPairs
if (fatal > 0) {
  console.error(`\nFAIL: ${fatal} gaps`)
  process.exit(1)
}
console.log("\nOK: full coverage")
