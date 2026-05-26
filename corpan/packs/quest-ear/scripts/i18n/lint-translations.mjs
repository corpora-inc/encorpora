// Quality linter over the regenerated npcCorpus.ts (the shipped data).
// For every field × every one of the 51 languages it checks:
//   1. SCRIPT: value contains the script expected for that language, and
//      Latin-script languages contain no stray complex-script characters.
//   2. PUNCTUATION: question/exclamation sentence-type preserved vs English.
//   3. EN-LEAK: value identical to the English source.
//   4. DUP: per language, one translation reused for many distinct English
//      sources (possible copy/paste error).
// Prints a categorized report; exits non-zero if hard SCRIPT errors exist.
import { loadCorpus } from "./loadCorpus.mjs"
import { CANONICAL_ORDER, LANG_NAMES } from "./langs.mjs"

const BLOCK = {
  latin: /[A-Za-zÀ-ɏ]/,
  cyrillic: /[Ѐ-ӿ]/,
  greek: /[Ͱ-Ͽἀ-῿]/,
  hebrew: /[֐-׿]/,
  arabic: /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/,
  devanagari: /[ऀ-ॿ]/,
  bengali: /[ঀ-৿]/,
  gujarati: /[઀-૿]/,
  gurmukhi: /[਀-੿]/,
  kannada: /[ಀ-೿]/,
  telugu: /[ఀ-౿]/,
  tamil: /[஀-௿]/,
  thai: /[฀-๿]/,
  han: /[㐀-鿿豈-﫿]/,
  kana: /[぀-ヿ]/,
  hangul: /[가-힯ᄀ-ᇿ㄰-㆏]/,
}

const LATIN_LANGS = new Set([
  "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR", "de", "nl", "no", "sv",
  "da", "fi", "hu", "lt", "pl", "cs", "sk", "sl", "hr", "tr", "vi", "id", "ms", "sw",
])
// Required script block(s) for non-Latin languages.
const EXPECT = {
  sr: ["cyrillic"], bg: ["cyrillic"], uk: ["cyrillic"], ru: ["cyrillic"],
  el: ["greek"], he: ["hebrew"],
  ar: ["arabic"], fa: ["arabic"], ur: ["arabic"], "pa-Arab": ["arabic"],
  hi: ["devanagari"], mr: ["devanagari"], ne: ["devanagari"],
  bn: ["bengali"], gu: ["gujarati"], "pa-Guru": ["gurmukhi"],
  kn: ["kannada"], te: ["telugu"], ta: ["tamil"], th: ["thai"],
  "zh-Hans": ["han"], "zh-Hant": ["han"], "yue-Hant-HK": ["han"],
  ja: ["han", "kana"], "ko-polite": ["hangul"],
}
// Complex scripts that should NOT appear inside a Latin-script translation.
const FOREIGN_FOR_LATIN = [
  "cyrillic", "greek", "hebrew", "arabic", "devanagari", "bengali", "gujarati",
  "gurmukhi", "kannada", "telugu", "tamil", "thai", "han", "kana", "hangul",
]

const corpus = await loadCorpus()

const scriptErrors = []
const punctWarn = []
const enLeak = []
const dupByLang = new Map() // lang -> Map(value -> Set(enSources))

const endQ = /[?？؟;；]\s*$/
const endE = /[!！]\s*$/

const checkField = (mlt, where) => {
  const en = mlt.en
  for (const lang of CANONICAL_ORDER) {
    const v = mlt[lang]
    if (typeof v !== "string" || !v.trim()) {
      scriptErrors.push(`${where} [${lang}]: EMPTY`)
      continue
    }
    // script
    if (LATIN_LANGS.has(lang)) {
      const foreign = FOREIGN_FOR_LATIN.find((b) => BLOCK[b].test(v))
      if (foreign) scriptErrors.push(`${where} [${lang}]: contains ${foreign} script -> "${v}"`)
    } else if (EXPECT[lang]) {
      const ok = EXPECT[lang].some((b) => BLOCK[b].test(v))
      if (!ok) scriptErrors.push(`${where} [${lang}]: missing ${EXPECT[lang].join("/")} script -> "${v}"`)
    }
    // punctuation (skip 'en' itself)
    if (lang !== "en") {
      if (endQ.test(en) && !endQ.test(v)) punctWarn.push(`${where} [${lang}]: en is a question, tr not -> "${v}"`)
      if (endE.test(en) && !endE.test(v) && !endQ.test(v)) punctWarn.push(`${where} [${lang}]: en is exclamation, tr not -> "${v}"`)
      // en-leak
      if (v === en) enLeak.push(`${where} [${lang}]: == en "${en}"`)
      // dup tracking
      if (!dupByLang.has(lang)) dupByLang.set(lang, new Map())
      const m = dupByLang.get(lang)
      if (!m.has(v)) m.set(v, new Set())
      m.get(v).add(en)
    }
  }
}

for (const enc of corpus) {
  checkField(enc.offering, `${enc.id}.offering`)
  enc.responses.forEach((r, i) => checkField(r.text, `${enc.id}.r${i}(${r.type})`))
}

const show = (title, arr, cap = 60) => {
  console.log(`\n=== ${title}: ${arr.length} ===`)
  for (const line of arr.slice(0, cap)) console.log("  " + line)
  if (arr.length > cap) console.log(`  ... +${arr.length - cap} more`)
}

show("SCRIPT errors (hard)", scriptErrors)
show("EN-LEAK (verify cognate vs untranslated)", enLeak)
show("PUNCTUATION mismatches (soft)", punctWarn)

// Duplicate collisions: a translation reused across many distinct English sources.
const dupReport = []
for (const [lang, m] of dupByLang) {
  for (const [val, ens] of m) {
    if (ens.size >= 6) dupReport.push(`${lang}: "${val}" used for ${ens.size} distinct sources`)
  }
}
dupReport.sort()
show("DUP collisions (>=6 distinct sources; soft)", dupReport, 80)

console.log(`\nfields=${corpus.length * 4}, langs/field=${CANONICAL_ORDER.length}`)
console.log(`script=${scriptErrors.length} enleak=${enLeak.length} punct=${punctWarn.length} dup=${dupReport.length}`)
if (scriptErrors.length) {
  console.error("\nFAIL: hard script errors present")
  process.exit(1)
}
console.log("\nOK: no hard script errors")
