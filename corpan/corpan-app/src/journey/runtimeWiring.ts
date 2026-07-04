// src/journey/runtimeWiring.ts — PRODUCTION wiring for the runtime core
// (feed-ux §2.3 + W5's ResolverDeps wiring contract, verbatim):
//
//   deps.getEntryById  = (id, src) => hostApi.getEntryById(id, src).catch(() => null)
//   deps.queryPackDb   = hostApi.queryPackDb verbatim
//   deps.packFileUrl   = corpan-pack:// URL builder (same base installed packs use)
//   deps.log           → local analytics
//   resolver.invalidate() on session end / course-stack switch / pack installs
//
// runtime.ts stays import-light; everything Tauri/storage-flavored lives here
// so the headless smoke test never loads it.

import type { HostApi } from "../contentPacks/types"
import { recordLocal, createJourneyPersistence, type LocalEventPayload } from "../lib/localAnalytics"
import { getInstalledManifestUrl } from "../contentPacks/native"
import { beginActivitySession, endActivitySession } from "../contentPacks/activitySchemas"
import { createHostApi } from "../contentPacks/hostApi"
import {
  fetchJourneyPackCatalog,
  findJourneyPackForTarget,
  visibleJourneyPacks,
} from "../contentPacks/journeyPackCatalog"
import { getAppVersion } from "../lib/appVersion"
import { useCatalogStore } from "../store/catalog"
import { useEntitlementStore } from "../store/entitlements"
import { useJourneyPacksStore } from "../store/journeyPacks"
import { useProgressStore } from "../store/progress"
import {
  installJourneyPack,
  isJourneyPackInstalled,
  loadCourseGraphFromPack,
  readJourneyPackMeta,
} from "../util/journeyPack"
import type { CapabilityHostApi } from "@shared/capabilities/core"
import { createJourneyEngine, itemCardCodec, systemClock } from "./engine/index.ts"
import { createResolver, type ResolveContext, type ResolverDeps } from "./content/resolve.ts"
import { createJourneyQuota } from "./quota.ts"
import { courseKeyOf, localDayOf } from "../store/journey.ts"
import type { StreakPorts } from "./streakV2.ts"
import type { ActivitySessionPort, JourneyRuntimeDeps, RecordFn } from "./runtime.ts"

/** The real single-owner activity session (activity-contract §3.2, R8). */
export const activitySessionPort: ActivitySessionPort = {
  begin: (packId, spec, callbacks) => beginActivitySession(packId, spec, callbacks),
  end: () => endActivitySession(),
}

/** Course id convention (course-pack.md): journey_<targetLang>. */
export function journeyCourseIdFor(targetLang: string): string {
  return `journey_${targetLang.split("-")[0]}`
}

/**
 * Build ResolverDeps over a live HostApi. `findInstalledWordPack` /
 * `findInstalledNarrationPack` consult the installed registries the host
 * already exposes; misses resolve null (the resolver treats that as
 * "no enrichment", never an error).
 */
export function buildResolverDeps(
  hostApi: Pick<HostApi, "getEntryById" | "queryPackDb" | "getRandomEntries">,
  opts: {
    findInstalledWordPack?: (nativeLang: string, targetLang: string) => string | null
    findInstalledNarrationPack?: (bookId: string, lang: string) => string | null
    findInstalledPack?: (packId: string) => boolean
    fetchPackText?: (packId: string, relPath: string) => Promise<string>
    /** Languages the rung-3 top-up needs translations in — [targetLang,
     *  nativeLang] in practice. Forwarded as the host sampler's
     *  `languageCodes` filter so drawn entries actually carry the faces
     *  `phraseItemFromEntry` builds (a missing target face is discarded). */
    randomEntryLanguages?: string[]
  } = {},
): ResolverDeps {
  // packFileUrl must be sync (ResolverDeps contract); manifest URLs resolve
  // async from Rust, so we keep a primed cache. Unprimed packs return a
  // corpan-pack:// path in the canonical shape; priming happens on first use.
  const baseUrlCache = new Map<string, string>()
  const prime = (packId: string): void => {
    if (baseUrlCache.has(packId)) return
    baseUrlCache.set(packId, `corpan-pack://localhost/${packId}/`)
    void getInstalledManifestUrl(packId)
      .then((manifestUrl) => {
        baseUrlCache.set(packId, new URL(".", manifestUrl).toString())
      })
      .catch(() => {})
  }

  return {
    getEntryById: (entryId, source) =>
      hostApi.getEntryById(entryId, source).catch(() => null),
    queryPackDb: (q) => {
      // Optional on legacy HostApi shapes; the journey host always has it.
      if (!hostApi.queryPackDb) return Promise.reject(new Error("queryPackDb unavailable"))
      return hostApi.queryPackDb(q)
    },
    // Rung-3 distractor top-up (content-resolver.md §4.2): phrase-kind
    // pathological starvation ONLY. Rides the host's FILTERED random-entries
    // surface (hostApi.getRandomEntries options form → Rust
    // get_random_entries_with_translations, whose relaxation ladder degrades
    // a starved filter instead of returning empty). Deterministic-compatible
    // by contract: the top-up only FEEDS the sampler pool — selection,
    // elimination order and tie-breaks stay on the card PRNG in
    // distractors.ts, and rung-3 rows carry b=null so they rank worst-fit.
    // Never throws: a missing seam or host error resolves [] (the sampler
    // reports shortfall instead of crashing a card).
    getRandomEntries: async (q) => {
      if (!hostApi.getRandomEntries) return []
      try {
        const langs = opts.randomEntryLanguages?.filter((l) => !!l) ?? []
        return await hostApi.getRandomEntries({
          count: q.count,
          ...(q.domains && q.domains.length > 0 ? { domains: q.domains } : {}),
          ...(q.levels && q.levels.length > 0 ? { levels: q.levels } : {}),
          ...(langs.length > 0 ? { languageCodes: langs } : {}),
        })
      } catch {
        return []
      }
    },
    fetchPackText:
      opts.fetchPackText ??
      (async (packId, relPath) => {
        const { fetchContentPackText } = await import("../contentPacks/native")
        prime(packId)
        return fetchContentPackText(new URL(relPath, baseUrlCache.get(packId)).toString())
      }),
    packFileUrl: (packId, relPath) => {
      prime(packId)
      return new URL(relPath, baseUrlCache.get(packId)).toString()
    },
    findInstalledWordPack: opts.findInstalledWordPack ?? (() => null),
    findInstalledNarrationPack: opts.findInstalledNarrationPack ?? (() => null),
    findInstalledPack: opts.findInstalledPack ?? (() => true),
    log: (event, data) => {
      // Structured resolver events ride local analytics as pack-style facts.
      recordLocal({ type: `pack:journey:${event}`, payload: flatten(data) } as LocalEventPayload)
    },
  }
}

