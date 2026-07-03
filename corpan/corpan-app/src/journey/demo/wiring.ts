// src/journey/demo/wiring.ts — JourneyRuntimeDeps over the PRECOMPUTED
// journey_en JSON (scripts/journey-demo/precompute.ts), for the plain-browser
// demo page (journey-demo.html) and its headless verifier. No Tauri, no
// hostApi, no localAnalytics: the REAL engine + REAL resolver run over
// JSON-backed ports.
//
// The queryPackDb port answers EXACTLY the resolver/distractor SQL registry
// (resolve.ts SQL.* + distractors.ts DISTRACTOR_SQL.*) from precomputed
// tables — anything else throws, which the resolver maps to db_error (§3.1).
// Demo-only file: duplicating the smoke test's port pattern here is preferred
// over touching shared source (per the demo-harness ground rules).

import { createJourneyEngine, createMemoryPersistence, systemClock } from "../engine/index.ts"
import type { CourseGraph } from "../engine/index.ts"
import {
  createResolver,
  SQL,
  type PackDbResult,
  type ResolveContext,
  type ResolverDeps,
} from "../content/resolve.ts"
import { DISTRACTOR_SQL } from "../content/distractors.ts"
import { unlimitedQuota } from "../types.ts"
import type { JourneyRuntimeDeps, RecordFn } from "../runtime.ts"
import type { EntryOut } from "../../contentPacks/types.ts"

// ------------------------------------------------- precomputed JSON shape

export interface DemoItemRow {
  id: string
  kind: string
  source: string
  ref_id: string
  difficulty_b: number
  intro_order: number
}

export interface DemoCourseData {
  manifest: {
    generatedFrom: string
    generatedAt: string
    courseId: string
    targetLang: string
    nativeLang: string
    itemCount: number
    entryCount: number
  }
  graph: CourseGraph
  tables: {
    strings: Record<string, { lang: string; text: string }[]>
    grammarNodes: Record<string, Record<string, unknown>>
    l1Overlays: {
      l1: string
      overlay_type: string
      ref_kind: string
      ref_id: string
      payload_json: string
      string_key: string | null
    }[]
    items: DemoItemRow[]
    itemSkills: [string, string][]
  }
  entries: Record<string, EntryOut>
  randomPool: EntryOut[]
}

export const DEMO_STACK_ID = "journey-demo-stack"

// -------------------------------------------------- JSON-backed queryPackDb

type QueryPackDb = ResolverDeps["queryPackDb"]

function rowsResult(rows: Record<string, unknown>[]): PackDbResult {
  return { columns: rows[0] ? Object.keys(rows[0]) : [], rows }
}

