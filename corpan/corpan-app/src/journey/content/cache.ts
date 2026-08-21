// Journey content resolver — per-session LRU caches, memory-bounded
// (content-resolver.md §3.2).
//
// Two bounds can trip an eviction: a per-cache ENTRY bound, and (for caches
// enrolled in a SharedBytePool) a cross-cache BYTE bound — the items cache
// and the segment file maps share one ~4 MB pool; whichever bound trips
// first evicts least-recently-used entries. Byte size is estimated as
// `JSON.stringify(value).length` (spec'd estimator; close enough for the
// bound's purpose).
//
// No clocks: recency is a shared monotonic counter, never Date.now()
// (engine-grade determinism rule).

interface PoolMember {
  oldestTick(): number
  evictOldest(): boolean
}

/**
 * A byte budget shared by several LRU caches. When the pool is over
 * capacity it evicts the globally least-recently-used entry across all
 * member caches until it fits (or the members are empty).
 */
export class SharedBytePool {
  private members: PoolMember[] = []
  private usedBytes = 0
  readonly capacityBytes: number

  // NOTE: no TS parameter properties anywhere in journey/content/** — the
  // node strip-types test loader rejects them (same rule as engine §8.1's
  // no-enum rule).
  constructor(capacityBytes: number) {
    this.capacityBytes = capacityBytes
  }

  get used(): number {
    return this.usedBytes
  }

  enroll(member: PoolMember): void {
    this.members.push(member)
  }

  charge(bytes: number): void {
    this.usedBytes += bytes
    this.rebalance()
  }

  release(bytes: number): void {
    this.usedBytes = Math.max(0, this.usedBytes - bytes)
  }

  private rebalance(): void {
    while (this.usedBytes > this.capacityBytes) {
      let oldest: PoolMember | null = null
      let oldestTick = Infinity
      for (const m of this.members) {
        const t = m.oldestTick()
        if (t < oldestTick) {
          oldestTick = t
          oldest = m
        }
      }
      if (!oldest || !oldest.evictOldest()) return // all members empty
    }
  }
}

let tickCounter = 0

interface LruEntry<V> {
  value: V
  bytes: number
  tick: number
}

export interface LruCacheOptions {
  maxEntries: number
  /** Enroll in a shared byte pool; entries are then size-estimated. */
  pool?: SharedBytePool
}

/** Insertion-ordered Map-based LRU. */
export class LruCache<V> implements PoolMember {
  private map = new Map<string, LruEntry<V>>()
  private readonly maxEntries: number
  private readonly pool?: SharedBytePool

  constructor(opts: LruCacheOptions) {
    this.maxEntries = opts.maxEntries
    this.pool = opts.pool
    this.pool?.enroll(this)
  }

  get size(): number {
    return this.map.size
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  get(key: string): V | undefined {
    const e = this.map.get(key)
    if (!e) return undefined
    // refresh recency
    e.tick = ++tickCounter
    this.map.delete(key)
    this.map.set(key, e)
    return e.value
  }

  set(key: string, value: V): void {
    const prior = this.map.get(key)
    if (prior) {
      this.map.delete(key)
      this.pool?.release(prior.bytes)
    }
    let bytes = 0
    if (this.pool) {
      try {
        bytes = JSON.stringify(value)?.length ?? 0
      } catch {
        bytes = 0
      }
    }
    this.map.set(key, { value, bytes, tick: ++tickCounter })
    while (this.map.size > this.maxEntries) this.evictOldest()
    this.pool?.charge(bytes) // pool rebalances (may evict across caches)
  }

  clear(): void {
    if (this.pool) {
      for (const e of this.map.values()) this.pool.release(e.bytes)
    }
    this.map.clear()
  }

  keys(): string[] {
    return [...this.map.keys()]
  }

  // -- PoolMember -------------------------------------------------------

  oldestTick(): number {
    const first = this.map.values().next()
    return first.done ? Infinity : first.value.tick
  }

  evictOldest(): boolean {
    const first = this.map.keys().next()
    if (first.done) return false
    const key = first.value
    const e = this.map.get(key)
    this.map.delete(key)
    if (e) this.pool?.release(e.bytes)
    return true
  }
}
