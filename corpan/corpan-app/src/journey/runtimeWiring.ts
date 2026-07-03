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
import { recordLocal, type LocalEventPayload } from "../lib/localAnalytics"
import { getInstalledManifestUrl } from "../contentPacks/native"
import { beginActivitySession, endActivitySession } from "../contentPacks/activitySchemas"
import type { ResolveContext, ResolverDeps } from "./content/resolve.ts"
import type { ActivitySessionPort, RecordFn } from "./runtime.ts"

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
  hostApi: Pick<HostApi, "getEntryById" | "queryPackDb">,
  opts: {
    findInstalledWordPack?: (nativeLang: string, targetLang: string) => string | null
    findInstalledNarrationPack?: (bookId: string, lang: string) => string | null
    findInstalledPack?: (packId: string) => boolean
    fetchPackText?: (packId: string, relPath: string) => Promise<string>
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
    getRandomEntries: async () => [], // rung-3 top-ups only; W10 may wire hostApi.getRandomEntriesFiltered
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
