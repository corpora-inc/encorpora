// src/lib/storage/doctor.ts — dev-only storage doctor (storage-analytics.md §6).
//
// Programmatic usage/corruption reporting over every tier. Dev chrome only:
// nothing here runs on a user path; the panel/devDebug wiring calls
// `storageDoctor.report()` on demand. Strings are plain English on purpose
// (established dev-surface exemption from the i18n gate).

import {
  idbEstimate,
  idbHealth,
  idbAll,
  idbDocAll,
  idbLogCount,
  type DocRecord,
} from "./idb"
import { NAMESPACES, resolveNsDecl, unregisteredNamespaces } from "./namespaces"
import { healthCounters } from "./health"
import { appBatcher } from "./batch"
import { blobFsStats } from "./blob"
import { storage, __memoryMirrorSize } from "./index"

const TINY_KEY_BYTES_LIMIT = 64 * 1024
const TINY_TOTAL_BYTES_LIMIT = 512 * 1024
const LOG_CAP_WARN_PCT = 90

export type StorageDoctorReport = {
  localStorage: { totalBytes: number; keys: Array<{ key: string; bytes: number }> }
  idb: {
    estimate: { usage: number; quota: number } | null
    kv: Array<{ ns: string; records: number; bytes: number; volatile: number }>
    docs: Array<{ ns: string; records: number; bytes: number; schema?: number }>
    logs: Array<{ ns: string; records: number; bytes: number; headSeq: number; capPct: number }>
  }
  fs: Array<{ ns: string; files: number; bytes: number }>
  health: {
    corruptRecords: Record<string, number>
    nukedNamespaces: Record<string, number>
    degradedWrites: number
    memoryMirrorEntries: number
    dbRebuiltAt: number | null
    openFailures: number
    packEventDrops: Record<string, number>
    packKvDrops: Record<string, number>
  }
  violations: string[]
}

function lsUsage(): StorageDoctorReport["localStorage"] {
  const keys: Array<{ key: string; bytes: number }> = []
  let total = 0
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      const val = localStorage.getItem(key) ?? ""
      const bytes = (key.length + val.length) * 2
      keys.push({ key, bytes })
      total += bytes
    }
  } catch {
    /* localStorage unavailable */
  }
  keys.sort((a, b) => b.bytes - a.bytes)
  return { totalBytes: total, keys }
}

