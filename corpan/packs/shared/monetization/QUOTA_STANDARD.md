# Daily-quota standard — one wall for every metered pack

This is the canonical reference for daily quotas + the pay-or-wait wall across
Corpán. Every metered surface (phrase-flip, the games, the tutor) uses the SAME
infrastructure: one registry of limits, one construction call, one storage-key
scheme, one overlay. Do not hand-roll a new quota.

---

## 1. The registry — one place for limits (`src/quotas.ts`)

`QUOTAS` is the single source of truth mapping each metered `surface` → its
config (`packId`, `dailyLimit`, `softNagEvery`, `unitLabel`, optional
`legacyKey`). **To tune a limit, edit this map — nothing else.** A typed
`getQuota(surface)` is the single read seam.

### Current limits

| surface             | packId               | dailyLimit | softNagEvery | unitLabel    | legacyKey         |
| ------------------- | -------------------- | ---------- | ------------ | ------------ | ----------------- |
| `phrase_flips`      | `corpan_app`         | 20         | 10           | `phrases`    | —                 |
| `parlometron_daily` | `pronunciation_coach`| 10         | 0            | `phrases`    | —                 |
| `hover_phrases`     | `hover-runner`       | 20         | 10           | `phrases`    | —                 |
| `juice_phrases`     | `juice_squeeze`      | 20         | 10           | `phrases`    | —                 |
| `hanzipan_chars`    | `hanzipan`           | 20         | 10           | `characters` | —                 |
| `tutomaton_daily`   | `tutomaton`          | 20         | 10           | `messages`   | `tutomaton.quota` |

**Remote config (built):** these are the baked defaults; a remote-config layer
overrides them live without an app build. `getQuota` is the merge point. See
"Remote config" below.

### Remote config — re-tune caps without an app build

The caps are A/B-tunable at runtime. The HOST fetches a small JSON at launch and
publishes a validated override on `globalThis.__corpanQuotaConfig`; `getQuota`
merges it OVER the baked row.

**URL.** `https://d38iwc9748jekz.cloudfront.net/quota-config.json` — the same
CloudFront distribution that serves `catalog-v2.json` / `app-version.json` (no
new infra). Overridable at build time via `VITE_QUOTA_CONFIG_URL`. Ops uploads
to `s3://corpan-prod/quota-config.json`; the repo seed +
how-to-push-a-change live in `corpan/infra/quota-config.json` +
`corpan/infra/QUOTA_CONFIG.md`.

**Shape.**

```json
{ "version": 1, "quotas": { "<surface>": { "dailyLimit": 20, "softNagEvery": 5 } } }
```

Only `dailyLimit` / `softNagEvery` are honored — `packId` / `surface` /
`unitLabel` always stay baked and can't be changed remotely. `dailyLimit` is
clamped **1..1000**, `softNagEvery` **1..dailyLimit**. Unknown surfaces ignored;
partial overrides fine; omitted surfaces keep baked values.

**Client.** `corpan-app/src/util/remoteQuotaConfig.ts`, wired early in
`main.tsx` (`initRemoteQuotaConfig()` — before packs mount). Anonymous GET (no
PII, no identifiers), best-effort, never blocks launch.

**Fail-safe.** Absent file (404) / network error / malformed or out-of-range
value → baked defaults. The client validates + clamps before caching;
`getQuota` clamps again defensively. A bad config can never crash the app or
escape the bounds.

**Timing (stale-while-revalidate).** The last-good cached config is applied
**synchronously** at launch (so an early-mounting pack sees it), then refreshed
in the background (TTL ~6h) for next launch. A **live gate caches its config at
construct time**, so a mid-session change takes effect on the **next gate
construction** (re-entering a pack) and reliably on the **next launch** — by
design. Packs need NO change: they already read the registry via
`createDailyQuota` → `getQuota`.

---

## 2. `createDailyQuota(surface)` — the ONE construction pattern

A pack builds its gate with:

```ts
import { createDailyQuota } from "@shared/monetization"

const gate = createDailyQuota("hover_phrases", { isSubscribed })
```

`createDailyQuota` reads `QUOTAS[surface]` and forwards the standard gate-v2
config (`mode:"daily"`, `dailyLimit`, `softNagEvery`, `unitLabel`, `legacyKey`)
to `createPaywallGate`. Pass-through options: `isSubscribed`, `storage`, `now`,
`requestPaywall`, `requestDailyLock`, `onFire`, `detail`. **Never write a raw
`createPaywallGate({ packId, surface, mode:"daily", dailyLimit, … })` block for a
metered surface** — that's exactly the per-pack drift this replaced.

The gate API a pack uses: `note()` (count one metered action — fires the soft
nag / hard lock internally), `isBlocked()`, `requestDailyLock()` (re-pop the lock
when a blocked user tries again), `remaining()`, `resetAt()`, `reset()`,
`dispose()`.

---

## 3. Storage key + legacy migration

Standard persisted key: **`corpan:gate:<packId>:<surface>`** holding
`{ day, count, lastFireAt }`, resetting at local midnight.

