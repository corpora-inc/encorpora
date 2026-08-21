# Journey Storage Discipline + Local Analytics — Implementable Spec

**Status: v1.0 implementable spec. Elaborates ARCHITECTURE D13 (and the storage half of
D5). Decisions in ARCHITECTURE.md are taken as settled here. APP-WIDE capability:
Journey ships on it, the rest of the app migrates to it.**

Verified against (file:line refs are branch `journey`, read 2026-07-03):
`corpan-app/src/util/storage/{index,idb,eventStore,migrate}.ts`,
`corpan-app/src/util/storage/__harness__/{run,fakes}.ts`,
`corpan-app/src/util/analytics.ts`, `corpan-app/src/main.tsx:100-150`,
`corpan-app/src/store/*.ts`, `corpan-app/src/util/devDebug.ts`,
`packs/shared/streak/src/streak.ts`, `packs/shared/monetization/src/quotas.ts`,
`packs/shared/analytics/index.ts`, `packs/shared/state/prefsStore.ts`,
`packs/lingo-hero/src/learning/wordStats.ts`,
`corpan-app/src-tauri/src/{content_packs,phrase_packs,db}.rs`,
`docs/journey/codebase/app-shell.md` §2, `docs/journey/specs/course-pack.md` §1.

Related specs: `specs/course-pack.md` (ItemRef serialization — reused as doc keys),
`specs/offline-cache.md` (D12 — **not yet written**; its blob substrate is §3.6 here),
`specs/engine.md` (D4 — **not yet written**; its persistence adapter is DEFINED here,
§3.7, and the engine spec must consume it, not redefine it).

---

## 0. Overview

Three deliverables, one module:

1. **Tier policy** (§2): what is allowed in localStorage vs IndexedDB vs the Tauri
   filesystem, with budgets, and the migration list for today's violations.
2. **Typed adapters** (§3): `corpan-app/src/lib/storage/` — `KVStore`, `DocStore<T>`,
   `AppendLog<T>`, `BlobStore` with IndexedDB + Tauri-fs implementations, write
   batching, versioned schemas, corruption recovery. This is the persistence layer the
   Journey engine (D4/D5), the offline cache (D12), and migrating stores all sit on.
3. **Local analytics** (§4): an append-only, on-device, never-uploaded event log
   (`activity_result`, `card_impression`, sessions, placement, streaks) with a ring
   buffer, daily rollups, and the aggregation queries the engine and the "ghost of you"
   surfaces need. Plus pack exposure via `hostApi` (§5), a dev-only storage doctor
   (§6), and the test plan (§7).

**What already exists (build on it, do not reinvent):** the app has a real, shipped,
quota-safe two-tier storage service at `src/util/storage/index.ts` (TINY = guarded
localStorage, LARGE = IndexedDB `corpan-store` DB with LRU/volatile eviction and an
in-memory degrade mirror — `index.ts:8-32`), a promise IDB wrapper (`idb.ts`), a
zustand-persist shim (`createLocalStorageShim`, `index.ts:448-474`), a one-shot
localStorage→IDB migration (`migrate.ts`), a **telemetry** event ring buffer
(`eventStore.ts`, cap 5k, drains to the cloud `/v1/events` endpoint via
`util/analytics.ts:508-537`), and a node verification harness (`__harness__/run.ts`).
This spec **re-homes** that module to `src/lib/storage/`, upgrades the IDB schema
(v1→v2) with dedicated `docs`/`log` object stores, and adds the typed adapters on top.
The existing quota-safety contract (never throw; log loudly; evict + retry once;
degrade to memory mirror — `index.ts:17-24`) is preserved verbatim for every new API.

**The local analytics store (§4) is NOT `util/analytics.ts`.** That module is
anonymous cloud telemetry (opt-out-gated, uploaded). The D13 store is the learner's own
data: on-device only, no upload seam, powering the engine. They share primitives, never
a queue.

---

## 1. Audit — every persisted byte in `corpan-app/src` today

### 1.1 zustand persist stores → localStorage (raw key = persist `name`)

| Key | File | Contents | Growth | Verdict (§2) |
|---|---|---|---|---|
| `corpan-stacks-v1` (v3) | `store/settings.ts:720-721` | Core profile: stacks, languages, levels, voicePrefs, userClass/ageBand/goalIntensity/interests, theme, onboarded | Bounded (few KB) | **stays TINY** |
| `corpan-progress-v1` | `store/progress.ts:132` | Per-book reading progress `byKey["{bookId}::{lang}"]`, feeds `streakDays()` | Unbounded (per book×lang) | **migrate → IDB (M2)** |
| `corpan-history-v2` (v3) | `store/history.ts:233-234` | Per-stack phrase nav history `{ids[], sources[], index}` — **no cap anywhere in the file** | Unbounded | **migrate → IDB (M4)** |
| `corpan-packs-v1` | `store/games.ts:63` | Installed content packs registry | Bounded (~installed count) | stays TINY |
| `corpan-recent-native-v1` | `store/recentNative.ts:19` | `phraseLastLaunchedAt` | Fixed | stays TINY |
| `corpan-pack-rating-v1` | `store/packRating.ts:20` | Per-experience like/dismiss | Bounded | stays TINY |
| `corpan-rating` (v3) | `store/rating.ts:29` | `hasRated` | Fixed | stays TINY |
| `corpan-landing-v1` | `store/landing.ts:36` | One-shot landing intent | Fixed | stays TINY |
| `corpan-entitlements-v1` | `store/entitlements.ts:81` | Offline Plus lifeline, subjectId | Fixed | stays TINY |
| `corpan-phrase-packs-v1` | `store/phrasePacks.ts:80` | Installed phrase-pack registry (disk mirror) | Bounded | stays TINY |
| `corpan-word-pack-catalog-v1` | `store/wordPackCatalog.ts:128` | Word-pack index — "tiny... so plain localStorage is fine" (`:10`) | **Grows with catalog** (54 langs × pairs) | **migrate → IDB (M3)** |
| `corpan-update-prompt` | `store/updatePrompt.ts:43` | Version-nag dismissal | Fixed | stays TINY |

### 1.2 zustand persist stores → IndexedDB LARGE tier (already migrated)

| Key | File | Mechanism |
|---|---|---|
| `corpan-catalog-v2` | `store/catalog.ts:185-194` | `createLocalStorageShim("game-catalog", { tier: "large", volatile: true })` |
| `corpan-phrase-pack-catalog-v1` | `store/phrasePackCatalog.ts:133-146` | shim ns `phrase-pack-catalog`, volatile |

Both were moved after a production `QuotaExceededError` (`migrate.ts:2-13`). One-shot
migration runs at boot (`main.tsx:107-124`) behind sentinel `corpan-storage-migration-v1`.

### 1.3 Raw (non-zustand) localStorage keys

