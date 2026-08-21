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
 * All 53 published (native→en) pairs share one id scheme; `packIdForNative`
 * centralizes it so every discovery surface (Phrase Flip popover, Settings,
 * Journey auto-provision) resolves the same canonical id.
 */
import { invoke } from "@tauri-apps/api/core"

/**
 * The 53 native languages with a PUBLISHED (native→en) word-explanation pair
 * (verified against the live index.json, 2026-07). English natives have no
 * pack (they'd be explaining en words in en); everyone else has exactly one.
 *
 * Codes are the corpus's own BCP-47-ish forms and are kept verbatim — the
 * region/script/variant subtags are load-bearing (`pt-BR` ≠ `pt-PT`,
 * `zh-Hans` ≠ `zh-Hant`, `pa-Arab` ≠ `pa-Guru`, `ko-polite`, `yue-Hant-HK`).
 */
export const WORD_PACK_NATIVE_LANGS = new Set<string>([
  "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fr",
  "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "jv", "kn", "ko-polite",
  "lt", "mr", "ms", "ne", "nl", "no", "pa-Arab", "pa-Guru", "pl", "pt-BR",
  "pt-PT", "ro", "ru", "sk", "sl", "sr", "su", "sv", "sw", "ta", "te", "th",
  "tl", "tr", "uk", "ur", "vi", "yue-Hant-HK", "zh-Hans", "zh-Hant",
])

/**
 * Bases that have NO bare pack because they publish only region/script/variant
 * flavors. A learner whose native code is just the base (`pt`, `zh`, `pa`,
 * `ko`, `yue`) still deserves a pack — pick the most widely useful variant.
 */
const WORD_PACK_BASE_DEFAULT: Record<string, string> = {
  pt: "pt-BR",
  zh: "zh-Hans",
  pa: "pa-Guru",
  ko: "ko-polite",
  yue: "yue-Hant-HK",
}

export type WordExplanation = {
  paragraph: string
  /** The language the paragraph is actually in (native or the "en" fallback). */
  languageCode: string
}

/** Canonical id for a published native code: hyphens→underscores, `_en` suffix.
 *  `pt-BR` → `wordpan_pt_BR_en`, `zh-Hans` → `wordpan_zh_Hans_en`. Subtag CASE
 *  is preserved to match the live index ids exactly. */
function toWordPackId(nativeCode: string): string {
  return `wordpan_${nativeCode.replace(/-/g, "_")}_en`
}

/**
 * Resolve the data-pack id for a given native language, across all 53 published
 * pairs. Resolution order:
 *   1. EXACT published code       — `pt-BR` → `wordpan_pt_BR_en`
 *   2. EXACT published BASE subtag — `es-MX` → `es` → `wordpan_es_en`
 *   3. Region-only base default    — `pt`    → `pt-BR` → `wordpan_pt_BR_en`
 * Returns null when no pair is published for the native (e.g. `en`), so the
 * feature is a clean no-op for that reader.
 *
 * The id uses UNDERSCORES because the generic content-pack installer derives a
 * pack id from its ZIP filename and maps hyphens→underscores for non-`phrase-`
 * packs (see `contentPacks/install.ts` + `.github/scripts/pack_catalog_check.js`).
 * Keeping the id in that canonical form means the pack installs correctly via
 * BOTH the explicit-packId path and the generic catalog path.
 */
export function packIdForNative(nativeLang: string): string | null {
  const code = (nativeLang || "").trim()
  if (!code) return null
  // 1. Exact published code (handles region/script/variant packs directly).
  if (WORD_PACK_NATIVE_LANGS.has(code)) return toWordPackId(code)
  // 2. Base subtag when the base itself is published (es-MX → es).
  const base = code.split("-")[0]
  if (WORD_PACK_NATIVE_LANGS.has(base)) return toWordPackId(base)
  // 3. A base whose only packs are regional flavors (pt → pt-BR).
  const fallback = WORD_PACK_BASE_DEFAULT[base]
  if (fallback) return toWordPackId(fallback)
  return null
}

/** Base subtag of a BCP-47-ish code: "pt-BR" → "pt". */
function baseOf(code: string): string {
  return (code || "").split("-")[0]
}

/** Ordered id-fragment forms for one language code, most-specific first: the
 *  exact code, then its base subtag, then a region-only base default
 *  (`pt` → `pt-BR`). Case is preserved so ids match the index verbatim. */
