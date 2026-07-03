// src/lib/storage/__harness__/fakes.ts
//
// Minimal in-memory IndexedDB + localStorage for the node verification harness.
// Just enough surface for ./idb.ts and the storage service: open/upgrade,
// objectStore get/put/delete/getAll/getAllKeys, a single keyPath store.
// Quotas are controllable so we can force QuotaExceededError paths.
//
// This is NOT a spec-complete IDB — it's a deterministic fake for proving the
// quota-safety + persistence contracts.

/* eslint-disable @typescript-eslint/no-explicit-any */

type Listener = ((ev: any) => void) | null

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

class FakeObjectStore {
  constructor(
    public data: Map<string, any>,
    public keyPath: string,
    public maxRecords: () => number,
  ) {}
  get(key: string): FakeRequest {
    const req = new FakeRequest()
    req._succeed(this.data.has(key) ? structuredCloneSafe(this.data.get(key)) : undefined)
    return req
  }
  put(value: any): FakeRequest {
    const req = new FakeRequest()
    const key = value[this.keyPath]
    const isNew = !this.data.has(key)
    if (isNew && this.data.size >= this.maxRecords()) {
      // Simulate a quota error on insert past the cap.
      const err = new Error("QuotaExceededError: The quota has been exceeded.")
      ;(err as any).name = "QuotaExceededError"
      req._fail(err)
      return req
    }
    this.data.set(key, structuredCloneSafe(value))
    req._succeed(key)
    return req
  }
  delete(key: string): FakeRequest {
    const req = new FakeRequest()
    this.data.delete(key)
    req._succeed(undefined)
    return req
  }
  getAll(): FakeRequest {
    const req = new FakeRequest()
    req._succeed([...this.data.values()].map(structuredCloneSafe))
    return req
  }
  getAllKeys(): FakeRequest {
    const req = new FakeRequest()
    req._succeed([...this.data.keys()])
    return req
  }
  createIndex(): void {
    /* no-op for the fake */
  }
}

class FakeTransaction {
  constructor(private db: FakeDb) {}
  objectStore(name: string): FakeObjectStore {
    return new FakeObjectStore(
      this.db._stores.get(name)!,
      "fqk",
      () => this.db._maxRecords,
    )
  }
}

class FakeDb {
  _stores = new Map<string, Map<string, any>>()
  _maxRecords = Infinity
  objectStoreNames = {
    contains: (n: string) => this._stores.has(n),
  }
  onversionchange: Listener = null
  createObjectStore(name: string): FakeObjectStore {
    const map = new Map<string, any>()
    this._stores.set(name, map)
    return new FakeObjectStore(map, "fqk", () => this._maxRecords)
  }
  transaction(_name: string | string[]): FakeTransaction {
    return new FakeTransaction(this)
  }
  close(): void {
    /* no-op; the fake "disk" persists in the shared singleton */
  }
}

function structuredCloneSafe<T>(v: T): T {
  try {
    return structuredClone(v)
  } catch {
    return JSON.parse(JSON.stringify(v))
  }
}

// The persistent "disk": one shared FakeDb instance survives connection resets,
// mirroring how real IndexedDB data survives a page reload.
let sharedDb: FakeDb | null = null

export function installFakeIndexedDB(): { setMaxRecords: (n: number) => void } {
  const factory = {
    open(_name: string, _version?: number): FakeRequest<FakeDb> {
      const req = new FakeRequest<FakeDb>()
      const firstTime = sharedDb === null
      if (!sharedDb) sharedDb = new FakeDb()
      const db = sharedDb
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
  }
  ;(globalThis as any).indexedDB = factory
  ;(globalThis as any).structuredClone =
    (globalThis as any).structuredClone ?? structuredCloneSafe
  return {
    setMaxRecords(n: number) {
      if (sharedDb) sharedDb._maxRecords = n
    },
  }
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
