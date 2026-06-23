/**
 * Bootstrap Tutomaton's language corpora locally.
 *
 *   - Spanish sqlite (~157 MB) — fetched from the published CDN module ZIP.
 *   - Mandarin sqlite (~130 KB) — rebuilt from the committed build_corpus.py.
 *
 * The .sqlite3 files are .gitignored (too large / regenerable). This script
 * gets them onto disk so `dev:corpan` can serve them via the corpan-app dev
 * server.
 *
 * Run from packs/tutomaton/:
 *     npm run bootstrap
 */
import { execSync, spawnSync } from "node:child_process"
import { mkdirSync, existsSync, createWriteStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")

const CDN = "https://d38iwc9748jekz.cloudfront.net/corpan/tutomaton-languages"

const LANGS = [
  {
    code: "es",
    url: `${CDN}/es-0.1.0.zip`,
    expectMb: 41,
    extractTo: "languages/es",
    finalFile: "languages/es/data/spanish.sqlite3",
    method: "download",
  },
  {
    code: "zh",
    extractTo: "languages/zh",
    finalFile: "languages/zh/data/mandarin.sqlite3",
    method: "rebuild",
    rebuildCmd: "python3 languages/zh/build_corpus.py",
  },
  {
    code: "en",
    extractTo: "languages/en",
    finalFile: "languages/en/data/english.sqlite3",
    method: "rebuild",
    rebuildCmd: "python3 languages/en/build_corpus.py",
  },
  {
    code: "fr",
    extractTo: "languages/fr",
    finalFile: "languages/fr/data/fr.sqlite3",
    method: "rebuild",
    rebuildCmd: "python3 languages/fr/build_corpus.py",
  },
  {
    code: "de",
    extractTo: "languages/de",
    finalFile: "languages/de/data/de.sqlite3",
    method: "rebuild",
    rebuildCmd: "python3 languages/de/build_corpus.py",
  },
  {
    code: "ja",
    extractTo: "languages/ja",
    finalFile: "languages/ja/data/ja.sqlite3",
    method: "rebuild",
    rebuildCmd: "python3 languages/ja/build_corpus.py",
  },
]

async function fetchAndExtract(lang) {
  const tmpZip = `/tmp/tutomaton-${lang.code}.zip`
  console.log(`[bootstrap] downloading ${lang.url} → ${tmpZip}`)
  execSync(`curl -fL --progress-bar "${lang.url}" -o "${tmpZip}"`, { stdio: "inherit", cwd: packRoot })
  const sz = (await stat(tmpZip)).size
  console.log(`[bootstrap]   ${(sz / 1024 / 1024).toFixed(1)} MB downloaded`)
  console.log(`[bootstrap] extracting → ${lang.extractTo}`)
  execSync(`mkdir -p "${lang.extractTo}" && unzip -o -q "${tmpZip}" -d "${lang.extractTo}"`, {
    stdio: "inherit",
    cwd: packRoot,
  })
}

async function rebuild(lang) {
  console.log(`[bootstrap] rebuilding ${lang.code} via: ${lang.rebuildCmd}`)
  const [cmd, ...args] = lang.rebuildCmd.split(" ")
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: packRoot })
  if (result.status !== 0) {
    throw new Error(`rebuild failed (exit ${result.status})`)
  }
}

async function main() {
  for (const lang of LANGS) {
    const target = path.join(packRoot, lang.finalFile)
    if (existsSync(target)) {
      const sz = (await stat(target)).size
      console.log(`[bootstrap] ${lang.code} ✓ already present (${(sz / 1024 / 1024).toFixed(1)} MB)`)
      continue
    }
    if (lang.method === "download") {
      await fetchAndExtract(lang)
    } else if (lang.method === "rebuild") {
      await rebuild(lang)
    }
    if (!existsSync(target)) {
      throw new Error(`bootstrap finished but ${target} is missing`)
    }
    console.log(`[bootstrap] ${lang.code} ✓ ready`)
  }
  console.log("[bootstrap] all languages ready.")
}

main().catch((err) => {
  console.error("[bootstrap] FAILED:", err.message)
  process.exit(1)
})
