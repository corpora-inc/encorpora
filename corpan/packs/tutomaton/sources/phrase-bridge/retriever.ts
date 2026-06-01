/**
 * Tutomaton phrase-pack bridge — `tutomaton-phrase-bridge-v1` (bundled in).
 *
 * Universal source per RAG_SOURCES_CONTRACT.md §7: serves EVERY target language
 * by adapting the user's already-installed Corpán phrase packs (~20K phrases ×
 * full ~50-language translation matrix per pack) into per-turn grounding.
 *
 * Contract role:
 *   - authoritative: false (per §7: universal sources MUST be non-authoritative)
 *   - priority: 20 (below per-language `core` priority 100; canonical wins, this rides shotgun)
 *   - requiredHostApis: phrasePacks + queryPackDb
 *
 * Output framing (per §8): the reference markdown is "inspiration" — real
 * phrase-to-target alignments. NOT "the answer." The registry wraps the result
 * in `<reference type="inspiration" from="Phrase library bridge">` and the
 * per-language grounding_instruction teaches the model to riff, not parrot.
 *
 * Signature: pattern A. The registry passes `helpers` as a 3rd argument only
 * for universal sources whose retriever needs cross-pack access. Standard
 * per-language retrievers ignore it. Helper-less invocation → kind:"none".
 */

import type { QueryFn, SourceRetrievalResult, RetrieverHelpers } from "../../src/languageManager"

// Phrase pack sqlite schema (tools/phrase-packs/build_phrase_pack.py):
//   entries(id, english, level)
//   translations(entry_id, language_code, text, romanization)  -- (entry_id, language_code) PK
//   entries_fts(english) -- FTS5 virtual, rowid = entries.id, BM25 ranked (v0.3.0+)
//
// v0.3.0+ packs ship with entries_fts; older v1 packs don't. Try FTS5 first,
// fall back to LIKE matching on any error (the bridge survives mixed-vintage
// installs without an explicit version probe).
const PHRASE_DB_NAME = "data" // phrase packs ship sqlite as data.sqlite3, registered as "data"
const MIN_TOKEN_LEN = 3
const MAX_PER_PACK = 3
const MAX_TOTAL = 6
// Tokens that look word-like but are FTS5 reserved (operators). The tokenize
// step also quotes each surviving token so this is belt-and-suspenders.
const FTS_RESERVED = new Set(["and", "or", "not", "near"])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN && !FTS_RESERVED.has(t))
}

function ftsMatchExpr(tokens: string[]): string {
  // Quote each token to bypass FTS5 operator parsing entirely, then AND them.
  // Doubling internal quotes per SQLite literal-quoting rules.
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(" AND ")
}

type Hit = {
  english: string
  target: string
  romanization: string | null
  packId: string
  packName: string
  packTopic: string | null
  score: number  // lower = better (BM25 from FTS5); LIKE-path hits get a flat score
}

async function fts5Query(
  helpers: RetrieverHelpers,
  packId: string,
  matchExpr: string,
): Promise<Hit[]> {
  const r = await helpers.hostApi.queryPackDb!({
    packId,
    dbName: PHRASE_DB_NAME,
    sql:
      "SELECT e.english, t.text AS target, t.romanization, bm25(entries_fts) AS score " +
      "FROM entries_fts " +
      "JOIN entries e ON e.id = entries_fts.rowid " +
      "JOIN translations t ON t.entry_id = e.id " +
      "WHERE t.language_code = ? AND entries_fts MATCH ? " +
      "ORDER BY score ASC " +
      `LIMIT ${MAX_PER_PACK}`,
    params: [helpers.targetLanguage, matchExpr],
  })
  return r.rows.map((row) => ({
    english: String(row.english),
    target: String(row.target),
    romanization: (row.romanization as string | null) ?? null,
    packId,
    packName: "",
    packTopic: null,
    score: Number(row.score ?? 0),
  }))
}

