// ============================================================
// Journey distractor sampler (content-resolver.md §4).
//
// Every wrong option a learner can tap comes from here. No renderer
// invents options. Deterministic under the seeded PRNG: same
// (cardId, pack content, recentKeys) ⇒ byte-identical DistractorSet
// (rung-3 random top-up excepted, §4.2).
// ============================================================

import {
  itemRefKey,
  type ItemRef,
  type ItemRefKind,
} from "../../contentPacks/activityContract.ts"
import type { EntryOut } from "../../contentPacks/types.ts"
import { tokenizePhrase } from "../../util/wordTokens.ts"
import { normalizeAnswer } from "./normalize.ts"
import { cardRng } from "./rng.ts"
import {
  sqlLimit,
  type DistractorCandidateRow,
  type ResolveContext,
  type ResolvedItem,
  type ResolvedText,
  type Resolver,
  type ResolverDeps,
} from "./resolve.ts"

// --------------------------------------------------------------------- API

export interface DistractorRequest {
  /** Seed source. Spec/card correlation id — deterministic per card (§4.5). */
  cardId: string
  /** The correct item (already resolved). */
  answer: ResolvedItem
  /** Language the distractor SURFACES in. ALWAYS the answer's language:
   *  direction 'toNative' ⇒ nativeLang, else targetLang. Never mixed. */
  answerLang: string
  /** Language of the prompt face, for the same-translation collision check. */
  promptLang?: string
  /** How many distractors (NOT counting the answer). */
  count: number
  /** Difficulty target — supplied by the engine in spec.params (engine §5.4);
   *  the sampler never computes θ. */
  targetB: number
  /** Pool strategy, from spec.params.distractors. */
  pool: "sameSkill" | "nearTheta"
  /** itemRefKeys used (as answer OR distractor) in the last 10 completed
   *  cards — maintained by the runtime from its session ring. */
  recentKeys: ReadonlySet<string>
  /** For token-level requests (cloze bank / word_order tiles): the full
   *  correct token list of the card, renderer-tokenized (§4.4). */
  answerTokens?: string[]
  /** 0-based blank index for cloze-bank positional token picks (§4.4).
   *  Absent (word_order tiles): the index is drawn from the card PRNG. */
  blankIndex?: number
  mode: "item" | "token"
}

export type ResolvedDistractor =
  | { mode: "item"; item: ResolvedItem; text: string } // text = the answerLang face
  | { mode: "token"; text: string; fromKey: string }

export interface DistractorSet {
  /** Length ≤ count. In final presentation-shuffle order (§4.5) —
   *  renderers do not re-shuffle. */
  distractors: ResolvedDistractor[]
  /** count − distractors.length. > 0 is a shortfall the renderer must
   *  handle (choice_pick with 2 options is legal; 1 is not — the card
   *  drops per §3.3). */
  shortfall: number
  /** Scaffold "eliminate one distractor" order: indexes into `distractors`,
   *  worst-fit first (§4.6). The renderer pops indexes off the front. */
  eliminationOrder: number[]
}

// ------------------------------------------------------------ SQL (rungs)

export const DISTRACTOR_SQL = {
  // rung 1: same-skill (pool = "sameSkill", or first rung of "nearTheta")
  sameSkill:
    "SELECT i.id, i.kind, i.source, i.ref_id, i.difficulty_b " +
    "FROM item_skills s1 " +
    "JOIN item_skills s2 ON s2.skill_id = s1.skill_id " +
    "JOIN items i        ON i.id = s2.item_id " +
    "WHERE s1.item_id = ? AND i.id <> ? AND i.kind = ? " +
    "ORDER BY ABS(i.difficulty_b - ?), i.id LIMIT 40",
  // rung 2: near-b course-wide
  nearB:
    "SELECT id, kind, source, ref_id, difficulty_b FROM items " +
    "WHERE kind = ? AND id <> ? " +
    "ORDER BY ABS(difficulty_b - ?), id LIMIT 40",
} as const

// ------------------------------------------------------------- primitives

/** Seeded Fisher-Yates, exported for match_pairs' stable pair shuffle
 *  (§4.5) — same PRNG, same determinism guarantee. Returns a new array. */
