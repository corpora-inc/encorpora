# Storage & Analytics Foundation

App-wide storage + on-device analytics for Corpán. This is the load-bearing
layer that fixes the production `QuotaExceededError` crash and gives the whole
app (and packs) ONE quota-safe place to persist data.

> TL;DR — Stop calling `localStorage.setItem` for anything that can grow. Use
> `storage.namespace(...)` (app) or `createPackStore(...)` (`@shared/state`,
> packs). Heavy data goes to IndexedDB; writes never throw.

---

## 1. The bug this fixes

All packs **and** the app share ONE WebView origin's `localStorage` (~5 MB —
see the "Corpán Packs Share localStorage" memory). The phrase-pack catalog
(hundreds of packs × localized name/description/topic strings) was persisted by
a zustand `persist` store **directly into localStorage**. Under a full catalog,
`localStorage.setItem` throws a **synchronous `QuotaExceededError`**, which
zustand's persist middleware surfaced as an **unhandled promise rejection**
(reported at `phrasePackCatalog.ts:36` in production). As analytics + per-pack
state grow, the same budget overruns and corrupts unrelated saves.

---

## 2. Architecture — two tiers

| Tier | Backing store | What goes here | API |
|------|---------------|----------------|-----|
| **TINY** | `localStorage` (guarded) | settings, flags, identity, tokens, opt-out, the analytics seq counter — small, critical, synchronously readable on first paint | `storage.namespace(name, { tier: "tiny" })` |
| **LARGE** | **IndexedDB** (`corpan-store` / `kv`) | phrase-pack & game catalogs, translation/content blobs, analytics events — big, async, growable | `storage.namespace(name, { tier: "large" })` (default) |

Key files (app): `corpan-app/src/util/storage/`
- `idb.ts` — dependency-free Promise wrapper over IndexedDB. One `kv` object
  store keyed by `namespace::key`; each record carries `size`, `createdAt`,
  `touchedAt` (LRU), `expiresAt` (TTL), `schema`, `volatile`.
- `index.ts` — the tiered service + `createLocalStorageShim()`.
- `migrate.ts` — one-time localStorage → IndexedDB migration.
- `eventStore.ts` — the analytics event log (see §6).

Pack equivalent: `packs/shared/state/safeStorage.ts` (`createPackStore`).

### Quota-safety contract (non-negotiable)

`set` / `setJSON` **ALWAYS resolve** — a `QuotaExceededError` never reaches a
caller. On a failed write the service:

1. **logs loudly** (project rule: errors are noisy, never silent),
2. **evicts** — volatile entries first, then LRU (oldest `touchedAt`),
3. **retries once**,
4. if it still fails, keeps the value in an **in-memory mirror** and resolves
   (the session keeps working; the write is simply not durable — loudly logged).

The TINY tier applies the same guarantee by trimming **only our own**
`corpan-store:`-prefixed keys (never another pack's / the app's keys) and
retrying.

---

## 3. API

```ts
import { storage } from "@/util/storage"

// LARGE tier (default) — a quota-safe IndexedDB-backed cache.
const cat = storage.namespace("phrase-pack-catalog", { tier: "large", volatile: true })
await cat.setJSON("catalog", value, { ttlMs: 5 * 60_000, schema: 1, volatile: true })
const v = await cat.getJSON<Catalog>("catalog", { schema: 1 }) // schema mismatch → undefined
await cat.del("catalog")

// TINY tier — small critical flags in guarded localStorage.
const flags = storage.namespace("flags", { tier: "tiny" })
await flags.setJSON("seenTour", true)
```

- `volatile: true` marks an entry **first-to-evict** under pressure. Caches set
  this; durable state (progress) does not. LARGE namespaces default volatile;
  TINY defaults durable. Per-set overrides win.
- `ttlMs` → reads past expiry return `undefined` and lazily reap.
- `schema` → a read with a mismatched stored schema is treated as a miss, so
  stale-shaped data never reaches the app.
- `storage.evictLargeTier(n)` — manual eviction (e.g. on a low-memory warning).

### zustand `persist` migration shim

```ts
import { createJSONStorage, persist } from "zustand/middleware"
import { createLocalStorageShim } from "@/util/storage"

persist(creator, {
  name: "corpan-phrase-pack-catalog-v1",
  storage: createJSONStorage(() =>
    createLocalStorageShim("phrase-pack-catalog", { tier: "large", volatile: true }),
  ),
  partialize: (s) => ({ catalog: s.catalog, lastFetched: s.lastFetched }),
})
```

`createLocalStorageShim` exposes async `getItem/setItem/removeItem` — zustand's
persist tolerates async storage, so this is a one-line move off localStorage.

---

## 4. What was migrated

| Store | Was | Now |
|-------|-----|-----|
| `store/phrasePackCatalog.ts` (`corpan-phrase-pack-catalog-v1`) | `localStorage` — **the crash** | LARGE-tier shim (`phrase-pack-catalog`, volatile) |
| `store/catalog.ts` (`corpan-catalog-v2`) | `localStorage` | LARGE-tier shim (`game-catalog`, volatile) |

Other localStorage users were audited and **left as-is** because they are tiny
and critical (TINY-tier-appropriate): `store/settings.ts`, `store/history.ts`,
`store/progress.ts`, `store/paywall.ts`, `StreakChip`, `DismissableTip`,
`SettingsModal` dev flag, the analytics opt-out flag. `store/translations.ts`
is a static i18n module, not a cache. The only oversized blobs were the two
catalogs.

### Startup migration (`util/storage/migrate.ts`)

