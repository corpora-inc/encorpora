// src/lib/storage/packStorageApi.ts — the `hostApi.storage` builder
// (storage-analytics.md §5.1, the M5 landing zone).
//
// Durable, pack-scoped KV on the IDB-DOC tier. The namespace is HOST-stamped
// `pack:<packId>` — a pack can never read or write another pack's data.
// Budget: 2MB / 1,000 keys per pack, host-enforced; over-budget writes are
// dropped + console.error'd, mirroring the never-throw contract.
//
// INTEGRATOR (W10): wire in contentPacks/hostApi.ts as
//   storage: buildPackStorageApi(packId)
// type the member in contentPacks/types.ts as `storage?: PackStorageApi`,
// and advertise `storageKv: 1` in __CORPAN_HOST_CAPS. Packs feature-detect;
// SDK-lagging packs see nothing new.

import { docStore, type DocStore } from "./doc"
import {
  registerPackNamespace,
  PACK_KV_MAX_BYTES,
  PACK_KV_MAX_KEYS,
} from "./namespaces"
import { countPackKvDrop } from "./health"
import { estimateSize } from "./bytes"
import type { WriteBatcher } from "./batch"

export interface PackStorageApi {
  kv: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
    remove(key: string): Promise<void>
    keys(): Promise<string[]>
  }
}

const stringCodec = {
  schemaVersion: 1,
  parse: (raw: unknown): string | null => (typeof raw === "string" ? raw : null),
}

export function buildPackStorageApi(packId: string, batcher?: WriteBatcher): PackStorageApi {
  const ns = `pack:${packId}`
  registerPackNamespace(ns)
  const store: DocStore<string> = docStore<string>(ns, stringCodec, batcher)

  // Lazy budget accounting: sizes are loaded once per session on first write,
  // then maintained in memory (pack data is ≤2MB by construction).
  let usage: { keys: Map<string, number>; bytes: number } | null = null
  let usageLoad: Promise<void> | null = null
  const loadUsage = (): Promise<void> => {
    if (usage) return Promise.resolve()
    if (usageLoad) return usageLoad
    usageLoad = (async () => {
      const all = await store.getAll()
      const keys = new Map<string, number>()
      let bytes = 0
      for (const [k, v] of all) {
        const size = estimateSize(v)
        keys.set(k, size)
        bytes += size
      }
      usage = { keys, bytes }
    })()
    return usageLoad
  }

  return {
    kv: {
      async get(key) {
        const v = await store.get(key)
        return v ?? null
      },
      async set(key, value) {
        if (typeof value !== "string") {
          console.error(`[hostApi.storage] ${packId}: set("${key}") requires a string value.`)
          return
        }
        await loadUsage()
        const u = usage as NonNullable<typeof usage>
        const size = estimateSize(value)
        const nextBytes = u.bytes - (u.keys.get(key) ?? 0) + size
        const nextKeys = u.keys.size + (u.keys.has(key) ? 0 : 1)
        if (nextBytes > PACK_KV_MAX_BYTES || nextKeys > PACK_KV_MAX_KEYS) {
          countPackKvDrop(packId)
          console.error(
            `[hostApi.storage] ${packId}: write of "${key}" dropped — over the ` +
              `pack budget (${PACK_KV_MAX_KEYS} keys / ${PACK_KV_MAX_BYTES} bytes).`,
          )
          return
        }
        u.keys.set(key, size)
        u.bytes = nextBytes
        await store.put(key, value)
      },
      async remove(key) {
        if (usage) {
          usage.bytes -= usage.keys.get(key) ?? 0
          usage.keys.delete(key)
        }
        await store.delete(key)
      },
      async keys() {
        return [...(await store.getAll()).keys()]
      },
    },
  }
}
