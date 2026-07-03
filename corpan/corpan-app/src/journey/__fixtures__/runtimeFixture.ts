// src/journey/__fixtures__/runtimeFixture.ts — TEST-ONLY bridge between the
// engine fixture graph (W3) and the resolver's ResolverDeps (W5): a real
// in-memory sqlite course DB (items/item_skills/strings/grammar_nodes) so
// the distractor sampler's SQL executes, plus a synthesized phrase corpus.
// Used by runtime.test.ts and the JourneySurface smoke test.

import { DatabaseSync } from "node:sqlite"
import type { CourseGraph } from "../engine/index.ts"
import type { PackDbResult, ResolveContext, ResolverDeps } from "../content/resolve.ts"
import type { EntryOut } from "../../contentPacks/types.ts"

export const FIXTURE_RUNTIME_CTX: ResolveContext = {
  courseId: "journey_en",
  targetLang: "en",
  nativeLang: "es",
}

/** Deterministic, collision-free synthetic corpus faces. */
export function fixtureEntry(entryId: number, source: string): EntryOut {
  return {
    entry_id: entryId,
    level: "A1",
    domains: ["fixture"],
    source,
    translations: [
      { language_code: "en", text: `alpha bravo ${entryId}`, romanization: "" },
      { language_code: "es", text: `uno dos ${entryId}`, romanization: "" },
    ],
  }
}

export function buildCourseDb(graph: CourseGraph): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE items (
      id TEXT PRIMARY KEY, kind TEXT, source TEXT, ref_id TEXT,
      unit_id TEXT, intro_order INTEGER, difficulty_b REAL,
      importance REAL, is_probe INTEGER, substitutable INTEGER,
      freq_rank INTEGER, text_len INTEGER
    );
    CREATE TABLE item_skills (item_id TEXT, skill_id TEXT);
    CREATE TABLE strings (key TEXT, lang TEXT, text TEXT);
    CREATE TABLE grammar_nodes (
      id TEXT PRIMARY KEY, skill_id TEXT, cefr TEXT,
      title_key TEXT, note_key TEXT, late_acquired INTEGER
    );
    CREATE TABLE l1_overlays (
      l1 TEXT, overlay_type TEXT, ref_kind TEXT, ref_id TEXT,
      payload_json TEXT, string_key TEXT
    );
  `)
  const insItem = db.prepare(
    "INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  const insSkill = db.prepare("INSERT INTO item_skills VALUES (?, ?)")
  for (const item of Object.values(graph.items)) {
    insItem.run(
      item.itemId,
      item.kind,
      item.ref.source,
      item.ref.id,
      graph.skills[item.skillIds[0]]?.unitId ?? "",
      item.introOrder,
      item.b,
      item.importance,
      item.probe ? 1 : 0,
      item.substituteIds && item.substituteIds.length > 0 ? 1 : 0,
      null,
      item.textLen,
    )
    for (const skillId of item.skillIds) insSkill.run(item.itemId, skillId)
  }
  return db
}

export interface RuntimeFixtureDeps extends ResolverDeps {
  close(): void
}

/**
 * ResolverDeps over the in-memory course DB + synthetic corpus. An optional
 * second sqlite handle (the checked-in W6 pack) can be passed instead.
 */
export function makeRuntimeFixtureDeps(
  graph: CourseGraph,
  opts: { db?: InstanceType<typeof DatabaseSync> } = {},
): RuntimeFixtureDeps {
  const db = opts.db ?? buildCourseDb(graph)
  return {
    getEntryById: async (entryId, source) => fixtureEntry(entryId, source),
    getRandomEntries: async () => [],
    queryPackDb: async (q): Promise<PackDbResult> => {
      const rows = db.prepare(q.sql).all(...((q.params ?? []) as (string | number | null)[])) as Record<
        string,
        unknown
      >[]
      const capped = rows.slice(0, Math.min(q.maxRows ?? 2000, 2000))
      return { columns: capped[0] ? Object.keys(capped[0]) : [], rows: capped }
    },
    fetchPackText: async () => {
      throw new Error("no pack files in fixture")
    },
    packFileUrl: (packId, relPath) => `corpan-pack://localhost/${packId}/${relPath}`,
    findInstalledWordPack: () => null,
    findInstalledNarrationPack: () => null,
    findInstalledPack: (packId) => packId === "base",
    log: () => {},
    close: () => db.close(),
  }
}
