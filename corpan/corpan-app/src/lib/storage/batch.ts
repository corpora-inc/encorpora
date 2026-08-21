// src/lib/storage/batch.ts — WriteBatcher (storage-analytics.md §3.9).
//
// Coalesces DocStore puts/deletes and AppendLog appends into ONE readwrite
// IndexedDB transaction spanning the `docs` + `log` stores. Flush triggers:
// a 250ms debounce after the first enqueue, OR maxPending reached, OR an
// explicit flush(), OR pagehide / visibilitychange→hidden (registered once
// for the shared appBatcher).
//
// Quota-safety contract (inherited from ./index.ts verbatim): a commit that
// fails evicts LARGE-tier entries and retries ONCE; a second failure parks
// the records in a session-only memory mirror and RESOLVES — product code
// never sees a throw, the doctor counts `degradedWrites`. Reads consult the
// pending batch AND the mirror first (read-your-writes).

import {
  idbBatchWrite,
  type DocRecord,
  type LogRecordRaw,
} from "./idb"
import { countDegradedWrites } from "./health"

const SEP = "::"

type Waiter = () => void

export type PendingDocState =
  | { kind: "put"; rec: DocRecord }
  | { kind: "delete" }
  | undefined

export class WriteBatcher {
  private readonly maxDelayMs: number
  private readonly maxPendingCount: number

  // The open batch.
  private pendingDocs = new Map<string, DocRecord>()
  private pendingDocDeletes = new Map<string, { ns: string; id: string }>()
  private pendingLogs: LogRecordRaw[] = []
  private waiters: Waiter[] = []

  // Session-only memory mirror for records whose durable commit failed twice.
  // Doc value null = a delete that never landed.
  private mirrorDocs = new Map<string, DocRecord | null>()
  private mirrorLogs = new Map<string, LogRecordRaw[]>()

  private timer: ReturnType<typeof setTimeout> | null = null
  private flushPromise: Promise<void> | null = null

  constructor(opts?: { maxDelayMs?: number; maxPending?: number }) {
    this.maxDelayMs = opts?.maxDelayMs ?? 250
    this.maxPendingCount = opts?.maxPending ?? 64
  }

  /* ------------------------------- enqueue ------------------------------- */

  /** Enqueue a doc put. Repeated puts of the same (ns, id) within a window
   *  keep only the last. Resolves when the batch COMMITS (or parks). */
  enqueueDoc(rec: DocRecord): Promise<void> {
    const k = `${rec.ns}${SEP}${rec.id}`
    this.pendingDocDeletes.delete(k)
    this.pendingDocs.set(k, rec)
    return this.awaitCommit()
  }

  enqueueDocDelete(ns: string, id: string): Promise<void> {
    const k = `${ns}${SEP}${id}`
    this.pendingDocs.delete(k)
    this.pendingDocDeletes.set(k, { ns, id })
    return this.awaitCommit()
  }

  enqueueLog(rec: LogRecordRaw): Promise<void> {
    this.pendingLogs.push(rec)
    return this.awaitCommit()
  }

  pendingCount(): number {
    return this.pendingDocs.size + this.pendingDocDeletes.size + this.pendingLogs.length
  }

  /* --------------------------- read-your-writes -------------------------- */

  /** Pending/parked state for one doc key — checked BEFORE IndexedDB. */
  peekDoc(ns: string, id: string): PendingDocState {
    const k = `${ns}${SEP}${id}`
    const put = this.pendingDocs.get(k)
    if (put) return { kind: "put", rec: put }
    if (this.pendingDocDeletes.has(k)) return { kind: "delete" }
    const mirrored = this.mirrorDocs.get(k)
    if (mirrored === null) return { kind: "delete" }
    if (mirrored) return { kind: "put", rec: mirrored }
    return undefined
  }

  /** Every pending/parked doc state in a namespace (for getAll overlays). */
  peekDocsFor(ns: string): { puts: DocRecord[]; deletedIds: string[] } {
    const puts = new Map<string, DocRecord>()
    const deleted = new Set<string>()
    const consider = (k: string, rec: DocRecord | null) => {
      if (!k.startsWith(`${ns}${SEP}`)) return
      const id = k.slice(ns.length + SEP.length)
      if (rec === null) deleted.add(id)
      else puts.set(id, rec)
    }
    for (const [k, rec] of this.mirrorDocs) consider(k, rec)
    for (const [k] of this.pendingDocDeletes) consider(k, null)
    for (const [k, rec] of this.pendingDocs) consider(k, rec)
    for (const id of deleted) puts.delete(id)
    return { puts: [...puts.values()], deletedIds: [...deleted] }
  }