export function seededShuffle<T>(cardId: string, xs: T[]): T[] {
  const rng = cardRng(cardId)
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function shuffleWith<T>(rng: () => number, xs: T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The language face of an item, per the resolve context. */
function faceFor(
  item: ResolvedItem,
  lang: string,
  ctx: ResolveContext,
): ResolvedText | undefined {
  if (lang === ctx.targetLang) return item.target
  if (ctx.nativeLang && lang === ctx.nativeLang) return item.native
  return undefined
}

/** Word tokens via the ONE shared tokenizer (util/wordTokens — renderers
 *  import the same module, §4.4). */
function wordTokens(text: string, lang: string): string[] {
  return tokenizePhrase(text, lang)
    .filter((t) => t.isWord)
    .map((t) => t.text)
}

// ------------------------------------------------------------ the sampler

interface Chosen {
  d: ResolvedDistractor
  /** difficulty_b of the source candidate; null = rung-3 top-up (treated
   *  as worst-fit for elimination). */
  b: number | null
}

export async function sampleDistractors(
  req: DistractorRequest,
  resolver: Resolver,
  deps: ResolverDeps,
  ctx: ResolveContext,
): Promise<DistractorSet> {
  const log = deps.log ?? ((event, data) => console.info(event, data))
  const rng = cardRng(req.cardId)
  const kind = req.answer.kind

  const answerFace = faceFor(req.answer, req.answerLang, ctx) ?? req.answer.target
  const answerNorm = normalizeAnswer(answerFace.text, req.answerLang)
  const answerPromptFace = req.promptLang
    ? faceFor(req.answer, req.promptLang, ctx)
    : undefined
  const answerTokenNorms = new Set(
    (req.answerTokens ?? []).map((t) => normalizeAnswer(t, req.answerLang)),
  )

  const chosen: Chosen[] = []
  const usedKeys = new Set<string>([req.answer.key])
  const usedNorms = new Set<string>()

  // §4.3 — the validity contract. Returns the accepted distractor or null.
  const consider = (item: ResolvedItem, b: number | null): Chosen | null => {
    if (usedKeys.has(item.key)) return null // set-dedup by key (+ answer)
    if (req.recentKeys.has(item.key)) return null // rule 4: recency
    const face = faceFor(item, req.answerLang, ctx)
    if (!face || !face.text) return null // rule 3: no answerLang face ⇒ reject
    // rule 2: same-translation collision (both prompt faces present + equal)
    if (req.promptLang && answerPromptFace) {
      const promptFace = faceFor(item, req.promptLang, ctx)
      if (
        promptFace &&
        normalizeAnswer(promptFace.text, req.promptLang) ===
          normalizeAnswer(answerPromptFace.text, req.promptLang)
      ) {
        return null
      }
    }
    if (req.mode === "item") {
      const norm = normalizeAnswer(face.text, req.answerLang)
      if (!norm) return null
      if (norm === answerNorm) return null // rule 1: answer-text collision
      if (usedNorms.has(norm)) return null // set-dedup by normalized surface
      usedKeys.add(item.key)
      usedNorms.add(norm)
      return { d: { mode: "item", item, text: face.text }, b }
    }
    // token mode (§4.4): positional pick from the candidate's word tokens.
    const tokens = wordTokens(face.text, req.answerLang)
    if (tokens.length === 0) return null
    const rawIndex =
      req.blankIndex != null ? req.blankIndex : Math.floor(rng() * tokens.length)
    const index = Math.min(Math.max(rawIndex, 0), tokens.length - 1)
    const token = tokens[index]
    const norm = normalizeAnswer(token, req.answerLang)
    if (!norm) return null
    // rule 1 (token form): equals the blank/target token OR ANY answer token
    if (norm === answerNorm) return null
    if (answerTokenNorms.has(norm)) return null
    if (usedNorms.has(norm)) return null
    usedKeys.add(item.key)
    usedNorms.add(norm)
    return { d: { mode: "token", text: token, fromKey: item.key }, b }
  }

  // Candidate ROWS per rung, cache-served (§3.2: pools cache, 32 entries).
  const fetchRows = async (
    cacheKey: string,
    sql: string,
    params: unknown[],
  ): Promise<DistractorCandidateRow[]> => {
    const hit = resolver.poolCacheGet(cacheKey)
    if (hit) return hit
    const limit = sqlLimit(sql)
    const out = await deps.queryPackDb({ packId: ctx.courseId, sql, params, maxRows: limit })
    if (limit > 1 && out.rows.length === limit) {
      log("journey_content_truncation", { packId: ctx.courseId, sql, limit })
    }
    const rows: DistractorCandidateRow[] = out.rows.map((r) => ({
      id: String(r.id ?? ""),
      kind: String(r.kind ?? "") as ItemRefKind,
      source: String(r.source ?? ""),
      refId: String(r.ref_id ?? ""),
      b: r.difficulty_b == null ? null : Number(r.difficulty_b),
    }))
    resolver.poolCacheSet(cacheKey, rows)
    return rows
  }

  const seenCandidateIds = new Set<string>()

  // Deterministic candidate list → seeded shuffle → filter in shuffled
  // order → take first count. The surviving order IS presentation order.
  const processRung = async (rows: DistractorCandidateRow[]): Promise<void> => {
    const fresh = rows.filter((r) => r.id && !seenCandidateIds.has(r.id))
    for (const r of fresh) seenCandidateIds.add(r.id)
    for (const row of shuffleWith(rng, fresh)) {
      if (chosen.length >= req.count) return
      const ref: ItemRef = { kind: row.kind, source: row.source, id: row.refId }
      // Candidates resolve through the (cache-served) resolver; candidates
      // that land in `missing` are simply skipped — a distractor never
      // triggers a card drop (§4.2).
      const outcome = await resolver.resolveItems([ref])
      const item = outcome.resolved[0]
      if (!item) continue
      const pick = consider(item, row.b)
      if (pick) chosen.push(pick)
    }
  }

  try {
    // rung 1: same-skill
    await processRung(
      await fetchRows(
        `r1|${req.answer.key}|${kind}|${req.targetB}`,
        DISTRACTOR_SQL.sameSkill,
        [req.answer.key, req.answer.key, kind, req.targetB],
      ),
    )
    // rung 2: near-b course-wide
    if (chosen.length < req.count) {
      await processRung(
        await fetchRows(
          `r2|${kind}|${req.answer.key}|${req.targetB}`,
          DISTRACTOR_SQL.nearB,
          [kind, req.answer.key, req.targetB],
        ),
      )
    }
  } catch (err) {
    // The sampler never throws: a broken pool yields a shortfall the
    // renderer/runtime handles (§4.1).
    log("journey_distractor_pool_error", { cardId: req.cardId, error: String(err) })
  }

  // rung 3 (phrase kind only, pathological starvation): random top-up —
  // non-deterministic by nature, exempt from the §4.5 guarantee.
  if (chosen.length < req.count && kind === "phrase") {
    try {
      const needed = req.count - chosen.length
      const entries = await deps.getRandomEntries({
        count: needed + 4,
        levels: req.answer.level ? [req.answer.level] : undefined,
      })
      log("journey_distractor_topup", { cardId: req.cardId, needed })
      for (const entry of entries) {
        if (chosen.length >= req.count) break
        const item = phraseItemFromEntry(entry, ctx)
        if (!item) continue
        const pick = consider(item, null)
        if (pick) chosen.push(pick)
      }
    } catch (err) {
      log("journey_distractor_topup_error", { cardId: req.cardId, error: String(err) })
    }
  }

  // §4.6 elimination order: worst-fit first — descending |b − targetB|
  // (rung-3 b=null ranks worst), ties broken by the card PRNG.
  const tieBreak = chosen.map(() => rng())
  const eliminationOrder = chosen
    .map((c, i) => ({
      i,
      dist: c.b == null ? Number.POSITIVE_INFINITY : Math.abs(c.b - req.targetB),
    }))
    .sort((a, z) => z.dist - a.dist || tieBreak[a.i] - tieBreak[z.i])
    .map((e) => e.i)

  return {
    distractors: chosen.map((c) => c.d),
    shortfall: req.count - chosen.length,
    eliminationOrder,
  }
}

/** Build a phrase ResolvedItem straight from a corpus entry (rung-3 top-up
 *  only — these are not course items and carry no difficulty_b). */
function phraseItemFromEntry(out: EntryOut, ctx: ResolveContext): ResolvedItem | null {
  const face = (lang: string): ResolvedText | undefined => {
    const row = out.translations.find((t) => t.language_code === lang)
    if (!row) return undefined
    const text: ResolvedText = { text: row.text, ttsText: row.text }
    if (row.romanization) text.romanization = row.romanization
    return text
  }
  const target = face(ctx.targetLang)
  if (!target) return null
  const source = out.source ?? "base"
  const ref: ItemRef = { kind: "phrase", source, id: String(out.entry_id) }
  const item: ResolvedItem = {
    ref,
    key: itemRefKey(ref),
    kind: "phrase",
    target,
    level: out.level,
    extras: { kind: "phrase", source, domains: out.domains },
  }
  const native = ctx.nativeLang ? face(ctx.nativeLang) : undefined
  if (native) item.native = native
  return item
}

// ------------------------------------- §4.7 per-renderer needs (normative)

/** What one native renderer needs from the sampler. `answerLang` names the
 *  CONTEXT language ("target"/"native"); buildDistractorRequest maps it to
 *  the concrete code. Null = the renderer takes nothing from the sampler. */
export interface DistractorNeed {
  mode: "item" | "token"
  count: number
  answerLang: "target" | "native"
  promptLang?: "target" | "native"
}

/**
 * The §4.7 table as a typed param builder — one row per R4 registry
 * constant. Translation direction is a PARAM (`direction`), never a type.
 */
export function distractorNeed(
  activityType: string,
  params?: Record<string, unknown>,
): DistractorNeed | null {
  const num = (key: string, fallback: number): number => {
    const v = params?.[key]
    return typeof v === "number" && Number.isFinite(v) ? v : fallback
  }
  switch (activityType) {
    case "choice_pick": {
      const toNative = params?.direction === "toNative"
      return {
        mode: "item",
        count: Math.max(1, num("choices", 4) - 1),
        answerLang: toNative ? "native" : "target",
        promptLang: toNative ? "target" : "native",
      }
    }
    case "listen_pick":
      // Audio prompt is target; options are what was heard (§4.7).
      return {
        mode: "item",
        count: Math.max(1, num("choices", 4) - 1),
        answerLang: "target",
        promptLang: "target",
      }
    case "intro_echo":
      // The WORD DEBUT (unscored) becomes a HEAR→tap-the-meaning comprehension
      // beat: tiles are native-gloss MEANINGS, sampled exactly like a toNative
      // choice_pick (native answer, target prompt). This is ONLY the fallback
      // when the debut has no concept picture / numeral glyph to tap — those
      // carry their own tiles and never reach the sampler. Degrades to the
      // passive show-and-tell when the native face is unavailable
      // (buildDistractorRequest returns null on a single-language stack).
      return {
        mode: "item",
        count: Math.max(1, num("choices", 4) - 1),
        answerLang: "native",
        promptLang: "target",
      }
    case "cloze": {
      if (params?.mode !== "bank") return null // 'type' = free input
      return {
        mode: "token",
        count: Math.max(1, num("bankSize", 5) - 1),
        answerLang: "target",
        promptLang: "target",
      }
    }
    case "word_order": {
      const tiles = Math.min(Math.max(num("distractorTiles", 0), 0), 2)
      if (tiles === 0) return null
      return { mode: "token", count: tiles, answerLang: "target", promptLang: "target" }
    }
    case "grammar_note": {
      // Inherits its embedded drill's row; ONE sampler call, seeded by the
      // SAME cardId (the caller reuses its cardId).
      const drill = params?.drill as
        | { activityType?: string; params?: Record<string, unknown> }
        | undefined
      if (!drill?.activityType) return null
      if (drill.activityType !== "cloze" && drill.activityType !== "word_order") return null
      return distractorNeed(drill.activityType, drill.params)
    }
    // listen_type (free input), match_pairs (seededShuffle only),
    // flip_recall (self-verdict), speak_echo (STT): nothing from the sampler.
    default:
      return null
  }
}

/**
 * Turn a renderer's spec params + resolved answer into a full
 * DistractorRequest. Returns null when the activity type needs nothing
 * from the sampler.
 */
export function buildDistractorRequest(args: {
  activityType: string
  cardId: string
  answer: ResolvedItem
  ctx: ResolveContext
  targetB: number
  recentKeys: ReadonlySet<string>
  params?: Record<string, unknown>
  answerTokens?: string[]
  blankIndex?: number
}): DistractorRequest | null {
  const need = distractorNeed(args.activityType, args.params)
  if (!need) return null
  const langOf = (which: "target" | "native"): string | undefined =>
    which === "target" ? args.ctx.targetLang : args.ctx.nativeLang
  const answerLang = langOf(need.answerLang)
  if (!answerLang) return null // e.g. toNative on a single-language stack
  const pool =
    args.params?.distractors === "nearTheta" ? "nearTheta" : ("sameSkill" as const)
  const req: DistractorRequest = {
    cardId: args.cardId,
    answer: args.answer,
    answerLang,
    count: need.count,
    targetB: args.targetB,
    pool,
    recentKeys: args.recentKeys,
    mode: need.mode,
  }
  const promptLang = need.promptLang ? langOf(need.promptLang) : undefined
  if (promptLang) req.promptLang = promptLang
  if (args.answerTokens) req.answerTokens = args.answerTokens
  if (args.blankIndex != null) req.blankIndex = args.blankIndex
  return req
}