async function likeQuery(
  helpers: RetrieverHelpers,
  packId: string,
  tokens: string[],
): Promise<Hit[]> {
  const whereClause = tokens.map(() => "english LIKE ?").join(" AND ")
  const likeParams = tokens.map((t) => `%${t}%`)
  const r = await helpers.hostApi.queryPackDb!({
    packId,
    dbName: PHRASE_DB_NAME,
    sql:
      "SELECT e.english, t.text AS target, t.romanization " +
      "FROM entries e " +
      "JOIN translations t ON t.entry_id = e.id " +
      "WHERE t.language_code = ? AND " + whereClause + " " +
      `LIMIT ${MAX_PER_PACK}`,
    params: [helpers.targetLanguage, ...likeParams],
  })
  return r.rows.map((row) => ({
    english: String(row.english),
    target: String(row.target),
    romanization: (row.romanization as string | null) ?? null,
    packId,
    packName: "",
    packTopic: null,
    score: 1.0, // LIKE has no ranking signal; flat
  }))
}

export async function retrieve(
  text: string,
  _queryFn: QueryFn,
  helpers?: RetrieverHelpers,
): Promise<SourceRetrievalResult> {
  const log: string[] = []

  if (!helpers) {
    return { kind: "none", reference: null, log: ["bridge: registry passed no helpers (pattern A not wired)"] }
  }
  if (!helpers.hostApi?.phrasePacks?.getInstalled || !helpers.hostApi?.queryPackDb) {
    return { kind: "none", reference: null, log: ["bridge: required hostApi capabilities missing"] }
  }

  const installed = helpers.hostApi.phrasePacks.getInstalled()
  const packIds = Object.keys(installed)
  if (packIds.length === 0) {
    return { kind: "none", reference: null, log: ["bridge: no phrase packs installed"] }
  }

  const tokens = tokenize(text)
  if (tokens.length === 0) {
    return { kind: "none", reference: null, log: ["bridge: query yields no usable tokens"] }
  }
  const matchExpr = ftsMatchExpr(tokens)

  const hits: Hit[] = []
  let ftsCount = 0
  let likeCount = 0

  for (const packId of packIds) {
    const pack = installed[packId]
    try {
      const r = await fts5Query(helpers, packId, matchExpr)
      ftsCount += 1
      for (const h of r) {
        h.packName = pack.name
        h.packTopic = (pack.topic as string | undefined) ?? null
        hits.push(h)
      }
    } catch (e) {
      // Older pack without FTS5, or query error — fall back to LIKE for this pack only.
      try {
        const r = await likeQuery(helpers, packId, tokens)
        likeCount += 1
        for (const h of r) {
          h.packName = pack.name
          h.packTopic = (pack.topic as string | undefined) ?? null
          hits.push(h)
        }
      } catch (e2) {
        log.push(`bridge: queries failed for pack ${packId}: fts=${String(e)} like=${String(e2)}`)
      }
    }
  }

  if (hits.length === 0) {
    return {
      kind: "none",
      reference: null,
      log: [...log, `bridge: no matches across ${packIds.length} packs (fts=${ftsCount} like=${likeCount})`],
    }
  }

  // Rank: FTS5 BM25 (lower = better) wins; LIKE-path flat-1.0 hits come last.
  hits.sort((a, b) => a.score - b.score)

  // De-dup by english source text (same phrase may exist in multiple packs).
  const seen = new Set<string>()
  const unique: Hit[] = []
  for (const h of hits) {
    const key = h.english.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(h)
    if (unique.length >= MAX_TOTAL) break
  }

  const lines: string[] = []
  lines.push("## Examples from your phrase library")
  lines.push("")
  lines.push(
    "Here are real phrase-to-target alignments from packs already on the device. " +
    "Use them as inspiration; tailor your reply to what the user actually asked. " +
    "These are evidence, not gospel — your composed answer can ignore, riff on, or refine them.",
  )
  lines.push("")
  for (const h of unique) {
    const rom = h.romanization ? ` *(${h.romanization})*` : ""
    const topic = h.packTopic ? ` *(from "${h.packTopic}")*` : ""
    lines.push(`- *"${h.english}"* → **${h.target}**${rom}${topic}`)
  }

  // Score returned to the merge: best BM25 normalised to (0,1] (smaller is better → higher score)
  const bestBm25 = unique[0]?.score ?? 1.0
  const score = bestBm25 > 0 ? Math.min(1, 1 / (1 + bestBm25)) : 0.5

  return {
    kind: "translation",
    reference: lines.join("\n"),
    score,
    log: [...log, `bridge: ${unique.length} matches across ${packIds.length} packs (fts=${ftsCount} like=${likeCount})`],
  }
}

/** Bridge does not own themes; theme bypass belongs to the per-language `core`. */
export async function resolveTheme(
  _themeKey: string,
  _queryFn: QueryFn,
): Promise<string | null> {
  return null
}
