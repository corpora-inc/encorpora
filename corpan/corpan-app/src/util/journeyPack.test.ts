// Tests for the PackReader → CourseGraph loader (course-pack.md §2.1,
// normative): keyset pagination (page size 3 to force multi-page loops), the
// row-count hard assertion on a corrupted pack, derived substituteIds, and
// the one importance-weight mapping. Run with: `npm test`.
//
// The loader's query seam is injected, so we drive it with `node:sqlite`
// over the CHECKED-IN fixture pack built by the Python pipeline
// (dja/journey_pack/fixtures/dist — see dja/journey_pack/README.md).
// `journeyPack.ts` reads `import.meta.env` + `@tauri-apps/api`, so we bundle
// through esbuild like the other contentPacks tests.

import { test, before } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import os from "node:os"
import { DatabaseSync } from "node:sqlite"

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_DB = path.resolve(
  here,
  "../../../dja/journey_pack/fixtures/dist/journey_en/data/course.sqlite3",
)

type Row = Record<string, unknown>
type QueryFn = (sql: string, params: unknown[], maxRows: number) => Promise<Row[]>
type Graph = {
  courseId: string
  arcs: { arcId: string; ordinal: number; cefr: string }[]
  units: { unitId: string; arcId: string; ordinal: number; skillIds: string[] }[]
  skills: Record<string, { prereqs: string[]; itemIds: string[]; b: number; unitId: string }>
  items: Record<string, {
    itemId: string
    ref: { kind: string; source: string; id: string }
    skillIds: string[]
    b: number
    introOrder: number
    importance: number
    probe?: boolean
    substituteIds?: string[]
    textLen: number
    kind: string
  }>
  activityTemplates: { activityType: string; itemKind: string; provider: string }[]
  lessonRecipes: Record<string, { slots: unknown[] }>
  unitLessons: Record<string, unknown[]>
  checkpoints: { scope: string; passScore: number }[]
  rareCards: { rareCardId: string; cardType: string; minUnitOrdinal?: number }[]
}

let loadCourseGraph: (q: QueryFn, opts?: { pageSize?: number }) => Promise<Graph>
let JourneyPackIntegrityError: new (m: string) => Error
let IMPORTANCE_WEIGHT: Record<number, number>
let packIdForTarget: (t: string) => string
let devDownloadUrlForPack: (id: string) => string

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
let installJourneyPack: (id: string, zipUrl?: string, sha?: string | null) => Promise<void>
let installJourneyPackVerified: (
  id: string,
  zipUrl?: string,
  sha?: string | null,
  opts?: {
    maxAttempts?: number
    sleep?: (ms: number) => Promise<void>
    rand?: () => number
  },
) => Promise<void>
let journeyInstallBackoffMs: (retry: number, rand?: () => number) => number
let setInvoke: (fn: InvokeFn | null) => void
let resetInstallSingleflight: () => void

before(async () => {
  const { build } = await import("esbuild")
  const res = await build({
    entryPoints: [path.join(here, "journeyPack.ts")],
    bundle: true,
    format: "esm",
    write: false,
    platform: "neutral",
    define: { "import.meta.env.DEV": "false" },
    tsconfig: path.join(here, "../../tsconfig.json"),
  })
  const code = res.outputFiles[0].text
  const mod = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  )
  loadCourseGraph = mod.loadCourseGraph
  JourneyPackIntegrityError = mod.JourneyPackIntegrityError
  IMPORTANCE_WEIGHT = mod.IMPORTANCE_WEIGHT
  packIdForTarget = mod.packIdForTarget
  devDownloadUrlForPack = mod.devDownloadUrlForPack
  installJourneyPack = mod.installJourneyPack
  installJourneyPackVerified = mod.installJourneyPackVerified
  journeyInstallBackoffMs = mod.journeyInstallBackoffMs
  setInvoke = mod.__setJourneyPackInvokeForTests
  resetInstallSingleflight = mod.__resetJourneyInstallSingleflightForTests
})

/* -------------------------- atomic install harness ------------------------- */