| Key | Writer | Size/growth | Verdict |
|---|---|---|---|
| `corpan:gate:<packId>:<surface>` | gate v2, `packs/shared/monetization/src/quotas.ts:22` (written via `dailyQuota.ts`; also `devDebug.ts:118-124`) | ~60B × metered surfaces | **stays** — the quota module is contractually "PURE + SYNCHRONOUS" (`quotas.ts:9-16`) |
| `corpan.streak.v1.<packId>` | `packs/shared/streak/src/streak.ts:14` | ~60B × packs | **stays** — sync read in `hostApi.getStreak()` (`contentPacks/hostApi.ts:1130-1133`) |
| `corpan-streak-enabled` | `components/StreakChip.tsx:5,10,18` | 1 flag | stays |
| `corpan-analytics-disabled` | `packs/shared/analytics/index.ts:24` | 1 flag | stays |
| `corpan-analytics-queue` | `packs/shared/analytics/index.ts:25,165` (spillover, capped `MAX_QUEUE`) | Capped | stays (capped); revisit if telemetry volume grows |
| `corpan-analytics-last-lang-by-book` | `packs/shared/analytics/index.ts:30` | Grows per book | borderline — cap at 100 entries (M6, trivial) |
| `corpan:paywall-v1` | `store/paywall.ts:48-60` | Fixed | stays |
| `corpan:subject-id:v1` | `contentPacks/purchase.ts:187-212` | Fixed | stays |
| `corpan:dev-packs` | `components/SettingsModal.tsx:94,123` | 1 flag | stays |
| `corpan.devMode` | documented in `contentPacks/llmTypes.ts:156` | 1 flag | stays |
| `tip:*` | `components/DismissableTip.tsx:51,61` | 1 flag each | stays |
| `corpan-storage-migration-v1` | `util/storage/migrate.ts:17` | sentinel | stays |
| `corpan-store:*` | TINY-tier service keys (`util/storage/index.ts:71`) | small | stays (that's the point) |
| `corpan-settings`, `corpan-history`, `corpan-stacks-v1`-pre-v3 | legacy, read-only migration sources (`settings.ts:428`, `history.ts:57`) | dead | delete after read (M6) |

### 1.4 IndexedDB (`corpan-store` DB, v1, single `kv` object store)

`idb.ts:21-23` — one store keyed `namespace::key`, records carry `{size, createdAt,
touchedAt, expiresAt?, schema?, volatile?}` (`idb.ts:27-46`). Namespaces in use:
`game-catalog`, `phrase-pack-catalog` (catalog shims), `analytics-events` +
`analytics-meta` (telemetry ring buffer, `eventStore.ts:44-53`).

Known weakness (fix in §3.2): the telemetry log does `keys()` + full sort **per
append** (`eventStore.ts:101-107`) — O(n log n) per write. Fine at cap 5k, unacceptable
at the 100k-event D13 log. The `kv` single-store design has no ranged cursor access.

### 1.5 Tauri fs

The frontend has **zero** direct fs access (no `@tauri-apps/plugin-fs` imports — grep
clean). All disk I/O goes through Rust commands:

- `content_packs.rs:73-264` — pack ZIPs downloaded + extracted under
  `app_data_dir()/corpan-packs/<id>/`; manifest read/write.
- `phrase_packs.rs:3` — phrase-pack corpora under `app_data_dir/corpan-packs/<id>/`.
- `db.rs:20-28` — embedded base sqlite copied to app data dir on first run.

There is **no generic blob/cache store** — the reason Home cover images vanish offline
(the D12 named bug). §3.6 adds one.

### 1.6 Pack-side storage habits (they share the app's WebView origin + localStorage)

- `packs/shared/state/prefsStore.ts` — generic per-book prefs at `${prefix}:${bookId}`,
  silent-swallow on quota (violates the "errors are noisy" rule); also
  `bookmarkStore`, `bookMetaStore`, `narrationHistoryStore` in the same package.
- `packs/lingo-hero/src/learning/wordStats.ts:25,80` — Leitner word memory at
  `lingo-hero:wordstats:<scope>`, debounced writes (`:162`). Retired in journey
  context per D11 (FSRS is the one scheduler); standalone mode migrates to
  `hostApi.storage` (M5).
- `packs/corpan-city/src/**` — the heaviest user: identityStore, trackStore (+its own
  `track/migrate.ts`), badgeStore, economy/inventory, questRuntime, immersion store…
- `packs/hanzipan/brush/BrushStore.js`, `packs/melopan/src/storage/projectStore.ts`
  (user-authored projects — a genuinely bad fit for localStorage), `packs/world-radio`.

All of these draw down the ONE shared ~5MB origin budget that already overflowed once.

---

## 2. The storage-tier policy

### 2.1 The table (normative)

| Tier | Backing | What belongs here | Budget | Access | When to use |
|---|---|---|---|---|---|
| **TINY** | localStorage via the guarded TINY tier (`lib/storage`) or zustand persist | **True global state only**: settings/stack config, onboarding + landing intent, entitlement lifeline, small registries (installed packs), one-byte flags/sentinels, gate counters + streak stamps that MUST be synchronously readable | **≤ 512KB app-total target; ≤ 64KB any single key; hard ceiling is the shared ~5MB origin quota** | sync (or zustand) | Value is small, bounded, hot, and needed at/before first paint or inside a synchronous contract (quotas.ts). If it grows with usage (per item/book/day/event), it does NOT belong here |
| **IDB-DOC** | IndexedDB `docs` store via `DocStore<T>` | Structured per-course/per-user records: FSRS ItemCards, journey position, per-book progress, phrase history, catalogs, rollups | ≤ 50MB across doc namespaces (soft; doctor warns) | async, batched | Keyed records you read individually or as a namespace; anything per-(stack, course, item) |
| **IDB-LOG** | IndexedDB `log` store via `AppendLog<T>` | Append-only event streams: the local analytics log (§4), any future journaling | 100k records / 48MB per log ns, ring-pruned | async, batched, seq-ordered | Time-ordered facts you append and scan, never update in place |
| **IDB-KV (LARGE)** | existing `kv` store via namespaces | Volatile caches, zustand shims, blobs ≤ ~1MB that must work in web-dev (no Tauri) | evictable; LRU + volatile-first under pressure (`index.ts:135-153`) | async | Cache-shaped data; anything already on `createLocalStorageShim` |
| **FS-BLOB** | Tauri fs via Rust `blob_store_*` commands, `app_data_dir/blob-store/<ns>/` | Media + binary caches: cover images (D12), audio snippets, imagepan assets, exported files | 128MB default total, per-ns caps, LRU prune | async invoke | Bytes > ~256KB, or anything image/audio/binary. IDB-KV fallback when not under Tauri |
| **FS-PACKS** | Rust-managed installs (`content_packs.rs`) | Installed pack payloads (ZIPs, SQLite, JS) | user-managed (install/uninstall) | Rust commands | Unchanged — not touched by this spec |

Rules of thumb: **localStorage answers "who is the user"; IndexedDB answers "what has
the user done"; the filesystem holds "what the user downloaded or produced."**

### 2.2 Violation list + migration plan

Migrations are independent, shippable one per PR, ordered by (risk ↑, value ↓):

| # | What | How | Risk notes |
|---|---|---|---|
| **M1** | *(not a migration)* All NEW Journey state lands directly on §3 adapters | engine ItemCards → `DocStore`, events → `AppendLog`, journey meta → small zustand `corpan-journey-v1` (TINY, per D5) | none — greenfield |
| **M2** | `corpan-progress-v1` → IDB-KV shim | One-line change, clone of `catalog.ts:189-194`: `storage: createJSONStorage(() => createLocalStorageShim("progress", { tier: "large", volatile: false }))` + add legacy key to `LEGACY_BLOBS` (`migrate.ts:30-41`) + bump sentinel to `corpan-storage-migration-v2` | Hydration becomes async → `StreakChip`/`booksInFlight` render a frame late. Mitigate: gate Home streak UI on `useProgressStore.persist.hasHydrated()`. **volatile: false** — this is durable state, not a cache |
| **M3** | `corpan-word-pack-catalog-v1` → IDB-KV shim | Same one-liner, ns `word-pack-catalog`, `volatile: true` + `LEGACY_BLOBS` entry | Trivial; matches the two sibling catalogs |
| **M4** | `corpan-history-v2` → IDB-KV shim **+ cap** | Shim ns `history`, `volatile: false`; AND cap `ids[]` at 500/stack in `pushEntry` (today unbounded) | The Rust sampler's anti-repeat `exclude` list (`history.ts:195-215`) is empty until hydration — first sample of a session may repeat a recent phrase. Acceptable; or await `persist.rehydrate()` in the first `getRecentTuples` caller |
| **M5** | Pack-private localStorage → `hostApi.storage` (§5.1) | Additive SDK release; packs migrate opportunistically. Priority: melopan projects (user-authored data), corpan-city stores, lingo-hero wordstats (standalone mode only — journey mode retires it per D11). `packs/shared/state/prefsStore.ts` grows a hostApi-backed variant with the localStorage path as fallback | No forced deadline; the shared-origin budget pressure drops as each pack moves. Never break a pack that runs against an older host (feature-detect, `types.ts:562-565` policy) |
| **M6** | Hygiene | Delete legacy keys after migration read (`corpan-settings`, `corpan-history`); cap `corpan-analytics-last-lang-by-book` at 100 entries | Trivial |
| **M7** *(optional, later)* | Telemetry `eventStore.ts` → `AppendLog` impl | Replaces the O(n log n)-per-append `enforceCap` (`eventStore.ts:101-112`) with the §3.4 log; keeps its public API (`record/drainForUpload/acknowledge`) byte-compatible | Do after §3 has soaked; telemetry is working today |

**Order: M1 → M2 → M3 → M4 → M6 → M5 → M7.** Each M2–M4 PR extends `LEGACY_BLOBS` and
bumps the migration sentinel; `migrateOversizedLocalStorage()` is already idempotent
and re-runs safely (`migrate.ts:63-65`).

---

## 3. Typed adapter layer — `corpan-app/src/lib/storage/`

### 3.1 Module layout + re-homing

`src/lib/` is the established home for app-wide leaf utilities (`lib/utils.ts`,
`lib/appVersion.ts`, `lib/getPlatform.ts`). The storage service moves there and the
adapters land beside it:

```
src/lib/storage/
    index.ts          // re-homed util/storage/index.ts (tiers, namespaces, shim) + new exports
    idb.ts            // re-homed util/storage/idb.ts, upgraded to DB v2 (§3.2)
    kv.ts             // KVStore interface + tiny/large implementations
    doc.ts            // DocStore<T> + IdbDocStore<T>
    log.ts            // AppendLog<T> + IdbAppendLog<T>
    blob.ts           // BlobStore + TauriFsBlobStore + IdbBlobStore fallback
    batch.ts          // WriteBatcher (shared by doc.ts/log.ts)
    namespaces.ts     // central namespace registry (doctor + eviction policy read this)
    doctor.ts         // usage/corruption reporting (§6)
    migrate.ts        // re-homed util/storage/migrate.ts (LEGACY_BLOBS grows per §2.2)
    eventStore.ts     // re-homed telemetry ring buffer (unchanged until M7)
    __harness__/      // re-homed + extended node harness (§7)
```

Old paths become one-line re-export shims for one release
(`src/util/storage/index.ts` → `export * from "@/lib/storage"`), then are deleted.
`git mv` the files so history survives. No behavior change in the move commit.

### 3.2 IndexedDB schema v2

`IDB_DB_VERSION` 1 → 2 in `idb.ts`. `onupgradeneeded` (additive — the existing `kv`
store and its records are untouched, so catalogs/telemetry survive the upgrade with
zero migration):

```ts
export const IDB_DB_VERSION = 2
export const IDB_DOC_STORE = "docs"
export const IDB_LOG_STORE = "log"

// inside req.onupgradeneeded — keep the existing kv creation, then:
if (!db.objectStoreNames.contains(IDB_DOC_STORE)) {
    const docs = db.createObjectStore(IDB_DOC_STORE, { keyPath: ["ns", "id"] })
    docs.createIndex("ns", "ns", { unique: false })
}
if (!db.objectStoreNames.contains(IDB_LOG_STORE)) {
    const log = db.createObjectStore(IDB_LOG_STORE, { keyPath: ["ns", "seq"] })
    log.createIndex("ns", "ns", { unique: false })
    log.createIndex("ns_ts", ["ns", "ts"], { unique: false })
}
```

Record shapes (exported from `idb.ts`):

```ts
export type DocRecord = {
    ns: string          // namespace, from namespaces.ts
    id: string          // e.g. a serialized ItemRef (course-pack.md §1)
    v: unknown          // the document (structured-clonable)
    schema: number      // namespace schema version at write time
    size: number        // best-effort bytes (estimateSize)
    updatedAt: number   // epoch ms
}

export type LogRecordRaw = {
    ns: string
    seq: number         // monotonic per ns, assigned at enqueue (§3.5)
    ts: number          // epoch ms
    v: unknown          // the entry payload
    size: number
}
```

New primitives in `idb.ts`, same never-throw contract as the existing ones
(`idb.ts:140-155`): `idbDocGet(ns,id)`, `idbDocGetAll(ns)`, `idbDocCount(ns)`
(uses `IDBObjectStore.count(IDBKeyRange.bound([ns,""],[ns,"￿"]))`),
`idbDocDelete(ns,id)`, `idbDocClear(ns)`, `idbLogRange(ns, fromSeq, toSeq, limit,
reverse)` (cursor over `IDBKeyRange.bound([ns,fromSeq],[ns,toSeq])`),
`idbLogCount(ns)`, `idbLogDeleteRange(ns, fromSeq, toSeq)`, and
`idbBatchWrite(docs: DocRecord[], logs: LogRecordRaw[])` — one readwrite transaction
spanning both stores (the batcher's commit path).

### 3.3 `KVStore` (interface parity for the existing namespace handle)

```ts
// lib/storage/kv.ts
export interface KVStore {
    get(key: string): Promise<string | undefined>
    getJSON<T>(key: string): Promise<T | undefined>
    set(key: string, value: string): Promise<void>
    setJSON<T>(key: string, value: T): Promise<void>
    del(key: string): Promise<void>
    keys(): Promise<string[]>
}

/** Adapter over the existing StorageNamespace — zero new machinery. */
export function kvStore(ns: string, opts?: NamespaceOptions): KVStore
```

`StorageNamespace` (`index.ts:303-313`) already IS this shape; `kvStore()` just narrows
it. Exists so hostApi (§5) and the engine hand out an interface, not the service.

### 3.4 `DocStore<T>` — versioned, validated, batched documents

```ts
// lib/storage/doc.ts
export interface DocCodec<T> {
    /** Bump when T's shape changes incompatibly. Stamped on every record. */
    schemaVersion: number
    /** Validate/narrow a raw stored value. Return null for corrupt/alien data
     *  (it will be dropped + counted, never thrown). Zod `.safeParse` fits here
     *  but the interface is dependency-free. */
    parse(raw: unknown): T | null
    /** Optional lazy upgrade for records written at an older schemaVersion.
     *  Absent or returning null ⇒ the old record is treated as corrupt (dropped). */
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
    ns: string,               // MUST be registered in namespaces.ts
    codec: DocCodec<T>,
    batcher?: WriteBatcher,   // defaults to the shared app batcher
): DocStore<T>
```

Read path: `idbDocGet` → miss in IDB checks the batcher's pending map and the memory
mirror → `rec.schema === codec.schemaVersion ? codec.parse(rec.v)` : try
`codec.migrate(rec.v, rec.schema)` (successful migration is re-`put` lazily) : drop
record, `doctor.countCorrupt(ns)`, return `undefined`. **A DocStore read never throws
and never returns unvalidated data.**

### 3.5 `AppendLog<T>` — ordered, ring-buffered event streams

```ts
// lib/storage/log.ts
export type LogRecord<T> = { seq: number; ts: number; entry: T }

export interface AppendLog<T> {
    readonly ns: string
    /** Assigns the seq SYNCHRONOUSLY (in-memory counter) and enqueues the write
     *  on the batcher. Resolves the assigned seq when the batch commits.
     *  Never throws; worst case the record lives in the memory mirror. */
    append(entry: T): Promise<number>
    /** Ranged read via cursor — never loads the whole log. */
    read(opts?: {
        fromSeq?: number; toSeq?: number
        fromTs?: number; toTs?: number      // uses the ns_ts index
        limit?: number; reverse?: boolean
    }): Promise<LogRecord<T>[]>
    /** Streaming fold over a range — the aggregation workhorse (§4.5).
     *  Processes CHUNK=500 records per transaction so the main thread breathes. */
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
    codec: DocCodec<T>,        // same validation contract; corrupt records are SKIPPED in read/scan, counted in doctor
    opts?: { cap?: { maxRecords: number; maxBytes: number } },
    batcher?: WriteBatcher,
): AppendLog<T>
```

Implementation notes:

- **Seq counter**: loaded once from a meta doc (`docs` store, ns `__logmeta`, id =
  log ns, value `{ headSeq, count, bytes }`), then maintained in memory and persisted
  with each batch commit — the `eventStore.ts:62-80` pattern, but the meta rides the
  same transaction as the records so they can't diverge.
- **O(1) appends**: no key scans (the `eventStore.ts:101-107` mistake). `count` and
  `bytes` are maintained in the meta doc; `prune` runs a bounded
  `idbLogDeleteRange(ns, 0, headSeq - keepLast)` cursor delete when
  `count > maxRecords * 1.1` or `bytes > maxBytes` (10% hysteresis so pruning is
  amortized, not per-append), from inside the batch commit.
- Cap defaults come from `namespaces.ts` (§3.8).

### 3.6 `BlobStore` — Tauri fs tier

```ts
// lib/storage/blob.ts
export interface BlobStore {
    readonly ns: string
    get(key: string): Promise<Uint8Array | undefined>
    /** Never throws. On disk-full: prunes LRU within the ns budget, retries once. */
    put(key: string, bytes: Uint8Array, opts?: { ttlMs?: number }): Promise<void>
    delete(key: string): Promise<void>
    has(key: string): Promise<boolean>
    stats(): Promise<{ files: number; bytes: number }>
    clear(): Promise<void>
}

/** Tauri: Rust-backed. Web dev / packs without fs: IDB-KV-backed fallback
 *  (kv records hold the Uint8Array — structured-clonable, volatile). Selected
 *  once at module init by feature-detecting `window.__TAURI_INTERNALS__`. */
export function blobStore(ns: string): BlobStore
```

New Rust commands (`corpan-app/src-tauri/src/blob_store.rs`, registered in `lib.rs`;
follow the error style of `content_packs.rs` — `Result<_, String>`):

```rust
#[tauri::command] fn blob_store_read(app: AppHandle, ns: String, key: String) -> Result<Option<Vec<u8>>, String>;
#[tauri::command] fn blob_store_write(app: AppHandle, ns: String, key: String, bytes: Vec<u8>) -> Result<(), String>;
#[tauri::command] fn blob_store_delete(app: AppHandle, ns: String, key: String) -> Result<(), String>;
#[tauri::command] fn blob_store_stats(app: AppHandle, ns: Option<String>) -> Result<Vec<BlobNsStats>, String>; // {ns, files, bytes}
#[tauri::command] fn blob_store_prune(app: AppHandle, ns: String, max_bytes: u64) -> Result<u64, String>;      // LRU by mtime, returns bytes freed
```

Layout: `app_data_dir/blob-store/<ns>/<hex(sha256(key))>` + sidecar
`<hash>.meta.json` `{ key, createdAt, expiresAt? }` (mtime = touch stamp; `read`
touches). `ns` and hash are validated `[a-z0-9-]+`/`[0-9a-f]{64}` — no path traversal.

This is the substrate `specs/offline-cache.md` (D12) puts cover images and revalidated
payloads on; that spec defines TTL/ETag policy, this one defines the bytes-at-rest API.

### 3.7 The engine persistence adapter (what `specs/engine.md` consumes)

Per D5, learner state is keyed `(stackId, courseId)`. The engine (pure TS, zero
DOM/Tauri imports — D4) receives this interface at construction; the app wires it in
`src/journey/persistence.ts`; simulation harnesses wire in-memory fakes:

```ts
// src/journey/engine/persistence.ts  (types only — pure)
import type { DocStore, AppendLog, KVStore } from "@/lib/storage"

export interface EnginePersistence {
    /** FSRS item cards. Doc id = serialized ItemRef (course-pack.md §1).
     *  ns = `journey-cards:${stackId}:${courseId}`. ~64B × ≤25k ≈ 1.6MB (D5). */
    itemCards: DocStore<ItemCardRecord>
    /** THE review history. This is the §4 local analytics log — the engine
     *  reads `activity_result` records for calibration + future FSRS weight
     *  optimization. One log, two readers; no second copy (refines D5's
     *  "review-log ring buffer" wording — see Decisions). */
    events: AppendLog<LocalAnalyticsEvent>          // shared app-wide log, §4
    /** Small engine meta: θ, placement snapshot, mixer window state.
     *  ns = `journey-meta:${stackId}:${courseId}` (IDB-DOC via kvStore). */
    meta: KVStore
}
```

`ItemCardRecord` is owned by `specs/engine.md`; this spec fixes only where it lives and
that its codec must supply `schemaVersion` + `parse` + `migrate` (FSRS card loss =
re-placement — recoverable but expensive, so `migrate` is mandatory for any card
schema bump, enforced by review).

### 3.8 Namespace registry

Every doc/log/blob namespace is declared centrally so the doctor can enumerate and the
pruner knows budgets. Unregistered namespaces are a dev-time `console.error` (not a
throw — packs via hostApi get auto-registered `pack:<packId>` namespaces):

```ts
// lib/storage/namespaces.ts
export type NsKind = "doc" | "log" | "blob" | "kv"
export type NsDecl = {
    kind: NsKind
    owner: "app" | "journey" | "pack"
    durable: boolean                       // false ⇒ evictable cache
    budget?: { maxRecords?: number; maxBytes?: number }
}

export const NAMESPACES: Record<string, NsDecl> = {
    // existing kv namespaces
    "game-catalog":          { kind: "kv",  owner: "app",     durable: false },
    "phrase-pack-catalog":   { kind: "kv",  owner: "app",     durable: false },
    "word-pack-catalog":     { kind: "kv",  owner: "app",     durable: false },              // M3
    "progress":              { kind: "kv",  owner: "app",     durable: true },               // M2
    "history":               { kind: "kv",  owner: "app",     durable: true },               // M4
    "analytics-events":      { kind: "kv",  owner: "app",     durable: true,
                               budget: { maxRecords: 5_000 } },                              // telemetry (M7 → log)
    // new
    "local-analytics":       { kind: "log", owner: "app",     durable: true,
                               budget: { maxRecords: 100_000, maxBytes: 48 * 2 ** 20 } },    // §4
    "analytics-rollups":     { kind: "doc", owner: "app",     durable: true,
                               budget: { maxRecords: 2_000 } },                              // §4.6
    "journey-cards":         { kind: "doc", owner: "journey", durable: true },               // prefix; per (stack,course) suffix
    "journey-meta":          { kind: "doc", owner: "journey", durable: true },
    "cover-cache":           { kind: "blob", owner: "app",    durable: false,
                               budget: { maxBytes: 64 * 2 ** 20 } },                         // D12 consumer
}
```

### 3.9 Write batching — `WriteBatcher`

```ts
// lib/storage/batch.ts
export class WriteBatcher {
    constructor(opts?: { maxDelayMs?: number /* 250 */; maxPending?: number /* 64 */ })
    enqueueDoc(rec: DocRecord): Promise<void>       // resolves on commit
    enqueueLog(rec: LogRecordRaw): Promise<void>
    enqueueDocDelete(ns: string, id: string): Promise<void>
    flush(): Promise<void>                          // idempotent, single-flight
    pendingCount(): number
}
export const appBatcher: WriteBatcher              // the shared default
```

Behavior:

- Coalesces: repeated `put` of the same `(ns, id)` within a window keeps only the last.
- Flush triggers: 250ms debounce after first enqueue, OR `maxPending` reached, OR
  explicit `flush()`, OR `pagehide` / `visibilitychange → hidden` (registered once at
  module init — the same lifecycle moment `util/analytics.ts:98-99` already uses).
- Commit = ONE readwrite transaction over `docs` + `log` (`idbBatchWrite`), then log
  meta docs, then prune checks.
- Quota failure on commit: `storage.evictLargeTier(16)` (`index.ts:432-435`) → retry
  once → on second failure, park records in the memory mirror + resolve (existing
  contract, `index.ts:88-95`); doctor increments `degradedWrites`.
- Reads always consult pending-batch state first (read-your-writes).

### 3.10 Corruption recovery ladder

Levels, in escalation order — every level resolves, logs loudly, and increments a
doctor counter; **nothing at any level throws to product code**:

1. **Record**: `codec.parse` fails / schema unmigratable → delete the record, count
   `corruptRecords[ns]`, return `undefined` (docs) or skip (log scans).
2. **Namespace**: log meta disagrees with actual store contents beyond tolerance
   (detected opportunistically at prune) → rebuild meta by one cursor pass; if the
   namespace itself is unreadable → `clear()` it, count `nukedNamespaces[ns]`. Derived
   data (rollups §4.6, catalogs) rebuilds automatically; durable data loss surfaces in
   the doctor.
3. **Database**: `openDb()` fails → the existing null-degrade already handles the
   session (`idb.ts:60-111`). NEW: count consecutive open failures in localStorage key
   `corpan-store:open-failures`; at **≥2** consecutive boot failures,
   `indexedDB.deleteDatabase(IDB_DB_NAME)` → reopen fresh → reset counter → set doctor
   flag `dbRebuiltAt`. A working empty app beats a permanently broken full one;
   catalogs re-fetch, telemetry restarts, learner re-places (this is the disaster
   floor, not the plan).

### 3.11 Public surface (additions to `lib/storage/index.ts`)

```ts
export { storage, createLocalStorageShim } from existing        // unchanged
export { kvStore, type KVStore } from "./kv"
export { docStore, type DocStore, type DocCodec } from "./doc"
export { appendLog, type AppendLog, type LogRecord } from "./log"
export { blobStore, type BlobStore } from "./blob"
export { WriteBatcher, appBatcher } from "./batch"
export { NAMESPACES, type NsDecl } from "./namespaces"
export { storageDoctor } from "./doctor"
```

---

## 4. The LOCAL ANALYTICS store — `corpan-app/src/lib/localAnalytics/`

### 4.1 Stance (normative, quote it in code comments)

> **This is the learner's own history, not telemetry.** Every record stays on this
> device. There is no upload path, no endpoint constant, no drain/acknowledge seam in
> this module, and adding one is out of scope for any engineering task without an
> explicit operator decision. It exists so the app can be smart offline: engine
> calibration, personal records, streak truth, strand balance. Cloud telemetry lives
> in `util/analytics.ts` + `lib/storage/eventStore.ts` and is a different store.

Enforced mechanically: `lib/localAnalytics/**` must not import `@shared/analytics`,
`fetch` an URL, or reference `eventStore.ts` (add an ESLint `no-restricted-imports`
rule for the directory). The telemetry reconcile (`util/analytics.ts:508-537`) cannot
see this log because it drains only the `analytics-events` namespace.

It is **not gated by `corpan-analytics-disabled`** — that flag governs telemetry
upload; this data never leaves the device regardless. The user control here is
deletion: a "Delete learning history" action (Settings → Privacy) calling
`localAnalytics.clearAll()` (wipes log + rollups; FSRS cards are separate and get
their own reset in Journey settings). *(Flagged as decision D-c below.)*

**Non-goals**: not telemetry; not an A/B substrate; no device/user identifiers in any
payload; no free-text (fixed unions + numbers + ids only); no PII.

### 4.2 Module layout

```
src/lib/localAnalytics/
    index.ts        // record(), session lifecycle, clearAll(), the AppendLog instance
    events.ts       // the taxonomy (types below) + codec (schemaVersion 1)
    queries.ts      // aggregation reads (§4.5)
    rollups.ts      // daily rollup maintenance (§4.6)
```

### 4.3 Event taxonomy (v1)

```ts
// lib/localAnalytics/events.ts
import type { ActivityResult } from "@/contentPacks/types"   // D2 shape

export type Strand = "mfi" | "mfo" | "lfl" | "fd"            // Four Strands (D4 mixer)
export type FeedSlot = "due" | "new" | "repair" | "fun" | "flex" | "checkpoint" | "placement"

/** Envelope — every event carries this. */
export type LocalAnalyticsEvent = {
    v: 1
    ts: number                 // epoch ms
    day: string                // localDay() YYYY-MM-DD (the app's one time unit, quotas.ts convention)
    sid: string                // in-memory session uuid (new per app session; never persisted elsewhere)
    stackId: string
    courseId?: string          // absent for non-journey surfaces
    e: LocalEventPayload
}

export type LocalEventPayload =
    | ActivityResultEvent | CardImpressionEvent
    | SessionStartEvent | SessionEndEvent
    | PlacementProbeEvent | PlacementFinalEvent
    | StreakDayEvent | StreakRepairEvent | RestDayEarnedEvent | StreakLostEvent
    | CheckpointEvent | RareCardEvent

/** One per completed/abandoned activity. THE calibration + review-history record. */
export type ActivityResultEvent = {
    type: "activity_result"
    specId: string
    activityType: string
    provider: "native" | "capability" | "pack"    // D8/D14 provenance
    providerId?: string                            // pack/module id when not native
    slot: FeedSlot
    strand: Strand                                 // stamped by the mixer on the spec
    score: number                                  // 0..1 (ActivityResult.score)
    durationMs: number
    abandoned?: boolean
    items: Array<{
        ref: string                                // serialized ItemRef (course-pack.md §1)
        outcome: "pass" | "partial" | "fail"
        grade: 1 | 2 | 3 | 4                       // derived FSRS grade (D4)
        latencyMs?: number
        hintsUsed?: number
        /** FSRS retrievability of this item AT ASK TIME — the predicted-vs-actual key. */
        predictedRecall?: number
        /** Elo inputs at ask time — θ calibration. */
        b?: number
        theta?: number
    }>
}

export type CardImpressionEvent = {
    type: "card_impression"
    specId: string
    activityType: string
    slot: FeedSlot
    strand: Strand
    position: number            // 0-based index within the session feed
    itemCount: number
}

export type SessionStartEvent = {
    type: "session_start"
    trigger: "landing" | "home_hero" | "deeplink" | "resume"
    dueCount: number
    newCount: number
    theta?: number
}
export type SessionEndEvent = {
    type: "session_end"
    cards: number
    passRate: number            // 0..1 over the session's activity_results
    durationMs: number
    endReason: "checkpoint_stop" | "quit" | "backgrounded" | "daily_lock" | "feed_exhausted"
}

export type PlacementProbeEvent = {
    type: "placement_probe"
    ref: string; b: number
    outcome: "pass" | "fail"
    thetaAfter: number; seAfter: number
}
export type PlacementFinalEvent = {
    type: "placement_final"
    theta: number; se: number
    band: string                // arc/unit band label from the course pack
    itemsUsed: number; durationMs: number; priorKnownSeeded: number
}

export type StreakDayEvent    = { type: "streak_day"; length: number; restDaysBanked: number }
export type StreakRepairEvent = { type: "streak_repair"; lengthRestored: number }
export type RestDayEarnedEvent = { type: "rest_day_earned"; banked: number }
export type StreakLostEvent   = { type: "streak_lost"; length: number }

export type CheckpointEvent = { type: "checkpoint"; position: number; choice: "stop" | "continue" }
export type RareCardEvent   = { type: "rare_card"; rarity: "delight" | "minigame" | "gem" | "story"; cardKind: string }
```

New event types are **additive** (extend the union, bump nothing); breaking payload
changes bump envelope `v` and the codec migrates or skips old records.

### 4.4 Recorder API

```ts
// lib/localAnalytics/index.ts
export function recordLocal(e: LocalEventPayload, ctx?: { courseId?: string }): void
// - fills the envelope (ts, day, sid, stackId from useSettingsStore.getState(), courseId)
// - void-appends to appendLog("local-analytics", codec)  — fire-and-forget, never throws
// - hands the record to rollups.apply() (in-memory rollup update, batched persist)

export function startLocalSession(s: Omit<SessionStartEvent, "type">): string  // returns sid
export function endLocalSession(e: Omit<SessionEndEvent, "type">): void        // also flushes the batcher
export async function clearAll(): Promise<void>                                // log + rollups
export const localEvents: AppendLog<LocalAnalyticsEvent>                       // for the engine (§3.7) + queries
```

Wiring: the Journey feed calls `recordLocal` at its result chokepoint (the same place
`hostApi.journey.reportResult` lands — D2), impressions at card mount, sessions at
feed enter/exit. `endLocalSession` + the batcher's `pagehide` flush bound loss on kill
to ≤250ms of events.

Retention (from `namespaces.ts`): **100k records / 48MB**, oldest pruned in 10%
batches. At a heavy learner's ~200 events/day that is >16 months of history;
`activity_result` dominates bytes (~350B avg incl. per-item array).

### 4.5 Aggregation queries (the contract — these MUST be answerable)

```ts
// lib/localAnalytics/queries.ts
export type CalibrationBucket = { pLow: number; pHigh: number; predictedMean: number; actualPassRate: number; n: number }
export type CalibrationReport = { buckets: CalibrationBucket[]; brier: number; n: number; windowDays: number }
/** Engine calibration: predicted (FSRS retrievability at ask time) vs actual pass,
 *  bucketed by predicted decile. Feeds the D4 report + future weight optimization. */
export function getCalibrationReport(courseId: string, opts?: { windowDays?: number /* 30 */; buckets?: number /* 10 */ }): Promise<CalibrationReport>

export type PersonalRecords = {
    bestDayCards: { day: string; cards: number }
    bestSessionPassRate: { sid: string; passRate: number; cards: number }
    fastestCorrectMsByActivityType: Record<string, number>
    longestStreak: number
    mostItemsIntroducedInDay: { day: string; items: number }
}
/** "Ghost of you": the learner races their own bests, never a leaderboard. */
export function getPersonalRecords(courseId: string): Promise<PersonalRecords>

export type EngagementStatus = "new" | "current" | "at_risk" | "resurrected" | "dormant"
export type EngagementSnapshot = {
    status: EngagementStatus
    activeDaysLast28: number
    lastActiveDay: string | null
    gapDays: number
    resurrectedAt?: string       // day the current return-from-≥7-day-gap began
}
/** CURR-style buckets applied to THIS learner's own day-series (local, per course):
 *  current = active within 1 day; at_risk = gap 2–6 days; resurrected = active today
 *  after gap ≥7; new = first 7 days since first event; dormant = gap ≥7 and inactive.
 *  Drives warm-win openers and re-entry copy — never notifications spam. */
export function getEngagementSnapshot(courseId?: string): Promise<EngagementSnapshot>

export type StrandBalance = Record<Strand, { ms: number; cards: number; share: number }>
/** Strand accounting over a rolling window — the D4 mixer's enforcement input. */
export function getStrandBalance(courseId: string, windowDays?: number /* 7 */): Promise<StrandBalance>

export type DailyRollup = { /* §4.6 */ }
export function getDailyRollups(courseId: string | null, fromDay: string, toDay: string): Promise<DailyRollup[]>
```

All queries read **rollups first** (O(days)); only `getCalibrationReport` and
`fastestCorrectMs` fall through to a bounded `localEvents.scan` over the window
(cursor-chunked, §3.5). No query may call `read()` without a range bound.

### 4.6 Daily rollups (derived, rebuildable)

`DocStore<DailyRollup>` on ns `analytics-rollups`, id = `${courseId ?? "app"}:${day}`:

```ts
export type DailyRollup = {
    day: string; courseId: string | null
    cards: number; passes: number; partials: number; fails: number
    ms: number; sessions: number
    itemsIntroduced: number
    byStrand: Record<Strand, { ms: number; cards: number }>
    byActivityType: Record<string, { cards: number; passes: number; fastestCorrectMs?: number }>
    calib: Array<{ n: number; pSum: number; passes: number }>   // 10 fixed deciles
}
```

Maintained incrementally by `rollups.apply(event)` at record time (rides the same
batcher). Rollups are **derived state**: `rebuildRollups()` clears the namespace and
re-folds the whole log (chunked scan) — this is the §3.10 level-2 recovery for this
namespace and a doctor button.

---

## 5. hostApi exposure (additive, optional — house policy `types.ts:562-565`)

New optional members on the hostApi built in `contentPacks/hostApi.ts`, typed in
`contentPacks/types.ts`, advertised in `__CORPAN_HOST_CAPS` as
`{ storageKv: 1, localAnalytics: 1 }`. Packs feature-detect; SDK-lagging packs see
nothing new.

### 5.1 `hostApi.storage` — pack-scoped KV (the M5 landing zone)

```ts
// contentPacks/types.ts
export interface PackStorageApi {
    /** Durable, pack-scoped KV on the IDB-DOC tier. Namespace is host-stamped
     *  `pack:<packId>` — a pack can NEVER read or write another pack's data.
     *  Budget: 2MB / 1,000 keys per pack (host-enforced; over-budget writes are
     *  dropped + console.error'd, mirroring the never-throw contract). */
    kv: {
        get(key: string): Promise<string | null>
        set(key: string, value: string): Promise<void>
        remove(key: string): Promise<void>
        keys(): Promise<string[]>
    }
}
// hostApi.ts: storage: buildPackStorageApi(packId)  — thin wrapper over
// docStore(`pack:${packId}`, stringCodec) with budget checks.
```

`packs/shared/state/prefsStore.ts` gains `createHostPrefsStore(hostApi, prefix,
defaults)` that uses this when present and falls back to the current localStorage path
— packs migrate by swapping one factory call.

### 5.2 `hostApi.localAnalytics` — write events, read OWN aggregates

```ts
// contentPacks/types.ts
export interface PackLocalAnalyticsApi {
    /** Append a pack event to the on-device log. Host stamps the envelope and
     *  forces `provider: "pack"`, `providerId: <packId>`. `type` is free-form but
     *  namespaced by the host to `pack:<packId>:<type>`; payload values are
     *  string | number | boolean only (structural clone of telemetry's EventProps
     *  constraint, util/analytics.ts:52). Rate limit: 5,000 events/pack/day —
     *  excess dropped + counted in the doctor. NEVER uploaded (§4.1). */
    record(type: string, payload?: Record<string, string | number | boolean>): void
    /** A pack reads ONLY aggregates derived from its own events (+ the journey
     *  activity_results whose providerId === this pack — its own performance). */
    getDailyCounts(opts: { type?: string; windowDays?: number }): Promise<Array<{ day: string; count: number }>>
    getOwnActivityStats(opts?: { windowDays?: number }): Promise<{ cards: number; passRate: number; avgLatencyMs?: number }>
}
```

Deliberately narrow: no raw log reads for packs, no cross-pack visibility, no
envelope fields exposed (`sid`/`stackId` stay host-side). Journey-launched pack
activities do NOT need `record` for results — results flow through
`hostApi.journey.reportResult` (D2) and the host writes the `activity_result` event;
`record` is for pack-internal progression facts (e.g. corpan-city badge earned) that
the pack wants to survive its own localStorage retirement.

### 5.3 `hostApi.journey.reportResult` interaction (D2)

The host's `reportResult(result: ActivityResult)` handler is the single chokepoint
that (a) forwards to the engine, and (b) calls `recordLocal({ type:
"activity_result", ... })` with the mixer's slot/strand stamps. Packs never write
`activity_result` directly — one writer, one shape.

---

## 6. Storage doctor (dev-only)

### 6.1 Programmatic — extend `__corpanDebug` (`util/devDebug.ts`)

```ts
// lib/storage/doctor.ts
export type StorageDoctorReport = {
    localStorage: { totalBytes: number; keys: Array<{ key: string; bytes: number }> }   // sorted desc
    idb: {
        estimate: { usage: number; quota: number } | null                               // idbEstimate()
        kv:   Array<{ ns: string; records: number; bytes: number; volatile: number }>
        docs: Array<{ ns: string; records: number; bytes: number; schema?: number }>
        logs: Array<{ ns: string; records: number; bytes: number; headSeq: number; capPct: number }>
    }
    fs: Array<{ ns: string; files: number; bytes: number }>                             // blob_store_stats; [] off-Tauri
    health: {
        corruptRecords: Record<string, number>
        nukedNamespaces: Record<string, number>
        degradedWrites: number            // memory-mirror parks this session
        memoryMirrorEntries: number
        dbRebuiltAt: number | null
        openFailures: number
        packEventDrops: Record<string, number>   // §5.2 rate-limit hits
    }
    violations: string[]   // policy lint: unregistered namespaces; localStorage keys
                           // > 64KB; TINY total > 512KB; log > 90% of cap
}
export const storageDoctor: { report(): Promise<StorageDoctorReport> }

// devDebug.ts additions (same object style as the existing quota helpers, :85-130):
// __corpanDebug.storage.report()        — the full report, console.table-friendly
// __corpanDebug.storage.violations()    — just the lint list
// __corpanDebug.storage.evict(n=16)     — storage.evictLargeTier(n)
// __corpanDebug.storage.clearNs(ns)     — nuke one namespace (guarded confirm arg)
// __corpanDebug.storage.rebuildRollups()
// __corpanDebug.storage.seedEvents(n)   — synthetic local-analytics events (test data)
```

### 6.2 Visual — `components/dev/StorageDoctorPanel.tsx`

Rendered inside `SettingsModal` ONLY when the existing dev unlock is set
(`localStorage["corpan:dev-packs"] === "true"`, the `SettingsModal.tsx:94` pattern).
Shows the report as: per-tier usage bars, top-10 heaviest namespaces, health counters,
violations in red, and buttons for `evict` / `rebuildRollups` / `clearNs`. Dev-only
surface ⇒ plain English strings, **no `t()` keys** (keeps the ~54-locale
`check:i18n` gate untouched; this is the established exemption for dev chrome). The
one user-facing string this spec adds — Settings → Privacy → "Delete learning
history" (§4.1) — DOES get a `t()` key and all-locale fill per repo policy.

---

## 7. Test plan

### 7.1 Node harness (extend `lib/storage/__harness__/run.ts` — same esbuild+node proof style)

Existing sections 1–4 keep passing untouched (tiny quota, large persistence, large
eviction, telemetry ring). New sections:

5. **DocStore round-trip + schema**: put/getMany/getAll; write at schemaVersion 1,
   read with codec v2 + `migrate` → upgraded value re-persisted; codec v2 without
   `migrate` → undefined + `corruptRecords` incremented; record deleted.
6. **DocStore corruption**: hand-inject garbage (`fakes.ts` gains
   `injectRawDocRecord(ns, id, junk)`) → `get` returns undefined, never throws,
   counter++.
7. **AppendLog ordering + batching**: 1,000 rapid `append`s → seqs strictly
   monotonic; reads-see-pending before flush; after simulated reload, `headSeq` and
   `count` match; **exactly one** transaction per flush window (fakes count txns).
8. **Ring cap + O(1) append**: cap 1,000, append 3,000 → count ≤1,100 (hysteresis),
   oldest gone, newest intact; instrument fakes to assert `append` never calls
   `getAllKeys` (the eventStore regression guard).
9. **Quota-exceeded on batch commit**: tighten fake IDB quota mid-batch → evict +
   retry path; second failure → records land in memory mirror, promises resolve,
   `degradedWrites` > 0, reads still see the values this session.
10. **DB-level recovery**: force `openDb` failure twice via fakes → deleteDatabase
    called, fresh DB opens, `dbRebuiltAt` set, `open-failures` counter reset; ONE
    failure does NOT nuke.
11. **Migration M2–M4**: seed legacy localStorage blobs → `migrateOversizedLocalStorage`
    moves them, sentinel bumps, second run is a no-op, zustand shim reads them back
    verbatim.
12. **Local analytics end-to-end**: seed a fixture script of 3 simulated days
    (sessions, activity_results with known predictedRecall/outcomes, streak events) →
    assert `getCalibrationReport` bucket math + Brier against hand-computed values;
    `getStrandBalance` shares sum to 1; `getEngagementSnapshot` transitions
    new→current→at_risk→resurrected as fake days advance; `getPersonalRecords` picks
    the right day; `rebuildRollups()` from the raw log reproduces byte-identical
    rollups (derived-state proof).
13. **Privacy fence**: static check (grep in harness) that `lib/localAnalytics/**`
    contains no `fetch(`, no endpoint URL, no `@shared/analytics` import; runtime
    check that `syncLocalEvents()` uploads zero records from the `local-analytics`
    namespace (fake fetch counts payloads).
14. **hostApi isolation**: two fake packIds → keys() sees only own keys; per-pack
    budget enforced (writes past 2MB dropped + counted); pack event rate limit trips
    at 5,001.

Harness stays the CI-runnable proof: `esbuild ... --platform=node` + `node`, non-zero
exit on any FAIL (`run.ts:6-22` conventions).

### 7.2 Type + integration

- `npm run tsc` green; `cargo check` green after `blob_store.rs`.
- `npm run tauri dev` manual pass: doctor panel renders; report shows the migrated
  namespaces; kill-and-relaunch mid-session loses ≤ the last batch window of events.
- Device sanity (iOS WKWebView is the constrained one): `idbEstimate()` may return
  null (`idb.ts:219-237`) — doctor must render "unknown quota" gracefully; verify the
  v1→v2 IDB upgrade preserves catalogs on an upgraded install (install previous
  build, populate, upgrade, check Home catalog renders offline).

### 7.3 Simulation tie-in (D4)

The engine simulation harness constructs `EnginePersistence` from in-memory fakes
(`__harness__/fakes.ts` exports `memoryDocStore`, `memoryAppendLog` for reuse) —
synthetic-learner runs on the Spark exercise the same interfaces the device uses.

---

## 8. Rollout + bookkeeping

1. **PR 1** — re-home `util/storage` → `lib/storage` (git mv + shims), IDB v2 upgrade,
   `WriteBatcher`, `DocStore`, `AppendLog`, `namespaces.ts`, doctor programmatic API,
   harness sections 5–10. No product behavior change.
2. **PR 2** — local analytics module + rollups + queries + harness 12–13; wire
   session/streak recorders behind the Journey surface flag.
3. **PR 3** — M2/M3/M4 store migrations + harness 11 + doctor panel.
4. **PR 4** — hostApi `storage` + `localAnalytics` + SDK types + HOST_CAPS + harness
   14; `blob_store.rs` (unblocks `specs/offline-cache.md`).
5. **M5 pack migrations** ride each pack's own release train afterward.

Changelog: every PR adds `[Unreleased]` entries to `corpan-app/CHANGELOG.md` (and the
SDK's / affected packs' changelogs for PR 4+) per `corpan/CHANGELOGS.md`. i18n: the
single "Delete learning history" key lands in all ~54 locales in PR 2 (build gate).

---

## Decisions taken here (flag to operator if they bind)

- **D-a**: D5's "~20k-row review-log ring buffer" is implemented AS the local
  analytics log (one append-only source, engine + queries as readers), not a second
  per-item copy. `specs/engine.md` must consume `EnginePersistence` (§3.7).
- **D-b**: gate counters (`corpan:gate:*`) and per-pack streak stamps
  (`corpan.streak.v1.*`) STAY in localStorage — their consumers are contractually
  synchronous (`quotas.ts:9-16`, `hostApi.getStreak`).
- **D-c**: local analytics capture ignores the telemetry opt-out flag
  (`corpan-analytics-disabled`) because nothing is transmitted; the user control is
  deletion. If the operator prefers one switch to silence both, it is a two-line
  change in `recordLocal`.
- **D-d**: new canonical path is `src/lib/storage/` (per directive) with the existing
  `src/util/storage/` re-exported for one release, then removed.
- **D-e**: ring budget 100k records / 48MB; pack KV budget 2MB / 1,000 keys; pack
  event rate 5k/day; blob store 128MB total — tuning knobs in `namespaces.ts`, not
  architecture.
