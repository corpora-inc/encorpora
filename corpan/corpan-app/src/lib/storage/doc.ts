// src/lib/storage/doc.ts — DocStore<T> (storage-analytics.md §3.4).
//
// Versioned, validated, batched documents on the IDB-DOC tier. Read path:
// pending batch → IndexedDB → memory mirror; every stored value passes the
// codec before product code sees it. A DocStore read NEVER throws and NEVER
// returns unvalidated data — corrupt/alien records are dropped, counted in
// the doctor, and read as absent (corruption ladder level 1, §3.10).

import {
  idbDocGet,
  idbDocGetAll,
  idbDocCount,
  idbDocDelete,
  idbDocClear,
  type DocRecord,
} from "./idb"
import { WriteBatcher, appBatcher } from "./batch"
import { assertRegistered } from "./namespaces"
import { countCorrupt, countNuked } from "./health"
import { estimateSize } from "./bytes"

export interface DocCodec<T> {
  /** Bump when T's shape changes incompatibly. Stamped on every record. */
  schemaVersion: number
  /** Validate/narrow a raw stored value. Return null for corrupt/alien data
   *  (it will be dropped + counted, never thrown). Zod `.safeParse` fits here
   *  but the interface is dependency-free. */
  parse(raw: unknown): T | null
  /** Optional lazy upgrade for records written at an older schemaVersion.
   *  Absent or returning null ⇒ the old record is treated as corrupt
   *  (dropped). Successful migrations are re-persisted lazily. */
  migrate?(raw: unknown, fromVersion: number): T | null
}

export interface DocStore<T> {
  readonly ns: string
  get(id: string): Promise<T | undefined>
  getMany(ids: string[]): Promise<Map<string, T>>
  getAll(): Promise<Map<string, T>>
  /** Enqueued on the WriteBatcher; resolves when the batch COMMITS. */
  put(id: string, doc: T): Promise<void>
  putMany(entries: ReadonlyArray<readonly [string, T]>): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
  /** Force any pending batched writes to disk now. */
  flush(): Promise<void>
  /** Drop the whole namespace (corruption recovery / user data-wipe). */
  clear(): Promise<void>
}

export function docStore<T>(
  ns: string,
  codec: DocCodec<T>,
  batcher: WriteBatcher = appBatcher,
): DocStore<T> {
  assertRegistered(ns)

  const makeRecord = (id: string, doc: T): DocRecord => ({
    ns,
    id,
    v: doc,
    schema: codec.schemaVersion,
    size: estimateSize(doc),
    updatedAt: Date.now(),
  })

  const put = (id: string, doc: T): Promise<void> => batcher.enqueueDoc(makeRecord(id, doc))

  /** Decode one stored record; corrupt/unmigratable → drop + count + undefined. */
  const decode = (rec: DocRecord): T | undefined => {
    if (rec.schema === codec.schemaVersion) {
      const parsed = codec.parse(rec.v)
      if (parsed !== null) return parsed
    } else if (codec.migrate) {
      let migrated: T | null = null
      try {
        migrated = codec.migrate(rec.v, rec.schema)
      } catch (err) {
        console.error(`[storage/doc] migrate threw for ${ns}::${rec.id}:`, err)
      }
      if (migrated !== null) {
        // Lazy upgrade: re-persist at the current schemaVersion.
        void put(rec.id, migrated)
        return migrated
      }
    }
    console.error(
      `[storage/doc] dropping corrupt/unmigratable record ${ns}::${rec.id} ` +
        `(stored schema ${rec.schema}, codec ${codec.schemaVersion}).`,
    )
    countCorrupt(ns)
    void idbDocDelete(ns, rec.id)
    return undefined
  }

  const get = async (id: string): Promise<T | undefined> => {
    // Read-your-writes: the pending batch + memory mirror win over the disk.
    const pending = batcher.peekDoc(ns, id)
    if (pending?.kind === "delete") return undefined
    if (pending?.kind === "put") return decode(pending.rec)
    const rec = await idbDocGet(ns, id)
    if (!rec) return undefined
    return decode(rec)
  }

  return {
    ns,
    get,

    async getMany(ids) {
      const out = new Map<string, T>()
      for (const id of ids) {
        const v = await get(id)
        if (v !== undefined) out.set(id, v)
      }
      return out
    },

    async getAll() {
      const out = new Map<string, T>()
      const recs = await idbDocGetAll(ns)
      for (const rec of recs) {
        const v = decode(rec)
        if (v !== undefined) out.set(rec.id, v)
      }
      // Overlay pending/parked state.
      const { puts, deletedIds } = batcher.peekDocsFor(ns)
      for (const id of deletedIds) out.delete(id)
      for (const rec of puts) {
        const v = decode(rec)
        if (v !== undefined) out.set(rec.id, v)
      }
      return out
    },

    put,

    async putMany(entries) {
      let last: Promise<void> = Promise.resolve()
      for (const [id, doc] of entries) last = put(id, doc)
      return last
    },

    delete(id) {
      return batcher.enqueueDocDelete(ns, id)
    },

    async count() {
      // Flush first so the store-level count is exact (pending puts of ids
      // that already exist must not double-count).
      await batcher.flush()
      return idbDocCount(ns)
    },

    flush() {
      return batcher.flush()
    },

    async clear() {
      try {
        batcher.clearNs(ns)
        await idbDocClear(ns)
      } catch (err) {
        console.error(`[storage/doc] clear failed for ${ns}:`, err)
        countNuked(ns)
      }
    },
  }
}