const VALID_META = [
  { key: "course_id", value: "journey_en" },
  { key: "target_lang", value: "en" },
  { key: "content_version", value: "0.1.0" },
  { key: "schema_version", value: "1" },
  { key: "unit_count", value: "3" },
  { key: "item_count", value: "41" },
]

/** Scriptable `invoke` fake: records every command, drives install success and
 *  the `pack_meta` read that post-install verification depends on. */
function makeFakeInvoke() {
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = []
  const state = {
    install: (): Promise<unknown> => Promise.resolve({}),
    // Rows returned for the pack_meta read (readJourneyPackMeta). Empty ⇒ meta
    // unreadable ⇒ verification fails (mimics a truncated/malformed DB).
    metaRows: (): Array<Record<string, unknown>> => VALID_META,
  }
  const invoke: InvokeFn = async (cmd, args) => {
    calls.push({ cmd, args })
    if (cmd === "content_packs_install_from_url") return state.install()
    if (cmd === "content_packs_query_db") {
      return { columns: ["key", "value"], rows: state.metaRows() }
    }
    if (cmd === "content_packs_get_manifest_url") return "corpan-pack://localhost/journey_en/manifest.json"
    throw new Error(`unexpected command ${cmd}`)
  }
  const installCalls = () => calls.filter((c) => c.cmd === "content_packs_install_from_url")
  return { calls, state, invoke, installCalls }
}

test("installJourneyPack single-flights concurrent installs of the same pack", async () => {
  const f = makeFakeInvoke()
  setInvoke(f.invoke)
  resetInstallSingleflight()
  try {
    let release!: () => void
    const gate = new Promise<unknown>((r) => {
      release = () => r({})
    })
    f.state.install = () => gate

    // Two concurrent installs (Home-hero prefetch vs journey mount) must share
    // ONE underlying install — the shared Rust staging path is otherwise raced.
    const p1 = installJourneyPack("journey_en", "https://cdn.test/journey_en.zip")
    const p2 = installJourneyPack("journey_en", "https://cdn.test/journey_en.zip")
    release()
    await Promise.all([p1, p2])
    assert.equal(f.installCalls().length, 1, "concurrent installs coalesced")

    // After settlement the slot is freed: a fresh install runs again.
    await installJourneyPack("journey_en", "https://cdn.test/journey_en.zip")
    assert.equal(f.installCalls().length, 2, "post-settlement install not blocked")
  } finally {
    setInvoke(null)
  }
})

test("installJourneyPackVerified retries a failed integrity check, then succeeds", async () => {
  const f = makeFakeInvoke()
  setInvoke(f.invoke)
  resetInstallSingleflight()
  try {
    // First two verifications see an unreadable pack (empty pack_meta), the
    // third reads back cleanly — mirrors a transient corrupt install healing on
    // re-download.
    let verify = 0
    f.state.metaRows = () => {
      verify += 1
      return verify < 3 ? [] : VALID_META
    }
    const sleeps: number[] = []
    await installJourneyPackVerified("journey_en", "https://cdn.test/journey_en.zip", null, {
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      rand: () => 0.5,
    })
    assert.equal(f.installCalls().length, 3, "re-downloaded until integrity passed")
    assert.equal(sleeps.length, 2, "backed off before each of the 2 retries")
    assert.ok(sleeps.every((ms) => ms > 0), "backoff waited between attempts")
  } finally {
    setInvoke(null)
  }
})

test("installJourneyPackVerified throws after exhausting attempts (Retry is the fallback)", async () => {
  const f = makeFakeInvoke()
  setInvoke(f.invoke)
  resetInstallSingleflight()
  try {
    f.state.metaRows = () => [] // never readable
    await assert.rejects(
      installJourneyPackVerified("journey_en", "https://cdn.test/journey_en.zip", null, {
        maxAttempts: 2,
        sleep: async () => {},
      }),
      (err: Error) => {
        assert.ok(err instanceof JourneyPackIntegrityError, String(err))
        return true
      },
    )
    assert.equal(f.installCalls().length, 2, "exactly maxAttempts installs tried")
  } finally {
    setInvoke(null)
  }
})

