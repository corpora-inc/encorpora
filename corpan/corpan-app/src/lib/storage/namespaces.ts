// src/lib/storage/namespaces.ts — the central namespace registry
// (storage-analytics.md §3.8). Every doc/log/blob namespace is declared here
// so the storage doctor can enumerate them and pruners know their budgets.
// Unregistered namespaces are a dev-time console.error, never a throw —
// packs going through hostApi get auto-registered `pack:<packId>` namespaces.

export type NsKind = "doc" | "log" | "blob" | "kv"

export type NsDecl = {
  kind: NsKind
  owner: "app" | "journey" | "pack"
  /** false ⇒ evictable cache. */
  durable: boolean
  budget?: { maxRecords?: number; maxBytes?: number }
}

/** Budget knobs (D-e): tuning, not architecture. */
export const LOCAL_ANALYTICS_MAX_RECORDS = 100_000
export const LOCAL_ANALYTICS_MAX_BYTES = 48 * 2 ** 20
export const PACK_KV_MAX_BYTES = 2 * 2 ** 20
export const PACK_KV_MAX_KEYS = 1_000
export const PACK_EVENTS_PER_DAY = 5_000
export const BLOB_STORE_TOTAL_BYTES = 128 * 2 ** 20

export const NAMESPACES: Record<string, NsDecl> = {
  // existing kv namespaces
  "game-catalog":        { kind: "kv",  owner: "app",     durable: false },
  "phrase-pack-catalog": { kind: "kv",  owner: "app",     durable: false },
  "word-pack-catalog":   { kind: "kv",  owner: "app",     durable: false },               // M3
  "progress":            { kind: "kv",  owner: "app",     durable: true },                // M2
  "history":             { kind: "kv",  owner: "app",     durable: true },                // M4
  "analytics-events":    { kind: "kv",  owner: "app",     durable: true,
                           budget: { maxRecords: 5_000 } },                               // telemetry (M7 → log)
  "analytics-meta":      { kind: "kv",  owner: "app",     durable: true },                // telemetry seq counter
  // new (Journey W1)
  "local-analytics":     { kind: "log", owner: "app",     durable: true,
                           budget: { maxRecords: LOCAL_ANALYTICS_MAX_RECORDS,
                                     maxBytes: LOCAL_ANALYTICS_MAX_BYTES } },             // §4
  "analytics-rollups":   { kind: "doc", owner: "app",     durable: true,
                           budget: { maxRecords: 2_000 } },                               // §4.6
  "journey-cards":       { kind: "doc", owner: "journey", durable: true },                // prefix; per (stack,course) suffix
  "journey-meta":        { kind: "doc", owner: "journey", durable: true },                // prefix; per (stack,course) suffix
  "cover-cache":         { kind: "blob", owner: "app",    durable: false,
                           budget: { maxBytes: 64 * 2 ** 20 } },                          // D12 consumer
  // internal: AppendLog meta docs ({headSeq, count, bytes} per log ns)
  "__logmeta":           { kind: "doc", owner: "app",     durable: true },
}

/** Pack namespaces (`pack:<packId>`) are auto-registered on first use by the
 *  hostApi storage builder — a pack never has to touch this file. */
const packNamespaces = new Set<string>()

export function registerPackNamespace(ns: string): void {
  packNamespaces.add(ns)
}

/**
 * Resolve a namespace to its declaration: exact match first, then the
 * registered prefix before the first ":" (journey-cards:<stack>:<course>
 * resolves to the "journey-cards" decl), then auto-registered pack
 * namespaces (2MB / 1,000 keys per pack, host-enforced).
 */
export function resolveNsDecl(ns: string): NsDecl | undefined {
  const exact = NAMESPACES[ns]
  if (exact) return exact
  const colon = ns.indexOf(":")
  if (colon > 0) {
    const prefix = ns.slice(0, colon)
    if (prefix === "pack") {
      return {
        kind: "doc",
        owner: "pack",
        durable: true,
        budget: { maxRecords: PACK_KV_MAX_KEYS, maxBytes: PACK_KV_MAX_BYTES },
      }
    }
    const byPrefix = NAMESPACES[prefix]
    if (byPrefix) return byPrefix
  }
  return undefined
}

/** Dev-time lint: unregistered namespaces log loudly (never throw). The
 *  doctor's violations list re-surfaces them. */
const warned = new Set<string>()
export function assertRegistered(ns: string): void {
  if (resolveNsDecl(ns)) return
  if (warned.has(ns)) return
  warned.add(ns)
  console.error(
    `[storage/namespaces] namespace "${ns}" is not registered in ` +
      "lib/storage/namespaces.ts — declare it (kind/owner/durable/budget) " +
      "so the doctor and pruners can see it.",
  )
}

/** Doctor helper: namespaces used this session without a declaration. */
export function unregisteredNamespaces(): string[] {
  return [...warned]
}