function flatten(data: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v
    else out[k] = JSON.stringify(v)
  }
  return out
}

/** Analytics binding for the runtime core. */
export function localAnalyticsRecord(courseId: string): RecordFn {
  return (e) => recordLocal(e as unknown as LocalEventPayload, { courseId })
}

export function makeResolveContext(
  courseId: string,
  targetLang: string,
  nativeLang?: string,
): ResolveContext {
  return nativeLang ? { courseId, targetLang, nativeLang } : { courseId, targetLang }
}

// ---------------------------------------------------------- streak ports (§1.8)

/** Streak v2 extra "showed up" day sources (feed-ux §1.8, W10 item 13): book
 *  days from store/progress.ts. Formats are reconciled HERE — progress.ts's
 *  own `localDate` is unpadded AND 0-based-month ("2026-6-3"), so we convert
 *  each `lastOpenedAt` ISO stamp straight to the journey's `YYYY-MM-DD`
 *  localDay convention instead of consuming progress's day strings. */
export function journeyStreakPorts(): StreakPorts {
  return {
    extraDayProviders: [
      () =>
        Object.values(useProgressStore.getState().byKey).map((p) =>
          localDayOf(new Date(p.lastOpenedAt)),
        ),
    ],
  }
}

// ------------------------------------------------------ capability host slice

/** Adapt the real HostApi to the capability-modules host slice. Structural
 *  except queryPackDb, whose row shape differs (records vs positional). */
export function capabilityHostFromHostApi(hostApi: HostApi): CapabilityHostApi {
  return {
    speak: (uiCode, text) => hostApi.speak(uiCode, text),
    getStackConfig: () => hostApi.getStackConfig(),
    ...(hostApi.stopSpeech ? { stopSpeech: hostApi.stopSpeech } : {}),
    ...(hostApi.stt ? { stt: hostApi.stt as unknown as CapabilityHostApi["stt"] } : {}),
    ...(hostApi.queryPackDb
      ? {
          queryPackDb: async (q: {
            sql: string
            params?: unknown[]
            dbName?: string
            packId?: string
            maxRows?: number
          }) => {
            const out = await hostApi.queryPackDb!(q)
            return {
              columns: out.columns,
              rows: out.rows.map((row) => out.columns.map((c) => row[c])),
            }
          },
        }
      : {}),
    ...(hostApi.entitlement
      ? { entitlement: { isSubscribed: hostApi.entitlement.isSubscribed } }
      : {}),
  }
}

// ------------------------------------------------- production deps (W10 item 8)

export interface BuiltJourney {
  deps: JourneyRuntimeDeps
  hostApi: HostApi
  capabilityHost: CapabilityHostApi
  /** Authoritative target language (pack_meta.target_lang casing). */
  targetLang: string
  packId: string
}

/** Ensure the course pack for `targetLang` is installed; returns its pack id.
 *  Resolution order: installed registry → disk probe → catalog install. */
