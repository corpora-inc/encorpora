// src/lib/storage/log.ts — AppendLog<T> (storage-analytics.md §3.5).
//
// Ordered, ring-buffered event streams on the IDB-LOG tier. Appends are O(1):
// the seq counter and count/bytes totals live in an in-memory meta mirror
// (persisted as a doc in ns `__logmeta` that rides the SAME transaction as
// the records, so they cannot diverge). No key scans on the append path —
// the eventStore.ts O(n log n)-per-append mistake stays dead; pruning is
// amortized behind 10% hysteresis and deletes by dense seq range.

import {
  idbDocGet,
  idbLogRange,
  idbLogRangeByTs,
  idbLogCount,
  idbLogDeleteRange,
  idbLogClear,
  type DocRecord,
  type LogRecordRaw,
} from "./idb"
import { WriteBatcher, appBatcher } from "./batch"
import { assertRegistered, resolveNsDecl } from "./namespaces"
import { countCorrupt, countNuked } from "./health"
import { estimateSize } from "./bytes"
import type { DocCodec } from "./doc"

export type LogRecord<T> = { seq: number; ts: number; entry: T }

const META_NS = "__logmeta"
const META_SCHEMA = 1
const SCAN_CHUNK = 500
/** Default read() page bound — reads never load an unbounded log. */
const DEFAULT_READ_LIMIT = 1_000

type LogMeta = { headSeq: number; tailSeq: number; count: number; bytes: number }

export interface AppendLog<T> {
  readonly ns: string
  /** Assigns the seq synchronously once the counter is loaded (appends made
   *  before that are queued in call order) and enqueues the write on the
   *  batcher. Resolves the assigned seq when the batch commits. Never
   *  throws; worst case the record lives in the memory mirror. */
  append(entry: T): Promise<number>
  /** Ranged read — never loads the whole log (limit defaults to 1,000). */
  read(opts?: {
    fromSeq?: number
    toSeq?: number
    fromTs?: number
    toTs?: number
    limit?: number
    reverse?: boolean
  }): Promise<LogRecord<T>[]>
  /** Streaming fold over a range — the aggregation workhorse (§4.5).
   *  Processes CHUNK=500 records per read so the main thread breathes. */
  scan<A>(
    fold: (acc: A, rec: LogRecord<T>) => A,
    seed: A,
    opts?: { fromSeq?: number; fromTs?: number; toTs?: number },
  ): Promise<A>
  count(): Promise<number>
  headSeq(): Promise<number>
  /** Ring-buffer enforcement. Returns records removed. */
  prune(opts: { keepLast?: number; maxBytes?: number; olderThanMs?: number }): Promise<number>
  flush(): Promise<void>
  clear(): Promise<void>
}