async function report(): Promise<StorageDoctorReport> {
  const ls = lsUsage()
  const estimate = await idbEstimate()

  // kv namespaces (full scan — doctor is dev-only).
  const kvByNs = new Map<string, { records: number; bytes: number; volatile: number }>()
  for (const rec of await idbAll()) {
    const ns = rec.fqk.split("::")[0] ?? rec.fqk
    const agg = kvByNs.get(ns) ?? { records: 0, bytes: 0, volatile: 0 }
    agg.records += 1
    agg.bytes += rec.size ?? 0
    if (rec.volatile) agg.volatile += 1
    kvByNs.set(ns, agg)
  }
  const kv = [...kvByNs.entries()].map(([ns, a]) => ({ ns, ...a }))

  // doc namespaces (full scan) + collect the log metas riding in __logmeta.
  const docsByNs = new Map<string, { records: number; bytes: number; schema?: number }>()
  const logMetas: DocRecord[] = []
  for (const rec of await idbDocAll()) {
    if (rec.ns === "__logmeta") {
      logMetas.push(rec)
      continue
    }
    const agg = docsByNs.get(rec.ns) ?? { records: 0, bytes: 0, schema: rec.schema }
    agg.records += 1
    agg.bytes += rec.size ?? 0
    agg.schema = rec.schema
    docsByNs.set(rec.ns, agg)
  }
  const docs = [...docsByNs.entries()].map(([ns, a]) => ({ ns, ...a }))

  const logs: StorageDoctorReport["idb"]["logs"] = []
  for (const metaRec of logMetas) {
    const m = metaRec.v as { headSeq?: number; count?: number; bytes?: number } | null
    const ns = metaRec.id
    const records = m?.count ?? (await idbLogCount(ns))
    const decl = resolveNsDecl(ns)
    const capRecords = decl?.budget?.maxRecords
    logs.push({
      ns,
      records,
      bytes: m?.bytes ?? 0,
      headSeq: m?.headSeq ?? 0,
      capPct: capRecords ? Math.round((records / capRecords) * 100) : 0,
    })
  }

  const fs = await blobFsStats()
  const dbHealth = idbHealth()

  const violations: string[] = []
  for (const ns of unregisteredNamespaces()) {
    violations.push(`unregistered namespace used this session: "${ns}"`)
  }
  for (const { key, bytes } of ls.keys) {
    if (bytes > TINY_KEY_BYTES_LIMIT) {
      violations.push(`localStorage key "${key}" is ${Math.round(bytes / 1024)}KB (> 64KB)`)
    }
  }
  if (ls.totalBytes > TINY_TOTAL_BYTES_LIMIT) {
    violations.push(
      `localStorage total ${Math.round(ls.totalBytes / 1024)}KB exceeds the 512KB TINY-tier target`,
    )
  }
  for (const l of logs) {
    if (l.capPct >= LOG_CAP_WARN_PCT) {
      violations.push(`log "${l.ns}" is at ${l.capPct}% of its record cap`)
    }
  }

  return {
    localStorage: ls,
    idb: { estimate, kv, docs, logs },
    fs,
    health: {
      corruptRecords: { ...healthCounters.corruptRecords },
      nukedNamespaces: { ...healthCounters.nukedNamespaces },
      degradedWrites: healthCounters.degradedWrites,
      memoryMirrorEntries: __memoryMirrorSize() + appBatcher.mirrorSize(),
      dbRebuiltAt: dbHealth.dbRebuiltAt,
      openFailures: dbHealth.openFailures,
      packEventDrops: { ...healthCounters.packEventDrops },
      packKvDrops: { ...healthCounters.packKvDrops },
    },
    violations,
  }
}

export const storageDoctor = {
  report,
  async violations(): Promise<string[]> {
    return (await report()).violations
  },
}

/**
 * Dev wiring: attach the doctor to `window.__corpanDebug.storage`. Called
 * from util/devDebug.ts (DEV builds only — tree-shaken from production).
 * Kept here so devDebug needs exactly one line.
 */
export function installStorageDoctorDebug(): void {
  const w = globalThis as Record<string, unknown>
  const dbg = (w.__corpanDebug ||= {}) as Record<string, unknown>
  dbg.storage = {
    report: () => report(),
    violations: () => storageDoctor.violations(),
    evict: (n = 16) => storage.evictLargeTier(n),
    /** Nuke one namespace. Guarded: pass the ns twice to confirm. */
    clearNs: async (ns: string, confirm?: string) => {
      if (confirm !== ns) {
        console.warn(`[storageDoctor] refusing: call clearNs("${ns}", "${ns}") to confirm.`)
        return false
      }
      const { docStore } = await import("./doc")
      await docStore(ns, { schemaVersion: 0, parse: (v) => v ?? null }).clear()
      return true
    },
    rebuildRollups: async () => {
      const { rebuildRollups } = await import("../localAnalytics/rollups")
      return rebuildRollups()
    },
    /** Seed n synthetic local-analytics events (test data for the panel). */
    seedEvents: async (n = 100) => {
      const { seedSyntheticEvents } = await import("../localAnalytics")
      return seedSyntheticEvents(n)
    },
  }
  console.info(
    "[corpanDebug] storage doctor: storage.report() storage.violations() " +
      "storage.evict(n) storage.clearNs(ns, ns) storage.rebuildRollups() storage.seedEvents(n)",
  )
}

/** Print NAMESPACES in a console.table-friendly shape (panel helper). */
export function declaredNamespaces(): Array<{ ns: string } & (typeof NAMESPACES)[string]> {
  return Object.entries(NAMESPACES).map(([ns, decl]) => ({ ns, ...decl }))
}