/** Answer the resolver/distractor SQL registry from the precomputed tables. */
export function makeDemoQueryPackDb(data: DemoCourseData): QueryPackDb {
  const { strings, grammarNodes, l1Overlays, items, itemSkills } = data.tables
  const itemById = new Map(items.map((i) => [i.id, i]))
  const skillsByItem = new Map<string, string[]>()
  const itemsBySkill = new Map<string, string[]>()
  for (const [itemId, skillId] of itemSkills) {
    ;(skillsByItem.get(itemId) ?? skillsByItem.set(itemId, []).get(itemId)!).push(skillId)
    ;(itemsBySkill.get(skillId) ?? itemsBySkill.set(skillId, []).get(skillId)!).push(itemId)
  }

  const candidateRow = (i: DemoItemRow) => ({
    id: i.id,
    kind: i.kind,
    source: i.source,
    ref_id: i.ref_id,
    difficulty_b: i.difficulty_b,
  })

  return async ({ sql, params = [] }) => {
    switch (sql) {
      case SQL.strings: {
        const rows = strings[String(params[0])] ?? []
        return rowsResult(rows.map((r) => ({ lang: r.lang, text: r.text })))
      }
      case SQL.grammarNode: {
        const row = grammarNodes[String(params[0])]
        return rowsResult(row ? [row] : [])
      }
      case SQL.grammarExemplars: {
        const skillId = String(params[0])
        const rows = (itemsBySkill.get(skillId) ?? [])
          .map((id) => itemById.get(id))
          .filter((i): i is DemoItemRow => !!i && i.kind === "phrase")
          .sort((a, b) => a.intro_order - b.intro_order)
          .slice(0, 8)
          .map((i) => ({ id: i.id, kind: i.kind, source: i.source, ref_id: i.ref_id }))
        return rowsResult(rows)
      }
      case SQL.phonemeOverlay: {
        const [l1, refId] = [String(params[0]), String(params[1])]
        const hit = l1Overlays.find(
          (o) =>
            o.l1 === l1 &&
            o.overlay_type === "phoneme_pair" &&
            o.ref_kind === "item" &&
            o.ref_id === refId,
        )
        return rowsResult(
          hit ? [{ payload_json: hit.payload_json, string_key: hit.string_key }] : [],
        )
      }
      case DISTRACTOR_SQL.sameSkill: {
        const [anchorId, excludeId, kind, b] = [
          String(params[0]),
          String(params[1]),
          String(params[2]),
          Number(params[3]),
        ]
        const seen = new Set<string>()
        const pool: DemoItemRow[] = []
        for (const skillId of skillsByItem.get(anchorId) ?? []) {
          for (const id of itemsBySkill.get(skillId) ?? []) {
            if (id === excludeId || seen.has(id)) continue
            seen.add(id)
            const it = itemById.get(id)
            if (it && it.kind === kind) pool.push(it)
          }
        }
        pool.sort(
          (x, y) =>
            Math.abs(x.difficulty_b - b) - Math.abs(y.difficulty_b - b) ||
            (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
        )
        return rowsResult(pool.slice(0, 40).map(candidateRow))
      }
      case DISTRACTOR_SQL.nearB: {
        const [kind, excludeId, b] = [String(params[0]), String(params[1]), Number(params[2])]
        const pool = items
          .filter((i) => i.kind === kind && i.id !== excludeId)
          .sort(
            (x, y) =>
              Math.abs(x.difficulty_b - b) - Math.abs(y.difficulty_b - b) ||
              (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
          )
        return rowsResult(pool.slice(0, 40).map(candidateRow))
      }
      default:
        // resolver maps this to db_error + journey_content_db_error (§3.1)
        throw new Error(`journey-demo queryPackDb: unhandled SQL: ${sql}`)
    }
  }
}

// ------------------------------------------------------------- deps builder

export interface DemoDepsOptions {
  record?: RecordFn
  log?: (event: string, data: Record<string, unknown>) => void
}

/** The full JourneyRuntimeDeps: REAL engine over in-memory persistence, REAL
 *  resolver over the JSON ports, unlimited quota, stubbed pack sessions. */
export function buildDemoDeps(
  data: DemoCourseData,
  opts: DemoDepsOptions = {},
): JourneyRuntimeDeps {
  const log =
    opts.log ?? ((event: string, d: Record<string, unknown>) => console.debug(`[journey-demo] ${event}`, d))
  const record: RecordFn =
    opts.record ?? ((e) => console.debug("[journey-demo] record", e))

  const graph = data.graph
  const ctx: ResolveContext = {
    courseId: data.manifest.courseId,
    targetLang: data.manifest.targetLang,
    nativeLang: data.manifest.nativeLang,
  }

  // phrase-pack sources present in the precomputed entries count as installed
  const installedSources = new Set<string>()
  for (const key of Object.keys(data.entries)) {
    installedSources.add(key.slice(0, key.lastIndexOf(":")))
  }

  let poolCursor = 0
  const resolverDeps: ResolverDeps = {
    getEntryById: async (entryId, source) => data.entries[`${source}:${entryId}`] ?? null,
    getRandomEntries: async (q) => {
      const pool = data.randomPool
      if (pool.length === 0) return []
      const out: EntryOut[] = []
      for (let i = 0; i < Math.min(q.count, pool.length); i++) {
        out.push(pool[(poolCursor + i) % pool.length])
      }
      poolCursor = (poolCursor + q.count) % pool.length
      return out
    },
    queryPackDb: makeDemoQueryPackDb(data),
    fetchPackText: async (packId, relPath) => {
      throw new Error(`no pack files in browser demo (${packId}/${relPath})`)
    },
    packFileUrl: (packId, relPath) => `/journey-demo/absent/${packId}/${relPath}`,
    findInstalledWordPack: () => null,
    findInstalledNarrationPack: () => null,
    findInstalledPack: (packId) =>
      packId === ctx.courseId || installedSources.has(packId),
    log,
  }

  const resolver = createResolver(resolverDeps, ctx)
  const engine = createJourneyEngine({
    key: { stackId: DEMO_STACK_ID, courseId: graph.courseId },
    graph,
    persistence: createMemoryPersistence({ now: () => Date.now() }),
    clock: systemClock,
  })

  return {
    engine,
    resolver,
    resolverDeps,
    ctx,
    graph,
    courseKey: `${DEMO_STACK_ID}::${graph.courseId}`,
    quota: unlimitedQuota(),
    record,
    // no STT in the browser demo — speak_echo degrades to listen_type by design
    sttAvailable: () => Promise.resolve(false),
    log,
    activitySession: {
      begin: (packId, spec) => {
        console.debug("[journey-demo] pack launch not available in browser demo", {
          packId,
          activityType: spec.activityType,
        })
        return false
      },
      end: () => {},
    },
  }
}
