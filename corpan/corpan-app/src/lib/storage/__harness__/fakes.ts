// src/lib/storage/__harness__/fakes.ts
//
// Minimal in-memory IndexedDB + localStorage for the node verification
// harness. Enough surface for ./idb.ts and the adapter layer: open/upgrade,
// multi-store transactions, composite keyPaths ([ns, id] / [ns, seq]),
// key ranges, indexes (ns_ts), get/put/delete/getAll/getAllKeys/count,
// deleteDatabase, controllable quotas + open failures, and instrumentation
// counters (transactions, getAllKeys calls) for the O(1)-append and
// one-txn-per-flush proofs.
//
// This is NOT a spec-complete IDB — it's a deterministic fake for proving
// the quota-safety + persistence + recovery contracts.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DocStore, DocCodec } from "../doc"
import type { AppendLog, LogRecord } from "../log"

type Listener = ((ev: any) => void) | null

/** IDB key order (subset): number < string < array (element-wise). */
function typeRank(v: any): number {
  if (typeof v === "number") return 0
  if (typeof v === "string") return 1
  if (Array.isArray(v)) return 2
  return 3
}

export function cmpKeys(a: any, b: any): number {
  const ra = typeRank(a)
  const rb = typeRank(b)
  if (ra !== rb) return ra - rb
  if (Array.isArray(a)) {
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i += 1) {
      const c = cmpKeys(a[i], b[i])
      if (c !== 0) return c
    }
    return a.length - b.length
  }
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

class FakeKeyRange {
  constructor(
    public lower: any,
    public upper: any,
    public lowerOpen = false,
    public upperOpen = false,
  ) {}
  _contains(key: any): boolean {
    if (this.lower !== undefined) {
      const c = cmpKeys(key, this.lower)
      if (c < 0 || (c === 0 && this.lowerOpen)) return false
    }
    if (this.upper !== undefined) {
      const c = cmpKeys(key, this.upper)
      if (c > 0 || (c === 0 && this.upperOpen)) return false
    }
    return true
  }
  static bound(lower: any, upper: any, lowerOpen = false, upperOpen = false): FakeKeyRange {
    return new FakeKeyRange(lower, upper, lowerOpen, upperOpen)
  }
  static lowerBound(lower: any, open = false): FakeKeyRange {
    return new FakeKeyRange(lower, undefined, open, false)
  }
  static upperBound(upper: any, open = false): FakeKeyRange {
    return new FakeKeyRange(undefined, upper, false, open)
  }
  static only(v: any): FakeKeyRange {
    return new FakeKeyRange(v, v)
  }
}

class FakeRequest<T = any> {
  result: T | undefined = undefined
  error: any = null
  onsuccess: Listener = null
  onerror: Listener = null
  onupgradeneeded: Listener = null
  onblocked: Listener = null
  _succeed(result: T): void {
    this.result = result
    queueMicrotask(() => this.onsuccess && this.onsuccess({ target: this }))
  }
  _fail(error: any): void {
    this.error = error
    queueMicrotask(() => this.onerror && this.onerror({ target: this }))
  }
}

function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v)
  } catch {
    return JSON.parse(JSON.stringify(v))
  }
}

export type FakeControls = {
  setMaxRecords: (n: number) => void
  /** Fail the next n indexedDB.open calls (level-3 recovery testing). */
  setOpenFailures: (n: number) => void
  /** Instrumentation counters. */
  counters: { getAllKeys: number; readwriteTxns: number; deleteDatabase: number }
  resetCounters: () => void
  /** Write a raw record straight into the docs store (corruption injection). */
  injectRawDocRecord: (ns: string, id: string, junk: any) => void
  /** Peek at raw store contents (assertions). */
  rawDocs: () => any[]
  rawLogs: () => any[]
}

type StoreDef = { keyPath: string | string[]; indexes: Map<string, string | string[]> }

function keyOf(keyPath: string | string[], value: any): any {
  if (typeof keyPath === "string") return value[keyPath]
  return keyPath.map((k) => value[k])
}

class FakeStoreData {
  /** Sorted association list of [key, value] — kept in key order. */
  entries: Array<[any, any]> = []
  constructor(public def: StoreDef) {}
  find(key: any): number {
    // Linear is fine for a test fake.
    for (let i = 0; i < this.entries.length; i += 1) {
      if (cmpKeys(this.entries[i][0], key) === 0) return i
    }
    return -1
  }
  insertPos(key: any): number {
    let i = 0
    while (i < this.entries.length && cmpKeys(this.entries[i][0], key) < 0) i += 1
    return i
  }
}