async function ensureJourneyPackInstalled(targetLang: string): Promise<string> {
  const derived = journeyCourseIdFor(targetLang)
  const registry = useJourneyPacksStore.getState()
  const registered = registry
    .list()
    .find((p) => p.targetLang.toLowerCase() === targetLang.toLowerCase())
  if (registered && (await isJourneyPackInstalled(registered.id))) return registered.id
  if (await isJourneyPackInstalled(derived)) return derived

  const catalog = await fetchJourneyPackCatalog()
  if (!catalog) throw new Error(`[journey] no course pack installed for ${targetLang} and the index is unreachable`)
  const appVersion = await getAppVersion()
  const devMode = useCatalogStore.getState().devMode
  const entry = findJourneyPackForTarget(
    visibleJourneyPacks(catalog, appVersion, devMode),
    targetLang,
  )
  if (!entry) throw new Error(`[journey] no course pack available for ${targetLang}`)
  await installJourneyPack(entry.id, entry.zipUrl, entry.sha256 ?? null)
  // Register the install (phrasePacks pattern) so cold-start renders offline.
  const meta = await readJourneyPackMeta(entry.id)
  useJourneyPacksStore.getState().register({
    id: entry.id,
    targetLang: meta?.targetLang ?? entry.targetLang,
    version: meta?.contentVersion ?? entry.version,
    schemaVersion: meta?.schemaVersion ?? entry.schemaVersion,
    name: entry.name,
    nameLocalized: entry.nameLocalized,
    unitCount: meta?.unitCount ?? 0,
    itemCount: meta?.itemCount ?? 0,
    installedAt: new Date().toISOString(),
    sizeBytes: Math.round((entry.sizeMb ?? 0) * 1024 * 1024),
    source: "catalog",
  })
  return entry.id
}

/**
 * PRODUCTION JourneyRuntimeDeps builder (the JourneySurface.tsx header
 * recipe): loadCourseGraph over the installed pack (targetLang rides
 * pack_meta.target_lang — item 15), the real engine over the shared
 * local-analytics persistence (R15) + injected system clock,
 * buildResolverDeps over a live HostApi, the journey_daily quota gate,
 * localAnalyticsRecord (the ONE activity_result writer, §5.3), the
 * single-owner activitySessionPort, STT probes off hostApi.stt (item 14 —
 * absent/false ⇒ speak_echo degrades to listen_type, kept), and streak v2
 * book-day providers (item 13).
 */
export async function buildJourneyDeps(opts: {
  stackId: string
  targetLang: string
  nativeLang?: string
  checkpointCadence?: number
}): Promise<BuiltJourney> {
  const packId = await ensureJourneyPackInstalled(opts.targetLang)
  const graph = await loadCourseGraphFromPack(packId)
  const targetLang = graph.targetLang || opts.targetLang
  const courseId = graph.courseId

  const hostApi = createHostApi()
  const resolverDeps = buildResolverDeps(hostApi, {
    findInstalledPack: (pid) =>
      pid === packId || !!useJourneyPacksStore.getState().get(pid),
    // Rung-3 top-up draws must carry the faces the sampler builds: the
    // answer face (targetLang, required) and the prompt face (nativeLang,
    // when the stack has one).
    randomEntryLanguages: [
      targetLang,
      ...(opts.nativeLang ? [opts.nativeLang] : []),
    ],
  })
  const ctx = makeResolveContext(courseId, targetLang, opts.nativeLang)
  const resolver = createResolver(resolverDeps, ctx)

  const engine = createJourneyEngine({
    key: { stackId: opts.stackId, courseId },
    graph,
    persistence: createJourneyPersistence(opts.stackId, courseId, itemCardCodec),
    clock: systemClock,
  })

  const quota = await createJourneyQuota({
    isSubscribed: () => useEntitlementStore.getState().subscription.active,
  })

  const deps: JourneyRuntimeDeps = {
    engine,
    resolver,
    resolverDeps,
    ctx,
    graph,
    courseKey: courseKeyOf(opts.stackId, courseId),
    quota,
    ...(opts.checkpointCadence !== undefined
      ? { constraints: { checkpointCadence: opts.checkpointCadence } }
      : {}),
    record: localAnalyticsRecord(courseId),
    streakPorts: journeyStreakPorts(),
    // Item 14: cheap availability probe + early model load off the STT plugin
    // (pronunciation-coach precedent: prepare() is local-only, never a
    // download). Fail closed — absent/false ⇒ the runtime's speak_echo →
    // listen_type degrade stays in charge.
    sttAvailable: () =>
      hostApi.stt ? hostApi.stt.isAvailable().catch(() => false) : Promise.resolve(false),
    sttPrepare: async () => {
      await hostApi.stt?.prepare().catch(() => undefined)
    },
    log: (event, data) => resolverDeps.log?.(event, data),
    activitySession: activitySessionPort,
  }

  return {
    deps,
    hostApi,
    capabilityHost: capabilityHostFromHostApi(hostApi),
    targetLang,
    packId,
  }
}
