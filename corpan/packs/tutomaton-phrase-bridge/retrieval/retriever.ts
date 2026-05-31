/**
 * Tutomaton phrase-pack bridge — `tutomaton-phrase-bridge-v1`.
 *
 * Universal source per RAG_SOURCES_CONTRACT.md §7. Queries the user's installed
 * Corpán phrase packs (~20K phrases per pack × ~50 language translations each)
 * for token-LIKE matches on the English source text, then surfaces each match
 * along with the target-language translation.
 *
 * Contract role:
 *   - authoritative: false  (per §7: universal sources MUST be non-authoritative;
 *     cannot theme-bypass; contributes only as inspiration grounding)
 *   - priority: 20          (well below per-language `core` priority 100)
 *   - requiredHostApis: phrasePacks + queryPackDb
 *
 * Output framing (per §8): the reference markdown is "inspiration" — real
 * phrase-to-target alignments the LLM may riff on. NOT "the answer." The
 * grounding-instruction layer wraps this in <reference type="inspiration"
 * from="Phrase library bridge"> and the per-language grounding_instruction
 * teaches the model to treat it as material to compose around, not gospel.
 *
 * ============================================================================
 * RETRIEVER SIGNATURE — OPEN COORDINATION WITH FRONTEND AGENT
 * ============================================================================
 *
 * Contract §3 specifies `retrieve(text, queryFn)` where queryFn is scoped to
 * THIS source's `dbName`. The bridge violates that assumption: it has no
 * bundled sqlite (`files.database: ""`) and queries N installed phrase packs,
 * each with its own packId + dbName. It cannot use the scoped-to-one queryFn.
 *
 * Two viable patterns; frontend agent picks one:
 *
 *   (A) Optional third `helpers` parameter — registry detects the bridge case
 *       (via `requiredHostApis` set or `files.database === ""`) and passes
 *       `{ hostApi, targetLanguage }` as a third arg. Other retrievers ignore it.
 *
 *   (B) Multi-db queryFn variant — registry passes a queryFn whose signature
 *       is extended for bridge-style sources: `queryFn(sql, params, packId, dbName)`.
 *       Other retrievers continue calling 2-arg form; the registry routes.
 *
 * This implementation is written to **pattern (A)** because it's the smallest
 * delta on the existing contract and keeps the queryFn semantics clean for
 * standard retrievers. If frontend prefers (B), only the call sites change —
 * the matching + formatting logic is identical.
 *
 * If `helpers` is absent (e.g. registry hasn't wired pattern (A) yet), the
 * bridge gracefully returns kind="none" with a log breadcrumb. The Tutomaton
 * build doesn't break; the bridge just contributes nothing until wired.
 */

export type QueryFn = (
  sql: string,
  params: unknown[],
) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>

/**
 * Helpers passed by the registry for universal/bridge sources. Pattern (A).
 * Other retrievers receive `undefined` here and ignore it; standard retriever
 * contract is unchanged for them.
 */
export type BridgeHelpers = {
  /** Active Tutomaton target language code (e.g. "ar", "ja", "pt-BR"). */
  targetLanguage: string
  /** Host API surface. Bridge uses phrasePacks + queryPackDb. */
  hostApi: {
    phrasePacks?: {
      getInstalled: () => Record<string, { id: string; name: string; nameLocalized?: Record<string, string>; topic?: string }>
    }
    queryPackDb?: (args: {
      packId: string
      dbName: string
      sql: string
      params: unknown[]
    }) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>
  }
}

export type RetrievalResult = {
  kind: "translation" | "none"
  reference: string | null
  score?: number
  log: string[]
}

// Phrase pack sqlite schema (see tools/phrase-packs/build_phrase_pack.py):
//   entries(id, english, level)
//   translations(entry_id, language_code, text, romanization)  -- (entry_id, language_code) PK
// No FTS index. We use token-LIKE matching.

const PHRASE_DB_NAME = "data" // phrase packs ship their sqlite as data.sqlite3, registered as "data"
const MIN_TOKEN_LEN = 3
const MAX_PER_PACK = 3
const MAX_TOTAL = 6

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN)
}

export async function retrieve(
  text: string,
  _queryFn: QueryFn,
  helpers?: BridgeHelpers,
): Promise<RetrievalResult> {
  const log: string[] = []

  if (!helpers) {
    return { kind: "none", reference: null, log: ["bridge: no helpers passed; registry hasn't wired BridgeHelpers yet"] }
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
    return { kind: "none", reference: null, log: ["bridge: query too short to match"] }
  }

  // Build LIKE search: every token must appear in entries.english
  const whereClause = tokens.map(() => "english LIKE ?").join(" AND ")
  const likeParams = tokens.map((t) => `%${t}%`)

  type Hit = {
    english: string
    target: string
    romanization: string | null
    packId: string
    packName: string
    packTopic: string | null
  }
  const hits: Hit[] = []

  for (const packId of packIds) {
    try {
      const r = await helpers.hostApi.queryPackDb({
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
      const pack = installed[packId]
      for (const row of r.rows) {
        hits.push({
          english: row.english as string,
          target: row.target as string,
          romanization: (row.romanization as string | null) ?? null,
          packId,
          packName: pack.name,
          packTopic: (pack.topic as string | undefined) ?? null,
        })
      }
    } catch (e) {
      log.push(`bridge: query failed for pack ${packId}: ${String(e)}`)
      // Continue with other packs; one bad pack shouldn't kill the whole bridge.
    }
  }

  if (hits.length === 0) {
    return { kind: "none", reference: null, log: [...log, `bridge: no matches across ${packIds.length} packs`] }
  }

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

  // Compose the inspiration reference. Voice: "examples", not "the answer."
  const lines: string[] = []
  lines.push("## Examples from your phrase library")
  lines.push("")
  lines.push(
    "Here are real phrase-to-target alignments from packs you already have on your device. " +
    "Use these as inspiration; tailor your reply to what the user actually asked for. " +
    "These are evidence, not gospel — your composed answer can ignore, riff on, or refine them.",
  )
  lines.push("")
  for (const h of unique) {
    const rom = h.romanization ? ` *(${h.romanization})*` : ""
    const topic = h.packTopic ? ` *(from "${h.packTopic}")*` : ""
    lines.push(`- *"${h.english}"* → **${h.target}**${rom}${topic}`)
  }

  return {
    kind: "translation",
    reference: lines.join("\n"),
    score: 0.6,
    log: [...log, `bridge: ${unique.length} matches across ${packIds.length} packs`],
  }
}

/**
 * Bridge does not own canonical themes; theme bypass belongs to the
 * per-language authoritative `core` source (per contract §4). Always returns null.
 */
export async function resolveTheme(
  _themeKey: string,
  _queryFn: QueryFn,
  _helpers?: BridgeHelpers,
): Promise<string | null> {
  return null
}