class FakeDb {
  _stores = new Map<string, FakeStoreData>()
  _maxRecords = Infinity
  objectStoreNames = {
    contains: (n: string) => this._stores.has(n),
  }
  onversionchange: Listener = null
  _controls: FakeControls | null = null

  totalRecords(): number {
    let n = 0
    for (const s of this._stores.values()) n += s.entries.length
    return n
  }

  createObjectStore(name: string, opts?: { keyPath?: string | string[] }): FakeObjectStore {
    const data = new FakeStoreData({ keyPath: opts?.keyPath ?? "fqk", indexes: new Map() })
    this._stores.set(name, data)
    const t = new FakeTransaction(this, [name], "versionchange")
    return new FakeObjectStore(this, data, t)
  }

  transaction(names: string | string[], mode: IDBTransactionMode = "readonly"): FakeTransaction {
    const list = Array.isArray(names) ? names : [names]
    const t = new FakeTransaction(this, list, mode)
    if (mode === "readwrite" && this._controls) this._controls.counters.readwriteTxns += 1
    return t
  }

  close(): void {
    /* no-op; the fake "disk" persists in the shared singleton */
  }
}

class FakeTransaction {
  oncomplete: Listener = null
  onerror: Listener = null
  onabort: Listener = null
  error: any = null
  private pendingOps = 0
  private failed = false
  private settled = false
  private scheduled = false

  constructor(
    private db: FakeDb,
    private names: string[],
    public mode: IDBTransactionMode,
  ) {}

  objectStore(name: string): FakeObjectStore {
    if (!this.names.includes(name)) throw new Error(`store ${name} not in transaction scope`)
    const data = this.db._stores.get(name)
    if (!data) throw new Error(`no such store: ${name}`)
    return new FakeObjectStore(this.db, data, this)
  }

  _opStart(): void {
    this.pendingOps += 1
  }

  _opEnd(failed: boolean, error?: any): void {
    this.pendingOps -= 1
    if (failed) {
      this.failed = true
      this.error = error
    }
    this._maybeSettle()
  }

  _maybeSettle(): void {
    if (this.settled || this.pendingOps > 0 || this.scheduled) return
    this.scheduled = true
    // Settle after the microtask queue drains twice (lets chained
    // request handlers enqueue follow-up ops in the same transaction).
    queueMicrotask(() => {
      queueMicrotask(() => {
        this.scheduled = false
        if (this.settled || this.pendingOps > 0) return
        this.settled = true
        if (this.failed) this.onerror?.({ target: this })
        else this.oncomplete?.({ target: this })
      })
    })
  }
}

class FakeIndex {
  constructor(
    private store: FakeObjectStore,
    private keyPath: string | string[],
  ) {}
  private sortedByIndexKey(): Array<{ ik: any; v: any; pk: any }> {
    const out = this.store.data.entries.map(([pk, v]) => ({
      ik: keyOf(this.keyPath, v),
      v,
      pk,
    }))
    out.sort((a, b) => cmpKeys(a.ik, b.ik) || cmpKeys(a.pk, b.pk))
    return out
  }
  getAll(query?: FakeKeyRange, count?: number): FakeRequest {
    const req = new FakeRequest()
    this.store.tx._opStart()
    const out: any[] = []
    for (const rec of this.sortedByIndexKey()) {
      if (query && !query._contains(rec.ik)) continue
      out.push(structuredCloneSafe(rec.v))
      if (count !== undefined && out.length >= count) break
    }
    req._succeed(out)
    queueMicrotask(() => this.store.tx._opEnd(false))
    return req
  }
  getAllKeys(query?: FakeKeyRange, count?: number): FakeRequest {
    const req = new FakeRequest()
    this.store.tx._opStart()
    if (this.store.db._controls) this.store.db._controls.counters.getAllKeys += 1
    const out: any[] = []
    for (const rec of this.sortedByIndexKey()) {
      if (query && !query._contains(rec.ik)) continue
      out.push(structuredCloneSafe(rec.pk)) // index getAllKeys returns PRIMARY keys
      if (count !== undefined && out.length >= count) break
    }
    req._succeed(out)
    queueMicrotask(() => this.store.tx._opEnd(false))
    return req
  }
}

class FakeObjectStore {
  constructor(
    public db: FakeDb,
    public data: FakeStoreData,
    public tx: FakeTransaction,
  ) {}

