// src/lib/storage/health.ts — dependency-free health counters for the
// corruption-recovery ladder (storage-analytics.md §3.10) and the storage
// doctor (§6). Kept in their own module so every layer (doc/log/batch/blob/
// hostApi builders) can increment them without import cycles. Counters are
// session-scoped; the doctor reports them, nothing else reads them.

export type DoctorHealthCounters = {
  /** Level-1 drops: codec.parse failed / schema unmigratable, per namespace. */
  corruptRecords: Record<string, number>
  /** Level-2 nukes: namespace cleared because it was unreadable, per ns. */
  nukedNamespaces: Record<string, number>
  /** Batched writes parked in the memory mirror this session (§3.9). */
  degradedWrites: number
  /** hostApi.localAnalytics rate-limit hits, per packId (§5.2). */
  packEventDrops: Record<string, number>
  /** hostApi.storage over-budget dropped writes, per packId (§5.1). */
  packKvDrops: Record<string, number>
}

export const healthCounters: DoctorHealthCounters = {
  corruptRecords: {},
  nukedNamespaces: {},
  degradedWrites: 0,
  packEventDrops: {},
  packKvDrops: {},
}

export function countCorrupt(ns: string, n = 1): void {
  healthCounters.corruptRecords[ns] = (healthCounters.corruptRecords[ns] ?? 0) + n
}

export function countNuked(ns: string): void {
  healthCounters.nukedNamespaces[ns] = (healthCounters.nukedNamespaces[ns] ?? 0) + 1
}

export function countDegradedWrites(n = 1): void {
  healthCounters.degradedWrites += n
}

export function countPackEventDrop(packId: string): void {
  healthCounters.packEventDrops[packId] = (healthCounters.packEventDrops[packId] ?? 0) + 1
}

export function countPackKvDrop(packId: string): void {
  healthCounters.packKvDrops[packId] = (healthCounters.packKvDrops[packId] ?? 0) + 1
}

/** Test-only: reset every counter between harness sections. */
export function __resetHealthForTests(): void {
  healthCounters.corruptRecords = {}
  healthCounters.nukedNamespaces = {}
  healthCounters.degradedWrites = 0
  healthCounters.packEventDrops = {}
  healthCounters.packKvDrops = {}
}
