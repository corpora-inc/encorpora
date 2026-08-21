// journey/engine/persistence/memory.ts — pure in-memory
// DocStore/AppendLog/KVStore fakes for tests and the simulation harness
// (engine.md §3.1). Deep-clone on read to catch shared-reference bugs.
// Structurally identical to @/lib/storage's interfaces (type-only import);
// the real adapters are wired OUTSIDE the engine in src/journey/persistence.ts.

import type { EnginePersistence } from "./types.ts"
import type { ItemCard } from "../types.ts"

type LogRecord<T> = { seq: number; ts: number; entry: T }

function clone<T>(v: T): T {
  return structuredClone(v)
}

export interface MemoryPersistence extends EnginePersistence<ItemCard, unknown> {
  /** Test/sim hooks. */
  __appendEvent(entry: unknown, ts?: number): number
  __eventCount(): number
  __putCounts(): { docPuts: number; metaPuts: number }
}

export function createMemoryPersistence(opts?: { now?: () => number }): MemoryPersistence {
  const now = opts?.now ?? (() => 0)

  // ---- DocStore<ItemCard> ---------------------------------------------------
  const docs = new Map<string, ItemCard>()
  const counters = { docPuts: 0, metaPuts: 0 }
  const itemCards = {
    ns: "journey-cards:memory",
    async get(id: string) {
      const v = docs.get(id)
      return v === undefined ? undefined : clone(v)
    },
    async getMany(ids: string[]) {
      const out = new Map<string, ItemCard>()
      for (const id of ids) {
        const v = docs.get(id)
        if (v !== undefined) out.set(id, clone(v))
      }
      return out
    },
    async getAll() {
      const out = new Map<string, ItemCard>()
      for (const [id, v] of docs) out.set(id, clone(v))
      return out
    },
    async put(id: string, doc: ItemCard) {
      counters.docPuts += 1
      docs.set(id, clone(doc))
    },
    async putMany(entries: ReadonlyArray<readonly [string, ItemCard]>) {
      for (const [id, doc] of entries) {
        counters.docPuts += 1
        docs.set(id, clone(doc))
      }
    },
    async delete(id: string) {
      docs.delete(id)
    },
    async count() {
      return docs.size
    },
    async flush() {},
    async clear() {
      docs.clear()
    },
  }

  // ---- AppendLog<unknown> (the engine only READS this — R15) ----------------
  let records: LogRecord<unknown>[] = []
  let head = 0
  const tsOf = (entry: unknown): number => {
    const t = (entry as { ts?: unknown } | null)?.ts
    return typeof t === "number" ? t : now()
  }
  const events = {
    ns: "local-analytics:memory",
    async append(entry: unknown) {
      head += 1
      records.push({ seq: head, ts: tsOf(entry), entry: clone(entry) })
      return head
    },
    async read(o?: {
      fromSeq?: number
      toSeq?: number
      fromTs?: number
      toTs?: number
      limit?: number
      reverse?: boolean
    }) {
      const limit = o?.limit ?? 1000
      const filtered = records.filter(
        (r) =>
          (o?.fromSeq === undefined || r.seq >= o.fromSeq) &&
          (o?.toSeq === undefined || r.seq <= o.toSeq) &&
          (o?.fromTs === undefined || r.ts >= o.fromTs) &&
          (o?.toTs === undefined || r.ts <= o.toTs),
      )
      const page = o?.reverse ? filtered.slice(-limit).reverse() : filtered.slice(0, limit)
      return page.map((r) => ({ ...r, entry: clone(r.entry) }))
    },
    async scan<A>(
      fold: (acc: A, rec: LogRecord<unknown>) => A,
      seed: A,
      o?: { fromSeq?: number; fromTs?: number; toTs?: number },
    ) {
      let acc = seed
      for (const r of records) {
        if (o?.fromSeq !== undefined && r.seq < o.fromSeq) continue
        if (o?.fromTs !== undefined && r.ts < o.fromTs) continue
        if (o?.toTs !== undefined && r.ts > o.toTs) continue
        acc = fold(acc, { ...r, entry: clone(r.entry) })
      }
      return acc
    },
    async count() {
      return records.length
    },
    async headSeq() {
      return head
    },
    async prune(o: { keepLast?: number; maxBytes?: number; olderThanMs?: number }) {
      const before = records.length
      if (o.keepLast !== undefined) records = records.slice(-o.keepLast)
      if (o.olderThanMs !== undefined) {
        const cutoff = now() - o.olderThanMs
        records = records.filter((r) => r.ts > cutoff)
      }
      return before - records.length
    },
    async flush() {},
    async clear() {
      records = []
      head = 0
    },
  }

  // ---- KVStore ---------------------------------------------------------------
  const kv = new Map<string, unknown>()
  const meta = {
    async get(key: string) {
      const v = kv.get(key)
      if (v === undefined || v === null) return undefined
      return typeof v === "string" ? v : JSON.stringify(v)
    },
    async getJSON<T>(key: string): Promise<T | undefined> {
      const v = kv.get(key)
      return v === undefined || v === null ? undefined : (clone(v) as T)
    },
    async set(key: string, value: string) {
      counters.metaPuts += 1
      kv.set(key, value)
    },
    async setJSON<T>(key: string, value: T) {
      counters.metaPuts += 1
      kv.set(key, clone(value))
    },
    async del(key: string) {
      kv.delete(key)
    },
    async keys() {
      return [...kv.keys()]
    },
  }

  return {
    itemCards,
    events,
    meta,
    __appendEvent(entry: unknown, ts?: number) {
      head += 1
      records.push({ seq: head, ts: ts ?? tsOf(entry), entry: clone(entry) })
      return head
    },
    __eventCount() {
      return records.length
    },
    __putCounts() {
      return { ...counters }
    },
  }
}