  get transaction(): FakeTransaction {
    return this.tx
  }

  createIndex(name: string, keyPath: string | string[]): void {
    this.data.def.indexes.set(name, keyPath)
  }

  index(name: string): FakeIndex {
    const kp = this.data.def.indexes.get(name)
    if (!kp) throw new Error(`no such index: ${name}`)
    return new FakeIndex(this, kp)
  }

  get(key: any): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    const i = this.data.find(key)
    req._succeed(i >= 0 ? structuredCloneSafe(this.data.entries[i][1]) : undefined)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }

  put(value: any): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    const key = keyOf(this.data.def.keyPath, value)
    const i = this.data.find(key)
    const isNew = i < 0
    if (isNew && this.db.totalRecords() >= this.db._maxRecords) {
      // Simulate a quota error on insert past the cap. A failed request
      // fails its transaction too (mirrors real IDB abort semantics).
      const err = new Error("QuotaExceededError: The quota has been exceeded.")
      ;(err as any).name = "QuotaExceededError"
      req._fail(err)
      queueMicrotask(() => this.tx._opEnd(true, err))
      return req
    }
    if (isNew) {
      this.data.entries.splice(this.data.insertPos(key), 0, [key, structuredCloneSafe(value)])
    } else {
      this.data.entries[i][1] = structuredCloneSafe(value)
    }
    req._succeed(key)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }

  delete(key: any): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    const i = this.data.find(key)
    if (i >= 0) this.data.entries.splice(i, 1)
    req._succeed(undefined)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }

  getAll(query?: FakeKeyRange, count?: number): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    const out: any[] = []
    for (const [key, v] of this.data.entries) {
      if (query && !query._contains(key)) continue
      out.push(structuredCloneSafe(v))
      if (count !== undefined && out.length >= count) break
    }
    req._succeed(out)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }

  getAllKeys(query?: FakeKeyRange, count?: number): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    if (this.db._controls) this.db._controls.counters.getAllKeys += 1
    const out: any[] = []
    for (const [key] of this.data.entries) {
      if (query && !query._contains(key)) continue
      out.push(structuredCloneSafe(key))
      if (count !== undefined && out.length >= count) break
    }
    req._succeed(out)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }

  count(query?: FakeKeyRange): FakeRequest {
    const req = new FakeRequest()
    this.tx._opStart()
    let n = 0
    for (const [key] of this.data.entries) {
      if (query && !query._contains(key)) continue
      n += 1
    }
    req._succeed(n)
    queueMicrotask(() => this.tx._opEnd(false))
    return req
  }
}

// The persistent "disk": one shared FakeDb instance survives connection
// resets, mirroring how real IndexedDB data survives a page reload.
let sharedDb: FakeDb | null = null
let openFailuresRemaining = 0

export function installFakeIndexedDB(): FakeControls {
  const controls: FakeControls = {
    setMaxRecords(n: number) {
      if (sharedDb) sharedDb._maxRecords = n
    },
    setOpenFailures(n: number) {
      openFailuresRemaining = n
    },
    counters: { getAllKeys: 0, readwriteTxns: 0, deleteDatabase: 0 },
    resetCounters() {
      controls.counters.getAllKeys = 0
      controls.counters.readwriteTxns = 0
      controls.counters.deleteDatabase = 0
    },
    injectRawDocRecord(ns: string, id: string, junk: any) {
      const store = sharedDb?._stores.get("docs")
      if (!store) throw new Error("docs store not created yet")
      const key = [ns, id]
      const i = store.find(key)
      if (i >= 0) store.entries[i][1] = junk
      else store.entries.splice(store.insertPos(key), 0, [key, junk])
    },
    rawDocs: () => [...(sharedDb?._stores.get("docs")?.entries ?? [])].map(([, v]) => v),
    rawLogs: () => [...(sharedDb?._stores.get("log")?.entries ?? [])].map(([, v]) => v),
  }

  const factory = {
    open(_name: string, _version?: number): FakeRequest<FakeDb> {
      const req = new FakeRequest<FakeDb>()
      if (openFailuresRemaining > 0) {
        openFailuresRemaining -= 1
        req._fail(new Error("InvalidStateError: simulated open failure"))
        return req
      }
      const firstTime = sharedDb === null
      if (!sharedDb) sharedDb = new FakeDb()
      const db = sharedDb
      db._controls = controls
      queueMicrotask(() => {
        if (firstTime && req.onupgradeneeded) {
          req.result = db
          req.onupgradeneeded({ target: req })
        }
        req.result = db
        if (req.onsuccess) req.onsuccess({ target: req })
      })
      return req
    },
    deleteDatabase(_name: string): FakeRequest {
      const req = new FakeRequest()
      controls.counters.deleteDatabase += 1
      sharedDb = null
      req._succeed(undefined)
      return req
    },
  }
  ;(globalThis as any).indexedDB = factory
  ;(globalThis as any).IDBKeyRange = FakeKeyRange
  ;(globalThis as any).structuredClone =
    (globalThis as any).structuredClone ?? structuredCloneSafe
  return controls
}

