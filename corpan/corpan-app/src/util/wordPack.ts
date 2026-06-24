/**
 * Word-explanation pack access for the Phrase Flip long-press popover.
 *
 * The word pack (`wordpan_es_en`) is a DATA-ONLY content pack: it ships a
 * SQLite DB with `word_explanation(word, language_code, paragraph)` and no
 * launchable experience. The host queries it exactly the way Hanzipan queries
 * its `hanzi_etymology` table — via the `content_packs_query_db` Tauri command
 * (see `corpan/packs/hanzipan/src/main.js`). The install/lookup plumbing is the
 * same `content_packs_*` surface used everywhere else (`contentPacks/native.ts`).
 *
 * For the first ship only the es→en pair exists. `packIdForNative` centralizes
 * the id scheme so adding more native languages later is a one-liner.
 */
import { invoke } from "@tauri-apps/api/core"

/** Languages the shipped word pack covers (native side + the always-present en). */
export const WORD_PACK_NATIVE_LANGS = new Set(["es"])

export type WordExplanation = {
  paragraph: string
  /** The language the paragraph is actually in (native or the "en" fallback). */
  languageCode: string
}

/**
 * Resolve the data-pack id for a given native language. es → "wordpan_es_en".
 *
 * The id uses UNDERSCORES because the generic content-pack installer derives a
 * pack id from its ZIP filename and maps hyphens→underscores for non-`phrase-`
 * packs (see `contentPacks/install.ts` + `.github/scripts/pack_catalog_check.js`).
 * Keeping the id in that canonical form means the pack installs correctly via
 * BOTH the explicit-packId path (this popover) and the generic catalog path.
 */
export function packIdForNative(nativeLang: string): string | null {
  const base = (nativeLang || "").split("-")[0]
  if (WORD_PACK_NATIVE_LANGS.has(base)) return `wordpan_${base}_en`
  return null
}

/**
 * The download URL for a word pack. In dev the vite `/packs` middleware serves
 * the in-repo zip; in production it lives next to `hanzipan.zip` on the CDN.
 * The ZIP FILENAME is hyphenated (`wordpan-es-en.zip`) — the installer derives
 * the underscore id from it — so we translate the underscore pack id back to
 * the hyphenated zip stem here.
 */
export function downloadUrlForPack(packId: string): string {
  const zipStem = packId.replace(/_/g, "-")
  // Dev: vite serves `corpan/packs/<dir>/...` at `/packs/...`.
  // The wordpan zip is built into `corpan/packs/wordpan/wordpan-es-en.zip`.
  if (import.meta.env.DEV) return `/packs/wordpan/${zipStem}.zip`
  return `https://encorpora.io/corpan/packs/${zipStem}.zip`
}

/** True when the pack is installed on disk (manifest resolvable). */
export async function isWordPackInstalled(packId: string): Promise<boolean> {
  try {
    await invoke("content_packs_get_manifest_url", { packId })
    return true
  } catch {
    return false
  }
}

export async function installWordPack(packId: string): Promise<void> {
  await invoke("content_packs_install_from_url", {
    packId,
    downloadUrl: downloadUrlForPack(packId),
    expectedSha256: null,
  })
}

type QueryResult = {
  columns: string[]
  rows: Array<Record<string, unknown>>
}

/**
 * Pure native-first / English-fallback selector — the same logic Hanzipan uses
 * for `hanzi_etymology`. `byLang` maps language_code → paragraph; `preferred` is
 * the stack's language list (native first). English is always the final
 * fallback. Returns null only when `byLang` is empty.
 *
 * Exported (and unit-tested) so the selection contract can't silently drift.
 */
export function selectPreferred(
  byLang: Map<string, string>,
  preferred: string[],
): WordExplanation | null {
  if (byLang.size === 0) return null
  const seen = new Set<string>()
  const order = [...preferred, "en"].filter((l) => {
    if (!l || seen.has(l)) return false
    seen.add(l)
    return true
  })
  for (const lang of order) {
    const paragraph = byLang.get(lang)
    if (paragraph) return { paragraph, languageCode: lang }
  }
  // Last resort: any paragraph (keeps the popover useful for odd configs).
  const [languageCode, paragraph] = byLang.entries().next().value as [string, string]
  return { paragraph, languageCode }
}

/**
 * Look up a word's explanation, native-first with English fallback — the exact
 * selection logic Hanzipan uses for `hanzi_etymology`:
 *   preferred = [...stack languages, "en"]; first matching language wins.
 *
 * `preferredLangs` should be the stack's language list (store order, native
 * first). Returns null when the word isn't in the pack at all.
 */
export async function lookupWord(
  packId: string,
  word: string,
  preferredLangs: string[],
): Promise<WordExplanation | null> {
  let result: QueryResult
  try {
    result = await invoke<QueryResult>("content_packs_query_db", {
      packId,
      dbName: "main",
      sql: "SELECT language_code, paragraph FROM word_explanation WHERE word = ?",
      params: [word],
      maxRows: 16,
    })
  } catch {
    return null
  }

  const rows = (result?.rows ?? []) as Array<{
    language_code?: unknown
    paragraph?: unknown
  }>
  if (!rows.length) return null

  const byLang = new Map<string, string>()
  for (const r of rows) {
    if (typeof r.language_code === "string" && typeof r.paragraph === "string") {
      byLang.set(r.language_code, r.paragraph)
    }
  }
  return selectPreferred(byLang, preferredLangs)
}