  /** Pending + parked log records for one namespace, ascending seq. */
  peekLogsFor(ns: string): LogRecordRaw[] {
    const out = [
      ...(this.mirrorLogs.get(ns) ?? []),
      ...this.pendingLogs.filter((r) => r.ns === ns),
    ]
    out.sort((a, b) => a.seq - b.seq)
    return out
  }

  /** Drop every pending/parked record for a namespace (clear()/nuke path). */
  clearNs(ns: string): void {
    const prefix = `${ns}${SEP}`
    for (const k of [...this.pendingDocs.keys()]) if (k.startsWith(prefix)) this.pendingDocs.delete(k)
    for (const k of [...this.pendingDocDeletes.keys()]) if (k.startsWith(prefix)) this.pendingDocDeletes.delete(k)
    for (const k of [...this.mirrorDocs.keys()]) if (k.startsWith(prefix)) this.mirrorDocs.delete(k)
    this.pendingLogs = this.pendingLogs.filter((r) => r.ns !== ns)
    this.mirrorLogs.delete(ns)
  }

  /** Doctor: how many records are parked in the memory mirror right now. */
  mirrorSize(): number {
    let logs = 0
    for (const arr of this.mirrorLogs.values()) logs += arr.length
    return this.mirrorDocs.size + logs
  }

  /* -------------------------------- flush -------------------------------- */

  /** Idempotent, single-flight. Drains until nothing is pending. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.flushPromise) {
      this.flushPromise = this.drain().finally(() => {
        this.flushPromise = null
      })
    }
    return this.flushPromise
  }

  private awaitCommit(): Promise<void> {
    const p = new Promise<void>((resolve) => this.waiters.push(resolve))
    if (this.pendingCount() >= this.maxPendingCount) {
      void this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null
        void this.flush()
      }, this.maxDelayMs)
    }
    return p
  }

  private async drain(): Promise<void> {
    while (this.pendingCount() > 0 || this.waiters.length > 0) {
      // Take the open batch atomically; anything enqueued during the commit
      // lands in a fresh batch and is drained by the next loop turn.
      const docs = [...this.pendingDocs.values()]
      const docDeletes = [...this.pendingDocDeletes.values()]
      const logs = this.pendingLogs
      const waiters = this.waiters
      this.pendingDocs = new Map()
      this.pendingDocDeletes = new Map()
      this.pendingLogs = []
      this.waiters = []

      let ok = await idbBatchWrite(docs, logs, docDeletes)
      if (!ok) {
        // Quota (or IO) failure: evict LARGE-tier entries, retry ONCE.
        try {
          const { storage } = await import("./index")
          await storage.evictLargeTier(16)
        } catch (err) {
          console.error("[storage/batch] eviction before retry failed:", err)
        }
        ok = await idbBatchWrite(docs, logs, docDeletes)
      }

      if (ok) {
        // Durable: anything we previously parked for these doc keys is stale.
        for (const d of docs) this.mirrorDocs.delete(`${d.ns}${SEP}${d.id}`)
        for (const del of docDeletes) this.mirrorDocs.delete(`${del.ns}${SEP}${del.id}`)
      } else {
        // Park in the memory mirror; the session still reads its writes.
        console.error(
          `[storage/batch] durable commit failed after eviction — parking ` +
            `${docs.length + docDeletes.length + logs.length} record(s) in memory ` +
            "for this session only.",
        )
        for (const d of docs) this.mirrorDocs.set(`${d.ns}${SEP}${d.id}`, d)
        for (const del of docDeletes) this.mirrorDocs.set(`${del.ns}${SEP}${del.id}`, null)
        for (const l of logs) {
          const arr = this.mirrorLogs.get(l.ns) ?? []
          arr.push(l)
          this.mirrorLogs.set(l.ns, arr)
        }
        countDegradedWrites(docs.length + docDeletes.length + logs.length)
      }

      for (const w of waiters) w()
    }
  }
}

/** The shared default batcher every docStore/appendLog rides unless a test
 *  injects its own. */
export const appBatcher = new WriteBatcher()

// Flush on backgrounding — the same lifecycle moment the telemetry layer
// already uses — so a kill loses at most one batch window of writes.
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("pagehide", () => void appBatcher.flush())
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void appBatcher.flush()
    })
  }
}