Idempotent (writes a `corpan-storage-migration-v1` sentinel). On first launch
after upgrade it copies each legacy localStorage blob verbatim into the LARGE
tier under the same item name the new shim reads, then removes the bulky
localStorage entry. Wired in `main.tsx` after first paint; on a real migration
it re-hydrates the two catalog stores so the moved blob is picked up that
session.

---

## 5. Verification

`corpan-app/src/util/storage/__harness__/` — a node-executable proof (not a
unit-test framework run). It installs an in-memory IndexedDB + localStorage with
controllable quotas and asserts the contracts:

```bash
cd corpan-app
node_modules/.bin/esbuild src/util/storage/__harness__/run.ts \
  --bundle --platform=node --format=cjs --outfile=/tmp/storage-harness.cjs
node /tmp/storage-harness.cjs
```

Proves (all PASS): TINY-tier set never throws under quota (trims + memory
fallback); LARGE-tier persists across a simulated reload; schema mismatch reads
as a miss; LARGE-tier set never throws when IDB quota is hit and durable entries
survive volatile eviction; analytics events persist across reload, stay ordered,
ack-remove, and the 5 000-event ring-buffer cap holds (oldest evicted).

`npm run tsc` is clean for all new files.

---

## 6. Analytics — local-first, on-device

There is now **ONE analytics path**: every tracked event flows through the
single `emit()` chokepoint in `corpan-app/src/util/analytics.ts`, which writes
to BOTH:

1. **Cloud queue** — `@shared/analytics`'s in-memory + spillover queue (live,
   low-latency, opt-out-gated, CORS-safe).
2. **Durable on-device log** — `util/storage/eventStore.ts`: an IndexedDB
   append-only ring buffer, capped at `MAX_EVENTS = 5000` (oldest evicted).
   Each event carries a monotonic `seq` so ordering survives reload.

This is the "almost full analytics" substrate: rich capture (sessions, screens,
pack opens, challenge completions, errors) **without blowing storage** — the
ring buffer is bounded and lives in IndexedDB, not the shared localStorage.

### Capture API (add new events HERE, not via `analytics.track`)

```ts
import {
  trackScreenView, trackPackOpen, trackChallengeCompleted, trackError, trackEvent,
} from "@/util/analytics"
trackScreenView("home")
trackPackOpen("hanzipan", "library")
trackChallengeCompleted("juice-squeeze-l3", { score: 92 })
trackError("install", "zip extract failed")
```

Reaching for `analytics.track` directly would bypass the durable on-device log —
always go through these (or `trackEvent`).

### Sync seam

`syncLocalEvents()` (in `util/analytics.ts`) is a **reconcile**: it
`drainForUpload()`s the on-device log in batches, POSTs to the cloud
`/v1/events` endpoint, and `acknowledge()`s uploaded events out of the log only
on success (so a failed/offline upload simply retries). It is opt-out-gated and
single-flight, decoupled from capture and from the live cloud path — swap
`uploadBatch` to retarget without touching anything else. Called once after
first paint in `main.tsx`.

Privacy is unchanged: events live on-device, keyed by an **in-memory** session
id (no persistent device/install id, no account), and the **same** opt-out flag
(`corpan-analytics-disabled`) gates both the cloud path and on-device retention.

### CORS / credentials fix

The console error `Access-Control-Allow-Credentials` came from the unload path
using `navigator.sendBeacon`, which **always** sends credentials (cookies) and
gives no way to opt out. The endpoint replies with `Access-Control-Allow-Origin: *`,
which the browser refuses to combine with a credentialed request.

Fix (`packs/shared/analytics/index.ts`): the unload path now prefers a
`credentials: "omit"` **keepalive `fetch`** (which survives unload like a beacon
but lets us omit credentials, so the wildcard ACAO is honored). `sendBeacon` is
kept only as a last-resort fallback where keepalive fetch is unavailable. The
new seam's `uploadBatch` also sends `credentials: "omit", mode: "cors"`.

> If the server is ever changed to require credentials, it must echo a specific
> `Access-Control-Allow-Origin` (not `*`) and set
> `Access-Control-Allow-Credentials: true`. We deliberately do the opposite
> (no credentials) — there is no login and nothing cookie-bound to send.

---

## 7. Packs — `createPackStore`

Packs run in the host WebView origin and share the same localStorage budget +
the **same IndexedDB** (`corpan-store`). A pack rolling its own
`localStorage.setItem` can throw `QuotaExceededError` or evict another pack's /
the app's keys. Use the shared util instead:

```ts
import { createPackStore } from "@shared/state"

const store = createPackStore("my-pack")            // LARGE (IndexedDB) by default
await store.setJSON("progress", { level: 3 })       // quota-safe, never throws
const p = await store.getJSON<{ level: number }>("progress")

const flags = createPackStore("my-pack", { tier: "tiny" }) // small critical flags
```

Same contract as the app: namespaced, two-tier, evict + retry + memory
fallback, never throws. Large pack data lives alongside app data with shared
eviction — one storage substrate for the whole WebView.

---

## 8. Conventions

- **Never** `localStorage.setItem` for growable data. TINY tier for small
  critical flags only; everything else → LARGE tier.
- Mark caches `volatile: true`; never mark durable user state volatile.
- Stamp a `schema` on anything whose shape may change; bump it to invalidate
  stale data instead of writing migration code.
- Add new analytics events via the `track*` wrappers in `util/analytics.ts`
  (one-liners through `emit()`), never `analytics.track` directly.
- Errors are noisy: the storage layer logs every eviction + failed write. Do
  not "fix" the logs into silence.