function langForms(code: string): string[] {
  const c = (code || "").trim()
  if (!c) return []
  const forms = [c]
  const base = baseOf(c)
  if (base && base !== c) forms.push(base)
  const def = WORD_PACK_BASE_DEFAULT[base]
  if (def && !forms.includes(def)) forms.push(def)
  return forms
}

/**
 * GENERIC (native→target) pair pack id. The pair mechanism is built for
 * ARBITRARY pairs — the fleet ultimately wants 54×53. Today only `*_en`
 * targets are PUBLISHED, but nothing here assumes that: this is pure id
 * derivation; AVAILABILITY is a separate index lookup (see
 * `findWordPackForPair` / `matchWordPackOffer`). Returns
 * `wordpan_<native>_<target>` (hyphens→underscores, case preserved), or null
 * for an empty or degenerate (same-language) pair.
 */
export function wordPackIdForPair(
  nativeLang: string,
  targetLang: string,
): string | null {
  const n = (nativeLang || "").trim()
  const t = (targetLang || "").trim()
  if (!n || !t) return null
  if (baseOf(n) === baseOf(t)) return null
  return `wordpan_${n.replace(/-/g, "_")}_${t.replace(/-/g, "_")}`
}

/**
 * Every plausible on-disk id for a (native→target) pair, most-specific first —
 * the exact pair, then base-subtag fallbacks on either side, then region-only
 * base defaults. Lets a caller probe disk truth WITHOUT the catalog (offline
 * seed): the first installed id is the pair's pack. Fully generic over target.
 */
export function wordPackIdCandidates(
  nativeLang: string,
  targetLang: string,
): string[] {
  const natives = langForms(nativeLang)
  const targets = langForms(targetLang)
  const ids: string[] = []
  for (const nf of natives) {
    for (const tf of targets) {
      if (baseOf(nf) === baseOf(tf)) continue
      const id = `wordpan_${nf.replace(/-/g, "_")}_${tf.replace(/-/g, "_")}`
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

/**
 * Dev-only fallback download URL for a word pack. In production word packs are
 * NOT served from encorpora.io / the main catalog — they live on the dedicated
 * S3/CloudFront word-pack index and are installed via the resolved `zipUrl`
 * from that index (see `installWordPack(packId, zipUrl)` and
 * `contentPacks/wordPackCatalog.ts`). This helper only exists for `npm run
 * dev`, where the vite `/packs` middleware serves the in-repo zip and there is
 * no S3.
 *
 * The ZIP FILENAME is hyphenated (`wordpan-es-en.zip`); the underscore pack id
 * maps back to that stem here.
 */
export function devDownloadUrlForPack(packId: string): string {
  const zipStem = packId.replace(/_/g, "-")
  // Dev: vite serves `corpan/packs/<dir>/...` at `/packs/...`.
  // The wordpan zip is built into `corpan/packs/wordpan/wordpan-es-en.zip`.
  return `/packs/wordpan/${zipStem}.zip`
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

/**
 * Install a word pack. The `zipUrl` is the S3/CloudFront download target
 * resolved from the word-pack index (`wordPackCatalog.ts`) — word packs ship
 * SEPARATELY from the main catalog, so the URL always comes from the index,
 * never from `web/data/packs.json`. When `zipUrl` is omitted (the dev-server
 * path, where there is no index) we fall back to the vite-served in-repo zip.
 *
 * We pass an EXPLICIT `packId` to `content_packs_install_from_url` so the
 * installer does NOT derive the id from the (version-suffixed) S3 filename
 * (`wordpan-es-en-0.1.0.zip` would otherwise mis-derive `wordpan_es_en_0_1_0`).
 */
export async function installWordPack(
  packId: string,
  zipUrl?: string,
  expectedSha256?: string | null,
): Promise<void> {
  const downloadUrl =
    zipUrl ?? (import.meta.env.DEV ? devDownloadUrlForPack(packId) : "")
  if (!downloadUrl) {
    throw new Error(
      `[wordPack] no download URL for ${packId} — the word-pack index must provide a zipUrl`,
    )
  }
  await invoke("content_packs_install_from_url", {
    packId,
    downloadUrl,
    expectedSha256: expectedSha256 ?? null,
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