export function installFakeLocalStorage(): void {
  const map = new Map<string, string>()
  const ls = {
    get length() {
      return map.size
    },
    key(i: number): string | null {
      return [...map.keys()][i] ?? null
    },
    getItem(k: string): string | null {
      return map.has(k) ? map.get(k)! : null
    },
    setItem(k: string, v: string): void {
      const quota = (globalThis as any).__lsQuota ?? Infinity
      // Compute total size if we (re)wrote this key.
      let total = 0
      for (const [mk, mv] of map) {
        if (mk === k) continue
        total += mk.length + mv.length
      }
      total += k.length + v.length
      if (total * 2 > quota) {
        const err = new Error("QuotaExceededError: The quota has been exceeded.")
        ;(err as any).name = "QuotaExceededError"
        throw err
      }
      map.set(k, String(v))
    },
    removeItem(k: string): void {
      map.delete(k)
    },
    clear(): void {
      map.clear()
    },
  }
  ;(globalThis as any).localStorage = ls
}

/* -------------------------------------------------------------------------- */
/*  In-memory adapter fakes (engine simulation harness reuse, §7.3)           */
/* -------------------------------------------------------------------------- */

/** Pure in-memory DocStore<T> — for engine sims and unit tests. */
export function memoryDocStore<T>(ns = "memory"): DocStore<T> {
  const map = new Map<string, T>()
  return {
    ns,
    async get(id) {
      return map.get(id)
    },
    async getMany(ids) {
      const out = new Map<string, T>()
      for (const id of ids) if (map.has(id)) out.set(id, map.get(id)!)
      return out
    },
    async getAll() {
      return new Map(map)
    },
    async put(id, doc) {
      map.set(id, doc)
    },
    async putMany(entries) {
      for (const [id, doc] of entries) map.set(id, doc)
    },
    async delete(id) {
      map.delete(id)
    },
    async count() {
      return map.size
    },
    async flush() {},
    async clear() {
      map.clear()
    },
  }
}

/** Pure in-memory AppendLog<T> — for engine sims and unit tests. */
export function memoryAppendLog<T>(
  ns = "memory",
  opts?: { now?: () => number; tsOf?: (e: T) => number },
): AppendLog<T> {
  let records: LogRecord<T>[] = []
  let head = 0
  const now = opts?.now ?? (() => Date.now())
  const tsOf = opts?.tsOf ?? (() => now())
  return {
    ns,
    async append(entry) {
      head += 1
      records.push({ seq: head, ts: tsOf(entry), entry })
      return head
    },
    async read(o) {
      const limit = o?.limit ?? 1000
      const filtered = records.filter(
        (r) =>
          (o?.fromSeq === undefined || r.seq >= o.fromSeq) &&
          (o?.toSeq === undefined || r.seq <= o.toSeq) &&
          (o?.fromTs === undefined || r.ts >= o.fromTs) &&
          (o?.toTs === undefined || r.ts <= o.toTs),
      )
      return o?.reverse ? filtered.slice(-limit).reverse() : filtered.slice(0, limit)
    },
    async scan(fold, seed, o) {
      let acc = seed
      for (const r of records) {
        if (o?.fromSeq !== undefined && r.seq < o.fromSeq) continue
        if (o?.fromTs !== undefined && r.ts < o.fromTs) continue
        if (o?.toTs !== undefined && r.ts > o.toTs) continue
        acc = fold(acc, r)
      }
      return acc
    },
    async count() {
      return records.length
    },
    async headSeq() {
      return head
    },
    async prune(o) {
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
}

/** Passthrough codec for tests. */
export function anyCodec<T>(): DocCodec<T> {
  return { schemaVersion: 1, parse: (raw) => (raw === undefined ? null : (raw as T)) }
}
