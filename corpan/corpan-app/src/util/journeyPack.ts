/**
 * Journey course-pack access: install/upgrade plumbing + the normative
 * PackReader → CourseGraph loader (course-pack.md §2.1 / §7.2, R7).
 *
 * Clone of `util/wordPack.ts` minus its stale hardcoded-langs fallback — the
 * journey-pack index (`contentPacks/journeyPackCatalog.ts`) is the only
 * resolver here.
 *
 * The loader is typed to the engine's CourseGraph STRUCTURALLY (engine.md
 * §2.6). It deliberately does NOT import from `src/journey/engine/**` (an
 * in-flight path owned by another workstream); the engine consumes the plain
 * JSON-serializable object this module produces. Integration point for the
 * CTO: `journey/store` calls `loadCourseGraphFromPack(packId)` and hands the
 * result to the engine.
 */
import { invoke } from "@tauri-apps/api/core"

import {
  ACTIVITY_TYPES,
  parseItemRef,
  type ItemRef,
  type PackActivityDeclaration,
} from "../contentPacks/activityContract"

/* -------------------------------------------------------------------------- */
/*  ids + install plumbing                                                    */
/* -------------------------------------------------------------------------- */

/** Resolve the pack id for a target language. "pt-BR" → "journey_pt_br".
 *  Underscore-canonical per the installer's id-derivation rule; we still
 *  ALWAYS pass the explicit packId to the installer. */
export function packIdForTarget(targetLang: string): string {
  return `journey_${targetLang.toLowerCase().replace(/-/g, "_")}`
}

/**
 * Dev-only fallback download URL. In production journey packs are installed
 * via the resolved `zipUrl` from the journey-pack index — never from the main
 * catalog. This helper exists for `npm run dev`, where the vite `/packs`
 * middleware serves in-repo zips. Zip base names are the UNDERSCORE pack id
 * (R1 installer rule — matches the published `journey_en-0.1.0.zip` stem).
 */
export function devDownloadUrlForPack(packId: string): string {
  return `/packs/journey/${packId}.zip`
}

/** True when the pack is installed on disk (manifest resolvable). */
export async function isJourneyPackInstalled(packId: string): Promise<boolean> {
  try {
    await invoke("content_packs_get_manifest_url", { packId })
    return true
  } catch {
    return false
  }
}

/**
 * Install a journey pack. `zipUrl` comes from the journey-pack index; when
 * omitted (dev-server path) we fall back to the vite-served in-repo zip.
 * We pass an EXPLICIT `packId` so the installer never derives an id from the
 * version-suffixed filename (`journey_en-0.1.0.zip` would otherwise
 * mis-derive `journey_en_0_1_0` — the exact wordpan bug-avoidance).
 */