test("journeyInstallBackoffMs grows exponentially with full jitter and caps", () => {
  const hi = (retry: number) => journeyInstallBackoffMs(retry, () => 1)
  assert.equal(hi(1), 400) // base
  assert.equal(hi(2), 800)
  assert.equal(hi(3), 1600)
  assert.equal(hi(10), 4000) // capped at JOURNEY_INSTALL_BACKOFF_CAP_MS
  // Full jitter: rand=0 halves the ceiling.
  assert.equal(journeyInstallBackoffMs(1, () => 0), 200)
})

/** node:sqlite-backed query fn emulating content_packs_query_db, with a
 *  per-call log so tests can assert pagination actually looped. */
function sqliteQueryFn(dbPath: string, log?: string[]): QueryFn {
  return async (sql, params, maxRows) => {
    log?.push(sql)
    const db = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const rows = db
        .prepare(sql)
        .all(...(params as (string | number | null)[])) as Row[]
      // emulate the Rust hard cap semantics: silent truncation at maxRows
      return rows.slice(0, Math.min(maxRows, 2000))
    } finally {
      db.close()
    }
  }
}

function corruptedCopy(mutate: (db: InstanceType<typeof DatabaseSync>) => void): string {
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "journey-loader-")),
    "course.sqlite3",
  )
  fs.copyFileSync(FIXTURE_DB, tmp)
  const db = new DatabaseSync(tmp)
  mutate(db)
  db.close()
  return tmp
}

test("fixture pack exists (built + checked in by dja/journey_pack)", () => {
  assert.ok(
    fs.existsSync(FIXTURE_DB),
    `fixture missing at ${FIXTURE_DB} — run the journey_pack fixture build`,
  )
})

test("loads the full graph with keyset pagination (page size 3 forces loops)", async () => {
  const log: string[] = []
  const graph = await loadCourseGraph(sqliteQueryFn(FIXTURE_DB, log), {
    pageSize: 3,
  })

  assert.equal(graph.courseId, "journey_en")
  assert.equal(graph.arcs.length, 2)
  assert.deepEqual(graph.arcs.map((a) => a.cefr), ["A0", "A1"]) // preA1 → A0
  assert.equal(graph.units.length, 3)
  assert.equal(Object.keys(graph.skills).length, 4)
  const items = Object.values(graph.items)
  assert.ok(items.length >= 35, `expected ~40 items, got ${items.length}`)

  // pagination genuinely looped: 41 items at page size 3 ⇒ 14 item pages
  const itemPages = log.filter((s) => s.includes("WHERE intro_order > ?"))
  assert.ok(itemPages.length >= 14, `expected >= 14 item pages, got ${itemPages.length}`)
  const joinPages = log.filter((s) => s.includes("(item_id, skill_id) > (?, ?)"))
  assert.ok(joinPages.length >= 2, "item_skills keyset pagination did not loop")

  // ref parsed through the ONE contract helper
  const water = graph.items["word:en:water"]
  assert.ok(water)
  assert.deepEqual(water.ref, { kind: "word", source: "en", id: "water" })

  // spine wiring
  const u2 = graph.units.find((u) => u.unitId === "en.a1.u02")
  assert.ok(u2)
  assert.ok(u2.skillIds.includes("en.skill.be-statements"))
  assert.deepEqual(graph.skills["en.skill.present-simple"].prereqs, [
    "en.skill.be-statements",
  ])
  // per-skill itemIds sorted by introOrder
  for (const s of Object.values(graph.skills)) {
    const orders = s.itemIds.map((i) => graph.items[i].introOrder)
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
  }

  // lesson/checkpoint layer
  assert.ok(graph.lessonRecipes["core"].slots.length > 0)
  assert.equal(graph.unitLessons["en.a1.u02"].length, 4)
  assert.equal(graph.checkpoints.filter((c) => c.scope === "unit").length, 3)
  assert.equal(graph.checkpoints.filter((c) => c.scope === "arc").length, 2)
  const gem = graph.rareCards.find((r) => r.rareCardId === "en.rare.gem.water")
  assert.ok(gem)
  assert.equal(gem.cardType, "etymology")
  assert.equal(gem.minUnitOrdinal, 1) // en.a1.u02 is the 2nd unit (index 1)

  // native activity templates come from the vendored registry
  const native = graph.activityTemplates.filter((t) => t.provider === "native")
  assert.ok(native.some((t) => t.activityType === "choice_pick"))
  assert.ok(native.some((t) => t.activityType === "grammar_note"))
})

