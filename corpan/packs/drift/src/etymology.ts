/**
 * etymology.ts — read a word's ORIGIN/etymology from an installed word-explanation
 * pack, so a tap on a story word can reveal not just the meaning but where the
 * word came from (the CTO's "etymologies of all the words" ask).
 *
 * DOM-free + deterministic so it unit-tests headless (mirrors challenge.ts).
 *
 * WHAT DATA THIS READS
 * --------------------
 * The app publishes `wordpan_<native>_en` DATA packs: a SQLite table
 *   word_explanation(word TEXT, language_code TEXT, paragraph TEXT)
 * where `word` is an ENGLISH surface word and each ~50-word `paragraph` (in the
 * learner's language, English fallback) covers the word's senses, its ORIGIN,
 * and how the origin branched into the modern senses. This is the same table
 * Phrase Flip's long-press popover reads (see corpan-app/src/util/wordPack.ts).
 *
 * REACHABILITY (why this is capability-gated, not assumed)
 * --------------------------------------------------------
 * A pack reads another pack's DB through `hostApi.queryPackDb`
 * (host command `content_packs_query_db`). That seam EXISTS on real hosts but is
 * absent on the standalone mock and pre-DB hosts — so we feature-detect and
 * degrade to the plain gloss when it's missing.
 *
 * The word column keys on ENGLISH words, so a lookup only yields data when the
 * TAPPED word is itself English — i.e. the learner's TARGET language is English
 * (the large "learning English" audience, natives es/zh/ar/…). For a non-English
 * target (en→es) the tapped word is e.g. Spanish, which the English-keyed packs
 * don't carry, so lookup returns null and Drift shows the plain native gloss.
 * See DRIFT-0.3.0 report §etymology for the app-side seam that would generalize
 * this to every target language.
 */

import type { HostApi } from "./sdk/types"

/** Base subtag of a BCP-47-ish code: "en-GB" → "en", "zh-Hans" → "zh". */
export function baseSubtag(code: string): string {
  return (code.split("-")[0] || code).toLowerCase()
}

/** A word's revealed depth: its origin paragraph + the language it's written in. */
export type WordOrigin = {
  /** ~50-word origin/senses paragraph, in `lang`. */
  paragraph: string
  /** Language the paragraph is actually in (a native code, or "en" fallback). */
  lang: string
}

/**
 * Candidate `wordpan_<native>_en` pack ids for a native language, most-specific
 * first: the exact code, then its base subtag (es-MX → es). Underscores because
 * the content-pack installer derives ids from ZIP filenames (hyphens→underscores).
 * A minimal mirror of corpan-app/src/util/wordPack.ts#packIdForNative — Drift
 * probes these against disk truth (a query on an uninstalled pack simply
 * rejects), so it needs no bundled catalog of which pairs are published.
 */
export function wordPackIdCandidates(nativeLang: string): string[] {
  const code = (nativeLang || "").trim()
  if (!code) return []
  const ids: string[] = []
  const add = (c: string) => {
    if (!c || baseSubtag(c) === "en") return // en natives get no en-word pack
    const id = `wordpan_${c.replace(/-/g, "_")}_en`
    if (!ids.includes(id)) ids.push(id)
  }
  add(code)
  add(baseSubtag(code))
  return ids
}

/** Native-first / English-fallback pick from a language→paragraph map. */
export function selectPreferred(
  byLang: Map<string, string>,
  preferred: readonly string[],
): WordOrigin | null {
  if (byLang.size === 0) return null
  const seen = new Set<string>()
  const order = [...preferred, "en"].filter((l) => {
    if (!l || seen.has(l)) return false
    seen.add(l)
    return true
  })
  for (const lang of order) {
    const paragraph = byLang.get(lang)
    if (paragraph) return { paragraph, lang }
  }
  const first = byLang.entries().next().value as [string, string]
  return { paragraph: first[1], lang: first[0] }
}

/**
 * Resolver bound to one Drift mount: caches the pack id that answered (or a
 * negative flag when none is installed / the seam is absent) so we probe once,
 * then answer word taps from the resolved pack without re-scanning candidates.
 */
export class EtymologyResolver {
  private hostApi: HostApi
  /** [native, ...] preference order for paragraph language selection. */
  private preferred: string[]
  /** Candidate pack ids, or [] when etymology can't apply to this stack. */
  private candidates: string[]
  /** Resolved pack id once a query succeeds; "" once we know none applies. */
  private resolved: string | null = null

  constructor(
    hostApi: HostApi,
    langs: { targetLang: string; nativeLang: string | null },
  ) {
    this.hostApi = hostApi
    this.preferred = langs.nativeLang ? [langs.nativeLang] : []
    // The word packs key on ENGLISH words, so etymology only applies when the
    // tapped (target) word is English. Otherwise short-circuit to "no origin".
    const targetIsEnglish = baseSubtag(langs.targetLang) === "en"
    this.candidates =
      targetIsEnglish && typeof hostApi.queryPackDb === "function"
        ? wordPackIdCandidates(langs.nativeLang ?? "")
        : []
    if (this.candidates.length === 0) this.resolved = ""
  }

  /** True when an origin lookup could possibly resolve on this stack/host. */
  get enabled(): boolean {
    return this.resolved !== "" && this.candidates.length > 0
  }

  private async query(packId: string, word: string): Promise<WordOrigin | null> {
    const q = this.hostApi.queryPackDb
    if (!q) return null
    let res: { rows: Array<Record<string, unknown>> }
    try {
      res = await q({
        packId,
        dbName: "main",
        sql: "SELECT language_code, paragraph FROM word_explanation WHERE word = ?",
        params: [word],
        maxRows: 16,
      })
    } catch {
      return null // pack not installed / no such table on this host
    }
    const rows = res?.rows ?? []
    if (!rows.length) return null
    const byLang = new Map<string, string>()
    for (const r of rows) {
      const lc = r.language_code
      const p = r.paragraph
      if (typeof lc === "string" && typeof p === "string" && p.trim()) {
        byLang.set(lc, p)
      }
    }
    return selectPreferred(byLang, this.preferred)
  }

  /**
   * Look up a word's origin, or null when unavailable. Lowercases the word (the
   * table stores English words in lower case). Resolves the answering pack once.
   */
  async lookup(word: string): Promise<WordOrigin | null> {
    if (!this.enabled) return null
    const w = word.trim().toLocaleLowerCase()
    if (!w) return null
    if (this.resolved) return this.query(this.resolved, w)
    for (const id of this.candidates) {
      const hit = await this.query(id, w)
      if (hit) {
        this.resolved = id // this pair is installed — stop probing others
        return hit
      }
    }
    // No candidate answered. We can't tell "pack absent" from "word absent"
    // for a single word, so we DON'T latch negative here — a later, commoner
    // word may still resolve the pack. (Latching would blind common words if
    // the first tapped word happened to be missing.)
    return null
  }
}