export async function installJourneyPack(
  packId: string,
  zipUrl?: string,
  expectedSha256?: string | null,
): Promise<void> {
  const downloadUrl =
    zipUrl ?? (import.meta.env.DEV ? devDownloadUrlForPack(packId) : "")
  if (!downloadUrl) {
    throw new Error(
      `[journeyPack] no download URL for ${packId} — the journey-pack index must provide a zipUrl`,
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
 * Thin `content_packs_query_db` wrapper used by the engine's PackReader.
 * Parameterized, read-only, connection-cached on the Rust side.
 */
export async function queryJourney<T = Record<string, unknown>>(
  packId: string,
  sql: string,
  params: unknown[],
  maxRows = 1000,
): Promise<T[]> {
  const result = await invoke<QueryResult>("content_packs_query_db", {
    packId,
    dbName: "main",
    sql,
    params,
    maxRows,
  })
  return (result?.rows ?? []) as T[]
}

export type JourneyPackMeta = {
  courseId: string
  targetLang: string
  schemaVersion: number
  contentVersion: string
  unitCount: number
  itemCount: number
}

/** Read pack_meta — post-install verification (course-pack.md §7.3 step 3).
 *  Returns null when the pack is absent or its meta is unreadable. */
export async function readJourneyPackMeta(
  packId: string,
): Promise<JourneyPackMeta | null> {
  try {
    const rows = await queryJourney<{ key: string; value: string }>(
      packId,
      "SELECT key, value FROM pack_meta",
      [],
      64,
    )
    const meta = new Map(rows.map((r) => [r.key, r.value]))
    const courseId = meta.get("course_id")
    const targetLang = meta.get("target_lang")
    const contentVersion = meta.get("content_version")
    const schemaVersion = Number.parseInt(meta.get("schema_version") ?? "", 10)
    if (!courseId || !targetLang || !contentVersion || !Number.isInteger(schemaVersion)) {
      return null
    }
    return {
      courseId,
      targetLang,
      schemaVersion,
      contentVersion,
      unitCount: Number.parseInt(meta.get("unit_count") ?? "0", 10) || 0,
      itemCount: Number.parseInt(meta.get("item_count") ?? "0", 10) || 0,
    }
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  CourseGraph read model (STRUCTURAL mirror of engine.md §2.6)              */
/* -------------------------------------------------------------------------- */

export type CourseCefr = "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
export type CourseStrand = "input" | "output" | "language" | "fluency"

export interface CourseGraphArc {
  arcId: string
  ordinal: number
  cefr: CourseCefr
}

export interface CourseGraphUnit {
  unitId: string
  arcId: string
  ordinal: number
  skillIds: string[]
}

export interface CourseGraphSkill {
  skillId: string
  prereqs: string[]
  itemIds: string[]
  b: number
  unitId: string
}

export interface CourseGraphItem {
  itemId: string
  ref: ItemRef
  skillIds: string[]
  b: number
  introOrder: number
  /** DERIVED engine weight (1.0..2.0) from the pack's authored 0–3 scale —
   *  the ONE importance scale rule (course-pack.md §2.1 / R7). */
  importance: number
  probe?: boolean
  substituteIds?: string[]
  textLen: number
  kind: ItemRef["kind"]
}

export interface CourseGraphActivityTemplate {
  activityType: string
  itemKind: ItemRef["kind"]
  form: 0 | 1 | 2
  strand: CourseStrand
  guessable: boolean
  estSec: number
  modelNeeds: ("stt" | "llm" | "tts")[]
  provider: "native" | string
  funWeight?: number
}

export interface CourseGraphRecipeSlot {
  slotType: string
  activityTypes: string[]
  itemSelector:
    | "due" | "new" | "unit" | "known"
    | "grammar-node" | "l1-phoneme" | "rare" | "none"
  params?: Record<string, unknown>
  optional: boolean
}

export interface CourseGraph {
  courseId: string
  /** BCP-47 target language from `pack_meta.target_lang` — the AUTHORITATIVE
   *  value (correct casing, e.g. "pt-BR"). The engine's courseId-derived
   *  fallback ("journey_pt_br" → "pt-br") loses casing, so every spec-minting
   *  path must prefer this (W3/W6 note; W10 item 15). */
  targetLang: string
  arcs: CourseGraphArc[]
  units: CourseGraphUnit[]
  skills: Record<string, CourseGraphSkill>
  items: Record<string, CourseGraphItem>
  activityTemplates: CourseGraphActivityTemplate[]
  lessonRecipes: Record<string, {
    recipeId: string
    estMinutes: number
    slots: CourseGraphRecipeSlot[]
  }>
  unitLessons: Record<string, {
    lessonIndex: number
    recipeId: string
    params?: Record<string, unknown>
  }[]>
  checkpoints: {
    checkpointId: string
    scope: "unit" | "arc"
    unitId?: string
    arcId?: string
    recipeId: string
    passScore: number
    params?: Record<string, unknown>
  }[]
  rareCards: {
    rareCardId: string
    cardType: "delight" | "minigame" | "etymology" | "story"
    rarityWeight: number
    minUnitOrdinal?: number
    provider?: string
    itemId?: string
    coverageGate?: number
    params?: Record<string, unknown>
  }[]
}

/** Pack importance (0–3, authored) → engine weight. THE one mapping (R7). */
export const IMPORTANCE_WEIGHT: Record<number, number> = {
  3: 2.0, // core
  2: 1.5, // standard
  1: 1.2, // enrichment
  0: 1.0, // rare-card-only — never enters scheduler pools
}

/** arcs.cefr is stored as 'preA1'|'A1'|… ; the engine's band enum uses A0. */
function toCourseCefr(cefr: string): CourseCefr {
  return (cefr === "preA1" ? "A0" : cefr) as CourseCefr
}

/** Loaded counts disagree with pack_meta ⇒ silent truncation or a corrupt
 *  install. HARD boot error — the engine never boots on a partial graph. */
export class JourneyPackIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "JourneyPackIntegrityError"
  }
}

/**
 * Query seam so the loader is testable headless: production wires
 * `content_packs_query_db` (via `queryJourney`); tests wire `node:sqlite`
 * over the built fixture.
 */
export type JourneyQueryFn = (
  sql: string,
  params: unknown[],
  maxRows: number,
) => Promise<Array<Record<string, unknown>>>

/** Page size for keyset pagination. The Rust `content_packs_query_db`
 *  hard-caps at 2,000 rows and truncates SILENTLY — every read of `items` /
 *  `item_skills` pages with keysets and loops until a short page. Never
 *  OFFSET; never assume a full page is the last. Tests shrink this to force
 *  multi-page loops. */
export const COURSE_GRAPH_PAGE_SIZE = 1000

export interface LoadCourseGraphOptions {
  /** Override for tests. Must stay well under the Rust 2,000-row cap. */
  pageSize?: number
  /** Pack activity declarations (installed manifest wins over catalog —
   *  activity-contract.md §4.3). Used to type `<packId>:<name>` templates
   *  referenced by recipe slots. Native templates never need this. */
  packDeclarations?: PackActivityDeclaration[]
}

const STRAND_TAG: Record<string, CourseStrand> = {
  mfi: "input",
  mfo: "output",
  lfl: "language",
  fd: "fluency",
}

function asNum(v: unknown): number {
  return typeof v === "number" ? v : Number(v)
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "")
}

function parseJson(v: unknown): Record<string, unknown> | undefined {
  if (typeof v !== "string" || !v) return undefined
  try {
    return JSON.parse(v) as Record<string, unknown>
  } catch {
    return undefined
  }
}

/**
 * THE PackReader → CourseGraph loader (course-pack.md §2.1, normative).
 * Exact SQL per CourseGraph field; keyset pagination over `intro_order` and
 * the `item_skills` composite PK; row-count hard assertion vs `pack_meta`.
 */
export async function loadCourseGraph(
  query: JourneyQueryFn,
  opts: LoadCourseGraphOptions = {},
): Promise<CourseGraph> {
  const pageSize = opts.pageSize ?? COURSE_GRAPH_PAGE_SIZE

  const metaRows = await query("SELECT key, value FROM pack_meta", [], 64)
  const meta = new Map(metaRows.map((r) => [asStr(r.key), asStr(r.value)]))
  const courseId = meta.get("course_id") ?? ""
  if (!courseId) {
    throw new JourneyPackIntegrityError("pack_meta.course_id missing")
  }
  // Authoritative target language (course-pack.md pack_meta). Falls back to
  // the underscore-courseId derivation only for pre-target_lang fixture DBs —
  // the fallback loses BCP-47 casing ("pt-br", not "pt-BR").
  const targetLang =
    meta.get("target_lang") ?? courseId.replace(/^journey_/, "").replace(/_/g, "-")

  // graph.arcs — single shot, ≤ 7 rows
  const arcRows = await query(
    "SELECT id, arc_index, cefr FROM arcs ORDER BY arc_index", [], 32,
  )
  const arcs: CourseGraphArc[] = arcRows.map((r) => ({
    arcId: asStr(r.id),
    ordinal: asNum(r.arc_index),
    cefr: toCourseCefr(asStr(r.cefr)),
  }))

  // graph.units (skillIds filled from the skills rows below)
  const unitRows = await query(
    "SELECT id, arc_id, unit_index FROM units ORDER BY arc_id, unit_index",
    [], 1000,
  )
  const arcOrdinal = new Map(arcs.map((a) => [a.arcId, a.ordinal]))
  const units: CourseGraphUnit[] = unitRows
    .map((r) => ({
      unitId: asStr(r.id),
      arcId: asStr(r.arc_id),
      ordinal: asNum(r.unit_index),
      skillIds: [] as string[],
    }))
    .sort(
      (a, b) =>
        (arcOrdinal.get(a.arcId) ?? 0) - (arcOrdinal.get(b.arcId) ?? 0) ||
        a.ordinal - b.ordinal,
    )
  const unitPos = new Map(units.map((u, i) => [u.unitId, i]))

  // graph.skills
  const skillRows = await query(
    "SELECT id, unit_id, difficulty_b FROM skills", [], 2000,
  )
  const skills: Record<string, CourseGraphSkill> = {}
  for (const r of skillRows) {
    const skillId = asStr(r.id)
    skills[skillId] = {
      skillId,
      prereqs: [],
      itemIds: [],
      b: asNum(r.difficulty_b),
      unitId: asStr(r.unit_id),
    }
    units[unitPos.get(asStr(r.unit_id)) ?? -1]?.skillIds.push(skillId)
  }
  const edgeRows = await query(
    "SELECT from_skill, to_skill FROM skill_edges", [], 2000,
  )
  for (const r of edgeRows) {
    skills[asStr(r.to_skill)]?.prereqs.push(asStr(r.from_skill))
  }

  // graph.items — keyset over intro_order, loop until a short page
  const items: Record<string, CourseGraphItem> = {}
  const itemsInOrder: CourseGraphItem[] = []
  let lastIntro = 0
  for (;;) {
    const page = await query(
      "SELECT id, kind, source, ref_id, unit_id, intro_order, difficulty_b, " +
        "importance, is_probe, substitutable, text_len " +
        "FROM items WHERE intro_order > ? ORDER BY intro_order LIMIT " + pageSize,
      [lastIntro],
      pageSize,
    )
    for (const r of page) {
      const itemId = asStr(r.id)
      const ref = parseItemRef(itemId)
      if (!ref) {
        throw new JourneyPackIntegrityError(
          `items.id ${itemId} does not parse as an ItemRef`,
        )
      }
      const item: CourseGraphItem = {
        itemId,
        ref,
        skillIds: [],
        b: asNum(r.difficulty_b),
        introOrder: asNum(r.intro_order),
        importance: IMPORTANCE_WEIGHT[asNum(r.importance)] ?? 1.0,
        textLen: asNum(r.text_len),
        kind: ref.kind,
      }
      if (asNum(r.is_probe) === 1) item.probe = true
      items[itemId] = item
      itemsInOrder.push(item)
      lastIntro = asNum(r.intro_order)
    }
    if (page.length < pageSize) break
  }

  // item_skills — keyset over the composite PK
  const substitutableSet = new Set<string>()
  {
    // (re-read substitutable flags in intro order for substituteIds below)
    let last = 0
    for (;;) {
      const page = await query(
        "SELECT intro_order, id FROM items WHERE substitutable = 1 AND " +
          "intro_order > ? ORDER BY intro_order LIMIT " + pageSize,
        [last],
        pageSize,
      )
      for (const r of page) {
        substitutableSet.add(asStr(r.id))
        last = asNum(r.intro_order)
      }
      if (page.length < pageSize) break
    }
  }
  let lastItem = ""
  let lastSkill = ""
  let itemSkillCount = 0
  for (;;) {
    const page = await query(
      "SELECT item_id, skill_id FROM item_skills " +
        "WHERE (item_id, skill_id) > (?, ?) " +
        "ORDER BY item_id, skill_id LIMIT " + pageSize,
      [lastItem, lastSkill],
      pageSize,
    )
    for (const r of page) {
      const itemId = asStr(r.item_id)
      const skillId = asStr(r.skill_id)
      items[itemId]?.skillIds.push(skillId)
      skills[skillId]?.itemIds.push(itemId)
      lastItem = itemId
      lastSkill = skillId
      itemSkillCount += 1
    }
    if (page.length < pageSize) break
  }
  // per-skill item sets sorted by introOrder (derived index)
  for (const s of Object.values(skills)) {
    s.itemIds.sort((a, b) => items[a].introOrder - items[b].introOrder)
  }

  // substituteIds — derived in-memory, no extra SQL: same-skill items with
  // substitutable = 1, ordered by intro_order (course-pack.md §2.1).
  for (const item of itemsInOrder) {
    const subs: string[] = []
    const seen = new Set<string>([item.itemId])
    for (const skillId of item.skillIds) {
      for (const otherId of skills[skillId]?.itemIds ?? []) {
        if (seen.has(otherId) || !substitutableSet.has(otherId)) continue
        seen.add(otherId)
        subs.push(otherId)
      }
    }
    if (subs.length > 0) {
      subs.sort((a, b) => items[a].introOrder - items[b].introOrder)
      item.substituteIds = subs
    }
  }

  // Row-count assertion (HARD boot error, course-pack.md §2.1). A mismatch
  // means silent Rust-side truncation or a corrupt install.
  const expect = (key: string): number =>
    Number.parseInt(meta.get(key) ?? "-1", 10)
  const counts: Array<[string, number, number]> = [
    ["arc_count", arcs.length, expect("arc_count")],
    ["unit_count", units.length, expect("unit_count")],
    ["skill_count", Object.keys(skills).length, expect("skill_count")],
    ["item_count", itemsInOrder.length, expect("item_count")],
  ]
  for (const [key, actual, expected] of counts) {
    if (actual !== expected) {
      throw new JourneyPackIntegrityError(
        `course pack ${courseId}: loaded ${key.replace("_count", "s")} ` +
          `${actual} != pack_meta.${key} ${expected} — refusing to boot on ` +
          "a partial graph (reinstall the pack)",
      )
    }
  }

  // lesson/checkpoint layer (R5)
  const recipeRows = await query(
    "SELECT id, est_minutes FROM lesson_recipes", [], 256,
  )
  const slotRows = await query(
    "SELECT recipe_id, slot_index, slot_type, activity_types_json, " +
      "item_selector, params_json, optional FROM recipe_slots " +
      "ORDER BY recipe_id, slot_index",
    [], 2000,
  )
  const lessonRecipes: CourseGraph["lessonRecipes"] = {}
  for (const r of recipeRows) {
    const recipeId = asStr(r.id)
    lessonRecipes[recipeId] = {
      recipeId,
      estMinutes: asNum(r.est_minutes),
      slots: [],
    }
  }
  const packTypesInRecipes = new Set<string>()
  for (const r of slotRows) {
    const recipe = lessonRecipes[asStr(r.recipe_id)]
    if (!recipe) continue
    const activityTypes = (JSON.parse(asStr(r.activity_types_json)) as string[])
    for (const t of activityTypes) {
      if (t.includes(":")) packTypesInRecipes.add(t)
    }
    recipe.slots.push({
      slotType: asStr(r.slot_type),
      activityTypes,
      itemSelector: asStr(r.item_selector) as CourseGraphRecipeSlot["itemSelector"],
      params: parseJson(r.params_json),
      optional: asNum(r.optional) === 1,
    })
  }

  const unitLessonRows = await query(
    "SELECT unit_id, lesson_index, recipe_id, params_json FROM unit_lessons " +
      "ORDER BY unit_id, lesson_index",
    [], 2000,
  )
  const unitLessons: CourseGraph["unitLessons"] = {}
  for (const r of unitLessonRows) {
    const unitId = asStr(r.unit_id)
    ;(unitLessons[unitId] ??= []).push({
      lessonIndex: asNum(r.lesson_index),
      recipeId: asStr(r.recipe_id),
      params: parseJson(r.params_json),
    })
  }

  const checkpointRows = await query(
    "SELECT id, scope, unit_id, arc_id, recipe_id, pass_score, params_json " +
      "FROM checkpoints",
    [], 1000,
  )
  const checkpoints: CourseGraph["checkpoints"] = checkpointRows.map((r) => ({
    checkpointId: asStr(r.id),
    scope: asStr(r.scope) as "unit" | "arc",
    unitId: r.unit_id == null ? undefined : asStr(r.unit_id),
    arcId: r.arc_id == null ? undefined : asStr(r.arc_id),
    recipeId: asStr(r.recipe_id),
    passScore: asNum(r.pass_score),
    params: parseJson(r.params_json),
  }))

  const rareRows = await query(
    "SELECT id, card_type, rarity_weight, min_unit_id, provider, item_id, " +
      "coverage_gate, params_json FROM rare_cards",
    [], 2000,
  )
  const rareCards: CourseGraph["rareCards"] = rareRows.map((r) => ({
    rareCardId: asStr(r.id),
    cardType: asStr(r.card_type) as CourseGraph["rareCards"][number]["cardType"],
    rarityWeight: asNum(r.rarity_weight),
    minUnitOrdinal:
      r.min_unit_id == null ? undefined : unitPos.get(asStr(r.min_unit_id)),
    provider: r.provider == null ? undefined : asStr(r.provider),
    itemId: r.item_id == null ? undefined : asStr(r.item_id),
    coverageGate: r.coverage_gate == null ? undefined : asNum(r.coverage_gate),
    params: parseJson(r.params_json),
  }))

  // activityTemplates — native-template metadata comes from the vendored
  // ACTIVITY_TYPES registry (R4), NOT from this DB. One metadata source.
  // Native rows are emitted per item kind present in the pack (availability
  // filtering happens per engine call). Pack `<packId>:<name>` types get
  // rows only when a PackActivityDeclaration is supplied (installed manifest
  // wins over catalog — the integrator wires declarations in).
  const kindsPresent = [
    ...new Set(itemsInOrder.map((i) => i.kind)),
  ] as ItemRef["kind"][]
  const activityTemplates: CourseGraphActivityTemplate[] = []
  for (const metaRow of Object.values(ACTIVITY_TYPES)) {
    for (const itemKind of kindsPresent) {
      activityTemplates.push({
        activityType: metaRow.activityType,
        itemKind,
        form: metaRow.form,
        strand: metaRow.strand,
        guessable: metaRow.guessable,
        estSec: metaRow.estSec,
        modelNeeds: [...metaRow.modelNeeds],
        provider: "native",
      })
    }
  }
  for (const packType of packTypesInRecipes) {
    const decl = opts.packDeclarations?.find(
      (d) => d.activityType === packType,
    )
    if (!decl) continue // unresolvable without a declaration; engine skips
    const provider = packType.slice(0, packType.indexOf(":"))
    const strand = STRAND_TAG[decl.strands?.[0] ?? "fd"] ?? "fluency"
    for (const itemKind of decl.itemKinds) {
      activityTemplates.push({
        activityType: packType,
        itemKind,
        form: 1,
        strand,
        guessable: false,
        estSec: decl.typicalDurationSec ?? 60,
        modelNeeds: [...(decl.modelNeeds ?? [])],
        provider,
        funWeight: 1,
      })
    }
  }

  return {
    courseId,
    targetLang,
    arcs,
    units,
    skills,
    items,
    activityTemplates,
    lessonRecipes,
    unitLessons,
    checkpoints,
    rareCards,
  }
}

/** Production entry point: load the graph from an installed pack via the
 *  Tauri query command. */
export async function loadCourseGraphFromPack(
  packId: string,
  opts: LoadCourseGraphOptions = {},
): Promise<CourseGraph> {
  const queryFn: JourneyQueryFn = (sql, params, maxRows) =>
    queryJourney(packId, sql, params, maxRows)
  return loadCourseGraph(queryFn, opts)
}