test("page size does not change the loaded graph (1000 vs 3)", async () => {
  const big = await loadCourseGraph(sqliteQueryFn(FIXTURE_DB), { pageSize: 1000 })
  const small = await loadCourseGraph(sqliteQueryFn(FIXTURE_DB), { pageSize: 3 })
  assert.deepEqual(small, big)
})

test("importance maps through THE one weight table", async () => {
  const graph = await loadCourseGraph(sqliteQueryFn(FIXTURE_DB))
  assert.deepEqual(IMPORTANCE_WEIGHT, { 3: 2.0, 2: 1.5, 1: 1.2, 0: 1.0 })
  // fixture probes are authored importance 3 / 2 → weights 2.0 / 1.5
  const probeWeights = new Set(
    Object.values(graph.items).filter((i) => i.probe).map((i) => i.importance),
  )
  for (const w of probeWeights) assert.ok(w === 2.0 || w === 1.5)
})

test("substituteIds = same-skill substitutable items, ordered by introOrder", async () => {
  const graph = await loadCourseGraph(sqliteQueryFn(FIXTURE_DB))
  const anchor = graph.items["phrase:base:8210"] // Can I have some water?
  assert.ok(anchor)
  assert.ok(anchor.substituteIds && anchor.substituteIds.length > 0)
  for (const sub of anchor.substituteIds) {
    const subItem = graph.items[sub]
    assert.notEqual(sub, anchor.itemId)
    assert.ok(
      subItem.skillIds.some((s) => anchor.skillIds.includes(s)),
      `${sub} shares no skill with the anchor`,
    )
  }
  const orders = anchor.substituteIds.map((i) => graph.items[i].introOrder)
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
})

test("row-count assertion FIRES on a corrupted fixture (missing rows)", async () => {
  // Delete item rows so loaded count < pack_meta.item_count — the signature
  // of the Rust 2,000-row silent truncation this assertion exists to catch.
  const db = corruptedCopy((d) => {
    d.exec("DELETE FROM item_skills WHERE item_id IN (SELECT id FROM items WHERE intro_order > 30)")
    d.exec("DELETE FROM rare_cards")
    d.exec("DELETE FROM l1_overlays")
    d.exec("DELETE FROM items WHERE intro_order > 30")
  })
  await assert.rejects(
    loadCourseGraph(sqliteQueryFn(db), { pageSize: 3 }),
    (err: Error) => {
      assert.ok(err instanceof JourneyPackIntegrityError, String(err))
      assert.match(err.message, /item_count/)
      assert.match(err.message, /partial graph/)
      return true
    },
  )
})

test("row-count assertion FIRES on tampered pack_meta counts", async () => {
  const db = corruptedCopy((d) => {
    d.exec("UPDATE pack_meta SET value = '9999' WHERE key = 'item_count'")
  })
  await assert.rejects(
    loadCourseGraph(sqliteQueryFn(db)),
    JourneyPackIntegrityError,
  )
})

test("pack id + dev URL helpers use the underscore-canonical form", () => {
  assert.equal(packIdForTarget("en"), "journey_en")
  assert.equal(packIdForTarget("pt-BR"), "journey_pt_br")
  assert.equal(packIdForTarget("zh-Hans"), "journey_zh_hans")
  assert.equal(devDownloadUrlForPack("journey_en"), "/packs/journey/journey_en.zip")
})