**Legacy migration (kills the old inconsistency):** pre-gate builds wrote a
`<packId>.quota` `{ day, count }` key (e.g. tutomaton's `tutomaton.quota`). If the
standard key is ABSENT but the registry declares a `legacyKey` that is present,
`createPaywallGate` imports its count ONCE into the standard key on first read,
then proceeds normally. Tiny and storage-failure-safe. So an upgrade preserves
today's count and the old key-name dies. Declare the legacy key in the registry
row — do not re-implement the import per pack.

---

## 4. The ONE wall presentation — the host's `DailyLockOverlay`

There is a SINGLE wall for all packs: the host's `DailyLockOverlay`. At the cap
the gate dispatches `corpan:daily-locked` (`{ packId, surface, doneToday, limit,
resetAt, unitLabel }`); the host renders the overlay:

- z-`[1400]`, green-check **accomplishment** framing ("{{count}} {{unit}} for
  today"),
- a live countdown to `resetAt`,
- "Continue with Corpán Plus" + a dismissible "Maybe later".

**Never build a per-pack red/error cap state.** The cap is an accomplishment, not
a failure. Packs keep a calm, de-red'd "done for today" chrome and re-pop the
shared overlay (`gate.requestDailyLock()`) when a blocked user taps again. Soft
nags before the cap use the existing `corpan:request-unlock` paywall (dismiss and
continue). Backwards compat: an OTA pack in a pre-0.18.1 host (no
`__CORPAN_HOST_CAPS.dailyLock`) degrades to the dismissible soft nag rather than
hard-block behind an overlay it can't render.

---

## 5. Capped-on-entry pattern (skip expensive setup when already blocked)

If a pack does expensive setup on entry (e.g. tutomaton loading its on-device
model), check `gate.isBlocked()` FIRST and pop the lock instead of doing the
work — the user can't act anyway, so don't burn RAM/time. The model/setup loads
only if they subscribe from the lock.

Worked example: `corpan/packs/tutomaton/CAPPED_ENTRY_SPEC.md` — gate the
mount-time `modelMgr.check()` behind `if (quotaGate.isBlocked())
quotaGate.requestDailyLock() else void modelMgr.check()`, and load the model in
`onEntitlementChanged` if they go Plus from the lock.

---

## 6. Debug API (DEV only) — `window.__corpanDebug.quota`

Every gate registers itself on `globalThis.__corpanGates["<packId>:<surface>"]`
at construct (deleted on dispose) — cheap, harmless in prod. The host's DEV-only
`__corpanDebug.quota` (in `corpan-app/src/util/devDebug.ts`) drives the LIVE gate
via that registry, so changes take effect with no reload and in BOTH directions
(the old "set via localStorage doesn't reflect because readState takes
max(stored, memory)" pain):

- `quota.list()` → every registered gate + its `remaining()`/`isBlocked()`/`resetAt()`.
- `quota.set(surface, used)` → finds the live gate, `reset()`s it (clears the
  memory floor), then writes `corpan:gate:<packId>:<surface>` = `{ day: today,
  count: used }` so the next read reflects `used` exactly. The pack's chip
  updates on the next interaction.
- `quota.reset(surface)` → `gate.reset()`.
- `quota.clearAll()` → reset every registered gate.

Works for ANY registered pack (including OTA packs and tutomaton once converted).

---

## 7. Adding a new metered surface

1. Add one row to `QUOTAS` in `src/quotas.ts` (`packId`, `surface`, `dailyLimit`,
   `softNagEvery`, `unitLabel`; `legacyKey` only if a pre-gate key existed).
2. In the pack, construct the gate with `createDailyQuota("<surface>", {
   isSubscribed })`.
3. `note()` on each metered action; `isBlocked()` + `requestDailyLock()` at the
   action boundary; if there's expensive entry setup, gate it (§5).
4. The host already renders the shared `DailyLockOverlay` — no per-pack wall.

---

## Tutomaton migration (for the tutomaton agent — DO NOT apply from here)

Tutomaton is owned by another agent with uncommitted work; these are the exact
steps for that agent to apply in `corpan/packs/tutomaton/src/chat.ts`:

1. Change the import:
   `import { createDailyQuota, type PaywallGate } from "@shared/monetization"`
   (drop `createPaywallGate` if unused elsewhere).
2. Delete the local `FREE_DAILY_LIMIT = 20` and `FREE_DAILY_NAG_EVERY = 5`
   constants (now in `QUOTAS.tutomaton_daily`).
3. Replace the `createPaywallGate({ packId: PACK_ID, surface: "tutomaton_daily",
   mode: "daily", dailyLimit: FREE_DAILY_LIMIT, softNagEvery:
   FREE_DAILY_NAG_EVERY, unitLabel: "messages", isSubscribed: () => plus })`
   block (~L283) with:
   ```ts
   const quotaGate: PaywallGate = createDailyQuota("tutomaton_daily", {
     isSubscribed: () => plus,
   })
   ```
4. Behavior is identical — same key (`corpan:gate:tutomaton:tutomaton_daily`),
   same 20/5/messages, same `mode:"daily"`. The registry additionally declares
   `legacyKey: "tutomaton.quota"`, so any pre-gate `tutomaton.quota` count is now
   imported once into the standard key for free (no code needed in chat.ts).
5. Keep the capped-on-entry work and all cap-UX hunks from `CAPPED_ENTRY_SPEC.md`
   unchanged — only the gate construction changes.

Verify after: `tutomaton` build clean; the persisted key, limit, and nag are
unchanged; the legacy import preserves a same-day count on upgrade.
