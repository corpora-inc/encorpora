// Final structural validator on the regenerated npcCorpus.ts.
// Asserts every MultiLangText field has EXACTLY the 51 canonical language keys,
// all non-empty strings. Run after apply.mjs and in CI-style checks.
import { loadCorpus } from "./loadCorpus.mjs"
import { CANONICAL_ORDER } from "./langs.mjs"

const corpus = await loadCorpus()
const expected = new Set(CANONICAL_ORDER)

let fields = 0
let bad = 0

const checkField = (mlt, where) => {
  fields += 1
  const keys = Object.keys(mlt)
  const keySet = new Set(keys)
  const missing = CANONICAL_ORDER.filter((l) => !keySet.has(l))
  const extra = keys.filter((k) => !expected.has(k))
  const empty = keys.filter(
    (k) => typeof mlt[k] !== "string" || mlt[k].trim() === ""
  )
  if (missing.length || extra.length || empty.length) {
    bad += 1
    if (missing.length) console.log(`${where}: MISSING ${missing.join(",")}`)
    if (extra.length) console.log(`${where}: EXTRA ${extra.join(",")}`)
    if (empty.length) console.log(`${where}: EMPTY ${empty.join(",")}`)
  }
}

for (const enc of corpus) {
  checkField(enc.offering, `${enc.id}.offering`)
  enc.responses.forEach((r, i) =>
    checkField(r.text, `${enc.id}.responses[${i}](${r.type})`)
  )
}

console.log(`encounters: ${corpus.length}, fields: ${fields}, languages/field: ${CANONICAL_ORDER.length}`)
if (bad > 0) {
  console.error(`FAIL: ${bad} field(s) with problems`)
  process.exit(1)
}
console.log("OK: every field has all 51 languages, non-empty")