export function appendLog<T>(
  ns: string,
  codec: DocCodec<T>,
  opts?: {
    cap?: { maxRecords: number; maxBytes: number }
    /** Timestamp extractor for entries that carry their own clock (the local
     *  analytics envelope). Defaults to the injected `now`. */
    tsOf?: (entry: T) => number
    /** Injected clock (house rule: no naked Date.now in engine-grade logic). */
    now?: () => number
  },
  batcher: WriteBatcher = appBatcher,
): AppendLog<T> {
  assertRegistered(ns)
  const decl = resolveNsDecl(ns)
  const cap = opts?.cap ??
    (decl?.budget?.maxRecords
      ? {
          maxRecords: decl.budget.maxRecords,
          maxBytes: decl.budget.maxBytes ?? Number.POSITIVE_INFINITY,
        }
      : undefined)
  const now = opts?.now ?? (() => Date.now())
  const tsOf = opts?.tsOf ?? (() => now())

  // In-memory meta mirror (single source once loaded).
  let meta: LogMeta | null = null
  let initPromise: Promise<void> | null = null
  let pruning = false

  const metaDoc = (): DocRecord => ({
    ns: META_NS,
    id: ns,
    v: { ...(meta as LogMeta) },
    schema: META_SCHEMA,
    size: 64,
    updatedAt: now(),
  })

  const parseMeta = (raw: unknown): LogMeta | null => {
    const m = raw as Partial<LogMeta> | null
    if (
      m &&
      typeof m.headSeq === "number" &&
      typeof m.tailSeq === "number" &&
      typeof m.count === "number" &&
      typeof m.bytes === "number"
    ) {
      return { headSeq: m.headSeq, tailSeq: m.tailSeq, count: m.count, bytes: m.bytes }
    }
    return null
  }

  /** Rebuild the meta by one bounded pass over the stored records —
   *  corruption ladder level 2 for this namespace. */
  const rebuildMeta = async (): Promise<LogMeta> => {
    let head = 0
    let tail = 0
    let count = 0
    let bytes = 0
    let from = -Infinity
    for (;;) {
      const page = await idbLogRange(ns, from, Infinity, SCAN_CHUNK)
      if (page.length === 0) break
      for (const rec of page) {
        if (tail === 0 || rec.seq < tail) tail = rec.seq
        if (rec.seq > head) head = rec.seq
        count += 1
        bytes += rec.size ?? 0
      }
      if (page.length < SCAN_CHUNK) break
      from = page[page.length - 1].seq + 1
    }
    if (tail === 0) tail = head + 1
    return { headSeq: head, tailSeq: tail, count, bytes }
  }

  const init = (): Promise<void> => {
    if (initPromise) return initPromise
    initPromise = (async () => {
      try {
        const rec = await idbDocGet(META_NS, ns)
        meta = rec ? parseMeta(rec.v) : null
        if (!meta) meta = await rebuildMeta()
      } catch (err) {
        console.error(`[storage/log] meta init failed for ${ns}:`, err)
        meta = { headSeq: 0, tailSeq: 1, count: 0, bytes: 0 }
      }
    })()
    return initPromise
  }

  const decode = (raw: LogRecordRaw): LogRecord<T> | null => {
    let parsed: T | null = null
    try {
      parsed = codec.parse(raw.v)
    } catch (err) {
      console.error(`[storage/log] codec.parse threw for ${ns} seq ${raw.seq}:`, err)
    }
    if (parsed === null) {
      countCorrupt(ns)
      return null
    }
    return { seq: raw.seq, ts: raw.ts, entry: parsed }
  }

  const doPrune = async (o: {
    keepLast?: number
    maxBytes?: number
    olderThanMs?: number
  }): Promise<number> => {
    await init()
    await batcher.flush()
    const m = meta as LogMeta
    let removed = 0

    const deleteThrough = async (toSeq: number): Promise<void> => {
      if (toSeq < m.tailSeq) return
      const res = await idbLogDeleteRange(ns, m.tailSeq, toSeq)
      removed += res.removed
      m.count = Math.max(0, m.count - res.removed)
      m.bytes = Math.max(0, m.bytes - res.bytes)
      m.tailSeq = toSeq + 1
    }

    if (o.keepLast !== undefined) {
      await deleteThrough(m.headSeq - Math.max(0, o.keepLast))
    }
    if (o.olderThanMs !== undefined) {
      // ts is monotone non-decreasing in seq for append-time stamps, so
      // "older than" is a seq prefix: find the newest record at/below the
      // cutoff via the ts index, chunked.
      const cutoffTs = now() - o.olderThanMs
      for (;;) {
        const page = await idbLogRangeByTs(ns, 0, cutoffTs, SCAN_CHUNK)
        if (page.length === 0) break
        const maxSeq = page.reduce((a, r) => Math.max(a, r.seq), 0)
        await deleteThrough(maxSeq)
        if (page.length < SCAN_CHUNK) break
      }
    }
    if (o.maxBytes !== undefined) {
      // Drop oldest 10% chunks until under the byte budget.
      while (m.bytes > o.maxBytes && m.count > 0) {
        const chunk = Math.max(1, Math.ceil(m.count * 0.1))
        await deleteThrough(m.tailSeq + chunk - 1)
      }
    }

    // Opportunistic meta-vs-store verification (level 2): rebuild on drift.
    try {
      const actual = await idbLogCount(ns)
      const parked = batcher.peekLogsFor(ns).length
      if (Math.abs(actual + parked - m.count) > Math.max(10, m.count * 0.1)) {
        console.error(
          `[storage/log] meta drift for ${ns} (meta ${m.count}, store ${actual}) — rebuilding meta.`,
        )
        meta = await rebuildMeta()
      }
    } catch {
      /* verification is best-effort */
    }

    void batcher.enqueueDoc(metaDoc())
    return removed
  }

  const maybePrune = (): void => {
    if (!cap || pruning) return
    const m = meta as LogMeta
    // 10% hysteresis: pruning is amortized, never per-append.
    if (m.count <= cap.maxRecords * 1.1 && m.bytes <= cap.maxBytes) return
    pruning = true
    void doPrune({ keepLast: cap.maxRecords, maxBytes: cap.maxBytes })
      .catch((err) => console.error(`[storage/log] ring prune failed for ${ns}:`, err))
      .finally(() => {
        pruning = false
      })
  }

  return {
    ns,

    async append(entry) {
      try {
        await init()
        const m = meta as LogMeta
        m.headSeq += 1
        m.count += 1
        const seq = m.headSeq
        const size = estimateSize(entry)
        m.bytes += size
        const rec: LogRecordRaw = { ns, seq, ts: tsOf(entry), v: entry, size }
        const commit = batcher.enqueueLog(rec)
        // The meta rides the same transaction (coalesced doc put).
        void batcher.enqueueDoc(metaDoc())
        await commit
        maybePrune()
        return seq
      } catch (err) {
        console.error(`[storage/log] append failed for ${ns}:`, err)
        return meta?.headSeq ?? 0
      }
    },

    async read(o) {
      try {
        await init()
        const m = meta as LogMeta
        const limit = o?.limit ?? DEFAULT_READ_LIMIT
        let committed: LogRecordRaw[]
        if (o?.fromTs !== undefined || o?.toTs !== undefined) {
          committed = await idbLogRangeByTs(ns, o?.fromTs ?? 0, o?.toTs ?? Infinity, limit)
        } else {
          let from = o?.fromSeq ?? m.tailSeq
          const to = Math.min(o?.toSeq ?? m.headSeq, m.headSeq)
          if (o?.reverse) from = Math.max(from, to - limit + 1)
          committed = await idbLogRange(ns, from, to, limit)
        }
        // Read-your-writes: merge pending/parked records, dedup by seq.
        const bySeq = new Map<number, LogRecordRaw>()
        for (const r of committed) bySeq.set(r.seq, r)
        for (const r of batcher.peekLogsFor(ns)) {
          const inSeqRange =
            (o?.fromSeq === undefined || r.seq >= o.fromSeq) &&
            (o?.toSeq === undefined || r.seq <= o.toSeq)
          const inTsRange =
            (o?.fromTs === undefined || r.ts >= o.fromTs) &&
            (o?.toTs === undefined || r.ts <= o.toTs)
          if (inSeqRange && inTsRange && !bySeq.has(r.seq)) bySeq.set(r.seq, r)
        }
        const merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq)
        const window = o?.reverse ? merged.slice(-limit).reverse() : merged.slice(0, limit)
        const out: LogRecord<T>[] = []
        for (const raw of window) {
          const rec = decode(raw)
          if (rec) out.push(rec)
        }
        return out
      } catch (err) {
        console.error(`[storage/log] read failed for ${ns}:`, err)
        return []
      }
    },

    async scan(fold, seed, o) {
      try {
        await init()
        await batcher.flush() // committed view is complete after this
        const m = meta as LogMeta
        let acc = seed
        let from = o?.fromSeq ?? m.tailSeq
        if (o?.fromTs !== undefined) {
          const first = await idbLogRangeByTs(ns, o.fromTs, Infinity, 1)
          if (first.length === 0) return acc
          from = Math.max(from, first[0].seq)
        }
        for (;;) {
          const page = await idbLogRange(ns, from, m.headSeq, SCAN_CHUNK)
          if (page.length === 0) break
          for (const raw of page) {
            if (o?.fromTs !== undefined && raw.ts < o.fromTs) continue
            if (o?.toTs !== undefined && raw.ts > o.toTs) continue
            const rec = decode(raw)
            if (rec) acc = fold(acc, rec)
          }
          if (page.length < SCAN_CHUNK) break
          from = page[page.length - 1].seq + 1
        }
        // Records parked in the memory mirror (degraded sessions) still count.
        for (const raw of batcher.peekLogsFor(ns)) {
          if (o?.fromSeq !== undefined && raw.seq < o.fromSeq) continue
          if (o?.fromTs !== undefined && raw.ts < o.fromTs) continue
          if (o?.toTs !== undefined && raw.ts > o.toTs) continue
          const rec = decode(raw)
          if (rec) acc = fold(acc, rec)
        }
        return acc
      } catch (err) {
        console.error(`[storage/log] scan failed for ${ns}:`, err)
        return seed
      }
    },

    async count() {
      await init()
      return (meta as LogMeta).count
    },

    async headSeq() {
      await init()
      return (meta as LogMeta).headSeq
    },

    prune(o) {
      return doPrune(o).catch((err) => {
        console.error(`[storage/log] prune failed for ${ns}:`, err)
        return 0
      })
    },

    flush() {
      return batcher.flush()
    },

    async clear() {
      try {
        await init()
        batcher.clearNs(ns)
        await idbLogClear(ns)
        meta = { headSeq: 0, tailSeq: 1, count: 0, bytes: 0 }
        await batcher.enqueueDoc(metaDoc())
      } catch (err) {
        console.error(`[storage/log] clear failed for ${ns}:`, err)
        countNuked(ns)
      }
    },
  }
}
