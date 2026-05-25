// Extract the corpus's unique English source strings + report current language
// coverage. Writes sources.json (the set of strings needing translation).
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadCorpus } from "./loadCorpus.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const corpus = await loadCorpus()

const sources = new Set()
const langCounts = new Map()
let fieldCount = 0

const tallyLangs = (mlt) => {
  fieldCount += 1
  for (const k of Object.keys(mlt)) {
    langCounts.set(k, (langCounts.get(k) || 0) + 1)
  }
}

for (const enc of corpus) {
  if (enc.offering?.en) sources.add(enc.offering.en)
  tallyLangs(enc.offering)
  for (const r of enc.responses) {
    if (r.text?.en) sources.add(r.text.en)
    tallyLangs(r.text)
  }
}

const sorted = [...sources].sort((a, b) => a.localeCompare(b))
await writeFile(
  path.join(__dirname, "sources.json"),
  JSON.stringify(sorted, null, 2) + "\n"
)

const langs = [...langCounts.entries()].sort()
console.log(`Encounters: ${corpus.length}`)
console.log(`MultiLangText fields: ${fieldCount}  (expect encounters * 4)`)
console.log(`Unique English source strings: ${sorted.length}`)
console.log(`Languages present (${langs.length}):`)
for (const [code, n] of langs) {
  const flag = n === fieldCount ? "" : `  <-- only ${n}/${fieldCount} fields!`
  console.log(`  ${code}: ${n}${flag}`)
}
